'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type LikeRow = {
  sender_profile_id: string;
  receiver_profile_id: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  approved: boolean | null;
  chat_mode: string | null;
  headline: string | null;
  short_bio: string | null;
  location_text: string | null;
};

const LIKES_UI_TEXTS = [
  'LoveF8 Likes',
  'Quiet signals, real conversations',
  'Likes are here to encourage connection, not replace conversation.',
  'Back to Connect',
  'View in English',
  'Use Selected Language',
  'Mutual matches',
  'You both liked each other. A good reason to start a conversation.',
  'No mutual matches yet.',
  'People who liked you',
  'These are incoming likes that are not mutual yet.',
  'No incoming likes yet.',
  'People you liked',
  'These are quiet signals you sent that are not mutual yet.',
  'No outgoing likes yet.',
  'Match 💖',
  'Liked you',
  'You liked',
  'No intro yet',
  'Go to Connect',
  'Loading likes...',
];

const likesTranslationMemoryCache = new Map<string, Record<string, string>>();

function buildLikesTranslationCacheKey(targetLanguage: string) {
  return `lovef8-likes-ui::${targetLanguage}::${JSON.stringify(LIKES_UI_TEXTS)}`;
}

function readLikesTranslationCache(cacheKey: string): Record<string, string> | null {
  const memoryValue = likesTranslationMemoryCache.get(cacheKey);
  if (memoryValue) return memoryValue;

  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(cacheKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Record<string, string>;
    likesTranslationMemoryCache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    console.error('readLikesTranslationCache error:', error);
    return null;
  }
}

function writeLikesTranslationCache(cacheKey: string, map: Record<string, string>) {
  likesTranslationMemoryCache.set(cacheKey, map);

  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(map));
  } catch (error) {
    console.error('writeLikesTranslationCache error:', error);
  }
}

