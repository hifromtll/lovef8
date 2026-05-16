'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type HostConversationFeedbackPromptProps = {
  hostId: string | null;
  memberId: string | null;
  conversationId: string | null;
  isHostConversation?: boolean;
};

const DAYS_BETWEEN_PROMPTS = 7;

function getLocalStorageKey(memberId: string, hostId: string) {
  return `lovef8-host-heart-dismissed-${memberId}-${hostId}`;
}

function wasPromptDismissedRecently(memberId: string, hostId: string) {
  if (typeof window === 'undefined') return false;

  const key = getLocalStorageKey(memberId, hostId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;

  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;

  const sevenDaysMs = DAYS_BETWEEN_PROMPTS * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < sevenDaysMs;
}

function savePromptDismissed(memberId: string, hostId: string) {
  if (typeof window === 'undefined') return;

  const key = getLocalStorageKey(memberId, hostId);
  window.localStorage.setItem(key, String(Date.now()));
}

export default function HostConversationFeedbackPrompt({
  hostId,
  memberId,
  conversationId,
  isHostConversation = false,
}: HostConversationFeedbackPromptProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [canShow, setCanShow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isValid = useMemo(() => {
    if (!isHostConversation) return false;
    if (!hostId || !memberId || !conversationId) return false;
    if (hostId === memberId) return false;

    return true;
  }, [conversationId, hostId, isHostConversation, memberId]);

  useEffect(() => {
    let cancelled = false;

    async function checkPromptStatus() {
      setIsChecking(true);
      setCanShow(false);
      setSaved(false);

      if (!isValid || !hostId || !memberId || !conversationId) {
        setIsChecking(false);
        return;
      }

      if (wasPromptDismissedRecently(memberId, hostId)) {
        setIsChecking(false);
        return;
      }

      const { data, error } = await supabase
        .from('host_conversation_feedback')
        .select('id, created_at')
        .eq('host_id', hostId)
        .eq('member_id', memberId)
        .eq('conversation_id', conversationId)
        .limit(1);

      if (cancelled) return;

      if (error) {
        console.error('Host feedback check error:', error);
        setIsChecking(false);
        return;
      }

      setCanShow((data || []).length === 0);
      setIsChecking(false);
    }

    void checkPromptStatus();

    return () => {
      cancelled = true;
    };
  }, [conversationId, hostId, isValid, memberId]);

  if (isChecking || !canShow || saved) return null;

  async function handleHeartClick() {
    if (!hostId || !memberId || !conversationId) return;

    setIsSaving(true);

    const { error } = await supabase.from('host_conversation_feedback').insert({
      host_id: hostId,
      member_id: memberId,
      conversation_id: conversationId,
      enjoyed_conversation: true,
    });

    setIsSaving(false);

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        savePromptDismissed(memberId, hostId);
        setSaved(true);
        setCanShow(false);
        return;
      }

      console.error('Host feedback save error:', error);
      alert(`Could not save that yet: ${error.message}`);
      return;
    }

    savePromptDismissed(memberId, hostId);
    setSaved(true);
    setCanShow(false);
  }

  function handleNotNow() {
    if (hostId && memberId) {
      savePromptDismissed(memberId, hostId);
    }

    setCanShow(false);
  }

  return (
    <div className="mb-2 rounded-xl border border-rose-100 bg-rose-50/75 px-2.5 py-1.5 text-rose-950 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">Enjoying this chat?</div>
          <div className="truncate text-[11px] text-rose-700">Optional feedback.</div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleHeartClick}
            disabled={isSaving}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg text-rose-500 shadow-sm ring-1 ring-rose-200 transition hover:scale-105 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="I enjoyed this conversation"
            title="I enjoyed this conversation"
          >
            {isSaving ? '…' : '♡'}
          </button>

          <button
            type="button"
            onClick={handleNotNow}
            disabled={isSaving}
            className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}