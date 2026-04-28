'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import JournalMemoryCard from './components/JournalMemoryCard';
import JournalMediaGrid from './components/JournalMediaGrid';
import MediaLightbox from './components/MediaLightbox';

type JournalSliceMessage = {
  id: string;
  sender_id: string;
  sender_label?: string;
  content: string;
  created_at: string;
};

type JournalSnapshot = {
  version: number;
  anchor_message_id: string;
  message_count: number;
  messages: JournalSliceMessage[];
};

type JournalMemoryRow = {
  id: string;
  conversation_id: string;
  anchor_message_id: string;
  snapshot: JournalSnapshot | null;
  media_path: string | null;
  media_type: 'image' | 'video' | null;
  media_url?: string | null;
  created_at: string;
};

type JournalView = 'memories' | 'media';

export default function JournalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<JournalMemoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [view, setView] = useState<JournalView>('memories');

  const conversationIdFilter = searchParams.get('conversationId');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth');
          return;
        }

        let query = supabase
          .from('journal_memories')
          .select(
            'id, conversation_id, anchor_message_id, snapshot, media_path, media_type, created_at'
          )
          .order('created_at', { ascending: false });

        if (conversationIdFilter) {
          query = query.eq('conversation_id', conversationIdFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        const baseRows = (data ?? []) as JournalMemoryRow[];

        const rowsWithUrls = await Promise.all(
          baseRows.map(async (memory) => {
            if (!memory.media_path) {
              return {
                ...memory,
                media_url: null,
              };
            }

            const { data: signedData, error: signedError } = await supabase.storage
              .from('chat-media')
              .createSignedUrl(memory.media_path, 60 * 60);

            return {
              ...memory,
              media_url: !signedError && signedData?.signedUrl ? signedData.signedUrl : null,
            };
          })
        );

        if (!active) return;
        setMemories(rowsWithUrls);
      } catch (err: any) {
        console.error(err);
        if (!active) return;
        setError(err?.message ?? 'Failed to load journal memories.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router, conversationIdFilter]);

  async function handleDelete(memoryId: string) {
    const ok = window.confirm('Delete this saved memory?');
    if (!ok) return;

    try {
      setDeletingId(memoryId);

      const { error } = await supabase
        .from('journal_memories')
        .delete()
        .eq('id', memoryId);

      if (error) throw error;

      setMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Failed to delete memory.');
    } finally {
      setDeletingId(null);
    }
  }

  const pageSubtitle = useMemo(() => {
    if (!conversationIdFilter) {
      return view === 'memories'
        ? 'Saved written moments from your conversations.'
        : 'Saved photos and videos from your conversations.';
    }

    return view === 'memories'
      ? 'Saved written moments from this conversation.'
      : 'Saved photos and videos from this conversation.';
  }, [conversationIdFilter, view]);

  const textMemories = useMemo(
    () => memories.filter((memory) => !memory.media_path),
    [memories]
  );

  const mediaMemories = useMemo(
    () => memories.filter((memory) => !!memory.media_path),
    [memories]
  );

  return (
    <div className="min-h-screen bg-[#0b1020] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Memory Journal</h1>
            <p className="mt-1 text-sm text-white/70">{pageSubtitle}</p>

            {conversationIdFilter && (
              <div className="mt-2 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Filtered to conversation: {conversationIdFilter.slice(0, 8)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {conversationIdFilter && (
              <Link
                href="/journal"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                View All
              </Link>
            )}

            <Link
              href="/messages"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              Back to Chats
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView('memories')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === 'memories'
                ? 'border border-pink-400/30 bg-pink-400/15 text-pink-100'
                : 'border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
            }`}
          >
            Written Memories
          </button>

          <button
            type="button"
            onClick={() => setView('media')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === 'media'
                ? 'border border-cyan-400/30 bg-cyan-400/15 text-cyan-100'
                : 'border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
            }`}
          >
            Photos & Videos
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Loading journal...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : view === 'memories' ? (
          textMemories.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              {conversationIdFilter
                ? 'No saved written memories yet for this conversation.'
                : 'No saved written memories yet.'}
            </div>
          ) : (
            <div className="space-y-4">
              {textMemories.map((memory) => (
                <JournalMemoryCard
                  key={memory.id}
                  memory={memory}
                  conversationIdFilter={conversationIdFilter}
                  deletingId={deletingId}
                  onDelete={handleDelete}
                  onOpenImage={(imageUrl) => setLightboxImageUrl(imageUrl)}
                />
              ))}
            </div>
          )
        ) : (
          <JournalMediaGrid
            memories={mediaMemories}
            deletingId={deletingId}
            onDelete={handleDelete}
            onOpenImage={(imageUrl) => setLightboxImageUrl(imageUrl)}
          />
        )}
      </div>

      <MediaLightbox
        imageUrl={lightboxImageUrl}
        onClose={() => setLightboxImageUrl(null)}
      />
    </div>
  );
}