export default function LikesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
  const [translatedUiMap, setTranslatedUiMap] = useState<Record<string, string>>({});
  const [forceEnglish, setForceEnglish] = useState(false);
  const [incomingLikes, setIncomingLikes] = useState<LikeRow[]>([]);
  const [outgoingLikes, setOutgoingLikes] = useState<LikeRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});

  const trSafe = (text: string) => {
    if (forceEnglish) return text;
    return translatedUiMap[text] || text;
  };

  useEffect(() => {
    let isActive = true;

    async function translateLikesUI() {
      if (!targetLanguage || targetLanguage === 'English') {
        if (isActive) {
          setTranslatedUiMap({});
        }
        return;
      }

      const cacheKey = buildLikesTranslationCacheKey(targetLanguage);
      const cached = readLikesTranslationCache(cacheKey);

      if (cached) {
        if (isActive) {
          setTranslatedUiMap(cached);
        }
        return;
      }

      try {
        const res = await fetch('/api/translate-settings-ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: LIKES_UI_TEXTS,
            targetLanguage,
          }),
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

          writeLikesTranslationCache(cacheKey, map);
          setTranslatedUiMap(map);
        }
      } catch (error) {
        console.error('translateLikesUI error:', error);
      }
    }

    void translateLikesUI();

    return () => {
      isActive = false;
    };
  }, [targetLanguage]);

  useEffect(() => {
    async function loadLikesPage() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      setUserId(user.id);

      const { data: myProfile, error: myProfileError } = await supabase
        .from('profiles')
        .select('languages_spoken')
        .eq('id', user.id)
        .single();

      if (myProfileError) {
        console.error('likes profile language load error:', myProfileError);
      } else {
        const languages = Array.isArray((myProfile as any)?.languages_spoken)
          ? (myProfile as any).languages_spoken
          : [];

        setTargetLanguage(languages[0] || 'English');
      }

      const { data: likeRows, error: likesError } = await supabase
        .from('profile_likes')
        .select('sender_profile_id, receiver_profile_id, created_at')
        .or(`sender_profile_id.eq.${user.id},receiver_profile_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (likesError) {
        console.error('load likes error:', likesError);
        setIncomingLikes([]);
        setOutgoingLikes([]);
        setProfilesById({});
        setLoading(false);
        return;
      }

      const rows = (likeRows || []) as LikeRow[];

      const incoming = rows.filter((like) => like.receiver_profile_id === user.id);
      const outgoing = rows.filter((like) => like.sender_profile_id === user.id);

      setIncomingLikes(incoming);
      setOutgoingLikes(outgoing);

      const profileIds = Array.from(
        new Set([
          ...incoming.map((like) => like.sender_profile_id),
          ...outgoing.map((like) => like.receiver_profile_id),
        ])
      );

      if (profileIds.length === 0) {
        setProfilesById({});
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(
          'id, username, avatar_url, role, approved, chat_mode, headline, short_bio, location_text'
        )
        .in('id', profileIds);

      if (profilesError) {
        console.error('load like profiles error:', profilesError);
        setProfilesById({});
        setLoading(false);
        return;
      }

      const nextProfiles: Record<string, ProfileRow> = {};

      ((profiles || []) as ProfileRow[]).forEach((profile) => {
        nextProfiles[profile.id] = profile;
      });

      setProfilesById(nextProfiles);
      setLoading(false);
    }

    void loadLikesPage();
  }, [router]);

  const mutualMatchIds = useMemo(() => {
    if (!userId) return [];

    const outgoingIds = new Set(outgoingLikes.map((like) => like.receiver_profile_id));

    return incomingLikes
      .map((like) => like.sender_profile_id)
      .filter((profileId) => outgoingIds.has(profileId));
  }, [incomingLikes, outgoingLikes, userId]);

  const incomingOnlyIds = useMemo(() => {
    const matchSet = new Set(mutualMatchIds);

    return incomingLikes
      .map((like) => like.sender_profile_id)
      .filter((profileId) => !matchSet.has(profileId));
  }, [incomingLikes, mutualMatchIds]);

  const outgoingOnlyIds = useMemo(() => {
    const matchSet = new Set(mutualMatchIds);

    return outgoingLikes
      .map((like) => like.receiver_profile_id)
      .filter((profileId) => !matchSet.has(profileId));
  }, [mutualMatchIds, outgoingLikes]);

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-[#fff7fc] px-4 py-6 text-neutral-900">
        <div className="mx-auto max-w-5xl rounded-3xl border border-fuchsia-100 bg-white p-5 shadow-sm">
          {trSafe('Loading likes...')}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[linear-gradient(180deg,#fff7fc_0%,#fff_45%,#f6f4ff_100%)] px-4 py-6 text-neutral-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-fuchsia-700">
              {trSafe('LoveF8 Likes')}
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight">
              {trSafe('Quiet signals, real conversations')}
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-neutral-600">
              {trSafe('Likes are here to encourage connection, not replace conversation.')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForceEnglish((prev) => !prev)}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-100"
            >
              {forceEnglish ? 'Use Selected Language' : 'View in English'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/connect')}
              className="rounded-xl border border-fuchsia-100 bg-white px-4 py-2 text-sm font-bold text-neutral-900 shadow-sm hover:bg-fuchsia-50"
            >
              {trSafe('Back to Connect')}
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-fuchsia-100 bg-white/90 p-4 shadow-sm">
          <h2 className="text-lg font-black">{trSafe('Mutual matches')}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {trSafe('You both liked each other. A good reason to start a conversation.')}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {mutualMatchIds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
                {trSafe('No mutual matches yet.')}
              </div>
            ) : (
              mutualMatchIds.map((profileId) => {
                const profile = profilesById[profileId];

                return (
                  <LikeProfileCard
                    key={profileId}
                    profile={profile}
                    fallbackName="Match"
                    badge={trSafe('Match 💖')}
                    noIntroText={trSafe('No intro yet')}
                    goToConnectText={trSafe('Go to Connect')}
                    onOpen={() => router.push('/connect')}
                  />
                );
              })
            )}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-fuchsia-100 bg-white/90 p-4 shadow-sm">
          <h2 className="text-lg font-black">{trSafe('People who liked you')}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {trSafe('These are incoming likes that are not mutual yet.')}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {incomingOnlyIds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
                {trSafe('No incoming likes yet.')}
              </div>
            ) : (
              incomingOnlyIds.map((profileId) => {
                const profile = profilesById[profileId];

                return (
                  <LikeProfileCard
                    key={profileId}
                    profile={profile}
                    fallbackName="Someone"
                    badge={trSafe('Liked you')}
                    noIntroText={trSafe('No intro yet')}
                    goToConnectText={trSafe('Go to Connect')}
                    onOpen={() => router.push('/connect')}
                  />
                );
              })
            )}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-fuchsia-100 bg-white/90 p-4 shadow-sm">
          <h2 className="text-lg font-black">{trSafe('People you liked')}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {trSafe('These are quiet signals you sent that are not mutual yet.')}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {outgoingOnlyIds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
                {trSafe('No outgoing likes yet.')}
              </div>
            ) : (
              outgoingOnlyIds.map((profileId) => {
                const profile = profilesById[profileId];

                return (
                  <LikeProfileCard
                    key={profileId}
                    profile={profile}
                    fallbackName="Someone"
                    badge={trSafe('You liked')}
                    noIntroText={trSafe('No intro yet')}
                    goToConnectText={trSafe('Go to Connect')}
                    onOpen={() => router.push('/connect')}
                  />
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function LikeProfileCard({
  profile,
  fallbackName,
  badge,
  noIntroText,
  goToConnectText,
  onOpen,
}: {
  profile: ProfileRow | undefined;
  fallbackName: string;
  badge: string;
  noIntroText: string;
  goToConnectText: string;
  onOpen: () => void;
}) {
  const name = profile?.username?.trim() || fallbackName;
  const intro = profile?.headline?.trim() || profile?.short_bio?.trim() || noIntroText;

  return (
    <div className="rounded-2xl border border-fuchsia-100 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100 text-lg font-black text-neutral-700">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-neutral-950">{name}</div>

              {profile?.location_text?.trim() && (
                <div className="mt-0.5 truncate text-xs text-neutral-500">
                  {profile.location_text.trim()}
                </div>
              )}
            </div>

            <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-bold text-pink-700">
              {badge}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-5 text-neutral-600">{intro}</p>

          <button
            type="button"
            onClick={onOpen}
            className="mt-3 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm hover:bg-fuchsia-50"
          >
            {goToConnectText}
          </button>
        </div>
      </div>
    </div>
  );
}