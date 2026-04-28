'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { touchLastLogin } from '@/lib/touchLastLogin';
import Sidebar from '../messages/components/Sidebar';
import ChatPanel from '../messages/components/ChatPanel';
import ProfilePreviewModal from '../messages/components/ProfilePreviewModal';
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
} from '../messages/types';
import {
  getLastOpened,
  markSpamNudgeShown,
  setLastOpened,
  shouldShowSpamNudge,
} from '../messages/utils';

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

const COUNTRY_OPTIONS = [
  'Argentina',
  'Australia',
  'Austria',
  'Bangladesh',
  'Belgium',
  'Bolivia',
  'Botswana',
  'Brazil',
  'Bulgaria',
  'Cambodia',
  'Canada',
  'Chile',
  'China',
  'Colombia',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Ecuador',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Ghana',
  'Greece',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Kenya',
  'Kuwait',
  'Laos',
  'Latvia',
  'Lithuania',
  'Luxembourg',
  'Malaysia',
  'Malta',
  'Mexico',
  'Mongolia',
  'Morocco',
  'Namibia',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Rwanda',
  'Saudi Arabia',
  'Senegal',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Sweden',
  'Switzerland',
  'Taiwan',
  'Tanzania',
  'Thailand',
  'Tunisia',
  'Turkey',
  'Uganda',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Vietnam',
  'Zambia',
].sort((a, b) => a.localeCompare(b));

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

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function signProfileMini(profile: ProfileMini): Promise<ProfileMini> {
  return {
    ...profile,
    avatar_url: await signAvatarUrl(profile.avatar_url),
  };
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

  const { data, error } = await supabase.storage
    .from('profile-photos')
    .createSignedUrls(paths, AVATAR_SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return [];
  }

  return data
    .map((item) => item?.signedUrl || '')
    .filter((value): value is string => !!value);
}

