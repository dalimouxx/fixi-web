'use client';
import { useState } from 'react';
import { Banknote, LockKeyhole, UnlockKeyhole, Wallet, ReceiptText, Scale, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { dateTime, money } from '@/lib/format';

// Caisse : ouvrir le matin avec le fond, compter le soir, voir l'écart tout de suite.
export default function CashSessions() {
  const [refresh, setRefresh] = useState(0);
  const { data: current, loading } = useApi<any>('/api/cash-sessions/current', refresh);
  const { data: rows } = useApi<any[]>('/api/cash-sessions', refresh);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState('');
  const [actual, setActual] = useState('');
  const counted = Number(actual);
  const gap = actual !== '' && Number.isFinite(counted) && current ? counted - Number(current.expected || 0) : null;

  async function start(e: React.FormEvent) { e.preventDefault(); try { await api('/api/cash-sessions', { method: 'POST', body: JSON.stringify({ openingAmount: Number(opening || 0) }) }); setOpen(false); setOpening(''); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); } }
  async function close(e: React.FormEvent) {
    e.preventDefault(); if (!current) return;
    if (!Number.isFinite(counted) || counted < 0 || actual === '') return alert('Saisissez le montant réellement compté');
    try { await api(`/api/cash-sessions/${current.id}/close`, { method: 'POST', body: JSON.stringify({ closingActual: counted }) }); setActual(''); setClosing(false); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); }
  }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Caisse</h1><p>Ouvrez avec le fond de caisse, comptez à la fermeture : Fixi calcule l’écart.</p></div>
      {current ? <button className="btn btn-primary" onClick={() => setClosing(true)}><LockKeyhole size={18} /> Fermer la caisse</button> : <button className="btn btn-primary" onClick={() => setOpen(true)}><UnlockKeyhole size={18} /> Ouvrir la caisse</button>}</div>

    {loading && current === undefined ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /></div> : current ? <section className="fx-panel fx-cash-open">
      <div className="fx-cash-state"><span className="fx-dot-live" aria-hidden="true" /> <b>Caisse ouverte</b><small>par {current.openedBy?.fullName} · {dateTime(current.openedAt)}</small></div>
      <div className="fx-cash-expected"><span>Il doit y avoir dans la caisse</span><strong>{money(current.expected)}</strong></div>
      <div className="fx-kpis">
        <div className="fx-kpi"><Wallet /><div><span>Fond du matin</span><strong>{money(current.openingAmount)}</strong></div></div>
        <div className="fx-kpi"><Banknote /><div><span>Espèces encaissées</span><strong>{money(current.cashNet)}</strong></div></div>
        <div className="fx-kpi"><ReceiptText /><div><span>Dépenses payées</span><strong>{money(current.expensesTotal)}</strong></div></div>
      </div>
    </section> : <div className="fx-empty"><b>La caisse est fermée</b><span>Ouvrez-la avec le fond de caisse du matin avant d’encaisser en espèces.</span><button className="btn btn-primary" onClick={() => setOpen(true)}><UnlockKeyhole size={18} /> Ouvrir la caisse</button></div>}

    <section className="fx-panel" style={{ marginTop: 12 }}>
      <div className="fx-panel-head"><h2>Fermetures précédentes</h2></div>
      <div className="fx-list">
        {(rows || []).filter((x: any) => x.status !== 'OPEN').map((x: any) => { const d = Number(x.difference || 0); const ok = Math.abs(d) < 0.001; return <div key={x.id} className={`fx-row ${ok ? '' : 'fx-row--danger'}`}>
          {ok ? <CheckCircle2 /> : <AlertTriangle />}
          <span className="fx-row-main"><b>{dateTime(x.openedAt)} · {x.openedBy?.fullName}</b><small>Attendu {x.expectedCash != null ? money(x.expectedCash) : '—'} · compté {x.closingActual != null ? money(x.closingActual) : '—'}</small></span>
          <span className={`fx-chip fx-chip--${ok ? 'ok' : 'danger'}`}>{ok ? 'Juste' : `${d > 0 ? '+' : ''}${money(d)}`}</span>
        </div>; })}
        {!(rows || []).some((x: any) => x.status !== 'OPEN') && <div className="fx-empty fx-empty--small"><span>Aucune fermeture pour l’instant.</span></div>}
      </div>
    </section>

    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Ouvrir la caisse" label="Ouvrir la caisse">
      <form onSubmit={start} className="fx-form-stack">
        <label className="field"><span className="label">Fond de caisse (monnaie du matin)</span><input className="input fx-input-big" type="number" inputMode="decimal" step="0.001" min="0" value={opening} onChange={e => setOpening(e.target.value)} placeholder="0" autoFocus /></label>
        <button className="btn btn-primary btn-block"><UnlockKeyhole size={18} /> Ouvrir</button>
      </form>
    </FxSheet>

    <FxSheet open={closing} onClose={() => setClosing(false)} side="bottom" title="Fermer la caisse" subtitle={current ? `Il doit y avoir ${money(current.expected)}` : undefined} label="Fermer la caisse">
      <form onSubmit={close} className="fx-form-stack">
        <label className="field"><span className="label">Combien avez-vous compté ?</span><input className="input fx-input-big" type="number" inputMode="decimal" step="0.001" min="0" value={actual} onChange={e => setActual(e.target.value)} placeholder="0" autoFocus /></label>
        {gap !== null && <div className={`fx-cash-gap ${Math.abs(gap) < 0.001 ? 'is-ok' : 'is-off'}`} role="status"><Scale size={20} /><span>{Math.abs(gap) < 0.001 ? 'La caisse est juste.' : gap > 0 ? `Il y a ${money(gap)} en trop.` : `Il manque ${money(-gap)}.`}</span></div>}
        <button className="btn btn-primary btn-block"><LockKeyhole size={18} /> Fermer et enregistrer</button>
      </form>
    </FxSheet>
  </div>;
}
