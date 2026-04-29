'use client';

import ChatHeaderActions from './ChatHeaderActions';
import ComposerAvatar from './ComposerAvatar';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { EDIT_WINDOW_MS } from '../utils';
import SaveToJournalButton from './SaveToJournalButton'
import type { ChatMode, Message, ProfileMini, ProfilePreviewData } from '../types';

type SparkEvent = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  spark_kind: 'normal' | 'super';
  created_at: string;
};

type SparkBurstOverlay = {
  id: string;
  amount: number;
  kind: 'normal' | 'super';
  senderName: string;
};

type MessageReaction = {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
};

type MediaMessageSpark = {
  id: string;
  message_id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  created_at: string;
};

type ChatPanelProps = {
  userId: string | null;
  membershipTier?: string | null;
  activeConversationId: string | null;
  activeOther: ProfileMini | null;
  requestedAnchorMessageId: string | null;
  messages: Message[];
  sparkEvents: SparkEvent[];
  sentSparkTotal: number;
  receivedSparkTotal: number;
  sendingSpark: boolean;
  newMessage: string;
  sending: boolean;
  isBlockedWithActive: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  otherLastReadAt: string | null;
  activeTypingName: string | null;
  activeOtherOnline: boolean;
  activeOtherPresenceLabel: string;
  hasLanguageOverlap: boolean;
  myChatMode: ChatMode | null;
  isDesktop: boolean;
  viewerTimezone: string | null;
  remainingSparkLimit: number | null;
  targetLanguage: string | null;
  onBack: () => void;
  onOpenProfilePreview: (profile: ProfilePreviewData) => void;
  onChangeNewMessage: (value: string) => void | Promise<void>;
  onSendMessage: (payload?: {
    messageKind?: 'text' | 'image' | 'video';
    mediaFile?: File | null;
    mediaKind?: 'image' | 'video' | null;
  }) => void | Promise<void>;
  onSendSpark: (amount: number, kind?: 'normal' | 'super') => void | Promise<void>;
  onEditMessage: (message: Message) => void | Promise<void>;
  onBlock: () => void | Promise<void>;
  onUnblock: () => void | Promise<void>;
};

const LOVEF8_QUICK_EMOJIS = ['✨', '⚡', '💥', '💖', '🔥', '🥰', '😍', '😉'];

const COMPOSER_EMOJI_GROUPS: Array<{ title: string; emojis: string[] }> = [
  {
    title: 'LoveF8',
    emojis: ['✨', '⚡', '💥', '💖', '🔥', '🌟', '💕', '🫶'],
  },
  {
    title: 'Smileys',
    emojis: ['😀', '😁', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰', '😘', '😎', '🤗'],
  },
  {
    title: 'Feelings',
    emojis: ['😭', '🥹', '😅', '🙃', '😴', '🤔', '😮', '😇', '😏', '🤭', '😤', '😬'],
  },
  {
    title: 'Hearts',
    emojis: ['❤️', '🩷', '🧡', '💛', '💚', '🩵', '💙', '💜', '🖤', '🤍', '🤎', '💘'],
  },
  {
    title: 'Hands',
    emojis: ['👍', '👎', '👏', '🙌', '🫶', '🙏', '🤝', '👌', '✌️', '🤟', '💪', '👋'],
  },
  {
    title: 'Fun',
    emojis: ['🎉', '🎊', '🎵', '🎶', '💃', '🕺', '🍕', '☕', '🌈', '⭐', '🚀', '🎯'],
  },
];

const MESSAGE_REACTION_CHOICES = ['✨', '⚡', '💥', '💖', '😂', '😍', '🔥', '👍'];

function formatChatTimestamp(value: string) {
  const d = new Date(value);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${month} ${day}, ${hour}:${minute} ${ampm}`;
}

function getModeLabel(mode: ChatMode | string | null | undefined) {
  switch (mode) {
    case 'chatty':
      return 'Chatty';
    case 'flirty':
      return 'Flirty';
    case 'romantic':
      return 'Romantic';
    case 'open_all':
      return 'Open to all';
    default:
      return null;
  }
}

function getModeClasses(mode: ChatMode | string | null | undefined) {
  switch (mode) {
    case 'chatty':
      return 'bg-sky-100 text-sky-800';
    case 'flirty':
      return 'bg-pink-100 text-pink-800';
    case 'romantic':
      return 'bg-rose-100 text-rose-800';
    case 'open_all':
      return 'bg-violet-100 text-violet-800';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

function getModeMatchText(myMode: ChatMode | null, otherMode: ChatMode | null) {
  if (!myMode || !otherMode) return null;

  if (myMode === otherMode) {
    switch (myMode) {
      case 'chatty':
        return "You're both in Chatty mode";
      case 'flirty':
        return "You're both in Flirty mode";
      case 'romantic':
        return "You're both in Romantic mode";
      case 'open_all':
        return "You're both open to all";
      default:
        return null;
    }
  }

  const myLabel = getModeLabel(myMode);
  const otherLabel = getModeLabel(otherMode);

  if (!myLabel || !otherLabel) return null;

  return `You’re ${myLabel} • They’re ${otherLabel}`;
}

function getHeaderGlowClass(myMode: ChatMode | null, otherMode: ChatMode | null) {
  if (!myMode || !otherMode || myMode !== otherMode) return 'bg-white/92';

  switch (myMode) {
    case 'chatty':
      return 'bg-sky-50/95';
    case 'flirty':
      return 'bg-pink-50/95';
    case 'romantic':
      return 'bg-rose-50/95';
    case 'open_all':
      return 'bg-violet-50/95';
    default:
      return 'bg-white/92';
  }
}

function parseTimeParts(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.slice(0, 5);
  const [hourText, minuteText] = normalized.split(':');

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function formatOnlineWindowForViewer(
  start: string | null | undefined,
  end: string | null | undefined,
  sourceTimezone: string | null | undefined,
  viewerTimezone: string | null | undefined
) {
  if (!start || !end || !sourceTimezone || !viewerTimezone) return null;

  const startParts = parseTimeParts(start);
  const endParts = parseTimeParts(end);

  if (!startParts || !endParts) return null;

  try {
    const anchor = new Date('2024-01-01T00:00:00Z');

    const sourceDateText = new Intl.DateTimeFormat('en-CA', {
      timeZone: sourceTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(anchor);

    const [yearText, monthText, dayText] = sourceDateText.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    const makeUtcFromSourceLocal = (hour: number, minute: number) => {
      const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
      const asSource = new Date(utcGuess.toLocaleString('en-US', { timeZone: sourceTimezone }));

      const offsetMs =
        Date.UTC(
          asSource.getFullYear(),
          asSource.getMonth(),
          asSource.getDate(),
          asSource.getHours(),
          asSource.getMinutes(),
          asSource.getSeconds()
        ) - utcGuess.getTime();

      return new Date(utcGuess.getTime() - offsetMs);
    };

    const startUtc = makeUtcFromSourceLocal(startParts.hour, startParts.minute);
    const endUtc = makeUtcFromSourceLocal(endParts.hour, endParts.minute);

    const startLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTimezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(startUtc);

    const endLabel = new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTimezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(endUtc);

    if (viewerTimezone === sourceTimezone) return `${startLabel}–${endLabel}`;
    return `${startLabel}–${endLabel} your time`;
  } catch {
    return null;
  }
}

function HeaderAvatar({
  name,
  avatarUrl,
  online,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  online: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const showImage = !!avatarUrl && !imgError;

  return (
    <div className="relative shrink-0">
      <div className="h-10 w-10 overflow-hidden rounded-full">
        {showImage ? (
          <img
            src={avatarUrl!}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <span
        className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
          online ? 'bg-green-500' : 'bg-neutral-300'
        }`}
      />
    </div>
  );
}

