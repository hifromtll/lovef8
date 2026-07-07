'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatMoneyFromCountry } from '@/lib/currency';

type HostMode = 'chatty' | 'flirty' | 'romantic';

type HostApplicationStatus =
  | 'not_applied'
  | 'in_progress'
  | 'under_review'
  | 'approved'
  | 'rejected';

type VerificationStatus =
  | 'not_started'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

type ProfileRow = {
  id: string;
  role?: string | null;
  app_role?: string | null;
  username?: string | null;
  host_mode?: HostMode | null;
  host_application_status?: HostApplicationStatus | null;

  age?: number | string | null;
  gender?: string | null;
  sex?: string | null;

  headline?: string | null;
  short_bio?: string | null;
  about_long?: string | null;

  location_text?: string | null;
  interested_in?: string[] | null;
  country_origin?: string | null;

  normally_online_start?: string | null;
  normally_online_end?: string | null;

  id_verification_status?: VerificationStatus | null;
  selfie_verification_status?: VerificationStatus | null;
  verification_notes?: string | null;
  id_submitted_at?: string | null;
  selfie_submitted_at?: string | null;

  id_document_path?: string | null;
  selfie_image_path?: string | null;

  sparks_received_total?: number | null;
  sparks_earned_total?: number | null;

  payout_method?: string | null;
  payout_details?: string | null;

  host_hold_reason?: string | null;
  host_admin_notes?: string | null;
};

type ChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
};

type EarningsSummary = {
  pending: number;
  available: number;
  paid: number;
};

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

function normalizeVerificationStatus(value: unknown): VerificationStatus {
  if (
    value === 'not_started' ||
    value === 'submitted' ||
    value === 'under_review' ||
    value === 'approved' ||
    value === 'rejected'
  ) {
    return value;
  }
  return 'not_started';
}

function prettyHostStatus(status: HostApplicationStatus): string {
  switch (status) {
    case 'not_applied':
      return 'Not Applied';
    case 'in_progress':
      return 'In Progress';
    case 'under_review':
      return 'Under Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Not Applied';
  }
}

function prettyVerificationStatus(status: VerificationStatus): string {
  switch (status) {
    case 'not_started':
      return 'Not started';
    case 'submitted':
      return 'Submitted';
    case 'under_review':
      return 'Under review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Not started';
  }
}

function cardTone(status: HostApplicationStatus) {
  switch (status) {
    case 'approved':
      return { border: '#14532d', bg: '#052e16', text: '#bbf7d0' };
    case 'under_review':
      return { border: '#854d0e', bg: '#451a03', text: '#fde68a' };
    case 'rejected':
      return { border: '#7f1d1d', bg: '#450a0a', text: '#fecaca' };
    case 'in_progress':
      return { border: '#0c4a6e', bg: '#082f49', text: '#bae6fd' };
    default:
      return { border: '#3f3f46', bg: '#18181b', text: '#e4e4e7' };
  }
}

function verificationTone(status: VerificationStatus) {
  switch (status) {
    case 'approved':
      return { bg: '#052e16', border: '#14532d', text: '#bbf7d0' };
    case 'under_review':
    case 'submitted':
      return { bg: '#451a03', border: '#854d0e', text: '#fde68a' };
    case 'rejected':
      return { bg: '#450a0a', border: '#7f1d1d', text: '#fecaca' };
    default:
      return { bg: '#18181b', border: '#27272a', text: '#e4e4e7' };
  }
}

function getSafeExtension(fileName: string) {
  const fileExt = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt) ? fileExt : 'jpg';
}

