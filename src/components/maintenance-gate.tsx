'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Clock3, RefreshCw, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { FixiMark } from './fixi-mark';

type State = { enabled: boolean; message: string | null; until: string | null; startedAt: string | null; bypass?: boolean };
const TIPS = ['Vos données sont en sécurité.', 'Aucune vente ni réparation n’est perdue.', 'Cette page se rouvre toute seule dès que c’est prêt.', 'Merci pour votre patience 💜'];

const left = (until: string | null, now: number) => {
  if (!until) return null;
  const s = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Écran de maintenance Fixi Max : affiché à tout le monde quand le super admin l'active (sauf dans Fixi Control). */
export function MaintenanceGate() {
  const path = usePathname() || '';
  const [m, setM] = useState<State | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tip, setTip] = useState(0);
  const was = useRef(false);
  const skip = path.startsWith('/saas');

  useEffect(() => {
    if (skip) return;
    let stop = false, t: any;
    const check = async () => {
      try {
        const r = await fetch('/api/maintenance', { cache: 'no-store' });
        if (r.ok) {
          const j: State = await r.json();
          if (stop) return;
          // Fin de maintenance : on recharge pour repartir sur la nouvelle version.
          if (was.current && !j.enabled) { location.reload(); return; }
          was.current = j.enabled && !j.bypass; setM(j);
        }
      } catch { /* hors ligne : on réessaie plus tard */ }
      if (!stop) t = setTimeout(check, was.current ? 20_000 : 90_000);
    };
    void check();
    const onFocus = () => { clearTimeout(t); void check(); };
    window.addEventListener('focus', onFocus);
    return () => { stop = true; clearTimeout(t); window.removeEventListener('focus', onFocus); };
  }, [skip]);

  const on = !!m?.enabled && !m.bypass && !skip;
  useEffect(() => {
    if (!on) return;
    document.documentElement.classList.add('fx-mnt-on');
    const a = setInterval(() => setNow(Date.now()), 1000), b = setInterval(() => setTip(x => (x + 1) % TIPS.length), 4000);
    return () => { clearInterval(a); clearInterval(b); document.documentElement.classList.remove('fx-mnt-on'); };
  }, [on]);

  if (!m?.enabled || skip) return null;
  if (m.bypass) return <div className="fx-mnt-pill" role="status"><Wrench size={13} /> Maintenance active · vous seul voyez l’application</div>;
  return <MaintenanceScreen message={m.message} until={m.until} now={now} tip={tip} />;
}


/** L'écran lui-même (utilisé aussi par l'aperçu de Fixi Control). */
export function MaintenanceScreen({ message, until, now, tip }: { message: string | null; until: string | null; now: number; tip: number }) {
  const remaining = left(until, now);
  return <div className="fx-mnt" role="alertdialog" aria-modal="true" aria-labelledby="fx-mnt-title">
    <i className="fx-mnt-blob b1" aria-hidden /><i className="fx-mnt-blob b2" aria-hidden /><i className="fx-mnt-blob b3" aria-hidden />
    <div className="fx-mnt-card">
      <div className="fx-mnt-logo"><span className="fx-mnt-ring" aria-hidden /><FixiMark /></div>
      <span className="fx-mnt-kicker"><Sparkles size={13} /> MISE À JOUR EN COURS</span>
      <h1 id="fx-mnt-title">On améliore Fixi pour vous</h1>
      <p className="fx-mnt-msg">{message || 'Fixi revient dans quelques minutes, encore plus rapide.'}</p>
      <div className="fx-mnt-time"><Clock3 size={16} />{remaining && remaining !== '00:00' ? <>Retour prévu dans <b>{remaining}</b></> : <>Retour dans quelques instants…</>}</div>
      <div className="fx-mnt-bar" aria-hidden><i /></div>
      <p className="fx-mnt-tip" key={tip}><ShieldCheck size={14} /> {TIPS[tip]}</p>
      <button type="button" className="fx-mnt-retry" onClick={() => location.reload()}><RefreshCw size={15} /> Réessayer</button>
    </div>
  </div>;
}
