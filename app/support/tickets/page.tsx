'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type TicketRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  category: string;
  title: string;
  priority: string;
  page_path: string;
  last_reply_at: string | null;
};

function badgeClasses(value: string) {
  switch (value) {
    case 'open':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'in_review':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'waiting_on_user':
      return 'border-purple-200 bg-purple-50 text-purple-800';
    case 'escalated':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    case 'resolved':
      return 'border-green-200 bg-green-50 text-green-800';
    case 'closed':
      return 'border-neutral-200 bg-neutral-100 text-neutral-700';
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-700';
  }
}

export default function MyTicketsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadTickets() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !user) {
        setError('You must be signed in to view your tickets.');
        setLoading(false);
        return;
      }

      const { data, error: ticketError } = await supabase
        .from('support_tickets')
        .select('id, created_at, updated_at, status, category, title, priority, page_path, last_reply_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (!mounted) return;

      if (ticketError) {
        console.error('load tickets error:', ticketError);
        setError(ticketError.message || 'Could not load tickets.');
        setLoading(false);
        return;
      }

      setTickets((data || []) as TicketRow[]);
      setLoading(false);
    }

    loadTickets();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Tickets</h1>
          <p className="mt-1 text-sm text-neutral-600">
            View your submitted support tickets and replies.
          </p>
        </div>

        <Link
          href="/support/report"
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          New Ticket
        </Link>
      </div>

      {loading ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          Loading tickets...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-700">You do not have any support tickets yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/support/my-tickets/${ticket.id}`}
              className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses(ticket.status)}`}
                    >
                      {ticket.status.replaceAll('_', ' ')}
                    </span>

                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {ticket.category.replaceAll('_', ' ')}
                    </span>

                    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {ticket.priority}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-neutral-900">{ticket.title}</h2>

                  <div className="mt-2 text-xs text-neutral-500">
                    <div>Page: {ticket.page_path || '/'}</div>
                    <div>Created: {new Date(ticket.created_at).toLocaleString()}</div>
                    <div>Updated: {new Date(ticket.updated_at).toLocaleString()}</div>
                    {ticket.last_reply_at ? (
                      <div>Last reply: {new Date(ticket.last_reply_at).toLocaleString()}</div>
                    ) : null}
                  </div>
                </div>

                <div className="text-sm font-semibold text-neutral-700">Open</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}