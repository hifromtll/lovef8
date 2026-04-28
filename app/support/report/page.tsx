'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ReportIssuePage() {
  const [category, setCategory] = useState('general_help');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setScreenshotFile(file);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setMessage(`Error loading user: ${userError.message}`);
      setLoading(false);
      return;
    }

    if (!user) {
      setMessage('You must be logged in.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('support_tickets').insert({
      created_by: user.id,
      category,
      title: title.trim(),
      description: description.trim(),
      page_path: '/support/report',
    });

    if (insertError) {
      setMessage(`Error submitting ticket: ${insertError.message}`);
      setLoading(false);
      return;
    }

    if (screenshotFile) {
      const { data: latestTicket, error: latestTicketError } = await supabase
        .from('support_tickets')
        .select('id')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestTicketError || !latestTicket) {
        setMessage(
          `Ticket created, but could not find the new ticket for screenshot upload: ${
            latestTicketError?.message || 'Unknown error'
          }`
        );
        setLoading(false);
        return;
      }

      const safeName = screenshotFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = `${user.id}/${latestTicket.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('support-ticket-screenshots')
        .upload(filePath, screenshotFile, {
          upsert: false,
        });

      if (uploadError) {
        setMessage(`Ticket created, but screenshot upload failed: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({
          screenshot_path: filePath,
        })
        .eq('id', latestTicket.id);

      if (updateError) {
        setMessage(`Ticket created, but screenshot could not be linked: ${updateError.message}`);
        setLoading(false);
        return;
      }
    }

    setMessage('Ticket submitted successfully.');
    setTitle('');
    setDescription('');
    setCategory('general_help');
    setScreenshotFile(null);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Report an Issue</h1>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-sm transition hover:bg-gray-100"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = '/support/my-tickets')}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-blue-100"
          >
            My Tickets
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded border p-2"
          >
            <option value="bug">Bug</option>
            <option value="billing">Billing</option>
            <option value="user_behavior">User Behavior</option>
            <option value="account_issue">Account Issue</option>
            <option value="general_help">General Help</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border p-2"
            placeholder="Short description"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border p-2"
            rows={5}
            placeholder="Explain the issue"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Screenshot (optional)</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="w-full rounded border p-2"
          />
          {screenshotFile ? (
            <p className="mt-2 text-sm text-gray-600">Selected: {screenshotFile.name}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {loading ? 'Submitting...' : 'Submit'}
        </button>

        {message ? <p className="text-sm">{message}</p> : null}
      </form>
    </div>
  );
}