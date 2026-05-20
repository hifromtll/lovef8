export type ChatMode = 'chatty' | 'flirty' | 'romantic' | 'open_all';

export type MessageReaction = {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_edited: boolean;
  message_kind: 'text' | 'image' | 'video';
  media_path: string | null;
  media_url?: string | null;
  media_mime_type: string | null;
  media_duration_seconds: number | null;
  message_reactions?: MessageReaction[];
};

export type ParticipantRow = {
  conversation_id: string;
  profile_id: string;
};

export type ProfileMini = {
  id: string;
  username: string | null;
  host_mode: string | null;
  role: string | null;
  approved: boolean | null;
  is_system_host: boolean | null;
  chat_mode: ChatMode | null;
  avatar_url: string | null;
  avatar_thumb_url?: string | null;

  headline?: string | null;
  short_bio: string | null;
  about_long?: string | null;
  talk_topics?: string | null;
  style_vibe?: string | null;

  best_at: string | null;
  looking_for: string | null;
  profile_tags: string[] | null;

  location_text?: string | null;
  country_origin?: string | null;
  region_origin?: string | null;
  timezone?: string | null;
  languages_spoken?: string[] | null;
  normally_online_start?: string | null;
  normally_online_end?: string | null;

  age?: number | null;
  gender?: string | null;
  interested_in?: string[] | null;
  relationship_goal?: string | null;
  has_kids?: boolean | null;
  wants_kids?: string | null;

  drink?: string | null;
  smoke?: string | null;
  exercise?: string | null;
  pets?: boolean | null;
  morning_or_night?: string | null;
  long_distance_open?: boolean | null;

  three_words?: string | null;
  people_notice?: string | null;
  proud_of?: string | null;
  biggest_strength?: string | null;
  what_matters?: string | null;
  non_negotiable?: string | null;
  healthy_relationship?: string | null;
  hidden_talent?: string | null;
  controversial_opinion?: string | null;
  simple_pleasures?: string | null;
  two_truths_lie?: string | null;
};

export type MyProfile = {
  created_at?: string | null;
  role: string | null;
  approved: boolean | null;
  is_system_host: boolean | null;
  discoverable: boolean | null;
  chat_mode: ChatMode | null;
  avatar_url: string | null;
  avatar_thumb_url?: string | null;
  membership_tier?: string | null;

  headline?: string | null;
  short_bio?: string | null;
  about_long?: string | null;
  talk_topics?: string | null;
  style_vibe?: string | null;

  best_at?: string | null;
  looking_for?: string | null;
  profile_tags?: string[] | null;

  location_text?: string | null;
  country_origin?: string | null;
  region_origin?: string | null;
  timezone?: string | null;
  normally_online_start?: string | null;
  normally_online_end?: string | null;

  age?: number | null;
  gender?: string | null;
  interested_in?: string[] | null;
  relationship_goal?: string | null;
  has_kids?: boolean | null;
  wants_kids?: string | null;

  drink?: string | null;
  smoke?: string | null;
  exercise?: string | null;
  pets?: boolean | null;
  morning_or_night?: string | null;
  long_distance_open?: boolean | null;

  three_words?: string | null;
  people_notice?: string | null;
  proud_of?: string | null;
  biggest_strength?: string | null;
  what_matters?: string | null;
  non_negotiable?: string | null;
  healthy_relationship?: string | null;
  hidden_talent?: string | null;
  controversial_opinion?: string | null;
  simple_pleasures?: string | null;
  two_truths_lie?: string | null;

  photo_urls?: string[] | null;
  photo_count?: number | null;
  can_earn?: boolean | null;
};

