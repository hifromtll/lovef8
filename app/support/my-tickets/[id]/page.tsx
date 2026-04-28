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
  screenshot_path: string | null;
};

type TicketMessage = {
  id: string;
  created_at: string;
  created_by: string;
  body: string;
};

export default function MyTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ticketId } = use(params);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
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

    const { data: ticketData, error: ticketError } = await supabase
      .from('support_tickets')
      .select(
        'id, created_at, updated_at, status, category, title, description, page_path, priority, resolution_notes, screenshot_path'
      )
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      console.error('ticket load error:', ticketError);
      setMessage(`Error loading ticket: ${ticketError.message}`);
      setLoading(false);
      return;
    }

    const { data: messageData, error: messageError } = await supabase
      .from('support_ticket_messages')
      .select('id, created_at, created_by, body')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messageError) {
      console.error('ticket messages load error:', messageError);
      setMessage(`Error loading replies: ${messageError.message}`);
      setLoading(false);
      return;
    }

    setTicket(ticketData as Ticket);
    setMessages((messageData || []) as TicketMessage[]);

    if (ticketData?.screenshot_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('support-ticket-screenshots')
        .createSignedUrl(ticketData.screenshot_path, 60 * 60);

      if (signedError) {
        console.error('signed url error:', signedError);
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
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('You must be logged in.');
      setSending(false);
      return;
    }

    const { error } = await supabase.from('support_ticket_messages').insert({
      ticket_id: ticketId,
      created_by: user.id,
      body: replyBody.trim(),
    });

    if (error) {
      console.error('reply insert error:', error);
      setMessage(`Error sending reply: ${error.message}`);
      setSending(false);
      return;
    }

    setReplyBody('');
    setSending(false);
    await loadTicket();
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <Link href="/support/my-tickets" className="text-sm underline">
          Back to My Tickets
        </Link>
      </div>

      {loading ? <p>Loading ticket...</p> : null}
      {message ? <p className="mb-4 text-sm">{message}</p> : null}

      {!loading && ticket ? (
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
                <div className="mb-1 font-semibold">Support Notes</div>
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
                placeholder="Add more information here"
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
      ) : null}
    </div>
  );
}