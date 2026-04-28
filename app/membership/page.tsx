'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { formatMoneyFromCountry } from '@/lib/currency';

type MembershipTier = 'free' | 'basic' | 'plus' | 'premium';

type Profile = {
  id: string;
  country_origin: string | null;
  membership_tier: MembershipTier | null;
  membership_status: string | null;
  membership_sparks_monthly: number | null;
  membership_spark_balance: number | null;
  membership_renews_at: string | null;
  membership_expires_at: string | null;
  membership_auto_renew: boolean | null;
};

type Plan = {
  name: string;
  price: number;
  sparks: number;
  weeklySparks: number;
  tier: MembershipTier;
};

const PLANS: Plan[] = [
  { name: 'Basic', price: 8.99, sparks: 1000, weeklySparks: 250, tier: 'basic' },
  { name: 'Plus', price: 17.99, sparks: 2200, weeklySparks: 550, tier: 'plus' },
  { name: 'Premium', price: 22.99, sparks: 3200, weeklySparks: 800, tier: 'premium' },
];

function getNextRenewalDateIso() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(0, 1, 0, 0);
  return date.toISOString();
}

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleString();
}

export default function MembershipPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [savingAutoRenew, setSavingAutoRenew] = useState(false);

  const activePlan = useMemo(() => {
    if (!profile?.membership_tier) return null;
    return PLANS.find((p) => p.tier === profile.membership_tier) || null;
  }, [profile?.membership_tier]);

  const displayCountry = profile?.country_origin ?? 'United States';

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          country_origin,
          membership_tier,
          membership_status,
          membership_sparks_monthly,
          membership_spark_balance,
          membership_renews_at,
          membership_expires_at,
          membership_auto_renew
        `)
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('membership load error:', error);
      } else {
        setProfile(data as Profile);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  async function handleSelectPlan(plan: Plan) {
    if (!profile) return;

    const isSamePlan =
      profile.membership_tier === plan.tier && profile.membership_status === 'active';

    if (isSamePlan) {
      alert('That plan is already active.');
      return;
    }

    setSavingTier(plan.tier);

    const expiresAt = getNextRenewalDateIso();

    const { error } = await supabase
      .from('profiles')
      .update({
        membership_tier: plan.tier,
        membership_status: 'active',
        membership_sparks_monthly: plan.sparks,
        membership_spark_balance: plan.sparks,
        membership_expires_at: expiresAt,
        membership_renews_at: expiresAt,
      })
      .eq('id', profile.id);

    setSavingTier(null);

    if (error) {
      alert(error.message);
      return;
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            membership_tier: plan.tier,
            membership_status: 'active',
            membership_sparks_monthly: plan.sparks,
            membership_spark_balance: plan.sparks,
            membership_expires_at: expiresAt,
            membership_renews_at: expiresAt,
          }
        : prev
    );

    alert(`${plan.name} activated.`);
  }

  async function handleToggleAutoRenew() {
    if (!profile) return;

    const nextValue = !(profile.membership_auto_renew ?? true);
    setSavingAutoRenew(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        membership_auto_renew: nextValue,
      })
      .eq('id', profile.id);

    setSavingAutoRenew(false);

    if (error) {
      alert(error.message);
      return;
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            membership_auto_renew: nextValue,
          }
        : prev
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_40%,#f6f4ff_100%)] px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[24px] border border-fuchsia-100/80 bg-white/85 px-4 py-3 text-sm font-semibold text-neutral-700 shadow-[0_18px_45px_rgba(83,34,115,0.10)] backdrop-blur">
            Loading membership...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_40%,#f6f4ff_100%)] px-4 py-6 text-neutral-900">
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

      <div className="relative mx-auto max-w-5xl">
        <div className="rounded-[24px] border border-fuchsia-100/80 bg-white/84 p-3 shadow-[0_18px_45px_rgba(83,34,115,0.10)] backdrop-blur lg:p-4">
          <div className="flex flex-col gap-3 border-b border-fuchsia-100/80 pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-fuchsia-200/70 bg-white/80 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-fuchsia-700 shadow-sm">
                LoveF8 Membership
              </div>

              <h1 className="mt-3 text-[30px] font-black tracking-tight text-neutral-950 sm:text-[38px]">
                Membership
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-[15px]">
                Membership renews at 12:01 AM on the renewal date. Your full plan value is shown
                below, while sparks are delivered weekly through the month. Booster sparks stay
                separate and are available immediately after purchase.
              </p>
            </div>

            <div className="grid gap-2 sm:min-w-[220px]">
              <button
                onClick={() => router.push('/wallet')}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 shadow-sm transition hover:bg-amber-100"
              >
                Go to Wallet
              </button>

              <button
                onClick={() => router.push('/messages')}
                className="rounded-xl border border-fuchsia-100 bg-white/90 px-4 py-2.5 text-sm font-bold text-neutral-900 shadow-sm transition hover:bg-fuchsia-50"
              >
                Back to Messages
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <StatCard label="Current Plan" value={activePlan?.name || 'Free'} tone="pink" />
            <StatCard
              label="Status"
              value={profile?.membership_status || 'inactive'}
              tone="purple"
              capitalize
            />
            <StatCard
              label="Monthly Sparks"
              value={String(profile?.membership_sparks_monthly || 0)}
              tone="blue"
            />
            <StatCard
              label="Membership Balance"
              value={String(profile?.membership_spark_balance || 0)}
              tone="pink"
            />
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <div className="rounded-md border border-violet-200 bg-violet-50/90 px-2.5 py-1 shadow-sm">
              <div className="text-[9px] font-bold uppercase tracking-wide text-violet-700">
                Expires
              </div>
              <div className="text-xs font-bold leading-tight text-violet-950">
                {formatDate(profile?.membership_expires_at || null)}
              </div>
              <div className="text-[9px] leading-tight text-violet-800">
                {formatDateTime(profile?.membership_expires_at || null)}
              </div>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-1 shadow-sm">
              <div className="text-[9px] font-bold uppercase tracking-wide text-amber-700">
                Renews
              </div>
              <div className="text-xs font-bold leading-tight text-amber-950">
                {formatDate(profile?.membership_renews_at || null)}
              </div>
              <div className="text-[9px] leading-tight text-amber-800">
                {formatDateTime(profile?.membership_renews_at || null)}
              </div>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between border-t border-fuchsia-100 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Auto Renew
              </span>
              <span className="text-sm font-semibold text-emerald-900">
                {profile?.membership_auto_renew ? 'On' : 'Off'}
              </span>
            </div>

            <button
              onClick={() => void handleToggleAutoRenew()}
              disabled={savingAutoRenew}
              className={[
                'rounded-md px-2.5 py-1 text-xs font-bold transition',
                profile?.membership_auto_renew
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800',
                savingAutoRenew ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              {savingAutoRenew
                ? 'Saving...'
                : profile?.membership_auto_renew
                  ? 'Turn Off'
                  : 'Turn On'}
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-fuchsia-100 bg-white/75 p-4 text-sm leading-6 text-neutral-700 shadow-sm">
            Choosing a plan resets your spark balance for a new cycle.
            Booster sparks are separate and available instantly after purchase.
          </div>

          <div className="mt-6 space-y-4">
            {PLANS.map((plan) => {
              const isActive =
                profile?.membership_tier === plan.tier && profile?.membership_status === 'active';
              const isSaving = savingTier === plan.tier;
              const isRecommended = plan.tier === 'plus';

              return (
                <div
                  key={plan.tier}
                  className={`rounded-[24px] border p-5 shadow-[0_18px_36px_rgba(91,33,182,0.06)] ${
                    isRecommended
                      ? 'border-violet-300 bg-violet-50/40'
                      : 'border-fuchsia-100/80 bg-white/92'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-neutral-950">{plan.name}</h2>

                        {isRecommended && (
                          <span className="rounded-full bg-violet-600 px-2 py-1 text-xs font-bold text-white">
                            Most Popular
                          </span>
                        )}

                        {isActive && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-neutral-500">
                        {plan.sparks} sparks total
                      </div>

                      <div className="mt-1 text-xs font-medium text-neutral-500">
                        {plan.weeklySparks} sparks every week for 4 weeks
                      </div>
                    </div>

                    <div className="shrink-0 text-2xl font-black text-neutral-950">
                      {formatMoneyFromCountry(plan.price, displayCountry)}
                    </div>
                  </div>

                  <button
                    onClick={() => void handleSelectPlan(plan)}
                    disabled={isSaving}
                    className={[
                      'mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold shadow-sm transition',
                      isActive
                        ? 'border border-fuchsia-100 bg-white text-neutral-900 hover:bg-fuchsia-50'
                        : 'bg-gradient-to-r from-fuchsia-600 via-pink-500 to-violet-600 text-white hover:opacity-95',
                      isSaving ? 'cursor-not-allowed opacity-60' : '',
                    ].join(' ')}
                  >
                    {isSaving
                      ? 'Saving...'
                      : isActive
                        ? 'Current Plan'
                        : 'Start Membership'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  capitalize = false,
}: {
  label: string;
  value: string;
  tone: 'pink' | 'purple' | 'blue';
  capitalize?: boolean;
}) {
  const toneMap = {
    pink: {
      background:
        'linear-gradient(135deg, rgba(255,63,157,0.10) 0%, rgba(255,255,255,0.96) 100%)',
      border: 'border-fuchsia-100',
      valueColor: 'text-fuchsia-700',
    },
    purple: {
      background:
        'linear-gradient(135deg, rgba(139,44,245,0.10) 0%, rgba(255,255,255,0.96) 100%)',
      border: 'border-violet-100',
      valueColor: 'text-violet-700',
    },
    blue: {
      background:
        'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(255,255,255,0.96) 100%)',
      border: 'border-sky-100',
      valueColor: 'text-sky-700',
    },
  } as const;

  const selected = toneMap[tone];

  return (
    <div
      className={`rounded-lg border ${selected.border} px-3 py-1.5 shadow-sm`}
      style={{ background: selected.background }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{label}</div>
      <div
        className={`mt-0 text-[1.05rem] leading-none font-black ${selected.valueColor} ${capitalize ? 'capitalize' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}