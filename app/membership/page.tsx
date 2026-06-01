'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

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
  note: string;
};

const PLANS: Plan[] = [
  {
    name: 'Basic',
    price: 8.99,
    sparks: 1000,
    weeklySparks: 250,
    tier: 'basic',
    note: 'Good starting package',
  },
  {
    name: 'Plus',
    price: 17.99,
    sparks: 2200,
    weeklySparks: 550,
    tier: 'plus',
    note: 'Most popular',
  },
  {
    name: 'Premium',
    price: 22.99,
    sparks: 3200,
    weeklySparks: 800,
    tier: 'premium',
    note: 'Best monthly spark package',
  },
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

function formatUsd(price: number) {
  return `$${price.toFixed(2)} USD`;
}

function formatPlanName(value: string | null | undefined) {
  if (!value || value === 'free') return 'Free';
  return value.charAt(0).toUpperCase() + value.slice(1);
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

  const currentPlanName = activePlan?.name || formatPlanName(profile?.membership_tier);
  const statusText = profile?.membership_status || 'inactive';
  const monthlySparks = profile?.membership_sparks_monthly || 0;
  const balance = profile?.membership_spark_balance || 0;
  const autoRenewOn = profile?.membership_auto_renew ?? true;

  useEffect(() => {
    async function load() {
      setLoading(true);

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
        alert(error.message);
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_40%,#f6f4ff_100%)] px-4 py-5">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-fuchsia-100 bg-white/85 px-5 py-4 text-sm font-bold text-neutral-700 shadow-[0_18px_45px_rgba(83,34,115,0.10)] backdrop-blur">
            Loading membership...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(255,83,164,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_40%,#f6f4ff_100%)] px-3 py-4 text-neutral-900 sm:px-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: "url('/lovef8-bg.png')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center top 42px',
          backgroundSize: 'min(620px, 82vw)',
          filter: 'blur(1px)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.42)_18%,rgba(255,255,255,0.90)_100%)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="rounded-[28px] border border-fuchsia-100/80 bg-white/86 p-4 shadow-[0_18px_45px_rgba(83,34,115,0.10)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 border-b border-fuchsia-100/80 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-fuchsia-200/70 bg-white/80 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-fuchsia-700 shadow-sm">
                LoveF8 Membership
              </div>

              <h1 className="mt-3 text-[32px] font-black tracking-tight text-neutral-950 sm:text-[42px]">
                Membership
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                Choose a package, manage auto-renew, and see your current membership spark balance.
                Booster sparks are handled separately in Wallet.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
              <button
                type="button"
                onClick={() => router.push('/home')}
                className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-sm font-black text-fuchsia-800 shadow-sm transition hover:bg-fuchsia-100"
              >
                Home
              </button>

              <button
                type="button"
                onClick={() => router.push('/wallet')}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900 shadow-sm transition hover:bg-amber-100"
              >
                Wallet
              </button>

              <button
                type="button"
                onClick={() => router.push('/messages')}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-black text-blue-900 shadow-sm transition hover:bg-blue-100"
              >
                Messages
              </button>
            </div>
          </div>

          <section className="mt-4 rounded-3xl border border-violet-100 bg-white/78 p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <MiniStat label="Current Plan" value={currentPlanName} tone="pink" />
              <MiniStat label="Status" value={statusText} tone="purple" capitalize />
              <MiniStat label="Monthly Sparks" value={String(monthlySparks)} tone="blue" />
              <MiniStat label="Balance" value={String(balance)} tone="amber" />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-600">
                  Expires
                </div>
                <div className="mt-1 text-sm font-black text-violet-950">
                  {formatDate(profile?.membership_expires_at || null)}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                  Renews
                </div>
                <div className="mt-1 text-sm font-black text-amber-950">
                  {formatDate(profile?.membership_renews_at || null)}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    Auto Renew
                  </div>
                  <div className="mt-1 text-sm font-black text-emerald-950">
                    {autoRenewOn ? 'On' : 'Off'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleAutoRenew()}
                  disabled={savingAutoRenew}
                  className={[
                    'rounded-xl px-3 py-2 text-xs font-black shadow-sm transition',
                    autoRenewOn
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800',
                    savingAutoRenew ? 'cursor-not-allowed opacity-60' : '',
                  ].join(' ')}
                >
                  {savingAutoRenew ? 'Saving...' : autoRenewOn ? 'Turn Off' : 'Turn On'}
                </button>
              </div>
            </div>
          </section>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-neutral-950">Plans</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Membership sparks are shown as the full monthly package and weekly delivery amount.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const isActive =
                profile?.membership_tier === plan.tier && profile?.membership_status === 'active';
              const isSaving = savingTier === plan.tier;
              const isRecommended = plan.tier === 'plus';

              return (
                <section
                  key={plan.tier}
                  className={[
                    'rounded-[24px] border p-4 shadow-[0_14px_30px_rgba(91,33,182,0.06)]',
                    isRecommended
                      ? 'border-violet-300 bg-violet-50/60'
                      : 'border-fuchsia-100/80 bg-white/92',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black text-neutral-950">{plan.name}</h3>

                        {isRecommended && (
                          <span className="rounded-full bg-violet-600 px-2 py-1 text-[11px] font-black text-white">
                            Most Popular
                          </span>
                        )}

                        {isActive && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                            Active
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-neutral-500">
                        {plan.note}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xl font-black text-neutral-950">
                        {formatUsd(plan.price)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-neutral-100 bg-white/80 p-3">
                    <div className="text-sm font-black text-neutral-800">
                      FREE UNLIMITED Messages
                    </div>

                    <div className="mt-2 grid gap-2 text-sm text-neutral-600">
                      <div className="flex justify-between gap-3">
                        <span>Total sparks</span>
                        <span className="font-black text-neutral-950">{plan.sparks}</span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span>Weekly delivery</span>
                        <span className="font-black text-neutral-950">
                          {plan.weeklySparks} / week
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSelectPlan(plan)}
                    disabled={isSaving}
                    className={[
                      'mt-4 w-full rounded-xl px-4 py-3 text-sm font-black shadow-sm transition',
                      isActive
                        ? 'border border-fuchsia-100 bg-white text-neutral-900 hover:bg-fuchsia-50'
                        : 'bg-gradient-to-r from-fuchsia-600 via-pink-500 to-violet-600 text-white hover:opacity-95',
                      isSaving ? 'cursor-not-allowed opacity-60' : '',
                    ].join(' ')}
                  >
                    {isSaving ? 'Saving...' : isActive ? 'Current Plan' : 'Start Membership'}
                  </button>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

function MiniStat({
  label,
  value,
  tone,
  capitalize = false,
}: {
  label: string;
  value: string;
  tone: 'pink' | 'purple' | 'blue' | 'amber';
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
    amber: {
      background:
        'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(255,255,255,0.96) 100%)',
      border: 'border-amber-100',
      valueColor: 'text-amber-700',
    },
  } as const;

  const selected = toneMap[tone];

  return (
    <div
      className={`rounded-2xl border ${selected.border} px-4 py-3 shadow-sm`}
      style={{ background: selected.background }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </div>

      <div
        className={`mt-1 text-xl font-black leading-none ${selected.valueColor} ${
          capitalize ? 'capitalize' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}