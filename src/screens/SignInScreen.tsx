import { useState, useEffect, useRef } from 'react';
import { Apple } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { logSignIn } from '@/lib/analytics';

/* ── Google Icon ── */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/* ── Palette ── */
const C = {
  primary:      '#B8860B',   // dark gold
  primaryLight: 'rgba(184,134,11,0.12)',
  primaryGlow:  'rgba(184,134,11,0.28)',
  primaryHover: '#9A7009',
  gold2:        '#D4A017',   // lighter gold for accents
  bg:           '#0F0E0C',   // near-black warm
  surface:      '#1A1814',   // dark card
  surface2:     '#221F1A',
  border:       'rgba(184,134,11,0.20)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  text1:        '#F5F0E8',
  text2:        '#A09880',
  text3:        '#6B6354',
  green:        '#4CAF50',
  greenLight:   'rgba(76,175,80,0.12)',
  highlight:    '#F5C518',
};

/* ── Doc data ── */
const CATS: Record<string, { color: string }> = {
  identity:  { color: '#4A7FD4' },
  finance:   { color: '#3DAA72' },
  housing:   { color: '#9B6FD4' },
  education: { color: '#C48A2E' },
  health:    { color: '#3AACCC' },
  vehicle:   { color: '#D45858' },
};


/* ── Floating filename particles ── */
const FILE_NAMES = [
  { name: 'Passeport.jpg',             cat: 'identity'  },
  { name: 'CNI Samba Ndiaye.pdf',      cat: 'identity'  },
  { name: 'Acte de naissance.jpg',     cat: 'identity'  },
  { name: 'Permis de séjour.png',      cat: 'identity'  },
  { name: 'Extrait casier.pdf',        cat: 'identity'  },
  { name: 'Facture Orange.jpg',        cat: 'finance'   },
  { name: 'Relevé SGBS.pdf',           cat: 'finance'   },
  { name: 'Facture Senelec.png',       cat: 'finance'   },
  { name: 'Avis imposition.pdf',       cat: 'finance'   },
  { name: 'Facture SDE eau.jpg',       cat: 'finance'   },
  { name: 'Contrat bail.pdf',          cat: 'housing'   },
  { name: 'Quittance loyer.jpg',       cat: 'housing'   },
  { name: 'Titre propriété.pdf',       cat: 'housing'   },
  { name: 'Permis conduire.jpg',       cat: 'vehicle'   },
  { name: 'Attestation assurance.pdf', cat: 'vehicle'   },
  { name: 'Carte grise.png',           cat: 'vehicle'   },
  { name: 'Diplôme BAC.jpg',           cat: 'education' },
  { name: 'Relevé de notes.pdf',       cat: 'education' },
  { name: 'Carte IPRES.jpg',           cat: 'health'    },
  { name: 'Ordonnance médicale.png',   cat: 'health'    },
  { name: 'Vaccin carnet.jpg',         cat: 'health'    },
  { name: 'Contrat travail.pdf',       cat: 'identity'  },
  { name: 'RIB bancaire.pdf',          cat: 'finance'   },
  { name: 'Bulletins salaire.pdf',     cat: 'finance'   },
  { name: 'Acte mariage.jpg',          cat: 'identity'  },
  { name: 'Permis construire.pdf',     cat: 'housing'   },
  { name: 'Certificat résidence.jpg',  cat: 'identity'  },
  { name: 'Assurance maladie.pdf',     cat: 'health'    },
];

interface Particle {
  id: number;
  name: string;
  color: string;
  x: number;
  duration: number;
  delay: number;
  fontSize: number;
  opacity: number;
  drift: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: 30 }, (_, i) => {
    const file = FILE_NAMES[i % FILE_NAMES.length];
    return {
      id: i,
      name: file.name,
      color: CATS[file.cat].color,
      x: 1 + Math.random() * 94,
      duration: 15 + Math.random() * 20,
      delay: -(Math.random() * 35),
      fontSize: 10 + Math.random() * 5,
      opacity: 0.15 + Math.random() * 0.30,
      drift: -25 + Math.random() * 50,
    };
  });
}

const DEMO_WORDS   = ['assurance', 'banque', 'facture', 'bail'];
const TYPE_MS      = 90;
const HOLD_MS      = 1800;
const CLEAR_MS     = 380;
const START_MS     = 900;

const PREVIEW_MAP: Record<string, { name: string; sub: string; color: string; count: number }> = {
  assurance: { name: 'Attestation Assurance.jpg', sub: 'Véhicule · Exp. déc 2025', color: CATS.vehicle.color, count: 2 },
  banque:    { name: 'Relevé SGBS Oct 2024.pdf',  sub: 'Finance · Oct 2024',        color: CATS.finance.color, count: 1 },
  facture:   { name: 'Facture Orange Nov 2024.jpg',sub: 'Finance · Nov 2024',        color: CATS.finance.color, count: 3 },
  bail:      { name: 'Contrat Bail Jan 2023.pdf',  sub: 'Logement · Jan 2023',       color: CATS.housing.color, count: 1 },
};



/* ── FloatingParticles ── */
function FloatingParticles({ particles }: { particles: Particle[] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            bottom: '-2em',
            fontFamily: 'monospace',
            fontSize: p.fontSize,
            fontWeight: 500,
            color: p.color,
            opacity: p.opacity,
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
            animation: `floatUp ${p.duration}s ${p.delay}s linear infinite`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        >
          {p.name}
        </div>
      ))}
    </div>
  );
}


