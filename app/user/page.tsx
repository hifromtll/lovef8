'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function UserPage() {
  const router = useRouter();

  async function becomeHost() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from('profiles')
      .update({ role: 'host' })
      .eq('id', user.id);

    router.push('/dashboard');
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>User Dashboard</h1>

      <p>
        Coming next: browse hosts, favorites, and messages.
      </p>

      <button
        onClick={becomeHost}
        style={{
          marginTop: 20,
          padding: 10,
          borderRadius: 8,
          border: 'none',
          background: 'black',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        Become a Host
      </button>
    </main>
  );
}
