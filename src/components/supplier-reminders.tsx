'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, Check, FileText, Lock, MessageCircle, Send } from 'lucide-react';
import { money } from '@/lib/format';

const lvl = (d: number) => d >= 30 ? 'l30' : d >= 15 ? 'l15' : d >= 7 ? 'l7' : 'l0';

/** Relances de paiement : clients en retard, relance en un clic, relances automatiques J+7 / J+15 / J+30. */
export function SupplierReminders() {
  const [d, setD] = useState<any>(null); const [n, setN] = useState(0); const [sent, setSent] = useState<Record<string, string>>({}); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/supplier/reminders', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, [n]);
  if (!d) return null;
  async function remind(r: any) {
    setErr('');
    try { const x = await fetch('/api/supplier/reminders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customerId: r.id }) }); const j = await x.json(); if (!x.ok) throw new Error(j.error); setSent(s => ({ ...s, [r.id]: j.notified ? 'Relancé dans Fixi' : 'Relance notée' })); if (j.wa && !j.notified) window.open(j.wa, '_blank'); }
    catch (e: any) { setErr(e.message); }
  }
  async function toggle() { await fetch('/api/supplier/reminders', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ autoReminders: !d.autoReminders }) }); setN(x => x + 1); }
  return <section className="supplier-panel rm">
    <header className="rm-head">
      <div><h3><BellRing size={17} /> Relances de paiement</h3><p>{d.totals.customers} client(s) · {money(d.totals.due)} à encaisser{d.totals.late30 > 0 ? ` · ${money(d.totals.late30)} en retard de plus de 30 jours` : ''}{d.totals.blocked ? ` · ${d.totals.blocked} bloqué(s) au plafond` : ''}</p></div>
      <label className="rm-auto"><input type="checkbox" checked={d.autoReminders} onChange={toggle} /><span><b>Relances automatiques</b><small>J+7, J+15, J+30 · ateliers Fixi</small></span></label>
    </header>
    {d.autoSent > 0 && <p className="rm-info"><Check size={15} /> {d.autoSent} relance(s) automatique(s) envoyée(s) aujourd’hui.</p>}
    {err && <p className="rm-err">{err}</p>}
    {d.rows.length ? <ul className="rm-list">{d.rows.slice(0, 40).map((r: any) => <li key={r.id}>
      <span className={'rm-age ' + lvl(r.days)}>{r.days} j</span>
      <div><b>{r.name}{r.blocked && <em><Lock size={11} /> plafond atteint</em>}</b><small>{money(r.due)}{r.creditLimit > 0 ? ` / plafond ${money(r.creditLimit)}` : ''}{r.last ? ` · relancé le ${new Date(r.last.at).toLocaleDateString('fr-TN')}${r.last.auto ? ' (auto)' : ''}` : ''}</small></div>
      <Link className="btn btn-ghost btn-sm" href={'/supplier/statements/' + r.id} target="_blank" title="Relevé de compte"><FileText size={14} /></Link>
      {r.wa && <a className="btn btn-ghost btn-sm" href={r.wa} target="_blank" rel="noreferrer" title="Message WhatsApp prêt"><MessageCircle size={14} /></a>}
      {sent[r.id] ? <span className="rm-sent"><Check size={14} /> {sent[r.id]}</span> : <button className="btn btn-soft btn-sm" onClick={() => remind(r)}><Send size={14} /> Relancer</button>}
    </li>)}</ul> : <p className="rm-empty">Aucun client en retard. 👏</p>}
  </section>;
}
