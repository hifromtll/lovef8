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
type BodyTypeOption =
  | 'Prefer not to say'
  | 'Slim'
  | 'Athletic'
  | 'Average'
  | 'Curvy'
  | 'Plus-size'
  | 'Muscular';
  
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
const BODY_TYPE_OPTIONS: BodyTypeOption[] = [
  'Prefer not to say',
  'Slim',
  'Athletic',
  'Average',
  'Curvy',
  'Plus-size',
  'Muscular',
];

const HEIGHT_OPTIONS = Array.from({ length: 49 }, (_, index) => {
  const inches = 48 + index;
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;

  return {
    value: inches,
    label: `${feet}'${remainingInches}"`,
  };
});

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Russian',
  'Ukrainian',
  'Polish',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Arabic',
  'Hebrew',
  'Turkish',
  'Hindi',
  'Bengali',
  'Punjabi',
  'Urdu',
  'Chinese (Mandarin)',
  'Japanese',
  'Korean',
  'Thai',
  'Vietnamese',
  'Indonesian',
  'Malay',
  'Tagalog',
  'Swahili',
  'Amharic',
  'Greek',
  'Czech',
  'Hungarian',
  'Romanian',
  'Bulgarian',
  'Slovak',
  'Croatian',
  'Serbian',
];

const COUNTRY_OPTIONS = [
  { name: 'Argentina', region: 'South America', timezone: 'America/Argentina/Buenos_Aires' },
  { name: 'Australia', region: 'Oceania', timezone: 'Australia/Sydney' },
  { name: 'Austria', region: 'Europe', timezone: 'Europe/Vienna' },
  { name: 'Bangladesh', region: 'Asia', timezone: 'Asia/Dhaka' },
  { name: 'Belgium', region: 'Europe', timezone: 'Europe/Brussels' },
  { name: 'Bolivia', region: 'South America', timezone: 'America/La_Paz' },
  { name: 'Botswana', region: 'Africa', timezone: 'Africa/Gaborone' },
  { name: 'Brazil', region: 'South America', timezone: 'America/Sao_Paulo' },
  { name: 'Bulgaria', region: 'Europe', timezone: 'Europe/Sofia' },
  { name: 'Cambodia', region: 'Asia', timezone: 'Asia/Phnom_Penh' },
  { name: 'Canada', region: 'North America', timezone: 'America/Toronto' },
  { name: 'Chile', region: 'South America', timezone: 'America/Santiago' },
  { name: 'China', region: 'Asia', timezone: 'Asia/Shanghai' },
  { name: 'Colombia', region: 'South America', timezone: 'America/Bogota' },
  { name: 'Croatia', region: 'Europe', timezone: 'Europe/Zagreb' },
  { name: 'Cyprus', region: 'Europe', timezone: 'Asia/Nicosia' },
  { name: 'Czech Republic', region: 'Europe', timezone: 'Europe/Prague' },
  { name: 'Denmark', region: 'Europe', timezone: 'Europe/Copenhagen' },
  { name: 'Ecuador', region: 'South America', timezone: 'America/Guayaquil' },
  { name: 'Estonia', region: 'Europe', timezone: 'Europe/Tallinn' },
  { name: 'Finland', region: 'Europe', timezone: 'Europe/Helsinki' },
  { name: 'France', region: 'Europe', timezone: 'Europe/Paris' },
  { name: 'Germany', region: 'Europe', timezone: 'Europe/Berlin' },
  { name: 'Ghana', region: 'Africa', timezone: 'Africa/Accra' },
  { name: 'Greece', region: 'Europe', timezone: 'Europe/Athens' },
  { name: 'Hungary', region: 'Europe', timezone: 'Europe/Budapest' },
  { name: 'Iceland', region: 'Europe', timezone: 'Atlantic/Reykjavik' },
  { name: 'India', region: 'Asia', timezone: 'Asia/Kolkata' },
  { name: 'Indonesia', region: 'Asia', timezone: 'Asia/Jakarta' },
  { name: 'Ireland', region: 'Europe', timezone: 'Europe/Dublin' },
  { name: 'Israel', region: 'Middle East', timezone: 'Asia/Jerusalem' },
  { name: 'Italy', region: 'Europe', timezone: 'Europe/Rome' },
  { name: 'Japan', region: 'Asia', timezone: 'Asia/Tokyo' },
  { name: 'Kenya', region: 'Africa', timezone: 'Africa/Nairobi' },
  { name: 'Kuwait', region: 'Middle East', timezone: 'Asia/Kuwait' },
  { name: 'Laos', region: 'Asia', timezone: 'Asia/Vientiane' },
  { name: 'Latvia', region: 'Europe', timezone: 'Europe/Riga' },
  { name: 'Lithuania', region: 'Europe', timezone: 'Europe/Vilnius' },
  { name: 'Luxembourg', region: 'Europe', timezone: 'Europe/Luxembourg' },
  { name: 'Malaysia', region: 'Asia', timezone: 'Asia/Kuala_Lumpur' },
  { name: 'Malta', region: 'Europe', timezone: 'Europe/Malta' },
  { name: 'Mexico', region: 'North America', timezone: 'America/Mexico_City' },
  { name: 'Mongolia', region: 'Asia', timezone: 'Asia/Ulaanbaatar' },
  { name: 'Morocco', region: 'Africa', timezone: 'Africa/Casablanca' },
  { name: 'Namibia', region: 'Africa', timezone: 'Africa/Windhoek' },
  { name: 'Nepal', region: 'Asia', timezone: 'Asia/Kathmandu' },
  { name: 'Netherlands', region: 'Europe', timezone: 'Europe/Amsterdam' },
  { name: 'New Zealand', region: 'Oceania', timezone: 'Pacific/Auckland' },
  { name: 'Nigeria', region: 'Africa', timezone: 'Africa/Lagos' },
  { name: 'Norway', region: 'Europe', timezone: 'Europe/Oslo' },
  { name: 'Paraguay', region: 'South America', timezone: 'America/Asuncion' },
  { name: 'Peru', region: 'South America', timezone: 'America/Lima' },
  { name: 'Philippines', region: 'Asia', timezone: 'Asia/Manila' },
  { name: 'Poland', region: 'Europe', timezone: 'Europe/Warsaw' },
  { name: 'Portugal', region: 'Europe', timezone: 'Europe/Lisbon' },
  { name: 'Qatar', region: 'Middle East', timezone: 'Asia/Qatar' },
  { name: 'Romania', region: 'Europe', timezone: 'Europe/Bucharest' },
  { name: 'Rwanda', region: 'Africa', timezone: 'Africa/Kigali' },
  { name: 'Saudi Arabia', region: 'Middle East', timezone: 'Asia/Riyadh' },
  { name: 'Senegal', region: 'Africa', timezone: 'Africa/Dakar' },
  { name: 'Singapore', region: 'Asia', timezone: 'Asia/Singapore' },
  { name: 'Slovakia', region: 'Europe', timezone: 'Europe/Bratislava' },
  { name: 'Slovenia', region: 'Europe', timezone: 'Europe/Ljubljana' },
  { name: 'South Africa', region: 'Africa', timezone: 'Africa/Johannesburg' },
  { name: 'South Korea', region: 'Asia', timezone: 'Asia/Seoul' },
  { name: 'Spain', region: 'Europe', timezone: 'Europe/Madrid' },
  { name: 'Sri Lanka', region: 'Asia', timezone: 'Asia/Colombo' },
  { name: 'Sweden', region: 'Europe', timezone: 'Europe/Stockholm' },
  { name: 'Switzerland', region: 'Europe', timezone: 'Europe/Zurich' },
  { name: 'Taiwan', region: 'Asia', timezone: 'Asia/Taipei' },
  { name: 'Tanzania', region: 'Africa', timezone: 'Africa/Dar_es_Salaam' },
  { name: 'Thailand', region: 'Asia', timezone: 'Asia/Bangkok' },
  { name: 'Tunisia', region: 'Africa', timezone: 'Africa/Tunis' },
  { name: 'Turkey', region: 'Middle East', timezone: 'Europe/Istanbul' },
  { name: 'Uganda', region: 'Africa', timezone: 'Africa/Kampala' },
  { name: 'United Arab Emirates', region: 'Middle East', timezone: 'Asia/Dubai' },
  { name: 'United Kingdom', region: 'Europe', timezone: 'Europe/London' },
  { name: 'United States', region: 'North America', timezone: 'America/Chicago' },
  { name: 'Uruguay', region: 'South America', timezone: 'America/Montevideo' },
  { name: 'Vietnam', region: 'Asia', timezone: 'Asia/Ho_Chi_Minh' },
  { name: 'Zambia', region: 'Africa', timezone: 'Africa/Lusaka' },
].sort((a, b) => a.name.localeCompare(b.name));

