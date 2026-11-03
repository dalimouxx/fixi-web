'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { api } from './ui';
import { money, dateOnly } from '@/lib/format';

// Paiement en plusieurs fois : échéancier simple, rappel WhatsApp automatique si l'atelier a WhatsApp Cloud.
export function RepairInstallments({ code, balance, canEdit }: { code: string; balance: number; canEdit: boolean }) {
  const [data, setData] = useState<any>(null);
  const [count, setCount] = useState(3);
  const [first, setFirst] = useState(() => new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const load = () => fetch(`/api/repairs/${encodeURIComponent(code)}/installments`).then(r => r.ok ? r.json() : null).then(setData).catch(() => {});
  useEffect(() => { load(); }, [code, balance]);
  const list: any[] = data?.installments || [];
  async function create() { try { setData(await api(`/api/repairs/${encodeURIComponent(code)}/installments`, { method: 'POST', body: JSON.stringify({ count, firstDate: first }) })); setOpen(false); } catch (e: any) { alert(e.message); } }
  async function remove() { if (!confirm('Supprimer l’échéancier ?')) return; try { await api(`/api/repairs/${encodeURIComponent(code)}/installments`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); } }
  if (!list.length && (balance <= 0 || !canEdit)) return null;
  return <section className="card card-pad fx-installments">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><h2 className="section-title"><CalendarClock size={18} /> Paiement en plusieurs fois</h2>{list.length > 0 && canEdit && <button className="fx-icon-btn" onClick={remove} aria-label="Supprimer l’échéancier"><Trash2 size={16} /></button>}</div>
    {list.length ? <ul>{list.map((x, i) => <li key={x.id || i} data-state={x.paid ? 'paid' : x.late ? 'late' : x.dueToday ? 'today' : 'todo'}>
      {x.paid ? <CheckCircle2 size={16} /> : x.late ? <AlertTriangle size={16} /> : <CalendarClock size={16} />}
      <span>{dateOnly(x.dueDate)}</span><b>{money(x.amount)}</b><small>{x.paid ? 'Payée' : x.late ? 'En retard' : x.dueToday ? 'Aujourd’hui' : x.covered > 0 ? `reste ${money(x.remaining)}` : 'À venir'}</small>
    </li>)}</ul> : !open ? <button className="btn btn-ghost btn-block" onClick={() => setOpen(true)}>Étaler {money(balance)} en plusieurs fois</button> :
      <div className="fx-form-stack">
        <div className="fx-segment" role="radiogroup" aria-label="Nombre de fois">{[2, 3, 4, 6].map(n => <button type="button" role="radio" key={n} aria-checked={count === n} onClick={() => setCount(n)}>{n} fois</button>)}</div>
        <label className="field"><span className="label">Première échéance</span><input className="input" type="date" value={first} onChange={e => setFirst(e.target.value)} /></label>
        <p className="fx-form-hint" style={{ color: 'var(--fx-ink-2)' }}>{count} × environ {money(balance / count)}, une fois par mois.</p>
        <button className="btn btn-primary btn-block" onClick={create}>Créer l’échéancier</button>
      </div>}
    {list.some(x => !x.paid) && <Link href={`/app/cashier?q=${encodeURIComponent(code)}`} className="btn btn-soft btn-block" style={{ marginTop: 10 }}>Encaisser une échéance</Link>}
  </section>;
}