/* ── Main component ── */
export function SignInScreen() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [previewWord, setPreviewWord] = useState<string | null>(null);
  const [particles] = useState(() => generateParticles());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Typewriter loop */
  useEffect(() => {
    let wIdx = 0, cIdx = 0, alive = true;

    function step() {
      if (!alive) return;
      const word = DEMO_WORDS[wIdx];

      if (cIdx <= word.length) {
        const current = word.slice(0, cIdx);
        setQuery(current);

        if (cIdx === word.length) {
          setPreviewWord(word);
          timerRef.current = setTimeout(() => {
            if (!alive) return;
            setPreviewWord(null);
            setQuery('');
            timerRef.current = setTimeout(() => {
              if (!alive) return;
              wIdx = (wIdx + 1) % DEMO_WORDS.length;
              cIdx = 0;
              step();
            }, CLEAR_MS);
          }, HOLD_MS);
          return;
        }

        cIdx++;
        timerRef.current = setTimeout(step, TYPE_MS);
      }
    }

    timerRef.current = setTimeout(step, START_MS);
    return () => { alive = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const preview = previewWord ? PREVIEW_MAP[previewWord] : null;

  async function handleGoogle() {
    setError(null); setLoading('google');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      logSignIn('google');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.signInError'));
    } finally { setLoading(null); }
  }

  async function handleApple() {
    setError(null); setLoading('apple');
    try {
      await signInWithPopup(auth, new OAuthProvider('apple.com'));
      logSignIn('apple');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.signInError'));
    } finally { setLoading(null); }
  }

  return (
    <div style={{ minHeight: '100vh', overflow: 'hidden', position: 'relative', background: C.bg, fontFamily: "'Sora', sans-serif" }}>

      {/* ── Floating filenames ── */}
      <FloatingParticles particles={particles} />

      {/* ── Subtle overlay ── */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,14,12,0.45)',
        backdropFilter: 'blur(0px)',
        WebkitBackdropFilter: 'blur(0px)',
        zIndex: 1,
      }} />

      {/* ── Sign-in card ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 340,
          background: 'rgba(26,24,20,0.85)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: `1px solid ${C.border}`,
          borderRadius: 28,
          padding: '36px 32px 32px',
          boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(184,134,11,0.15)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>

          {/* Trust badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 12px',
            background: C.greenLight,
            border: '1px solid rgba(76,175,80,0.25)',
            borderRadius: 20,
            color: C.green,
            fontSize: 11, fontWeight: 700,
            marginBottom: 24,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: C.green,
              animation: 'pulseDot 2s ease-in-out infinite',
            }} />
            {t('signIn.trustBadge')}
          </div>

          {/* Logo mark */}
          <div style={{
            width: 60, height: 60,
            background: `linear-gradient(135deg, ${C.primary}, ${C.gold2})`,
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: `0 8px 28px ${C.primaryGlow}`,
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </div>

          {/* App name */}
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', color: C.primary, marginBottom: 6 }}>
            {t('signIn.appName')}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text2, textAlign: 'center', lineHeight: 1.4, marginBottom: 28 }}>
            {t('signIn.tagline')}
          </div>

          {/* Search preview */}
          <div style={{
            width: '100%',
            background: C.surface2,
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 24,
            border: `1px solid ${C.border}`,
            position: 'relative',
            height: 110,
            boxSizing: 'border-box',
          }}>
            {/* Search row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.text2, flex: 1, minHeight: 18, display: 'flex', alignItems: 'center' }}>
                {query}
                <span style={{
                  display: 'inline-block', width: 1.5, height: 14,
                  background: C.primary, marginLeft: 1, verticalAlign: 'middle',
                  animation: 'cursorBlink 1s step-end infinite',
                }} />
              </div>
            </div>

            {/* Result row — no border, no bg, just content fading in */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginTop: 14,
              opacity: preview ? 1 : 0,
              transition: 'opacity 0.35s ease',
            }}>
              <div style={{
                width: 36, height: 42, borderRadius: 6,
                background: preview ? preview.color : C.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                opacity: 0.9,
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{preview?.name ?? ''}</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>
                  {preview ? t('signIn.documentsFound', { count: preview.count }) : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <div style={{ fontSize: 11, color: C.text3, fontWeight: 500, whiteSpace: 'nowrap' }}>{t('common.secureLogin')}</div>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ border: '1px solid #ef4444', borderRadius: 8, padding: '10px 16px', color: '#ef4444', marginBottom: 16, fontSize: 13, width: '100%' }}>
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            type="button"
            disabled={!!loading}
            onClick={handleGoogle}
            style={{
              width: '100%', padding: '14px 20px',
              borderRadius: 14, border: `1.5px solid ${C.border}`,
              background: C.surface2,
              color: C.text1,
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading && loading !== 'google' ? 0.5 : 1,
              marginBottom: 10,
              transition: 'all 0.15s',
              letterSpacing: '-0.01em',
            }}
          >
            <GoogleIcon size={20} />
            {loading === 'google' ? t('signIn.connecting') : t('signIn.continueGoogle')}
          </button>

          {/* Apple button */}
          <button
            type="button"
            disabled={!!loading}
            onClick={handleApple}
            style={{
              width: '100%', padding: '14px 20px',
              borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.gold2})`,
              color: '#0F0E0C',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading && loading !== 'apple' ? 0.5 : 1,
              boxShadow: `0 4px 16px ${C.primaryGlow}`,
              transition: 'all 0.15s',
              letterSpacing: '-0.01em',
            }}
          >
            <Apple size={20} fill="#0F0E0C" />
            {loading === 'apple' ? t('signIn.connecting') : t('signIn.continueApple')}
          </button>


        </div>
      </div>

      {/* Global keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes floatUp {
          0%   { transform: translateY(0)   translateX(0)               ; opacity: 0;   }
          5%   { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-110vh) translateX(var(--drift))  ; opacity: 0;   }
        }
        button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.3) !important; }
        button:active:not(:disabled) { transform: scale(0.98) !important; }
      `}</style>
    </div>
  );
}