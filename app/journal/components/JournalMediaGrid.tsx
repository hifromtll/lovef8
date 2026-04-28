'use client';

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

type JournalMediaGridProps = {
  memories: JournalMemoryRow[];
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

export default function JournalMediaGrid({
  memories,
  deletingId,
  onDelete,
  onOpenImage,
}: JournalMediaGridProps) {
  if (memories.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
        No saved photos or videos yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {memories.map((memory) => (
        <div
          key={memory.id}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
        >
          <div className="p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              {memory.media_type === 'video' ? 'Video' : 'Photo'}
            </div>

            {memory.media_type === 'image' && memory.media_url && (
              <img
                src={memory.media_url}
                alt="Saved journal media"
                className="h-56 w-full cursor-pointer rounded-xl object-cover"
                onClick={() => onOpenImage(memory.media_url || '')}
              />
            )}

            {memory.media_type === 'video' && memory.media_url && (
              <video
                src={memory.media_url}
                controls
                className="h-56 w-full rounded-xl object-cover"
              />
            )}

            {!memory.media_url && (
              <div className="flex h-56 items-center justify-center rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                Could not open this saved media right now.
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-white/50">
                {formatDate(memory.created_at)}
              </div>

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
        </div>
      ))}
    </div>
  );
}