const REGION_OPTIONS = [
  'North America',
  'South America',
  'Europe',
  'Africa',
  'Asia',
  'Oceania',
  'Caribbean',
  'Central America',
  'Middle East',
];

const YES_NO_OPTIONS = ['Yes', 'No'] as const;

const STATIC_UI_TEXTS = [
  'Settings',
  'Manage how you appear in discovery and build a profile that feels real and easy to connect with.',
  'Save profile',
  'Saving...',
  'Back',
  'Loading...',

  'Hosting',
  'Apply to become a host, continue your setup, or open your host dashboard.',
  'Anyone can start as a member and apply later. When you are ready, open the host area to begin.',
  'Your host setup has started. Finish your readiness checklist and continue from the host area.',
  'Your host application is under review right now. You can open the host area to check your status.',
  'You are approved as a host. Open your host dashboard to manage your hosting setup.',
  'Your application needs updates before approval. Open the host area to see what needs to be fixed.',

  'Discovery',
  'When ON: approved hosts can find you and message you first. When OFF: you can still message hosts, but hosts cannot initiate with you.',
  'Turn OFF Discovery',
  'Turn ON Discovery',
  'Discovery ON',
  'Discovery OFF',

  'Languages',
  'Select the languages you speak.',
  'Selected',
  'Tap',

  'Available for',
  'Conversation mode',
  'Choose how you want to be discovered right now. Members will see you based on the conversation style you are currently open to.',
  'Choose how you want to be discovered right now. Hosts will be able to find you based on this selection.',
  'Choose',
  'Current mode:',
  'Open to all',

  'Hero',
  'This is the fast first impression people get right away.',
    'Age',
  'Height',
  'Select height',
  'Body type',
  'Select body type',
  'Gender',
  'Select gender',
  'Interested in',
  'Choose who you are open to connecting with.',
  'Relationship goal',
  'Select a goal',
  'Wants kids',
  'Select one',
  'Has kids',
  'Headline',
  'A fast first impression shown near the top of your profile.',
  'Warm, playful chats with real connection.',
  '28',

  'Fast personality snapshot',
  'These answers help people understand who you are quickly.',
  'Describe yourself in three words',
  'Playful, loyal, curious',
  'Something people always notice about me',
  'My laugh and how easy I am to talk to.',
  "Something I'm proud of",
  "How much I've grown over the last few years.",
  'My biggest strength',
  'I make people feel comfortable fast.',

  'Conversation energy',
  'This is one of the most important parts of LoveF8. Help people imagine the conversation.',
  'Short bio',
  '1–2 lines that quickly show your vibe.',
  'Playful energy, easy conversation, and a good listener.',
  'About me',
  'Tell people a little more about your personality, energy, and what kind of connection they can expect.',
  'What I enjoy talking about',
  'Late-night talks, relationships, life goals, music, movies, travel, and everyday real-life conversation.',
  'My style / vibe',
  'Sweet, attentive, playful, calm, and easy to talk to.',
  'Best at',
  'Making you laugh',
  'Looking for',
  'Meaningful chats and real chemistry',

  'Life compatibility',
  'Quick scan details that help people understand your lifestyle.',
  'Drink',
  'Smoke',
  'Exercise',
  'Pets',
  'Morning or night',
  'Open to long-distance',

  'Values',
  'These answers help people understand what matters to you deeper down.',
  'What matters most to me',
  'Consistency, honesty, kindness, and emotional maturity.',
  "A value I won't compromise on",
  'Respect and honesty.',
  'A healthy relationship looks like',
  'Mutual effort, trust, honesty, laughter, and feeling safe to be yourself.',

  'Fun human stuff',
  'These make your profile memorable without making it feel fake.',
  'Hidden talent',
  'I can name songs in the first five seconds.',
  'Controversial opinion',
  'Breakfast food is better at night.',
  'Simple pleasures',
  'Coffee, music in the car, and quiet late nights.',
  'Two truths and a lie',
  "I've been skydiving, I hate pizza, and I can drive stick.",

  'Scan details',
  'These help people understand your style quickly.',
  'Tags',
  'Separate with commas. Keep it short. Up to 8 tags.',
  'Warm, Funny, Listener, Curious',
  'Location',
  'Las Vegas, Nevada',
  'Country',
  'Select country',
  'Region',
  'Select region',
  'Timezone',
  'America/Chicago',
  'Example: America/Chicago, Asia/Manila, Europe/London',
  'Normally online from',
  'Normally online until',

  'Payout settings',
  'Add where you want to receive your host earnings.',
  'Payout Method',
  'Select method',
  'PayPal',
  'GCash',
  'Bank Transfer',
  'Other',
  'PayPal Email',
  'GCash Number',
  'Bank Details',
  'Payout Details',
  'name@example.com',
  '09XXXXXXXXX',
  'Bank name, account name, account number',
  'Enter payout instructions',
  'PayPal email, GCash number, or bank details',
  'Use the PayPal email where you want to receive payouts.',
  'Use the GCash mobile number for this account.',
  'Enter the bank name and account details exactly how you want admin to see them.',
  'Add clear instructions for how you want to be paid.',
  'Choose a payout method, then enter the matching details.',

  'Profile guidance',
  'Make the top of your profile feel warm and clear fast.',
  'Keep your answers human, not corporate.',
  'The best profiles make people want to ask a question.',
  'Use short answers for quick scan and longer answers for depth.',
  'Photos + conversation energy are your biggest first impression.',
  'Saving profile...',
  'Back to Messages',

  'In progress',
  'Under review',
  'Approved host',
  'Needs updates',
  'Not applied',
  'Continue host setup',
  'Open host review status',
  'Open Host Dashboard',
  'Fix host application',
  'Become a Host',

  'Profile updated.',
  'Please enter a valid age between 19 and 95.',
];

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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-base font-bold sm:text-lg">{title}</div>
      {description ? (
        <div className="mt-1.5 text-sm leading-5 text-neutral-600">{description}</div>
      ) : null}
      <div className="mt-4 sm:mt-5">{children}</div>
    </section>
  );
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

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingDiscovery, setSavingDiscovery] = useState(false);
  const [savingChatMode, setSavingChatMode] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [notificationStatus, setNotificationStatus] = useState<
  'unsupported' | 'default' | 'granted' | 'denied'