function buildChecklist(
  profile: ProfileRow | null,
  actualPhotoCount: number
): ChecklistItem[] {
  const shortBio = String(profile?.short_bio ?? '').trim();
  const aboutLong = String(profile?.about_long ?? '').trim();
  const bioComplete = shortBio.length > 0 || aboutLong.length > 0;

  const headline = String(profile?.headline ?? '').trim();
  const location = String(profile?.location_text ?? '').trim();
  const gender = String(profile?.gender ?? profile?.sex ?? '').trim();

  const interestedInArray = Array.isArray(profile?.interested_in)
    ? profile.interested_in.filter(Boolean)
    : [];

  const onlineStart = String(profile?.normally_online_start ?? '').trim();
  const onlineEnd = String(profile?.normally_online_end ?? '').trim();

  const ageValue = profile?.age;
  const ageComplete =
    typeof ageValue === 'number'
      ? ageValue > 0
      : String(ageValue ?? '').trim().length > 0;

  const idApproved =
    normalizeVerificationStatus(profile?.id_verification_status) === 'approved';
  const selfieApproved =
    normalizeVerificationStatus(profile?.selfie_verification_status) === 'approved';

  return [
    {
      key: 'photos',
      label: 'Upload at least 3 photos',
      complete: actualPhotoCount >= 3,
    },
    {
      key: 'bio',
      label: 'Complete your bio',
      complete: bioComplete,
    },
    {
      key: 'age',
      label: 'Add your age',
      complete: ageComplete,
    },
    {
      key: 'gender',
      label: 'Add sex / gender',
      complete: gender.length > 0,
    },
    {
      key: 'seeking',
      label: 'Add who you are seeking',
      complete: interestedInArray.length > 0,
    },
    {
      key: 'headline',
      label: 'Add a headline',
      complete: headline.length > 0,
    },
    {
      key: 'location',
      label: 'Add your location',
      complete: location.length > 0,
    },
    {
      key: 'online_window',
      label: 'Set your normally online hours',
      complete: onlineStart.length > 0 && onlineEnd.length > 0,
    },
    {
      key: 'id_verification',
      label: 'Verify your ID',
      complete: idApproved,
    },
    {
      key: 'selfie_verification',
      label: 'Complete selfie verification',
      complete: selfieApproved,
    },
  ];
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

function formatCentsForCountry(
  value: number | null | undefined,
  country: string | null | undefined
) {
  const cents = Number(value ?? 0);
  return formatMoneyFromCountry(cents / 100, country);
}

export default function HostPage() {
  const router = useRouter();

  const idInputRef = useRef<HTMLInputElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);
  const autoReviewTriggeredRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
    const [targetLanguage, setTargetLanguage] = useState<string>('English');
  const [translatedHostUiMap, setTranslatedHostUiMap] = useState<Record<string, string>>({});
  const [forceEnglish, setForceEnglish] = useState(false);
  const trSafe = (text: string) => (forceEnglish ? text : translatedHostUiMap[text] || text);

  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [storagePhotoCount, setStoragePhotoCount] = useState(0);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary>({
    pending: 0,
    available: 0,
    paid: 0,
  });

  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [hostMode, setHostMode] = useState<HostMode>('chatty');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutDetails, setPayoutDetails] = useState('');

  async function loadStoragePhotoCount(userId: string) {
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .list(userId, {
        limit: 100,
        sortBy: { column: 'name', order: 'desc' },
      });

    if (error) {
      setStoragePhotoCount(0);
      return;
    }

    const files = (data || []).filter((item) => !!item.name);
    setStoragePhotoCount(files.length);
  }

  async function loadProfile() {
    setMessage(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    await loadStoragePhotoCount(user.id);

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      setMessage(`❌ ${error.message}`);
      setLoading(false);
      return;
    }

    const nextProfile = (profileData ?? null) as ProfileRow | null;
    setProfile(nextProfile);
    setRole(nextProfile?.role ?? '');
    setUsername(nextProfile?.username ?? '');
    setHostMode((nextProfile?.host_mode as HostMode) ?? 'chatty');
    setPayoutMethod(nextProfile?.payout_method ?? '');
    setPayoutDetails(nextProfile?.payout_details ?? '');
        const profileLanguages = Array.isArray((nextProfile as any)?.languages_spoken)
      ? (nextProfile as any).languages_spoken
      : [];

    setTargetLanguage(profileLanguages[0] || 'English');

    const { data: earningsData } = await supabase
      .from('earnings_ledger')
      .select('earning_status, host_earning_cents')
      .eq('receiver_profile_id', user.id);

    if (earningsData) {
      const summary = (earningsData as Array<{
        earning_status: string;
        host_earning_cents: number | null;
      }>).reduce(
        (acc, row) => {
          const cents = Number(row.host_earning_cents ?? 0);

          if (row.earning_status === 'pending') acc.pending += cents;
          if (row.earning_status === 'available') acc.available += cents;
          if (row.earning_status === 'paid') acc.paid += cents;

          return acc;
        },
        { pending: 0, available: 0, paid: 0 }
      );

      setEarningsSummary(summary);
    } else {
      setEarningsSummary({ pending: 0, available: 0, paid: 0 });
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

    useEffect(() => {
    let isActive = true;

    async function translateHostUI() {
      if (!targetLanguage || targetLanguage === 'English') {
        if (isActive) {
          setTranslatedHostUiMap({});
        }
        return;
      }

      const allTexts = [
        'LoveF8 Host Area',
        'Host Dashboard',
        'Welcome to the Host Dashboard',
        'Members can apply to become hosts, complete readiness steps, and prepare for approval.',
        'At LoveF8, Hosts have the opportunity to earn real money through tips while having genuine conversations with people who want to connect.',
        'Many Hosts can earn $200 – $800+ per month while working flexible hours from home and choosing who they talk to.',
        'Why Hosts love it:',
        'Get paid for being yourself',
        'No scripts or pressure',
        'Real conversations with real people',
        'Withdraw your earnings easily',
        'Ready to get started? Complete your profile and verification to submit your Host application.',
        'Pending',
        'Available',
        'Paid',
        'Back to Messages',
        'View Full Earnings',
        'Status:',
        'Host Readiness',
        'Complete these items before submitting your host application.',
        'Progress',
        'Photos found',
        'Upload at least 3 photos',
        'Complete your bio',
        'Add your age',
        'Add sex / gender',
        'Add who you are seeking',
        'Add a headline',
        'Add your location',
        'Set your normally online hours',
        'Verify your ID',
        'Complete selfie verification',
        'Done',
        'Missing',
        'Everything is complete. Your application will move to under review automatically.',
        'Back to Profile',
        'Become a Host',
        'Submit for Review',
        'Fix & Resubmit Application',
        'Starting…',
        'Submitting…',
        'Resubmitting…',
        'Verification',
        'Upload your ID and selfie to begin manual verification.',
        'ID Verification',
        'Status: ',
        'ID file uploaded.',
        'No ID file uploaded yet.',
        'Uploading ID…',
        'Upload ID',
        'Selfie Verification',
        'Selfie file uploaded.',
        'No selfie file uploaded yet.',
        'Uploading Selfie…',
        'Upload Selfie',
        'Admin note:',
        'Application State',
        'Your host access changes based on your application progress.',
        'Current host state:',
        'Application Rejected:',
        'On Hold:',
        'Admin Notes:',
        'Fix the items noted above, then use the resubmit button to reopen your application.',
        'Host Settings',
        'These are your existing host-facing settings.',
        'Role',
        'Display Name',
        'Host Mode',
        'Payout Method',
        'Payout Details',
        'Select payout method',
        'PayPal',
        'GCash',
        'Bank',
        'Other',
        'Enter your PayPal email, GCash number, bank info, or other payout details',
        'Save Settings',
        'Saving…',
        'Log Out',
        'Loading...',
      ];

      const cacheKey = buildSettingsTranslationCacheKey('host-ui', targetLanguage, allTexts);
      const cached = readSettingsTranslationCache(cacheKey);

      if (cached) {
        if (isActive) {
          setTranslatedHostUiMap(cached);
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
          setTranslatedHostUiMap(map);
        }
      } catch (err) {
        console.error('translateHostUI error:', err);
      }
    }

    void translateHostUI();

    return () => {
      isActive = false;
    };
  }, [targetLanguage]);

  const hostStatus = useMemo(
    () => normalizeHostStatus(profile?.host_application_status),
    [profile]
  );

  const holdReason = profile?.host_hold_reason ?? null;
  const adminNotes = profile?.host_admin_notes ?? null;

  const idStatus = useMemo(
    () => normalizeVerificationStatus(profile?.id_verification_status),
    [profile]
  );

  const selfieStatus = useMemo(
    () => normalizeVerificationStatus(profile?.selfie_verification_status),
    [profile]
  );

  const checklist = useMemo(
    () => buildChecklist(profile, storagePhotoCount),
    [profile, storagePhotoCount]
  );

  const completedCount = checklist.filter((item) => item.complete).length;
  const totalCount = checklist.length;
  const allComplete = completedCount === totalCount;
  const tone = cardTone(hostStatus);

  const idReady = idStatus === 'approved';
  const selfieReady = selfieStatus === 'approved';
  const fullyReadyForReview = allComplete && idReady && selfieReady;

  async function saveSettings() {
    setSavingSettings(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    const cleanedName = username.trim();

    const { error } = await supabase
      .from('profiles')
      .update({
        host_mode: hostMode,
        username: cleanedName,
        payout_method: payoutMethod.trim() || null,
        payout_details: payoutDetails.trim() || null,
      })
      .eq('id', user.id);

    if (error) {
      setMessage(`❌ ${error.message}`);
      setSavingSettings(false);
      return;
    }

    setMessage('✅ Settings saved.');
    await loadProfile();
    setSavingSettings(false);
  }

  async function updateHostStatus(
    nextStatus: HostApplicationStatus,
    successMessage = '✅ Host status updated.'
  ) {
    setSavingStatus(true);
    setMessage(null);

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
        host_application_status: nextStatus,
      })
      .eq('id', user.id);

    if (error) {
      setMessage(`❌ ${error.message}`);
      setSavingStatus(false);
      return;
    }

    setMessage(successMessage);
    await loadProfile();
    setSavingStatus(false);
  }

  async function uploadVerificationFile(
    type: 'id' | 'selfie',
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage(null);

    const isId = type === 'id';
    if (isId) setUploadingId(true);
    else setUploadingSelfie(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      const safeExt = getSafeExtension(file.name);
      const filePath = `${user.id}/${type}-${Date.now()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const now = new Date().toISOString();

      const payload = isId
        ? {
            id_document_path: filePath,
            id_verification_status: 'submitted',
            id_submitted_at: now,
          }
        : {
            selfie_image_path: filePath,
            selfie_verification_status: 'submitted',
            selfie_submitted_at: now,
          };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        isId
          ? '✅ ID uploaded and marked as submitted.'
          : '✅ Selfie uploaded and marked as submitted.'
      );

      autoReviewTriggeredRef.current = false;
      await loadProfile();
    } catch (err: any) {
      setMessage(`❌ ${err?.message || 'Upload failed.'}`);
    } finally {
      if (isId) {
        setUploadingId(false);
        if (idInputRef.current) idInputRef.current.value = '';
      } else {
        setUploadingSelfie(false);
        if (selfieInputRef.current) selfieInputRef.current.value = '';
      }
    }
  }

  async function handleSubmitForReview() {
    if (!allComplete) {
      setMessage('❌ Please complete all checklist items before submitting.');
      return;
    }

    if (!idReady || !selfieReady) {
      setMessage('❌ ID and selfie verification must be approved before review.');
      return;
    }

    await updateHostStatus('under_review', '✅ Your host application is now under review.');
  }

  useEffect(() => {
    if (loading) return;
    if (savingStatus) return;
    if (!profile?.id) return;

    if (hostStatus === 'in_progress' && fullyReadyForReview && !autoReviewTriggeredRef.current) {
      autoReviewTriggeredRef.current = true;
      void updateHostStatus(
        'under_review',
        '✅ Everything is complete. Your application was automatically moved to under review.'
      );
      return;
    }

    if (hostStatus !== 'in_progress') {
      autoReviewTriggeredRef.current = false;
    }
  }, [fullyReadyForReview, hostStatus, loading, profile?.id, savingStatus]);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/auth');
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'white', background: '#0a0a0a', minHeight: '100vh' }}>
        {trSafe('Loading...')}
      </div>
    );
  }

  const idTone = verificationTone(idStatus);
  const selfieTone = verificationTone(selfieStatus);

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto', color: 'white' }}>
      <div
        style={{
          border: '1px solid #27272a',
          borderRadius: 24,
          padding: 24,
          background: '#111111',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 680px', minWidth: 280 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#a1a1aa',
                marginBottom: 8,
              }}
            >
              {trSafe('LoveF8 Host Area')}
            </div>
            <h1 style={{ margin: 0, fontSize: 34 }}>
              {trSafe('Welcome to the Host Dashboard')}
            </h1>

            <p style={{ marginTop: 10, color: '#d4d4d8', maxWidth: 760, lineHeight: 1.6 }}>
              {trSafe(
                'At LoveF8, Hosts have the opportunity to earn real money through tips while having genuine conversations with people who want to connect.'
              )}
            </p>

            <p style={{ marginTop: 10, color: '#d4d4d8', maxWidth: 760, lineHeight: 1.6 }}>
              {trSafe(
                'Many Hosts can earn $200 – $800+ per month while working flexible hours from home and choosing who they talk to.'
              )}
            </p>

            <div style={{ marginTop: 18, maxWidth: 760 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'white' }}>
                {trSafe('Why Hosts love it:')}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: '#18181b',
                    border: '1px solid #27272a',
                    color: '#f4f4f5',
                  }}
                >
                  {trSafe('Get paid for being yourself')}
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: '#18181b',
                    border: '1px solid #27272a',
                    color: '#f4f4f5',
                  }}
                >
                  {trSafe('No scripts or pressure')}
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: '#18181b',
                    border: '1px solid #27272a',
                    color: '#f4f4f5',
                  }}
                >
                  {trSafe('Real conversations with real people')}
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: '#18181b',
                    border: '1px solid #27272a',
                    color: '#f4f4f5',
                  }}
                >
                  {trSafe('Withdraw your earnings easily')}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 16,
                background: '#052e16',
                border: '1px solid #14532d',
                color: '#bbf7d0',
                fontWeight: 700,
                maxWidth: 760,
                lineHeight: 1.5,
              }}
            >
              {trSafe(
                'Ready to get started? Complete your profile and verification to submit your Host application.'
              )}
            </div>

            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                maxWidth: 760,
              }}
            >
              <div
                style={{
                  border: '1px solid #27272a',
                  borderRadius: 16,
                  padding: 16,
                  background: '#18181b',
                }}
              >
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>{trSafe('Pending')}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatCentsForCountry(earningsSummary.pending, profile?.country_origin)}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #27272a',
                  borderRadius: 16,
                  padding: 16,
                  background: '#18181b',
                }}
              >
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>{trSafe('Available')}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatCentsForCountry(earningsSummary.available, profile?.country_origin)}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #27272a',
                  borderRadius: 16,
                  padding: 16,
                  background: '#18181b',
                }}
              >
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>{trSafe('Paid')}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatCentsForCountry(earningsSummary.paid, profile?.country_origin)}
                </div>
              </div>
            </div>

                        <div
              style={{
                marginTop: 14,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
                            <button
                type="button"
                onClick={() => setForceEnglish((prev) => !prev)}
                style={{
                  display: 'inline-block',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: 'white',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {forceEnglish ? 'Use Selected Language' : 'View in English'}
              </button>
              <Link
                href="/messages"
                style={{
                  display: 'inline-block',
                  textDecoration: 'none',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                ← {trSafe('Back to Messages')}
              </Link>

              <Link
                href="/host/earnings"
                style={{
                  display: 'inline-block',
                  textDecoration: 'none',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                {trSafe('View Full Earnings')} →
              </Link>
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              color: tone.text,
              borderRadius: 999,
              padding: '10px 14px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {trSafe('Status:')} {prettyHostStatus(hostStatus)}
          </div>
        </div>
      </div>

      {message ? (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 14,
            background: '#18181b',
            border: '1px solid #27272a',
            color: '#f4f4f5',
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
          gap: 20,
        }}
      >
        <section
          style={{
            border: '1px solid #27272a',
            borderRadius: 24,
            padding: 24,
            background: '#111111',
          }}
        >
          <h2 style={{ marginTop: 0 }}>{trSafe('Host Readiness')}</h2>
          <p style={{ color: '#d4d4d8', marginTop: 8 }}>
  {trSafe('Complete these items before submitting your host application.')}
</p>

          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 18,
              background: '#18181b',
              border: '1px solid #27272a',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ color: '#a1a1aa', fontSize: 13 }}>{trSafe('Progress')}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {completedCount} / {totalCount} completed
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#a1a1aa', fontSize: 13 }}>{trSafe('Photos found')}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{storagePhotoCount}</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                height: 10,
                background: '#27272a',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(completedCount / totalCount) * 100}%`,
                  height: '100%',
                  background: 'white',
                  borderRadius: 999,
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            {checklist.map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 16,
                  background: '#18181b',
                  border: '1px solid #27272a',
                }}
              >
                <span style={{ color: '#f4f4f5' }}>{trSafe(item.label)}</span>

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '6px 10px',
                    background: item.complete ? '#052e16' : '#27272a',
                    color: item.complete ? '#bbf7d0' : '#d4d4d8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.complete ? trSafe('Done') : trSafe('Missing')}
                </span>
              </div>
            ))}
          </div>

          {hostStatus === 'in_progress' && fullyReadyForReview ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 16,
                background: '#052e16',
                border: '1px solid #14532d',
                color: '#bbf7d0',
                fontWeight: 700,
              }}
            >
              Everything is complete. Your application will move to under review automatically.
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              href="/settings"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                padding: '11px 14px',
                borderRadius: 14,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: 'white',
                fontWeight: 600,
              }}
            >
              Back to Profile
            </Link>

            {hostStatus === 'not_applied' ? (
              <button
                onClick={() => void updateHostStatus('in_progress')}
                disabled={savingStatus}
                style={{
                  padding: '11px 14px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'white',
                  color: 'black',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingStatus ? 'Starting…' : 'Become a Host'}
              </button>
            ) : null}

            {hostStatus === 'in_progress' && !fullyReadyForReview ? (
              <button
                onClick={() => void handleSubmitForReview()}
                disabled={savingStatus}
                style={{
                  padding: '11px 14px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'white',
                  color: 'black',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingStatus ? 'Submitting…' : 'Submit for Review'}
              </button>
            ) : null}

            {hostStatus === 'rejected' ? (
              <button
                onClick={() =>
                  void updateHostStatus(
                    'in_progress',
                    '✅ Your application has been reopened. Fix the items noted by admin and resubmit when ready.'
                  )
                }
                disabled={savingStatus}
                style={{
                  padding: '11px 14px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'white',
                  color: 'black',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingStatus ? 'Resubmitting…' : 'Fix & Resubmit Application'}
              </button>
            ) : null}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 20 }}>
          <div
            style={{
              border: '1px solid #27272a',
              borderRadius: 24,
              padding: 24,
              background: '#111111',
            }}
          >
            <h2 style={{ marginTop: 0 }}>{trSafe('Verification')}</h2>
            <p style={{ color: '#d4d4d8', marginTop: 8 }}>
             {trSafe('Upload your ID and selfie to begin manual verification.')}
</p>

            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 18,
                  background: idTone.bg,
                  border: `1px solid ${idTone.border}`,
                  color: idTone.text,
                }}
              >
                <div>{trSafe('ID Verification')}</div>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Status: {prettyVerificationStatus(idStatus)}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                  {profile?.id_document_path
                    ? 'ID file uploaded.'
                    : 'No ID file uploaded yet.'}
                </div>

                <div style={{ marginTop: 10 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'white',
                      color: 'black',
                      fontWeight: 700,
                      cursor: uploadingId ? 'not-allowed' : 'pointer',
                      opacity: uploadingId ? 0.6 : 1,
                    }}
                  >
                    {uploadingId ? 'Uploading ID…' : 'Upload ID'}
                    <input
                      ref={idInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => void uploadVerificationFile('id', e)}
                      disabled={uploadingId}
                    />
                  </label>
                </div>
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 18,
                  background: selfieTone.bg,
                  border: `1px solid ${selfieTone.border}`,
                  color: selfieTone.text,
                }}
              >
                <div>{trSafe('Selfie Verification')}</div>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Status: {prettyVerificationStatus(selfieStatus)}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                  {profile?.selfie_image_path
                    ? 'Selfie file uploaded.'
                    : 'No selfie file uploaded yet.'}
                </div>

                <div style={{ marginTop: 10 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'white',
                      color: 'black',
                      fontWeight: 700,
                      cursor: uploadingSelfie ? 'not-allowed' : 'pointer',
                      opacity: uploadingSelfie ? 0.6 : 1,
                    }}
                  >
                    {uploadingSelfie ? 'Uploading Selfie…' : 'Upload Selfie'}
                    <input
                      ref={selfieInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => void uploadVerificationFile('selfie', e)}
                      disabled={uploadingSelfie}
                    />
                  </label>
                </div>
              </div>
            </div>

            {profile?.verification_notes ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 14,
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#e4e4e7',
                }}
              >
                Admin note: {profile.verification_notes}
              </div>
            ) : null}
          </div>

          <div
            style={{
              border: '1px solid #27272a',
              borderRadius: 24,
              padding: 24,
              background: '#111111',
            }}
          >
            <h2 style={{ marginTop: 0 }}>{trSafe('Application State')}</h2>
            <p style={{ color: '#d4d4d8', marginTop: 8 }}>
              {trSafe('Your host access changes based on your application progress.')}
