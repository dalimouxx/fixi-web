'use client';
import { EmptyState } from '@/components/ui-states';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, useApi } from '@/components/ui';
import { money } from '@/lib/format';
import { CashSuccess } from '@/components/cash-success';
import { CounterSalePanel } from '@/components/counter-sale';
import { Banknote, CheckCircle2, CreditCard, Search, Settings2, Smartphone, WalletCards, Wrench, Receipt, FolderOpen, Clock4, ShoppingBag } from 'lucide-react';

const methods = [['CASH', 'Espèces', Banknote], ['D17', 'D17', Smartphone], ['FLOUCI', 'Flouci', Smartphone], ['CARD', 'Carte', CreditCard], ['BANK_TRANSFER', 'Virement', WalletCards]] as const;

/** Caisse atelier (Fixi Max) : choisir l'appareil, le mode de paiement, encaisser ou livrer. */
export default function CashierSimple() {
  const [q, setQ] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data } = useApi<any>(`/api/cashier/overview?q=${encodeURIComponent(q)}`, refresh);
  const [selected, setSelected] = useState<any>(null);
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preset, setPreset] = useState('');
  const [success, setSuccess] = useState<{ title: string; amount: string } | null>(null);
  const [mode, setMode] = useState<'repairs' | 'counter'>('repairs');
  const cur = data?.shop?.currency;

  useEffect(() => { const sp = new URLSearchParams(window.location.search); const c = sp.get('repair'); if (c) { setPreset(c); setQ(c); } else if (sp.get('mode') === 'comptoir') setMode('counter'); }, []);
  function switchMode(m: 'repairs' | 'counter') { setMode(m); try { const u = new URL(window.location.href); if (m === 'counter') u.searchParams.set('mode', 'comptoir'); else u.searchParams.delete('mode'); u.searchParams.delete('repair'); history.replaceState(null, '', u); } catch {} }
  useEffect(() => {
    if (selected) { const fresh = (data?.repairs || []).find((x: any) => x.id === selected.id); if (fresh) setSelected(fresh); }
    else if (preset) { const hit = (data?.repairs || []).find((x: any) => x.code === preset); if (hit) { pick(hit); setPreset(''); } }
  }, [data]);

  const balance = Number(selected?.balance || 0);
  const pay = Math.min(balance, Math.max(0, Number(amount || 0)));
  const change = method === 'CASH' ? Math.max(0, Number(received || 0) - pay) : 0;
  const ready = useMemo(() => data?.repairs || [], [data]);
  const totalDue = ready.reduce((a: number, r: any) => a + Number(r.balance || 0), 0);

  function pick(r: any) { setSelected(r); setAmount(String(Number(r.balance || 0))); setReceived(String(Number(r.balance || 0))); setMsg(''); setSuccess(null); }
  async function deliver() {
    if (!selected) return; setBusy(true); setMsg('');
    try {
      await api(`/api/repairs/${selected.code}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'DELIVERED', note: 'Livraison depuis Caisse Simple' }) });
      setMsg('✓ Appareil livré'); setSuccess({ title: 'Appareil livré', amount: 'PAYÉ' }); setRefresh(x => x + 1);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function checkout() {
    if (!selected || !(pay > 0)) return; setBusy(true); setMsg('');
    try {
      await api('/api/cashier/checkout', { method: 'POST', body: JSON.stringify({ repairId: selected.id, splits: [{ method, amount: pay, receivedAmount: method === 'CASH' ? Number(received || pay) : pay }] }) });
      setMsg('✓ Paiement encaissé'); setSuccess({ title: 'Paiement encaissé', amount: money(pay, cur) }); setRefresh(x => x + 1);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return <div className="page cashier-simple-page fxm-cash">
    <div className="fxm-rp-head fxm-up">
      <div><div className="fxm-kick">Caisse</div><h1 className="fxm-h1">{mode === 'counter' ? 'Vente comptoir' : 'Encaisser et rendre'}</h1><div className="fxm-dash-sub">{mode === 'counter' ? 'Accessoires, câbles, coques, verres trempés… vendus sans réparation' : <>{ready.length} appareil(s) à encaisser · {money(totalDue, cur)} au total</>}</div></div>
      <div className="fxm-rp-actions">
        <div className="fxm-seg fxm-cash-mode" role="tablist" aria-label="Type d’encaissement">
          <button type="button" role="tab" aria-selected={mode === 'repairs'} className={mode === 'repairs' ? 'on' : ''} onClick={() => switchMode('repairs')}><Wrench size={15} /> Réparations</button>
          <button type="button" role="tab" aria-selected={mode === 'counter'} className={mode === 'counter' ? 'on' : ''} onClick={() => switchMode('counter')}><ShoppingBag size={15} /> Vente comptoir</button>
        </div>
        <Link href="/app/cash-sessions" className="btn fxm-btn-o"><Clock4 size={16} /> Session &amp; clôture</Link>
        <Link href="/app/cashier/pro" className="btn fxm-btn-o"><Settings2 size={16} /> Caisse avancée</Link>
      </div>
    </div>

    {mode === 'counter' ? <CounterSalePanel /> : <div className={`fxm-cash-grid ${selected ? 'has-selection' : ''}`}>
      <section className="fxm-card fxm-up fxm-cash-list" style={{ '--d': '.06s' } as any} aria-label="Appareils à encaisser">
        <label className="fxm-search"><Search size={17} aria-hidden="true" /><span className="fxm-sr">Rechercher</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Code, téléphone, client, IMEI…" autoFocus /></label>
        <div className="fxm-panel-head"><h2>Appareils à encaisser</h2><span className="fxm-badge-hot">{ready.length}</span></div>
        <div className="fxm-cash-items">
          {ready.map((r: any, i: number) => <button key={r.id} type="button" onClick={() => pick(r)} className={'fxm-cash-item fxm-in' + (selected?.id === r.id ? ' on' : '')} style={{ '--d': `${0.1 + Math.min(i, 10) * 0.04}s` } as any}>
            <span className="fxm-av" aria-hidden="true"><span>{ini(r.client?.fullName)}</span></span>
            <span className="fxm-grow"><b>{[r.brand, r.model].filter(Boolean).join(' ') || r.code}</b><small>{r.client?.fullName} · <span className="fxm-mono">{r.code}</span></small></span>
            <span className="fxm-cash-item-end"><b className="fxm-num">{money(r.balance, cur)}</b><span className={`fx-status fx-status--${r.status === 'READY' ? 'READY' : 'DELIVERED'}`}><i aria-hidden="true" />{r.status === 'READY' ? 'Prêt' : 'Livré'}</span></span>
          </button>)}
          {!ready.length && <EmptyState icon={Wrench} title="Aucun appareil prêt" text="Les réparations marquées « Prêt » apparaissent ici pour être encaissées." action={<Link className="btn btn-soft btn-sm" href="/app/repairs">Voir les réparations</Link>} />}
        </div>
      </section>

      <section className="fxm-card fxm-up fxm-cash-main" style={{ '--d': '.12s' } as any} aria-label="Ticket">
        {selected ? <>
          <button type="button" className="btn btn-ghost btn-sm fx-mobile-only cash-back" onClick={() => { setSelected(null); setMsg(''); setSuccess(null); }}>← Autres appareils</button>
          <div className="fxm-cash-head">
            <span className="fxm-av fxm-av--l" aria-hidden="true"><span>{ini(selected.client?.fullName)}</span></span>
            <div className="fxm-grow"><div className="fxm-kick fxm-kick--muted">Dossier <span className="fxm-mono">{selected.code}</span></div><h2>{[selected.brand, selected.model].filter(Boolean).join(' ') || selected.code}</h2><small>{selected.client?.fullName} · <span className="fxm-num">{selected.client?.phone}</span></small></div>
            <span className={`fx-status fx-status--${selected.status === 'READY' ? 'READY' : 'DELIVERED'}`}><i aria-hidden="true" />{selected.status === 'READY' ? 'Prêt' : 'Livré'}</span>
          </div>

          <div className="fxm-cash-totals">
            <div><span>Total</span><b className="fxm-num">{money(selected.payable, cur)}</b></div>
            <div><span>Déjà payé</span><b className="fxm-num fxm-ok">{money(selected.paid, cur)}</b></div>
            <div className="due"><span>Reste à payer</span><b className="fxm-num fxm-gt">{money(balance, cur)}</b></div>
          </div>

          {balance > 0 && <>
            <div className="fxm-cash-methods" role="group" aria-label="Mode de paiement">
              {methods.map(([v, l, I]) => <button key={v} type="button" aria-pressed={method === v} onClick={() => setMethod(v)} className={method === v ? 'on' : ''}><I /><span>{l}</span></button>)}
            </div>
            <div className="fxm-cash-amounts">
              <label className="fxm-cash-field"><span>Montant à encaisser</span><span className="fxm-cash-input"><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /><em>{cur || 'DT'}</em></span></label>
              <button type="button" className="btn fxm-btn-o btn-sm" onClick={() => { setAmount(String(balance)); setReceived(String(balance)); }}>Montant exact</button>
            </div>
            {method === 'CASH' && <div className="fxm-cash-cash">
              <label className="fxm-cash-field"><span>Montant reçu</span><span className="fxm-cash-input"><input inputMode="decimal" value={received} onChange={e => setReceived(e.target.value)} /><em>{cur || 'DT'}</em></span></label>
              <div className="fxm-cash-change"><span>Monnaie à rendre</span><b className="fxm-num">{money(change, cur)}</b></div>
              <div className="fxm-cash-notes" role="group" aria-label="Billets reçus">
                <button type="button" onClick={() => setReceived(String(pay))}>Exact</button>
                {[5, 10, 20, 50].map(n => <button type="button" key={n} onClick={() => setReceived(v => String(Math.round((Number(v || 0) + n) * 1000) / 1000))}>+{n}</button>)}
                <button type="button" onClick={() => setReceived('0')}>Effacer</button>
              </div>
            </div>}
          </>}

          {balance > 0
            ? <button type="button" className="fxm-cash-go" disabled={busy || pay <= 0} onClick={checkout}><CheckCircle2 /><span>{busy ? 'Traitement…' : 'Encaisser'}</span><b className="fxm-num">{money(pay, cur)}</b></button>
            : selected.status === 'READY'
              ? <button type="button" className="fxm-cash-go deliver" disabled={busy} onClick={deliver}><CheckCircle2 /><span>Livrer l’appareil</span><b>Payé</b></button>
              : <div className="fxm-chip fxm-chip--ok" style={{ height: 40, justifyContent: 'center' }}>✓ Dossier réglé et livré</div>}
          {msg && !msg.startsWith('✓') && <div className="error" role="alert">{msg}</div>}

          <div className="fxm-cash-links">
            <Link href={`/app/repairs/${selected.code}`}><FolderOpen size={15} /> Voir le dossier</Link>
            <Link href={`/receipt/${selected.code}`} target="_blank"><Receipt size={15} /> Reçu</Link>
            <Link href="/app/cash-sessions"><Clock4 size={15} /> Session caisse</Link>
          </div>

          {success && <CashSuccess amount={success.amount} title={success.title} subtitle={<>{selected.client?.fullName} · {[selected.brand, selected.model].filter(Boolean).join(' ')}</>}>
            <Link className="btn fxm-btn-o" href={`/receipt/${selected.code}`} target="_blank"><Receipt size={16} /> Imprimer le reçu</Link>
            <button type="button" className="btn fxm-btn-g" onClick={() => { setSuccess(null); setSelected(null); setMsg(''); }}>Appareil suivant</button>
          </CashSuccess>}
        </> : <div className="fxm-cash-empty">
          <span className="fxm-ico fxm-ico--o" style={{ width: 72, height: 72, borderRadius: 24 }}><CreditCard size={32} /></span>
          <h2>Sélectionnez un appareil</h2>
          <p>Choisissez un dossier à gauche ou recherchez par téléphone, code ou nom.</p>
        </div>}
      </section>
    </div>}
  </div>;
}

function ini(name?: string) { return String(name || '?').split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?'; }
