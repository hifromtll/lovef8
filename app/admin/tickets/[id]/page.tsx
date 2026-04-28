'use client';

import Link from 'next/link';
import { FormEvent, use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Ticket = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  category: string;
  title: string;
  description: string;
  page_path: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  resolution_notes: string | null;
  created_by: string;
  assigned_to: string | null;
  screenshot_path: string | null;
};

type TicketMessage = {
  id: string;
  created_at: string;
  created_by: string;
  body: string;
};

type AdminStatus =
  | 'open'
  | 'in_review'
  | 'waiting_on_user'
  | 'escalated'
  | 'resolved'
  | 'closed';

type AdminPriority = 'low' | 'normal' | 'high' | 'urgent';

export default function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ticketId } = use(params);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [status, setStatus] = useState<AdminStatus>('open');
  const [priority, setPriority] = useState<AdminPriority>('normal');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [screenshotUrl, setScreenshotUrl] = useState('');

  async function loadTicket() {
    setLoading(true);
    setMessage('');
    setScreenshotUrl('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('You must be logged in.');
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('app_role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.app_role !== 'admin') {
      setMessage('No access.');
      setLoading(false);
      return;
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from('support_tickets')
      .select(
        'id, created_at, updated_at, status, category, title, description, page_path, priority, resolution_notes, created_by, assigned_to, screenshot_path'
      )
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      setMessage(ticketError.message);
      setLoading(false);
      return;
    }

    const { data: messageData } = await supabase
      .from('support_ticket_messages')
      .select('id, created_at, created_by, body')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    setTicket(ticketData as Ticket);
    setStatus(ticketData.status as AdminStatus);
    setPriority(ticketData.priority as AdminPriority);
    setMessages((messageData || []) as TicketMessage[]);

    if (ticketData?.screenshot_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('support-ticket-screenshots')
        .createSignedUrl(ticketData.screenshot_path, 60 * 60);

      if (signedError) {
        console.error('admin signed url error:', signedError);
      } else if (signedData?.signedUrl) {
        setScreenshotUrl(signedData.signedUrl);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function handleReplySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setSending(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('support_ticket_messages').insert({
      ticket_id: ticketId,
      created_by: user?.id,
      body: replyBody.trim(),
    });

    setReplyBody('');
    setSending(false);
    await loadTicket();
  }

  async function handleStatusSave() {
    setSavingStatus(true);

    await supabase
      .from('support_tickets')
      .update({
        status,
        priority,
      })
      .eq('id', ticketId);

    setSavingStatus(false);
    await loadTicket();
  }

  async function handleAssignToMe() {
    setAssigning(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from('support_tickets')
      .update({ assigned_to: user?.id })
      .eq('id', ticketId);

    setAssigning(false);
    await loadTicket();
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href="/admin/tickets" className="text-sm underline">
        Back to Admin Tickets
      </Link>

      {loading && <p>Loading...</p>}
      {message && <p className="mt-3 text-sm">{message}</p>}

      {ticket && (
        <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded border p-4">
              <div className="mb-2 flex gap-2 text-xs flex-wrap">
                <span className="border px-2 py-1 rounded">{ticket.status}</span>
                <span className="border px-2 py-1 rounded">{ticket.category}</span>
                <span className="border px-2 py-1 rounded">{ticket.priority}</span>
              </div>

              <h1 className="text-xl font-bold">{ticket.title}</h1>

              <p className="mt-2 text-sm">{ticket.description}</p>

              <div className="mt-3 space-y-1 text-sm">
                <div>Page: {ticket.page_path}</div>
                <div>
                  Assigned To:{' '}
                  {ticket.assigned_to
                    ? ticket.assigned_to === currentUserId
                      ? 'You'
                      : ticket.assigned_to
                    : 'Unassigned'}
                </div>
                <div>Created: {new Date(ticket.created_at).toLocaleString()}</div>
                <div>Updated: {new Date(ticket.updated_at).toLocaleString()}</div>
              </div>

              {screenshotUrl ? (
                <div className="mt-4">
                  <div className="mb-2 font-semibold">Screenshot</div>
                  <a href={screenshotUrl} target="_blank" rel="noreferrer">
                    <img
                      src={screenshotUrl}
                      alt="Ticket screenshot"
                      className="max-h-[500px] w-full rounded border object-contain"
                    />
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded border p-4">
              <h2 className="mb-2 font-semibold">Replies</h2>

              <div className="space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="rounded border p-2">
                    <div className="text-xs text-gray-500">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReplySubmit} className="mt-3">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  className="w-full border p-2 rounded"
                  rows={4}
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-2 rounded bg-black px-4 py-2 text-white"
                >
                  {sending ? 'Replying...' : 'Reply'}
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded border p-4">
              <button
                onClick={handleAssignToMe}
                disabled={assigning}
                className="w-full rounded bg-black py-2 text-white"
              >
                {assigning ? 'Assigning...' : 'Assign to Me'}
              </button>
            </div>

            <div className="rounded border p-4">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AdminStatus)}
                    className="w-full rounded border p-2"
                  >
                    <option value="open">open</option>
                    <option value="in_review">in_review</option>
                    <option value="waiting_on_user">waiting_on_user</option>
                    <option value="escalated">escalated</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AdminPriority)}
                    className="w-full rounded border p-2"
                  >
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                  </select>
                </div>

                <button
                  onClick={handleStatusSave}
                  disabled={savingStatus}
                  className="w-full rounded bg-black py-2 text-white"
                >
                  {savingStatus ? 'Saving...' : 'Save Status + Priority'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}