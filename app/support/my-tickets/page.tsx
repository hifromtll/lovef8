'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type TicketRow = {
  id: string;
  created_at: string;
  status: string;
  category: string;
  title: string;
  page_path: string;
};

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadTickets() {
      setLoading(true);
      setMessage('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage('You must be logged in.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, created_at, status, category, title, page_path')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('load tickets error:', error);
        setMessage(`Error loading tickets: ${error.message}`);
        setLoading(false);
        return;
      }

      setTickets((data || []) as TicketRow[]);
      setLoading(false);
    }

    loadTickets();
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My Tickets</h1>

        <Link
          href="/support/report"
          className="rounded bg-black px-4 py-2 text-white"
        >
          New Ticket
        </Link>
      </div>

      {loading && <p>Loading tickets...</p>}
      {message && <p className="mb-4 text-sm">{message}</p>}

      {!loading && !message && tickets.length === 0 && (
        <div className="rounded border p-4">
          <p>You do not have any tickets yet.</p>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/support/my-tickets/${ticket.id}`}
              className="block rounded border p-4 hover:bg-gray-50"
            >
              <div className="mb-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded border px-2 py-1">
                  {ticket.status}
                </span>
                <span className="rounded border px-2 py-1">
                  {ticket.category}
                </span>
              </div>

              <div className="font-semibold">{ticket.title}</div>

              <div className="mt-2 text-sm text-gray-600">
                <div>Page: {ticket.page_path}</div>
                <div>
                  Created:{' '}
                  {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}