>('default');
const [turningOnNotifications, setTurningOnNotifications] = useState(false);

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
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>('English');
 const [settingsUiLanguageOverride, setSettingsUiLanguageOverride] = useState<string | null>(null);
   const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translatedMapSecondary, setTranslatedMapSecondary] = useState<Record<string, string>>({});
  const [translatedMapHosting, setTranslatedMapHosting] = useState<Record<string, string>>({});
  const [translatedMapDiscovery, setTranslatedMapDiscovery] = useState<Record<string, string>>({});
  const [translatedMapLanguages, setTranslatedMapLanguages] = useState<Record<string, string>>({});
  const [translatedMapConversation, setTranslatedMapConversation] = useState<Record<string, string>>({});
  const [translatedMapHero, setTranslatedMapHero] = useState<Record<string, string>>({});
  const [translatedMapPersonality, setTranslatedMapPersonality] = useState<Record<string, string>>({});
  const [translatedMapLifestyle, setTranslatedMapLifestyle] = useState<Record<string, string>>({});
  const [translatedMapValues, setTranslatedMapValues] = useState<Record<string, string>>({});
  const [translatedMapFun, setTranslatedMapFun] = useState<Record<string, string>>({});
  const [translatedMapDetails, setTranslatedMapDetails] = useState<Record<string, string>>({});
  const [translatedMapPayout, setTranslatedMapPayout] = useState<Record<string, string>>({});
  const [translatedMapGuidance, setTranslatedMapGuidance] = useState<Record<string, string>>({});


    const [age, setAge] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [bodyType, setBodyType] = useState('');
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

  const tr = (text: string) =>
  translatedMap[text] ||
  translatedMapSecondary[text] ||
  translatedMapHosting[text] ||
  translatedMapDiscovery[text] ||
  translatedMapLanguages[text] ||
  translatedMapConversation[text] ||
  translatedMapHero[text] ||
  translatedMapPersonality[text] ||
  translatedMapLifestyle[text] ||
  translatedMapValues[text] ||
  translatedMapFun[text] ||
  translatedMapDetails[text] ||
  translatedMapPayout[text] ||
  translatedMapGuidance[text] ||
  text;

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
          languages_spoken,
          age,
          height_inches,
          body_type,
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
      setRoleLabel(data?.role === 'host' ? 'host' : 'member');

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

      const langs = asTextArray(data?.languages_spoken);
      setLanguagesSpoken(langs);
      setTargetLanguage(langs[0] || 'English');

      setAge(data?.age != null ? String(data.age) : '');
      setHeightInches(data?.height_inches != null ? String(data.height_inches) : '');
      setBodyType(data?.body_type ?? '');
      setGender(data?.gender ?? '');
      setInterestedIn(asTextArray(data?.interested_in));
      setRelationshipGoal(data?.relationship_goal ?? '');
      setHasKids(typeof data?.has_kids === 'boolean' ? (data.has_kids ? 'Yes' : 'No') : '');
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

  useEffect(() => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    setNotificationStatus('unsupported');
    return;
  }

  setNotificationStatus(Notification.permission);
}, []);

