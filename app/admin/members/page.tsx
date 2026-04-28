'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminNav from '../AdminNav';

type UserRow = {
  id: string;
  username: string | null;
  app_role: string | null;
  host_application_status: string | null;
  id_verification_status: string | null;
  selfie_verification_status: string | null;
  lifetime_sparks_received: number | null;
  payout_status: string | null;
  account_status: string | null;
  can_login: boolean | null;
  can_send_messages: boolean | null;
  can_receive_messages: boolean | null;
  can_purchase_sparks: boolean | null;
  can_receive_sparks: boolean | null;
  can_withdraw_earnings: boolean | null;
  admin_notes: string | null;
  moderation_reason: string | null;
};

type AdminActionRow = {
  id: string;
  action_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
};

export default function AdminMembersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [notesByUser, setNotesByUser] = useState<Record<string, string>>({});
  const [reasonByUser, setReasonByUser] = useState<Record<string, string>>({});
  const [actionLog, setActionLog] = useState<AdminActionRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);

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

      const { data, error: rowsError } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          app_role,
          host_application_status,
          id_verification_status,
          selfie_verification_status,
          lifetime_sparks_received,
          payout_status,
          account_status,
          can_login,
          can_send_messages,
          can_receive_messages,
          can_purchase_sparks,
          can_receive_sparks,
          can_withdraw_earnings,
          admin_notes,
          moderation_reason
        `)
        .order('username', { ascending: true });

      if (rowsError) throw rowsError;

      const safeRows = (data ?? []) as UserRow[];
      setRows(safeRows);

      const nextNotes: Record<string, string> = {};
      const nextReasons: Record<string, string> = {};

      for (const row of safeRows) {
        nextNotes[row.id] = row.admin_notes ?? '';
        nextReasons[row.id] = row.moderation_reason ?? '';
      }

      setNotesByUser(nextNotes);
      setReasonByUser(nextReasons);

      if (safeRows.length > 0) {
        setSelectedId((prev) => prev ?? safeRows[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  async function loadActionLog(userId: string) {
    setLogLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_actions')
        .select(`
          id,
          action_type,
          field_name,
          old_value,
          new_value,
          reason,
          created_at
        `)
        .eq('target_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setActionLog((data ?? []) as AdminActionRow[]);
    } catch (err) {
      console.error(err);
      setActionLog([]);
    } finally {
      setLogLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const username = (row.username ?? '').toLowerCase();
      return q.length === 0 || username.includes(q) || row.id.toLowerCase().includes(q);
    });
  }, [rows, search]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedId(null);
      return;
    }

    const stillExists = filteredRows.some((row) => row.id === selectedId);
    if (!stillExists) {
      setSelectedId(filteredRows[0].id);
    }
  }, [filteredRows, selectedId]);

  useEffect(() => {
    if (selectedId) {
      loadActionLog(selectedId);
    } else {
      setActionLog([]);
    }
  }, [selectedId]);

  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? null;

  async function logAdminAction(args: {
    targetProfileId: string;
    actionType: string;
    fieldName?: string;
    oldValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('admin_actions').insert({
      target_profile_id: args.targetProfileId,
      admin_profile_id: user?.id ?? null,
      action_type: args.actionType,
      field_name: args.fieldName ?? null,
      old_value: args.oldValue ?? null,
      new_value: args.newValue ?? null,
      reason: args.reason ?? null,
    });
  }

  async function updateField(
    userId: string,
    fieldName: keyof UserRow,
    newValue: string | boolean | null,
    actionType: string
  ) {
    const row = rows.find((r) => r.id === userId);
    if (!row) return;

    const saveKey = `${userId}:${String(fieldName)}`;
    setSavingKey(saveKey);

    try {
      const patch: Record<string, any> = {
        [fieldName]: newValue,
      };

      if (fieldName === 'account_status') {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        patch.account_status_changed_at = new Date().toISOString();
        patch.account_status_changed_by = user?.id ?? null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction({
        targetProfileId: userId,
        actionType,
        fieldName: String(fieldName),
        oldValue: row[fieldName] == null ? null : String(row[fieldName]),
        newValue: newValue == null ? null : String(newValue),
        reason: reasonByUser[userId] ?? '',
      });

      setRows((prev) =>
        prev.map((item) =>
          item.id === userId ? { ...item, [fieldName]: newValue } : item
        )
      );

      if (selectedId === userId) {
        loadActionLog(userId);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update user field.');
    } finally {
      setSavingKey(null);
    }
  }

  async function saveNotes(userId: string) {
    setSavingKey(`${userId}:notes`);

    try {
      const existing = rows.find((r) => r.id === userId);

      const { error } = await supabase
        .from('profiles')
        .update({
          admin_notes: notesByUser[userId] ?? '',
          moderation_reason: reasonByUser[userId] ?? '',
        })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction({
        targetProfileId: userId,
        actionType: 'save_notes',
        fieldName: 'admin_notes',
        oldValue: existing?.admin_notes ?? null,
        newValue: notesByUser[userId] ?? '',
        reason: reasonByUser[userId] ?? '',
      });

      setRows((prev) =>
        prev.map((row) =>
          row.id === userId
            ? {
                ...row,
                admin_notes: notesByUser[userId] ?? '',
                moderation_reason: reasonByUser[userId] ?? '',
              }
            : row
        )
      );

      if (selectedId === userId) {
        loadActionLog(userId);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Failed to save notes.');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <AdminNav />
          <h1 className="text-3xl font-semibold">Users</h1>
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
            <h1 className="text-3xl font-semibold">Users</h1>
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
          <h1 className="text-3xl font-semibold">Users</h1>
          <p className="mt-2 text-sm text-white/70">
            Core account control, restrictions, and admin notes.
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
              Results: {filteredRows.length}
            </div>

            <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
              {filteredRows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No users found.
                </div>
              ) : (
                filteredRows.map((row) => {
                  const selected = row.id === selectedId;

                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-orange-500/40 bg-orange-500/10'
                          : 'border-white/10 bg-black/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {row.username || 'Unnamed user'}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {shortId(row.id)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-white/45">
                          {row.account_status || 'active'}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <MiniStatus label="Role" value={row.app_role || 'member'} />
                        <MiniStatus label="Host" value={row.host_application_status || 'not_applied'} />
                        <MiniStatus label="Payout" value={row.payout_status || 'not_set'} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            {!selectedRow ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/50">
                Select a user to review.
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {selectedRow.username || 'Unnamed user'}
                  </h2>
                  <p className="mt-1 break-all text-xs text-white/45">
                    User ID: {selectedRow.id}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <StatusCard label="Account Status" value={selectedRow.account_status || 'active'} />
                  <StatusCard label="Role" value={selectedRow.app_role || 'member'} />
                  <StatusCard label="Host Status" value={selectedRow.host_application_status || 'not_applied'} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <StatusCard label="ID Status" value={selectedRow.id_verification_status || 'not_submitted'} />
                  <StatusCard label="Selfie Status" value={selectedRow.selfie_verification_status || 'not_submitted'} />
                  <InfoCard label="Lifetime Sparks" value={String(selectedRow.lifetime_sparks_received ?? 0)} />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <h3 className="text-lg font-semibold">Account Status Controls</h3>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      label="Set Active"
                      busy={savingKey === `${selectedRow.id}:account_status`}
                      onClick={() =>
                        updateField(selectedRow.id, 'account_status', 'active', 'set_account_active')
                      }
                    />
                    <ActionButton
                      label="Freeze"
                      busy={savingKey === `${selectedRow.id}:account_status`}
                      onClick={() =>
                        updateField(selectedRow.id, 'account_status', 'frozen', 'freeze_account')
                      }
                    />
                    <ActionButton
                      label="Suspend"
                      busy={savingKey === `${selectedRow.id}:account_status`}
                      onClick={() =>
                        updateField(selectedRow.id, 'account_status', 'suspended', 'suspend_account')
                      }
                    />
                    <ActionButton
                      label="Deactivate"
                      busy={savingKey === `${selectedRow.id}:account_status`}
                      onClick={() =>
                        updateField(selectedRow.id, 'account_status', 'deactivated', 'deactivate_account')
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <h3 className="text-lg font-semibold">Permissions</h3>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <PermissionCard
                      label="Can Login"
                      value={!!selectedRow.can_login}
                      busy={savingKey === `${selectedRow.id}:can_login`}
                      onEnable={() =>
                        updateField(selectedRow.id, 'can_login', true, 'enable_login')
                      }
                      onDisable={() =>
                        updateField(selectedRow.id, 'can_login', false, 'disable_login')
                      }
                    />

                    <PermissionCard
                      label="Can Send Messages"
                      value={!!selectedRow.can_send_messages}
                      busy={savingKey === `${selectedRow.id}:can_send_messages`}
                      onEnable={() =>
                        updateField(selectedRow.id, 'can_send_messages', true, 'enable_send_messages')
                      }
                      onDisable={() =>
                        updateField(selectedRow.id, 'can_send_messages', false, 'disable_send_messages')
                      }
                    />

                    <PermissionCard
                      label="Can Receive Messages"
                      value={!!selectedRow.can_receive_messages}
                      busy={savingKey === `${selectedRow.id}:can_receive_messages`}
                      onEnable={() =>
                        updateField(selectedRow.id, 'can_receive_messages', true, 'enable_receive_messages')
                      }
                      onDisable={() =>
                        updateField(selectedRow.id, 'can_receive_messages', false, 'disable_receive_messages')
                      }
                    />

                    <PermissionCard
                      label="Can Purchase Sparks"
                      value={!!selectedRow.can_purchase_sparks}
                      busy={savingKey === `${selectedRow.id}:can_purchase_sparks`}
                      onEnable={() =>
                        updateField(selectedRow.id, 'can_purchase_sparks', true, 'enable_purchase_sparks')
                      }
                      onDisable={() =>
                        updateField(selectedRow.id, 'can_purchase_sparks', false, 'disable_purchase_sparks')
                      }
                    />

                    <PermissionCard
                      label="Can Receive Sparks"
                      value={!!selectedRow.can_receive_sparks}
                      busy={savingKey === `${selectedRow.id}:can_receive_sparks`}
                      onEnable={() =>
                        updateField(selectedRow.id, 'can_receive_sparks', true, 'enable_receive_sparks')
                      }
                      onDisable={() =>
                        updateField(selectedRow.id, 'can_receive_sparks', false, 'disable_receive_sparks')
                      }
                    />

                    <PermissionCard
                      label="Can Withdraw Earnings"
                      value={!!selectedRow.can_withdraw_earnings}
                      busy={savingKey === `${selectedRow.id}:can_withdraw_earnings`}
                      onEnable={() =>
                        updateField(selectedRow.id, 'can_withdraw_earnings', true, 'enable_withdraw_earnings')
                      }
                      onDisable={() =>
                        updateField(selectedRow.id, 'can_withdraw_earnings', false, 'disable_withdraw_earnings')
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-medium">Moderation Reason</p>
                    <textarea
                      value={reasonByUser[selectedRow.id] ?? ''}
                      onChange={(e) =>
                        setReasonByUser((prev) => ({
                          ...prev,
                          [selectedRow.id]: e.target.value,
                        }))
                      }
                      placeholder="Why are you freezing, suspending, or restricting this account?"
                      className="mt-3 min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white outline-none"
                    />

                    <p className="mt-4 text-sm font-medium">Admin Notes</p>
                    <textarea
                      value={notesByUser[selectedRow.id] ?? ''}
                      onChange={(e) =>
                        setNotesByUser((prev) => ({
                          ...prev,
                          [selectedRow.id]: e.target.value,
                        }))
                      }
                      placeholder="Internal admin notes..."
                      className="mt-3 min-h-[180px] w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white outline-none"
                    />

                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={savingKey === `${selectedRow.id}:notes`}
                        onClick={() => saveNotes(selectedRow.id)}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-medium">Recent Admin Actions</p>

                    {logLoading ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                        Loading action log...
                      </div>
                    ) : actionLog.length === 0 ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                        No admin actions recorded yet.
                      </div>
                    ) : (
                      <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                        {actionLog.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-black/20 p-3"
                          >
                            <p className="text-sm font-medium text-white">{item.action_type}</p>
                            <p className="mt-1 text-xs text-white/50">
                              Field: {item.field_name || '—'}
                            </p>
                            <p className="mt-1 text-xs text-white/50">
                              From: {item.old_value || '—'} → To: {item.new_value || '—'}
                            </p>
                            <p className="mt-1 text-xs text-white/50">
                              Reason: {item.reason || '—'}
                            </p>
                            <p className="mt-1 text-xs text-white/40">
                              {formatDateTime(item.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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

function StatusCard({ label, value }: { label: string; value: string }) {
  const tone =
    value === 'active' || value === 'approved' || value === 'member'
      ? 'border-green-500/30 bg-green-500/10 text-green-200'
      : value === 'frozen' || value === 'submitted' || value === 'under_review'
      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
      : value === 'suspended' || value === 'deactivated' || value === 'rejected'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-white/10 bg-black/30 text-white';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
      <p className="mt-2 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
      {label}: {value}
    </span>
  );
}

function ActionButton({
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
      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {busy ? 'Saving...' : label}
    </button>
  );
}

function PermissionCard({
  label,
  value,
  busy,
  onEnable,
  onDisable,
}: {
  label: string;
  value: boolean;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-medium">{label}</p>
      <p className={`mt-2 text-sm ${value ? 'text-green-300' : 'text-red-300'}`}>
        {value ? 'Enabled' : 'Disabled'}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onEnable}
          className="rounded-xl bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Enable
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onDisable}
          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Disable
        </button>
      </div>
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