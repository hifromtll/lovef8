'use client';

import { useEffect, useMemo, useState } from 'react';
import { translateProfileField } from '../utils/translateProfileField';
import type { ProfilePreviewData } from '../types';

type ProfilePreviewModalProps = {
  open: boolean;
  onClose: () => void;
  profile: ProfilePreviewData | null;
  viewerTimezone?: string | null;
  targetLanguage?: string | null;
};

type UiLabels = {
  profilePreview: string;
  close: string;
  availability: string;
  shortBio: string;
  tags: string;
  aboutMe: string;
  talkTopics: string;
  styleVibe: string;
  bestAt: string;
  lookingFor: string;
  threeWords: string;
  peopleNotice: string;
  proudOf: string;
  biggestStrength: string;
  lifeCompatibility: string;
  values: string;
  whatMatters: string;
  nonNegotiable: string;
  healthyRelationship: string;
  funHumanStuff: string;
  hiddenTalent: string;
  controversialOpinion: string;
  simplePleasures: string;
  twoTruthsLie: string;
  comingNext: string;
  noDetails: string;
  chatMode: string;
  age: string;
  gender: string;
  interestedIn: string;
  goal: string;
  timezone: string;
  photos: string;
  hasKids: string;
  wantsKids: string;
  drink: string;
  smoke: string;
  exercise: string;
  pets: string;
  morningNight: string;
  longDistance: string;
  normallyOnline: string;
};

type TranslatedValues = {
  roleLine: string;
  chatMode: string;
  gender: string;
  interestedIn: string;
  goal: string;
  hasKids: string;
  wantsKids: string;
  drink: string;
  smoke: string;
  exercise: string;
  pets: string;
  morningNight: string;
  longDistance: string;
};

const DEFAULT_LABELS: UiLabels = {
  profilePreview: 'Profile Preview',
  close: 'Close',
  availability: 'Availability',
  shortBio: 'Short Bio',
  tags: 'Tags',
  aboutMe: 'About Me',
  talkTopics: 'What I Enjoy Talking About',
  styleVibe: 'My Style / Vibe',
  bestAt: 'Best At',
  lookingFor: 'Looking For',
  threeWords: 'Three Words',
  peopleNotice: 'Something People Notice',
  proudOf: 'Something I’m Proud Of',
  biggestStrength: 'My Biggest Strength',
  lifeCompatibility: 'Life Compatibility',
  values: 'Values',
  whatMatters: 'What Matters Most',
  nonNegotiable: 'Non-Negotiable',
  healthyRelationship: 'A Healthy Relationship Looks Like',
  funHumanStuff: 'Fun Human Stuff',
  hiddenTalent: 'Hidden Talent',
  controversialOpinion: 'Controversial Opinion',
  simplePleasures: 'Simple Pleasures',
  twoTruthsLie: 'Two Truths and a Lie',
  comingNext: 'Coming Next',
  noDetails: 'This profile has not added bio details yet.',
  chatMode: 'Chat Mode',
  age: 'Age',
  gender: 'Gender',
  interestedIn: 'Interested In',
  goal: 'Goal',
  timezone: 'Timezone',
  photos: 'Photos',
  hasKids: 'Has Kids',
  wantsKids: 'Wants Kids',
  drink: 'Drink',
  smoke: 'Smoke',
  exercise: 'Exercise',
  pets: 'Pets',
  morningNight: 'Morning/Night',
  longDistance: 'Long Distance',
  normallyOnline: 'Normally online',
};

