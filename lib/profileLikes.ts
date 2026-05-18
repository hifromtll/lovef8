import { SupabaseClient } from '@supabase/supabase-js';

export type ProfileLikeStatus = {
  likedByMe: boolean;
  likesMe: boolean;
  isMatch: boolean;
};

export async function getProfileLikeStatus(
  supabase: SupabaseClient,
  myProfileId: string,
  otherProfileId: string
): Promise<ProfileLikeStatus> {
  if (!myProfileId || !otherProfileId || myProfileId === otherProfileId) {
    return {
      likedByMe: false,
      likesMe: false,
      isMatch: false,
    };
  }

  const { data, error } = await supabase
    .from('profile_likes')
    .select('sender_profile_id, receiver_profile_id')
    .or(
      `and(sender_profile_id.eq.${myProfileId},receiver_profile_id.eq.${otherProfileId}),and(sender_profile_id.eq.${otherProfileId},receiver_profile_id.eq.${myProfileId})`
    );

  if (error) {
    console.error('getProfileLikeStatus error:', error);
    return {
      likedByMe: false,
      likesMe: false,
      isMatch: false,
    };
  }

  const likedByMe =
    data?.some(
      (like) =>
        like.sender_profile_id === myProfileId &&
        like.receiver_profile_id === otherProfileId
    ) ?? false;

  const likesMe =
    data?.some(
      (like) =>
        like.sender_profile_id === otherProfileId &&
        like.receiver_profile_id === myProfileId
    ) ?? false;

  return {
    likedByMe,
    likesMe,
    isMatch: likedByMe && likesMe,
  };
}

export async function likeProfile(
  supabase: SupabaseClient,
  myProfileId: string,
  otherProfileId: string
): Promise<{ ok: boolean; isMatch: boolean }> {
  if (!myProfileId || !otherProfileId || myProfileId === otherProfileId) {
    return { ok: false, isMatch: false };
  }

  const { error } = await supabase.from('profile_likes').upsert(
    {
      sender_profile_id: myProfileId,
      receiver_profile_id: otherProfileId,
    },
    {
      onConflict: 'sender_profile_id,receiver_profile_id',
      ignoreDuplicates: true,
    }
  );

   if (error) {
    console.error('likeProfile error:', error.message || error);
    alert(error.message || 'Could not like this profile.');
    return { ok: false, isMatch: false };
  }

  const status = await getProfileLikeStatus(
    supabase,
    myProfileId,
    otherProfileId
  );

  return {
    ok: true,
    isMatch: status.isMatch,
  };
}

export async function unlikeProfile(
  supabase: SupabaseClient,
  myProfileId: string,
  otherProfileId: string
): Promise<{ ok: boolean }> {
  if (!myProfileId || !otherProfileId || myProfileId === otherProfileId) {
    return { ok: false };
  }

  const { error } = await supabase
    .from('profile_likes')
    .delete()
    .eq('sender_profile_id', myProfileId)
    .eq('receiver_profile_id', otherProfileId);

  if (error) {
    console.error('unlikeProfile error:', error);
    return { ok: false };
  }

  return { ok: true };
}