function SparkEventCard({
  senderName,
  amount,
  kind,
}: {
  senderName: string;
  amount: number;
  kind: 'normal' | 'super';
}) {
  const tierClasses =
    kind === 'super'
      ? 'border-fuchsia-400 bg-gradient-to-r from-fuchsia-50 via-pink-100 to-violet-100 text-fuchsia-950'
      : amount >= 100
        ? 'border-red-400 bg-gradient-to-r from-red-50 via-green-300 to-amber-50 text-red-950'
        : amount >= 50
          ? 'border-orange-400 bg-gradient-to-r from-blue-200 via-blue-200 to-yellow-50 text-orange-950'
          : amount >= 20
            ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 via-red-200 to-amber-50 text-yellow-950'
            : 'border-lime-300 bg-gradient-to-r from-lime-100 via-yellow-50 to-white text-lime-900';

  const accent =
    kind === 'super'
      ? 'bg-gradient-to-br from-fuchsia-600 to-violet-900 text-white'
      : amount >= 100
        ? 'bg-gradient-to-br from-purple-500 to-red-700 text-white'
        : amount >= 50
          ? 'bg-gradient-to-br from-red-500 to-amber-500 text-white'
          : amount >= 20
            ? 'bg-gradient-to-br from-yellow-400 to-lemon-500 text-white'
            : 'bg-gradient-to-br from-blue-400 to-teal-400 text-white';

  const label =
    kind === 'super'
      ? `${senderName} sent ${amount} Super Spark`
      : `${senderName} sent ${amount} spark${amount > 1 ? 's' : ''}`;

  const subLabel =
    kind === 'super'
      ? 'Big energy just hit this chat'
      : amount >= 100
        ? 'Big spark energy just hit this chat'
        : amount >= 50
          ? 'A strong spark just hit this chat'
          : 'A little energy just hit this chat';

  return (
    <div
      className={`inline-flex max-w-full items-center gap-3 rounded-[18px] border px-3 py-2 shadow-sm ${tierClasses}`}
      style={{ animation: 'lovef8SparkIn 0.35s ease-out' }}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-black shadow-sm ${accent}`}
      >
        {kind === 'super' ? '✴' : '⚡'}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{label}</div>
        <div className="truncate text-xs opacity-80">{subLabel}</div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-1 text-base opacity-80">
        {kind === 'super' ? (
          <>
            <span>✴</span>
            <span>⚡</span>
            <span>✨</span>
          </>
        ) : amount >= 100 ? (
          <>
            <span>⚡</span>
            <span>🔥</span>
            <span>✨</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>⚡</span>
          </>
        )}
      </div>
    </div>
  );
}

function SparkBurstOverlayCard({
  senderName,
  amount,
  kind,
}: {
  senderName: string;
  amount: number;
  kind: 'normal' | 'super';
}) {
  const isSuper = kind === 'super';

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4"
      style={{ animation: 'lovef8OverlayFade 2.2s ease-out forwards' }}
    >
      <div
        className={[
          'relative w-full max-w-xl overflow-hidden rounded-[24px] border px-5 py-5 shadow-2xl backdrop-blur-sm',
          isSuper
            ? 'border-fuchsia-300/80 bg-gradient-to-r from-fuchsia-100/95 via-pink-100/95 to-violet-100/95'
            : 'border-amber-300/80 bg-gradient-to-r from-amber-100/95 via-yellow-100/95 to-orange-100/95',
        ].join(' ')}
      >
        <div className="relative flex flex-col items-center justify-center text-center">
          <div
            className="mb-3 text-5xl"
            style={{
              animation: isSuper
                ? 'lovef8SuperCorePulse 0.85s ease-in-out infinite'
                : 'lovef8CorePulse 0.9s ease-in-out infinite',
            }}
          >
            {isSuper ? '✴' : '⚡'}
          </div>

          <div
            className={[
              'text-xl font-black tracking-tight sm:text-2xl',
              isSuper ? 'text-fuchsia-900' : 'text-amber-900',
            ].join(' ')}
          >
            {senderName} sent {amount} {isSuper ? 'Super Spark' : `spark${amount > 1 ? 's' : ''}`}
          </div>

          <div
            className={[
              'mt-2 text-sm font-semibold',
              isSuper ? 'text-fuchsia-700' : 'text-amber-700',
            ].join(' ')}
          >
            {isSuper ? 'Massive energy lit up this chat' : 'A spark just lit up this chat'}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMessageReactions(message: Message): MessageReaction[] {
  const raw = (message as Message & { message_reactions?: MessageReaction[] }).message_reactions;
  return Array.isArray(raw) ? raw : [];
}

export default function ChatPanel({
  userId,
  membershipTier,
  activeConversationId,
  activeOther,
  requestedAnchorMessageId,
  messages,
  sparkEvents,
  sentSparkTotal,
  receivedSparkTotal,
  sendingSpark,
  newMessage,
  sending,
  isBlockedWithActive,
  messagesEndRef,
  otherLastReadAt,
  activeTypingName,
  activeOtherOnline,
  activeOtherPresenceLabel,
  hasLanguageOverlap,
  myChatMode,
  isDesktop,
  viewerTimezone,
  remainingSparkLimit,
  targetLanguage,
  onBack,
  onOpenProfilePreview,
  onChangeNewMessage,
  onSendMessage,
  onSendSpark,
  onEditMessage,
  onBlock,
  onUnblock,
}: ChatPanelProps) {
const [mounted, setMounted] = useState(false);
const [autoTranslate, setAutoTranslate] = useState(false);
const [debugLoadedUserId, setDebugLoadedUserId] = useState<string | null>(null);
const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});

useEffect(() => {
  if (!autoTranslate) return;
  if (!targetLanguage) return;
  if (hasLanguageOverlap) return;
  if (messages.length === 0) return;

  const run = async () => {
    const updates: Record<string, string> = {};

    for (const m of messages.slice(-5)) {
      // ONLY translate OTHER person's messages
      if (m.sender_id === userId) continue;

      // must have content
      if (!m.content) continue;

      // only text
      if (m.message_kind && m.message_kind !== 'text') continue;

      // already translated
      if (translatedMessages[m.id]) continue;

      // prevent duplicate requests
      if (inflightRef.current.has(m.id)) continue;
      inflightRef.current.add(m.id);

      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: m.content,
            targetLanguage,
          }),
        });

        if (!res.ok) continue;

        const data = await res.json();

        if (data?.translated) {
          updates[m.id] = data.translated;
        }
      } catch (err) {
        console.error('translate error', err);
      } finally {
        inflightRef.current.delete(m.id);
      }
    }

    if (Object.keys(updates).length > 0) {
      setTranslatedMessages((prev) => ({
        ...prev,
        ...updates,
      }));
    }
  };

  void run();
}, [autoTranslate, targetLanguage, hasLanguageOverlap, messages, userId]);

useEffect(() => {
  if (!activeConversationId || !userId) {
    setAutoTranslate(false);
    setDebugLoadedUserId(null);
    return;
  }

  const loadTranslationSetting = async () => {
    setDebugLoadedUserId(userId);

    const { data, error } = await supabase
      .from('conversation_translation_settings')
      .select('enabled, user_id')
      .eq('conversation_id', activeConversationId);

    if (error) {
      setAutoTranslate(false);
      return;
    }

    const row = (data || []).find((r) => String(r.user_id) === String(userId));
    setAutoTranslate(row?.enabled === true);
  };

  void loadTranslationSetting();
}, [activeConversationId, userId]);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [sparkOverlay, setSparkOverlay] = useState<SparkBurstOverlay | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [reactionMap, setReactionMap] = useState<Record<string, MessageReaction[]>>({});
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxImageAlt, setLightboxImageAlt] = useState<string>('sent image');
  const [sendingMediaSparkId, setSendingMediaSparkId] = useState<string | null>(null);
  const [mediaSparkMap, setMediaSparkMap] = useState<Record<string, MediaMessageSpark[]>>({});

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const inflightRef = useRef<Set<string>>(new Set());


  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [sendLocked, setSendLocked] = useState(false);
  const [selectedMediaPreviewUrl, setSelectedMediaPreviewUrl] = useState<string | null>(null);
  const [selectedMediaKind, setSelectedMediaKind] = useState<'image' | 'video' | null>(null);
  const [selectedMediaDuration, setSelectedMediaDuration] = useState<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasNearBottomRef = useRef(true);
  const seenSparkIdsRef = useRef<Set<string>>(new Set());
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedSparksRef = useRef(false);
  const lastScrolledAnchorRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const next: Record<string, MessageReaction[]> = {};
    for (const message of messages) {
      next[message.id] = getMessageReactions(message);
    }
    setReactionMap(next);
  }, [messages]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (selectedMediaPreviewUrl) URL.revokeObjectURL(selectedMediaPreviewUrl);
    };
  }, [selectedMediaPreviewUrl]);

  const loadMediaSparks = async () => {
    if (!activeConversationId) {
      setMediaSparkMap({});
      return;
    }

    const { data, error } = await supabase
      .from('media_message_sparks')
      .select('id, message_id, conversation_id, sender_id, receiver_id, amount, created_at')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('loadMediaSparks error:', error);
      setMediaSparkMap({});
      return;
    }

    const grouped: Record<string, MediaMessageSpark[]> = {};

    for (const row of (data || []) as MediaMessageSpark[]) {
      if (!grouped[row.message_id]) grouped[row.message_id] = [];
      grouped[row.message_id].push(row);
    }

    setMediaSparkMap(grouped);
  };

  useEffect(() => {
    if (!activeConversationId) return;

    seenSparkIdsRef.current = new Set(sparkEvents.map((spark) => spark.id));
    hasHydratedSparksRef.current = false;
    setSparkOverlay(null);
    setEmojiOpen(false);
    setReactingTo(null);
    lastScrolledAnchorRef.current = null;
    void loadMediaSparks();
  }, [activeConversationId, sparkEvents]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = '0px';
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(nextHeight, 46)}px`;
  }, [newMessage]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (emojiPanelRef.current?.contains(target)) return;
      if (emojiButtonRef.current?.contains(target)) return;
      setEmojiOpen(false);
    }

    if (emojiOpen) window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [emojiOpen]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (!sparkEvents.length) return;

    if (!hasHydratedSparksRef.current) {
      seenSparkIdsRef.current = new Set(sparkEvents.map((spark) => spark.id));
      hasHydratedSparksRef.current = true;
      return;
    }

    const unseen = sparkEvents.filter((spark) => !seenSparkIdsRef.current.has(spark.id));
    if (unseen.length === 0) return;

    unseen.forEach((spark) => seenSparkIdsRef.current.add(spark.id));

    const newest = unseen[unseen.length - 1];
    const senderName =
      newest.sender_id === userId ? 'You' : activeOther?.username?.trim() || 'Someone';

    setSparkOverlay({
      id: newest.id,
      amount: newest.amount,
      kind: newest.spark_kind,
      senderName,
    });

    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setSparkOverlay(null), 2200);
  }, [activeConversationId, activeOther?.username, sparkEvents, userId]);

  const clearSelectedMedia = () => {
    if (selectedMediaPreviewUrl) {
      URL.revokeObjectURL(selectedMediaPreviewUrl);
    }

    setSelectedMediaFile(null);
    setSelectedMediaPreviewUrl(null);
    setSelectedMediaKind(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePickMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Please choose an image or video file.');
      event.target.value = '';
      return;
    }

 if (isVideo) {
  if (file.size > 20 * 1024 * 1024) {
    alert('Video must be 20MB or smaller.');
    event.target.value = '';
    return;
  }

  if (selectedMediaPreviewUrl) {
    URL.revokeObjectURL(selectedMediaPreviewUrl);
  }

  const previewUrl = URL.createObjectURL(file);

  const video = document.createElement('video');
  video.preload = 'metadata';

  video.onloadedmetadata = () => {
    window.URL.revokeObjectURL(video.src);

    const duration = video.duration;

    setSelectedMediaDuration(duration);
    setSelectedMediaFile(file);
    setSelectedMediaPreviewUrl(previewUrl);
    setSelectedMediaKind('video');
  };

  video.src = previewUrl;

  return;
}

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be 5MB or smaller.');
      event.target.value = '';
      return;
    }

    if (selectedMediaPreviewUrl) {
      URL.revokeObjectURL(selectedMediaPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);

    setSelectedMediaFile(file);
    setSelectedMediaPreviewUrl(previewUrl);
    setSelectedMediaKind('image');
  };

  const appendEmoji = async (emoji: string) => {
    const nextValue = `${newMessage || ''}${emoji}`;
    await onChangeNewMessage(nextValue);
    setEmojiOpen(false);

    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }, 0);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!userId) return;

    const original = reactionMap[messageId] || [];
    const existing = original.find(
      (reaction) => reaction.profile_id === userId && reaction.emoji === emoji
    );

    if (existing) {
      const optimistic = original.filter((reaction) => reaction.id !== existing.id);
      setReactionMap((prev) => ({ ...prev, [messageId]: optimistic }));
      setReactingTo(null);

      const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);

      if (error) {
        setReactionMap((prev) => ({ ...prev, [messageId]: original }));
        alert(error.message);
      }
      return;
    }

    const tempId = `temp-${messageId}-${emoji}-${Date.now()}`;
    const optimisticReaction: MessageReaction = {
      id: tempId,
      message_id: messageId,
      profile_id: userId,
      emoji,
      created_at: new Date().toISOString(),
    };

    setReactionMap((prev) => ({
      ...prev,
      [messageId]: [...original, optimisticReaction],
    }));
    setReactingTo(null);

    const { data, error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        profile_id: userId,
        emoji,
      })
      .select('id, message_id, profile_id, emoji, created_at')
      .maybeSingle();

    if (error) {
      setReactionMap((prev) => ({ ...prev, [messageId]: original }));
      alert(error.message);
      return;
    }

    const saved = data as MessageReaction;

    setReactionMap((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] || []).map((reaction) =>
        reaction.id === tempId ? saved : reaction
      ),
    }));
  };

  const sendMediaSpark = async (messageId: string, amount: 25 | 50) => {
    try {
      setSendingMediaSparkId(`${messageId}-${amount}`);

      const { error } = await supabase.rpc('send_media_message_spark', {
        p_message_id: messageId,
        p_amount: amount,
      });

      if (error) throw error;

      await loadMediaSparks();
    } catch (err: any) {
      console.error('sendMediaSpark error:', err);
      alert(err?.message ?? 'Failed to send media spark.');
    } finally {
      setSendingMediaSparkId(null);
    }
  };

  const checkNearBottom = () => {
    const el = scrollAreaRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom < 80;
  };

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const nearBottom = checkNearBottom();
    wasNearBottomRef.current = nearBottom;
    if (nearBottom) setShowJumpToLatest(false);
  }, [activeConversationId]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    if (requestedAnchorMessageId) return;

    const nearBottomBeforeUpdate = wasNearBottomRef.current;
    if (nearBottomBeforeUpdate) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShowJumpToLatest(false);
    } else {
      setShowJumpToLatest(true);
    }
  }, [
    messages.length,
    sparkEvents.length,
    activeTypingName,
    messagesEndRef,
    reactionMap,
    requestedAnchorMessageId,
    mediaSparkMap,
  ]);

  useEffect(() => {
    if (!requestedAnchorMessageId) return;
    if (!activeConversationId) return;
    if (messages.length === 0) return;
    if (lastScrolledAnchorRef.current === requestedAnchorMessageId) return;

    let cancelled = false;

    const tryScroll = (attempt = 0) => {
      if (cancelled) return;

      const container = scrollAreaRef.current;
      const el = document.getElementById(`msg-${requestedAnchorMessageId}`);

      if (!container || !el) {
        if (attempt < 12) {
          window.setTimeout(() => tryScroll(attempt + 1), 120);
        }
        return;
      }

      const targetTop = Math.max(
        0,
        el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
      );

      container.scrollTo({
        top: targetTop,
        behavior: 'smooth',
      });

      setShowJumpToLatest(false);
      wasNearBottomRef.current = false;
      lastScrolledAnchorRef.current = requestedAnchorMessageId;
    };

    const timer = window.setTimeout(() => tryScroll(), 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeConversationId, messages, requestedAnchorMessageId]);

  const latestMyMessageId = [...messages].reverse().find((m) => m.sender_id === userId)?.id;

  const chatTitle = activeOther?.username?.trim()
    ? activeOther.username
    : activeOther?.is_system_host
      ? 'LoveF8 Guide'
      : activeOther?.role === 'host'
        ? 'Host'
        : 'User';

  const otherChatMode = activeOther?.chat_mode ?? null;
  const modeLabel = getModeLabel(otherChatMode);
  const modeMatchText = getModeMatchText(myChatMode, otherChatMode);
  const headerGlowClass = getHeaderGlowClass(myChatMode, otherChatMode);
  const canReceiveSparks =
    activeOther?.role === 'host' || activeOther?.is_system_host === true;

  const headerPreviewProfile: ProfilePreviewData | null = activeOther
    ? {
        id: activeOther.id,
        username: activeOther.username,
        avatarUrl: activeOther.avatar_url ?? null,
        chat_mode: activeOther.chat_mode ?? null,
        role: activeOther.role ?? null,
        host_mode: activeOther.host_mode ?? null,
        is_system_host: activeOther.is_system_host ?? null,
        short_bio: activeOther.short_bio ?? null,
        best_at: activeOther.best_at ?? null,
        looking_for: activeOther.looking_for ?? null,
        profile_tags: activeOther.profile_tags ?? null,
        location_text: activeOther.location_text ?? null,
        timezone: activeOther.timezone ?? null,
        normally_online_start: activeOther.normally_online_start ?? null,
        normally_online_end: activeOther.normally_online_end ?? null,
      }
    : null;

  const onlineWindowLabel = useMemo(() => {
    return formatOnlineWindowForViewer(
      activeOther?.normally_online_start ?? null,
      activeOther?.normally_online_end ?? null,
      activeOther?.timezone ?? null,
      viewerTimezone ?? null
    );
  }, [
    activeOther?.normally_online_end,
    activeOther?.normally_online_start,
    activeOther?.timezone,
    viewerTimezone,
  ]);

  const timeline = useMemo(() => {
    const items = [
      ...messages.map((message) => ({
        kind: 'message' as const,
        id: message.id,
        created_at: message.created_at,
        data: message,
      })),
      ...sparkEvents.map((spark) => ({
        kind: 'spark' as const,
        id: spark.id,
        created_at: spark.created_at,
        data: spark,
      })),
    ];

    items.sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      if (at !== bt) return at - bt;
      return a.id.localeCompare(b.id);
    });

    return items;
  }, [messages, sparkEvents]);

  const handleSendAndRefocus = async () => {
  if (sendLocked) return;

  setSendLocked(true);

  if (selectedMediaFile && selectedMediaKind) {
    await onSendMessage({
      messageKind: selectedMediaKind,
      mediaFile: selectedMediaFile,
      mediaKind: selectedMediaKind,
    });
    clearSelectedMedia();
  } else {
    await onSendMessage();
  }

  setTimeout(() => {
    setSendLocked(false);
  }, 1200);

  setTimeout(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, 0);
};
  if (!activeConversationId) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200 text-xl">
            💬
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Choose a conversation</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Select a conversation from your inbox to start chatting.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-neutral-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "url('/lovef8-bg.png')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 42%',
          backgroundSize: '280px',
          filter: 'blur(0.5px)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0.84)_46%,rgba(255,255,255,0.95)_100%)]" />

      <div className="relative z-10 flex h-full min-h-0 w-full flex-col">
        <style>{`
          @keyframes lovef8MessageIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes lovef8TypingBounce {
            0%, 80%, 100% {
              transform: translateY(0);
              opacity: 0.45;
            }
            40% {
              transform: translateY(-4px);
              opacity: 1;
            }
          }

          @keyframes lovef8SparkIn {
            0% {
              opacity: 0;
              transform: scale(0.97) translateY(8px);
            }
            100% {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }

          @keyframes lovef8SparkPulse {
            0%, 100% {
              transform: scale(1);
              filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
            }
            50% {
              transform: scale(1.1);
              filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.75));
            }
          }

          @keyframes lovef8SuperSparkPulse {
            0%, 100% {
              transform: scale(1);
              filter: drop-shadow(0 0 0 rgba(217, 70, 239, 0));
            }
            50% {
              transform: scale(1.14);
              filter: drop-shadow(0 0 14px rgba(217, 70, 239, 0.8));
            }
          }

          @keyframes lovef8OverlayFade {
            0% {
              opacity: 0;
              transform: scale(0.97);
            }
            12% {
              opacity: 1;
              transform: scale(1);
            }
            82% {
              opacity: 1;
              transform: scale(1);
            }
            100% {
              opacity: 0;
              transform: scale(1.02);
            }
          }

          @keyframes lovef8CorePulse {
            0%, 100% {
              transform: scale(1);
              filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
            }
            50% {
              transform: scale(1.14);
              filter: drop-shadow(0 0 18px rgba(251, 191, 36, 0.85));
            }
          }

          @keyframes lovef8SuperCorePulse {
            0%, 100% {
              transform: scale(1);
              filter: drop-shadow(0 0 0 rgba(217, 70, 239, 0));
            }
            50% {
              transform: scale(1.18);
              filter: drop-shadow(0 0 22px rgba(217, 70, 239, 0.9));
            }
          }
        `}</style>

        <div
          className={`sticky top-0 z-10 border-b border-neutral-200/80 px-3 py-2.0 backdrop-blur transition-colors ${headerGlowClass}`}
        >
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {!isDesktop && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-neutral-800 transition hover:bg-neutral-50"
                    aria-label="Back to messages"
                  >
                    ←
                  </button>
                )}

                <button
                  type="button"
                  disabled={!headerPreviewProfile}
                  onClick={() => {
                    if (headerPreviewProfile) onOpenProfilePreview(headerPreviewProfile);
                  }}
                  className="rounded-full disabled:cursor-default"
                >
                  <HeaderAvatar
                    name={chatTitle}
                    avatarUrl={activeOther?.avatar_url}
                    online={activeOtherOnline}
                  />
                </button>

                <button
                  type="button"
                  disabled={!headerPreviewProfile}
                  onClick={() => {
                    if (headerPreviewProfile) onOpenProfilePreview(headerPreviewProfile);
                  }}
                  className="min-w-0 text-left transition hover:opacity-80 disabled:cursor-default"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-[13px] font-bold text-neutral-950">
                        {chatTitle}
                      </div>

                      {modeLabel && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${getModeClasses(
                            otherChatMode
                          )}`}
                        >
                          {modeLabel}
                        </span>
                      )}
                    </div>

                    <div className="truncate text-[11px] text-neutral-500">
                      {activeOtherOnline ? 'Online now' : activeOtherPresenceLabel}
                    </div>

                    {!activeOtherOnline && onlineWindowLabel && (
                      <div className="truncate text-[11px] text-neutral-500">
                        Normally online: {onlineWindowLabel}
                      </div>
                    )}

                    {modeMatchText && (
                      <div className="truncate text-[11px] text-neutral-500">{modeMatchText}</div>
                    )}
                  </div>
                </button>
              </div>

              {activeOther && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `/journal?conversationId=${activeConversationId}`;
                    }}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
                  >
                    Journal
                  </button>

                  {activeOther.is_system_host === true ? (
                    <span className="hidden rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-500 sm:inline-flex">
                      Protected
                    </span>
                  ) : isBlockedWithActive ? (
                    <button
                      type="button"
                      onClick={() => void onUnblock()}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onBlock()}
                      className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
                    >
                      Block
                    </button>
                  )}
                </div>
              )}
            </div>

            {activeOther?.is_system_host === true && (
              <div className="mt-2 text-xs font-medium text-neutral-500 sm:hidden">Protected</div>
            )}

            {canReceiveSparks && (
              <div className="mt-1.5">
                <ChatHeaderActions
                  otherProfile={{
                    display_name: chatTitle,
                    username: activeOther?.username ?? null,
                  }}
                  sendingSpark={sendingSpark}
                  onSendSpark={onSendSpark}
                />
              </div>
            )}
          </div>
        </div>

        {isBlockedWithActive && (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-950">
            This chat is blocked. You can’t send messages here.
          </div>
        )}
{!hasLanguageOverlap && (
  <div className="border-b border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
    You and this person may speak different languages.
    <button
      type="button"
      className="ml-2 font-bold underline"
      onClick={async () => {
        if (!activeConversationId || !userId) return;

        const newValue = !autoTranslate;

        const { error } = await supabase
          .from('conversation_translation_settings')
          .upsert(
            {
              conversation_id: activeConversationId,
              user_id: userId,
              enabled: newValue,
            },
            {
              onConflict: 'conversation_id,user_id',
            }
          );

        if (error) {
          alert(error.message);
          return;
        }

        setAutoTranslate(newValue);
      }}
    >
      {autoTranslate ? 'Turn OFF auto-translation' : 'Turn ON auto-translation'}
    </button>

    <span className="ml-2 font-semibold">
      {autoTranslate ? 'ON' : 'OFF'}
    </span>
  </div>
)}
        <div
          ref={scrollAreaRef}
          onScroll={() => {
            const nearBottom = checkNearBottom();
            wasNearBottomRef.current = nearBottom;
            setShowJumpToLatest(!nearBottom);
          }}
          className="relative min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4"
        >
          {sparkOverlay && (
            <SparkBurstOverlayCard
              senderName={sparkOverlay.senderName}
              amount={sparkOverlay.amount}
              kind={sparkOverlay.kind}
            />
          )}

          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
            {timeline.map((item) => {
              if (item.kind === 'spark') {
                const spark = item.data;
                const senderName = spark.sender_id === userId ? 'You' : chatTitle;

                return (
                  <div key={spark.id} className="flex justify-center">
                    <div className="flex w-full max-w-xl flex-col items-center">
                      <SparkEventCard
                        senderName={senderName}
                        amount={spark.amount}
                        kind={spark.spark_kind}
                      />
                      <div className="mt-1 text-center text-[11px] text-neutral-500">
                        {formatChatTimestamp(spark.created_at)}
                      </div>
                    </div>
                  </div>
                );
              }

              const m = item.data;
              const isMe = m.sender_id === userId;
              const label = isMe ? 'You' : chatTitle;
              const reactions = reactionMap[m.id] || [];
              const mediaSparks = mediaSparkMap[m.id] || [];
              const totalMediaSparks = mediaSparks.reduce((sum, spark) => sum + spark.amount, 0);
              const latestMediaSpark =
                mediaSparks.length > 0 ? mediaSparks[mediaSparks.length - 1] : null;

              const latestMediaSparkText = latestMediaSpark
                ? latestMediaSpark.sender_id === userId
                  ? `You sent ${latestMediaSpark.amount} sparks`
                  : latestMediaSpark.receiver_id === userId
                    ? `You received ${latestMediaSpark.amount} sparks`
                    : null
                : null;

              const withinWindow = mounted
                ? Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS
                : false;

              const canEdit = isMe && m.is_edited === false && withinWindow;

              const seen =
                isMe &&
                latestMyMessageId === m.id &&
                otherLastReadAt &&
                new Date(otherLastReadAt).getTime() >= new Date(m.created_at).getTime();

              const groupedReactions = Object.entries(
                reactions.reduce<Record<string, number>>((acc, reaction) => {
                  acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                  return acc;
                }, {})
              );

              return (
                <div
                  id={`msg-${m.id}`}
                  key={m.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  style={{ animation: 'lovef8MessageIn 0.18s ease-out' }}
                >
                  <div
                    onDoubleClick={() => {
                      if (isMe || isBlockedWithActive) return;
                      setReactingTo((prev) => (prev === m.id ? null : m.id));
                    }}
                    className={[
                      'max-w-[88%] rounded-[20px] px-3 py-2.5 shadow-sm transition hover:shadow-md sm:max-w-[76%]',
                      isMe
                        ? 'border border-sky-200 bg-sky-100/95 text-slate-900'
                        : 'border border-neutral-200 bg-neutral-100/95 text-neutral-900',
                    ].join(' ')}
                  >
                    {!isMe && (
                      <div className="mb-1 text-[11px] font-semibold text-neutral-500">{label}</div>
                    )}
{(!m.message_kind || m.message_kind === 'text') && (
  <p className="whitespace-pre-wrap break-words text-[15px] leading-5">
    {autoTranslate && !hasLanguageOverlap && m.sender_id !== userId
  ? (translatedMessages[m.id] || m.content)
  : m.content}
  </p>
)}

                    {m.message_kind === 'image' && m.media_path && (
                      <div className="mt-1">
                        <img
                          src={m.media_url || m.media_path}
                          alt="sent image"
                          className="max-w-[260px] cursor-pointer rounded-xl border border-neutral-200"
                          onClick={() => {
                            setLightboxImageUrl(m.media_url || m.media_path || null);
                            setLightboxImageAlt('sent image');
                          }}
                        />

                        {!isMe &&
                          activeOther?.role === 'host' &&
                          activeOther?.approved === true &&
                          !isBlockedWithActive && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void sendMediaSpark(m.id, 25)}
                                disabled={sendingMediaSparkId !== null}
                                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {sendingMediaSparkId === `${m.id}-25` ? 'Sending...' : '⚡ 25'}
                              </button>

                              <button
                                type="button"
                                onClick={() => void sendMediaSpark(m.id, 50)}
                                disabled={sendingMediaSparkId !== null}
                                className="rounded-full border border-fuchsia-300 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold text-fuchsia-900 transition hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {sendingMediaSparkId === `${m.id}-50` ? 'Sending...' : '⚡ 50'}
                              </button>
                            </div>
                          )}

                        {(latestMediaSparkText || totalMediaSparks > 0) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            {latestMediaSparkText && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-900">
                                {latestMediaSparkText}
                              </span>
                            )}

                            {totalMediaSparks > 0 && (
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-1 font-semibold text-neutral-700">
                                Media Sparks: {totalMediaSparks}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {m.message_kind === 'video' && m.media_path && (
                      <div className="mt-1">
                        <video
                          src={m.media_url || m.media_path}
                          controls
                          className="max-w-[260px] rounded-xl border border-neutral-200"
                        />

                        {!isMe &&
                          activeOther?.role === 'host' &&
                          activeOther?.approved === true &&
                          !isBlockedWithActive && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void sendMediaSpark(m.id, 25)}
                                disabled={sendingMediaSparkId !== null}
                                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {sendingMediaSparkId === `${m.id}-25` ? 'Sending...' : '⚡ 25'}
                              </button>

                              <button
                                type="button"
                                onClick={() => void sendMediaSpark(m.id, 50)}
                                disabled={sendingMediaSparkId !== null}
                                className="rounded-full border border-fuchsia-300 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold text-fuchsia-900 transition hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {sendingMediaSparkId === `${m.id}-50` ? 'Sending...' : '⚡ 50'}
                              </button>
                            </div>
                          )}

                        {(latestMediaSparkText || totalMediaSparks > 0) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            {latestMediaSparkText && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-900">
                                {latestMediaSparkText}
                              </span>
                            )}

                            {totalMediaSparks > 0 && (
                              <span className="rounded-full border border-neutral-300 bg-white px-2 py-1 font-semibold text-neutral-700">
                                Media Sparks: {totalMediaSparks}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {m.content && m.message_kind && m.message_kind !== 'text' && (
  <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-5">
    {m.content}
  </p>
)}

                    {groupedReactions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {groupedReactions.map(([emoji, count]) => {
                          const reactedByMe = reactions.some(
                            (reaction) => reaction.profile_id === userId && reaction.emoji === emoji
                          );

                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                if (isMe) return;
                                void toggleReaction(m.id, emoji);
                              }}
                              className={[
                                'rounded-full border px-2 py-0.5 text-xs shadow-sm transition',
                                isMe
                                  ? 'border-sky-300 bg-white/65 text-slate-800'
                                  : reactedByMe
                                    ? 'border-neutral-900 bg-neutral-900 text-white'
                                    : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
                              ].join(' ')}
                            >
                              {emoji} {count}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {reactingTo === m.id && !isBlockedWithActive && !isMe && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {MESSAGE_REACTION_CHOICES.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => void toggleReaction(m.id, emoji)}
                            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 shadow-sm transition hover:bg-neutral-50"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <div
                      className={[
                        'mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]',
                        isMe ? 'text-slate-600' : 'text-neutral-500',
                      ].join(' ')}
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <span>{formatChatTimestamp(m.created_at)}</span>
                        {m.is_edited === true && <span>• edited</span>}
                        {isMe && latestMyMessageId === m.id && (
                          <span>{seen ? '• Seen' : '• Sent'}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <SaveToJournalButton
                          conversationId={activeConversationId}
                          message={m as any}
                          allMessages={messages as any}
                        />

                        {!isBlockedWithActive && !isMe && (
                          <button
                            type="button"
                            onClick={() => setReactingTo((prev) => (prev === m.id ? null : m.id))}
                            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                          >
                            React
                          </button>
                        )}

                        {canEdit && !isBlockedWithActive && (
                          <button
                            type="button"
                            onClick={() => void onEditMessage(m)}
                            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeTypingName && !isBlockedWithActive && (
              <div
                className="flex justify-start"
                style={{ animation: 'lovef8MessageIn 0.18s ease-out' }}
              >
                <div className="max-w-[88%] rounded-[20px] border border-neutral-200 bg-neutral-100/95 px-3 py-2.5 shadow-sm sm:max-w-[76%]">
                  <div className="mb-1 text-[11px] font-semibold text-neutral-500">
                    {activeTypingName}
                  </div>

                  <div className="flex h-[14px] items-center gap-1">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: '#666',
                        display: 'inline-block',
                        animation: 'lovef8TypingBounce 1.1s infinite',
                      }}
                    />
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: '#666',
                        display: 'inline-block',
                        animation: 'lovef8TypingBounce 1.1s infinite 0.14s',
                      }}
                    />
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: '#666',
                        display: 'inline-block',
                        animation: 'lovef8TypingBounce 1.1s infinite 0.28s',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {showJumpToLatest && (
            <button
              type="button"
              onClick={() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                setShowJumpToLatest(false);
                wasNearBottomRef.current = true;
              }}
              className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-md transition hover:bg-neutral-50"
            >
              ↓ Back to Bottom
            </button>
          )}
        </div>

        <div className="border-t border-neutral-200/80 bg-white/92 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur sm:px-4">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-1 flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1">
  {LOVEF8_QUICK_EMOJIS.map((emoji) => (
    <button
      key={emoji}
      type="button"
      onClick={() => void appendEmoji(emoji)}
      disabled={isBlockedWithActive || sending}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`Insert ${emoji}`}
    >
      {emoji}
    </button>
  ))}
</div>

            <div className="flex items-end gap-3">
              <ComposerAvatar avatarUrl={activeOther?.avatar_url ?? null} label={chatTitle} />

              <div className="relative flex-1">
                {remainingSparkLimit !== null && activeOther?.username && (
                  <div className="mb-3 pl-1 text-xs text-neutral-500">
                    {remainingSparkLimit > 0
                      ? `You can send ${remainingSparkLimit} more sparks to ${activeOther.username} today`
                      : `You've reached your daily limit with ${activeOther.username}`}
                  </div>
                )}

                {selectedMediaFile &&
                  selectedMediaPreviewUrl &&
                  selectedMediaKind && (
                    <div className="mb-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">
                            {selectedMediaKind === 'image'
                              ? 'Image ready to send'
                              : 'Video ready to send'}
                          </div>

     {activeOther?.role !== 'host' &&
  membershipTier &&
  !['basic', 'plus', 'premium'].includes(
    String(membershipTier).trim().toLowerCase()
  ) && (
    <div className="mt-1 text-xs font-semibold text-amber-600">
      Photos & videos are a Premium feature → Upgrade to unlock
    </div>
  )}
                          <div className="text-xs text-neutral-500">
                            {selectedMediaFile.name}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={clearSelectedMedia}
                          className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3">
                        {selectedMediaKind === 'image' ? (
                          <img
                            src={selectedMediaPreviewUrl}
                            alt="Preview"
                            className="max-h-[220px] rounded-xl border border-neutral-200"
                          />
                        ) : (
                          <video
                            src={selectedMediaPreviewUrl}
                            controls
                            className="max-h-[220px] w-full rounded-xl border border-neutral-200 bg-black"
                          />
                        )}
                      </div>
                    </div>
                  )}
                <div className="flex items-end gap-2">
                  <button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={() => setEmojiOpen((prev) => !prev)}
                    disabled={isBlockedWithActive || sending}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-300 bg-white text-xl transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Open emoji picker"
                  >
                    😊
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBlockedWithActive || sending}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-300 bg-white text-xl transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Choose image"
                    title="Choose image"
                  >
                    🖼️
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handlePickMedia}
                    className="hidden"
                  />

                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => void onChangeNewMessage(e.target.value)}
                    placeholder={isBlockedWithActive ? 'Blocked' : 'Type a message…'}
                    disabled={isBlockedWithActive || sending}
                    rows={1}
                    className="min-h-[46px] max-h-[180px] flex-1 resize-none rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-[15px] leading-5 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-neutral-100"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setEmojiOpen(false);
                        setReactingTo(null);
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendAndRefocus();
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => void handleSendAndRefocus()}
                    disabled={sending || isBlockedWithActive || sendLocked}
                    className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>

                {emojiOpen && !isBlockedWithActive && (
                  <div
                    ref={emojiPanelRef}
                    className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-full max-w-[520px] rounded-3xl border border-neutral-200 bg-white p-4 shadow-2xl"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-neutral-900">Add emoji</div>
                        <div className="text-xs text-neutral-500">
                          LoveF8 spark vibes included. These are not paid Sparks.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEmojiOpen(false)}
                        className="rounded-full px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        Close
                      </button>
                    </div>

                    <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
                      {COMPOSER_EMOJI_GROUPS.map((group) => (
                        <div key={group.title}>
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                            {group.title}
                          </div>

                          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                            {group.emojis.map((emoji) => (
                              <button
                                key={`${group.title}-${emoji}`}
                                type="button"
                                onClick={() => void appendEmoji(emoji)}
                                className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-xl transition hover:bg-neutral-50"
                                aria-label={`Insert ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 text-xs text-neutral-500">
              Composer emojis are expressive only. Paid Sparks stay separate.
            </div>
          </div>
        </div>

        {lightboxImageUrl && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setLightboxImageUrl(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm font-bold text-black"
            >
              Close
            </button>

            <img
              src={lightboxImageUrl}
              alt={lightboxImageAlt}
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
}