</p>

            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 18,
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#f4f4f5',
              }}
            >
              Current host state: <strong>{prettyHostStatus(hostStatus)}</strong>
            </div>

            {hostStatus === 'rejected' && holdReason ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: '#450a0a',
                  border: '1px solid #7f1d1d',
                  color: '#fecaca',
                  fontWeight: 600,
                }}
              >
                ❌ Application Rejected: {holdReason}
              </div>
            ) : null}

            {hostStatus === 'under_review' && holdReason ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: '#451a03',
                  border: '1px solid #854d0e',
                  color: '#fde68a',
                  fontWeight: 600,
                }}
              >
                ⚠️ On Hold: {holdReason}
              </div>
            ) : null}

            {adminNotes ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#e4e4e7',
                }}
              >
                📝 Admin Notes: {adminNotes}
              </div>
            ) : null}
            {hostStatus === 'rejected' ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#f4f4f5',
                }}
              >
                {trSafe('Fix the items noted above, then use the resubmit button to reopen your application.')}
              </div>
            ) : null}
          </div>

          <div
            style={{
              border: '1px solid #27272a',
              borderRadius: 24,
              padding: 24,
              background: '#111111',
            }}
          >
            <h2 style={{ marginTop: 0 }}>{trSafe('Host Settings')}</h2>
            <p style={{ color: '#d4d4d8', marginTop: 8 }}>
              {trSafe('These are your existing host-facing settings.')}
            </p>

            <div style={{ marginTop: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{trSafe('Role')}</div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: '#18181b',
                    border: '1px solid #27272a',
                    color: '#f4f4f5',
                  }}
                >
                  {role || '(unknown)'}
                </div>
              </div>

              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                {trSafe('Display Name')}
              </label>

              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: 'white',
                  width: '100%',
                  marginBottom: 14,
                }}
              />

              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                {trSafe('Host Mode')}
              </label>

              <select
                value={hostMode}
                onChange={(e) => setHostMode(e.target.value as HostMode)}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: 'white',
                  width: '100%',
                }}
              >
                <option value="chatty">Chatty</option>
                <option value="flirty">Flirty</option>
                <option value="romantic">Romantic</option>
              </select>

              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginTop: 14,
                  marginBottom: 8,
                }}
              >
                {trSafe('Payout Method')}
              </label>

              <select
                value={payoutMethod}
                onChange={(e) => {
                  setPayoutMethod(e.target.value);
                  setPayoutDetails('');
                }}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: 'white',
                  width: '100%',
                }}
              >
                <option value="">{trSafe('Select payout method')}</option>
                <option value="paypal">{trSafe('PayPal')}</option>
                <option value="gcash">{trSafe('GCash')}</option>
                <option value="bank">{trSafe('Bank')}</option>
                <option value="other">{trSafe('Other')}</option>
              </select>

              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginTop: 14,
                  marginBottom: 8,
                }}
              >
                {trSafe('Payout Details')}
              </label>

              <textarea
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder={trSafe('Enter your PayPal email, GCash number, bank info, or other payout details')}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: 'white',
                  width: '100%',
                  minHeight: 100,
                  resize: 'vertical',
                }}
              />

              <button
                onClick={() => void saveSettings()}
                disabled={savingSettings}
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 14,
                  border: 'none',
                  background: 'white',
                  color: 'black',
                  cursor: 'pointer',
                  width: '100%',
                  fontWeight: 700,
                }}
              >
                {savingSettings ? trSafe('Saving…') : trSafe('Save Settings')}
              </button>
            </div>
          </div>
        </section>
      </div>

      <button
        onClick={() => void logout()}
        style={{
          marginTop: 24,
          padding: 12,
          borderRadius: 14,
          border: '1px solid #3f3f46',
          background: '#18181b',
          color: 'white',
          cursor: 'pointer',
          width: '100%',
          fontWeight: 700,
        }}
      >
        {trSafe('Log Out')}
      </button>
    </main>
  );
}