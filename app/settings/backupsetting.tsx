'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ProfilePhotoUploader from './components/ProfilePhotoUploader';

type ChatMode = 'chatty' | 'flirty' | 'romantic' | 'open_all';

type GenderOption = 'Man' | 'Woman' | 'Non-binary' | 'Prefer not to say';
type InterestedInOption = 'Men' | 'Women' | 'Both';
type RelationshipGoalOption =
  | 'Meaningful conversation'
  | 'Friendship'
  | 'Long-term relationship'
  | 'Open to anything';
type WantsKidsOption = 'Yes' | 'No' | 'Maybe' | 'Undecided';
type SimpleChoice3 = 'Yes' | 'Socially' | 'No';
type ExerciseChoice = 'Often' | 'Sometimes' | 'Rarely';
type MorningNightChoice = 'Morning' | 'Night' | 'Both';

type HostApplicationStatus =
  | 'not_applied'
  | 'in_progress'
  | 'under_review'
  | 'approved'
  | 'rejected';

const CHAT_MODE_OPTIONS: Array<{
  value: ChatMode;
  label: string;
  description: string;
}> = [
  {
    value: 'chatty',
    label: 'Chatty',
    description: 'Light, friendly, casual conversation.',
  },
  {
    value: 'flirty',
    label: 'Flirty',
    description: 'Playful, warm, more expressive conversation.',
  },
  {
    value: 'romantic',
    label: 'Romantic',
    description: 'More emotionally intimate and romance-forward conversation.',
  },
  {
    value: 'open_all',
    label: 'Open to all',
    description: 'Show me across all conversation styles.',
  },
];

const GENDER_OPTIONS: GenderOption[] = [
  'Man',
  'Woman',
  'Non-binary',
  'Prefer not to say',
];

const INTERESTED_IN_OPTIONS: InterestedInOption[] = ['Men', 'Women', 'Both'];

const RELATIONSHIP_GOAL_OPTIONS: RelationshipGoalOption[] = [
  'Meaningful conversation',
  'Friendship',
  'Long-term relationship',
  'Open to anything',
];

const WANTS_KIDS_OPTIONS: WantsKidsOption[] = ['Yes', 'No', 'Maybe', 'Undecided'];

const DRINK_OPTIONS: SimpleChoice3[] = ['Yes', 'Socially', 'No'];
const SMOKE_OPTIONS: SimpleChoice3[] = ['Yes', 'Socially', 'No'];
const EXERCISE_OPTIONS: ExerciseChoice[] = ['Often', 'Sometimes', 'Rarely'];
const MORNING_NIGHT_OPTIONS: MorningNightChoice[] = ['Morning', 'Night', 'Both'];