export default function ConnectPage() {
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

  const [countryFilter, setCountryFilter] = useState('');
  const [minAge, setMinAge] = useState('19');
  const [maxAge, setMaxAge] = useState('');
  const [sortAge, setSortAge] = useState<'default' | 'youngest' | 'oldest'>('default');

  const isApprovedHostMe = useMemo(() => {
    return myProfile?.role === 'host' && myProfile?.approved === true;
  }, [myProfile]);

  const showHostsSection = useMemo(() => !isApprovedHostMe, [isApprovedHostMe]);
  const showUsersSection = useMemo(() => isApprovedHostMe, [isApprovedHostMe]);

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
          country_origin,
          region_origin,
          timezone,
          normally_online_start,
          normally_online_end,
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
        country_origin: data.country_origin,
        region_origin: data.region_origin,
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
      .select('id, conversation_id, sender_id, content, created_at, is_edited')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('loadMessages error:', error);
      return;
    }

    setMessages((data as Message[]) || []);
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
        'id, username, host_mode, chat_mode, avatar_url, headline, short_bio, about_long, talk_topics, style_vibe, best_at, looking_for, profile_tags, location_text, country_origin, region_origin, timezone, normally_online_start, normally_online_end, age, gender, interested_in'
      )
      .eq('role', 'host')
      .eq('approved', true);

    if (error) {
      setHostsError(error.message);
      setHosts([]);
      setHostsLoading(false);
      return;
    }

    function hashString(value: string) {
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    }

    const rawHosts = (data as HostRow[]) || [];
    const filteredHosts = rawHosts.filter((host) => !blocked.has(host.id));

    const today = new Date();
    const dayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    const scoredHosts = filteredHosts.map((host) => {
      const dailyScore = hashString(`${dayKey}-${host.id}`);
      return {
        host,
        dailyScore,
      };
    });

    scoredHosts.sort((a, b) => b.dailyScore - a.dailyScore);

    const priority = scoredHosts.slice(0, 3).map((item) => item.host);
    const rest = scoredHosts.slice(3).map((item) => item.host);

    const rotatedHosts = [...priority, ...rest];
    const signedHosts = await Promise.all(rotatedHosts.map(signHostRow));

    setHosts(signedHosts);
    setHostsLoading(false);
  }, []);

  const loadDiscoverableUsers = useCallback(async (blocked: Set<string>) => {
    setUsersLoading(true);
    setUsersError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, username, chat_mode, avatar_url, headline, short_bio, about_long, talk_topics, style_vibe, best_at, looking_for, profile_tags, location_text, country_origin, region_origin, timezone, normally_online_start, normally_online_end, age, gender, interested_in'
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
        console.error('conversation_participants read error:', myErr);
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
          .select(
            'id, username, host_mode, role, approved, is_system_host, chat_mode, avatar_url, short_bio, best_at, looking_for, profile_tags, location_text, country_origin, region_origin, timezone, normally_online_start, normally_online_end'
          )
          .in('id', otherIds);

        if (profErr) {
          console.error('profiles read error:', profErr);
          return;
        }

        const signedProfiles = await Promise.all(
          ((otherProfiles || []) as ProfileMini[]).map(signProfileMini)
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
        if (prevStillExists) return prev;

        return null;
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
    return [] as Conversation[];
  }, []);

  const hiddenConversations = useMemo(() => {
    return [] as Conversation[];
  }, []);

  const parsedMinAge = useMemo(() => {
    const value = Number(minAge);
    return Number.isFinite(value) && minAge !== '' ? value : null;
  }, [minAge]);

  const parsedMaxAge = useMemo(() => {
    const value = Number(maxAge);
    return Number.isFinite(value) && maxAge !== '' ? value : null;
  }, [maxAge]);

  const applyDiscoveryFilters = useCallback(
    <T extends HostRow | UserRow>(list: T[]) => {
      let next = [...list];

      if (countryFilter.trim()) {
        const normalizedCountry = countryFilter.toLowerCase();
        next = next.filter((item) =>
          (item.country_origin?.toLowerCase() || '').includes(normalizedCountry)
        );
      }

      if (parsedMinAge !== null) {
        next = next.filter((item) => typeof item.age === 'number' && item.age >= parsedMinAge);
      }

      if (parsedMaxAge !== null) {
        next = next.filter((item) => typeof item.age === 'number' && item.age <= parsedMaxAge);
      }

      if (sortAge === 'youngest') {
        next.sort((a, b) => {
          const aAge = typeof a.age === 'number' ? a.age : Number.MAX_SAFE_INTEGER;
          const bAge = typeof b.age === 'number' ? b.age : Number.MAX_SAFE_INTEGER;
          return aAge - bAge;
        });
      }

      if (sortAge === 'oldest') {
        next.sort((a, b) => {
          const aAge = typeof a.age === 'number' ? a.age : -1;
          const bAge = typeof b.age === 'number' ? b.age : -1;
          return bAge - aAge;
        });
      }

      return next;
    },
    [countryFilter, parsedMaxAge, parsedMinAge, sortAge]
  );

  const filteredHosts = useMemo(() => {
    return applyDiscoveryFilters(hosts);
  }, [applyDiscoveryFilters, hosts]);

  const filteredUsers = useMemo(() => {
    return applyDiscoveryFilters(users);
  }, [applyDiscoveryFilters, users]);

  const hasActiveFilters = useMemo(() => {
    return countryFilter !== '' || minAge !== '19' || maxAge !== '' || sortAge !== 'default';
  }, [countryFilter, maxAge, minAge, sortAge]);

  const clearFilters = useCallback(() => {
    setCountryFilter('');
    setMinAge('19');
    setMaxAge('');
    setSortAge('default');
  }, []);

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
      window.history.replaceState({}, '', '/connect');
    });
  }, [
    conversations,
    openConversation,
    requestedConversationId,
    requestedAnchorMessageId,
    userId,
  ]);

  const goBackToSidebar = useCallback(() => {
    setMobileView('sidebar');
  }, []);

  const hideConversation = useCallback(async (_conversationId: string) => {
    return;
  }, []);

  const openOrCreateConversationWithProfile = useCallback(
    async (otherId: string) => {
      if (!userId) return;

      if (blockedOtherIds.has(otherId)) {
        alert('Chat not available.');
        return;
      }

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
      loadConversationsAndLabels,
      loadMessages,
      loadSparkEvents,
      openConversation,
      scrollChatToBottom,
      unhideConversation,
      userId,
    ]
  );

  const sendMessage = useCallback(async () => {
    if (!userId || !activeConversationId) return;

    if (isBlockedWithActive) {
      alert('You cannot send messages in this chat.');
      return;
    }

    const text = newMessage.trim();
    if (!text) return;

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
    }

    setSending(true);

    const { error } = await supabase.rpc('send_message', {
      p_conversation_id: activeConversationId,
      p_content: text,
    });

    if (error) {
      alert(error.message);
      setSending(false);
      return;
    }

    setNewMessage('');
    await upsertTypingState(activeConversationId, false);
    await loadMessages(activeConversationId);
    await loadConversationsAndLabels(userId);
    setSending(false);
    scrollChatToBottom();
  }, [
    activeConversationId,
    activeOther,
    isApprovedHostMe,
    isBlockedWithActive,
    loadConversationsAndLabels,
    loadMessages,
    messages,
    myProfile?.is_system_host,
    newMessage,
    scrollChatToBottom,
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
          .gte('created_at', last24HoursIso);

        if (recentError) {
          alert(recentError.message);
          setSendingSpark(false);
          return;
        }

        const spent = (recent || []).reduce((sum, r) => sum + (r.amount || 0), 0);
        const remainingLimit = 300 - spent;
        const displayName = activeOther.username || 'this host';

        if (remainingLimit <= 0) {
          alert(`You've reached your daily spark limit with ${displayName} today.`);
          setSendingSpark(false);
          return;
        }

        if (amount > remainingLimit) {
          alert(
            `You can only send ${remainingLimit} more sparks to ${activeOther.username || 'this host'} today.`
          );
          setSendingSpark(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('membership_spark_balance')
          .eq('id', userId)
          .single();

        if (profileError) {
          alert(profileError.message);
          setSendingSpark(false);
          return;
        }

        let membershipBalanceStart = profile?.membership_spark_balance || 0;

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
        let membershipBalanceEnd = membershipBalanceStart;
        const boosterUpdates: { id: string; newRemaining: number }[] = [];

        if (membershipBalanceEnd > 0) {
          const membershipUsed = Math.min(membershipBalanceEnd, remaining);
          membershipBalanceEnd -= membershipUsed;
          remaining -= membershipUsed;
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

        if (membershipBalanceEnd !== membershipBalanceStart) {
          const { error: membershipUpdateError } = await supabase
            .from('profiles')
            .update({
              membership_spark_balance: membershipBalanceEnd,
            })
            .eq('id', userId);

          if (membershipUpdateError) {
            alert(`Membership deduction failed: ${membershipUpdateError.message}`);
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
      activeOther?.id,
      isBlockedWithActive,
      loadRemainingSparkLimit,
      loadSparkEvents,
      scrollChatToBottom,
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

      const { data: meProf, error: meErr } = await supabase
        .from('profiles')
        .select(
          'role, approved, is_system_host, discoverable, chat_mode, avatar_url, short_bio, best_at, looking_for, profile_tags, location_text, country_origin, region_origin, timezone, normally_online_start, normally_online_end'
        )
        .eq('id', user.id)
        .single();

      if (meErr) {
        console.error('my profile load error:', meErr);
        setMyProfile(null);
      } else {
        setMyProfile({
          ...(meProf as MyProfile),
          avatar_url: await signAvatarUrl((meProf as MyProfile).avatar_url),
        });
      }

      setLoading(false);
    }

    void init();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const currentUserId = userId;

    async function loadAll() {
      const blocked = await refreshBlocks(currentUserId);
      await loadHiddenConversationIds(currentUserId);
      await loadConversationsAndLabels(currentUserId);
      await loadPresence();

      if (showHostsSection) {
        await loadHosts(blocked);
      } else {
        setHosts([]);
      }

      if (showUsersSection) {
        await loadDiscoverableUsers(blocked);
      } else {
        setUsers([]);
      }
    }

    void loadAll();
  }, [
    loadConversationsAndLabels,
    loadDiscoverableUsers,
    loadHiddenConversationIds,
    loadHosts,
    loadPresence,
    refreshBlocks,
    showHostsSection,
    showUsersSection,
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
      .channel(`messages-live-connect-${userId}`)
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
    userId,
  ]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`reads-live-connect-${userId}`)
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
      .channel(`typing-live-connect-${userId}`)
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
      .channel(`sparks-live-connect-${userId}`)
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
  }, [activeConversationId, loadSparkEvents, scrollChatToBottom, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`presence-live-connect-${userId}`)
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

  const sidebarWidthClass = isDesktop
    ? activeConversationId
      ? 'block w-[380px] min-w-[340px] max-w-[430px]'
      : 'block w-full'
    : mobileView === 'sidebar'
      ? 'block w-full'
      : 'hidden';

  const showChatPanel = isDesktop ? !!activeConversationId : mobileView === 'chat';

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-6">
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm font-medium text-neutral-700 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <main className="h-[100dvh] bg-neutral-50 text-neutral-900">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col lg:px-4 lg:py-4">
        <div className="sticky top-0 z-30 shrink-0 border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur lg:static lg:rounded-t-3xl lg:border lg:border-b-0 lg:bg-white lg:px-4 lg:py-3 lg:backdrop-blur-0">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">
                  LoveF8 Connect
                </h1>
                <div className="mt-0.5 text-[11px] text-neutral-500 sm:text-xs">
                  Discovery:{' '}
                  <span className="font-bold text-neutral-900">
                    {myProfile?.discoverable ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isDesktop && activeConversationId && (
                  <button
                    onClick={closeDesktopChat}
                    className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50 sm:px-4 sm:py-2.5"
                  >
                    Close chat
                  </button>
                )}

                <button
                  onClick={() => router.push('/messages')}
                  className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-100 sm:px-4 sm:py-2.5"
                >
                  Messages
                </button>

                <button
                  onClick={() => router.push('/connect')}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50 sm:px-4 sm:py-2.5"
                >
                  Connect
                </button>

                <button
                  onClick={() => router.push('/settings')}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50 sm:px-4 sm:py-2.5"
                >
                  Settings
                </button>

                {isApprovedHostMe && (
                  <button
                    onClick={() => router.push('/host')}
                    className="inline-flex items-center justify-center rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 transition hover:bg-amber-100 sm:px-4 sm:py-2.5"
                  >
                    Host Dashboard
                  </button>
                )}

                <button
                  onClick={signOut}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50 sm:px-4 sm:py-2.5"
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold leading-none text-neutral-900 sm:text-xs">
                  Filters
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 transition hover:bg-neutral-100 sm:py-2"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
                <select
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 sm:py-2"
                >
                  <option value="">All countries</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={19}
                  value={minAge}
                  onChange={(e) => {
                    const value = e.target.value;

                    if (value === '') {
                      setMinAge('19');
                      return;
                    }

                    const num = Number(value);

                    if (num < 19) {
                      setMinAge('19');
                    } else {
                      setMinAge(value);
                    }
                  }}
                  placeholder="Min age"
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 sm:py-2"
                />

                <input
                  type="number"
                  min={19}
                  value={maxAge}
                  onChange={(e) => {
                    const value = e.target.value;

                    if (value === '') {
                      setMaxAge('');
                      return;
                    }

                    const num = Number(value);

                    if (num < 19) {
                      setMaxAge('19');
                    } else {
                      setMaxAge(value);
                    }
                  }}
                  placeholder="Max age"
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 sm:py-2"
                />

                <select
                  value={sortAge}
                  onChange={(e) =>
                    setSortAge(e.target.value as 'default' | 'youngest' | 'oldest')
                  }
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 sm:py-2"
                >
                  <option value="default">Default order</option>
                  <option value="youngest">Youngest to oldest</option>
                  <option value="oldest">Oldest to youngest</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white lg:rounded-b-3xl lg:border lg:border-t-0 lg:border-neutral-200">
          <div className="flex h-full min-h-0">
            <div
              className={['h-full overflow-y-auto border-r border-neutral-200 bg-white', sidebarWidthClass].join(
                ' '
              )}
            >
              <Sidebar
                userId={userId}
                activeConversationId={activeConversationId}
                hosts={showHostsSection ? filteredHosts : []}
                hostsLoading={showHostsSection ? hostsLoading : false}
                hostsError={showHostsSection ? hostsError : null}
                users={showUsersSection ? filteredUsers : []}
                usersLoading={showUsersSection ? usersLoading : false}
                usersError={showUsersSection ? usersError : null}
                blocksLoading={blocksLoading}
                isApprovedHostMe={isApprovedHostMe}
                inboxConversations={inboxConversations}
                hiddenConversations={hiddenConversations}
                labels={labels}
                lastByConvo={lastByConvo}
                unreadByConvo={unreadByConvo}
                onlineProfileIds={new Set(
                  Object.keys(presenceByProfile).filter((id) => isProfileOnline(id))
                )}
                isDesktop={isDesktop}
                viewerTimezone={myProfile?.timezone ?? null}
                showHostsSection={showHostsSection}
                showUsersSection={showUsersSection}
                onRefreshHosts={async () => {
                  if (!userId || !showHostsSection) return;
                  const blocked = await refreshBlocks(userId);
                  await loadHosts(blocked);
                  await loadPresence();
                }}
                onRefreshUsers={async () => {
                  if (!userId || !showUsersSection) return;
                  const blocked = await refreshBlocks(userId);
                  await loadDiscoverableUsers(blocked);
                  await loadPresence();
                }}
                onRefreshInbox={async () => {}}
                onOpenProfile={openOrCreateConversationWithProfile}
                onOpenProfilePreview={openProfilePreview}
                onSelectConversation={(conversationId: string) => {
                  setPendingAnchorMessageId(null);
                  void openConversation(conversationId);
                }}
                onHideConversation={hideConversation}
                onRestoreConversation={async () => {}}
              />
            </div>

            <div
              className={[
                'h-full min-w-0 flex-1 overflow-y-auto bg-neutral-50',
                showChatPanel ? 'block' : 'hidden',
              ].join(' ')}
            >
              <ChatPanel
                userId={userId}
                activeConversationId={activeConversationId}
                requestedAnchorMessageId={pendingAnchorMessageId}
                activeOther={activeOther}
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
                myChatMode={myProfile?.chat_mode ?? null}
                isDesktop={isDesktop}
                viewerTimezone={myProfile?.timezone ?? null}
                onBack={goBackToSidebar}
                remainingSparkLimit={remainingSparkLimit}
                onOpenProfilePreview={openProfilePreview}
                onChangeNewMessage={async (value) => {
                  setNewMessage(value);

                  if (!activeConversationId || !userId || isBlockedWithActive) return;

                  const trimmed = value.trim();
                  const typingNow = trimmed.length > 0;

                  await upsertTypingState(activeConversationId, typingNow);
                  await markMeOnlineNow();

                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }

                  if (typingNow) {
                    typingTimeoutRef.current = setTimeout(() => {
                      void upsertTypingState(activeConversationId, false);
                    }, 3000);
                  }
                }}
                onSendMessage={async () => {
                  await sendMessage();
                  await markMeOnlineNow();
                }}
                onSendSpark={sendSpark}
                onEditMessage={editMessage}
                onBlock={blockActiveUser}
                onUnblock={unblockActiveUser}
              />
            </div>
          </div>
        </div>
      </div>

      <ProfilePreviewModal
        open={profilePreviewOpen}
        onClose={closeProfilePreview}
        profile={profilePreview}
      />
    </main>
  );
}