export type HostRow = {
  id: string;
  username: string | null;
  host_mode: string | null;
  chat_mode: ChatMode | null;
  avatar_url: string | null;
  avatar_thumb_url?: string | null;

  headline?: string | null;
  short_bio: string | null;
  about_long?: string | null;
  talk_topics?: string | null;
  style_vibe?: string | null;

  best_at: string | null;
  looking_for: string | null;
  profile_tags: string[] | null;

  location_text?: string | null;
  country_origin?: string | null;
  region_origin?: string | null;
  timezone?: string | null;
  normally_online_start?: string | null;
  normally_online_end?: string | null;
  languages_spoken?: string[] | null;

  age?: number | null;
  gender?: string | null;
  interested_in?: string[] | null;
  relationship_goal?: string | null;
  has_kids?: boolean | null;
  wants_kids?: string | null;

  drink?: string | null;
  smoke?: string | null;
  exercise?: string | null;
  pets?: boolean | null;
  morning_or_night?: string | null;
  long_distance_open?: boolean | null;

  three_words?: string | null;
  people_notice?: string | null;
  proud_of?: string | null;
  biggest_strength?: string | null;
  what_matters?: string | null;
  non_negotiable?: string | null;
  healthy_relationship?: string | null;
  hidden_talent?: string | null;
  controversial_opinion?: string | null;
  simple_pleasures?: string | null;
  two_truths_lie?: string | null;

  photo_urls?: string[] | null;
  photo_count?: number | null;
  can_earn?: boolean | null;
};

export type UserRow = {
  id: string;
  username: string | null;
  chat_mode: ChatMode | null;
  avatar_url: string | null;
  avatar_thumb_url?: string | null;
  created_at?: string | null;

  headline?: string | null;
  short_bio: string | null;
  about_long?: string | null;
  talk_topics?: string | null;
  style_vibe?: string | null;

  best_at: string | null;
  looking_for: string | null;
  profile_tags: string[] | null;

  location_text?: string | null;
  country_origin?: string | null;
  region_origin?: string | null;
  timezone?: string | null;
  normally_online_start?: string | null;
  normally_online_end?: string | null;
  languages_spoken?: string[] | null;

  age?: number | null;
  gender?: string | null;
  interested_in?: string[] | null;
  relationship_goal?: string | null;
  has_kids?: boolean | null;
  wants_kids?: string | null;

  drink?: string | null;
  smoke?: string | null;
  exercise?: string | null;
  pets?: boolean | null;
  morning_or_night?: string | null;
  long_distance_open?: boolean | null;

  three_words?: string | null;
  people_notice?: string | null;
  proud_of?: string | null;
  biggest_strength?: string | null;
  what_matters?: string | null;
  non_negotiable?: string | null;
  healthy_relationship?: string | null;
  hidden_talent?: string | null;
  controversial_opinion?: string | null;
  simple_pleasures?: string | null;
  two_truths_lie?: string | null;

  photo_urls?: string[] | null;
  photo_count?: number | null;
  can_earn?: boolean | null;
};

export type LastMsg = {
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

export type ProfilePreviewData = {
  id: string;
  username: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  photo_urls?: string[] | null;

  chat_mode?: ChatMode | null;
  role?: string | null;
  host_mode?: string | null;
  approved?: boolean | null;
  is_system_host?: boolean | null;

  headline?: string | null;
  short_bio?: string | null;
  about_long?: string | null;
  talk_topics?: string | null;
  style_vibe?: string | null;

  best_at?: string | null;
  looking_for?: string | null;
  profile_tags?: string[] | null;

  location_text?: string | null;
  country_origin?: string | null;
  region_origin?: string | null;
  timezone?: string | null;
  normally_online_start?: string | null;
  normally_online_end?: string | null;

  age?: number | null;
  gender?: string | null;
  interested_in?: string[] | null;
  relationship_goal?: string | null;
  has_kids?: boolean | null;
  wants_kids?: string | null;

  drink?: string | null;
  smoke?: string | null;
  exercise?: string | null;
  pets?: boolean | null;
  morning_or_night?: string | null;
  long_distance_open?: boolean | null;

  three_words?: string | null;
  people_notice?: string | null;
  proud_of?: string | null;
  biggest_strength?: string | null;
  what_matters?: string | null;
  non_negotiable?: string | null;
  healthy_relationship?: string | null;
  hidden_talent?: string | null;
  controversial_opinion?: string | null;
  simple_pleasures?: string | null;
  two_truths_lie?: string | null;

  photo_count?: number | null;
  can_earn?: boolean | null;
};