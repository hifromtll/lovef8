'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type GuideTicketRow = {
  id: string;
  created_at: string;
  status: string;
  category: string;
  title: string;
  page_path: string;
  created_by: string;
};

export default function GuideIssuesPage() {
  const [tickets, setTickets] = useState<GuideTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadGuideTickets() {
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
        .select('id, is_guide, app_role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('guide profile error:', profileError);
        setMessage(`Error loading profile: ${profileError.message}`);
        setLoading(false);
        return;
      }

      if (!profile) {
        setMessage('No profile record was found for this account.');
        setLoading(false);
        return;
      }

      const isGuide = profile.is_guide === true;
      const isAdmin = profile.app_role === 'admin';

      if (!isGuide && !isAdmin) {
        setMessage('You do not have access to the guide issues page.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, created_at, status, category, title, page_path, created_by')
        .in('category', ['general_help', 'account_issue', 'bug'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('guide tickets error:', error);
        setMessage(`Error loading guide tickets: ${error.message}`);
        setLoading(false);
        return;
      }

      setTickets((data || []) as GuideTicketRow[]);
      setLoading(false);
    }

    loadGuideTickets();
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Guide Issues</h1>
          <span className="rounded-full border px-3 py-1 text-sm font-semibold">
            {tickets.length}
          </span>
        </div>

        <Link href="/support/my-tickets" className="rounded border px-4 py-2">
          My Tickets
        </Link>
      </div>

      {loading && <p>Loading guide tickets...</p>}
      {message && <p className="mb-4 text-sm">{message}</p>}

      {!loading && !message && tickets.length === 0 && (
        <div className="rounded border p-4">
          <p>No guide tickets right now.</p>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/guide/issues/${ticket.id}`}
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
                  Created: {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}