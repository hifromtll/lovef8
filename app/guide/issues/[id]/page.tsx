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
  priority: string;
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

type GuideStatus = 'open' | 'in_review' | 'waiting_on_user' | 'escalated';

export default function GuideIssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ticketId } = use(params);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [status, setStatus] = useState<GuideStatus>('open');
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

    setCurrentUserId(user.id);

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

    const isGuide = profile?.is_guide === true;
    const isAdmin = profile?.app_role === 'admin';

    if (!isGuide && !isAdmin) {
      setMessage('You do not have access to this page.');
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
      console.error('guide ticket load error:', ticketError);
      setMessage(`Error loading ticket: ${ticketError.message}`);
      setLoading(false);
      return;
    }

    if (!['general_help', 'account_issue', 'bug'].includes(ticketData.category)) {
      setMessage('This ticket is not available in the guide queue.');
      setLoading(false);
      return;
    }

    const { data: messageData, error: messageError } = await supabase
      .from('support_ticket_messages')
      .select('id, created_at, created_by, body')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messageError) {
      console.error('guide ticket messages load error:', messageError);
      setMessage(`Error loading replies: ${messageError.message}`);
      setLoading(false);
      return;
    }

    setTicket(ticketData as Ticket);

    if (
      ticketData.status === 'open' ||
      ticketData.status === 'in_review' ||
      ticketData.status === 'waiting_on_user' ||
      ticketData.status === 'escalated'
    ) {
      setStatus(ticketData.status as GuideStatus);
    } else {
      setStatus('open');
    }

    setMessages((messageData || []) as TicketMessage[]);

    if (ticketData?.screenshot_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('support-ticket-screenshots')
        .createSignedUrl(ticketData.screenshot_path, 60 * 60);

      if (signedError) {
        console.error('guide signed url error:', signedError);
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
    setMessage('');

    if (!replyBody.trim()) return;

    setSending(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('auth getUser error:', userError);
      setMessage(`Error loading user: ${userError.message}`);
      setSending(false);
      return;
    }

    if (!user) {
      setMessage('You must be logged in.');
      setSending(false);
      return;
    }

    const { error: replyError } = await supabase
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        created_by: user.id,
        body: replyBody.trim(),
      });

    if (replyError) {
      console.error('guide reply insert error:', replyError);
      setMessage(`Error sending reply: ${replyError.message}`);
      setSending(false);
      return;
    }

    const { error: statusError } = await supabase
      .from('support_tickets')
      .update({
        status: 'escalated',
      })
      .eq('id', ticketId);

    if (statusError) {
      console.error('guide auto-escalate error:', statusError);
      setMessage(`Reply sent, but status did not update: ${statusError.message}`);
      setReplyBody('');
      setSending(false);
      await loadTicket();
      return;
    }

    setReplyBody('');
    setSending(false);
    await loadTicket();
  }

  async function handleStatusSave() {
    setMessage('');
    setSavingStatus(true);

    const { error } = await supabase
      .from('support_tickets')
      .update({
        status,
      })
      .eq('id', ticketId);

    if (error) {
      console.error('guide status update error:', error);
      setMessage(`Error saving status: ${error.message}`);
      setSavingStatus(false);
      return;
    }

    setSavingStatus(false);
    await loadTicket();
  }

  async function handleAssignToMe() {
    setMessage('');
    setAssigning(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('auth getUser error:', userError);
      setMessage(`Error loading user: ${userError.message}`);
      setAssigning(false);
      return;
    }

    if (!user) {
      setMessage('You must be logged in.');
      setAssigning(false);
      return;
    }

    const { error } = await supabase
      .from('support_tickets')
      .update({
        assigned_to: user.id,
      })
      .eq('id', ticketId);

    if (error) {
      console.error('assign ticket error:', error);
      setMessage(`Error assigning ticket: ${error.message}`);
      setAssigning(false);
      return;
    }

    setAssigning(false);
    await loadTicket();
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6">
        <Link href="/guide/issues" className="text-sm underline">
          Back to Guide Issues
        </Link>
      </div>

      {loading ? <p>Loading ticket...</p> : null}
      {message ? <p className="mb-4 text-sm">{message}</p> : null}

      {!loading && ticket ? (
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded border p-4">
              <div className="mb-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded border px-2 py-1">{ticket.status}</span>
                <span className="rounded border px-2 py-1">{ticket.category}</span>
                <span className="rounded border px-2 py-1">{ticket.priority}</span>
              </div>

              <h1 className="text-2xl font-bold">{ticket.title}</h1>

              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Description:</span> {ticket.description}
                </div>
                <div>
                  <span className="font-semibold">Page:</span> {ticket.page_path}
                </div>
                <div>
                  <span className="font-semibold">Assigned To:</span>{' '}
                  {ticket.assigned_to
                    ? ticket.assigned_to === currentUserId
                      ? 'You'
                      : ticket.assigned_to
                    : 'Unassigned'}
                </div>
                <div>
                  <span className="font-semibold">Created:</span>{' '}
                  {new Date(ticket.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-semibold">Updated:</span>{' '}
                  {new Date(ticket.updated_at).toLocaleString()}
                </div>
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

              {ticket.resolution_notes ? (
                <div className="mt-4 rounded border p-3">
                  <div className="mb-1 font-semibold">Notes</div>
                  <div className="text-sm">{ticket.resolution_notes}</div>
                </div>
              ) : null}
            </div>

            <div className="rounded border p-4">
              <h2 className="mb-4 text-lg font-semibold">Replies</h2>

              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-600">No replies yet.</p>
                ) : (
                  messages.map((item) => (
                    <div key={item.id} className="rounded border p-3">
                      <div className="mb-1 text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                      <div className="text-sm">{item.body}</div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleReplySubmit} className="mt-4 space-y-3">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={4}
                  className="w-full rounded border p-2"
                  placeholder="Reply to the user here"
                />

                <button
                  type="submit"
                  disabled={sending}
                  className="rounded bg-black px-4 py-2 text-white"
                >
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </form>
            </div>
          </div>

          <div>
            <div className="rounded border p-4">
              <h2 className="mb-4 text-lg font-semibold">Guide Actions</h2>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleAssignToMe}
                  disabled={assigning}
                  className="w-full rounded bg-black px-4 py-2 text-white"
                >
                  {assigning ? 'Assigning...' : 'Assign to Me'}
                </button>

                <div>
                  <label className="mb-1 block text-sm font-semibold">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GuideStatus)}
                    className="w-full rounded border p-2"
                  >
                    <option value="open">open</option>
                    <option value="in_review">in_review</option>
                    <option value="waiting_on_user">waiting_on_user</option>
                    <option value="escalated">escalated</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleStatusSave}
                  disabled={savingStatus}
                  className="w-full rounded bg-black px-4 py-2 text-white"
                >
                  {savingStatus ? 'Saving...' : 'Save Status'}
                </button>

                <p className="text-xs text-gray-600">
                  Guide replies automatically move the ticket to <strong>escalated</strong> so admin can finish it.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}