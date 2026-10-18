'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Banknote, CheckCircle2, Clock3, RefreshCw, ReceiptText, WalletCards } from 'lucide-react';
import { FinanceSelectionSummary } from '@/components/finance-selection-summary';
import st from '@/components/finance-ledger.module.css';

type Order = {
  id: string;
  reference: string;
  invoiceReference: string | null;
  hasInvoice: boolean;
  shop: { name: string };
  status: string;
  originalTotal: number;
  creditTotal: number;
  total: number;
  paid: number;
  due: number;
  pending: number;
  availableToCollect: number;
};
type Receipt = {
  id: string; orderId: string|null; reference: string;
  amount: string; status: string; createdAt: string; collectedAt: string;
  order?: { reference: string }|null;
  remittances: { id: string; amount: string; confirmedAt: string|null }[];
};
const format = (v: number) => Number(v||0).toFixed(3)+' DT';
const date = (v: string) => v ? new Date(v).toLocaleString('fr-TN',{dateStyle:'medium',timeStyle:'short'}) : '—';

export default function DriverCollectionsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orderResponse, receiptResponse] = await Promise.all([
        fetch('/api/delivery/settlement-orders',{cache:'no-store'}),
        fetch('/api/supplier/settlements/driver',{cache:'no-store'}),
      ]);
      if (!orderResponse.ok || !receiptResponse.ok) {
        const failed = !orderResponse.ok ? orderResponse : receiptResponse;
        const response = await failed.json().catch(() => ({}));
        throw new Error(response.error || 'Impossible de charger les comptes livreur.');
      }
      const [orderData, receiptData] = await Promise.all([orderResponse.json(),receiptResponse.json()]);
      setOrders(Array.isArray(orderData) ? orderData : []);
      setReceipts(Array.isArray(receiptData) ? receiptData : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus',load); }, [load]);

  const selected = orders.find(order => order.id === orderId);
  const receiptCount = receipts.filter(r => r.status === 'PENDING').length;
  const amountRemaining = selected?.availableToCollect || 0;
  const canCollect = !!selected && amountRemaining > 0.0001;

  async function record(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setMessage('');setError('');
    if (!selected) { setError('Choisissez une commande.'); return; }
    const rawAmount = amount.trim();
    if (!/^(?:0|[1-9]\d{0,8})(?:[.,]\d{1,3})?$/.test(rawAmount) || Number(rawAmount.replace(',','.')) <= 0) {
      setError('Saisissez un montant simple, par exemple 50 ou 50,5.');
      return;
    }
    if (Math.round(Number(rawAmount.replace(',','.'))*1000) > Math.round(amountRemaining*1000)) {
      setError('Le montant dépasse ce qui reste encaissable sur cette commande : '+format(amountRemaining));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/supplier/settlements/driver', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selected.id, amount: rawAmount, method: 'CASH',
          idempotencyKey: crypto.randomUUID() + '-driver',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Encaissement non enregistré');
      setMessage(format(Number(data.amount))+' enregistrés pour '+selected.reference+'. En attente de confirmation du fournisseur.');
      setAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de paiement');
    } finally { setSubmitting(false); }
  }

  return <main className={st.paymentPage}>
    <Link href="/delivery" className={st.action}><ArrowLeft size={16}/> Retour aux livraisons</Link>
    <div className={st.paymentHeader}>
      <span className={st.eyebrow}>FIXI DELIVERY · CAISSE</span>
      <h1>Encaisser une commande</h1>
      <p>Choisissez une commande. Son montant, les sommes déjà réglées et le reste s’affichent automatiquement.</p>
    </div>
    <div className={st.cards}>
      <div className={st.card+' '+st.highlight}><span>Commandes attribuées</span><strong>{orders.length}</strong><small>Soldées ou encore à régler</small></div>
      <div className={st.card}><span>Encaissements à confirmer</span><strong>{receiptCount}</strong><small>En attente du fournisseur</small></div>
      <div className={st.card}><span>Reste à reverser au supplier</span>
        <strong>{format(receipts.filter(r=>r.status==='CONFIRMED').reduce((n,r)=>n+Number(r.amount)-(r.remittances||[]).filter(x=>x.confirmedAt).reduce((a,x)=>a+Number(x.amount),0),0))}</strong>
        <small>Encaissements confirmés, non encore remis</small>
      </div>
    </div>
    <section className={st.paymentPanel}>
      <div className={st.paymentPanelTop}>
        <i><WalletCards size={22}/></i><div><h2>Nouveau paiement</h2><p>Saisie simple en dinars · les décimales sont facultatives</p></div>
      </div>
      <form className={st.paymentPanelBody} onSubmit={record}>
        <label className={st.paymentField}>Commande / facture attribuée
          <select required value={orderId} onChange={e=>{setOrderId(e.target.value);setError('');setMessage('')}}>
            <option value="">Sélectionnez une commande</option>
            {orders.map(o=><option key={o.id} value={o.id}>{o.reference} — {o.shop.name}{o.due<.0001?' · soldée':''}</option>)}
          </select>
        </label>
        {selected&&<FinanceSelectionSummary kind={selected.hasInvoice?'Facture':'Commande'} reference={selected.reference}
          invoiceReference={selected.invoiceReference} customerName={selected.shop.name}
          total={selected.total} paid={selected.paid} due={selected.due} pending={selected.pending}
          available={selected.availableToCollect} creditTotal={selected.creditTotal}/>}
        <label className={st.paymentField}>
          <span className={st.paymentLabelRow}><Banknote size={16}/> Montant reçu de la boutique (DT)</span>
          <input required type="text" inputMode="decimal" autoComplete="off" value={amount}
            onChange={e=>{setAmount(e.target.value);setError('')}} placeholder="Ex. 50"
            aria-describedby="simple-money-help" disabled={!canCollect||submitting}/>
          <span id="simple-money-help" className={st.paymentHelp}>Vous pouvez saisir 50, 50.5 ou 50,5 DT.</span>
        </label>
        {selected && amountRemaining > .0001 && <div className={st.formActions}>
          <button type="button" className={st.action} disabled={submitting}
            onClick={()=>setAmount(String(amountRemaining))}>Encaisser tout le reste : {format(amountRemaining)}</button>
        </div>}
        {selected && !canCollect && <div className={st.feedback+' '+st.feedbackSuccess}><CheckCircle2 size={18}/>
          Cette commande est déjà soldée ou ses encaissements sont en cours de validation.</div>}
        <button type="submit" className={st.paymentSubmit} disabled={submitting||!canCollect}>
          {submitting?<RefreshCw size={18}/>:<CheckCircle2 size={18}/>}
          {submitting?'Enregistrement…':'Enregistrer le montant reçu'}
        </button>
        {orders.length===0 && !loading && <div className={st.paymentHistoryEmpty}>Aucune commande attribuée pour le moment.</div>}
        {error && <div className={st.feedback+' '+st.feedbackError} role="alert">{error}</div>}
        {message && <div className={st.feedback+' '+st.feedbackSuccess} role="status"><CheckCircle2 size={19}/>{message}</div>}
      </form>
    </section>
    <div className={st.head}>
      <div><span className={st.eyebrow}>TRANSPARENCE</span><h2 style={{margin:'7px 0 4px'}}>Historique des encaissements</h2>
      <p>Chaque opération conserve sa date, sa commande et son état.</p></div>
      <button className={st.action} type="button" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/> Actualiser</button>
    </div>
    <div className={st.paymentHistory}>
      {receipts.length===0&&<div className={st.paymentHistoryEmpty}><ReceiptText size={22}/> Aucun encaissement enregistré.</div>}
      {receipts.map(r=>{
        const remitted=(r.remittances||[]).filter(x=>x.confirmedAt).reduce((sum,x)=>sum+Number(x.amount),0);
        const confirmed=r.status==='CONFIRMED';
        return <article key={r.id} className={st.paymentHistoryCard}>
          <div><strong>{r.order?.reference || 'Commande '+(r.orderId||'')}</strong>
            <small>{r.reference} · {date(r.collectedAt||r.createdAt)}</small>
            <small>Remis au fournisseur : {format(remitted)} {confirmed?'· Reste à remettre : '+format(Math.max(0,Number(r.amount)-remitted)):''}</small>
          </div>
          <div><b>{format(Number(r.amount))}</b>
            <small className={st.state+' '+(confirmed?st.ok:st.pending)}>
              {confirmed?<><CheckCircle2 size={12}/> Confirmé</>:<><Clock3 size={12}/> {r.status==='PENDING'?'À confirmer':r.status}</>}
            </small>
          </div>
        </article>;
      })}
    </div>
  </main>;
}