function prettyChatMode(value: string | null | undefined) {
  if (!value) return 'Not set';

  switch (value) {
    case 'chatty':
      return 'Chatty';
    case 'flirty':
      return 'Flirty';
    case 'romantic':
      return 'Romantic';
    case 'open_all':
      return 'Open to All';
    default:
      return value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function getRoleLine(profile: ProfilePreviewData | null) {
  if (!profile) return '';

  if (profile.is_system_host) return 'System Host';
  if (profile.role === 'host') return 'Host';
  return 'Member';
}

function getInitial(username: string | null | undefined) {
  if (!username) return '?';
  return username.trim().charAt(0).toUpperCase();
}

function cleanTags(tags: string[] | null | undefined) {
  const raw = (tags || [])
    .filter(Boolean)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const splitTags: string[] = [];

  for (const tag of raw) {
    if (tag.includes(',')) {
      splitTags.push(
        ...tag
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      );
    } else {
      splitTags.push(tag);
    }
  }

  return splitTags.slice(0, 8);
}

function parseTimeParts(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.slice(0, 5);
  const [hourText, minuteText] = normalized.split(':');

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function formatOnlineWindowForViewer(
  start: string | null | undefined,
  end: string | null | undefined,
  sourceTimezone: string | null | undefined,
  viewerTimezone: string | null | undefined
) {
  if (!start || !end || !sourceTimezone || !viewerTimezone) return null;

  const startParts = parseTimeParts(start);
  const endParts = parseTimeParts(end);

  if (!startParts || !endParts) return null;

  try {
    const anchor = new Date('2024-01-01T00:00:00Z');

    const sourceDateText = new Intl.DateTimeFormat('en-CA', {
      timeZone: sourceTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(anchor);

    const [yearText, monthText, dayText] = sourceDateText.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    const makeUtcFromSourceLocal = (hour: number, minute: number) => {
      const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

      const asSource = new Date(
        utcGuess.toLocaleString('en-US', { timeZone: sourceTimezone })
      );

      const offsetMs =
        Date.UTC(
          asSource.getFullYear(),
          asSource.getMonth(),
          asSource.getDate(),
          asSource.getHours(),
          asSource.getMinutes(),
          asSource.getSeconds()
        ) - utcGuess.getTime();

      return new Date(utcGuess.getTime() - offsetMs);
    };

    const startUtc = makeUtcFromSourceLocal(startParts.hour, startParts.minute);
    const endUtc = makeUtcFromSourceLocal(endParts.hour, endParts.minute);

    const startLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTimezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(startUtc);

    const endLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTimezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(endUtc);

    if (viewerTimezone === sourceTimezone) {
      return `${startLabel}–${endLabel}`;
    }

    return `${startLabel}–${endLabel} your time`;
  } catch {
    return null;
  }
}

function cleanPhotoUrls(profile: ProfilePreviewData | null) {
  if (!profile) return [];

  const raw = [
    ...(profile.photo_urls || []),
    profile.avatarUrl || null,
    profile.avatar_url || null,
  ];

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of raw) {
    if (!value || !value.trim()) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    cleaned.push(value);
  }

  return cleaned;
}

function yesNo(value: boolean | null | undefined) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

function joinValues(values: string[] | null | undefined) {
  if (!values || values.length === 0) return '';
  return values.join(', ');
}

function normalizeTargetLanguage(value: string | null | undefined) {
  const raw = (value || '').trim();
  if (!raw) return null;

  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/i.test(raw)) {
    return raw;
  }

  try {
    const base = raw.split('-')[0].toLowerCase();
    const display = new Intl.DisplayNames(['en'], { type: 'language' }).of(base);
    return display || raw;
  } catch {
    return raw;
  }
}

const profileTranslationCache = new Map<string, string>();

function buildProfileCacheKey(text: string, targetLanguage: string) {
  return `lovef8-profile::${targetLanguage}::${text}`;
}

async function translateUiText(
  text: string,
  targetLanguage: string | null | undefined
): Promise<string> {
  const normalizedTarget = normalizeTargetLanguage(targetLanguage);

  if (!text || !normalizedTarget) return text;
  if (normalizedTarget.toLowerCase() === 'english') return text;

  const cacheKey = buildProfileCacheKey(text, normalizedTarget);

  if (profileTranslationCache.has(cacheKey)) {
    return profileTranslationCache.get(cacheKey)!;
  }

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      profileTranslationCache.set(cacheKey, stored);
      return stored;
    }
  }

  try {
    const res = await fetch('/api/translate-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLanguage: normalizedTarget,
      }),
    });

    if (!res.ok) return text;

    const json = await res.json();
    const translated =
      typeof json?.translated === 'string' && json.translated.trim()
        ? json.translated.trim()
        : text;

    profileTranslationCache.set(cacheKey, translated);

    if (typeof window !== 'undefined') {
      localStorage.setItem(cacheKey, translated);
    }

    return translated;
  } catch {
    return text;
  }
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function Badge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value) return null;

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
      {label}: {value}
    </div>
  );
}

