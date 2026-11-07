'use client';
import Link from 'next/link';
import { useState } from 'react';
import { QrCode, UserCheck, X } from 'lucide-react';
import { api, useApi } from './ui';
import '@/app/fixi-astuces.css';

/** Réception : clients arrivés et enregistrés via le QR du comptoir. Un toucher remplit le formulaire. */
export function CheckInBanner({ onPick, current }: { onPick: (c: any) => void; current?: string }) {
  const [n, setN] = useState(0); const { data } = useApi<any>('/api/checkins', n);
  const rows = (data?.rows || []).filter((c: any) => c.id !== current);
  if (!data) return null;
  if (!rows.length) return <div className="ci-banner ci-banner--empty no-print"><QrCode size={16} /><span>Les clients peuvent s’enregistrer seuls avec le QR du comptoir.</span><Link href="/app/arrivee">Affiche QR</Link></div>;
  return <section className="ci-banner no-print" aria-label="Arrivées en attente">
    <div className="ci-banner-head"><UserCheck size={17} /><b>{rows.length} client(s) enregistré(s) au comptoir</b><Link href="/app/arrivee">Affiche QR</Link></div>
    <div className="ci-banner-list">{rows.map((c: any) => <div key={c.id} className="ci-banner-row">
      <button type="button" className="ci-banner-pick" onClick={() => onPick(c)}><b>{c.fullName}</b><small>{[c.brand, c.model].filter(Boolean).join(' ') || 'Appareil'} · {c.issue} · {new Date(c.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small><em>Prendre en charge</em></button>
      <button type="button" className="ci-banner-x" aria-label="Retirer" onClick={async () => { await api(`/api/checkins/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'DISMISSED' }) }).catch(() => {}); setN(x => x + 1); }}><X size={15} /></button>
    </div>)}</div>
  </section>;
}