function extractStoragePath(value: string | null): string | null {
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

function normalizeTagsInput(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function normalizeTimeInput(value: string) {
  return value.trim() || null;
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeHostStatus(value: unknown): HostApplicationStatus {
  if (
    value === 'not_applied' ||
    value === 'in_progress' ||
    value === 'under_review' ||
    value === 'approved' ||
    value === 'rejected'
  ) {
    return value;
  }

  return 'not_applied';
}

function hostStatusLabel(status: HostApplicationStatus) {
  switch (status) {
    case 'in_progress':
      return 'In progress';
    case 'under_review':
      return 'Under review';
    case 'approved':
      return 'Approved host';
    case 'rejected':
      return 'Needs updates';
    default:
      return 'Not applied';
  }
}

function hostButtonLabel(status: HostApplicationStatus) {
  switch (status) {
    case 'in_progress':
      return 'Continue host setup';
    case 'under_review':
      return 'Open host review status';
    case 'approved':
      return 'Open Host Dashboard';
    case 'rejected':
      return 'Fix host application';
    default:
      return 'Become a Host';
  }
}

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingDiscovery, setSavingDiscovery] = useState(false);
  const [savingChatMode, setSavingChatMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [discoverable, setDiscoverable] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('open_all');
  const [roleLabel, setRoleLabel] = useState<'host' | 'member'>('member');
  const [hostApplicationStatus, setHostApplicationStatus] =
    useState<HostApplicationStatus>('not_applied');
  const [userId, setUserId] = useState<string | null>(null);

  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [headline, setHeadline] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [aboutLong, setAboutLong] = useState('');
  const [talkTopics, setTalkTopics] = useState('');
  const [styleVibe, setStyleVibe] = useState('');

  const [bestAt, setBestAt] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const [locationText, setLocationText] = useState('');
  const [countryOrigin, setCountryOrigin] = useState('');
const [regionOrigin, setRegionOrigin] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [normallyOnlineStart, setNormallyOnlineStart] = useState('');
  const [normallyOnlineEnd, setNormallyOnlineEnd] = useState('');

  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState<string[]>([]);
  const [relationshipGoal, setRelationshipGoal] = useState('');
  const [hasKids, setHasKids] = useState('');
  const [wantsKids, setWantsKids] = useState('');

  const [drink, setDrink] = useState('');
  const [smoke, setSmoke] = useState('');
  const [exercise, setExercise] = useState('');
  const [pets, setPets] = useState('');
  const [morningOrNight, setMorningOrNight] = useState('');
  const [longDistanceOpen, setLongDistanceOpen] = useState('');

  const [threeWords, setThreeWords] = useState('');
  const [peopleNotice, setPeopleNotice] = useState('');
  const [proudOf, setProudOf] = useState('');
  const [biggestStrength, setBiggestStrength] = useState('');
  const [whatMatters, setWhatMatters] = useState('');
  const [nonNegotiable, setNonNegotiable] = useState('');
  const [healthyRelationship, setHealthyRelationship] = useState('');
  const [hiddenTalent, setHiddenTalent] = useState('');
  const [controversialOpinion, setControversialOpinion] = useState('');
  const [simplePleasures, setSimplePleasures] = useState('');
  const [twoTruthsLie, setTwoTruthsLie] = useState('');

  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutDetails, setPayoutDetails] = useState('');

  const payoutDetailsLabel =
    payoutMethod === 'paypal'
      ? 'PayPal Email'
      : payoutMethod === 'gcash'
        ? 'GCash Number'
        : payoutMethod === 'bank'
          ? 'Bank Details'
          : payoutMethod === 'other'
            ? 'Payout Details'
            : 'Payout Details';

  const payoutDetailsPlaceholder =
    payoutMethod === 'paypal'
      ? 'name@example.com'
      : payoutMethod === 'gcash'
        ? '09XXXXXXXXX'
        : payoutMethod === 'bank'
          ? 'Bank name, account name, account number'
          : payoutMethod === 'other'
            ? 'Enter payout instructions'
            : 'PayPal email, GCash number, or bank details';

  const payoutDetailsHelp =
    payoutMethod === 'paypal'
      ? 'Use the PayPal email where you want to receive payouts.'
      : payoutMethod === 'gcash'
        ? 'Use the GCash mobile number for this account.'
        : payoutMethod === 'bank'
          ? 'Enter the bank name and account details exactly how you want admin to see them.'
          : payoutMethod === 'other'
            ? 'Add clear instructions for how you want to be paid.'
            : 'Choose a payout method, then enter the matching details.';

  const parsedTags = useMemo(() => normalizeTagsInput(tagsInput), [tagsInput]);

  const headlineCount = headline.length;
  const shortBioCount = shortBio.length;
  const aboutLongCount = aboutLong.length;
  const talkTopicsCount = talkTopics.length;
  const styleVibeCount = styleVibe.length;
  const bestAtCount = bestAt.length;
  const lookingForCount = lookingFor.length;
  const threeWordsCount = threeWords.length;
  const peopleNoticeCount = peopleNotice.length;
  const proudOfCount = proudOf.length;
  const biggestStrengthCount = biggestStrength.length;
  const whatMattersCount = whatMatters.length;
  const nonNegotiableCount = nonNegotiable.length;
  const healthyRelationshipCount = healthyRelationship.length;
  const hiddenTalentCount = hiddenTalent.length;
  const controversialOpinionCount = controversialOpinion.length;
  const simplePleasuresCount = simplePleasures.length;
  const twoTruthsLieCount = twoTruthsLie.length;

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          discoverable,
          chat_mode,
          role,
          host_application_status,
          avatar_url,
          headline,
          short_bio,
          about_long,
          talk_topics,
          style_vibe,
          best_at,
          looking_for,
          profile_tags,
          country_origin,
region_origin,
          location_text,
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
          two_truths_lie,
          payout_method,
          payout_details
          `
        )
        .eq('id', user.id)
        .single();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      setDiscoverable(data?.discoverable === true);

      const nextChatMode = data?.chat_mode as ChatMode | null;
      if (
        nextChatMode === 'chatty' ||
        nextChatMode === 'flirty' ||
        nextChatMode === 'romantic' ||
        nextChatMode === 'open_all'
      ) {
        setChatMode(nextChatMode);
      } else {
        setChatMode('open_all');
      }

      setHostApplicationStatus(normalizeHostStatus(data?.host_application_status));

      if (data?.role === 'host') {
        setRoleLabel('host');
      } else {
        setRoleLabel('member');
      }

      setHeadline(data?.headline ?? '');
      setShortBio(data?.short_bio ?? '');
      setAboutLong(data?.about_long ?? '');
      setTalkTopics(data?.talk_topics ?? '');
      setStyleVibe(data?.style_vibe ?? '');
      setBestAt(data?.best_at ?? '');
      setLookingFor(data?.looking_for ?? '');
      setTagsInput(Array.isArray(data?.profile_tags) ? data.profile_tags.join(', ') : '');

      setLocationText(data?.location_text ?? '');
      setCountryOrigin(data?.country_origin ?? '');
setRegionOrigin(data?.region_origin ?? '');
      setTimezone(data?.timezone || getBrowserTimezone());
      setNormallyOnlineStart(data?.normally_online_start?.slice(0, 5) ?? '');
      setNormallyOnlineEnd(data?.normally_online_end?.slice(0, 5) ?? '');

      setAge(data?.age != null ? String(data.age) : '');
      setGender(data?.gender ?? '');
      setInterestedIn(asTextArray(data?.interested_in));
      setRelationshipGoal(data?.relationship_goal ?? '');
      setHasKids(
        typeof data?.has_kids === 'boolean' ? (data.has_kids ? 'Yes' : 'No') : ''
      );
      setWantsKids(data?.wants_kids ?? '');

      setDrink(data?.drink ?? '');
      setSmoke(data?.smoke ?? '');
      setExercise(data?.exercise ?? '');
      setPets(typeof data?.pets === 'boolean' ? (data.pets ? 'Yes' : 'No') : '');
      setMorningOrNight(data?.morning_or_night ?? '');
      setLongDistanceOpen(
        typeof data?.long_distance_open === 'boolean'
          ? data.long_distance_open
            ? 'Yes'
            : 'No'
          : ''
      );

      setThreeWords(data?.three_words ?? '');
      setPeopleNotice(data?.people_notice ?? '');
      setProudOf(data?.proud_of ?? '');
      setBiggestStrength(data?.biggest_strength ?? '');
      setWhatMatters(data?.what_matters ?? '');
      setNonNegotiable(data?.non_negotiable ?? '');
      setHealthyRelationship(data?.healthy_relationship ?? '');
      setHiddenTalent(data?.hidden_talent ?? '');
      setControversialOpinion(data?.controversial_opinion ?? '');
      setSimplePleasures(data?.simple_pleasures ?? '');
      setTwoTruthsLie(data?.two_truths_lie ?? '');

      setPayoutMethod(data?.payout_method ?? '');
      setPayoutDetails(data?.payout_details ?? '');

      const storedAvatar = data?.avatar_url ?? null;
      const normalizedPath = extractStoragePath(storedAvatar);
      setAvatarPath(normalizedPath);

      if (normalizedPath) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(normalizedPath, 60 * 60);

        if (!signedError && signedData?.signedUrl) {
          setAvatarPreviewUrl(signedData.signedUrl);
        } else {
          setAvatarPreviewUrl(null);
        }
      } else {
        setAvatarPreviewUrl(null);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  async function saveDiscovery(next: boolean) {
    setSavingDiscovery(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ discoverable: next })
      .eq('id', user.id);

    if (error) {
      alert(error.message);
      setSavingDiscovery(false);
      return;
    }

    setDiscoverable(next);
    setSavingDiscovery(false);
  }

  async function saveChatMode(next: ChatMode) {
    setSavingChatMode(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        chat_mode: next,
        chat_mode_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      alert(error.message);
      setSavingChatMode(false);
      return;
    }

    setChatMode(next);
    setSavingChatMode(false);
  }

  function toggleInterestedIn(value: InterestedInOption) {
    setInterestedIn((prev) => {
      if (value === 'Both') {
        return prev.includes('Both') ? [] : ['Both'];
      }

      const withoutBoth = prev.filter((item) => item !== 'Both');

      if (withoutBoth.includes(value)) {
        return withoutBoth.filter((item) => item !== value);
      }

      return [...withoutBoth, value];
    });
  }

  async function saveProfileContent() {
    setSavingProfile(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    const parsedAge = age.trim() ? Number(age.trim()) : null;

    if (
      age.trim() &&
      (parsedAge === null ||
        !Number.isInteger(parsedAge) ||
        parsedAge < 18 ||
        parsedAge > 120)
    ) {
      alert('Please enter a valid age between 18 and 120.');
      setSavingProfile(false);
      return;
    }

    const payload = {
      headline: headline.trim() || null,
      short_bio: shortBio.trim() || null,
      about_long: aboutLong.trim() || null,
      talk_topics: talkTopics.trim() || null,
      style_vibe: styleVibe.trim() || null,
      best_at: bestAt.trim() || null,
      looking_for: lookingFor.trim() || null,
      profile_tags: parsedTags,
      location_text: locationText.trim() || null,
      country_origin: countryOrigin.trim() || null,
      region_origin: regionOrigin || null,
      timezone: timezone.trim() || getBrowserTimezone(),
      normally_online_start: normalizeTimeInput(normallyOnlineStart),
      normally_online_end: normalizeTimeInput(normallyOnlineEnd),

      age: parsedAge,
      gender: gender || null,
      interested_in: interestedIn.length > 0 ? interestedIn : [],
      relationship_goal: relationshipGoal || null,
      has_kids: hasKids === 'Yes' ? true : hasKids === 'No' ? false : null,
      wants_kids: wantsKids || null,

      drink: drink || null,
      smoke: smoke || null,
      exercise: exercise || null,
      pets: pets === 'Yes' ? true : pets === 'No' ? false : null,
      morning_or_night: morningOrNight || null,
      long_distance_open:
        longDistanceOpen === 'Yes' ? true : longDistanceOpen === 'No' ? false : null,

      three_words: threeWords.trim() || null,
      people_notice: peopleNotice.trim() || null,
      proud_of: proudOf.trim() || null,
      biggest_strength: biggestStrength.trim() || null,
      what_matters: whatMatters.trim() || null,
      non_negotiable: nonNegotiable.trim() || null,
      healthy_relationship: healthyRelationship.trim() || null,
      hidden_talent: hiddenTalent.trim() || null,
      controversial_opinion: controversialOpinion.trim() || null,
      simple_pleasures: simplePleasures.trim() || null,
      two_truths_lie: twoTruthsLie.trim() || null,

      payout_method: payoutMethod || null,
      payout_details: payoutDetails.trim() || null,
    };

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id);

    if (error) {
      alert(error.message);
      setSavingProfile(false);
      return;
    }

    alert('Profile updated.');
    setSavingProfile(false);
  }

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
    <main className="min-h-[100dvh] bg-neutral-50 px-4 py-6 text-neutral-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-black tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Manage how you appear in discovery and build a profile that feels real, warm, and easy to connect with.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
  <button
    type="button"
    onClick={() => void saveProfileContent()}
    disabled={savingProfile}
    className="inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {savingProfile ? 'Saving profile...' : 'Save profile'}
  </button>

  <button
    type="button"
    onClick={() => router.push('/messages')}
    className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
  >
    Back to Messages
  </button>
</div>

        {userId ? (
          <div className="mt-6">
            <ProfilePhotoUploader
              userId={userId}
              currentAvatarUrl={avatarPreviewUrl}
              onUploadComplete={(filePath, previewUrl) => {
                setAvatarPath(filePath);
                setAvatarPreviewUrl(previewUrl);
              }}
            />
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-bold">Hosting</div>
              <div className="mt-2 text-sm leading-6 text-neutral-600">
                Apply to become a host, continue your setup, or open your host dashboard.
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <span
                className={[
                  'rounded-full px-3 py-1 text-xs font-bold',
                  hostApplicationStatus === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : hostApplicationStatus === 'under_review'
                      ? 'bg-amber-100 text-amber-800'
                      : hostApplicationStatus === 'in_progress'
                        ? 'bg-sky-100 text-sky-800'
                        : hostApplicationStatus === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-neutral-200 text-neutral-700',
                ].join(' ')}
              >
                {hostStatusLabel(hostApplicationStatus)}
              </span>

              <button
                type="button"
                onClick={() => router.push('/host')}
                className="inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {hostButtonLabel(hostApplicationStatus)}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            {hostApplicationStatus === 'not_applied' && (
              <span>
                Anyone can start as a member and apply later. When you are ready, open the host area to begin.
              </span>
            )}

            {hostApplicationStatus === 'in_progress' && (
              <span>
                Your host setup has started. Finish your readiness checklist and continue from the host area.
              </span>
            )}

            {hostApplicationStatus === 'under_review' && (
              <span>
                Your host application is under review right now. You can open the host area to check your status.
              </span>
            )}

            {hostApplicationStatus === 'approved' && (
              <span>
                You are approved as a host. Open your host dashboard to manage your hosting setup.
              </span>
            )}

            {hostApplicationStatus === 'rejected' && (
              <span>
                Your application needs updates before approval. Open the host area to see what needs to be fixed.
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Discovery</div>

          <div className="mt-2 text-sm leading-6 text-neutral-600">
            When ON: approved hosts can find you and message you first.
            <br />
            When OFF: you can still message hosts, but hosts cannot initiate with you.
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveDiscovery(!discoverable)}
              disabled={savingDiscovery}
              className={[
                'inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
                discoverable
                  ? 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100'
                  : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                savingDiscovery ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              {savingDiscovery
                ? 'Saving...'
                : discoverable
                  ? 'Turn OFF Discovery'
                  : 'Turn ON Discovery'}
            </button>

            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-bold',
                discoverable
                  ? 'bg-green-100 text-green-800'
                  : 'bg-neutral-200 text-neutral-700',
              ].join(' ')}
            >
              {discoverable ? 'Discovery ON' : 'Discovery OFF'}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">
            {roleLabel === 'host' ? 'Available for' : 'Conversation mode'}
          </div>

          <div className="mt-2 text-sm leading-6 text-neutral-600">
            Choose how you want to be discovered right now. You can switch this anytime.
            {roleLabel === 'host'
              ? ' Members will see you based on the conversation style you are currently open to.'
              : ' Hosts will be able to find you based on this selection.'}
          </div>

          <div className="mt-4 grid gap-3">
            {CHAT_MODE_OPTIONS.map((option) => {
              const selected = chatMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void saveChatMode(option.value)}
                  disabled={savingChatMode}
                  className={[
                    'w-full rounded-2xl border px-4 py-4 text-left transition',
                    selected
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50',
                    savingChatMode ? 'cursor-not-allowed opacity-70' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold sm:text-base">{option.label}</div>
                      <div
                        className={[
                          'mt-1 text-xs sm:text-sm',
                          selected ? 'text-white/80' : 'text-neutral-500',
                        ].join(' ')}
                      >
                        {option.description}
                      </div>
                    </div>

                    <div
                      className={[
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                        selected
                          ? 'bg-white text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600',
                      ].join(' ')}
                    >
                      {selected ? 'Selected' : 'Choose'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            Current mode:{' '}
            <span className="font-bold text-neutral-800">
              {CHAT_MODE_OPTIONS.find((option) => option.value === chatMode)?.label || 'Open to all'}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Hero</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            This is the fast first impression people get right away.
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">Age</label>
              <input
                type="number"
                min="18"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="28"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-semibold text-neutral-900">Interested in</label>
            <p className="mt-1 text-xs text-neutral-500">
              Choose who you are open to connecting with.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {INTERESTED_IN_OPTIONS.map((option) => {
                const selected = interestedIn.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleInterestedIn(option)}
                    className={[
                      'rounded-full border px-4 py-2 text-sm font-semibold transition',
                      selected
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Relationship goal
              </label>
              <select
                value={relationshipGoal}
                onChange={(e) => setRelationshipGoal(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select a goal</option>
                {RELATIONSHIP_GOAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">Wants kids</label>
              <select
                value={wantsKids}
                onChange={(e) => setWantsKids(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select one</option>
                {WANTS_KIDS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-semibold text-neutral-900">Has kids</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Yes', 'No'].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setHasKids(hasKids === option ? '' : option)}
                  className={[
                    'rounded-full border px-4 py-2 text-sm font-semibold transition',
                    hasKids === option
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-semibold text-neutral-900">Headline</label>
            <p className="mt-1 text-xs text-neutral-500">
              A fast first impression shown near the top of your profile.
            </p>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value.slice(0, 90))}
              className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              placeholder="Warm, playful chats with real connection."
            />
            <div className="mt-1 text-right text-xs text-neutral-500">{headlineCount}/90</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Fast personality snapshot</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            These answers help people understand who you are quickly.
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Describe yourself in three words
              </label>
              <input
                type="text"
                value={threeWords}
                onChange={(e) => setThreeWords(e.target.value.slice(0, 40))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Playful, loyal, curious"
              />
              <div className="mt-1 text-right text-xs text-neutral-500">{threeWordsCount}/40</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Something people always notice about me
              </label>
              <input
                type="text"
                value={peopleNotice}
                onChange={(e) => setPeopleNotice(e.target.value.slice(0, 120))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="My laugh and how easy I am to talk to."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {peopleNoticeCount}/120
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Something I’m proud of
              </label>
              <input
                type="text"
                value={proudOf}
                onChange={(e) => setProudOf(e.target.value.slice(0, 140))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="How much I’ve grown over the last few years."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">{proudOfCount}/140</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                My biggest strength
              </label>
              <input
                type="text"
                value={biggestStrength}
                onChange={(e) => setBiggestStrength(e.target.value.slice(0, 120))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="I make people feel comfortable fast."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {biggestStrengthCount}/120
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Conversation energy</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            This is one of the most important parts of LoveF8. Help people imagine the conversation.
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">Short bio</label>
              <p className="mt-1 text-xs text-neutral-500">
                1–2 lines that quickly show your vibe.
              </p>
              <textarea
                value={shortBio}
                onChange={(e) => setShortBio(e.target.value.slice(0, 140))}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Playful energy, easy conversation, and a good listener."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">{shortBioCount}/140</div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">About me</label>
              <textarea
                value={aboutLong}
                onChange={(e) => setAboutLong(e.target.value.slice(0, 700))}
                rows={6}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Tell people a little more about your personality, energy, and what kind of connection they can expect."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {aboutLongCount}/700
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                What I enjoy talking about
              </label>
              <textarea
                value={talkTopics}
                onChange={(e) => setTalkTopics(e.target.value.slice(0, 500))}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Late-night talks, relationships, life goals, music, movies, travel, and everyday real-life conversation."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {talkTopicsCount}/500
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">My style / vibe</label>
              <textarea
                value={styleVibe}
                onChange={(e) => setStyleVibe(e.target.value.slice(0, 300))}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Sweet, attentive, playful, calm, and easy to talk to."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {styleVibeCount}/300
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">Best at</label>
                <input
                  type="text"
                  value={bestAt}
                  onChange={(e) => setBestAt(e.target.value.slice(0, 60))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder="Making you laugh"
                />
                <div className="mt-1 text-right text-xs text-neutral-500">{bestAtCount}/60</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">Looking for</label>
                <input
                  type="text"
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value.slice(0, 60))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder="Meaningful chats and real chemistry"
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {lookingForCount}/60
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Life compatibility</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            Quick scan details that help people understand your lifestyle.
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">Drink</label>
              <select
                value={drink}
                onChange={(e) => setDrink(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select one</option>
                {DRINK_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">Smoke</label>
              <select
                value={smoke}
                onChange={(e) => setSmoke(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select one</option>
                {SMOKE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">Exercise</label>
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select one</option>
                {EXERCISE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">Pets</label>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPets(pets === option ? '' : option)}
                    className={[
                      'rounded-full border px-4 py-2 text-sm font-semibold transition',
                      pets === option
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Morning or night
              </label>
              <select
                value={morningOrNight}
                onChange={(e) => setMorningOrNight(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select one</option>
                {MORNING_NIGHT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-neutral-900">
                Open to long-distance
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setLongDistanceOpen(longDistanceOpen === option ? '' : option)
                    }
                    className={[
                      'rounded-full border px-4 py-2 text-sm font-semibold transition',
                      longDistanceOpen === option
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Values</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            These answers help people understand what matters to you deeper down.
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                What matters most to me
              </label>
              <textarea
                value={whatMatters}
                onChange={(e) => setWhatMatters(e.target.value.slice(0, 220))}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Consistency, honesty, kindness, and emotional maturity."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {whatMattersCount}/220
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                A value I won’t compromise on
              </label>
              <textarea
                value={nonNegotiable}
                onChange={(e) => setNonNegotiable(e.target.value.slice(0, 180))}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Respect and honesty."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {nonNegotiableCount}/180
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                A healthy relationship looks like
              </label>
              <textarea
                value={healthyRelationship}
                onChange={(e) => setHealthyRelationship(e.target.value.slice(0, 220))}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Mutual effort, trust, honesty, laughter, and feeling safe to be yourself."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {healthyRelationshipCount}/220
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Fun human stuff</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            These make your profile memorable without making it feel fake.
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Hidden talent
              </label>
              <input
                type="text"
                value={hiddenTalent}
                onChange={(e) => setHiddenTalent(e.target.value.slice(0, 140))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="I can name songs in the first five seconds."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {hiddenTalentCount}/140
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Controversial opinion
              </label>
              <input
                type="text"
                value={controversialOpinion}
                onChange={(e) => setControversialOpinion(e.target.value.slice(0, 140))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Breakfast food is better at night."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {controversialOpinionCount}/140
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Simple pleasures
              </label>
              <input
                type="text"
                value={simplePleasures}
                onChange={(e) => setSimplePleasures(e.target.value.slice(0, 140))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Coffee, music in the car, and quiet late nights."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {simplePleasuresCount}/140
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Two truths and a lie
              </label>
              <textarea
                value={twoTruthsLie}
                onChange={(e) => setTwoTruthsLie(e.target.value.slice(0, 220))}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="I’ve been skydiving, I hate pizza, and I can drive stick."
              />
              <div className="mt-1 text-right text-xs text-neutral-500">
                {twoTruthsLieCount}/220
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Scan details</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            These help people understand your style quickly.
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">Tags</label>
              <p className="mt-1 text-xs text-neutral-500">
                Separate with commas. Keep it short. Up to 8 tags.
              </p>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                placeholder="Warm, Funny, Listener, Curious"
              />

              {parsedTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {parsedTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

<div className="grid gap-5 sm:grid-cols-2">
  <div>
    <label className="block text-sm font-semibold text-neutral-900">Location</label>
    <input
      type="text"
      value={locationText}
      onChange={(e) => setLocationText(e.target.value.slice(0, 80))}
      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
      placeholder="Las Vegas, Nevada"
    />
  </div>

  <div>
    <label className="block text-sm font-semibold text-neutral-900">Country</label>
    <select
      value={countryOrigin}
      onChange={(e) => setCountryOrigin(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
    >
      <option value="">Select country</option>

      {[
        "Argentina","Australia","Austria","Bangladesh","Belgium","Bolivia","Botswana","Brazil","Bulgaria",
        "Cambodia","Canada","Chile","China","Colombia","Croatia","Cyprus","Czech Republic",
        "Denmark","Ecuador","Estonia",
        "Finland","France",
        "Germany","Ghana","Greece",
        "Hungary",
        "Iceland","India","Indonesia","Ireland","Israel","Italy",
        "Japan",
        "Kenya","Kuwait",
        "Laos","Latvia","Lithuania","Luxembourg",
        "Malaysia","Malta","Mexico","Mongolia","Morocco",
        "Namibia","Nepal","Netherlands","New Zealand","Nigeria","Norway",
        "Paraguay","Peru","Philippines","Poland","Portugal",
        "Qatar",
        "Romania","Rwanda",
        "Saudi Arabia","Senegal","Singapore","Slovakia","Slovenia","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland",
        "Taiwan","Tanzania","Thailand","Tunisia","Turkey",
        "Uganda","United Arab Emirates","United Kingdom","United States","Uruguay",
        "Vietnam",
        "Zambia"
      ]
        .sort((a, b) => a.localeCompare(b))
        .map((country) => (
          <option key={country} value={country}>
            {country}
          </option>
        ))}
    </select>
  </div>

  <div>
    <label className="block text-sm font-semibold text-neutral-900">Region</label>
    <select
      value={regionOrigin}
      onChange={(e) => setRegionOrigin(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
    >
      <option value="">Select region</option>
      <option value="North America">North America</option>
      <option value="South America">South America</option>
      <option value="Europe">Europe</option>
      <option value="Africa">Africa</option>
      <option value="Asia">Asia</option>
      <option value="Oceania">Oceania</option>
      <option value="Caribbean">Caribbean</option>
      <option value="Central America">Central America</option>
      <option value="Middle East">Middle East</option>
    </select>
  </div>

  <div>
    <label className="block text-sm font-semibold text-neutral-900">Timezone</label>
    <input
      type="text"
      value={timezone}
      onChange={(e) => setTimezone(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
      placeholder="America/Chicago"
    />
    <div className="mt-1 text-xs text-neutral-500">
      Example: America/Chicago, Asia/Manila, Europe/London
    </div>
  </div>
</div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  Normally online from
                </label>
                <input
                  type="time"
                  value={normallyOnlineStart}
                  onChange={(e) => setNormallyOnlineStart(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  Normally online until
                </label>
                <input
                  type="time"
                  value={normallyOnlineEnd}
                  onChange={(e) => setNormallyOnlineEnd(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold">Payout Settings</div>
          <div className="mt-2 text-sm leading-6 text-neutral-600">
            Add where you want to receive your host earnings.
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                Payout Method
              </label>
              <select
                value={payoutMethod}
                onChange={(e) => {
  const nextMethod = e.target.value;
  setPayoutMethod(nextMethod);
  setPayoutDetails('');
}}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              >
                <option value="">Select method</option>
                <option value="paypal">PayPal</option>
                <option value="gcash">GCash</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900">
                {payoutDetailsLabel}
              </label>
              <input
                type="text"
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder={payoutDetailsPlaceholder}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
              />
              <div className="mt-2 text-xs text-neutral-500">{payoutDetailsHelp}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-semibold text-neutral-900">Profile guidance</div>
          <ul className="mt-2 space-y-1 text-sm text-neutral-600">
            <li>Make the top of your profile feel warm and clear fast.</li>
            <li>Keep your answers human, not corporate.</li>
            <li>The best profiles make people want to ask a question.</li>
            <li>Use short answers for quick scan and longer answers for depth.</li>
            <li>Photos + conversation energy are your biggest first impression.</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveProfileContent()}
            disabled={savingProfile}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingProfile ? 'Saving profile...' : 'Save profile'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/messages')}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            Back to Messages
          </button>
        </div>
      </div>
    </main>
  );
}