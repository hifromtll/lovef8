'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type MiniProfile = {
  display_name?: string | null;
  username?: string | null;
};

type ChatHeaderActionsProps = {
  otherProfile?: MiniProfile | null;
  sendingSpark: boolean;
  onSendSpark?: (amount: number, kind?: 'normal' | 'super') => Promise<void> | void;
};

const SPARK_OPTIONS = [20, 50, 100];
const SUPER_SPARK_AMOUNT = 250;
const SUPER_SPARK_COOLDOWN_MS = 6 * 24 * 60 * 60 * 1000;

function getSuperSparkStorageKey(
  viewerId?: string | null,
  hostKey?: string | null
) {
  return `lovef8-super-spark-${viewerId || 'unknown-user'}-${hostKey || 'unknown-host'}`;
}

function formatCooldown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  return `${days}d ${hours}h`;
}

export default function ChatHeaderActions({
  otherProfile,
  sendingSpark,
  onSendSpark,
}: ChatHeaderActionsProps) {
  const [showSparkMenu, setShowSparkMenu] = useState(false);
  const [superSparkReadyAt, setSuperSparkReadyAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [viewerId, setViewerId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  const displayName = useMemo(() => {
    return otherProfile?.display_name || otherProfile?.username || 'this host';
  }, [otherProfile]);

  const hostKey = useMemo(() => {
    return otherProfile?.username || otherProfile?.display_name || 'unknown-host';
  }, [otherProfile?.display_name, otherProfile?.username]);

  const storageKey = useMemo(() => {
    return getSuperSparkStorageKey(viewerId, hostKey);
  }, [viewerId, hostKey]);

  useEffect(() => {
    let mounted = true;

    async function loadViewer() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      setViewerId(user?.id ?? null);
    }

    void loadViewer();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!viewerId) {
      setSuperSparkReadyAt(null);
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setSuperSparkReadyAt(null);
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setSuperSparkReadyAt(null);
      return;
    }

    setSuperSparkReadyAt(parsed);
  }, [storageKey, viewerId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        setShowSparkMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const superSparkOnCooldown =
    superSparkReadyAt !== null && superSparkReadyAt > now;

  const superSparkRemaining = superSparkOnCooldown
    ? superSparkReadyAt - now
    : 0;

  async function sendSpark(amount: number) {
    if (!onSendSpark || sendingSpark) return;
    await onSendSpark(amount, 'normal');
    setShowSparkMenu(false);
  }

  async function sendSuperSpark() {
    if (!onSendSpark || sendingSpark || superSparkOnCooldown) return;

    await onSendSpark(SUPER_SPARK_AMOUNT, 'super');

    const readyAt = Date.now() + SUPER_SPARK_COOLDOWN_MS;
    setSuperSparkReadyAt(readyAt);
    setNow(Date.now());
    setShowSparkMenu(false);

    if (typeof window !== 'undefined' && viewerId) {
      window.localStorage.setItem(storageKey, String(readyAt));
    }
  }

  return (
    <>
      <style>{`
        @keyframes lovef8SparkMenuIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div ref={wrapRef} className="relative mt-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setShowSparkMenu((prev) => !prev)}
            disabled={sendingSpark}
            className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-sm font-medium text-amber-800 transition-all duration-200 hover:bg-amber-100 hover:shadow-[0_0_12px_rgba(251,191,36,0.22)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingSpark ? 'Sending…' : '✨ Send Sparks'}
          </button>

          <div className="text-xs text-zinc-500">
            Show <span className="font-medium text-zinc-700">{displayName}</span> you enjoy their company
          </div>
        </div>

        {showSparkMenu && (
          <div
            className="absolute left-0 top-full z-30 mt-2 w-[320px] max-w-[calc(100vw-32px)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl"
            style={{ animation: 'lovef8SparkMenuIn 0.16s ease-out' }}
          >
            <div className="flex flex-wrap gap-2">
              {SPARK_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => void sendSpark(amount)}
                  disabled={sendingSpark}
                  className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {amount} Sparks
                </button>
              ))}

              <button
                type="button"
                onClick={() => void sendSuperSpark()}
                disabled={sendingSpark || superSparkOnCooldown}
                className={[
                  'rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-[0.98]',
                  sendingSpark || superSparkOnCooldown
                    ? 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400'
                    : 'border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100',
                ].join(' ')}
              >
                💥 Super Spark 250
              </button>
            </div>

            <div className="mt-2 text-xs">
              {superSparkOnCooldown ? (
                <span className="font-medium text-fuchsia-700">
                  Super Spark cooldown: {formatCooldown(superSparkRemaining)} remaining
                </span>
              ) : (
                <span className="text-zinc-500">Super Spark is ready</span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}