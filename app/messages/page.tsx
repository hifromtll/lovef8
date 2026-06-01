'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { touchLastLogin } from '@/lib/touchLastLogin';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import ProfilePreviewModal from './components/ProfilePreviewModal';
import type {
  BlockRow,
  Conversation,
  HostRow,
  LastMsg,
  Message,
  MyProfile,
  ParticipantRow,
  ProfileMini,
  ProfilePreviewData,
  UserRow,
} from './types';
import {
  getLastOpened,
  markSpamNudgeShown,
  setLastOpened,
  shouldShowSpamNudge,
  getSharedLanguages,
} from './utils';
import { getChatLimitMessage, getMaxActiveChats } from '@/lib/lovef8Access';


type ReadAtByConvo = Record<string, string | null>;

type PresenceRow = {
  profile_id: string;
  is_online: boolean;
  last_seen_at: string | null;
  updated_at: string | null;
};

type SparkEvent = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  spark_kind: 'normal' | 'super';
  created_at: string;
};

const PRESENCE_HEARTBEAT_MS = 30000;
const PRESENCE_IDLE_MS = 70000;
const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;
const avatarSignedUrlCache = new Map<string, string>();
const photoSignedUrlsCache = new Map<string, string[]>();

function extractStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;

  if (!value.startsWith('http')) {
    return value;
  }

  const marker = '/profile-photos/';
  const idx = value.indexOf(marker);

  if (idx === -1) return null;

  const afterBucket = value.slice(idx + marker.length);
  return afterBucket.split('?')[0] || null;
}

async function signAvatarUrl(value: string | null | undefined): Promise<string | null> {
  const path = extractStoragePath(value);
  if (!path) return null;

  const cacheKey = `${path}::thumb-96`;
  const cached = avatarSignedUrlCache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS, {
      transform: {
        width: 96,
        height: 96,
      },
    });

  if (error || !data?.signedUrl) {
    return null;
  }

  avatarSignedUrlCache.set(cacheKey, data.signedUrl);
  return data.signedUrl;
}


async function signProfileMinisBatch(profiles: ProfileMini[]): Promise<ProfileMini[]> {
  if (profiles.length === 0) return [];

  const pathByProfileId = new Map<string, string>();

  for (const profile of profiles) {
    const preferredAvatar =
      (profile as any).avatar_thumb_url || profile.avatar_url;

    const path = extractStoragePath(preferredAvatar);
    if (path) {
      pathByProfileId.set(profile.id, path);
    }
  }

  const uniquePaths = Array.from(new Set(pathByProfileId.values()));
  const signedMap = new Map<string, string>();

  if (uniquePaths.length > 0) {
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .createSignedUrls(uniquePaths, AVATAR_SIGNED_URL_TTL_SECONDS);

    if (!error && data) {
      data.forEach((item, index) => {
        const path = uniquePaths[index];
        if (path && item?.signedUrl) {
          signedMap.set(path, item.signedUrl);
          avatarSignedUrlCache.set(path, item.signedUrl);
        }
      });
    }
  }

  return profiles.map((profile) => {
    const path = pathByProfileId.get(profile.id);
    return {
      ...profile,
      avatar_url: path ? signedMap.get(path) || profile.avatar_url : profile.avatar_url,
    };
  });
}

async function signHostRow(host: HostRow): Promise<HostRow> {
  return {
    ...host,
    avatar_url: await signAvatarUrl(host.avatar_url),
  };
}

async function signUserRow(user: UserRow): Promise<UserRow> {
  return {
    ...user,
    avatar_url: await signAvatarUrl(user.avatar_url),
  };
}

async function signPhotoPaths(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];

  const cacheKey = paths.join('|');
  const cached = photoSignedUrlsCache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrls(paths, AVATAR_SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return [];
  }

  const signed = data
    .map((item) => item?.signedUrl || '')
    .filter((value): value is string => !!value);

  photoSignedUrlsCache.set(cacheKey, signed);
  return signed;
}

const settingsTranslationMemoryCache = new Map<string, Record<string, string>>();

function buildSettingsTranslationCacheKey(section: string, targetLanguage: string, texts: string[]) {
  return `lovef8-settings-ui::${section}::${targetLanguage}::${JSON.stringify(texts)}`;
}

function readSettingsTranslationCache(cacheKey: string): Record<string, string> | null {
  const memoryValue = settingsTranslationMemoryCache.get(cacheKey);
  if (memoryValue) return memoryValue;

  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(cacheKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Record<string, string>;
    settingsTranslationMemoryCache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    console.error('readSettingsTranslationCache error:', error);
    return null;
  }
}

function writeSettingsTranslationCache(cacheKey: string, map: Record<string, string>) {
  settingsTranslationMemoryCache.set(cacheKey, map);

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(map));
  } catch (error) {
    console.error('writeSettingsTranslationCache error:', error);
  }
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MessagesPageContent />
    </Suspense>
  );
}

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedConversationId = searchParams.get('conversationId');
  const requestedAnchorMessageId = searchParams.get('anchorMessageId');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const realtimeRef = useRef<any>(null);
  const typingRealtimeRef = useRef<any>(null);
  const readsRealtimeRef = useRef<any>(null);
  const presenceRealtimeRef = useRef<any>(null);
  const sparksRealtimeRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingAnchorMessageId, setPendingAnchorMessageId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [sparkEvents, setSparkEvents] = useState<SparkEvent[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingSpark, setSendingSpark] = useState(false);

  const [labels, setLabels] = useState<Record<string, ProfileMini>>({});
  const [remainingSparkLimit, setRemainingSparkLimit] = useState<number | null>(null);

  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [hostsError, setHostsError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [lastByConvo, setLastByConvo] = useState<Record<string, LastMsg>>({});
  const [unreadByConvo, setUnreadByConvo] = useState<Record<string, boolean>>({});

  const [blockedOtherIds, setBlockedOtherIds] = useState<Set<string>>(new Set());
  const [blocksLoading, setBlocksLoading] = useState(false);

  const [typingByConvo, setTypingByConvo] = useState<Record<string, string | null>>({});
  const [otherLastReadByConvo, setOtherLastReadByConvo] = useState<ReadAtByConvo>({});
  const [hiddenConversationIds, setHiddenConversationIds] = useState<Set<string>>(new Set());
  const [presenceByProfile, setPresenceByProfile] = useState<Record<string, PresenceRow>>({});

  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
  const [isDesktop, setIsDesktop] = useState(false);
  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false);
  const [profilePreview, setProfilePreview] = useState<ProfilePreviewData | null>(null);
  const [activeBoosterSparks, setActiveBoosterSparks] = useState(0);
    const [translationPromptDismissedByConvo, setTranslationPromptDismissedByConvo] = useState<Record<string, boolean>>({});
  const [dismissedNewMessageBannerByConvo, setDismissedNewMessageBannerByConvo] = useState<Record<string, boolean>>({});
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
const [translatedTopNavMap, setTranslatedTopNavMap] = useState<Record<string, string>>({});
const tr = (text: string) => translatedTopNavMap[text] || text;
const [forceEnglish, setForceEnglish] = useState(false);

const trSafe = (text: string) => {
  if (forceEnglish) return text;
  return translatedTopNavMap[text] || text;
};

const logAppEvent = useCallback(
  async (action: string, errorMessage: string, metadata?: Record<string, unknown>) => {
    try {
      await supabase.from('app_errors').insert({
        user_id: userId,
        page: '/messages',
        action,
        error_message: errorMessage,
        metadata: metadata ?? null,
      });
    } catch (err) {
      console.error('logAppEvent failed:', err);
    }
  },
  [userId]
);

   const isApprovedHostMe = useMemo(() => {
    return myProfile?.role === 'host' && myProfile?.approved === true;
  }, [myProfile]);

  const showGuideButton = useMemo(() => {
    if (isApprovedHostMe) return false;

    const createdAt = myProfile?.created_at;
    if (!createdAt) return true;

    const createdTime = new Date(createdAt).getTime();
    if (Number.isNaN(createdTime)) return true;

    const twentyOneDaysMs = 21 * 24 * 60 * 60 * 1000;
    return Date.now() - createdTime <= twentyOneDaysMs;
  }, [isApprovedHostMe, myProfile?.created_at]);

  const showHostsSection = useMemo(() => !isApprovedHostMe, [isApprovedHostMe]);
  const showUsersSection = useMemo(() => isApprovedHostMe, [isApprovedHostMe]);

  const sparkWarning = useMemo(() => {
  const profileBalance = Number((myProfile as any)?.spark_balance ?? 0);
  const totalAvailable = profileBalance + activeBoosterSparks;

  if (totalAvailable < 15) {
    return {
      tone: 'red' as const,
      title: 'You’re almost out of Sparks ⚡',
      body: 'Upgrade for more Sparks.',
    };
  }

  if (totalAvailable < 30) {
    return {
      tone: 'amber' as const,
      title: 'You’re getting low on Sparks ⚡',
      body: 'More Sparks are available with membership plans.',
    };
  }

  return null;
}, [myProfile, activeBoosterSparks]);

