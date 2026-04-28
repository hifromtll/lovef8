'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buildJournalSnapshot } from '../journalMemory';

type MessageLike = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_kind?: 'text' | 'image' | 'video' | null;
  media_path?: string | null;
};

type SaveToJournalButtonProps = {
  conversationId: string;
  message: MessageLike;
  allMessages: MessageLike[];
};

type MembershipTier = 'basic' | 'plus' | 'premium' | 'none';

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;

  if (err && typeof err === 'object') {
    const anyErr = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      anyErr.message,
      anyErr.details,
      anyErr.hint,
      anyErr.code ? `code: ${anyErr.code}` : null,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(' | ');

    try {
      return JSON.stringify(err);
    } catch {
      return 'Unknown error saving journal memory.';
    }
  }

  return 'Unknown error saving journal memory.';
}

function normalizeTier(value: string | null | undefined): MembershipTier {
  const tier = (value || '').trim().toLowerCase();

  if (tier === 'basic') return 'basic';
  if (tier === 'plus') return 'plus';
  if (tier === 'premium') return 'premium';

  return 'none';
}

function getPlanLimits(tier: MembershipTier) {
  switch (tier) {
    case 'basic':
      return { photoLimit: 10, videoLimit: 0 };
    case 'plus':
      return { photoLimit: 20, videoLimit: 4 };
    case 'premium':
      return { photoLimit: 100, videoLimit: 20 };
    default:
      return { photoLimit: 0, videoLimit: 0 };
  }
}

function getUpgradeMessage(kind: 'image' | 'video', tier: MembershipTier) {
  if (kind === 'image') {
    if (tier === 'basic') {
      return 'You have reached your 10 saved photo limit on Basic. To save more photos, please upgrade your membership.';
    }

    if (tier === 'plus') {
      return 'You have reached your 20 saved photo limit on Plus. To save more photos, please upgrade your membership.';
    }

    if (tier === 'premium') {
      return 'You have reached your 100 saved photo limit on Premium.';
    }

    return 'Photo saving requires a membership. Please upgrade your membership to save photos.';
  }

  if (tier === 'basic') {
    return 'Video saving is not included on Basic. To save videos, please upgrade your membership.';
  }

  if (tier === 'plus') {
    return 'You have reached your 4 saved video limit on Plus. To save more videos, please upgrade your membership.';
  }

  if (tier === 'premium') {
    return 'You have reached your 20 saved video limit on Premium.';
  }

  return 'Video saving requires a membership. Please upgrade your membership to save videos.';
}

export default function SaveToJournalButton({
  conversationId,
  message,
  allMessages,
}: SaveToJournalButtonProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSave(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    try {
      setStatus('saving');

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('You must be signed in to save a journal memory.');

      const isMedia = message.message_kind === 'image' || message.message_kind === 'video';

      if (isMedia) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('membership_tier')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        const tier = normalizeTier(profile?.membership_tier);
        const limits = getPlanLimits(tier);

        const mediaType = message.message_kind as 'image' | 'video';

        const { data: existingMediaRows, error: countError } = await supabase
          .from('journal_memories')
          .select('id, media_type')
          .eq('owner_user_id', user.id)
          .not('media_path', 'is', null);

        if (countError) throw countError;

        const savedPhotos = (existingMediaRows || []).filter(
          (row: any) => row.media_type === 'image'
        ).length;

        const savedVideos = (existingMediaRows || []).filter(
          (row: any) => row.media_type === 'video'
        ).length;

        const isAlreadySaved = (existingMediaRows || []).some(
          (row: any) => row.id && false
        );

        // If this same anchor is already saved as media, allow upsert without blocking.
        const { data: existingAnchorRow, error: existingAnchorError } = await supabase
          .from('journal_memories')
          .select('id, media_type')
          .eq('owner_user_id', user.id)
          .eq('anchor_message_id', message.id)
          .maybeSingle();

        if (existingAnchorError) throw existingAnchorError;

        const replacingSamePhoto =
          existingAnchorRow?.media_type === 'image' && mediaType === 'image';
        const replacingSameVideo =
          existingAnchorRow?.media_type === 'video' && mediaType === 'video';

        if (mediaType === 'image' && !replacingSamePhoto && savedPhotos >= limits.photoLimit) {
          alert(getUpgradeMessage('image', tier));
          setStatus('idle');
          return;
        }

        if (mediaType === 'video' && !replacingSameVideo && savedVideos >= limits.videoLimit) {
          alert(getUpgradeMessage('video', tier));
          setStatus('idle');
          return;
        }
      }

      let journalMediaPath: string | null = null;

      if (isMedia) {
        if (!message.media_path) {
          throw new Error('This media message is missing its file path.');
        }

        const originalPath = message.media_path;
        const fileName = originalPath.split('/').pop() || `media-${Date.now()}`;
        const newPath = `journal/${user.id}/${Date.now()}-${fileName}`;

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('chat-media')
          .download(originalPath);

        if (downloadError) throw downloadError;
        if (!fileData) throw new Error('Could not download media file for journal save.');

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(newPath, fileData, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        journalMediaPath = newPath;
      }

      const payload = isMedia
        ? {
            owner_user_id: user.id,
            conversation_id: conversationId,
            anchor_message_id: message.id,
            snapshot: null,
            media_path: journalMediaPath,
            media_type: message.message_kind,
          }
        : {
            owner_user_id: user.id,
            conversation_id: conversationId,
            anchor_message_id: message.id,
            snapshot: buildJournalSnapshot(allMessages, message.id),
            media_path: null,
            media_type: null,
          };

      const { error } = await supabase.from('journal_memories').upsert(payload, {
        onConflict: 'owner_user_id,anchor_message_id',
      });

      if (error) throw error;

      setStatus('saved');

      window.setTimeout(() => {
        setStatus('idle');
      }, 1800);
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error('Failed to save journal memory:', err);
      alert(`Journal save failed: ${msg}`);
      setStatus('error');

      window.setTimeout(() => {
        setStatus('idle');
      }, 2200);
    }
  }

  const label =
    status === 'saving'
      ? 'Saving...'
      : status === 'saved'
        ? 'Saved'
        : status === 'error'
          ? 'Retry'
          : 'Save';

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={status === 'saving'}
      title="Save this moment to your journal"
      className="rounded-full border border-black bg-rose-100 px-2 py-1 text-[11px] font-bold text-black"
    >
      {label}
    </button>
  );
}