'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminNav from '../AdminNav';

type UserRow = {
  id: string;
  username: string | null;
  spark_balance: number | null;
};

type SparkTransaction = {
  id: string;
  profile_id: string;
  admin_profile_id: string | null;
  transaction_type: string;
  direction: string;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  source_type: string | null;
  source_id: string | null;
  note: string | null;
  created_at: string;
};

export default function AdminWalletPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [transactions, setTransactions] = useState<SparkTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('');
  const [saving, setSaving] = useState(false);

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

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, spark_balance')
        .order('username', { ascending: true });

      if (usersError) throw usersError;

      const safeUsers = (usersData ?? []) as UserRow[];
      setUsers(safeUsers);

      if (safeUsers.length > 0) {
        setSelectedId((prev) => prev ?? safeUsers[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load wallet page.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(profileId: string) {
    const { data, error } = await supabase
      .from('spark_transactions')
      .select(`
        id,
        profile_id,
        admin_profile_id,
        transaction_type,
        direction,
        amount,
        balance_before,
        balance_after,
        source_type,
        source_id,
        note,
        created_at
      `)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      setTransactions([]);
      return;
    }

    setTransactions((data ?? []) as SparkTransaction[]);
  }

  useEffect(() => {
    loadPage();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((user) => {
      const username = (user.username ?? '').toLowerCase();
      return q.length === 0 || username.includes(q) || user.id.toLowerCase().includes(q);
    });
  }, [users, search]);

  useEffect(() => {
    if (!filteredUsers.length) {
      setSelectedId(null);
      return;
    }

    const stillExists = filteredUsers.some((user) => user.id === selectedId);
    if (!stillExists) {
      setSelectedId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedId]);

  useEffect(() => {
    if (selectedId) {
      loadTransactions(selectedId);
    } else {
      setTransactions([]);
    }
  }, [selectedId]);

  const selectedUser = filteredUsers.find((user) => user.id === selectedId) ?? null;

  async function applyManualAdjustment() {
    if (!selectedUser) return;

    const amount = Number(adjustAmount);

    if (!Number.isInteger(amount) || amount <= 0) {
      alert('Enter a whole number greater than 0.');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user: adminUser },
      } = await supabase.auth.getUser();

      const balanceBefore = Number(selectedUser.spark_balance ?? 0);
      const balanceAfter =
        adjustType === 'credit'
          ? balanceBefore + amount
          : balanceBefore - amount;

      if (balanceAfter < 0) {
        alert('This debit would make the spark balance go below 0.');
        setSaving(false);
        return;
      }

      const txType =
        adjustType === 'credit' ? 'admin_credit' : 'admin_debit';
      const direction =
        adjustType === 'credit' ? 'in' : 'out';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          spark_balance: balanceAfter,
        })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      const { error: txError } = await supabase
        .from('spark_transactions')
        .insert({
          profile_id: selectedUser.id,
          admin_profile_id: adminUser?.id ?? null,
          transaction_type: txType,
          direction,
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          source_type: 'admin_manual',
          source_id: null,
          note: adjustReason || null,
        });

      if (txError) throw txError;

      await supabase.from('admin_actions').insert({
        target_profile_id: selectedUser.id,
        admin_profile_id: adminUser?.id ?? null,
        action_type: txType,
        field_name: 'spark_balance',
        old_value: String(balanceBefore),
        new_value: String(balanceAfter),
        reason: adjustReason || null,
      });

      setAdjustAmount('');
      setAdjustReason('');

      await loadPage();
      await loadTransactions(selectedUser.id);
    } catch (err: any) {
      alert(err?.message ?? 'Failed to apply wallet adjustment.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <AdminNav />
          <h1 className="text-3xl font-semibold">Wallet</h1>
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
            <h1 className="text-3xl font-semibold">Wallet</h1>
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
          <h1 className="text-3xl font-semibold">Wallet</h1>
          <p className="mt-2 text-sm text-white/70">
            Spark balances, transaction history, and manual admin adjustments.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by username or user id..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 px-2 text-sm text-white/60">
              Results: {filteredUsers.length}
            </div>

            <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No users found.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const selected = user.id === selectedId;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-orange-500/40 bg-orange-500/10'
                          : 'border-white/10 bg-black/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {user.username || 'Unnamed user'}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {shortId(user.id)}
                          </p>
                        </div>

                        <div className="text-right text-xs text-white/45">
                          {Number(user.spark_balance ?? 0)} sparks
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            {!selectedUser ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/50">
                Select a user to review wallet activity.
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {selectedUser.username || 'Unnamed user'}
                  </h2>
                  <p className="mt-1 break-all text-xs text-white/45">
                    User ID: {selectedUser.id}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoCard
                    label="Current Spark Balance"
                    value={String(selectedUser.spark_balance ?? 0)}
                  />
                  <InfoCard
                    label="Transactions Loaded"
                    value={String(transactions.length)}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <h3 className="text-lg font-semibold">Manual Adjustment</h3>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <select
                      value={adjustType}
                      onChange={(e) => setAdjustType(e.target.value as 'credit' | 'debit')}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="credit">Credit Sparks</option>
                      <option value="debit">Debit Sparks</option>
                    </select>

                    <input
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="Amount"
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                    />

                    <button
                      type="button"
                      disabled={saving}
                      onClick={applyManualAdjustment}
                      className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-medium text-black disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Apply Adjustment'}
                    </button>
                  </div>

                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Reason for this adjustment..."
                    className="mt-3 min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <h3 className="text-lg font-semibold">Transaction History</h3>

                  {transactions.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                      No transactions yet.
                    </div>
                  ) : (
                    <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto pr-1">
                      {transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {tx.transaction_type}
                              </p>
                              <p className="mt-1 text-xs text-white/50">
                                Direction: {tx.direction}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-medium text-white">
                                {tx.amount}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {formatDateTime(tx.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-white/50">
                            Before: {tx.balance_before ?? '—'} → After: {tx.balance_after ?? '—'}
                          </div>

                          <div className="mt-1 text-xs text-white/50">
                            Source: {tx.source_type || '—'}
                          </div>

                          <div className="mt-1 text-xs text-white/50">
                            Note: {tx.note || '—'}
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
      <p className="mt-2 break-words text-sm font-medium text-white">{value}</p>
    </div>
  );
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