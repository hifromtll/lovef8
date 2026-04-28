'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminNav from '../AdminNav';

type VerificationRow = {
  id: string;
  username: string | null;
  host_application_status: string | null;
  id_verification_status: string | null;
  selfie_verification_status: string | null;
  verification_notes: string | null;
  id_submitted_at: string | null;
  selfie_submitted_at: string | null;
  id_document_path: string | null;
  selfie_image_path: string | null;
};

type PreviewState = {
  url: string;
  title: string;
  kind: 'image' | 'document';
} | null;

export default function AdminVerificationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'submitted' | 'approved' | 'rejected' | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesByUser, setNotesByUser] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);

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
          host_application_status,
          id_verification_status,
          selfie_verification_status,
          verification_notes,
          id_submitted_at,
          selfie_submitted_at,
          id_document_path,
          selfie_image_path
        `)
        .order('id_submitted_at', { ascending: false, nullsFirst: false });

      if (rowsError) throw rowsError;

      const safeRows = (data ?? []) as VerificationRow[];
      setRows(safeRows);

      const nextNotes: Record<string, string> = {};
      for (const row of safeRows) {
        nextNotes[row.id] = row.verification_notes ?? '';
      }
      setNotesByUser(nextNotes);

      if (safeRows.length > 0) {
        setSelectedId((prev) => prev ?? safeRows[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load verifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

 const filteredRows = useMemo(() => {
  const q = search.trim().toLowerCase();

  return rows.filter((row) => {
    const username = (row.username ?? '').toLowerCase();
    const id = row.id.toLowerCase();

    const matchesSearch =
      q.length === 0 || username.includes(q) || id.includes(q);

    const idStatus = row.id_verification_status ?? 'not_started';
    const selfieStatus = row.selfie_verification_status ?? 'not_started';

    const hasVerificationCase =
      !!row.id_document_path ||
      !!row.selfie_image_path ||
      ['submitted', 'approved', 'rejected'].includes(idStatus) ||
      ['submitted', 'approved', 'rejected'].includes(selfieStatus);

    let matchesStatus = true;

    if (statusFilter === 'submitted') {
      matchesStatus =
        idStatus === 'submitted' || selfieStatus === 'submitted';
    } else if (statusFilter === 'approved') {
      matchesStatus =
        idStatus === 'approved' || selfieStatus === 'approved';
    } else if (statusFilter === 'rejected') {
      matchesStatus =
        idStatus === 'rejected' || selfieStatus === 'rejected';
    }

    return matchesSearch && hasVerificationCase && matchesStatus;
  });
}, [rows, search, statusFilter]);

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

  const selectedRow = filteredRows.find((row) => row.id === selectedId) ?? null;

  async function createPreview(
    title: string,
    path: string,
    fallbackKind: 'image' | 'document'
  ) {
    try {
      const { data, error } = await supabase.storage
        .from('verification-files')
        .createSignedUrl(path, 60 * 10);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Could not generate signed URL.');

      const lower = path.toLowerCase();
      const isImage =
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.webp');

      setPreview({
        url: data.signedUrl,
        title,
        kind: isImage ? 'image' : fallbackKind,
      });
    } catch (err: any) {
      alert(err?.message ?? 'Could not preview file.');
    }
  }

  async function updateVerificationStatus(
    userId: string,
    field: 'id_verification_status' | 'selfie_verification_status',
    value: 'approved' | 'rejected'
  ) {
    setSavingId(`${userId}:${field}`);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const patch: Record<string, any> = {
        [field]: value,
      };

      if (field === 'id_verification_status') {
        patch.id_reviewed_at = new Date().toISOString();
        patch.id_reviewed_by = user?.id ?? null;
      }

      if (field === 'selfie_verification_status') {
        patch.selfie_reviewed_at = new Date().toISOString();
        patch.selfie_reviewed_by = user?.id ?? null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId);

      if (error) throw error;

      setRows((prev) =>
        prev.map((row) =>
          row.id === userId ? { ...row, [field]: value } : row
        )
      );
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update verification status.');
    } finally {
      setSavingId(null);
    }
  }

  async function saveNotes(userId: string) {
    setSavingId(`${userId}:notes`);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          verification_notes: notesByUser[userId] ?? '',
        })
        .eq('id', userId);

      if (error) throw error;

      setRows((prev) =>
        prev.map((row) =>
          row.id === userId
            ? { ...row, verification_notes: notesByUser[userId] ?? '' }
            : row
        )
      );
    } catch (err: any) {
      alert(err?.message ?? 'Failed to save notes.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <AdminNav />
          <h1 className="text-3xl font-semibold">Admin Verifications</h1>
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
            <h1 className="text-3xl font-semibold">Admin Verifications</h1>
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
          <h1 className="text-3xl font-semibold">Admin Verifications</h1>
          <p className="mt-2 text-sm text-white/70">
            Review queue for ID and selfie submissions.
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
            placeholder="Search by username or user id..."
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
          />

          <div className="flex flex-wrap gap-2">
            <FilterButton active={statusFilter === 'submitted'} onClick={() => setStatusFilter('submitted')} label="Submitted" />
            <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')} label="Approved" />
            <FilterButton active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')} label="Rejected" />
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="All" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="mb-3 px-2 text-sm text-white/60">
              Results: {filteredRows.length}
            </div>

            <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
              {filteredRows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  No verification records found.
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
                          {formatDate(row.id_submitted_at || row.selfie_submitted_at)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <MiniStatus label="ID" value={row.id_verification_status || 'not_submitted'} />
                        <MiniStatus label="Selfie" value={row.selfie_verification_status || 'not_submitted'} />
                        <MiniStatus label="Host" value={row.host_application_status || 'not_applied'} />
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
                Select a verification case to review.
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
                  <StatusCard label="ID Status" value={selectedRow.id_verification_status || 'not_submitted'} />
                  <StatusCard label="Selfie Status" value={selectedRow.selfie_verification_status || 'not_submitted'} />
                  <StatusCard label="Host Status" value={selectedRow.host_application_status || 'not_applied'} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-medium">ID File</p>
                    <p className="mt-2 text-xs text-white/50">
                      {selectedRow.id_document_path ? 'File uploaded' : 'No file uploaded'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!selectedRow.id_document_path}
                        onClick={() =>
                          selectedRow.id_document_path
                            ? createPreview('ID File Preview', selectedRow.id_document_path, 'document')
                            : null
                        }
                        className="rounded-xl border border-white/15 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Preview ID
                      </button>

                      <button
                        type="button"
                        disabled={savingId === `${selectedRow.id}:id_verification_status`}
                        onClick={() =>
                          updateVerificationStatus(selectedRow.id, 'id_verification_status', 'approved')
                        }
                        className="rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={savingId === `${selectedRow.id}:id_verification_status`}
                        onClick={() =>
                          updateVerificationStatus(selectedRow.id, 'id_verification_status', 'rejected')
                        }
                        className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-medium">Selfie File</p>
                    <p className="mt-2 text-xs text-white/50">
                      {selectedRow.selfie_image_path ? 'File uploaded' : 'No file uploaded'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!selectedRow.selfie_image_path}
                        onClick={() =>
                          selectedRow.selfie_image_path
                            ? createPreview('Selfie File Preview', selectedRow.selfie_image_path, 'image')
                            : null
                        }
                        className="rounded-xl border border-white/15 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Preview Selfie
                      </button>

                      <button
                        type="button"
                        disabled={savingId === `${selectedRow.id}:selfie_verification_status`}
                        onClick={() =>
                          updateVerificationStatus(selectedRow.id, 'selfie_verification_status', 'approved')
                        }
                        className="rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={savingId === `${selectedRow.id}:selfie_verification_status`}
                        onClick={() =>
                          updateVerificationStatus(selectedRow.id, 'selfie_verification_status', 'rejected')
                        }
                        className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-medium">Verification Notes</p>
                    <textarea
                      value={notesByUser[selectedRow.id] ?? ''}
                      onChange={(e) =>
                        setNotesByUser((prev) => ({
                          ...prev,
                          [selectedRow.id]: e.target.value,
                        }))
                      }
                      placeholder="Add internal notes..."
                      className="mt-3 min-h-[180px] w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white outline-none"
                    />
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={savingId === `${selectedRow.id}:notes`}
                        onClick={() => saveNotes(selectedRow.id)}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                      >
                        Save Notes
                      </button>
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-white/50">
                      <p>ID submitted: {selectedRow.id_submitted_at || '—'}</p>
                      <p>Selfie submitted: {selectedRow.selfie_submitted_at || '—'}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-medium">File Preview</p>

                    {!preview ? (
                      <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/50">
                        No file selected yet.
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm text-white/80">{preview.title}</p>
                          <a
                            href={preview.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-white/15 px-3 py-2 text-xs"
                          >
                            Open Full File
                          </a>
                        </div>

                        {preview.kind === 'image' ? (
                          <img
                            src={preview.url}
                            alt={preview.title}
                            className="max-h-[480px] w-full rounded-2xl border border-white/10 object-contain"
                          />
                        ) : (
                          <iframe
                            src={preview.url}
                            title={preview.title}
                            className="h-[480px] w-full rounded-2xl border border-white/10 bg-white"
                          />
                        )}
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

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm ${
        active
          ? 'border border-orange-500/40 bg-orange-500/10 text-white'
          : 'border border-white/10 bg-white/5 text-white/75'
      }`}
    >
      {label}
    </button>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  const tone =
    value === 'approved'
      ? 'border-green-500/30 bg-green-500/10 text-green-200'
      : value === 'rejected'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : value === 'submitted' || value === 'under_review'
      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
      : 'border-white/10 bg-black/30 text-white';

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  const tone =
    value === 'approved'
      ? 'bg-green-500/15 text-green-200'
      : value === 'rejected'
      ? 'bg-red-500/15 text-red-200'
      : value === 'submitted' || value === 'under_review'
      ? 'bg-yellow-500/15 text-yellow-200'
      : 'bg-white/10 text-white/75';

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] ${tone}`}>
      {label}: {value}
    </span>
  );
}

function shortId(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatDate(value: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString();
}