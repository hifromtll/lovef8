'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function updatePassword() {
    if (!password || password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert('Password updated successfully.');
    router.push('/messages');
  }

  return (
    <main style={{ maxWidth: 400, margin: '100px auto' }}>
      <h1>Reset Password</h1>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          width: '100%',
          padding: 10,
          marginTop: 20,
          borderRadius: 8,
          border: '1px solid #ccc',
        }}
      />

      <button
        onClick={updatePassword}
        disabled={saving}
        style={{
          marginTop: 20,
          width: '100%',
          padding: 12,
          background: 'black',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {saving ? 'Saving...' : 'Update Password'}
      </button>
    </main>
  );
}