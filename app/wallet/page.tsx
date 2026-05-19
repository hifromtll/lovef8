'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const UI_STRINGS = [
  'Loading wallet...',
  'LoveF8 Wallet',
  'Sparks, boosters, and membership',
  'Manage your spark balance, test membership plans, and add booster sparks.',
  'Back to Messages',
  'Back to Connect',
  'Total Available',
  'Membership Sparks',
  'Booster Sparks',
  'Membership Plans',
  'Membership sparks are paid weekly across 4 weeks.',
  'Most Popular',
  'Current',
  'sparks total',
  'sparks per week for 4 weeks',
  'Start Membership',
  'Starting Membership...',
  'Boosters',
  'Booster sparks stay available for 3 months from purchase.',
  'Expires in 3 months',
  'Best Value',
  'Great Value',
  'Buy Sparks',
  'Adding Sparks...',
  'View in English',
  'Use Selected Language',
  'FREE UNLIMITED Messages',
  'Save photos to Journal',
  'Save up to 20 photos',
  'Save up to 4 videos',
  'Save up to 100 photos',
  'Save up to 10 videos',
];

type Profile = {
  id: string;
  country_origin: string | null;
  membership_tier: string | null;
  membership_status: string | null;
  membership_sparks_monthly: number | null;
  membership_spark_balance: number | null;
  membership_renews_at: string | null;
  membership_expires_at: string | null;
  languages_spoken?: string[] | null;
};

type BoosterCredit = {
  id: string;
  sparks_total: number;
  sparks_remaining: number;
  expires_at: string;
  created_at: string;
  source: string;
};

const MEMBERSHIPS = [
  { key: 'basic', name: 'Basic', price: 8.99, sparks: 1000 },
  { key: 'plus', name: 'Plus', price: 17.99, sparks: 2200 },
  { key: 'premium', name: 'Premium', price: 22.99, sparks: 3200 },
] as const;

const BOOSTERS = [
  { key: 'b0', price: 2.99, sparks: 250 },
  { key: 'b1', price: 4.99, sparks: 450 },
  { key: 'b2', price: 9.99, sparks: 900 },
  { key: 'b3', price: 19.99, sparks: 2000 },
  { key: 'b5', price: 29.99, sparks: 3600 },
  { key: 'b6', price: 39.99, sparks: 5600 },
] as const;

export default function WalletPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [boosterCredits, setBoosterCredits] = useState<BoosterCredit[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [translated, setTranslated] = useState<Record<string, string>>({});
  const [forceEnglish, setForceEnglish] = useState(false);

  async function loadWallet() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    await supabase.rpc('grant_weekly_membership_sparks');

    const { data: profileData } = await supabase
      .from('profiles')
      .select(`
        id,
        country_origin,
        membership_tier,
        membership_status,
        membership_sparks_monthly,
        membership_spark_balance,
        membership_renews_at,
        membership_expires_at,
        languages_spoken
      `)
      .eq('id', user.id)
      .single();

    setProfile(profileData as Profile);
    console.log('WALLET country_origin:', profileData?.country_origin);

    const nowIso = new Date().toISOString();

    const { data: boosterData } = await supabase
      .from('member_booster_credits')
      .select('id, sparks_total, sparks_remaining, expires_at, created_at, source')
      .eq('profile_id', user.id)
      .gt('sparks_remaining', 0)
      .gt('expires_at', nowIso);

    setBoosterCredits((boosterData || []) as BoosterCredit[]);

    setLoading(false);
  }

  useEffect(() => {
    void loadWallet();
  }, []);

  useEffect(() => {
    async function loadTranslations() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data: languageProfile } = await supabase
          .from('profiles')
          .select('languages_spoken')
          .eq('id', user.id)
          .single();

        const lang = languageProfile?.languages_spoken?.[0] || 'en';
        setTargetLanguage(lang);

        if (lang === 'en') return;

        const res = await fetch('/api/translate-settings-ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: UI_STRINGS,
            targetLanguage: lang,
          }),
        });

        const data = await res.json();

