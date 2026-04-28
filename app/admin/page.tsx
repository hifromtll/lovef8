'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AdminNav from './AdminNav';

type AdminCounts = {
  submittedVerifications: number;
  approvedHosts: number;
  totalMembers: number;
};

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [counts, setCounts] = useState<AdminCounts>({
    submittedVerifications: 0,
    approvedHosts: 0,
    totalMembers: 0,
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }

  useEffect(() => {
    async function load() {
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

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select(
            'id, host_application_status, id_verification_status, selfie_verification_status'
          );

        if (profilesError) throw profilesError;

        const rows = profiles ?? [];

        const submittedVerifications = rows.filter(
          (row) =>
            row.id_verification_status === 'submitted' ||
            row.selfie_verification_status === 'submitted'
        ).length;

        const approvedHosts = rows.filter(
          (row) => row.host_application_status === 'approved'
        ).length;

        const totalMembers = rows.length;

        setCounts({
          submittedVerifications,
          approvedHosts,
          totalMembers,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <AdminNav />

          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold">Admin Control Center</h1>

            <button
              onClick={handleSignOut}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
            >
              Sign out
            </button>
          </div>

          <p className="mt-4 text-white/70">Loading...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-6xl">
          <AdminNav />

          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold">Admin Control Center</h1>

            <button
              onClick={handleSignOut}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
            >
              Sign out
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-red-500/30 bg-white/5 p-6">
            <p className="text-red-300">
              Access denied. Your account is not an admin.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <AdminNav />

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Admin Control Center</h1>

          <button
            onClick={handleSignOut}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            Sign out
          </button>
        </div>

        <p className="mt-2 text-sm text-white/70">
          Review members, hosts, and verification operations.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <CountCard
            label="Pending Verifications"
            value={counts.submittedVerifications}
          />
          <CountCard label="Approved Hosts" value={counts.approvedHosts} />
          <CountCard label="Total Members" value={counts.totalMembers} />
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <a
            href="/admin/verifications"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
          >
            <h2 className="text-xl font-semibold">Verifications</h2>
            <p className="mt-2 text-sm text-white/70">
              Queue view for submitted ID and selfie reviews.
            </p>
          </a>

          <a
            href="/admin/hosts"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
          >
            <h2 className="text-xl font-semibold">Hosts</h2>
            <p className="mt-2 text-sm text-white/70">
              Approved host list, spark totals, and payout status.
            </p>
          </a>

          <a
            href="/admin/members"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
          >
            <h2 className="text-xl font-semibold">Members</h2>
            <p className="mt-2 text-sm text-white/70">
              Full user directory with role, host status, and verification summary.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}