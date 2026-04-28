'use client';

import Link from 'next/link';

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

type JournalMemoryCardProps = {
  memory: JournalMemoryRow;
  conversationIdFilter: string | null;
  deletingId: string | null;
  onDelete: (memoryId: string) => void | Promise<void>;
  onOpenImage: (imageUrl: string) => void;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getDisplaySenderLabel(msg: JournalSliceMessage) {
  if (msg.sender_label && msg.sender_label.trim()) {
    return msg.sender_label;
  }

  return 'Saved message';
}

export default function JournalMemoryCard({
  memory,
  conversationIdFilter,
  deletingId,
  onDelete,
  onOpenImage,
}: JournalMemoryCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-white">
            Saved {formatDate(memory.created_at)}
          </div>

          {!conversationIdFilter && (
            <div className="mt-1 text-xs text-white/50">
              Conversation: {memory.conversation_id.slice(0, 8)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!memory.media_path && (
            <Link
              href={`/messages?conversationId=${memory.conversation_id}&anchorMessageId=${memory.anchor_message_id}`}
              className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
            >
              View Memory
            </Link>
          )}

          <button
            type="button"
            onClick={() => void onDelete(memory.id)}
            disabled={deletingId === memory.id}
            className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deletingId === memory.id ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {memory.media_path ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
            {memory.media_type === 'video' ? 'Saved video' : 'Saved photo'}
          </div>

          {memory.media_type === 'image' && memory.media_url && (
            <img
              src={memory.media_url}
              alt="Saved journal media"
              className="max-w-full cursor-pointer rounded-xl border border-white/10"
              onClick={() => onOpenImage(memory.media_url || '')}
            />
          )}

          {memory.media_type === 'video' && memory.media_url && (
            <video
              src={memory.media_url}
              controls
              className="max-w-full rounded-xl border border-white/10"
            />
          )}

          {!memory.media_url && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
              Could not open this saved media right now.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {memory.snapshot?.messages?.map((msg) => {
            const isAnchor = msg.id === memory.anchor_message_id;
            const senderLabel = getDisplaySenderLabel(msg);

            return (
              <div
                key={msg.id}
                className={`rounded-xl border px-3 py-2 ${
                  isAnchor
                    ? 'border-pink-400/40 bg-pink-400/10'
                    : 'border-white/10 bg-black/10'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-white/50">
                    {isAnchor ? 'Anchor memory' : 'Context'}
                  </span>
                  <span className="text-[11px] text-white/40">
                    {formatDate(msg.created_at)}
                  </span>
                </div>

                <div className="mb-1 text-xs font-semibold text-white/70">
                  {senderLabel}
                </div>

                <div className="whitespace-pre-wrap text-sm text-white/90">
                  {msg.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}