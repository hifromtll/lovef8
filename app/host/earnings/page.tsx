'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatMoneyFromCountry } from '@/lib/currency';

type EarningRow = {
  id: string;
  spark_kind: string;
  spark_amount: number;
  gross_value_cents: number;
  host_earning_cents: number;
  platform_earning_cents: number;
  earning_status: string;
  source_type: string | null;
  source_id: string | null;
  note: string | null;
  created_at: string;
};

type HostProfile = {
  id: string;
  country_origin: string | null;
};

export default function HostEarningsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EarningRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<HostProfile | null>(null);

  async function loadPage() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, country_origin')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfile((profileData ?? null) as HostProfile | null);

      const { data, error } = await supabase
        .from('earnings_ledger')
        .select(`
          id,
          spark_kind,
          spark_amount,
          gross_value_cents,
          host_earning_cents,
          platform_earning_cents,
          earning_status,
          source_type,
          source_id,
          note,
          created_at
        `)
        .eq('receiver_profile_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRows((data ?? []) as EarningRow[]);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load earnings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const cents = Number(row.host_earning_cents ?? 0);

        if (row.earning_status === 'pending') acc.pending += cents;
        if (row.earning_status === 'available') acc.available += cents;
        if (row.earning_status === 'paid') acc.paid += cents;

        acc.all += cents;
        return acc;
      },
      { pending: 0, available: 0, paid: 0, all: 0 }
    );
  }, [rows]);

  const displayCountry = profile?.country_origin ?? 'United States';

  async function requestPayout() {
    setPayoutMessage(null);
    setRequestingPayout(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      if (totals.available <= 0) {
        setPayoutMessage('No available earnings to request.');
        setRequestingPayout(false);
        return;
      }

      const { error } = await supabase.from('payout_requests').insert({
        profile_id: user.id,
        status: 'pending',
      });

      if (error) throw error;

      setPayoutMessage('✅ Payout request sent.');
    } catch (err: any) {
      setPayoutMessage(err?.message ?? 'Failed to request payout.');
    } finally {
      setRequestingPayout(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-semibold">My Earnings</h1>
          <p className="mt-4 text-white/70">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">My Earnings</h1>
            <p className="mt-2 text-sm text-white/70">
              Track pending, available, and paid earnings from Sparks.
            </p>
          </div>

          <Link
            href="/host"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Back to Host Dashboard
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {payoutMessage ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/90">
            {payoutMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MoneyCard label="Pending" value={formatCentsForCountry(totals.pending, displayCountry)} />
          <MoneyCard
            label="Available"
            value={formatCentsForCountry(totals.available, displayCountry)}
          />
          <MoneyCard label="Paid" value={formatCentsForCountry(totals.paid, displayCountry)} />
          <MoneyCard label="Lifetime" value={formatCentsForCountry(totals.all, displayCountry)} />
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => void requestPayout()}
            disabled={requestingPayout || totals.available <= 0}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requestingPayout ? 'Requesting…' : 'Request Payout'}
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-xl font-semibold">Earnings History</h2>

          {rows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              No earnings yet.
            </div>
          ) : (
            <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {row.spark_kind} · {row.spark_amount} Sparks
                      </p>

                      <div className="mt-1">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${getStatusStyles(
                            row.earning_status
                          )}`}
                        >
                          {prettyStatus(row.earning_status)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium text-white">
                        {formatCentsForCountry(row.host_earning_cents, displayCountry)}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {formatDateTime(row.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-white/50 md:grid-cols-3">
                    <div>
                      Gross Value: {formatCentsForCountry(row.gross_value_cents, displayCountry)}
                    </div>
                    <div>
                      Host Earnings:{' '}
                      {formatCentsForCountry(row.host_earning_cents, displayCountry)}
                    </div>
                    <div>
                      Platform Share:{' '}
                      {formatCentsForCountry(row.platform_earning_cents, displayCountry)}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-white/50">
                    Note: {row.note || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function MoneyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'pending':
      return 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    case 'available':
      return 'border border-blue-500/30 bg-blue-500/10 text-blue-400';
    case 'paid':
      return 'border border-green-500/30 bg-green-500/10 text-green-400';
    case 'hold':
      return 'border border-orange-500/30 bg-orange-500/10 text-orange-400';
    case 'reversed':
      return 'border border-red-500/30 bg-red-500/10 text-red-400';
    default:
      return 'border border-white/10 bg-white/10 text-white/70';
  }
}

function prettyStatus(status: string) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'available':
      return 'Available';
    case 'paid':
      return 'Paid';
    case 'hold':
      return 'Hold';
    case 'reversed':
      return 'Reversed';
    default:
      return status || 'Unknown';
  }
}

function formatCentsForCountry(
  value: number | null | undefined,
  country: string | null | undefined
) {
  const cents = Number(value ?? 0);
  return formatMoneyFromCountry(cents / 100, country);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}