if (Array.isArray(data?.translations)) {
  const map: Record<string, string> = {};

  data.translations.forEach(
    (item: { original?: string; translated?: string }) => {
      if (!item?.original) return;
      map[item.original] = item.translated || item.original;
    }
  );

  setTranslated(map);
} else {
  setTranslated({});
}
      } catch (err) {
        console.error('Wallet translation load failed', err);
      }
    }

    void loadTranslations();
  }, []);

  async function addTestBooster(sparks: number, key: string) {
    setActionKey(key);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setActionKey(null);
      return;
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    await supabase.from('member_booster_credits').insert({
      profile_id: user.id,
      sparks_total: sparks,
      sparks_remaining: sparks,
      expires_at: expiresAt.toISOString(),
      source: 'test_booster',
    });

    await loadWallet();
    setActionKey(null);
  }

  async function addTestMembership(plan: (typeof MEMBERSHIPS)[number]) {
    setActionKey(plan.key);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setActionKey(null);
      return;
    }

    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    const weekly = Math.floor(plan.sparks / 4);

    await supabase
      .from('profiles')
      .update({
        membership_tier: plan.name.toLowerCase(),
        membership_status: 'active',
        membership_sparks_monthly: plan.sparks,
        membership_spark_balance: weekly,
        membership_weekly_sparks: weekly,
        membership_last_weekly_grant: new Date().toISOString(),
        membership_expires_at: renewsAt.toISOString(),
        membership_renews_at: renewsAt.toISOString(),
      })
      .eq('id', user.id);

    await loadWallet();
    setActionKey(null);
  }

  const membershipBalance = profile?.membership_spark_balance || 0;

  const boosterBalance = useMemo(() => {
    return boosterCredits.reduce((sum, b) => sum + b.sparks_remaining, 0);
  }, [boosterCredits]);

  const totalAvailable = membershipBalance + boosterBalance;
    const formatUsd = (price: number) => `$${price.toFixed(2)} USD`;

  if (loading) {
    return (
      <main className="wallet-page">
        <div className="wallet-shell">
          <div className="wallet-card">
            <div className="wallet-loading">{trSafe('Loading wallet...', translated, forceEnglish)}</div>
          </div>

          <style jsx>{`
            @keyframes bestValueGlow {
              0%,
              100% {
                box-shadow: 0 24px 50px rgba(16, 185, 129, 0.18);
              }
              50% {
                box-shadow: 0 28px 62px rgba(16, 185, 129, 0.28);
              }
            }

            .wallet-page {
              min-height: 100vh;
              background:
                radial-gradient(circle at top left, rgba(255, 83, 164, 0.22), transparent 34%),
                radial-gradient(circle at top right, rgba(103, 58, 183, 0.2), transparent 32%),
                linear-gradient(180deg, #fff7fc 0%, #fff 38%, #f7f4ff 100%);
              padding: 18px 14px 30px;
            }

            .wallet-shell {
              max-width: 1180px;
              margin: 0 auto;
            }

            .wallet-card {
              border-radius: 28px;
              border: 1px solid rgba(228, 214, 255, 0.95);
              background: rgba(255, 255, 255, 0.88);
              box-shadow: 0 24px 70px rgba(83, 34, 115, 0.12);
              padding: 20px;
            }

            .wallet-loading {
              font-size: 14px;
              font-weight: 700;
              color: #6c6183;
            }
          `}</style>
        </div>
      </main>
    );
  }

  return (
    <main className="wallet-page">
      <div className="wallet-bg-logo" />
      <div className="wallet-overlay" />

      <div className="wallet-shell">
        <div className="wallet-card">
          <div className="wallet-header">
            <div className="wallet-header-left">
              <div className="wallet-pill">{trSafe('LoveF8 Wallet', translated, forceEnglish)}</div>
              <h1 className="wallet-title">
                {trSafe('Sparks, boosters, and membership', translated, forceEnglish)}
              </h1>
              <p className="wallet-subtitle">
                {trSafe(
                  'Manage your spark balance, test membership plans, and add booster sparks.',
                  translated,
                  forceEnglish
                )}
              </p>
            </div>

            <div className="wallet-nav">
              {targetLanguage !== 'en' ? (
                <button
                  type="button"
                  onClick={() => setForceEnglish((prev) => !prev)}
                  className="nav-button nav-button-secondary"
                >
                  {forceEnglish
  ? 'Use Selected Language'
  : 'View in English'}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => router.push('/messages')}
                className="nav-button nav-button-secondary"
              >
                {trSafe('Back to Messages', translated, forceEnglish)}
              </button>

              <button
                type="button"
                onClick={() => router.push('/connect')}
                className="nav-button nav-button-primary"
              >
                {trSafe('Back to Connect', translated, forceEnglish)}
              </button>
            </div>
          </div>

          <div className="stats-grid">
            <StatCard
              label={trSafe('Total Available', translated, forceEnglish)}
              value={totalAvailable}
              tone="pink"
            />
            <StatCard
              label={trSafe('Membership Sparks', translated, forceEnglish)}
              value={membershipBalance}
              tone="purple"
            />
            <StatCard
              label={trSafe('Booster Sparks', translated, forceEnglish)}
              value={boosterBalance}
              tone="blue"
            />
          </div>

          <div className="section-header membership-header">
            <div>
              <h2>{trSafe('Membership Plans', translated, forceEnglish)}</h2>
              <p>{trSafe('Membership sparks are paid weekly across 4 weeks.', translated, forceEnglish)}</p>
            </div>
          </div>

          <div className="plans-grid">
            {MEMBERSHIPS.map((p) => {
              const weekly = Math.floor(p.sparks / 4);
              const isBusy = actionKey === p.key;
              const isCurrent =
                profile?.membership_tier?.toLowerCase() === p.name.toLowerCase() &&
                profile?.membership_status === 'active';
              const isRecommended = p.key === 'plus';

              return (
                <div
                  key={p.key}
                  className={`plan-card ${isRecommended ? 'plan-card-recommended' : ''}`}
                >
                  <div className="plan-card-top">
                    <div>
                      <div className="plan-name-row">
                        <div className="plan-name">{p.name}</div>

                        {isRecommended && (
                          <span className="most-popular-badge">
                            {trSafe('Most Popular', translated, forceEnglish)}
                          </span>
                        )}

                        {isCurrent && (
                          <span className="current-badge">
                            {trSafe('Current', translated, forceEnglish)}
                          </span>
                        )}
                      </div>

                      <div className="plan-meta">
                        {formatUsd(p.price)} • {p.sparks}{' '}
                        {trSafe('sparks total', translated, forceEnglish)}
                      </div>

                      <div className="plan-meta">
                        {weekly} {trSafe('sparks per week for 4 weeks', translated, forceEnglish)}
                      </div>

                      <div className="plan-features">
  <div className="plan-feature-line">
    {trSafe('FREE UNLIMITED Messages', translated, forceEnglish)}
  </div>

  {p.key === 'basic' && (
                          <div className="plan-feature-line">
                            {trSafe('Save photos to Journal', translated, forceEnglish)}
                          </div>
                        )}

                        {p.key === 'plus' && (
                          <>
                            <div className="plan-feature-line">
                              {trSafe('Save up to 20 photos', translated, forceEnglish)}
                            </div>
                            <div className="plan-feature-line">
                              {trSafe('Save up to 4 videos', translated, forceEnglish)}
                            </div>
                          </>
                        )}

                        {p.key === 'premium' && (
                          <>
                            <div className="plan-feature-line">
                              {trSafe('Save up to 100 photos', translated, forceEnglish)}
                            </div>
                            <div className="plan-feature-line">
                              {trSafe('Save up to 10 videos', translated, forceEnglish)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="plan-price">
                      {formatUsd(p.price)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addTestMembership(p)}
                    disabled={isBusy}
                    className="action-button primary-action"
                  >
                    {isBusy
                      ? trSafe('Starting Membership...', translated, forceEnglish)
                      : trSafe('Start Membership', translated, forceEnglish)}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="section-header boosters-header">
            <div>
              <h2>{trSafe('Boosters', translated, forceEnglish)}</h2>
              <p>{trSafe('Booster sparks stay available for 3 months from purchase.', translated, forceEnglish)}</p>
            </div>
          </div>

          <div className="boosters-grid">
            {BOOSTERS.map((b) => {
              const isBusy = actionKey === b.key;
              const isBestValue = b.price === 39.99;

              return (
                <div
                  key={b.key}
                  className={`booster-card ${isBestValue ? 'booster-card-best' : ''}`}
                >
                  <div className="booster-top">
                    <div>
                      <div className="booster-title-row">
                        <div className="booster-title">{b.sparks} sparks</div>
                        {isBestValue ? (
                          <span className="best-badge">
                            {trSafe('Best Value', translated, forceEnglish)}
                          </span>
                        ) : b.price === 29.99 ? (
                          <span className="value-badge">
                            {trSafe('Great Value', translated, forceEnglish)}
                          </span>
                        ) : null}
                      </div>

                      <div className="booster-meta">
                        {trSafe('Expires in 3 months', translated, forceEnglish)}
                      </div>
                    </div>

                    <div className="booster-price">
                     {formatUsd(b.price)} 
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addTestBooster(b.sparks, b.key)}
                    disabled={isBusy}
                    className={`action-button ${
                      isBestValue ? 'best-action' : 'secondary-action'
                    }`}
                  >
                    {isBusy
                      ? trSafe('Adding Sparks...', translated, forceEnglish)
                      : trSafe('Buy Sparks', translated, forceEnglish)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .wallet-page {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          background:
            radial-gradient(circle at top left, rgba(255, 83, 164, 0.22), transparent 34%),
            radial-gradient(circle at top right, rgba(103, 58, 183, 0.2), transparent 32%),
            linear-gradient(180deg, #fff7fc 0%, #fff 38%, #f7f4ff 100%);
          padding: 16px 14px 28px;
        }

        .wallet-bg-logo {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.06;
          background-image: url('/lovef8-bg.png');
          background-repeat: no-repeat;
          background-position: center top 42px;
          background-size: min(560px, 76vw);
          filter: blur(1px);
        }

        .wallet-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.18) 0%,
            rgba(255, 255, 255, 0.62) 24%,
            rgba(255, 255, 255, 0.9) 100%
          );
        }

        .wallet-shell {
          position: relative;
          z-index: 1;
          max-width: 1160px;
          margin: 0 auto;
        }

        .wallet-card {
          border-radius: 26px;
          border: 1px solid rgba(228, 214, 255, 0.95);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 54px rgba(83, 34, 115, 0.1);
          padding: 12px 14px 16px;
        }

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          border-bottom: 1px solid #f0e8ff;
          padding-bottom: 10px;
        }

        .wallet-header-left {
          min-width: 0;
        }

        .wallet-pill {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 7px 13px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(192, 132, 252, 0.3);
          box-shadow: 0 10px 30px rgba(92, 39, 130, 0.08);
          color: #7c2d92;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .wallet-title {
          margin: 8px 0 0;
          font-size: clamp(22px, 3vw, 32px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #201332;
          white-space: nowrap;
          max-width: none;
        }

        .wallet-subtitle {
          margin: 8px 0 0;
          max-width: 700px;
          font-size: 13px;
          line-height: 1.4;
          color: #625777;
        }

        .wallet-nav {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 175px;
        }

        .nav-button {
          padding: 12px 16px;
          border-radius: 16px;
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .nav-button-secondary {
          border: 1px solid #eadcff;
          background: #fff;
          color: #5c4a73;
          box-shadow: 0 10px 24px rgba(92, 39, 130, 0.05);
        }

        .nav-button-primary {
          border: none;
          background: linear-gradient(135deg, #ff3f9d 0%, #8b2cf5 100%);
          color: #fff;
          box-shadow: 0 14px 28px rgba(181, 55, 154, 0.24);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }

        .section-header {
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 10px;
        }

        .membership-header {
          margin-top: 12px;
        }

        .boosters-header {
          margin-top: 4px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #221435;
        }

        .section-header p {
          margin: 6px 0 0;
          font-size: 12px;
          color: #6f6485;
          line-height: 1.5;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 10px;
        }

        .boosters-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 8px;
        }

        .plan-card {
          border-radius: 22px;
          border: 1px solid #efe4ff;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 18px 36px rgba(91, 33, 182, 0.07);
          padding: 14px 14px 12px;
          box-sizing: border-box;
        }

        .plan-card-recommended {
          border-color: rgba(139, 92, 246, 0.45);
          background: linear-gradient(
            180deg,
            rgba(245, 243, 255, 0.9) 0%,
            rgba(255, 255, 255, 0.96) 100%
          );
        }

        .booster-card {
          border-radius: 20px;
          border: 1px solid #efe4ff;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 12px 24px rgba(91, 33, 182, 0.06);
          padding: 10px 14px;
          transition: all 0.2s ease;
        }

        .booster-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 36px rgba(91, 33, 182, 0.12);
        }

        .booster-card-best {
          border-color: rgba(16, 185, 129, 0.6);
          background: linear-gradient(
            180deg,
            rgba(236, 253, 245, 1) 0%,
            rgba(255, 255, 255, 1) 100%
          );
          box-shadow: 0 24px 50px rgba(16, 185, 129, 0.18);
          transform: translateY(-3px) scale(1.01);
          animation: bestValueGlow 2.8s ease-in-out infinite;
        }

        .plan-card-top,
        .booster-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .plan-name-row,
        .booster-title-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .plan-name,
        .booster-title {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #231433;
        }

        .plan-meta,
        .booster-meta {
          margin-top: 3px;
          font-size: 17px;
          font-weight: 500;
          line-height: 1.35;
          color: #6e6384;
        }

        .plan-features {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .plan-feature-line {
          font-size: 13px;
          line-height: 1.4;
          font-weight: 700;
          color: #5f5476;
        }

        .plan-price,
        .booster-price {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #231433;
          white-space: nowrap;
        }

        .current-badge,
        .best-badge,
        .most-popular-badge,
        .value-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .current-badge {
          background: rgba(139, 44, 245, 0.1);
          color: #7d2ee7;
          border: 1px solid rgba(139, 44, 245, 0.18);
        }

        .best-badge {
          background: rgba(34, 197, 94, 0.2);
          color: #15803d;
          border: 1px solid rgba(34, 197, 94, 0.35);
          box-shadow: 0 6px 14px rgba(34, 197, 94, 0.15);
        }

        .value-badge {
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
          color: white;
          border: none;
          box-shadow: 0 6px 14px rgba(124, 58, 237, 0.35);
        }

        .most-popular-badge {
          background: rgba(139, 92, 246, 0.14);
          color: #6d28d9;
          border: 1px solid rgba(139, 92, 246, 0.26);
        }

        .action-button {
          width: 100%;
          margin-top: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          border: none;
          font-weight: 900;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .primary-action {
          background: linear-gradient(135deg, #ff3f9d 0%, #8b2cf5 100%);
          color: white;
          box-shadow: 0 14px 30px rgba(181, 55, 154, 0.22);
        }

        .secondary-action {
          background: #f5f3ff;
          color: #6d28d9;
          border: 1px solid #ddd6fe;
        }

        .best-action {
          background: linear-gradient(135deg, #16a34a 0%, #0ea5e9 100%);
          color: white;
          box-shadow: 0 18px 36px rgba(16, 185, 129, 0.18);
          transform: translateY(-1px);
        }

        @media (max-width: 1100px) {
          .plans-grid {
            grid-template-columns: 1fr;
          }

          .boosters-grid {
            grid-template-columns: 1fr 1fr;
          }

          .wallet-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .wallet-nav {
            min-width: 0;
            width: 100%;
            max-width: 320px;
          }
        }

        @media (max-width: 760px) {
          .wallet-page {
            padding: 12px 10px 20px;
          }

          .wallet-card {
            padding: 12px;
            border-radius: 22px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .boosters-grid {
            grid-template-columns: 1fr;
          }

          .wallet-title {
            font-size: 22px;
            line-height: 1;
            white-space: nowrap;
          }

          .wallet-subtitle {
            font-size: 12px;
            line-height: 1.3;
          }

          .plan-price,
          .booster-price {
            font-size: 20px;
          }

          .plan-name,
          .booster-title {
            font-size: 18px;
          }

          .wallet-nav {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr;
          }

          .nav-button {
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .wallet-card {
            padding: 10px;
          }

          .wallet-title {
            font-size: 20px;
          }

          .section-header h2 {
            font-size: 20px;
          }

          .plan-card,
          .booster-card {
            padding: 12px;
            border-radius: 18px;
          }

          .plan-card-top,
          .booster-top {
            flex-direction: column;
          }

          .plan-price,
          .booster-price {
            font-size: 18px;
          }
        }

        @keyframes bestValueGlow {
          0%,
          100% {
            box-shadow: 0 24px 50px rgba(16, 185, 129, 0.18);
          }
          50% {
            box-shadow: 0 28px 62px rgba(16, 185, 129, 0.28);
          }
        }
      `}</style>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'pink' | 'purple' | 'blue';
}) {
  const toneMap = {
    pink: {
      background:
        'linear-gradient(135deg, rgba(255, 63, 157, 0.12) 0%, rgba(255,255,255,0.95) 100%)',
      border: '1px solid rgba(255, 63, 157, 0.16)',
      valueColor: '#b3126c',
    },
    purple: {
      background:
        'linear-gradient(135deg, rgba(139, 44, 245, 0.12) 0%, rgba(255,255,255,0.95) 100%)',
      border: '1px solid rgba(139, 44, 245, 0.16)',
      valueColor: '#6f21d8',
    },
    blue: {
      background:
        'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(255,255,255,0.95) 100%)',
      border: '1px solid rgba(59, 130, 246, 0.16)',
      valueColor: '#215dc8',
    },
  } as const;

  const styles = toneMap[tone];

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 10,
        background: styles.background,
        border: styles.border,
        boxShadow: '0 10px 20px rgba(83, 34, 115, 0.04)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#6f6485',
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 18,
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: '-0.03em',
          color: styles.valueColor,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function trSafe(text: string, translated: Record<string, string>, forceEnglish: boolean) {
  if (forceEnglish) return text;
  return translated[text] || text;
}