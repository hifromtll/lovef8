'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function BrowseHostsPage() {
  const [hosts, setHosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHosts() {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, host_mode')
        .eq('role', 'host')
        .eq('is_system_host', false);

      setHosts(data || []);
      setLoading(false);
    }

    loadHosts();
  }, []);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <main style={{ padding: 40 }}>
      <h1>Browse Hosts</h1>

      {hosts.length === 0 && <p>No hosts available yet.</p>}

      {hosts.map((host) => (
        <div
          key={host.id}
          style={{
            border: '1px solid #ddd',
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <p><strong>Name:</strong> {host.username || '(no name yet)'}</p>
          <p><strong>Mode:</strong> {host.host_mode}</p>
        </div>
      ))}
    </main>
  );
}
