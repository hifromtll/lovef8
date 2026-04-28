'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminNav from '../AdminNav';

type HostRow = {
  id: string;
  username: string | null;
  payout_method?: string | null;
  payout_details?: string | null;
};

type EarningsRow = {
  id: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  spark_kind: string;
  spark_amount: number;
  gross_value_cents: number;
  host_share_percent: number;
  platform_share_percent: number;
  host_earning_cents: number;
  platform_earning_cents: number;
  earning_status: string;
  source_type: string | null;
  source_id: string | null;
  note: string | null;
  created_at: string;
};

type StatusFilter =
  | 'all'
  | 'pending'
  | 'available'
  | 'hold'
  | 'paid'
  | 'reversed';

type StatusValue = Exclude<StatusFilter, 'all'>;

type BatchResult = {
  ok?: boolean;
  payout_id?: string;
  amount_cents?: number;
  earnings_count?: number;
};

export default function AdminEarningsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [rows, setRows] = useState<EarningsRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [runningBatch, setRunningBatch] = useState(false);

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

      const { data: me, error: meError } = await supabase
        .from('profiles')
        .select('app_role')
        .eq('id', user.id)
        .single();

      if (meError) throw meError;

      const admin = me?.app_role === 'admin';
      setIsAdmin(admin);

      if (!admin) {
        setLoading(false);
        return;
      }

      const { data: hostData, error: hostError } = await supabase
        .from('profiles')
        .select('id, username, payout_method, payout_details')
        .in('host_application_status', [
          'approved',
          'under_review',
          'rejected',
          'in_progress',
        ])
        .order('username', { ascending: true });

      if (hostError) throw hostError;

      const safeHosts = (hostData ?? []) as HostRow[];
      setHosts(safeHosts);

      if (safeHosts.length > 0) {
        setSelectedId((prev) => prev ?? safeHosts[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load earnings page.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRows(receiverProfileId: string) {
    const { data, error } = await supabase
      .from('earnings_ledger')
      .select(`
        id,
        sender_profile_id,
        receiver_profile_id,
        spark_kind,
        spark_amount,
        gross_value_cents,
        host_share_percent,
        platform_share_percent,
        host_earning_cents,
        platform_earning_cents,
        earning_status,
        source_type,
        source_id,
        note,
        created_at
      `)
      .eq('receiver_profile_id', receiverProfileId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error(error);
      setRows([]);
      return;
    }

    setRows((data ?? []) as EarningsRow[]);
  }

  useEffect(() => {
    void loadPage();
  }, []);

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return hosts.filter((host) => {
      const username = (host.username ?? '').toLowerCase();
      const payoutMethod = (host.payout_method ?? '').toLowerCase();
      const payoutDetails = (host.payout_details ?? '').toLowerCase();

      return (
        q.length === 0 ||
        username.includes(q) ||
        payoutMethod.includes(q) ||
        payoutDetails.includes(q) ||
        host.id.toLowerCase().includes(q)
      );
    });
  }, [hosts, search]);

  useEffect(() => {
    if (!filteredHosts.length) {
      setSelectedId(null);
      return;
    }

    const stillExists = filteredHosts.some((host) => host.id === selectedId);
    if (!stillExists) {
      setSelectedId(filteredHosts[0].id);
    }
  }, [filteredHosts, selectedId]);

  useEffect(() => {
    if (selectedId) {
      void loadRows(selectedId);
    } else {
      setRows([]);
    }
  }, [selectedId]);

  const selectedHost = filteredHosts.find((host) => host.id === selectedId) ?? null;

  const visibleRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((row) => row.earning_status === statusFilter);
  }, [rows, statusFilter]);

  const totals = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => {
        acc.gross += row.gross_value_cents ?? 0;
        acc.host += row.host_earning_cents ?? 0;
        acc.platform += row.platform_earning_cents ?? 0;

        if (row.earning_status === 'pending') acc.pending += row.host_earning_cents ?? 0;
        if (row.earning_status === 'available') acc.available += row.host_earning_cents ?? 0;
        if (row.earning_status === 'paid') acc.paid += row.host_earning_cents ?? 0;

        return acc;
      },
      { gross: 0, host: 0, platform: 0, pending: 0, available: 0, paid: 0 }
    );
  }, [visibleRows]);

  async function updateStatus(earningId: string, newStatus: StatusValue) {
    setSavingKey(earningId);

    try {
      const { data: earning, error: fetchError } = await supabase
        .from('earnings_ledger')
        .select(`
          id,
          receiver_profile_id,
          host_earning_cents,
          earning_status
        `)
        .eq('id', earningId)
        .single();

      if (fetchError) throw fetchError;
      if (!earning) throw new Error('Earning not found.');

      const wasAlreadyPaid = earning.earning_status === 'paid';

      const { error: updateError } = await supabase
        .from('earnings_ledger')
        .update({ earning_status: newStatus })
        .eq('id', earningId);

      if (updateError) throw updateError;

      if (newStatus === 'paid' && !wasAlreadyPaid) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('payout_method, payout_details')
          .eq('id', earning.receiver_profile_id)
          .single();

        if (profileError) throw profileError;

        const { error: payoutError } = await supabase.from('payouts').insert({
          profile_id: earning.receiver_profile_id,
          amount_cents: earning.host_earning_cents,
          method: profile?.payout_method ?? 'unknown',
          details_snapshot: profile?.payout_details ?? '',
          notes: `Manual single payout from earning ${earning.id}`,
        });

        if (payoutError) throw payoutError;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === earningId ? { ...row, earning_status: newStatus } : row
        )
      );
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update earning status.');
    } finally {
      setSavingKey(null);
    }
  }

  async function runMonthlyPayoutBatch() {
    if (!selectedHost) return;

    if (!selectedHost.payout_method || !selectedHost.payout_details) {
      alert('This host is missing payout method or payout details.');
      return;
    }

    if (totals.available <= 0) {
      alert('This host has no available earnings to pay.');
      return;
    }

    const ok = confirm(
      `Run monthly payout for ${selectedHost.username || 'this host'}?\n\n` +
        `Amount: ${formatCents(totals.available)}\n` +
        `Method: ${prettyMethod(selectedHost.payout_method)}`
    );

    if (!ok) return;

    setRunningBatch(true);

    try {
      const { data, error } = await supabase.rpc('run_host_payout_batch', {
        p_host_id: selectedHost.id,
        p_notes: 'Monthly payout batch',
      });

      if (error) throw error;

      const result = (data ?? {}) as BatchResult;

      await loadRows(selectedHost.id);

      alert(
        `Payout batch complete.\n\n` +
          `Amount: ${formatCents(result.amount_cents ?? 0)}\n` +
          `Items: ${result.earnings_count ?? 0}`
      );
    } catch (err: any) {
      alert(err?.message ?? 'Failed to run payout batch.');
    } finally {
      setRunningBatch(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <AdminNav />
          <h1 className="text-3xl font-semibold">Earnings</h1>
          <p className="mt-4 text-white/70">Loading...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <AdminNav />
          <div className="rounded-3xl border border-red-500/30 bg-white/5 p-6">
            <h1 className="text-3xl font-semibold">Earnings</h1>
            <p className="mt-4 text-red-300">Access denied. Your account is not an admin.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNav />

        <div className="mb-6">
          <h1 className="text-3xl font-semibold">Earnings</h1>
          <p className="mt-2 text-sm text-white/70">
            Safe monthly payout workflow for host earnings from Spark activity.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hosts by username, payout info, or user id..."
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="available">Available</option>
            <option value="hold">Hold</option>
            <option value="paid">Paid</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 px-2 text-sm text-white/60">
              Results: {filteredHosts.length}
            </div>

            <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
              {filteredHosts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No hosts found.
                </div>
              ) : (
                filteredHosts.map((host) => {
                  const selected = host.id === selectedId;

                  return (
                    <button
                      key={host.id}
                      type="button"
                      onClick={() => setSelectedId(host.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-orange-500/40 bg-orange-500/10'
                          : 'border-white/10 bg-black/20 hover:bg-white/5'
                      }`}
                    >
                      <p className="font-medium text-white">
                        {host.username || 'Unnamed host'}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {shortId(host.id)}
                      </p>
                      <p className="mt-2 text-xs text-white/50">
                        Method: {prettyMethod(host.payout_method)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            {!selectedHost ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/50">
                Select a host to review earnings.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {selectedHost.username || 'Unnamed host'}
                    </h2>
                    <p className="mt-1 break-all text-xs text-white/45">
                      User ID: {selectedHost.id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void runMonthlyPayoutBatch()}
                    disabled={runningBatch || totals.available <= 0}
                    className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm font-bold text-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {runningBatch ? 'Running Payout…' : 'Run Monthly Payout'}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <InfoCard label="Gross Value" value={formatCents(totals.gross)} />
                  <InfoCard label="Host Earnings" value={formatCents(totals.host)} />
                  <InfoCard label="Platform Share" value={formatCents(totals.platform)} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <InfoCard label="Pending" value={formatCents(totals.pending)} />
                  <InfoCard label="Available" value={formatCents(totals.available)} />
                  <InfoCard label="Paid" value={formatCents(totals.paid)} />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <h3 className="text-lg font-semibold">Payout Info</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <InfoCard
                      label="Payout Method"
                      value={prettyMethod(selectedHost.payout_method)}
                    />
                    <InfoCard
                      label="Payout Details"
                      value={selectedHost.payout_details?.trim() || 'Not provided'}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <h3 className="text-lg font-semibold">Earnings History</h3>

                  {visibleRows.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                      No earnings found.
                    </div>
                  ) : (
                    <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                      {visibleRows.map((row) => (
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
                                  className={`rounded-full border px-2 py-1 text-xs ${getStatusStyles(
                                    row.earning_status
                                  )}`}
                                >
                                  {prettyStatus(row.earning_status)}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-medium text-white">
                                {formatCents(row.host_earning_cents)}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {formatDateTime(row.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-white/50 md:grid-cols-3">
                            <div>Gross Value: {formatCents(row.gross_value_cents)}</div>
                            <div>Host Earnings: {formatCents(row.host_earning_cents)}</div>
                            <div>Platform Share: {formatCents(row.platform_earning_cents)}</div>
                          </div>

                          <div className="mt-2 text-xs text-white/50">
                            Split: {row.host_share_percent}% / {row.platform_share_percent}%
                          </div>

                          <div className="mt-2 text-xs text-white/50">
                            Note: {row.note || '—'}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <SmallButton
                              label="Pending"
                              busy={savingKey === row.id}
                              onClick={() => updateStatus(row.id, 'pending')}
                            />
                            <SmallButton
                              label="Available"
                              busy={savingKey === row.id}
                              onClick={() => updateStatus(row.id, 'available')}
                            />
                            <SmallButton
                              label="Hold"
                              busy={savingKey === row.id}
                              onClick={() => updateStatus(row.id, 'hold')}
                            />
                            <SmallButton
                              label="Paid"
                              busy={savingKey === row.id}
                              onClick={() => updateStatus(row.id, 'paid')}
                            />
                            <SmallButton
                              label="Reverse"
                              busy={savingKey === row.id}
                              onClick={() => updateStatus(row.id, 'reversed')}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-white">
        {value}
      </p>
    </div>
  );
}

function SmallButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white disabled:opacity-50"
    >
      {busy ? 'Saving...' : label}
    </button>
  );
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'pending':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    case 'available':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    case 'paid':
      return 'border-green-500/30 bg-green-500/10 text-green-400';
    case 'hold':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-400';
    case 'reversed':
      return 'border-red-500/30 bg-red-500/10 text-red-400';
    default:
      return 'border-white/10 bg-white/10 text-white/70';
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

function prettyMethod(value: string | null | undefined) {
  switch (value) {
    case 'paypal':
      return 'PayPal';
    case 'gcash':
      return 'GCash';
    case 'bank':
      return 'Bank';
    case 'other':
      return 'Other';
    default:
      return 'Not provided';
  }
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatCents(value: number | null | undefined) {
  const cents = Number(value ?? 0);
  return `$${(cents / 100).toFixed(2)}`;
}