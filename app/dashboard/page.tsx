'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    async function routeUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_guide')
        .eq('id', user.id)
        .single();

      if (profile?.is_guide) {
        router.push('/guide');
      } else if (profile?.role === 'host') {
        router.push('/host');
      } else {
        router.push('/user');
      }
    }

    void routeUser();
  }, [router]);

  return <div style={{ padding: 40 }}>Redirecting...</div>;
}