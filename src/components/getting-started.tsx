'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';
import { isStandalone, openInstallHelp } from '@/lib/install-prompt';

type Step = { id: string; label: string; hint: string; done: boolean; href?: string; action?: () => void };
const KEY = 'fixi-getting-started-hidden';

// « Bien démarrer » : les 6 réglages qui rendent Fixi vraiment utile dès la première semaine.
// Disparaît quand tout est fait ou quand le gérant la masque.
export function GettingStarted({ repairCount }: { repairCount: number }) {
  const [hidden, setHidden] = useState(true);
  const [steps, setSteps] = useState<Step[] | null>(null);
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === '1') return; } catch {}
    setHidden(false);
    (async () => {
      const [settings, users, push]: [any, any, boolean] = await Promise.all([
        fetch('/api/settings').then(r => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch('/api/users').then(r => (r.ok ? r.json() : [])).catch(() => []),
        (async () => { try { const reg = await navigator.serviceWorker?.getRegistration(); return !!(await reg?.pushManager.getSubscription()); } catch { return false; } })(),
      ]);
      setSteps([
        { id: 'logo', label: 'Ajouter votre logo', hint: 'Il apparaît sur les tickets et la page de suivi.', done: !!settings.logoDataUrl, href: '/app/settings#boutique' },
        { id: 'phone', label: 'Indiquer le téléphone de la boutique', hint: 'Les clients vous rappellent depuis leur ticket.', done: !!(settings.whatsappPhone || settings.phone), href: '/app/settings#boutique' },
        { id: 'repair', label: 'Enregistrer une première réparation', hint: 'Moins d’une minute.', done: repairCount > 0, href: '/app/repairs/new' },
        { id: 'team', label: 'Ajouter un employé', hint: 'Chacun son code, chacun son écran.', done: Array.isArray(users) && users.length > 1, href: '/app/team' },
        { id: 'alerts', label: 'Activer les alertes sur ce téléphone', hint: 'Appareil prêt, commande livrée… même écran verrouillé.', done: push, action: () => (document.querySelector('.rt-bell') as HTMLButtonElement | null)?.click() },
        { id: 'install', label: 'Installer Fixi sur l’écran d’accueil', hint: 'Ouverture en un toucher.', done: isStandalone(), action: openInstallHelp },
      ]);
    })();
  }, [repairCount]);
  if (hidden || !steps) return null;
  const done = steps.filter(s => s.done).length;
  if (done === steps.length) return null;
  const hide = () => { try { localStorage.setItem(KEY, '1'); } catch {} setHidden(true); };
  return <section className="fx-panel fx-start" aria-labelledby="fx-start-title">
    <div className="fx-panel-head">
      <h2 id="fx-start-title"><Rocket size={19} /> Bien démarrer</h2>
      <button type="button" className="fx-icon-btn" onClick={hide} aria-label="Masquer"><X size={18} /></button>
    </div>
    <div className="fx-start-progress"><span style={{ transform: `scaleX(${done / steps.length})` }} /></div>
    <p className="fx-start-count">{done} sur {steps.length} étapes faites</p>
    <div className="fx-list">
      {steps.map(s => {
        const body = <>{s.done ? <CheckCircle2 /> : <Circle />}<span className="fx-row-main"><b>{s.label}</b><small>{s.hint}</small></span></>;
        const cls = `fx-row ${s.done ? 'fx-row--ok is-done' : ''}`;
        return s.href && !s.done ? <Link key={s.id} href={s.href} className={cls}>{body}</Link>
          : <button key={s.id} type="button" className={cls} onClick={s.done ? undefined : s.action} disabled={s.done}>{body}</button>;
      })}
    </div>
  </section>;
}
