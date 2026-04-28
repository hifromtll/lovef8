'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type AdminTicketRow = {
  id: string;
  created_at: string;
  status: string;
  category: string;
  title: string;
  page_path: string;
  created_by: string;
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadAdminTickets() {
      setLoading(true);
      setMessage('');

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('auth getUser error:', userError);
        setMessage(`Error loading user: ${userError.message}`);
        setLoading(false);
        return;
      }

      if (!user) {
        setMessage('You must be logged in.');
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, app_role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('admin profile error:', profileError);
        setMessage(`Error loading profile: ${profileError.message}`);
        setLoading(false);
        return;
      }

      if (!profile || profile.app_role !== 'admin') {
        setMessage('You do not have access to the admin ticket queue.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, created_at, status, category, title, page_path, created_by')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('admin tickets error:', error);
        setMessage(`Error loading admin tickets: ${error.message}`);
        setLoading(false);
        return;
      }

      setTickets((data || []) as AdminTicketRow[]);
      setLoading(false);
    }

    loadAdminTickets();
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Admin Tickets</h1>
          <span className="rounded-full border px-3 py-1 text-sm font-semibold">
            {tickets.length}
          </span>
        </div>

        <Link href="/guide/issues" className="rounded border px-4 py-2">
          Guide Queue
        </Link>
      </div>

      {loading ? <p>Loading admin tickets...</p> : null}
      {message ? <p className="mb-4 text-sm">{message}</p> : null}

      {!loading && !message && tickets.length === 0 ? (
        <div className="rounded border p-4">
          <p>No tickets found.</p>
        </div>
      ) : null}

      {!loading && tickets.length > 0 ? (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/admin/tickets/${ticket.id}`}
              className="block rounded border p-4 hover:bg-gray-50"
            >
              <div className="mb-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded border px-2 py-1">{ticket.status}</span>
                <span className="rounded border px-2 py-1">{ticket.category}</span>
              </div>

              <div className="font-semibold">{ticket.title}</div>

              <div className="mt-2 text-sm text-gray-600">
                <div>Page: {ticket.page_path}</div>
                <div>Created: {new Date(ticket.created_at).toLocaleString()}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}