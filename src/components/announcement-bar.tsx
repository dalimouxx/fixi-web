'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Megaphone, X } from 'lucide-react';
import { spaceOf } from '@/lib/announcements';

const KEY = 'fixi-ann-dismissed';
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };

/** Bandeau d'annonce Fixi (Control → Annonces) dans l'atelier, chez le fournisseur et le livreur. */
export function AnnouncementBar() {
  const space = spaceOf(usePathname() || '');
  const [rows, setRows] = useState<any[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [mini, setMini] = useState(false);
  useEffect(() => { setHidden(read()); }, []);
  useEffect(() => {
    if (!space) return;
    let stop = false;
    const load = () => fetch('/api/announcements?space=' + space, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(x => { if (!stop) setRows(Array.isArray(x) ? x : []); }).catch(() => {});
    void load(); const t = setInterval(load, 5 * 60_000);
    return () => { stop = true; clearInterval(t); };
  }, [space]);
  const a = rows.find(r => !hidden.includes(r.id));
  // Visible quelques secondes, puis réduite en pastille pour ne jamais cacher un bouton de l'écran.
  useEffect(() => { if (!a?.id) return; setMini(false); const t = setTimeout(() => setMini(true), 9000); return () => clearTimeout(t); }, [a?.id]);
  if (!space || !a) return null;
  const close = () => { const next = [...hidden, a.id].slice(-50); setHidden(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} };
  const Icon = a.tone === 'WARNING' ? AlertTriangle : a.tone === 'SUCCESS' ? CheckCircle2 : Megaphone;
  if (mini) return <button type="button" className={'fx-ann-mini fx-ann--' + String(a.tone).toLowerCase()} onClick={() => setMini(false)} aria-label={'Annonce : ' + a.title}><Icon size={15} /><span>{a.title}</span></button>;
  return <div className={'fx-ann fx-ann--' + String(a.tone).toLowerCase()} role="status">
    <span className="fx-ann-ico"><Icon size={17} /></span>
    <div><b>{a.title}</b><span>{a.message}</span></div>
    {a.href && (a.href.startsWith('/') ? <Link href={a.href} className="fx-ann-go" onClick={close}>Voir</Link> : <a href={a.href} target="_blank" rel="noreferrer" className="fx-ann-go">Voir</a>)}
    <button type="button" onClick={close} aria-label="Masquer l’annonce"><X size={16} /></button>
  </div>;
}