export default function ProfilePreviewModal({
  open,
  onClose,
  profile,
  viewerTimezone = null,
  targetLanguage = null,
}: ProfilePreviewModalProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const [uiLabels, setUiLabels] = useState<UiLabels>(DEFAULT_LABELS);
  const [translatedValues, setTranslatedValues] = useState<TranslatedValues>({
    roleLine: '',
    chatMode: '',
    gender: '',
    interestedIn: '',
    goal: '',
    hasKids: '',
    wantsKids: '',
    drink: '',
    smoke: '',
    exercise: '',
    pets: '',
    morningNight: '',
    longDistance: '',
  });
  const [translatedTags, setTranslatedTags] = useState<string[]>([]);

  const photos = useMemo(() => cleanPhotoUrls(profile), [profile]);
  const normalizedTargetLanguage = useMemo(
    () => normalizeTargetLanguage(targetLanguage),
    [targetLanguage]
  );

  useEffect(() => {
    setSelectedPhotoIndex(0);
  }, [profile?.id, open]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!normalizedTargetLanguage || normalizedTargetLanguage.toLowerCase() === 'english') {
        setUiLabels(DEFAULT_LABELS);
        return;
      }

      const entries = Object.entries(DEFAULT_LABELS) as Array<[keyof UiLabels, string]>;
      const translatedEntries = await Promise.all(
        entries.map(async ([key, value]) => {
          const translatedValue = await translateUiText(value, normalizedTargetLanguage);
          return [key, translatedValue] as const;
        })
      );

      if (cancelled) return;

      setUiLabels(
        translatedEntries.reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as UiLabels)
      );
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [normalizedTargetLanguage]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!profile) {
        setTranslatedValues({
          roleLine: '',
          chatMode: '',
          gender: '',
          interestedIn: '',
          goal: '',
          hasKids: '',
          wantsKids: '',
          drink: '',
          smoke: '',
          exercise: '',
          pets: '',
          morningNight: '',
          longDistance: '',
        });
        return;
      }

      const rawRoleLine = getRoleLine(profile);
      const rawChatMode = prettyChatMode(profile.chat_mode);
      const rawGender = profile.gender || '';
      const rawInterestedIn = joinValues(profile.interested_in);
      const rawGoal = profile.relationship_goal || '';
      const rawHasKids = yesNo(profile.has_kids);
      const rawWantsKids = profile.wants_kids || '';
      const rawDrink = profile.drink || '';
      const rawSmoke = profile.smoke || '';
      const rawExercise = profile.exercise || '';
      const rawPets = yesNo(profile.pets);
      const rawMorningNight = profile.morning_or_night || '';
      const rawLongDistance = yesNo(profile.long_distance_open);

      if (!normalizedTargetLanguage || normalizedTargetLanguage.toLowerCase() === 'english') {
        setTranslatedValues({
          roleLine: rawRoleLine,
          chatMode: rawChatMode,
          gender: rawGender,
          interestedIn: rawInterestedIn,
          goal: rawGoal,
          hasKids: rawHasKids,
          wantsKids: rawWantsKids,
          drink: rawDrink,
          smoke: rawSmoke,
          exercise: rawExercise,
          pets: rawPets,
          morningNight: rawMorningNight,
          longDistance: rawLongDistance,
        });
        return;
      }

      const [
        roleLine,
        chatMode,
        gender,
        interestedIn,
        goal,
        hasKids,
        wantsKids,
        drink,
        smoke,
        exercise,
        pets,
        morningNight,
        longDistance,
      ] = await Promise.all([
        translateUiText(rawRoleLine, normalizedTargetLanguage),
        translateUiText(rawChatMode, normalizedTargetLanguage),
        translateUiText(rawGender, normalizedTargetLanguage),
        translateUiText(rawInterestedIn, normalizedTargetLanguage),
        translateUiText(rawGoal, normalizedTargetLanguage),
        translateUiText(rawHasKids, normalizedTargetLanguage),
        translateUiText(rawWantsKids, normalizedTargetLanguage),
        translateUiText(rawDrink, normalizedTargetLanguage),
        translateUiText(rawSmoke, normalizedTargetLanguage),
        translateUiText(rawExercise, normalizedTargetLanguage),
        translateUiText(rawPets, normalizedTargetLanguage),
        translateUiText(rawMorningNight, normalizedTargetLanguage),
        translateUiText(rawLongDistance, normalizedTargetLanguage),
      ]);

      if (cancelled) return;

      setTranslatedValues({
        roleLine,
        chatMode,
        gender,
        interestedIn,
        goal,
        hasKids,
        wantsKids,
        drink,
        smoke,
        exercise,
        pets,
        morningNight,
        longDistance,
      });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [normalizedTargetLanguage, profile]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const rawTags = cleanTags(profile?.profile_tags);

      if (rawTags.length === 0) {
        setTranslatedTags([]);
        return;
      }

      if (!normalizedTargetLanguage || normalizedTargetLanguage.toLowerCase() === 'english') {
        setTranslatedTags(rawTags);
        return;
      }

      const nextTags = await Promise.all(
        rawTags.map((tag) => translateUiText(tag, normalizedTargetLanguage))
      );

      if (cancelled) return;
      setTranslatedTags(nextTags);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [normalizedTargetLanguage, profile]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!profile || !normalizedTargetLanguage) {
        setTranslated({});
        return;
      }

      if (normalizedTargetLanguage.toLowerCase() === 'english') {
        setTranslated({});
        return;
      }

      const [
        short_bio,
        about_long,
        talk_topics,
        best_at,
        looking_for,
        style_vibe,
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
        location_text,
      ] = await Promise.all([
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'short_bio',
          originalText: profile.short_bio || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'about_long',
          originalText: profile.about_long || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'talk_topics',
          originalText: profile.talk_topics || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'best_at',
          originalText: profile.best_at || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'looking_for',
          originalText: profile.looking_for || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'style_vibe',
          originalText: profile.style_vibe || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'three_words',
          originalText: profile.three_words || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'people_notice',
          originalText: profile.people_notice || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'proud_of',
          originalText: profile.proud_of || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'biggest_strength',
          originalText: profile.biggest_strength || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'what_matters',
          originalText: profile.what_matters || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'non_negotiable',
          originalText: profile.non_negotiable || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'healthy_relationship',
          originalText: profile.healthy_relationship || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'hidden_talent',
          originalText: profile.hidden_talent || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'controversial_opinion',
          originalText: profile.controversial_opinion || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'simple_pleasures',
          originalText: profile.simple_pleasures || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'two_truths_lie',
          originalText: profile.two_truths_lie || '',
          targetLanguage: normalizedTargetLanguage,
        }),
        translateProfileField({
          profileId: profile.id,
          fieldKey: 'location_text',
          originalText: profile.location_text || '',
          targetLanguage: normalizedTargetLanguage,
        }),
      ]);

      if (cancelled) return;

      setTranslated({
        short_bio,
        about_long,
        talk_topics,
        best_at,
        looking_for,
        style_vibe,
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
        location_text,
      });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [normalizedTargetLanguage, profile]);

  if (!open || !profile) return null;

  const username = profile.username || 'Unknown user';
  const roleLine = translatedValues.roleLine || getRoleLine(profile);
  const chatMode = translatedValues.chatMode || prettyChatMode(profile.chat_mode);
  const tags = translatedTags.length > 0 ? translatedTags : cleanTags(profile.profile_tags);

  const headline = profile.headline?.trim() || '';
  const shortBio = translated.short_bio || profile.short_bio?.trim() || '';
  const aboutLong = translated.about_long || profile.about_long?.trim() || '';
  const talkTopics = translated.talk_topics || profile.talk_topics?.trim() || '';
  const styleVibe = translated.style_vibe || profile.style_vibe?.trim() || '';
  const bestAt = translated.best_at || profile.best_at?.trim() || '';
  const lookingFor = translated.looking_for || profile.looking_for?.trim() || '';
  const locationText = translated.location_text || profile.location_text?.trim() || '';
  const selectedPhoto = photos[selectedPhotoIndex] || null;

  const ageLabel =
    typeof profile.age === 'number' && Number.isFinite(profile.age)
      ? String(profile.age)
      : '';

  const interestedInLabel =
    translatedValues.interestedIn || joinValues(profile.interested_in);
  const hasKidsLabel = translatedValues.hasKids || yesNo(profile.has_kids);
  const petsLabel = translatedValues.pets || yesNo(profile.pets);
  const longDistanceLabel =
    translatedValues.longDistance || yesNo(profile.long_distance_open);

  const onlineWindowLabel = formatOnlineWindowForViewer(
    profile.normally_online_start ?? null,
    profile.normally_online_end ?? null,
    profile.timezone ?? null,
    viewerTimezone ?? null
  );

  const timezoneLabel = profile.timezone?.trim() || '';

  const threeWords = translated.three_words || profile.three_words?.trim() || '';
  const peopleNotice =
    translated.people_notice || profile.people_notice?.trim() || '';
  const proudOf = translated.proud_of || profile.proud_of?.trim() || '';
  const biggestStrength =
    translated.biggest_strength || profile.biggest_strength?.trim() || '';

  const whatMatters = translated.what_matters || profile.what_matters?.trim() || '';
  const nonNegotiable =
    translated.non_negotiable || profile.non_negotiable?.trim() || '';
  const healthyRelationship =
    translated.healthy_relationship || profile.healthy_relationship?.trim() || '';

  const hiddenTalent =
    translated.hidden_talent || profile.hidden_talent?.trim() || '';
  const controversialOpinion =
    translated.controversial_opinion || profile.controversial_opinion?.trim() || '';
  const simplePleasures =
    translated.simple_pleasures || profile.simple_pleasures?.trim() || '';
  const twoTruthsLie =
    translated.two_truths_lie || profile.two_truths_lie?.trim() || '';

  const hasAnyContent =
    !!headline ||
    !!shortBio ||
    !!aboutLong ||
    !!talkTopics ||
    !!styleVibe ||
    !!bestAt ||
    !!lookingFor ||
    !!locationText ||
    !!timezoneLabel ||
    !!onlineWindowLabel ||
    !!ageLabel ||
    !!profile.gender ||
    !!interestedInLabel ||
    !!profile.relationship_goal ||
    !!hasKidsLabel ||
    !!profile.wants_kids ||
    !!profile.drink ||
    !!profile.smoke ||
    !!profile.exercise ||
    !!petsLabel ||
    !!profile.morning_or_night ||
    !!longDistanceLabel ||
    !!threeWords ||
    !!peopleNotice ||
    !!proudOf ||
    !!biggestStrength ||
    !!whatMatters ||
    !!nonNegotiable ||
    !!healthyRelationship ||
    !!hiddenTalent ||
    !!controversialOpinion ||
    !!simplePleasures ||
    !!twoTruthsLie ||
    tags.length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">
            {uiLabels.profilePreview}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            {uiLabels.close}
          </button>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="min-w-0">
              {selectedPhoto ? (
                <img
                  src={selectedPhoto}
                  alt={username}
                  className="h-[360px] w-full rounded-3xl object-cover ring-4 ring-white/10"
                />
              ) : (
                <div className="flex h-[360px] w-full items-center justify-center rounded-3xl bg-zinc-800 text-7xl font-bold text-white ring-4 ring-white/10">
                  {getInitial(username)}
                </div>
              )}

              {photos.length > 1 && (
                <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                  {photos.map((photo, index) => {
                    const isActive = index === selectedPhotoIndex;

                    return (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        onClick={() => setSelectedPhotoIndex(index)}
                        className={`shrink-0 overflow-hidden rounded-2xl border transition ${
                          isActive
                            ? 'border-white/50 ring-2 ring-white/30'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                      >
                        <img
                          src={photo}
                          alt={`${username} photo ${index + 1}`}
                          className="h-20 w-20 object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-4xl font-semibold text-white">{username}</div>
              <div className="mt-1 text-sm text-zinc-400">{roleLine}</div>

              {headline && (
                <div className="mt-4 text-lg font-medium leading-7 text-zinc-100">
                  {headline}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <Badge label={uiLabels.chatMode} value={chatMode} />
                <Badge label={uiLabels.age} value={ageLabel} />
                <Badge
                  label={uiLabels.gender}
                  value={translatedValues.gender || profile.gender || ''}
                />
                <Badge label={uiLabels.interestedIn} value={interestedInLabel} />
                <Badge
                  label={uiLabels.goal}
                  value={translatedValues.goal || profile.relationship_goal || ''}
                />
                <Badge label={uiLabels.timezone} value={timezoneLabel} />
                {photos.length > 0 && (
                  <Badge label={uiLabels.photos} value={String(photos.length)} />
                )}
              </div>

              {(locationText || onlineWindowLabel) && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {uiLabels.availability}
                  </div>

                  {locationText && (
                    <div className="mt-2 text-sm leading-6 text-zinc-200">
                      {locationText}
                    </div>
                  )}

                  {onlineWindowLabel && (
                    <div className="mt-2 text-sm leading-6 text-zinc-200">
                      {uiLabels.normallyOnline}: {onlineWindowLabel}
                    </div>
                  )}
                </div>
              )}

              {shortBio && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {uiLabels.shortBio}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                    {shortBio}
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {uiLabels.tags}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {aboutLong && <InfoCard label={uiLabels.aboutMe} value={aboutLong} />}
                {talkTopics && (
                  <InfoCard label={uiLabels.talkTopics} value={talkTopics} />
                )}
                {styleVibe && (
                  <InfoCard label={uiLabels.styleVibe} value={styleVibe} />
                )}
                {bestAt && <InfoCard label={uiLabels.bestAt} value={bestAt} />}
                {lookingFor && (
                  <InfoCard label={uiLabels.lookingFor} value={lookingFor} />
                )}
                {threeWords && (
                  <InfoCard label={uiLabels.threeWords} value={threeWords} />
                )}
                {peopleNotice && (
                  <InfoCard label={uiLabels.peopleNotice} value={peopleNotice} />
                )}
                {proudOf && <InfoCard label={uiLabels.proudOf} value={proudOf} />}
                {biggestStrength && (
                  <InfoCard label={uiLabels.biggestStrength} value={biggestStrength} />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            {(hasKidsLabel ||
              profile.wants_kids ||
              profile.drink ||
              profile.smoke ||
              profile.exercise ||
              petsLabel ||
              profile.morning_or_night ||
              longDistanceLabel) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-1">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {uiLabels.lifeCompatibility}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge label={uiLabels.hasKids} value={hasKidsLabel} />
                  <Badge
                    label={uiLabels.wantsKids}
                    value={translatedValues.wantsKids || profile.wants_kids || ''}
                  />
                  <Badge
                    label={uiLabels.drink}
                    value={translatedValues.drink || profile.drink || ''}
                  />
                  <Badge
                    label={uiLabels.smoke}
                    value={translatedValues.smoke || profile.smoke || ''}
                  />
                  <Badge
                    label={uiLabels.exercise}
                    value={translatedValues.exercise || profile.exercise || ''}
                  />
                  <Badge label={uiLabels.pets} value={petsLabel} />
                  <Badge
                    label={uiLabels.morningNight}
                    value={
                      translatedValues.morningNight || profile.morning_or_night || ''
                    }
                  />
                  <Badge label={uiLabels.longDistance} value={longDistanceLabel} />
                </div>
              </div>
            )}

            {(whatMatters || nonNegotiable || healthyRelationship) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-1">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {uiLabels.values}
                </div>
                <div className="mt-4 grid gap-3">
                  {whatMatters && (
                    <InfoCard label={uiLabels.whatMatters} value={whatMatters} />
                  )}
                  {nonNegotiable && (
                    <InfoCard label={uiLabels.nonNegotiable} value={nonNegotiable} />
                  )}
                  {healthyRelationship && (
                    <InfoCard
                      label={uiLabels.healthyRelationship}
                      value={healthyRelationship}
                    />
                  )}
                </div>
              </div>
            )}

            {(hiddenTalent ||
              controversialOpinion ||
              simplePleasures ||
              twoTruthsLie) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-1">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {uiLabels.funHumanStuff}
                </div>
                <div className="mt-4 grid gap-3">
                  {hiddenTalent && (
                    <InfoCard label={uiLabels.hiddenTalent} value={hiddenTalent} />
                  )}
                  {controversialOpinion && (
                    <InfoCard
                      label={uiLabels.controversialOpinion}
                      value={controversialOpinion}
                    />
                  )}
                  {simplePleasures && (
                    <InfoCard
                      label={uiLabels.simplePleasures}
                      value={simplePleasures}
                    />
                  )}
                  {twoTruthsLie && (
                    <InfoCard label={uiLabels.twoTruthsLie} value={twoTruthsLie} />
                  )}
                </div>
              </div>
            )}
          </div>

          {!hasAnyContent && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {uiLabels.comingNext}
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-300">
                {uiLabels.noDetails}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}