async function turnOnNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    setNotificationStatus('unsupported');
    alert('This browser does not support notifications.');
    return;
  }

  if (!userId) {
    alert('Please log in before turning on notifications.');
    return;
  }

  setTurningOnNotifications(true);

  try {
    const win = window as typeof window & {
  OneSignalDeferred?: Array<(OneSignal: any) => Promise<void> | void>;
};

win.OneSignalDeferred = win.OneSignalDeferred || [];

await new Promise<void>((resolve, reject) => {
  win.OneSignalDeferred!.push(async function (OneSignal: any) {
    try {
      await OneSignal.login(userId);
      await OneSignal.Notifications.requestPermission();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
});

const permission = Notification.permission;
    if (
      permission === 'default' ||
      permission === 'granted' ||
      permission === 'denied'
    ) {
      setNotificationStatus(permission);
    }

    if (permission === 'granted') {
      alert('Notifications are turned on.');
    } else if (permission === 'denied') {
      alert('Notifications are blocked. You can turn them back on in your browser settings.');
    } else {
      alert('Notifications were not turned on.');
    }
  } catch (error) {
    console.error('turnOnNotifications error:', error);
    alert('Notifications could not be turned on right now.');
  } finally {
    setTurningOnNotifications(false);
  }
}

useEffect(() => {
  setTargetLanguage(settingsUiLanguageOverride || languagesSpoken[0] || 'English');
}, [languagesSpoken, settingsUiLanguageOverride]);

async function loadCachedSettingsTranslations(
  section: string,
  texts: string[],
  setter: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
  if (!targetLanguage || targetLanguage === 'English') {
    setter({});
    return;
  }

  const cacheKey = buildSettingsTranslationCacheKey(section, targetLanguage, texts);
  const cached = readSettingsTranslationCache(cacheKey);

  if (cached) {
    setter(cached);
    return;
  }

  try {
    const res = await fetch('/api/translate-settings-ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, targetLanguage }),
    });

    const data = await res.json();

    if (Array.isArray(data?.translations)) {
      const map: Record<string, string> = {};

      data.translations.forEach(
        (item: { original?: string; translated?: string }) => {
          if (!item?.original) return;
          map[item.original] = item.translated || item.original;
        }
      );

      writeSettingsTranslationCache(cacheKey, map);
      setter(map);
    }
  } catch (err) {
    console.error(`loadCachedSettingsTranslations error for ${section}:`, err);
  }
}

useEffect(() => {
  void loadCachedSettingsTranslations(
    'top-ui',
    [
      'Settings',
      'Manage how you appear in discovery and build a profile that feels real and easy to connect with.',
      'Save profile',
      'Saving...',
      'Back',
      'View in English',
      'Use Selected Language',
      'Loading...',
    ],
    setTranslatedMap
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'profile-photos',
    [
      'Profile Photos',
      'Add multiple photos so your profile feels more real and complete. Hosts need at least 3 photos before they can earn.',
      'Photos:',
      'Minimum photo requirement met',
      'Add',
      'more to unlock earning',
      'The active main photo is the one used across LoveF8. You can upload up to',
      'photos total.',
      'Main Photo',
      'Main profile',
      'No photo',
      'Uploading...',
      'Upload Photo',
      'JPG, PNG, or WEBP. You can select more than one photo at once.',
      'You have reached the maximum of',
      'photos.',
      'Loading photos...',
      'Photo Gallery',
      'No photos uploaded yet.',
      'Profile gallery',
      'Extra Photo',
      'Active',
      'Set Main',
      'Working...',
      'Delete',
    ],
    setTranslatedMapSecondary
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'hosting',
    [
      'Hosting',
      'Apply to become a host, continue your setup, or open your host dashboard.',
      'Approved host',
      'Open Host Dashboard',
      'You are approved as a host. Open your host dashboard to manage your hosting setup.',
    ],
    setTranslatedMapHosting
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'discovery',
    [
      'Discovery',
      'When ON: approved hosts can find you and message you first. When OFF: you can still message hosts, but hosts cannot initiate with you.',
      'Turn OFF Discovery',
      'Turn ON Discovery',
      'Discovery ON',
      'Discovery OFF',
    ],
    setTranslatedMapDiscovery
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'languages',
    [
      'Languages',
      'Select the languages you speak.',
      'Selected',
      'Tap',
    ],
    setTranslatedMapLanguages
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'conversation',
    [
      'Available for',
      'Conversation mode',
      'Choose how you want to be discovered right now. Members will see you based on the conversation style you are currently open to.',
      'Choose how you want to be discovered right now. Hosts will be able to find you based on this selection.',
      'Choose',
      'Current mode:',
      'Open to all',
      'Chatty',
      'Light, friendly, casual conversation.',
      'Flirty',
      'Playful, warm, more expressive conversation.',
      'Romantic',
      'More emotionally intimate and romance-forward conversation.',
    ],
    setTranslatedMapConversation
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'hero',
    [
      'Hero',
      'This is the fast first impression people get right away.',
            'Age',
      'Height',
      'Select height',
      'Body type',
      'Select body type',
      'Gender',
      'Select gender',
      'Interested in',
      'Choose who you are open to connecting with.',
      'Relationship goal',
      'Select a goal',
      'Wants kids',
      'Select one',
      'Has kids',
      'Headline',
      'A fast first impression shown near the top of your profile.',
      'Warm, playful chats with real connection.',
      '28',
        'Man',
  'Woman',
  'Non-binary',
  'Prefer not to say',
  'Slim',
  'Athletic',
  'Average',
  'Curvy',
  'Plus-size',
  'Muscular',
      'Men',
      'Women',
      'Both',
      'Meaningful conversation',
      'Friendship',
      'Long-term relationship',
      'Open to anything',
      'Yes',
      'No',
      'Maybe',
      'Undecided',
    ],
    setTranslatedMapHero
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'personality',
    [
      'Fast personality snapshot',
      'These answers help people understand who you are quickly.',
      'Describe yourself in three words',
      'Playful, loyal, curious',
      'Something people always notice about me',
      'My laugh and how easy I am to talk to.',
      "Something I'm proud of",
      "How much I've grown over the last few years.",
      'My biggest strength',
      'I make people feel comfortable fast.',
    ],
    setTranslatedMapPersonality
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'lifestyle',
    [
      'Life compatibility',
      'Quick scan details that help people understand your lifestyle.',
      'Drink',
      'Smoke',
      'Exercise',
      'Pets',
      'Morning or night',
      'Open to long-distance',
      'Select one',
      'Often',
      'Sometimes',
      'Rarely',
      'Morning',
      'Night',
      'Both',
      'Yes',
      'No',
      'Socially',
    ],
    setTranslatedMapLifestyle
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'values',
    [
      'Values',
      'These answers help people understand what matters to you deeper down.',
      'What matters most to me',
      'Consistency, honesty, kindness, and emotional maturity.',
      "A value I won't compromise on",
      'Respect and honesty.',
      'A healthy relationship looks like',
      'Mutual effort, trust, honesty, laughter, and feeling safe to be yourself.',
    ],
    setTranslatedMapValues
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'fun',
    [
      'Fun human stuff',
      'These make your profile memorable without making it feel fake.',
      'Hidden talent',
      'I can name songs in the first five seconds.',
      'Controversial opinion',
      'Breakfast food is better at night.',
      'Simple pleasures',
      'Coffee, music in the car, and quiet late nights.',
      'Two truths and a lie',
      "I've been skydiving, I hate pizza, and I can drive stick.",
    ],
    setTranslatedMapFun
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'details',
    [
      'Scan details',
      'These help people understand your style quickly.',
      'Tags',
      'Separate with commas. Keep it short. Up to 8 tags.',
      'Warm, Funny, Listener, Curious',
      'Location',
      'Las Vegas, Nevada',
      'Country',
      'Select country',
      'Region',
      'Select region',
      'Timezone',
      'America/Chicago',
      'Example: America/Chicago, Asia/Manila, Europe/London',
      'Normally online from',
      'Normally online until',
      'North America',
      'South America',
      'Europe',
      'Africa',
      'Asia',
      'Oceania',
      'Caribbean',
      'Central America',
      'Middle East',
    ],
    setTranslatedMapDetails
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'payout',
    [
      'Payout settings',
      'Add where you want to receive your host earnings.',
      'Payout Method',
      'Select method',
      'PayPal',
      'GCash',
      'Bank Transfer',
      'Other',
      'PayPal Email',
      'GCash Number',
      'Bank Details',
      'Payout Details',
      'name@example.com',
      '09XXXXXXXXX',
      'Bank name, account name, account number',
      'Enter payout instructions',
      'PayPal email, GCash number, or bank details',
      'Use the PayPal email where you want to receive payouts.',
      'Use the GCash mobile number for this account.',
      'Enter the bank name and account details exactly how you want admin to see them.',
      'Add clear instructions for how you want to be paid.',
      'Choose a payout method, then enter the matching details.',
    ],
    setTranslatedMapPayout
  );
}, [targetLanguage]);

useEffect(() => {
  void loadCachedSettingsTranslations(
    'guidance',
    [
      'Profile guidance',
      'Make the top of your profile feel warm and clear fast.',
      'Keep your answers human, not corporate.',
      'The best profiles make people want to ask a question.',
      'Use short answers for quick scan and longer answers for depth.',
      'Photos + conversation energy are your biggest first impression.',
      'Saving profile...',
      'Back to Messages',
      'Profile updated.',
      'Please enter a valid age between 19 and 95.',
    ],
    setTranslatedMapGuidance
  );
}, [targetLanguage]);


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

  function handleCountryChange(nextCountry: string) {
    setCountryOrigin(nextCountry);

    const selected = COUNTRY_OPTIONS.find((c) => c.name === nextCountry);
    if (!selected) return;

    if (selected.region) {
      setRegionOrigin(selected.region);
    }

    if (selected.timezone) {
      setTimezone(selected.timezone);
    }
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
    const parsedHeightInches = heightInches.trim() ? Number(heightInches.trim()) : null;

    if (
      age.trim() &&
      (parsedAge === null ||
        !Number.isInteger(parsedAge) ||
        parsedAge < 19 ||
        parsedAge > 120)
    ) {
      alert(tr('Please enter a valid age between 19 and 120.'));
      setSavingProfile(false);
      return;
    }
        if (
      heightInches.trim() &&
      (parsedHeightInches === null ||
        !Number.isInteger(parsedHeightInches) ||
        parsedHeightInches < 48 ||
        parsedHeightInches > 96)
    ) {
      alert('Please select a valid height.');
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
      languages_spoken: languagesSpoken,

      age: parsedAge,
      height_inches: parsedHeightInches,
      body_type: bodyType || null,
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

    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);

    if (error) {
      alert(error.message);
      setSavingProfile(false);
      return;
    }

    alert(tr('Profile updated.'));
    setSavingProfile(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-4">
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm">
          {tr('Loading...')}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-neutral-50 px-3 py-4 text-neutral-900 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-4xl">
        <div className="sticky top-0 z-20 -mx-3 border-b border-neutral-200 bg-neutral-50/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-b-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tr('Settings')}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {tr(
              'Manage how you appear in discovery and build a profile that feels real and easy to connect with.'
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void saveProfileContent()}
              disabled={savingProfile}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5"
            >
              {savingProfile ? tr('Saving...') : tr('Save profile')}
            </button>

            <button
              type="button"
              onClick={() => router.push('/messages')}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 sm:py-2.5"
            >
              {tr('Back')}
            </button>
            <button
  type="button"
  onClick={() => setSettingsUiLanguageOverride(null)}
  className={[
    'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:py-2.5',
    settingsUiLanguageOverride === null
      ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
  ].join(' ')}
>
  Use Selected Language
</button>
<button
  type="button"
  onClick={() => setSettingsUiLanguageOverride('English')}
  className={[
    'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:py-2.5',
    settingsUiLanguageOverride === 'English'
      ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
  ].join(' ')}
>
  View in English
</button>
<button
  type="button"
  onClick={() => void turnOnNotifications()}
  disabled={turningOnNotifications || notificationStatus === 'unsupported'}
  className={[
    'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:py-2.5',
    notificationStatus === 'granted'
      ? 'border-green-300 bg-green-50 text-green-900'
      : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
    turningOnNotifications ? 'cursor-not-allowed opacity-60' : '',
  ].join(' ')}
>
  {turningOnNotifications
    ? 'Turning on...'
    : notificationStatus === 'granted'
      ? 'Notifications on'
      : notificationStatus === 'denied'
        ? 'Notifications blocked'
        : notificationStatus === 'unsupported'
          ? 'Notifications unavailable'
          : 'Turn on notifications'}
</button>
          </div>
        </div>

        {userId ? (
          <div className="mt-4 sm:mt-6">
                  <ProfilePhotoUploader
  userId={userId}
  currentAvatarUrl={avatarPreviewUrl}
  tr={tr}
  onUploadComplete={(filePath, previewUrl) => {
    setAvatarPath(filePath);
    setAvatarPreviewUrl(previewUrl);
  }}
/>
          </div>
        ) : null}

        <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
          <SectionCard
            title={tr('Hosting')}
            description={tr(
              'Apply to become a host, continue your setup, or open your host dashboard.'
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  {tr(hostStatusLabel(hostApplicationStatus))}
                </span>

                <button
                  type="button"
                  onClick={() => router.push('/host')}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 sm:py-2.5"
                >
                  {tr(hostButtonLabel(hostApplicationStatus))}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm leading-5 text-neutral-600 sm:p-4">
              {hostApplicationStatus === 'not_applied' && (
                <span>
                  {tr(
                    'Anyone can start as a member and apply later. When you are ready, open the host area to begin.'
                  )}
                </span>
              )}

              {hostApplicationStatus === 'in_progress' && (
                <span>
                  {tr(
                    'Your host setup has started. Finish your readiness checklist and continue from the host area.'
                  )}
                </span>
              )}

              {hostApplicationStatus === 'under_review' && (
                <span>
                  {tr(
                    'Your host application is under review right now. You can open the host area to check your status.'
                  )}
                </span>
              )}

              {hostApplicationStatus === 'approved' && (
                <span>
                  {tr(
                    'You are approved as a host. Open your host dashboard to manage your hosting setup.'
                  )}
                </span>
              )}

              {hostApplicationStatus === 'rejected' && (
                <span>
                  {tr(
                    'Your application needs updates before approval. Open the host area to see what needs to be fixed.'
                  )}
                </span>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Discovery')}
            description={tr(
              'When ON: approved hosts can find you and message you first. When OFF: you can still message hosts, but hosts cannot initiate with you.'
            )}
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => void saveDiscovery(!discoverable)}
                disabled={savingDiscovery}
                className={[
                  'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:py-2.5',
                  discoverable
                    ? 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100'
                    : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                  savingDiscovery ? 'cursor-not-allowed opacity-60' : '',
                ].join(' ')}
              >
                {savingDiscovery
                  ? tr('Saving...')
                  : discoverable
                    ? tr('Turn OFF Discovery')
                    : tr('Turn ON Discovery')}
              </button>

              <span
                className={[
                  'rounded-full px-3 py-1 text-xs font-bold',
                  discoverable
                    ? 'bg-green-100 text-green-800'
                    : 'bg-neutral-200 text-neutral-700',
                ].join(' ')}
              >
                {discoverable ? tr('Discovery ON') : tr('Discovery OFF')}
              </span>
            </div>
          </SectionCard>

          <SectionCard title={tr('Languages')} description={tr('Select the languages you speak.')}>
            <div className="rounded-2xl border border-neutral-300 bg-white p-3">
              <div className="max-h-64 overflow-y-auto pr-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  {LANGUAGE_OPTIONS.map((lang) => {
                    const selected = languagesSpoken.includes(lang);

                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => {
                          setLanguagesSpoken((prev) =>
                            prev.includes(lang)
                              ? prev.filter((l) => l !== lang)
                              : [...prev, lang]
                          );
                        }}
                        className={[
                          'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition',
                          selected
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                        ].join(' ')}
                      >
                        <span>{lang}</span>
                        <span className="text-xs">{selected ? tr('Selected') : tr('Tap')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr(roleLabel === 'host' ? 'Available for' : 'Conversation mode')}
            description={tr(
              roleLabel === 'host'
                ? 'Choose how you want to be discovered right now. Members will see you based on the conversation style you are currently open to.'
                : 'Choose how you want to be discovered right now. Hosts will be able to find you based on this selection.'
            )}
          >
            <div className="grid gap-2.5 sm:gap-3">
              {CHAT_MODE_OPTIONS.map((option) => {
                const selected = chatMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void saveChatMode(option.value)}
                    disabled={savingChatMode}
                    className={[
                      'w-full rounded-2xl border px-4 py-3 text-left transition sm:py-4',
                      selected
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50',
                      savingChatMode ? 'cursor-not-allowed opacity-70' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold sm:text-base">{tr(option.label)}</div>
                        <div
                          className={[
                            'mt-1 text-xs sm:text-sm',
                            selected ? 'text-white/80' : 'text-neutral-500',
                          ].join(' ')}
                        >
                          {tr(option.description)}
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
                        {selected ? tr('Selected') : tr('Choose')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-xs text-neutral-500 sm:mt-4">
              {tr('Current mode:')}{' '}
              <span className="font-bold text-neutral-800">
                {tr(
                  CHAT_MODE_OPTIONS.find((option) => option.value === chatMode)?.label || 'Open to all'
                )}
              </span>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Hero')}
            description={tr('This is the fast first impression people get right away.')}
          >
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">{tr('Age')}</label>
                <input
                  type="number"
                  min="19"
                  max="95"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('28')}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Height')}
                </label>
                <select
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select height')}</option>
                  {HEIGHT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Body type')}
                </label>
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select body type')}</option>
                  {BODY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Gender')}
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select gender')}</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 sm:mt-5">
              <label className="block text-sm font-semibold text-neutral-900">
                {tr('Interested in')}
              </label>
              <p className="mt-1 text-xs text-neutral-500">
                {tr('Choose who you are open to connecting with.')}
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
                      {tr(option)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:mt-5 sm:grid-cols-2 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Relationship goal')}
                </label>
                <select
                  value={relationshipGoal}
                  onChange={(e) => setRelationshipGoal(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select a goal')}</option>
                  {RELATIONSHIP_GOAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Wants kids')}
                </label>
                <select
                  value={wantsKids}
                  onChange={(e) => setWantsKids(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select one')}</option>
                  {WANTS_KIDS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 sm:mt-5">
              <label className="block text-sm font-semibold text-neutral-900">
                {tr('Has kids')}
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {YES_NO_OPTIONS.map((option) => (
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
                    {tr(option)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 sm:mt-5">
              <label className="block text-sm font-semibold text-neutral-900">
                {tr('Headline')}
              </label>
              <p className="mt-1 text-xs text-neutral-500">
                {tr('A fast first impression shown near the top of your profile.')}
              </p>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value.slice(0, 90))}
                className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                placeholder={tr('Warm, playful chats with real connection.')}
              />
              <div className="mt-1 text-right text-xs text-neutral-500">{headlineCount}/90</div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Fast personality snapshot')}
            description={tr('These answers help people understand who you are quickly.')}
          >
            <div className="grid gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Describe yourself in three words')}
                </label>
                <input
                  type="text"
                  value={threeWords}
                  onChange={(e) => setThreeWords(e.target.value.slice(0, 40))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('Playful, loyal, curious')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {threeWordsCount}/40
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Something people always notice about me')}
                </label>
                <input
                  type="text"
                  value={peopleNotice}
                  onChange={(e) => setPeopleNotice(e.target.value.slice(0, 120))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('My laugh and how easy I am to talk to.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {peopleNoticeCount}/120
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr("Something I'm proud of")}
                </label>
                <input
                  type="text"
                  value={proudOf}
                  onChange={(e) => setProudOf(e.target.value.slice(0, 140))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr("How much I've grown over the last few years.")}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">{proudOfCount}/140</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('My biggest strength')}
                </label>
                <input
                  type="text"
                  value={biggestStrength}
                  onChange={(e) => setBiggestStrength(e.target.value.slice(0, 120))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('I make people feel comfortable fast.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {biggestStrengthCount}/120
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Conversation energy')}
            description={tr(
              'This is one of the most important parts of LoveF8. Help people imagine the conversation.'
            )}
          >
            <div className="grid gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Short bio')}
                </label>
                <p className="mt-1 text-xs text-neutral-500">
                  {tr('1–2 lines that quickly show your vibe.')}
                </p>
                <textarea
                  value={shortBio}
                  onChange={(e) => setShortBio(e.target.value.slice(0, 140))}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr('Playful energy, easy conversation, and a good listener.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">{shortBioCount}/140</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('About me')}
                </label>
                <textarea
                  value={aboutLong}
                  onChange={(e) => setAboutLong(e.target.value.slice(0, 700))}
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr(
                    'Tell people a little more about your personality, energy, and what kind of connection they can expect.'
                  )}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">{aboutLongCount}/700</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('What I enjoy talking about')}
                </label>
                <textarea
                  value={talkTopics}
                  onChange={(e) => setTalkTopics(e.target.value.slice(0, 500))}
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr(
                    'Late-night talks, relationships, life goals, music, movies, travel, and everyday real-life conversation.'
                  )}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">{talkTopicsCount}/500</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('My style / vibe')}
                </label>
                <textarea
                  value={styleVibe}
                  onChange={(e) => setStyleVibe(e.target.value.slice(0, 300))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr('Sweet, attentive, playful, calm, and easy to talk to.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">{styleVibeCount}/300</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Best at')}
                  </label>
                  <input
                    type="text"
                    value={bestAt}
                    onChange={(e) => setBestAt(e.target.value.slice(0, 60))}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                    placeholder={tr('Making you laugh')}
                  />
                  <div className="mt-1 text-right text-xs text-neutral-500">{bestAtCount}/60</div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Looking for')}
                  </label>
                  <input
                    type="text"
                    value={lookingFor}
                    onChange={(e) => setLookingFor(e.target.value.slice(0, 60))}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                    placeholder={tr('Meaningful chats and real chemistry')}
                  />
                  <div className="mt-1 text-right text-xs text-neutral-500">
                    {lookingForCount}/60
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Life compatibility')}
            description={tr('Quick scan details that help people understand your lifestyle.')}
          >
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Drink')}
                </label>
                <select
                  value={drink}
                  onChange={(e) => setDrink(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select one')}</option>
                  {DRINK_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Smoke')}
                </label>
                <select
                  value={smoke}
                  onChange={(e) => setSmoke(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select one')}</option>
                  {SMOKE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Exercise')}
                </label>
                <select
                  value={exercise}
                  onChange={(e) => setExercise(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select one')}</option>
                  {EXERCISE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">{tr('Pets')}</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {YES_NO_OPTIONS.map((option) => (
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
                      {tr(option)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Morning or night')}
                </label>
                <select
                  value={morningOrNight}
                  onChange={(e) => setMorningOrNight(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select one')}</option>
                  {MORNING_NIGHT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {tr(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Open to long-distance')}
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {YES_NO_OPTIONS.map((option) => (
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
                      {tr(option)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Values')}
            description={tr('These answers help people understand what matters to you deeper down.')}
          >
            <div className="grid gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('What matters most to me')}
                </label>
                <textarea
                  value={whatMatters}
                  onChange={(e) => setWhatMatters(e.target.value.slice(0, 220))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr('Consistency, honesty, kindness, and emotional maturity.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {whatMattersCount}/220
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr("A value I won't compromise on")}
                </label>
                <textarea
                  value={nonNegotiable}
                  onChange={(e) => setNonNegotiable(e.target.value.slice(0, 180))}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr('Respect and honesty.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {nonNegotiableCount}/180
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('A healthy relationship looks like')}
                </label>
                <textarea
                  value={healthyRelationship}
                  onChange={(e) => setHealthyRelationship(e.target.value.slice(0, 220))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr(
                    'Mutual effort, trust, honesty, laughter, and feeling safe to be yourself.'
                  )}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {healthyRelationshipCount}/220
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Fun human stuff')}
            description={tr(
              'These make your profile memorable without making it feel fake.'
            )}
          >
            <div className="grid gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Hidden talent')}
                </label>
                <input
                  type="text"
                  value={hiddenTalent}
                  onChange={(e) => setHiddenTalent(e.target.value.slice(0, 140))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('I can name songs in the first five seconds.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {hiddenTalentCount}/140
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Controversial opinion')}
                </label>
                <input
                  type="text"
                  value={controversialOpinion}
                  onChange={(e) => setControversialOpinion(e.target.value.slice(0, 140))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('Breakfast food is better at night.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {controversialOpinionCount}/140
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Simple pleasures')}
                </label>
                <input
                  type="text"
                  value={simplePleasures}
                  onChange={(e) => setSimplePleasures(e.target.value.slice(0, 140))}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('Coffee, music in the car, and quiet late nights.')}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {simplePleasuresCount}/140
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Two truths and a lie')}
                </label>
                <textarea
                  value={twoTruthsLie}
                  onChange={(e) => setTwoTruthsLie(e.target.value.slice(0, 220))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-500"
                  placeholder={tr("I've been skydiving, I hate pizza, and I can drive stick.")}
                />
                <div className="mt-1 text-right text-xs text-neutral-500">
                  {twoTruthsLieCount}/220
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Scan details')}
            description={tr('These help people understand your style quickly.')}
          >
            <div className="grid gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">{tr('Tags')}</label>
                <p className="mt-1 text-xs text-neutral-500">
                  {tr('Separate with commas. Keep it short. Up to 8 tags.')}
                </p>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  placeholder={tr('Warm, Funny, Listener, Curious')}
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

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Location')}
                  </label>
                  <input
                    type="text"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value.slice(0, 80))}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                    placeholder={tr('Las Vegas, Nevada')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Country')}
                  </label>
                  <select
                    value={countryOrigin}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  >
                    <option value="">{tr('Select country')}</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Region')}
                  </label>
                  <select
                    value={regionOrigin}
                    onChange={(e) => setRegionOrigin(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  >
                    <option value="">{tr('Select region')}</option>
                    {REGION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {tr(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Timezone')}
                  </label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                    placeholder={tr('America/Chicago')}
                  />
                  <div className="mt-1 text-xs text-neutral-500">
                    {tr('Example: America/Chicago, Asia/Manila, Europe/London')}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Normally online from')}
                  </label>
                  <input
                    type="time"
                    value={normallyOnlineStart}
                    onChange={(e) => setNormallyOnlineStart(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-900">
                    {tr('Normally online until')}
                  </label>
                  <input
                    type="time"
                    value={normallyOnlineEnd}
                    onChange={(e) => setNormallyOnlineEnd(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr('Payout settings')}
            description={tr('Add where you want to receive your host earnings.')}
          >
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr('Payout Method')}
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => {
                    const nextMethod = e.target.value;
                    setPayoutMethod(nextMethod);
                    setPayoutDetails('');
                  }}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                >
                  <option value="">{tr('Select method')}</option>
                  <option value="paypal">{tr('PayPal')}</option>
                  <option value="gcash">{tr('GCash')}</option>
                  <option value="bank">{tr('Bank Transfer')}</option>
                  <option value="other">{tr('Other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  {tr(payoutDetailsLabel)}
                </label>
                <input
                  type="text"
                  value={payoutDetails}
                  onChange={(e) => setPayoutDetails(e.target.value)}
                  placeholder={tr(payoutDetailsPlaceholder)}
                  className="mt-2 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-neutral-500 sm:py-3"
                />
                <div className="mt-2 text-xs text-neutral-500">{tr(payoutDetailsHelp)}</div>
              </div>
            </div>
          </SectionCard>

          <section className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
            <div className="text-sm font-semibold text-neutral-900">{tr('Profile guidance')}</div>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-600">
              <li>{tr('Make the top of your profile feel warm and clear fast.')}</li>
              <li>{tr('Keep your answers human, not corporate.')}</li>
              <li>{tr('The best profiles make people want to ask a question.')}</li>
              <li>{tr('Use short answers for quick scan and longer answers for depth.')}</li>
              <li>{tr('Photos + conversation energy are your biggest first impression.')}</li>
            </ul>
          </section>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void saveProfileContent()}
              disabled={savingProfile}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5"
            >
              {savingProfile ? tr('Saving profile...') : tr('Save profile')}
            </button>

            <button
              type="button"
              onClick={() => router.push('/messages')}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 sm:py-2.5"
            >
              {tr('Back to Messages')}
            </button>

           <button
  type="button"
  onClick={() => setSettingsUiLanguageOverride('English')}
  className={[
    'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:py-2.5',
    settingsUiLanguageOverride === 'English'
      ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
  ].join(' ')}
>
  View in English
</button>
<button
  type="button"
  onClick={() => setSettingsUiLanguageOverride(null)}
  className={[
    'inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition sm:py-2.5',
    settingsUiLanguageOverride === null
      ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
  ].join(' ')}
>
  Use Selected Language
</button>
          </div>
        </div>
      </div>
    </main>
  );
}