useEffect(() => {
  let isActive = true;

  async function translateTopNavUI() {
    if (!targetLanguage || targetLanguage === 'English') {
      if (isActive) {
        setTranslatedTopNavMap({});
      }
      return;
    }

    const allTexts = [
      'LoveF8 Messages',
      'Messages',
      'Connect',
      'Talk to Guide',
      'Wallet',
      'Host Dashboard',
      'Settings',
      'Report Issue',
      'Sign out',
      'Get Sparks',
    ];

    const cacheKey = buildSettingsTranslationCacheKey('messages-top-nav', targetLanguage, allTexts);
    const cached = readSettingsTranslationCache(cacheKey);

    if (cached) {
      if (isActive) {
        setTranslatedTopNavMap(cached);
      }
      return;
    }

    try {
      const res = await fetch('/api/translate-settings-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: allTexts, targetLanguage }),
      });

      const data = await res.json();

      if (!isActive) return;

      if (Array.isArray(data?.translations)) {
        const map: Record<string, string> = {};

        data.translations.forEach(
          (item: { original?: string; translated?: string }) => {
            if (!item?.original) return;
            map[item.original] = item.translated || item.original;
          }
        );

        writeSettingsTranslationCache(cacheKey, map);
        setTranslatedTopNavMap(map);
      }
    } catch (err) {
      console.error('translateTopNavUI error:', err);
    }
  }

  void translateTopNavUI();

  return () => {
    isActive = false;
  };
}, [targetLanguage]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  }, [router]);

  const openProfilePreview = useCallback(async (profile: ProfilePreviewData) => {
    setProfilePreview(profile);
    setProfilePreviewOpen(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          id,
          username,
          avatar_url,
          chat_mode,
          role,
          host_mode,
          approved,
          is_system_host,
          headline,
          short_bio,
          about_long,
          talk_topics,
          style_vibe,
          best_at,
          looking_for,
          profile_tags,
          location_text,
          timezone,
          normally_online_start,
          normally_online_end,
          languages_spoken,
          age,
          gender,
          interested_in,
          relationship_goal,
          has_kids,
          wants_kids,
          drink,
          smoke,
          exercise,
          pets,
          morning_or_night,
          long_distance_open,
          three_words,
          people_notice,
          proud_of,
          biggest_strength,
          what_matters,
          non_negotiable,
          healthy_relationship,
          hidden_talent,
          controversial_opinion,
          simple_pleasures,
          two_truths_lie
          `
        )
        .eq('id', profile.id)
        .single();

      if (error || !data) {
        console.error('openProfilePreview profile load error:', error);
        return;
      }

      const avatarPath = (data.avatar_url as string | null) || null;
      const signedAvatarUrl = await signAvatarUrl(avatarPath);

      const { data: listed, error: listError } = await supabase.storage
        .from('profile-photos')
        .list(profile.id, {
          limit: 100,
          sortBy: { column: 'name', order: 'desc' },
        });

      if (listError) {
        console.error('openProfilePreview photo list error:', listError);
      }

      const photoPaths =
        (listed || [])
          .filter((item) => !!item.name)
          .map((item) => `${profile.id}/${item.name}`) || [];

      const signedPhotoUrls = await signPhotoPaths(photoPaths);

      const photoCount = photoPaths.length;
      const canEarn = data.role === 'host' && data.approved === true && photoCount >= 3;

      setProfilePreview({
        id: data.id,
        username: data.username,
        avatarUrl: signedAvatarUrl,
        avatar_url: signedAvatarUrl,
        photo_urls: signedPhotoUrls,
        chat_mode: data.chat_mode,
        role: data.role,
        host_mode: data.host_mode,
        approved: data.approved,
        is_system_host: data.is_system_host,
        headline: data.headline,
        short_bio: data.short_bio,
        about_long: data.about_long,
        talk_topics: data.talk_topics,
        style_vibe: data.style_vibe,
        best_at: data.best_at,
        looking_for: data.looking_for,
        profile_tags: data.profile_tags,
        location_text: data.location_text,
        timezone: data.timezone,
        normally_online_start: data.normally_online_start,
        normally_online_end: data.normally_online_end,
        age: data.age,
        gender: data.gender,
        interested_in: data.interested_in,
        relationship_goal: data.relationship_goal,
        has_kids: data.has_kids,
        wants_kids: data.wants_kids,
        drink: data.drink,
        smoke: data.smoke,
        exercise: data.exercise,
        pets: data.pets,
        morning_or_night: data.morning_or_night,
        long_distance_open: data.long_distance_open,
        three_words: data.three_words,
        people_notice: data.people_notice,
        proud_of: data.proud_of,
        biggest_strength: data.biggest_strength,
        what_matters: data.what_matters,
        non_negotiable: data.non_negotiable,
        healthy_relationship: data.healthy_relationship,
        hidden_talent: data.hidden_talent,
        controversial_opinion: data.controversial_opinion,
        simple_pleasures: data.simple_pleasures,
        two_truths_lie: data.two_truths_lie,
        photo_count: photoCount,
        can_earn: canEarn,
      });
    } catch (err) {
      console.error('openProfilePreview unexpected error:', err);
    }
  }, []);

  const closeProfilePreview = useCallback(() => {
    setProfilePreviewOpen(false);
  }, []);

  const closeDesktopChat = useCallback(() => {
    setActiveConversationId(null);
    setPendingAnchorMessageId(null);
    setMessages([]);
    setSparkEvents([]);
    setNewMessage('');
  }, []);

  const scrollChatToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const upsertPresence = useCallback(async (_isOnline: boolean) => {
    return;
  }, []);

  const scheduleIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);

    idleTimeoutRef.current = setTimeout(() => {
      void upsertPresence(false);
    }, PRESENCE_IDLE_MS);
  }, [upsertPresence]);

  const markMeOnlineNow = useCallback(async () => {
    await upsertPresence(true);
    scheduleIdleTimer();
  }, [scheduleIdleTimer, upsertPresence]);

  const isProfileOnline = useCallback(
    (profileId: string | null | undefined) => {
      if (!profileId) return false;
      const row = presenceByProfile[profileId];
      if (!row) return false;
      if (row.is_online) return true;
      if (!row.last_seen_at) return false;

      const lastSeen = new Date(row.last_seen_at).getTime();
      return Date.now() - lastSeen < PRESENCE_IDLE_MS;
    },
    [presenceByProfile]
  );

  const getPresenceLabel = useCallback(
    (profileId: string | null | undefined) => {
      if (!profileId) return 'Offline';
      const row = presenceByProfile[profileId];
      if (!row?.last_seen_at) return 'Offline';

      if (isProfileOnline(profileId)) return 'Online now';

      const diffMs = Date.now() - new Date(row.last_seen_at).getTime();
      const diffMin = Math.floor(diffMs / 60000);

      if (diffMin <= 1) return 'Last seen just now';
      if (diffMin < 60) return `Last seen ${diffMin} min ago`;

      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `Last seen ${diffHr} hr ago`;

      return 'Offline';
    },
    [isProfileOnline, presenceByProfile]
  );
  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(
  'id, conversation_id, sender_id, content, created_at, is_edited, message_kind, media_path, media_mime_type, media_duration_seconds, expires_at'
)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('loadMessages error:', error);
      return;
    }

    const now = new Date().toISOString();

const filtered = (data || []).map((m: any) => {
  if (
    m.message_kind === 'video' &&
    m.expires_at &&
    m.expires_at < now
  ) {
    return {
      ...m,
      media_path: null,
      content: 'This video has expired',
    };
  }
  return m;
});

    const baseRows = (filtered as Message[]) || [];

    const signedRows = await Promise.all(
      baseRows.map(async (message) => {
        let media_url: string | null = null;

        if (message.media_path) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('chat-media')
            .createSignedUrl(message.media_path, 60 * 60);

          if (!signedError && signedData?.signedUrl) {
            media_url = signedData.signedUrl;
          }
        }

        return {
          ...message,
          media_url,
        };
      })
    );

    setMessages(signedRows as Message[]);
  }, []);
  const loadSparkEvents = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('conversation_sparks')
      .select('id, conversation_id, sender_id, receiver_id, amount, spark_kind, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('loadSparkEvents error:', error);
      return;
    }

    setSparkEvents((data as SparkEvent[]) || []);
  }, []);

  const loadHiddenConversationIds = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('user_hidden_conversations')
      .select('conversation_id')
      .eq('user_id', uid);

    if (error) {
      console.error('hidden conversations read error:', error);
      setHiddenConversationIds(new Set());
      return new Set<string>();
    }

    const next = new Set<string>((data || []).map((row: any) => row.conversation_id as string));
    setHiddenConversationIds(next);
    return next;
  }, []);

  const loadActiveBoosterSparks = useCallback(async (uid: string) => {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('member_booster_credits')
    .select('sparks_remaining')
    .eq('profile_id', uid)
    .gt('sparks_remaining', 0)
    .gt('expires_at', nowIso);

  if (error) {
    console.error('loadActiveBoosterSparks error:', error);
    setActiveBoosterSparks(0);
    return;
  }

  const total = (data || []).reduce((sum, row) => sum + (row.sparks_remaining || 0), 0);
  setActiveBoosterSparks(total);
}, []);

  const loadPresence = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_presence')
      .select('profile_id, is_online, last_seen_at, updated_at');

    if (error) {
      console.error('loadPresence error:', error);
      return;
    }

    const next: Record<string, PresenceRow> = {};
    for (const row of (data || []) as PresenceRow[]) {
      next[row.profile_id] = row;
    }
    setPresenceByProfile(next);
  }, []);

  const unhideConversation = useCallback(
    async (conversationId: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from('user_hidden_conversations')
        .delete()
        .eq('user_id', userId)
        .eq('conversation_id', conversationId);

      if (error) {
        console.error('unhideConversation error:', error);
        return;
      }

      setHiddenConversationIds((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
    },
    [userId]
  );

  const loadRemainingSparkLimit = useCallback(async () => {
    if (!userId || !activeConversationId) {
      setRemainingSparkLimit(null);
      return;
    }

    const otherProfile = labels[activeConversationId];
    if (!otherProfile?.id) {
      setRemainingSparkLimit(null);
      return;
    }

    const now = new Date();
    const last24HoursIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('conversation_sparks')
      .select('amount')
      .eq('sender_id', userId)
      .eq('receiver_id', otherProfile.id)
      .eq('spark_kind', 'normal')
      .gte('created_at', last24HoursIso);

    if (error) {
      console.error('loadRemainingSparkLimit error:', error);
      setRemainingSparkLimit(null);
      return;
    }

    const spent = (data || []).reduce((sum, row) => sum + (row.amount || 0), 0);
    const remaining = Math.max(0, 300 - spent);
    setRemainingSparkLimit(remaining);
  }, [activeConversationId, labels, userId]);

  const refreshBlocks = useCallback(async (uid: string) => {
    setBlocksLoading(true);

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);

    if (error) {
      console.error('user_blocks read error:', error);
      setBlockedOtherIds(new Set());
      setBlocksLoading(false);
      return new Set<string>();
    }

    const rows = (data as BlockRow[]) || [];
    const next = new Set<string>();

    for (const row of rows) {
      if (row.blocker_id === uid) next.add(row.blocked_id);
      if (row.blocked_id === uid) next.add(row.blocker_id);
    }

    setBlockedOtherIds(next);
    setBlocksLoading(false);
    return next;
  }, []);

  const loadHosts = useCallback(async (blocked: Set<string>) => {
    setHostsLoading(true);
    setHostsError(null);

   const { data, error } = await supabase
  .from('profiles')
  .select(
    'id, username, host_mode, chat_mode, avatar_url, headline, short_bio, about_long, talk_topics, style_vibe, best_at, looking_for, profile_tags, location_text, timezone, normally_online_start, normally_online_end, languages_spoken, age, gender, interested_in'
  )
  .eq('role', 'host')
  .eq('approved', true)
  .order('username', { ascending: true });

    if (error) {
      setHostsError(error.message);
      setHosts([]);
      setHostsLoading(false);
      return;
    }

    const rawHosts = (data as HostRow[]) || [];
    const filteredHosts = rawHosts.filter((host) => !blocked.has(host.id));
    const signedHosts = await Promise.all(filteredHosts.map(signHostRow));

    setHosts(signedHosts);
    setHostsLoading(false);
  }, []);

  const loadDiscoverableUsers = useCallback(async (blocked: Set<string>) => {
    setUsersLoading(true);
    setUsersError(null);

  const { data, error } = await supabase
  .from('profiles')
  .select(
    'id, username, chat_mode, avatar_url, headline, short_bio, about_long, talk_topics, style_vibe, best_at, looking_for, profile_tags, location_text, timezone, normally_online_start, normally_online_end, languages_spoken, age, gender, interested_in'
  )
  .eq('role', 'user')
  .eq('discoverable', true)
  .order('username', { ascending: true });

    if (error) {
      setUsersError(error.message);
      setUsers([]);
      setUsersLoading(false);
      return;
    }

    const rawUsers = (data as UserRow[]) || [];
    const filteredUsers = rawUsers.filter((user) => !blocked.has(user.id));
    const signedUsers = await Promise.all(filteredUsers.map(signUserRow));

    setUsers(signedUsers);
    setUsersLoading(false);
  }, []);

  const loadLastMessages = useCallback(async (uid: string, convoIds: string[]) => {
    if (convoIds.length === 0) {
      setLastByConvo({});
      setUnreadByConvo({});
      return {} as Record<string, LastMsg>;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, content, created_at')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      console.error('loadLastMessages error:', error);
      return {} as Record<string, LastMsg>;
    }

    const rows = (data as LastMsg[]) || [];
    const nextLastByConvo: Record<string, LastMsg> = {};

    for (const row of rows) {
      if (!nextLastByConvo[row.conversation_id]) {
        nextLastByConvo[row.conversation_id] = row;
      }
    }

    const nextUnreadByConvo: Record<string, boolean> = {};

    for (const convoId of convoIds) {
      const last = nextLastByConvo[convoId];

      if (!last) {
        nextUnreadByConvo[convoId] = false;
        continue;
      }

      const lastTs = new Date(last.created_at).getTime();
      const openedTs = getLastOpened(convoId);

      nextUnreadByConvo[convoId] = last.sender_id !== uid && lastTs > openedTs;
    }

    setLastByConvo(nextLastByConvo);
    setUnreadByConvo(nextUnreadByConvo);

    return nextLastByConvo;
  }, []);

  const loadReadReceipts = useCallback(async (uid: string, convoIds: string[]) => {
    if (convoIds.length === 0) {
      setOtherLastReadByConvo({});
      return;
    }

    const { data, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id, profile_id, last_read_at')
      .in('conversation_id', convoIds);

    if (error) {
      console.error('loadReadReceipts error:', error);
      return;
    }

    const rows = (data || []) as Array<{
      conversation_id: string;
      profile_id: string;
      last_read_at: string | null;
    }>;

    const next: ReadAtByConvo = {};

    for (const row of rows) {
      if (row.profile_id !== uid) {
        next[row.conversation_id] = row.last_read_at;
      }
    }

    setOtherLastReadByConvo(next);
  }, []);

  const markConversationRead = useCallback(async (conversationId: string, uid: string) => {
    const stamp = new Date().toISOString();

    const { error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: stamp })
      .eq('conversation_id', conversationId)
      .eq('profile_id', uid);

    if (error) {
      console.error('markConversationRead error:', error);
    }
  }, []);

  const loadConversationsAndLabels = useCallback(
    async (uid: string) => {
      const { data: myRows, error: myErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', uid);

      if (myErr) {
        console.error('conversation_participants read error full:', {
          message: myErr.message,
          details: myErr.details,
          hint: myErr.hint,
          code: myErr.code,
        });

        alert(
          `conversation_participants read error:\n${myErr.message || 'Unknown'}\n${myErr.details || ''}\n${myErr.hint || ''}\n${myErr.code || ''}`
        );
        return;
      }

      const convoIds = (myRows || []).map((row: any) => row.conversation_id as string);

      if (convoIds.length === 0) {
        setConversations([]);
        setActiveConversationId(null);
        setLabels({});
        setMessages([]);
        setSparkEvents([]);
        setLastByConvo({});
        setUnreadByConvo({});
        setTypingByConvo({});
        setOtherLastReadByConvo({});
        return;
      }

      const { data: convoRows, error: convoErr } = await supabase
        .from('conversations')
        .select('id, created_at')
        .in('id', convoIds)
        .order('created_at', { ascending: false });

      if (convoErr) {
        console.error('conversations read error:', convoErr);
        return;
      }

      const convos = (convoRows as Conversation[]) || [];
      setConversations(convos);

      const { data: participantRows, error: participantErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id, profile_id')
        .in('conversation_id', convoIds);

      if (participantErr) {
        console.error('conversation_participants list error:', participantErr);
        return;
      }

      const participants = (participantRows as ParticipantRow[]) || [];
      const convoToOther: Record<string, string> = {};

      for (const row of participants) {
        if (row.profile_id !== uid) {
          convoToOther[row.conversation_id] = row.profile_id;
        }
      }

      const otherIds = Array.from(new Set(Object.values(convoToOther)));

      if (otherIds.length === 0) {
        setLabels({});
      } else {
  const { data: otherProfiles, error: profErr } = await supabase
    .from('profiles')
    .select(`
  id,
  username,
  role,
  approved,
  is_system_host,
  is_guide,
  discoverable,
  chat_mode,
  host_mode,
  avatar_thumb_url,
  avatar_url,
  location_text,
  timezone,
  normally_online_start,
  normally_online_end,
  languages_spoken,
  age,
  gender,
  interested_in,
  headline,
  short_bio,
  profile_tags
`)
    .in('id', otherIds);

  if (profErr) {
    console.error('profiles read error:', profErr);
    return;
  }

 const signedProfiles = await signProfileMinisBatch(
  (otherProfiles || []) as unknown as ProfileMini[]
);
  const byId: Record<string, ProfileMini> = {};
  signedProfiles.forEach((profile) => {
    byId[profile.id] = profile;
  });

  const nextLabels: Record<string, ProfileMini> = {};
  for (const [conversationId, otherId] of Object.entries(convoToOther)) {
    if (byId[otherId]) nextLabels[conversationId] = byId[otherId];
  }

  setLabels(nextLabels);
}

      await loadLastMessages(uid, convoIds);
      await loadReadReceipts(uid, convoIds);

      setActiveConversationId((prev) => {
        if (!prev) return null;
        const prevStillExists = convos.some((c) => c.id === prev);
        return prevStillExists ? prev : null;
      });
    },
    [loadLastMessages, loadReadReceipts]
  );

  const upsertTypingState = useCallback(
    async (conversationId: string, isTyping: boolean) => {
      if (!userId) return;

      const { error } = await supabase.from('conversation_typing').upsert(
        {
          conversation_id: conversationId,
          profile_id: userId,
          is_typing: isTyping,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'conversation_id,profile_id' }
      );

      if (error) {
        console.error('typing upsert error:', error);
      }
    },
    [userId]
  );
const activeOther = useMemo(() => {
  if (!activeConversationId) return null;
  return labels[activeConversationId] || null;
}, [activeConversationId, labels]);

const activeOtherOnline = useMemo(() => {
  return isProfileOnline(activeOther?.id);
}, [activeOther?.id, isProfileOnline]);

const sharedLanguages = useMemo(() => {
  if (!myProfile || !activeOther) return [];

  return getSharedLanguages(
    (myProfile as any)?.languages_spoken,
    activeOther?.languages_spoken
  );
}, [myProfile, activeOther]);

const hasLanguageOverlap = sharedLanguages.length > 0;
  const activeOtherPresenceLabel = useMemo(() => {
    return getPresenceLabel(activeOther?.id);
  }, [activeOther?.id, getPresenceLabel]);

  const isBlockedWithActive = useMemo(() => {
    if (!activeOther?.id) return false;
    return blockedOtherIds.has(activeOther.id);
  }, [activeOther, blockedOtherIds]);

  const activeTypingName = useMemo(() => {
    if (!activeConversationId) return null;
    return typingByConvo[activeConversationId] || null;
  }, [activeConversationId, typingByConvo]);

  const activeOtherLastReadAt = useMemo(() => {
    if (!activeConversationId) return null;
    return otherLastReadByConvo[activeConversationId] || null;
  }, [activeConversationId, otherLastReadByConvo]);

  const sentSparkTotal = useMemo(() => {
    if (!userId) return 0;
    return sparkEvents
      .filter((spark) => spark.sender_id === userId)
      .reduce((sum, spark) => sum + spark.amount, 0);
  }, [sparkEvents, userId]);

  const receivedSparkTotal = useMemo(() => {
    if (!userId) return 0;
    return sparkEvents
      .filter((spark) => spark.receiver_id === userId)
      .reduce((sum, spark) => sum + spark.amount, 0);
  }, [sparkEvents, userId]);

  const inboxConversations = useMemo(() => {
    const scoreFor = (conversationId: string, createdAt: string) => {
      const last = lastByConvo[conversationId];
      const lastTs = last ? new Date(last.created_at).getTime() : 0;
      const createdTs = createdAt ? new Date(createdAt).getTime() : 0;
      return Math.max(lastTs, createdTs);
    };

    const bestByOther: Record<string, Conversation> = {};

    for (const conversation of conversations) {
      if (hiddenConversationIds.has(conversation.id)) continue;

     const other = labels[conversation.id];

if (!other) continue;
if (other.role === 'admin') continue;

const otherKey = other.id;
const currentBest = bestByOther[otherKey];

      if (!currentBest) {
        bestByOther[otherKey] = conversation;
        continue;
      }

      const a = scoreFor(conversation.id, conversation.created_at);
      const b = scoreFor(currentBest.id, currentBest.created_at);

      if (a > b) bestByOther[otherKey] = conversation;
    }

    return Object.values(bestByOther).sort((a, b) => {
      const sa = scoreFor(a.id, a.created_at);
      const sb = scoreFor(b.id, b.created_at);
      return sb - sa;
    });
  }, [conversations, hiddenConversationIds, labels, lastByConvo]);

  const hiddenConversations = useMemo(() => {
    const scoreFor = (conversationId: string, createdAt: string) => {
      const last = lastByConvo[conversationId];
      const lastTs = last ? new Date(last.created_at).getTime() : 0;
      const createdTs = createdAt ? new Date(createdAt).getTime() : 0;
      return Math.max(lastTs, createdTs);
    };

    return conversations
      .filter((conversation) => hiddenConversationIds.has(conversation.id))
      .sort((a, b) => {
        const sa = scoreFor(a.id, a.created_at);
        const sb = scoreFor(b.id, b.created_at);
        return sb - sa;
      });
  }, [conversations, hiddenConversationIds, lastByConvo]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      setActiveConversationId(conversationId);
      setLastOpened(conversationId, Date.now());
      setUnreadByConvo((prev) => ({ ...prev, [conversationId]: false }));

      if (!isDesktop) {
        setMobileView('chat');
      }

      if (userId) {
        await markConversationRead(conversationId, userId);
      }
    },
    [isDesktop, markConversationRead, userId]
  );

  useEffect(() => {
    if (!requestedConversationId || !userId) return;

    const exists = conversations.some((conversation) => conversation.id === requestedConversationId);
    if (!exists) return;

    setPendingAnchorMessageId(requestedAnchorMessageId);

    void openConversation(requestedConversationId).then(() => {
      window.history.replaceState({}, '', '/messages');
    });
  }, [
    conversations,
    openConversation,
    requestedConversationId,
    requestedAnchorMessageId,
    userId,
  ]);

  useEffect(() => {
    if (!requestedConversationId && conversations.length === 0) {
      setActiveConversationId(null);
      setPendingAnchorMessageId(null);
      setMessages([]);
      setSparkEvents([]);
      setNewMessage('');
    }
  }, [conversations.length, requestedConversationId]);

  const goBackToSidebar = useCallback(() => {
    setMobileView('sidebar');
  }, []);

  const hideConversation = useCallback(
    async (conversationId: string) => {
      if (!userId) return;

      const { error } = await supabase.from('user_hidden_conversations').upsert(
        {
          user_id: userId,
          conversation_id: conversationId,
        },
        { onConflict: 'user_id,conversation_id' }
      );

      if (error) {
        alert(error.message);
        return;
      }

      setHiddenConversationIds((prev) => {
        const next = new Set(prev);
        next.add(conversationId);
        return next;
      });

      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setPendingAnchorMessageId(null);
        setMessages([]);
        setSparkEvents([]);
        setNewMessage('');

        if (!isDesktop) {
          setMobileView('sidebar');
        }
      }
    },
    [activeConversationId, isDesktop, userId]
  );

  const openOrCreateConversationWithProfile = useCallback(
    async (otherId: string) => {
      if (!userId) return;

      if (blockedOtherIds.has(otherId)) {
        alert('Chat not available.');
        return;
      }

      const existingConversation = Object.entries(labels).find(
        ([, profile]) => profile?.id === otherId
      );

      const { data, error } = await supabase.rpc('create_or_get_conversation', {
        other_profile_id: otherId,
      });

      if (error) {
        console.error('create_or_get_conversation error:', error);
        alert(error.message);
        return;
      }

      const convoId = data as string;

      setPendingAnchorMessageId(null);
      await unhideConversation(convoId);
      await loadConversationsAndLabels(userId);
      await openConversation(convoId);
      await loadMessages(convoId);
      await loadSparkEvents(convoId);
      scrollChatToBottom();
    },
    [
      blockedOtherIds,
      inboxConversations.length,
      labels,
      loadConversationsAndLabels,
      loadMessages,
      loadSparkEvents,
      myProfile,
      openConversation,
      scrollChatToBottom,
      unhideConversation,
      userId,
    ]
  );

  const sendMessage = useCallback(
  async (payload?: {
    messageKind?: 'text' | 'image' | 'video';
    mediaFile?: File | null;
    mediaKind?: 'image' | 'video' | null;
  }) => {
    if (!userId || !activeConversationId) return;

    if (isBlockedWithActive) {
      alert('You cannot send messages in this chat.');
      return;
    }
      const messageKind = payload?.messageKind ?? 'text';
      const mediaFile = payload?.mediaFile ?? null;
      const mediaKind = payload?.mediaKind ?? null;

      const text = newMessage.trim();

      // Validate input (text OR media)
      if (messageKind === 'text') {
        if (!text) return;
      } else {
        if (!mediaFile) {
          alert('No media file selected.');
          return;
        }
      }

      const isOtherApprovedHost = activeOther?.role === 'host' && activeOther?.approved === true;

      if (
        isApprovedHostMe &&
        !isOtherApprovedHost &&
        myProfile?.is_system_host !== true &&
        activeOther?.id
      ) {
        let lastOtherIndex = -1;

        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].sender_id === activeOther.id) {
            lastOtherIndex = i;
            break;
          }
        }

      let mySinceOther = 0;
      for (let i = lastOtherIndex + 1; i < messages.length; i++) {
        if (messages[i].sender_id === userId) mySinceOther++;
      }

      const userHasSpoken = lastOtherIndex !== -1;

      if (userHasSpoken && mySinceOther >= 2) {
        const ok = confirm(
          `${activeOther.username || 'This user'} hasn't replied yet.\n\nSend anyway and spend 1 spark?`
        );
        if (!ok) return;
      }

      if (userHasSpoken && mySinceOther >= 10) {
        const now = Date.now();
        if (shouldShowSpamNudge(activeConversationId, now)) {
          alert(
            `${activeOther.username || 'This user'} hasn't replied yet.\n\nIf you reach 10+ messages in 24 hours with no reply, chat may pause until they respond.`
          );
          markSpamNudgeShown(activeConversationId, now);
        }
      }
    }    setSending(true);

    try {
      let mediaPath: string | null = null;
      let mediaMimeType: string | null = null;
      let mediaDurationSeconds: number | null = null;

console.log("MEDIA CHECK:", messageKind, !!mediaFile, mediaKind);
      if (messageKind !== 'text' && mediaFile && mediaKind) {
        const fileExt = mediaFile.name.split('.').pop()?.toLowerCase() || 'bin';
        const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'bin';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
        const uploadPath = `${userId}/${activeConversationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(uploadPath, mediaFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          alert(uploadError.message);
          setSending(false);
          return;
        }

        mediaPath = uploadPath;
        mediaMimeType = mediaFile.type || null;

        if (mediaKind === 'video') {
          mediaDurationSeconds = await new Promise<number | null>((resolve) => {
            const objectUrl = URL.createObjectURL(mediaFile);
            const video = document.createElement('video');
            video.preload = 'metadata';

            video.onloadedmetadata = () => {
              URL.revokeObjectURL(objectUrl);
              resolve(Math.ceil(video.duration || 0));
            };

            video.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              resolve(null);
            };

            video.src = objectUrl;
          });
        } else {
          mediaDurationSeconds = null;
        }
      }

      const { error } = await supabase.rpc('send_message', {
        p_conversation_id: activeConversationId,
        p_content: text,
        p_message_kind: messageKind,
        p_media_path: mediaPath,
        p_media_mime_type: mediaMimeType,
        p_media_duration_seconds: mediaDurationSeconds,
      });

      if (error) {
  const msg = error.message || '';

  await logAppEvent('send_message_failed', msg, {
    conversationId: activeConversationId,
    messageKind,
  });

  if (msg.includes('25 photos')) {
    alert('You’ve reached the photo limit for this chat (25 every 12 hours).');
  } else if (msg.includes('10 videos')) {
    alert('You’ve reached the video limit for this chat (10 every 12 hours).');
  } else {
    alert(msg);
  }

  setSending(false);
  return;
}
      setNewMessage('');
      await upsertTypingState(activeConversationId, false);
      await unhideConversation(activeConversationId);
      await loadMessages(activeConversationId);
      await loadConversationsAndLabels(userId);

      const { data: refreshedProfile, error: refreshedProfileError } = await supabase
        .from('profiles')
        .select('spark_balance')
        .eq('id', userId)
        .single();

      if (refreshedProfileError) {
        console.error('refresh profile balance error:', refreshedProfileError);
      } else if (refreshedProfile) {
        setMyProfile((prev) =>
          prev
            ? ({
                ...prev,
                spark_balance: refreshedProfile.spark_balance ?? 0,
              } as MyProfile)
            : prev
        );
      }

      setSending(false);
      scrollChatToBottom();
    } catch (err) {
  const msg = err instanceof Error ? err.message : 'Unknown unexpected sendMessage error';

  console.error('sendMessage unexpected error:', err);

  await logAppEvent('send_message_unexpected_error', msg, {
    conversationId: activeConversationId,
    messageKind,
  });

  alert('Unexpected error sending message.');
  setSending(false);
}
  }, [
    activeConversationId,
    activeOther,
    isApprovedHostMe,
    isBlockedWithActive,
    loadConversationsAndLabels,
    loadMessages,
    messages,
    myProfile,
    newMessage,
    scrollChatToBottom,
    unhideConversation,
    upsertTypingState,
    userId,
  ]);

  const sendSpark = useCallback(
    async (amount: number, kind: 'normal' | 'super' = 'normal') => {
      if (!userId || !activeConversationId || !activeOther?.id) return;

      if (isBlockedWithActive) {
        alert('You cannot send sparks in this chat.');
        return;
      }

      setSendingSpark(true);

      try {
        const now = new Date();
        const nowIso = now.toISOString();
        const last24HoursIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const { data: recent, error: recentError } = await supabase
          .from('conversation_sparks')
          .select('amount')
          .eq('sender_id', userId)
          .eq('receiver_id', activeOther.id)
          .eq('spark_kind', 'normal')
          .gte('created_at', last24HoursIso);

        if (recentError) {
          alert(recentError.message);
          setSendingSpark(false);
          return;
        }

        const spent = (recent || []).reduce((sum, r) => sum + (r.amount || 0), 0);
        const remainingLimit = 300 - spent;
        const displayName = activeOther.username || 'this host';

        if (kind === 'normal') {
          if (remainingLimit <= 0) {
            alert(`You've reached your daily spark limit with ${displayName} today.`);
            setSendingSpark(false);
            return;
          }

          if (amount > remainingLimit) {
            alert(`You can only send ${remainingLimit} more sparks to ${displayName} today.`);
            setSendingSpark(false);
            return;
          }
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('spark_balance')
          .eq('id', userId)
          .single();

        if (profileError) {
          alert(profileError.message);
          setSendingSpark(false);
          return;
        }

        let sparkBalanceStart = profile?.spark_balance || 0;

        const { data: boosters, error: boosterError } = await supabase
          .from('member_booster_credits')
          .select('id, sparks_remaining, expires_at, created_at')
          .eq('profile_id', userId)
          .gt('sparks_remaining', 0)
          .gt('expires_at', nowIso)
          .order('expires_at', { ascending: true })
          .order('created_at', { ascending: true });

        if (boosterError) {
          alert(boosterError.message);
          setSendingSpark(false);
          return;
        }

        let remaining = amount;
        let sparkBalanceEnd = sparkBalanceStart;
        const boosterUpdates: { id: string; newRemaining: number }[] = [];

        if (sparkBalanceEnd > 0) {
          const sparkUsed = Math.min(sparkBalanceEnd, remaining);
          sparkBalanceEnd -= sparkUsed;
          remaining -= sparkUsed;
        }

        for (const booster of boosters || []) {
          if (remaining <= 0) break;

          const currentRemaining = booster.sparks_remaining || 0;
          const use = Math.min(currentRemaining, remaining);

          boosterUpdates.push({
            id: booster.id,
            newRemaining: currentRemaining - use,
          });

          remaining -= use;
        }

        if (remaining > 0) {
          alert('Not enough sparks.');
          setSendingSpark(false);
          return;
        }

        if (sparkBalanceEnd !== sparkBalanceStart) {
          const { error: sparkUpdateError } = await supabase
            .from('profiles')
            .update({
              spark_balance: sparkBalanceEnd,
            })
            .eq('id', userId);

          if (sparkUpdateError) {
            alert(`Spark deduction failed: ${sparkUpdateError.message}`);
            setSendingSpark(false);
            return;
          }
        }

        for (const update of boosterUpdates) {
          const { error: boosterUpdateError } = await supabase
            .from('member_booster_credits')
            .update({
              sparks_remaining: update.newRemaining,
            })
            .eq('id', update.id);

          if (boosterUpdateError) {
            alert(`Booster deduction failed: ${boosterUpdateError.message}`);
            setSendingSpark(false);
            return;
          }
        }

        const { error: sparkInsertError } = await supabase
          .from('conversation_sparks')
          .insert({
            conversation_id: activeConversationId,
            sender_id: userId,
            receiver_id: activeOther.id,
            amount,
            spark_kind: kind,
          });

        if (sparkInsertError) {
          alert(`Spark send failed: ${sparkInsertError.message}`);
          setSendingSpark(false);
          return;
        }

        const { data: refreshedProfile, error: refreshedProfileError } = await supabase
          .from('profiles')
          .select('spark_balance')
          .eq('id', userId)
          .single();

        if (refreshedProfileError) {
          console.error('refresh spark balance error:', refreshedProfileError);
        } else if (refreshedProfile) {
          setMyProfile((prev) =>
            prev
              ? ({
                  ...prev,
                  spark_balance: refreshedProfile.spark_balance ?? 0,
                } as MyProfile)
              : prev
          );
        }

        await unhideConversation(activeConversationId);
        await loadSparkEvents(activeConversationId);
        await loadRemainingSparkLimit();

        setSendingSpark(false);
        scrollChatToBottom();
      } catch (err) {
        console.error('sendSpark unexpected error:', err);
        alert('Unexpected error sending spark.');
        setSendingSpark(false);
      }
    },
    [
      activeConversationId,
      activeOther,
      isBlockedWithActive,
      loadRemainingSparkLimit,
      loadSparkEvents,
      scrollChatToBottom,
      unhideConversation,
      userId,
    ]
  );

  const editMessage = useCallback(
    async (message: Message) => {
      if (!userId || !activeConversationId) return;

      const newContent = prompt('Edit message', message.content);
      if (!newContent || newContent === message.content) return;

      const { error } = await supabase
        .from('messages')
        .update({ content: newContent, is_edited: true })
        .eq('id', message.id);

      if (error) {
        alert(error.message);
        return;
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? { ...msg, content: newContent, is_edited: true } : msg
        )
      );

      await loadConversationsAndLabels(userId);
    },
    [activeConversationId, loadConversationsAndLabels, userId]
  );

  const blockActiveUser = useCallback(async () => {
    if (!userId || !activeOther?.id) return;

    if (activeOther.is_system_host === true) {
      alert('LoveF8 Guide cannot be blocked.');
      return;
    }

    const ok = confirm(`Block ${activeOther.username || 'this user'}?`);
    if (!ok) return;

    const { error } = await supabase.from('user_blocks').insert({
      blocker_id: userId,
      blocked_id: activeOther.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const blocked = await refreshBlocks(userId);
    if (showHostsSection) await loadHosts(blocked);
    if (showUsersSection) await loadDiscoverableUsers(blocked);
    await loadConversationsAndLabels(userId);

    alert('Blocked.');
  }, [
    activeOther,
    loadConversationsAndLabels,
    loadDiscoverableUsers,
    loadHosts,
    refreshBlocks,
    showHostsSection,
    showUsersSection,
    userId,
  ]);

  const unblockActiveUser = useCallback(async () => {
    if (!userId || !activeOther?.id) return;

    const ok = confirm(`Unblock ${activeOther.username || 'this user'}?`);
    if (!ok) return;

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', activeOther.id);

    if (error) {
      alert(error.message);
      return;
    }

    const blocked = await refreshBlocks(userId);
    if (showHostsSection) await loadHosts(blocked);
    if (showUsersSection) await loadDiscoverableUsers(blocked);
    await loadConversationsAndLabels(userId);

    alert('Unblocked.');
  }, [
    activeOther,
    loadConversationsAndLabels,
    loadDiscoverableUsers,
    loadHosts,
    refreshBlocks,
    showHostsSection,
    showUsersSection,
    userId,
  ]);

  const newMessageBanner = useMemo(() => {
    if (!userId) return null;

        const unreadCids = Object.entries(unreadByConvo)
      .filter(([cid, value]) => value && !dismissedNewMessageBannerByConvo[cid])
      .map(([cid]) => cid);

    if (unreadCids.length === 0) return null;

    let bestCid: string | null = null;
    let bestTs = -1;

    for (const cid of unreadCids) {
      const last = lastByConvo[cid];
      if (!last) continue;

      const ts = new Date(last.created_at).getTime();
      if (ts > bestTs) {
        bestTs = ts;
        bestCid = cid;
      }
    }

    if (!bestCid) return null;

    const other = labels[bestCid];
    const name =
      other?.username?.trim()
        ? other.username
        : other?.is_system_host
          ? 'LoveF8 Guide'
          : 'Someone';

    return { cid: bestCid, name };
    }, [dismissedNewMessageBannerByConvo, labels, lastByConvo, unreadByConvo, userId]);

  useEffect(() => {
    function handleResize() {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      setMobileView((current) => {
        if (desktop) return 'sidebar';
        return current;
      });
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      setUserId(user.id);
      void touchLastLogin(user.id);

      const { data: boosterData } = await supabase
  .from('member_booster_credits')
  .select('sparks_remaining, expires_at')
  .eq('profile_id', user.id);

const now = new Date();

const totalBooster = (boosterData || []).reduce((sum, row) => {
  if (
    row.sparks_remaining > 0 &&
    (!row.expires_at || new Date(row.expires_at) > now)
  ) {
    return sum + row.sparks_remaining;
  }
  return sum;
}, 0);

setActiveBoosterSparks(totalBooster);

     const { data: meProf, error: meErr } = await supabase
  .from('profiles')
.select(
'role, approved, is_system_host, is_guide, discoverable, chat_mode, avatar_thumb_url, avatar_url, short_bio, best_at, looking_for, profile_tags, location_text, timezone, normally_online_start, normally_online_end, languages_spoken, spark_balance, membership_tier, created_at'
)
.eq('id', user.id)
.single();

    if (meErr) {
  console.error('my profile load error:', meErr);
  setMyProfile(null);
} else {
  if ((meProf as any)?.is_guide === true) {
    router.replace('/guide');
    return;
  }

  const myBestAvatar =
  (meProf as any)?.avatar_thumb_url || (meProf as MyProfile).avatar_url;

setMyProfile({
  ...(meProf as MyProfile),
  avatar_url: await signAvatarUrl(myBestAvatar),
});
  const profileLanguages = Array.isArray((meProf as any)?.languages_spoken)
  ? (meProf as any).languages_spoken
  : [];

setTargetLanguage(profileLanguages[0] || 'English');
}
const totalAvailableSparks =
  Number((meProf as any)?.spark_balance ?? 0) + totalBooster;

console.log('LoveF8 spark check', {
  profileSparkBalance: Number((meProf as any)?.spark_balance ?? 0),
  activeBoosterSparks: totalBooster,
  totalAvailableSparks,
});
      setLoading(false);
    }

    void init();
  }, [router]);

    useEffect(() => {
    if (!userId) return;

    const currentUserId = userId;

    async function loadAll() {
      await refreshBlocks(currentUserId);
      await loadHiddenConversationIds(currentUserId);
      await loadConversationsAndLabels(currentUserId);
      await loadPresence();

      setHosts([]);
      setUsers([]);
    }

    void loadAll();
  }, [
    loadConversationsAndLabels,
    loadHiddenConversationIds,
    loadPresence,
    refreshBlocks,
    userId,
  ]);

  useEffect(() => {
    void loadRemainingSparkLimit();
  }, [loadRemainingSparkLimit]);

  useEffect(() => {
    if (!userId) return;

    void markMeOnlineNow();

    const onFocus = () => void markMeOnlineNow();
    const onClick = () => void markMeOnlineNow();
    const onKeyDown = () => void markMeOnlineNow();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void markMeOnlineNow();
      } else {
        void upsertPresence(false);
      }
    };

    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void upsertPresence(true);
      }
    }, PRESENCE_HEARTBEAT_MS);

    window.addEventListener('focus', onFocus);
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);

    const handleBeforeUnload = () => {
      void upsertPresence(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);

      window.removeEventListener('focus', onFocus);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      void upsertPresence(false);
    };
  }, [markMeOnlineNow, upsertPresence, userId]);

  useEffect(() => {
    if (!activeConversationId || !userId) return;

    void loadMessages(activeConversationId).then(async () => {
      await loadSparkEvents(activeConversationId);
      setLastOpened(activeConversationId, Date.now());
      setUnreadByConvo((prev) => ({ ...prev, [activeConversationId]: false }));
      await markConversationRead(activeConversationId, userId);

      if (!pendingAnchorMessageId) {
        scrollChatToBottom();
      }
    });
  }, [
    activeConversationId,
    loadMessages,
    loadSparkEvents,
    markConversationRead,
    pendingAnchorMessageId,
    scrollChatToBottom,
    userId,
  ]);

  useEffect(() => {
    if (!activeConversationId) return;

    setTypingByConvo((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cid) => {
        if (cid !== activeConversationId) delete next[cid];
      });
      return next;
    });
  }, [activeConversationId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages-live-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const row = (payload.new || payload.old) as Partial<Message>;
          const changedConversationId = row?.conversation_id;

          await new Promise((resolve) => setTimeout(resolve, 250));

          if (changedConversationId && row?.sender_id && row.sender_id !== userId) {
            await unhideConversation(changedConversationId);
          }

          await loadConversationsAndLabels(userId);

          if (changedConversationId && changedConversationId === activeConversationId) {
            await loadMessages(changedConversationId);
            setLastOpened(changedConversationId, Date.now());
            setUnreadByConvo((prev) => ({ ...prev, [changedConversationId]: false }));
            await markConversationRead(changedConversationId, userId);
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
      }
    };
  }, [
    activeConversationId,
    loadConversationsAndLabels,
    loadMessages,
    markConversationRead,
    unhideConversation,
    userId,
  ]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`reads-live-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));

          const convoIds = conversations.map((c) => c.id);
          if (convoIds.length > 0) {
            await loadReadReceipts(userId, convoIds);
          }
        }
      )
      .subscribe();

    readsRealtimeRef.current = channel;

    return () => {
      if (readsRealtimeRef.current) {
        supabase.removeChannel(readsRealtimeRef.current);
        readsRealtimeRef.current = null;
      }
    };
  }, [conversations, loadReadReceipts, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`typing-live-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_typing',
        },
        async () => {
          const { data, error } = await supabase
            .from('conversation_typing')
            .select('conversation_id, profile_id, is_typing, updated_at')
            .neq('profile_id', userId)
            .eq('is_typing', true);

          if (error) {
            console.error('typing read error:', error);
            return;
          }

          const rows = (data || []) as Array<{
            conversation_id: string;
            profile_id: string;
            is_typing: boolean;
            updated_at: string;
          }>;

          const freshCutoff = Date.now() - 8000;
          const next: Record<string, string | null> = {};

          for (const row of rows) {
            const ts = new Date(row.updated_at).getTime();
            if (ts < freshCutoff) continue;

            const profile = labels[row.conversation_id];
            const name =
              profile?.username?.trim()
                ? profile.username
                : profile?.is_system_host
                  ? 'LoveF8 Guide'
                  : 'User';

            next[row.conversation_id] = name;
          }

          setTypingByConvo(next);
        }
      )
      .subscribe();

    typingRealtimeRef.current = channel;

    return () => {
      if (typingRealtimeRef.current) {
        supabase.removeChannel(typingRealtimeRef.current);
        typingRealtimeRef.current = null;
      }
    };
  }, [labels, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`sparks-live-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_sparks',
        },
        async (payload) => {
          const row = (payload.new || payload.old) as Partial<SparkEvent>;
          const changedConversationId = row?.conversation_id;

          await new Promise((resolve) => setTimeout(resolve, 150));

          if (changedConversationId && row?.sender_id && row.sender_id !== userId) {
            await unhideConversation(changedConversationId);
          }

          if (changedConversationId && changedConversationId === activeConversationId) {
            await loadSparkEvents(changedConversationId);
            scrollChatToBottom();
          }
        }
      )
      .subscribe();

    sparksRealtimeRef.current = channel;

    return () => {
      if (sparksRealtimeRef.current) {
        supabase.removeChannel(sparksRealtimeRef.current);
        sparksRealtimeRef.current = null;
      }
    };
  }, [activeConversationId, loadSparkEvents, scrollChatToBottom, unhideConversation, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`presence-live-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as PresenceRow | undefined;
          if (!row?.profile_id) return;

          setPresenceByProfile((prev) => ({
            ...prev,
            [row.profile_id]: {
              profile_id: row.profile_id,
              is_online: !!row.is_online,
              last_seen_at: row.last_seen_at ?? null,
              updated_at: row.updated_at ?? null,
            },
          }));
        }
      )
      .subscribe();

    presenceRealtimeRef.current = channel;

    return () => {
      if (presenceRealtimeRef.current) {
        supabase.removeChannel(presenceRealtimeRef.current);
        presenceRealtimeRef.current = null;
      }
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const viewerTimezone = useMemo(() => myProfile?.timezone ?? null, [myProfile?.timezone]);

  const onlineProfileIds = useMemo(() => {
    const next = new Set<string>();

    Object.values(presenceByProfile).forEach((row) => {
      if (!row.profile_id) return;

      if (row.is_online) {
        next.add(row.profile_id);
        return;
      }

      if (!row.last_seen_at) return;

      const lastSeen = new Date(row.last_seen_at).getTime();
      if (Date.now() - lastSeen < PRESENCE_IDLE_MS) {
        next.add(row.profile_id);
      }
    });

    return next;
  }, [presenceByProfile]);

  const warningClasses = useMemo(() => {
    switch (sparkWarning?.tone) {
      case 'red':
        return 'border-red-200 bg-red-50 text-red-900';
      case 'amber':
        return 'border-amber-200 bg-amber-50 text-amber-950';
      default:
        return 'border-neutral-200 bg-white text-neutral-900';
    }
  }, [sparkWarning]);

  const sidebarWidthClass = isDesktop
  ? activeConversationId
    ? 'block w-[300px] min-w-[280px] max-w-[320px]'
    : 'block w-full'
  : mobileView === 'sidebar'
    ? 'block w-full'
    : 'hidden';
  const showChatPanel = isDesktop ? !!activeConversationId : mobileView === 'chat';

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_40%,#f6f4ff_100%)] px-6">
        <div className="mx-auto flex min-h-[100dvh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-fuchsia-100 bg-white/85 px-5 py-4 text-sm font-semibold text-neutral-700 shadow-[0_18px_45px_rgba(83,34,115,0.10)] backdrop-blur">
            Loading LoveF8 Messages...
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_40%,#f6f4ff_100%)] text-neutral-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "url('/lovef8-bg.png')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center top 42px',
          backgroundSize: 'min(620px, 82vw)',
          filter: 'blur(1px)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.42)_18%,rgba(255,255,255,0.88)_100%)]" />

      <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col lg:px-4 lg:py-4">
                <div className="sticky top-0 z-30 shrink-0 border-b border-fuchsia-100/80 bg-white/80 px-2 py-1.5 backdrop-blur-xl lg:static lg:rounded-t-[28px] lg:border lg:border-b-0 lg:bg-white/80 lg:px-4 lg:py-3">
                    <div className="flex flex-col gap-1.5 lg:gap-3">
                        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
              <div className="min-w-0">
                                <div className="inline-flex items-center rounded-full border border-fuchsia-200/70 bg-white/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-fuchsia-700 shadow-sm lg:px-3 lg:py-1 lg:text-[11px]">
                  {tr('LoveF8 Messages')}
                </div>

                
              </div>

              <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
               
          <button
  type="button"
  onClick={() => setForceEnglish((prev) => !prev)}
    className="shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 shadow-sm hover:bg-gray-100 lg:rounded-xl lg:px-3 lg:py-2 lg:text-xs"
>
  {forceEnglish ? 'Use Selected Language' : 'View in English'}
</button>

<button
  type="button"
  onClick={() => router.push('/connect')}
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50/90 px-2.5 py-1.5 text-xs font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm"
>
  {trSafe('Connect')}
</button>

{showGuideButton && (
  <button
    type="button"
    onClick={() => router.push('/guide')}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-900 shadow-sm transition hover:bg-blue-100 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm"
  >
    {trSafe('Talk to Guide')}
  </button>
)}

{!isApprovedHostMe && (
  <button
    type="button"
    onClick={() => router.push('/wallet')}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm"
  >
    {trSafe('Wallet')}
  </button>
)}

{isApprovedHostMe && (
  <button
    type="button"
    onClick={() => router.push('/host')}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm"
  >
    {trSafe('Host Dashboard')}
  </button>
)}

<button
  type="button"
  onClick={() => router.push('/settings')}
  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50/90 px-2.5 py-1.5 text-xs font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm"
>
  {trSafe('Profile')}
</button>

<button
  type="button"
  onClick={() => router.push('/support/report')}
  className="flex shrink-0 items-center rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-900 shadow-sm transition hover:bg-red-100 whitespace-nowrap lg:rounded-xl lg:px-4 lg:py-2 lg:text-sm"
>
  {trSafe('Report Issue')}
</button>

<button
  type="button"
  onClick={signOut}
  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/90 px-2.5 py-1.5 text-xs font-semibold text-rose-900 shadow-sm transition hover:bg-rose-100 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm"
>
  {trSafe('Sign out')}
</button>
              </div>
            </div>

                        {newMessageBanner && (
              <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/90 px-2.5 py-1.5 text-xs font-semibold text-sky-900 shadow-sm">
                <button
                  type="button"
                  onClick={() => void openConversation(newMessageBanner.cid)}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  New message from {newMessageBanner.name}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDismissedNewMessageBannerByConvo((prev) => ({
                      ...prev,
                      [newMessageBanner.cid]: true,
                    }))
                  }
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-black text-sky-900 transition hover:bg-white"
                  aria-label="Dismiss new message alert"
                >
                  ×
                </button>
              </div>
            )}

            {sparkWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-amber-900">
                      {sparkWarning.title}
                    </div>
                    <div className="text-[11px] text-amber-800">
                      {sparkWarning.body}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/wallet')}
                    className="shrink-0 inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-200"
                  >
                    {trSafe('Get Sparks')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden lg:rounded-b-[24px] lg:border lg:border-t-0 lg:border-fuchsia-100/80 lg:bg-white/72 lg:backdrop-blur">
          <div className="flex h-full min-h-0">
            <div
              className={`${sidebarWidthClass} h-full min-h-0 border-r border-fuchsia-100/80 bg-white/82 backdrop-blur`}
            >
              <Sidebar
                userId={userId}
                activeConversationId={activeConversationId}
                hosts={hosts}
                hostsLoading={hostsLoading}
                hostsError={hostsError}
                users={users}
                usersLoading={usersLoading}
                usersError={usersError}
                blocksLoading={blocksLoading}
                isApprovedHostMe={isApprovedHostMe}
                inboxConversations={inboxConversations}
                hiddenConversations={hiddenConversations}
                labels={labels}
                lastByConvo={lastByConvo}
                unreadByConvo={unreadByConvo}
                onlineProfileIds={onlineProfileIds}
                isDesktop={isDesktop}
                showHostsSection={false}
                showUsersSection={false}
                viewerTimezone={viewerTimezone}
                onRefreshHosts={async () => {
                  if (!userId) return;
                  const blocked = await refreshBlocks(userId);
                  await loadHosts(blocked);
                }}
                onRefreshUsers={async () => {
                  if (!userId) return;
                  const blocked = await refreshBlocks(userId);
                  await loadDiscoverableUsers(blocked);
                }}
                onRefreshInbox={async () => {
                  if (!userId) return;
                  await loadConversationsAndLabels(userId);
                }}
                onOpenProfile={openOrCreateConversationWithProfile}
                onOpenProfilePreview={openProfilePreview}
                onSelectConversation={openConversation}
                onHideConversation={hideConversation}
                onRestoreConversation={unhideConversation}
              />
            </div>

            {showChatPanel && (
              <div className="flex min-w-0 flex-1 flex-col bg-white/55 backdrop-blur-[2px]">
                <ChatPanel
                                    userId={userId}
                  membershipTier={myProfile?.membership_tier}
                  isApprovedHostMe={isApprovedHostMe}
                  activeConversationId={activeConversationId}
                  activeOther={activeOther}
                  requestedAnchorMessageId={pendingAnchorMessageId}
                  messages={messages}
                  sparkEvents={sparkEvents}
                  sentSparkTotal={sentSparkTotal}
                  receivedSparkTotal={receivedSparkTotal}
                  sendingSpark={sendingSpark}
                  newMessage={newMessage}
                  sending={sending}
                  isBlockedWithActive={isBlockedWithActive}
                  messagesEndRef={messagesEndRef}
                  otherLastReadAt={activeOtherLastReadAt}
                  activeTypingName={activeTypingName}
                  activeOtherOnline={activeOtherOnline}
                  activeOtherPresenceLabel={activeOtherPresenceLabel}
                  hasLanguageOverlap={hasLanguageOverlap}
                  myChatMode={(myProfile?.chat_mode as any) ?? null}
                  isDesktop={isDesktop}
                  viewerTimezone={viewerTimezone}
                  remainingSparkLimit={remainingSparkLimit}
                  targetLanguage={(myProfile as any)?.languages_spoken?.[0] ?? null}
                  onBack={goBackToSidebar}
                  onOpenProfilePreview={openProfilePreview}
                  onChangeNewMessage={async (value: string) => {
                    setNewMessage(value);

                    if (!activeConversationId) return;

                    const isTyping = value.trim().length > 0;
                    await upsertTypingState(activeConversationId, isTyping);

                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }

                    if (isTyping) {
                      typingTimeoutRef.current = setTimeout(() => {
                        void upsertTypingState(activeConversationId, false);
                      }, 1500);
                    }
                  }}
                  onSendMessage={sendMessage}
                  onSendSpark={sendSpark}
                  onEditMessage={editMessage}
                  onBlock={blockActiveUser}
                  onUnblock={unblockActiveUser}
                />
              </div>
            )}

            {!showChatPanel && isDesktop && null}
          </div>
        </div>
      </div>

           <ProfilePreviewModal
  open={profilePreviewOpen}
  onClose={closeProfilePreview}
  profile={profilePreview}
  viewerTimezone={viewerTimezone}
  targetLanguage={(myProfile as any)?.languages_spoken?.[0] || 'en'}
/>
    </main>
  );
}