'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function validateUsername(u: string) {
  const s = (u || '').trim();

  if (s.length < 3 || s.length > 24) return 'Username must be 3–24 characters.';
  if (s.includes('@')) return 'Username cannot contain @.';
  if (s.includes(' ')) return 'Username cannot contain spaces.';
  if (!/^[a-zA-Z0-9_]+$/.test(s)) return 'Only letters, numbers, and underscore are allowed.';

  const banned = ['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol', 'proton', 'gmx'];
  const lower = s.toLowerCase();
  if (banned.some((w) => lower.includes(w))) return 'Username cannot contain email-provider words.';

  return null;
}

async function routeUserByProfile(router: ReturnType<typeof useRouter>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('app_role, is_guide')
    .eq('id', userId)
    .single();

  if (profile?.app_role === 'admin') {
    router.push('/admin');
    return;
  }

  if (profile?.is_guide === true) {
    router.push('/guide');
    return;
  }

  router.push('/home');
}

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');

  const [busy, setBusy] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      await routeUserByProfile(router, user.id);
    })();
  }, [router]);

  async function handleLogin() {
    setBusy(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      router.push('/home');
      return;
    }

    await routeUserByProfile(router, user.id);
  }

  async function handleSignup() {
    if (!acceptedLegal) {
      alert('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    const cleanUsername = username.trim();
    const err = validateUsername(cleanUsername);
    if (err) {
      alert(err);
      return;
    }

    setBusy(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: cleanUsername,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    const sessionUser = data?.user;
    if (sessionUser) {
      await routeUserByProfile(router, sessionUser.id);
      return;
    }

    alert('Signup created. If email confirmation is enabled, check your email then log in.');
    setMode('login');
    setAcceptedLegal(false);
    setUsername('');
    setEmail('');
    setPassword('');
  }

  async function sendResetEmail() {
    setResetMsg(null);

    const clean = resetEmail.trim();
    if (!clean) {
      setResetMsg('Enter your email first.');
      return;
    }

    setResetSending(true);

    const { error } = await supabase.auth.resetPasswordForEmail(clean, {
  redirectTo: 'https://lovef8.com/auth/reset',
});

    setResetSending(false);

    if (error) {
      setResetMsg(error.message);
      return;
    }

    setResetMsg('Reset email sent. Check your inbox and click the link.');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflowX: 'hidden',
        background:
          'radial-gradient(circle at top left, rgba(255, 83, 164, 0.22), transparent 34%), radial-gradient(circle at top right, rgba(103, 58, 183, 0.22), transparent 32%), linear-gradient(180deg, #fff7fc 0%, #fff 38%, #f7f4ff 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.1,
          backgroundImage: "url('/lovef8-bg.png')",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 18%',
          backgroundSize: 'min(680px, 86vw)',
          filter: 'blur(1px)',
          transform: 'scale(1.03)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.66) 30%, rgba(255,255,255,0.92) 100%)',
        }}
      />

      <div className="auth-shell">
        <div className="auth-grid">
          <section className="auth-card">
            <div className="card-logo-wrap">
              <img src="/lovef8-bg.png" alt="LoveF8" className="card-logo" />
            </div>

            <div style={{ textAlign: 'center' }}>
              <div className="card-title">Welcome to LoveF8</div>

              <p className="card-copy">
                Sign in to continue your conversations or create your account to get started.
              </p>
            </div>

            <div className="mode-switch">
              <button
                onClick={() => setMode('login')}
                type="button"
                className={mode === 'login' ? 'mode-button active' : 'mode-button'}
              >
                Login
              </button>

              <button
                onClick={() => setMode('signup')}
                type="button"
                className={mode === 'signup' ? 'mode-button active' : 'mode-button'}
              >
                Sign up
              </button>
            </div>

            <div className="form-card">
              {mode === 'signup' && (
                <>
                  <label className="field-label">Username</label>

                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="example: tom_larson"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={inputStyle}
                  />

                  <div className="field-help">
                    Allowed: letters, numbers, underscore. No spaces. No email/provider words.
                  </div>
                </>
              )}

              <label className="field-label">Email</label>

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                style={inputStyle}
              />

              <label className="field-label">Password</label>

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  ...inputStyle,
                  marginBottom: 8,
                }}
              />

              <label className="show-password-label">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>Show password</span>
              </label>

              {mode === 'login' ? (
                <>
                  <button
                    onClick={handleLogin}
                    disabled={busy}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      minHeight: 52,
                      marginTop: 10,
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: 'none',
                      background: 'linear-gradient(135deg, #ff3f9d 0%, #8b2cf5 100%)',
                      color: '#ffffff',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      fontWeight: 900,
                      fontSize: 15,
                      boxShadow: '0 16px 34px rgba(181, 55, 154, 0.26)',
                      opacity: busy ? 0.65 : 1,
                    }}
                  >
                    {busy ? 'Signing in...' : 'Login'}
                  </button>

                  <div className="reset-block">
                    <div className="reset-title">Forgot password?</div>

                    <input
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Email for reset link"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      style={{
                        ...inputStyle,
                        marginBottom: 0,
                      }}
                    />

                    <button
                      onClick={sendResetEmail}
                      disabled={resetSending}
                      type="button"
                      className="secondary-button"
                    >
                      {resetSending ? 'Sending...' : 'Send reset email'}
                    </button>

                    {resetMsg && <div className="reset-message">{resetMsg}</div>}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginTop: 4, marginBottom: 16 }}>
                    <label className="legal-label">
                      <input
                        type="checkbox"
                        checked={acceptedLegal}
                        onChange={(e) => setAcceptedLegal(e.target.checked)}
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        I agree to the{' '}
                        <Link
                          href="/terms"
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: 'underline', fontWeight: 800, color: '#8b2cf5' }}
                        >
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: 'underline', fontWeight: 800, color: '#8b2cf5' }}
                        >
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>
                  </div>

                  <button
                    onClick={handleSignup}
                    disabled={busy || !acceptedLegal}
                    type="button"
                    className="primary-button"
                  >
                    {busy ? 'Creating account...' : 'Create account'}
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="brand-panel">
            <div className="brand-intro">
              <div className="brand-intro-title">
                Welcome to <span>LoveF8.com</span>
              </div>
              <div className="brand-intro-subtitle">
                Where real conversations happen, with Real People.
              </div>
            </div>

            <h1 className="brand-title" aria-label="Real conversations. Real people. No pressure.">
              <span className="typing-line typing-line-1">Real conversations.</span>
              <span className="typing-line typing-line-2">Real people.</span>
              <span className="typing-line typing-line-3">No pressure.</span>
            </h1>

            <div className="brand-copy">
              <div>LoveF8 is where real conversations actually happen.</div>
              <div>A warmer place to start something real.</div>
              <div>Show up as you are, and find someone who genuinely wants to talk back.</div>
              <div>
                No pressure. No perfect-match promises — just something real from the very first
                message.
              </div>
            </div>

            <div className="brand-tags">
              <div className="brand-tag">Real-time conversations</div>
              <div className="brand-tag">Someone to talk to</div>
              <div className="brand-tag">Real human connection</div>
            </div>

            <div className="brand-trust-line">
              Built for people who want someone to actually talk back.
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .auth-shell {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 18px;
          box-sizing: border-box;
        }

        .auth-grid {
          width: 100%;
          max-width: 1120px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: start;
        }

        .auth-card {
          min-width: 0;
          border-radius: 28px;
          border: 1px solid rgba(228, 214, 255, 0.95);
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          box-shadow: 0 24px 70px rgba(83, 34, 115, 0.14);
          padding: 28px;
          align-self: center;
          box-sizing: border-box;
        }

        .card-logo-wrap {
          display: flex;
          justify-content: center;
        }

        .card-logo {
          width: 150px;
          height: 150px;
          object-fit: contain;
          margin-bottom: 10px;
          filter: drop-shadow(0 16px 28px rgba(255, 63, 157, 0.22));
        }

        .card-title {
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #231433;
        }

        .card-copy {
          margin-top: 12px;
          margin-bottom: 0;
          font-size: 15px;
          line-height: 1.6;
          color: #6b617f;
        }

        .mode-switch {
          margin-top: 22px;
          display: flex;
          gap: 10px;
          padding: 6px;
          border-radius: 16px;
          background: #f7f2ff;
          border: 1px solid #eadcff;
        }

        .mode-button {
          flex: 1;
          padding: 12px 14px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: #6f6289;
          cursor: pointer;
          font-weight: 900;
          transition: all 0.2s ease;
        }

        .mode-button.active {
          background: linear-gradient(135deg, #ff3f9d 0%, #8b2cf5 100%);
          color: white;
          box-shadow: 0 10px 24px rgba(181, 55, 154, 0.25);
        }

        .form-card {
          margin-top: 20px;
          border: 1px solid #efe4ff;
          border-radius: 22px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.92);
          box-sizing: border-box;
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 8px;
          color: #5d5078;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .field-help {
          font-size: 12px;
          line-height: 1.5;
          color: #7b6e94;
          margin-top: -2px;
          margin-bottom: 14px;
        }

        .show-password-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          color: #5d5078;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 52px;
          margin-top: 8px;
          padding: 14px 16px;
          border-radius: 14px;
          border: none;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          background: linear-gradient(135deg, #ff3f9d 0%, #8b2cf5 100%);
          color: #ffffff;
          cursor: pointer;
          font-weight: 900;
          font-size: 15px;
          text-align: center;
          text-decoration: none;
          box-shadow: 0 16px 34px rgba(181, 55, 154, 0.26);
          opacity: 1;
        }

        .primary-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .reset-block {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid #f0e8ff;
        }

        .reset-title {
          font-weight: 900;
          margin-bottom: 10px;
          color: #312146;
        }

        .secondary-button {
          margin-top: 10px;
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid #eadcff;
          background: #fff;
          color: #5b476e;
          cursor: pointer;
          opacity: 1;
          font-weight: 900;
        }

        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .reset-message {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.5;
          color: #6d6281;
        }

        .legal-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13px;
          line-height: 1.5;
          color: #534566;
          cursor: pointer;
        }

        .brand-panel {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 22px 18px;
          border-radius: 30px;
          background:
            radial-gradient(circle at top left, rgba(255, 63, 157, 0.16), transparent 36%),
            radial-gradient(circle at bottom right, rgba(139, 44, 245, 0.16), transparent 34%),
            rgba(255, 255, 255, 0.42);
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 0 24px 70px rgba(83, 34, 115, 0.1);
        }

        .brand-intro {
          margin-bottom: 8px;
        }

        .brand-intro-title {
          font-size: clamp(21px, 2.4vw, 28px);
          line-height: 1.06;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #2b1841;
        }

        .brand-intro-title span {
          background: linear-gradient(135deg, #ff3f9d 0%, #8b2cf5 55%, #4f46e5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          color: transparent;
          text-shadow: 0 10px 24px rgba(181, 55, 154, 0.14);
        }

        .brand-intro-subtitle {
          margin-top: 5px;
          max-width: 540px;
          font-size: 13px;
          line-height: 1.3;
          font-weight: 700;
          color: #6a5a82;
        }

        .brand-title {
          margin-top: 8px;
          margin-bottom: 0;
          display: grid;
          gap: 0;
          font-size: clamp(24px, 3.3vw, 40px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.045em;
          color: #1f1333;
        }

        .typing-line {
          display: block;
          width: 0;
          max-width: fit-content;
          overflow: hidden;
          white-space: nowrap;
          border-right: 3px solid rgba(139, 44, 245, 0.8);
        }

        .typing-line-1 {
          animation:
            typeLoopLine1 7.2s steps(19, end) infinite,
            blinkCaret 0.75s step-end infinite;
        }

        .typing-line-2 {
          animation:
            typeLoopLine2 7.2s steps(12, end) infinite,
            blinkCaret 0.75s step-end infinite;
        }

        .typing-line-3 {
          animation:
            typeLoopLine3 7.2s steps(12, end) infinite,
            blinkCaret 0.75s step-end infinite;
        }

        @keyframes typeLoopLine1 {
          0% {
            width: 0;
          }
          18% {
            width: 19ch;
          }
          82% {
            width: 19ch;
          }
          100% {
            width: 0;
          }
        }

        @keyframes typeLoopLine2 {
          0%,
          22% {
            width: 0;
          }
          40% {
            width: 12ch;
          }
          82% {
            width: 12ch;
          }
          100% {
            width: 0;
          }
        }

        @keyframes typeLoopLine3 {
          0%,
          44% {
            width: 0;
          }
          62% {
            width: 12ch;
          }
          82% {
            width: 12ch;
          }
          100% {
            width: 0;
          }
        }

        @keyframes blinkCaret {
          50% {
            border-color: transparent;
          }
        }

        .brand-copy {
          margin-top: 10px;
          max-width: 560px;
          display: grid;
          gap: 7px;
          font-size: 14px;
          line-height: 1.34;
          color: #5f5575;
        }

        .brand-tags {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .brand-tag {
          padding: 7px 11px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(255, 63, 157, 0.14), rgba(139, 44, 245, 0.14));
          border: 1px solid rgba(255, 105, 180, 0.3);
          box-shadow: 0 12px 30px rgba(181, 55, 154, 0.1);
          color: #3b214f;
          font-size: 12px;
          line-height: 1.1;
          font-weight: 900;
        }

        .brand-trust-line {
          margin-top: 10px;
          max-width: 520px;
          color: #4b3f66;
          font-size: 13px;
          line-height: 1.3;
          font-weight: 800;
        }

        @media (min-width: 961px) {
          .auth-grid {
            grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
            gap: 24px;
            align-items: center;
          }
        }

        @media (max-width: 960px) {
          .auth-shell {
            align-items: flex-start;
            padding: 14px 12px 24px;
          }

          .auth-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            max-width: 640px;
          }

          .auth-card {
            padding: 18px;
            border-radius: 24px;
          }

          .brand-panel {
            padding: 16px 14px;
            border-radius: 24px;
          }

          .brand-title {
            font-size: 30px;
          }

          .brand-copy {
            font-size: 13px;
            line-height: 1.35;
            max-width: 100%;
          }

          .brand-tags {
            gap: 6px;
          }

          .brand-tag {
            padding: 6px 10px;
            font-size: 11px;
          }

          .card-logo {
            width: 84px;
            height: 84px;
          }

          .card-title {
            font-size: 30px;
          }

          .form-card {
            padding: 16px;
            border-radius: 18px;
          }
        }

        @media (max-width: 560px) {
          .auth-shell {
            padding: 10px 8px 18px;
          }

          .auth-grid {
            gap: 10px;
          }

          .auth-card {
            padding: 14px;
            border-radius: 22px;
          }

          .brand-panel {
            padding: 14px 12px;
            border-radius: 22px;
          }

          .brand-intro {
            margin-bottom: 6px;
          }

          .brand-intro-title {
            font-size: 20px;
            line-height: 1.05;
          }

          .brand-intro-subtitle {
            margin-top: 5px;
            font-size: 12px;
            line-height: 1.25;
          }

          .brand-title {
            font-size: 23px;
            line-height: 1;
            gap: 0;
            margin-top: 7px;
          }

          .brand-copy {
            margin-top: 8px;
            gap: 6px;
            font-size: 12px;
            line-height: 1.28;
          }

          .brand-tags {
            margin-top: 10px;
            gap: 5px;
          }

          .brand-tag {
            padding: 5px 8px;
            font-size: 10px;
            line-height: 1.1;
          }

          .brand-trust-line {
            margin-top: 8px;
            font-size: 12px;
            line-height: 1.25;
          }

          .card-logo {
            width: 90px;
            height: 90px;
          }

          .mode-switch {
            gap: 8px;
            padding: 5px;
          }

          .mode-button {
            padding: 11px 10px;
            font-size: 14px;
          }

          .card-title {
            font-size: 28px;
          }

          .form-card {
            padding: 14px;
          }
        }
      `}</style>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 14px',
  borderRadius: 14,
  border: '1px solid #e7d8ff',
  background: '#fff',
  color: '#2a1b3f',
  marginBottom: 14,
  outline: 'none',
  fontSize: 15,
  boxSizing: 'border-box',
  boxShadow: 'inset 0 1px 2px rgba(26, 11, 46, 0.04)',
};