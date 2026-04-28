export const EDIT_WINDOW_MS = 3 * 60 * 1000;

export function snippet(s: string, n = 34) {
  const t = (s || '').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + '…';
}

export function lsKeyOpened(convoId: string) {
  return `lovef8:last_opened:${convoId}`;
}

export function getLastOpened(convoId: string): number {
  try {
    const raw = localStorage.getItem(lsKeyOpened(convoId));
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
}

export function setLastOpened(convoId: string, whenMs: number) {
  try {
    localStorage.setItem(lsKeyOpened(convoId), String(whenMs));
  } catch {
    // ignore
  }
}

export function lsKeySpamNudge(convoId: string) {
  return `lovef8:spam_nudge:${convoId}`;
}

export function shouldShowSpamNudge(convoId: string, nowMs: number): boolean {
  try {
    const raw = localStorage.getItem(lsKeySpamNudge(convoId));
    const last = raw ? Number(raw) : 0;
    if (!Number.isFinite(last)) return true;
    return nowMs - last > 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

export function markSpamNudgeShown(convoId: string, nowMs: number) {
  try {
    localStorage.setItem(lsKeySpamNudge(convoId), String(nowMs));
  } catch {
    // ignore
  }
}

export function normalizeLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export function getSharedLanguages(a: unknown, b: unknown): string[] {
  const aList = normalizeLanguages(a);
  const bList = normalizeLanguages(b);

  if (aList.length === 0 || bList.length === 0) return [];

  const bSet = new Set(bList.map((lang) => lang.toLowerCase()));

  return aList.filter((lang) => bSet.has(lang.toLowerCase()));
}

export function hasSharedLanguage(a: unknown, b: unknown): boolean {
  return getSharedLanguages(a, b).length > 0;
}