'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type GuideGender = 'male' | 'female' | 'both' | null;

type MyProfile = {
  id: string;
  username: string | null;
  role: string | null;
  app_role?: string | null;
  is_guide: boolean | null;
  guide_gender: GuideGender;
};

type GuideThreadRow = {
  id: string;
  member_id: string;
  seeking: string | null;
  expires_at: string;
  created_at: string;
};

type GuideMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type MemberMini = {
  id: string;
  username: string | null;
  role: string | null;
  app_role?: string | null;
  is_guide: boolean | null;
};

type LastGuideMessageRow = {
  thread_id: string;
  created_at: string;
};

type SenderMini = {
  id: string;
  username: string | null;
};

const OPENING_GREETING = `Welcome to LoveF8.

If you have any questions as you get started, just send a message here.
A real person will be with you shortly to help guide you on your journey.`;

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatExpiresIn(value: string | null | undefined) {
  if (!value) return '';

  const now = Date.now();
  const end = new Date(value).getTime();
  const diff = end - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} left`;

  const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
  return `${minutes} min left`;
}

function filterThreadsForGuide(
  threads: GuideThreadRow[],
  guideGender: GuideGender
): GuideThreadRow[] {
  if (!guideGender) return threads;

  return threads.filter((thread) => {
    const seeking = (thread.seeking || '').toLowerCase();

    if (!seeking || seeking === 'open_all' || seeking === 'both') return true;
    if (seeking === 'women') return guideGender === 'female' || guideGender === 'both';
    if (seeking === 'men') return guideGender === 'male' || guideGender === 'both';

    return true;
  });
}

function isRealMemberProfile(row: MemberMini) {
  const roleValue = (row.role || row.app_role || '').toLowerCase();
  return roleValue === 'user' && row.is_guide !== true;
}

function getMemberDisplayName(member: MemberMini | null | undefined) {
  const raw = member?.username?.trim();
  if (raw && raw.toLowerCase() !== 'null') return raw;
  return 'New member';
}

function getSafeSenderName(raw: string | null | undefined, fallback: string) {
  const trimmed = raw?.trim();
  if (trimmed && trimmed.toLowerCase() !== 'null') return trimmed;
  return fallback;
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

export default function GuidePage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

  const [guideThreads, setGuideThreads] = useState<GuideThreadRow[]>([]);
  const [memberLabels, setMemberLabels] = useState<Record<string, MemberMini>>({});
  const [lastMessageByThread, setLastMessageByThread] = useState<Record<string, string>>({});
  const [senderLabels, setSenderLabels] = useState<Record<string, string>>({});

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GuideMessageRow[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
const inflightRef = useRef<Set<string>>(new Set());
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
const [translatedGuideUiMap, setTranslatedGuideUiMap] = useState<Record<string, string>>({});
const [forceEnglish, setForceEnglish] = useState(false);
const trSafe = (text: string) => {
  if (forceEnglish) return text;
  return translatedGuideUiMap[text] || text;
};

useEffect(() => {
  let isActive = true;

  async function translateGuideUI() {
    if (!targetLanguage || targetLanguage === 'English') {
      if (isActive) {
        setTranslatedGuideUiMap({});
      }
      return;
    }

    const allTexts = [
      'Guide Inbox',
      'Talk to Guide',
      'Back to Messages',
      'Sign Out',
      'No active member guide conversations right now',
      'No active guide chat',
      'Only real member onboarding threads will appear here.',
      'Your onboarding guide chat is not active right now.',
      'Active guide threads',
      'Your guide chat',
      'Seeking:',
      'not set',
      'Last activity',
      'Guide conversation',
      'You can ask questions here during your onboarding window.',
      'No messages yet',
      'Be the first guide to respond in this onboarding thread.',
      'Send your first question to the guides.',
      'Reply as a guide…',
      'Type your question…',
      'Sending…',
      'Send',
      'Loading guide chat…',
    ];

    const cacheKey = buildSettingsTranslationCacheKey('guide-ui', targetLanguage, allTexts);
    const cached = readSettingsTranslationCache(cacheKey);

    if (cached) {
      if (isActive) {
        setTranslatedGuideUiMap(cached);
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
        setTranslatedGuideUiMap(map);
      }
    } catch (err) {
      console.error('translateGuideUI error:', err);
    }
  }

  void translateGuideUI();

  return () => {
    isActive = false;
  };
}, [targetLanguage]);

  const isGuide = myProfile?.is_guide === true;

  const activeThread = useMemo(() => {
    if (!activeThreadId) return null;
    return guideThreads.find((thread) => thread.id === activeThreadId) || null;
  }, [activeThreadId, guideThreads]);

  const activeMemberLabel = useMemo(() => {
    if (!activeThread) return null;
    return memberLabels[activeThread.member_id] || null;
  }, [activeThread, memberLabels]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const loadMemberLabels = useCallback(async (threads: GuideThreadRow[]) => {
    const memberIds = Array.from(
      new Set(threads.map((thread) => thread.member_id).filter(Boolean))
    );

    if (memberIds.length === 0) {
      setMemberLabels({});
      return { validIds: new Set<string>() };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, app_role, is_guide')
      .in('id', memberIds);

    if (error) {
      console.error('loadMemberLabels error:', error);
      setMemberLabels({});
      return { validIds: new Set<string>() };
    }

    const validProfiles = ((data || []) as MemberMini[]).filter(isRealMemberProfile);

    const nextLabels: Record<string, MemberMini> = {};
    const validIds = new Set<string>();

    for (const row of validProfiles) {
      nextLabels[row.id] = row;
      validIds.add(row.id);
    }

    setMemberLabels(nextLabels);
    return { validIds };
  }, []);

  const loadLastMessageMap = useCallback(async (threads: GuideThreadRow[]) => {
    const threadIds = threads.map((thread) => thread.id);

    if (threadIds.length === 0) {
      setLastMessageByThread({});
      return {};
    }

    const { data, error } = await supabase
      .from('guide_messages')
      .select('thread_id, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadLastMessageMap error:', error);
      setLastMessageByThread({});
      return {};
    }

    const next: Record<string, string> = {};

    for (const row of (data || []) as LastGuideMessageRow[]) {
      if (!next[row.thread_id]) {
        next[row.thread_id] = row.created_at;
      }
    }

    setLastMessageByThread(next);
    return next;
  }, []);

  const loadSenderLabels = useCallback(async (messageRows: GuideMessageRow[]) => {
    const senderIds = Array.from(new Set(messageRows.map((row) => row.sender_id).filter(Boolean)));

    if (senderIds.length === 0) {
      setSenderLabels({});
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', senderIds);

    if (error) {
      console.error('loadSenderLabels error:', error);
      setSenderLabels({});
      return;
    }

    const next: Record<string, string> = {};
    for (const row of (data || []) as SenderMini[]) {
      next[row.id] = getSafeSenderName(row.username, 'User');
    }

    setSenderLabels(next);
  }, []);

  const loadThreads = useCallback(
    async (uid: string, guideMode: boolean, guideGender: GuideGender) => {
      const nowIso = new Date().toISOString();

      if (guideMode) {
        const { data, error } = await supabase
          .from('guide_threads')
          .select('id, member_id, seeking, expires_at, created_at')
          .gt('expires_at', nowIso);

        if (error) {
          console.error('load guide threads error:', error);
          setGuideThreads([]);
          setMemberLabels({});
          setLastMessageByThread({});
          setActiveThreadId(null);
          return;
        }

        const rows = (data || []) as GuideThreadRow[];
        const genderFiltered = filterThreadsForGuide(rows, guideGender);
        const { validIds } = await loadMemberLabels(genderFiltered);

        const memberOnlyThreads = genderFiltered.filter((thread) => validIds.has(thread.member_id));
        const nextLastMap = await loadLastMessageMap(memberOnlyThreads);

        const finalThreads = memberOnlyThreads.slice().sort((a, b) => {
          const aTs = nextLastMap[a.id] || a.created_at;
          const bTs = nextLastMap[b.id] || b.created_at;
          return new Date(bTs).getTime() - new Date(aTs).getTime();
        });

        setGuideThreads(finalThreads);
        setActiveThreadId((prev) => {
          if (prev && finalThreads.some((thread) => thread.id === prev)) return prev;
          return finalThreads[0]?.id || null;
        });

        return;
      }

      const { data, error } = await supabase
        .from('guide_threads')
        .select('id, member_id, seeking, expires_at, created_at')
        .eq('member_id', uid)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('load member guide thread error:', error);
        setGuideThreads([]);
        setMemberLabels({});
        setLastMessageByThread({});
        setActiveThreadId(null);
        return;
      }

      let rows = (data || []) as GuideThreadRow[];

      if (rows.length === 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 21);

        const { data: newThread, error: insertError } = await supabase
          .from('guide_threads')
          .insert({
            member_id: uid,
            seeking: 'open_all',
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('create guide thread error:', insertError);
          setGuideThreads([]);
          setMemberLabels({});
          setLastMessageByThread({});
          setActiveThreadId(null);
          return;
        }

        rows = [newThread as GuideThreadRow];
      }

      await loadMemberLabels(rows);
      await loadLastMessageMap(rows);

      setGuideThreads(rows);
      setActiveThreadId(rows[0]?.id || null);
    },
    [loadLastMessageMap, loadMemberLabels]
  );

  const loadMessages = useCallback(
    async (threadId: string) => {
      const { data, error } = await supabase
        .from('guide_messages')
        .select('id, thread_id, sender_id, content, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('load guide messages error:', error);
        setMessages([]);
        setSenderLabels({});
        return;
      }

      const rows = (data || []) as GuideMessageRow[];
      setMessages(rows);
      await loadSenderLabels(rows);
    },
    [loadSenderLabels]
  );

  const ensureOpeningGreeting = useCallback(
    async (threadId: string) => {
      if (!userId || !myProfile?.is_guide) return;

      const { count, error: countError } = await supabase
        .from('guide_messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', threadId);

      if (countError) {
        console.error('ensureOpeningGreeting count error:', countError);
        return;
      }

      if ((count || 0) > 0) return;

      const { error: insertError } = await supabase.from('guide_messages').insert({
        thread_id: threadId,
        sender_id: userId,
        content: OPENING_GREETING,
      });

      if (insertError) {
        console.error('ensureOpeningGreeting insert error:', insertError);
      }
    },
    [myProfile?.is_guide, userId]
  );

  const sendMessage = useCallback(async () => {
    if (!userId || !activeThreadId) return;

    const text = newMessage.trim();
    if (!text) return;

    setSending(true);

    const { error } = await supabase.from('guide_messages').insert({
      thread_id: activeThreadId,
      sender_id: userId,
      content: text,
    });

    if (error) {
      alert(error.message);
      setSending(false);
      return;
    }

    setNewMessage('');
    await loadMessages(activeThreadId);

    if (myProfile) {
      await loadThreads(userId, myProfile.is_guide === true, myProfile.guide_gender);
    }

    setSending(false);
    scrollToBottom();
  }, [activeThreadId, loadMessages, loadThreads, myProfile, newMessage, scrollToBottom, userId]);

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

      const { data: profile, error } = await supabase
  .from('profiles')
  .select('id, username, role, app_role, is_guide, guide_gender, languages_spoken')
  .eq('id', user.id)
  .single();

      if (error || !profile) {
        console.error('guide page profile load error:', error);
        router.push('/messages');
        return;
      }

      const me = profile as MyProfile;
      setMyProfile(me);

      const profileLanguages = Array.isArray((profile as any)?.languages_spoken)
  ? (profile as any).languages_spoken
  : [];

setTargetLanguage(profileLanguages[0] || 'English');

      await loadThreads(user.id, me.is_guide === true, me.guide_gender);
      setLoading(false);
    }

    void init();
  }, [loadThreads, router]);

  useEffect(() => {
    if (!activeThreadId || !userId || !myProfile) {
      setMessages([]);
      setSenderLabels({});
      return;
    }

    void (async () => {
      await ensureOpeningGreeting(activeThreadId);
      await loadMessages(activeThreadId);
      await loadThreads(userId, myProfile.is_guide === true, myProfile.guide_gender);
      scrollToBottom();
    })();
  }, [
    activeThreadId,
    ensureOpeningGreeting,
    loadMessages,
    loadThreads,
    myProfile,
    scrollToBottom,
    userId,
  ]);

  useEffect(() => {
    if (!userId || !myProfile) return;

    const channel = supabase
      .channel(`guide-page-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guide_messages' },
        async (payload) => {
          const row = (payload.new || payload.old) as Partial<GuideMessageRow>;
          if (!row.thread_id) return;

          await loadThreads(userId, myProfile.is_guide === true, myProfile.guide_gender);

          if (row.thread_id === activeThreadId) {
            await loadMessages(row.thread_id);
            scrollToBottom();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guide_threads' },
        async () => {
          await loadThreads(userId, myProfile.is_guide === true, myProfile.guide_gender);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeThreadId, loadMessages, loadThreads, myProfile, scrollToBottom, userId]);

  useEffect(() => {
  if (!targetLanguage || targetLanguage === 'English') return;
  if (messages.length === 0) return;

  const run = async () => {
    const updates: Record<string, string> = {};

    for (const m of messages.slice(-5)) {
      if (!m.content) continue;
      if (m.sender_id === userId) continue;
      if (translatedMessages[m.id]) continue;
      if (inflightRef.current.has(m.id)) continue;

      inflightRef.current.add(m.id);

      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: m.content,
            targetLanguage,
          }),
        });

        if (!res.ok) continue;

        const data = await res.json();

        if (data?.translated) {
          updates[m.id] = data.translated;
        }
      } catch (err) {
        console.error('guide translate error', err);
      } finally {
        inflightRef.current.delete(m.id);
      }
    }

    if (Object.keys(updates).length > 0) {
      setTranslatedMessages((prev) => ({
        ...prev,
        ...updates,
      }));
    }
  };

  void run();
}, [messages, targetLanguage, userId, translatedMessages]);

  const pageTitle = isGuide
  ? trSafe('Guide Inbox')
  : trSafe('Talk to Guide');
  const pageSubtitle = isGuide
    ? 'Active onboarding conversations from new members.'
    : 'Ask questions during your onboarding period.';

  const bubbleClassForMessage = (mine: boolean) => {
    if (isGuide) {
      return mine
        ? 'bg-blue-600 text-white'
        : 'border border-yellow-200 bg-yellow-50 text-neutral-900';
    }

    return mine
      ? 'bg-rose-500 text-white'
      : 'border border-yellow-200 bg-yellow-50 text-neutral-900';
  };

  if (loading) {
    return (
      <main className="fixed inset-0 bg-gradient-to-br from-white via-red-50 to-yellow-50">
        <div className="h-full w-full p-3 sm:p-4">
          <div className="mx-auto grid h-full max-w-[1400px] grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-neutral-900">Loading guide chat…</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 bg-gradient-to-br from-white via-red-50 to-yellow-50">
      <div className="h-full w-full p-3 sm:p-4">
        <div className="mx-auto grid h-full max-w-[1400px] grid-rows-[auto_minmax(0,1fr)] gap-3">
          <div className="rounded-3xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-black tracking-tight text-neutral-900">
                  {pageTitle}
                </div>
                <div className="mt-1 text-sm text-neutral-600">{pageSubtitle}</div>
              </div>

              <div className="flex flex-wrap gap-2">
  <button
    type="button"
    onClick={() => setForceEnglish((prev) => !prev)}
    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
  >
    {forceEnglish ? 'Use Selected Language' : 'View in English'}
  </button>

  <button
    onClick={() => router.push('/messages')}
    className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-bold text-neutral-900 shadow-sm transition hover:bg-neutral-50"
  >
    {trSafe('Back to Messages')}
  </button>

  <button
    onClick={async () => {
      await supabase.auth.signOut();
      router.push('/auth');
    }}
    className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-100"
  >
    {trSafe('Sign Out')}
  </button>
</div>
            </div>
          </div>

          {guideThreads.length === 0 ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
              <div className="text-xl font-black text-neutral-900">
                {isGuide
  ? trSafe('No active member guide conversations right now')
  : trSafe('No active guide chat')}
              </div>
              <div className="mt-2 text-sm text-neutral-600">
                {isGuide
  ? trSafe('Only real member onboarding threads will appear here.')
  : trSafe('Your onboarding guide chat is not active right now.')}
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
                <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
                  <div className="px-2 pb-3 pt-1 text-sm font-black uppercase tracking-wide text-neutral-500">
                    {isGuide
  ? `${trSafe('Active guide threads')} (${guideThreads.length})`
  : trSafe('Your guide chat')}
                  </div>

                  <div className="min-h-0 overflow-y-auto pr-1">
                    <div className="grid gap-2">
                      {guideThreads.map((thread) => {
                        const isActive = thread.id === activeThreadId;
                        const member = memberLabels[thread.member_id];
                        const label = isGuide ? getMemberDisplayName(member) : 'Talk to Guide';
                        const lastActivity = lastMessageByThread[thread.id] || thread.created_at;

                        return (
                          <button
                            key={thread.id}
                            onClick={() => setActiveThreadId(thread.id)}
                            className={[
                              'w-full rounded-2xl border p-3 text-left transition',
                              isActive
                                ? 'border-blue-300 bg-blue-50 shadow-sm'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50',
                            ].join(' ')}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-black text-neutral-900">
                                  {label}
                                </div>
                                <div className="mt-1 text-xs text-neutral-500">
                                  {trSafe('Seeking:')} {thread.seeking || trSafe('not set')}
                                </div>
                              </div>

                              <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-700">
                                {formatExpiresIn(thread.expires_at)}
                              </span>
                            </div>

                            <div className="mt-2 text-xs text-neutral-500">
                              {trSafe('Last activity')} {formatDateTime(lastActivity)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </aside>

              <section className="min-h-0 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
                <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
                  <div className="border-b border-neutral-200 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-neutral-900">
                          {isGuide ? getMemberDisplayName(activeMemberLabel) : trSafe('Guide conversation')}
                        </div>
                        <div className="mt-1 text-sm text-neutral-600">
  {isGuide
    ? `${trSafe('Seeking:')} ${activeThread?.seeking || trSafe('not set')}`
    : trSafe('You can ask questions here during your onboarding window.')}
                 
                        </div>
                      </div>

                      <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">
                        {activeThread ? formatExpiresIn(activeThread.expires_at) : ''}
                      </div>
                    </div>
                  </div>

                  <div className="relative min-h-0 overflow-y-auto px-5 py-4">
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.08]">
                      <img src="/lovef8-bg.png" alt="LoveF8" className="w-full max-w-[420px]" />
                    </div>

                    {messages.length === 0 ? (
                      <div className="relative rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
                        <div className="text-base font-bold text-neutral-900">{trSafe('No messages yet')}</div>
                        <div className="mt-1 text-sm text-neutral-600">
                          {isGuide
  ? trSafe('Be the first guide to respond in this onboarding thread.')
  : trSafe('Send your first question to the guides.')}
                        </div>
                      </div>
                    ) : (
                      <div className="relative space-y-3">
                        {messages.map((message) => {
                          const mine = message.sender_id === userId;
                          const senderName = senderLabels[message.sender_id]
                            || (mine
                              ? getSafeSenderName(
                                  myProfile?.username,
                                  isGuide ? 'Guide' : 'You'
                                )
                              : isGuide
                                ? getMemberDisplayName(activeMemberLabel)
                                : 'Guide');

                          return (
                            <div
                              key={message.id}
                              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={[
                                  'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm',
                                  bubbleClassForMessage(mine),
                                ].join(' ')}
                              >
                                <div
                                  className={`mb-1 text-[11px] font-bold ${
                                    mine ? 'text-white/80' : 'text-neutral-500'
                                  }`}
                                >
                                  {senderName}
                                </div>

                                <div className="whitespace-pre-wrap break-words text-sm leading-6">
  {message.sender_id !== userId && targetLanguage && targetLanguage !== 'English'
    ? translatedMessages[message.id] || message.content
    : message.content}
</div>

                                <div
                                  className={`mt-2 text-[11px] font-medium ${
                                    mine ? 'text-white/70' : 'text-neutral-500'
                                  }`}
                                >
                                  {formatDateTime(message.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-neutral-200 px-4 py-3">
                    <div className="flex items-end gap-3">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isGuide ? trSafe('Reply as a guide…') : trSafe('Type your question…')}
                        rows={2}
                        className="min-h-[92px] flex-1 resize-none rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-900"
                      />

                      <button
                        onClick={() => void sendMessage()}
                        disabled={sending || !newMessage.trim() || !activeThreadId}
                        className="rounded-2xl border border-neutral-900 bg-neutral-900 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? trSafe('Sending…') : trSafe('Send')}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}