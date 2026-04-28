export type JournalSliceMessage = {
  id: string;
  sender_id: string;
  sender_label: string;
  content: string;
  created_at: string;
};

export type JournalSnapshot = {
  version: 2;
  anchor_message_id: string;
  message_count: number;
  messages: JournalSliceMessage[];
};

type MessageLike = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function sortMessagesAsc(messages: MessageLike[]) {
  return [...messages].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return aTime - bTime;
  });
}

function buildSenderLabelMap(messages: MessageLike[]) {
  const uniqueSenderIds = Array.from(new Set(messages.map((m) => m.sender_id)));

  const senderOrder = new Map<string, number>();
  uniqueSenderIds.forEach((senderId, index) => {
    senderOrder.set(senderId, index);
  });

  const labels = new Map<string, string>();

  uniqueSenderIds.forEach((senderId, index) => {
    if (index === 0) {
      labels.set(senderId, 'You');
    } else if (index === 1) {
      labels.set(senderId, 'Them');
    } else {
      labels.set(senderId, `Participant ${index + 1}`);
    }
  });

  return { labels, senderOrder };
}

export function buildJournalSnapshot(
  messages: MessageLike[],
  anchorMessageId: string
): JournalSnapshot {
  const sorted = sortMessagesAsc(messages);
  const anchorIndex = sorted.findIndex((m) => m.id === anchorMessageId);

  if (anchorIndex === -1) {
    throw new Error('Anchor message not found.');
  }

  const anchor = sorted[anchorIndex];
  const senderTotals = new Map<string, number>();

  for (const msg of sorted) {
    senderTotals.set(msg.sender_id, (senderTotals.get(msg.sender_id) ?? 0) + 1);
  }

  const targetPerSender = new Map<string, number>();
  for (const [senderId, total] of senderTotals.entries()) {
    targetPerSender.set(senderId, Math.min(2, total));
  }

  const selectedIndexes = new Set<number>([anchorIndex]);
  const selectedPerSender = new Map<string, number>();
  selectedPerSender.set(anchor.sender_id, 1);

  let step = 1;

  while (step < sorted.length) {
    let addedThisRound = false;

    const candidates = [anchorIndex - step, anchorIndex + step];

    for (const idx of candidates) {
      if (idx < 0 || idx >= sorted.length) continue;
      if (selectedIndexes.has(idx)) continue;

      const msg = sorted[idx];
      const currentCount = selectedPerSender.get(msg.sender_id) ?? 0;
      const targetCount = targetPerSender.get(msg.sender_id) ?? 0;

      if (currentCount >= targetCount) continue;

      selectedIndexes.add(idx);
      selectedPerSender.set(msg.sender_id, currentCount + 1);
      addedThisRound = true;
    }

    const allSatisfied = [...targetPerSender.entries()].every(([senderId, target]) => {
      return (selectedPerSender.get(senderId) ?? 0) >= target;
    });

    if (allSatisfied) break;

    const canStillAdd = sorted.some((msg, idx) => {
      if (selectedIndexes.has(idx)) return false;
      const currentCount = selectedPerSender.get(msg.sender_id) ?? 0;
      const targetCount = targetPerSender.get(msg.sender_id) ?? 0;
      return currentCount < targetCount;
    });

    if (!canStillAdd && !addedThisRound) break;

    step += 1;
  }

  const { labels } = buildSenderLabelMap(sorted);

  const selectedMessages = [...selectedIndexes]
    .sort((a, b) => a - b)
    .map((idx) => {
      const msg = sorted[idx];
      return {
        id: msg.id,
        sender_id: msg.sender_id,
        sender_label: labels.get(msg.sender_id) ?? 'Unknown',
        content: msg.content,
        created_at: msg.created_at,
      };
    });

  return {
    version: 2,
    anchor_message_id: anchorMessageId,
    message_count: selectedMessages.length,
    messages: selectedMessages,
  };
}