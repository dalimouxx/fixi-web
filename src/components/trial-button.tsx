'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

/** Bouton « Essayer Fixi Pro X jours » : n'apparaît que si l'atelier y a droit. */
export function TrialButton({ next = '/app/dashboard', big = false }: { next?: string; big?: boolean }) {
  const router = useRouter();
  const [info, setInfo] = useState<{ eligible: boolean; days: number; planName: string | null } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/subscription/trial', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setInfo).catch(() => {}); }, []);
  if (!info?.eligible) return null;
  async function start() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/subscription/trial', { method: 'POST' }); const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Essai impossible');
      router.push(next); router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return <span className="trial-btn-wrap">
    <button type="button" className={'btn btn-primary' + (big ? ' btn-lg trial-btn--big' : ' btn-sm')} onClick={start} disabled={busy}>
      {busy ? <Loader2 size={16} className="ps-spin" /> : <Sparkles size={16} />} Essayer Fixi Pro {info.days} jours gratuitement
    </button>
    <small className="trial-btn-note">{info.planName ? `Offre ${info.planName} · ` : ''}sans paiement · retour automatique à l’offre gratuite</small>
    {err && <small className="trial-btn-err">{err}</small>}
  </span>;
}
