import { supabase } from '@/lib/supabaseClient';

export async function touchLastLogin(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({
      last_login_at: new Date().toISOString(),
      account_state: 'active',
      idle_disabled_at: null,
    })
    .eq('id', userId);

  if (error) {
    console.error('touchLastLogin error:', error);
  }
}