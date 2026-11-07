'use client';
import { useEffect, useState } from 'react';

type Info = { k: 'SHOP' | 'SUPPLIER'; n: string; a: string; e: number };

function read(): Info | null {
  try {
    const raw = document.cookie.split('; ').find(c => c.startsWith('fixi_support_ui='));
    if (!raw) return null;
    let txt = raw.slice('fixi_support_ui='.length), v: any = null;
    for (let i = 0; i < 3 && !v; i++) { txt = decodeURIComponent(txt); try { v = JSON.parse(txt); } catch {} }
    return v && v.e > Date.now() ? v : null;
  } catch { return null; }
}

/** Bandeau permanent quand le super admin intervient dans une boutique ou chez un fournisseur. */
export function SupportBanner() {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const tick = () => setInfo(read()); tick(); const t = setInterval(tick, 20_000); return () => clearInterval(t); }, []);
  useEffect(() => { document.documentElement.classList.toggle('fx-support-on', !!info); }, [info]);
  if (!info) return null;
  const end = new Date(info.e).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  async function quit() {
    setBusy(true);
    try { const r = await fetch('/api/support/exit', { method: 'POST' }); const j = await r.json().catch(() => ({})); location.href = j.url || '/saas'; }
    catch { setBusy(false); }
  }
  return <div className="fx-support-banner" role="status">
    <span className="fx-support-dot" aria-hidden />
    <span><b>Mode support</b> · <span className="fx-support-target">{info.k === 'SHOP' ? 'Boutique' : 'Fournisseur'} « {info.n} »</span><span className="fx-support-by"> · par {info.a}</span> · fin à {end}</span>
    <button type="button" onClick={quit} disabled={busy}>{busy ? '…' : <><span className="fx-support-by">Quitter le mode support</span><span className="fx-support-short">Quitter</span></>}</button>
  </div>;
}
