'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { touchLastLogin } from '@/lib/touchLastLogin';

const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

type HomeProfile = {
  id: string;
  username: string | null;
  role: string | null;
  approved: boolean | null;
  avatar_url: string | null;
  avatar_thumb_url?: string | null;
  headline: string | null;
  short_bio: string | null;
  age: number | null;
  gender: string | null;
  location_text: string | null;
  country_origin: string | null;
  membership_tier: string | null;
  spark_balance: number | null;
  languages_spoken: string[] | null;
};

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

function formatMembership(value: string | null | undefined) {
  if (!value) return 'Free';

  const cleaned = value.replace(/_/g, ' ').trim();

  if (!cleaned) return 'Free';

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const displayName = useMemo(() => {
    return profile?.username?.trim() || 'LoveF8 Member';
  }, [profile?.username]);

  const membershipName = useMemo(() => {
    return formatMembership(profile?.membership_tier);
  }, [profile?.membership_tier]);

  const sparkBalance = useMemo(() => {
    return profile?.spark_balance ?? 0;
  }, [profile?.spark_balance]);

  const locationLine = useMemo(() => {
    const parts = [profile?.location_text, profile?.country_origin]
      .map((item) => item?.trim())
      .filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Location not added yet';
  }, [profile?.country_origin, profile?.location_text]);

  const basicsLine = useMemo(() => {
    const parts = [
      typeof profile?.age === 'number' ? `${profile.age}` : null,
      profile?.gender?.trim() || null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' • ') : 'Basic details not added yet';
  }, [profile?.age, profile?.gender]);

  useEffect(() => {
    async function loadHome() {
      setLoading(true);
      setErrorText(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      void touchLastLogin(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          id,
          username,
          role,
          approved,
          avatar_url,
          avatar_thumb_url,
          headline,
          short_bio,
          age,
          gender,
          location_text,
          country_origin,
          membership_tier,
          spark_balance,
          languages_spoken
          `
        )
        .eq('id', user.id)
        .single();

      if (error || !data) {
        console.error('home profile load error:', error);
        setErrorText(error?.message || 'Could not load your profile.');
        setProfile(null);
        setAvatarUrl(null);
        setLoading(false);
        return;
      }

      const loadedProfile = data as HomeProfile;
      setProfile(loadedProfile);

      const preferredAvatar = loadedProfile.avatar_thumb_url || loadedProfile.avatar_url;
      setAvatarUrl(await signAvatarUrl(preferredAvatar));

      setLoading(false);
    }

    void loadHome();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/auth');
  }

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_45%,#f6f4ff_100%)] px-4 py-6 text-neutral-900">
        <div className="mx-auto flex min-h-[80dvh] max-w-5xl items-center justify-center">
          <div className="rounded-3xl border border-fuchsia-100 bg-white/85 px-5 py-4 text-sm font-semibold text-neutral-700 shadow-[0_18px_45px_rgba(83,34,115,0.10)] backdrop-blur">
            Loading LoveF8 Home...
          </div>
        </div>
      </main>
    );
  }

  if (errorText) {
    return (
      <main className="min-h-[100dvh] bg-[linear-gradient(180deg,#fff7fc_0%,#fff_45%,#f6f4ff_100%)] px-4 py-6 text-neutral-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold text-red-700">Something went wrong</h1>
          <p className="mt-2 text-sm text-neutral-700">{errorText}</p>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="mt-4 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            Go to Profile
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_45%,#f6f4ff_100%)] px-3 py-4 text-neutral-900 sm:px-5">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border border-fuchsia-100/80 bg-white/85 p-3 shadow-[0_18px_45px_rgba(83,34,115,0.08)] backdrop-blur">
          <button
            type="button"
            onClick={() => router.push('/home')}
            className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-sm font-bold text-fuchsia-800 shadow-sm"
          >
            Home
          </button>

          <button
            type="button"
            onClick={() => router.push('/connect')}
            className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 shadow-sm hover:bg-sky-100"
          >
            Connect
          </button>

          <button
            type="button"
            onClick={() => router.push('/likes')}
            className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-semibold text-pink-800 shadow-sm hover:bg-pink-100"
          >
            Likes
          </button>

          <button
            type="button"
            onClick={() => router.push('/messages')}
            className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-100"
          >
            Messages
          </button>

          <button
            type="button"
            onClick={() => router.push('/wallet')}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
          >
            Wallet
          </button>

          <button
            type="button"
            onClick={() => router.push('/membership')}
            className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 shadow-sm hover:bg-violet-100"
          >
            Membership
          </button>

          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            Profile
          </button>

          <button
            type="button"
            onClick={signOut}
            className="ml-auto rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100"
          >
            Sign out
          </button>
        </div>

        <section className="rounded-[32px] border border-fuchsia-100/80 bg-white/85 p-5 shadow-[0_20px_60px_rgba(83,34,115,0.10)] backdrop-blur sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-sky-50 shadow-sm">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-fuchsia-500">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fuchsia-700">Welcome back</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">
                {displayName}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                {profile?.headline?.trim() ||
                  profile?.short_bio?.trim() ||
                  'Your LoveF8 page is ready. Add a little more about yourself when you are ready.'}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="rounded-[28px] border border-neutral-100 bg-white/88 p-5 shadow-[0_14px_38px_rgba(83,34,115,0.08)] backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">
              Your Profile
            </p>

            <h2 className="mt-3 text-xl font-black text-neutral-950">Page basics</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-semibold text-neutral-500">Age / Gender</p>
                <p className="font-bold text-neutral-900">{basicsLine}</p>
              </div>

              <div>
                <p className="font-semibold text-neutral-500">Location</p>
                <p className="font-bold text-neutral-900">{locationLine}</p>
              </div>

              <div>
                <p className="font-semibold text-neutral-500">Profile type</p>
                <p className="font-bold text-neutral-900">
                  {profile?.role === 'host' ? 'Host' : 'Member'}
                  {profile?.role === 'host' && profile?.approved === true ? ' • Approved' : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="mt-5 w-full rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-neutral-800"
            >
              View Profile
            </button>
          </section>

          <section className="rounded-[28px] border border-violet-100 bg-white/88 p-5 shadow-[0_14px_38px_rgba(83,34,115,0.08)] backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-400">
              Membership
            </p>

            <h2 className="mt-3 text-xl font-black text-neutral-950">Current package</h2>

            <div className="mt-5 rounded-3xl border border-violet-100 bg-violet-50/70 p-4">
              <p className="text-sm font-semibold text-violet-700">Plan</p>
              <p className="mt-1 text-3xl font-black text-violet-950">{membershipName}</p>
            </div>

            <p className="mt-4 text-sm leading-6 text-neutral-600">
              View your package, compare options, or make changes from Membership.
            </p>

            <button
              type="button"
              onClick={() => router.push('/membership')}
              className="mt-5 w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-violet-700"
            >
              View Membership
            </button>
          </section>

          <section className="rounded-[28px] border border-amber-100 bg-white/88 p-5 shadow-[0_14px_38px_rgba(83,34,115,0.08)] backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">
              Sparks
            </p>

            <h2 className="mt-3 text-xl font-black text-neutral-950">Available balance</h2>

            <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
              <p className="text-sm font-semibold text-amber-700">Sparks available</p>
              <p className="mt-1 text-4xl font-black text-amber-950">{sparkBalance}</p>
            </div>

            <p className="mt-4 text-sm leading-6 text-neutral-600">
              Sparks help you keep conversations going and support the people you enjoy talking to.
            </p>

            <button
              type="button"
              onClick={() => router.push('/wallet')}
              className="mt-5 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
            >
              Open Wallet
            </button>
          </section>
        </div>

        <section className="mt-4 rounded-[28px] border border-fuchsia-100/80 bg-white/88 p-5 shadow-[0_14px_38px_rgba(83,34,115,0.08)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-400">
                Quick links
              </p>
              <h2 className="mt-2 text-xl font-black text-neutral-950">
                Where do you want to go?
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push('/connect')}
                className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100"
              >
                Find people
              </button>

              <button
                type="button"
                onClick={() => router.push('/messages')}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100"
              >
                Open messages
              </button>

              <button
                type="button"
                onClick={() => router.push('/likes')}
                className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-800 hover:bg-pink-100"
              >
                View likes
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}