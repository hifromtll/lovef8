export const FREE_MESSAGE_COST = 2;
export const FREE_WEEKLY_SPARKS = 60;
export const FREE_MAX_ACTIVE_CHATS = 3;
export const FREE_MAX_MEMORIES = 3;

export type MembershipTier = 'free' | 'paid';

type ProfileLike = {
  membership_status?: string | null;
  membership_tier?: string | null;
  is_subscribed?: boolean | null;
  subscription_active?: boolean | null;
  [key: string]: unknown;
};

export function getMembershipTier(profile: ProfileLike | null | undefined): MembershipTier {
  if (!profile) return 'free';

  const status = String(profile.membership_status || '').toLowerCase().trim();
  const tier = String(profile.membership_tier || '').toLowerCase().trim();

  if (profile.is_subscribed === true) return 'paid';
  if (profile.subscription_active === true) return 'paid';
  if (status === 'active' || status === 'paid' || status === 'premium') return 'paid';
  if (
  tier === 'paid' ||
  tier === 'basic' ||
  tier === 'plus' ||
  tier === 'premium' ||
  tier === 'member'
) {
  return 'paid';
}

  return 'free';
}

export function isPaidMember(profile: ProfileLike | null | undefined): boolean {
  return getMembershipTier(profile) === 'paid';
}

export function getMessageCost(profile: ProfileLike | null | undefined): number {
  return isPaidMember(profile) ? 0 : FREE_MESSAGE_COST;
}

export function getMaxActiveChats(profile: ProfileLike | null | undefined): number | null {
  return isPaidMember(profile) ? null : FREE_MAX_ACTIVE_CHATS;
}

export function getMaxMemories(profile: ProfileLike | null | undefined): number | null {
  return isPaidMember(profile) ? null : FREE_MAX_MEMORIES;
}

export function canSendImages(profile: ProfileLike | null | undefined): boolean {
  return isPaidMember(profile);
}

export function hostEarnsFromMessage(profile: ProfileLike | null | undefined): boolean {
  return isPaidMember(profile);
}

export function getOutOfSparksMessage() {
  return 'You’re out of sparks.\nUpgrade to keep the conversation going ⚡';
}

export function getJournalLimitMessage() {
  return 'You’ve saved 3 memories.\nUpgrade to keep saving meaningful moments 💙';
}

export function getMediaLockedMessage() {
  return 'Photo sharing is a premium feature.\nUpgrade to send moments that matter 📸';
}

export function getChatLimitMessage() {
  return 'You’ve reached your active chat limit.\nUpgrade to connect with more people.';
}