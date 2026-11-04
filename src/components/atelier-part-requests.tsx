'use client';
import { useEffect, useState } from 'react';
import { Check, Clock3, Loader2, MessageSquareQuote, Plus, ShieldCheck, X } from 'lucide-react';
import { money } from '@/lib/format';
import { DELAYS } from '@/lib/commerce';

/** Atelier : demander une pièce introuvable aux fournisseurs et choisir la meilleure offre. */
export function AtelierPartRequests({ initial, onAccept }: { initial?: string; onAccept: (productId: string, qty: number) => void }) {
  const [rows, setRows] = useState<any[]>([]); const [n, setN] = useState(0); const [form, setForm] = useState(!!initial);
  const [f, setF] = useState({ partName: initial || '', deviceModel: '', quantity: '1', note: '', scope: 'REGION' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  useEffect(() => { fetch('/api/marketplace/part-requests', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => {}); }, [n]);
  useEffect(() => { if (initial) { setF(x => ({ ...x, partName: initial })); setForm(true); } }, [initial]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await fetch('/api/marketplace/part-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setDone(`Demande envoyée à ${j.sentTo} fournisseur(s). Vous serez prévenu à chaque réponse.`); setForm(false); setF({ partName: '', deviceModel: '', quantity: '1', note: '', scope: 'REGION' }); setN(x => x + 1); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  async function act(id: string, body: any) { const r = await fetch('/api/marketplace/part-requests', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...body }) }); const j = await r.json(); if (!r.ok) { setErr(j.error); return null; } setN(x => x + 1); return j; }
  const live = rows.filter(r => r.status === 'OPEN' && new Date(r.expiresAt) > new Date());
  return <section className="apr">
    <header><div><h2><MessageSquareQuote size={19} /> Pièce introuvable ?</h2><p>Décrivez-la : les fournisseurs vous répondent avec leur prix, vous choisissez.</p></div>{!form && <button className="btn btn-primary" onClick={() => { setForm(true); setDone(''); }}><Plus size={16} /> Demander une pièce</button>}</header>
    {done && <p className="apr-done"><Check size={15} /> {done}</p>}
    {form && <form className="apr-form" onSubmit={send}>
      <input autoFocus value={f.partName} onChange={e => setF({ ...f, partName: e.target.value })} placeholder="Pièce (ex. nappe de charge, écran OLED…)" maxLength={120} />
      <input value={f.deviceModel} onChange={e => setF({ ...f, deviceModel: e.target.value })} placeholder="Modèle (ex. Redmi Note 13)" maxLength={80} />
      <input value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="Qté" className="apr-qty" />
      <div className="apr-scope" role="radiogroup"><button type="button" aria-pressed={f.scope === 'REGION'} onClick={() => setF({ ...f, scope: 'REGION' })}>Ma région</button><button type="button" aria-pressed={f.scope === 'ALL'} onClick={() => setF({ ...f, scope: 'ALL' })}>Toute la Tunisie</button></div>
      <input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Précision (couleur, qualité, urgence…)" maxLength={300} className="apr-note" />
      {err && <p className="apr-err">{err}</p>}
      <div className="apr-actions"><button type="button" className="btn btn-ghost" onClick={() => setForm(false)}>Annuler</button><button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="ps-spin" /> : <MessageSquareQuote size={16} />} Envoyer aux fournisseurs</button></div>
    </form>}
    {live.length > 0 && <ul className="apr-list">{live.map(r => <li key={r.id}>
      <div className="apr-req"><b>{r.quantity} × {r.partName}{r.deviceModel ? ' · ' + r.deviceModel : ''}</b><small>{r.quotes.length ? `${r.quotes.length} offre(s)` : 'En attente des fournisseurs…'} · expire le {new Date(r.expiresAt).toLocaleDateString('fr-TN')}</small><button className="btn btn-ghost btn-sm" onClick={() => act(r.id, { action: 'close' })}><X size={14} /> Clôturer</button></div>
      {r.quotes.map((q: any, i: number) => <div key={q.id} className={'apr-quote' + (i === 0 ? ' best' : '')}><span><b>{q.company.name}</b>{q.company.verified && <ShieldCheck size={13} />}<small>{q.company.region || ''} · {q.quantity} dispo · <Clock3 size={11} /> {DELAYS[q.delay]}</small></span><strong>{money(Number(q.price))}</strong>
        <button className="btn btn-primary btn-sm" onClick={async () => { const j = await act(r.id, { quoteId: q.id }); if (j) onAccept(j.productId, j.quantity); }}>Choisir</button></div>)}
    </li>)}</ul>}
  </section>;
}
