'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ReceiptText, CheckCircle2, Clock3, Package, Wallet } from 'lucide-react';
import styles from '@/components/finance-ledger.module.css';

type Payment = {
  id: string; reference: string; amount: number; method: string; date: string;
  collector: string; collectorName?: string|null; note?: string|null; proofUrl?: string|null;
};
type Pending = { id: string; reference: string; amount: number; method: string; date: string; collector: string; collectorName?: string|null };
type Invoice = {
  id: string; reference: string; createdAt: string; total: number; originalTotal: number;
  paid: number; due: number; status: string; items: { id:string;name:string;sku?:string|null;quantity:number;unitPrice:number;discount?:number }[];
  payments: Payment[]; pendingCollections: Pending[];
  credits: { id:string;reference:string;date:string;amount:number;refunded:number }[];
  delivery?: { driverName?:string|null;deliveredAt?:string|null;recipientName?:string|null;proofUrl?:string|null }|null;
};
type Supplier = { customerId: string; company?: { id:string;name:string;region?:string|null;phone?:string|null }|null; due:number; totalPaid:number; sales:Invoice[] };
type Statement = {
 totalDue:number;totalPaid:number;totalInvoiced:number;suppliers:Supplier[];
 pendingOrders:{id:string;reference:string;supplier:string;createdAt:string;status:string;total:number;
  collections?:{id:string;reference:string;amount:number;date:string;status:string;method:string;collector:string;collectorName?:string|null}[]}[];
};
const currency = (n:number) => Number(n||0).toFixed(3) + ' DT';
const dt = (v:string|null|undefined) => v ? new Date(v).toLocaleString('fr-TN', {dateStyle:'medium',timeStyle:'short'}) : '—';
const via = (p:Payment|Pending) => p.collector === 'DRIVER' ? 'Livreur' + (p.collectorName ? ' : '+p.collectorName : '') :
 p.collector === 'DELIVERY_LEGACY' ? 'Livraison (historique)' : 'Fournisseur';
const method = (s:string) => ({CASH:'Espèces',BANK_TRANSFER:'Virement',CARD:'Carte',D17:'D17',FLOUCI:'Flouci',ONLINE:'En ligne'} as Record<string,string>)[s] || s;

export default function MySupplierDebts() {
  const [data,setData] = useState<Statement|null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState('');
  const [all,setAll] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/atelier/supplier-debts',{cache:'no-store'});
      const result=await r.json();
      if(!r.ok) throw new Error(result.error || 'Impossible de charger le relevé');
      setData(result);
    }catch(e){setError(e instanceof Error?e.message:'Erreur de chargement');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();const listener=()=>void load();window.addEventListener('focus',listener);return()=>window.removeEventListener('focus',listener)},[load]);

  const visible=useMemo(() => (data?.suppliers||[]).map(s => ({...s,
    sales:s.sales.filter(x => (all || x.due > 0.0001) &&
      [s.company?.name,x.reference,...x.items.map(i=>i.name)].join(' ').toLowerCase().includes(search.toLowerCase()))}))
      .filter(s=>s.sales.length>0),[data,search,all]);
  const paidInvoices=(data?.suppliers||[]).flatMap(s=>s.sales).filter(s=>s.due<0.0001).length;
  const openInvoices=(data?.suppliers||[]).flatMap(s=>s.sales).filter(s=>s.due>0.0001).length;

  return <main className={styles.page}>
    <div className={styles.head}>
      <div><Link href="/app/suppliers" className={styles.action}><ArrowLeft size={15}/> Fixi Supplier</Link>
        <div style={{marginTop:16}} className={styles.eyebrow}>Compte atelier · Relevé officiel</div>
        <h1>Mes dettes fournisseurs</h1>
        <p>Le même solde que dans « Fixi Supplier → Mon dû ». Toutes les factures, dates de paiement, produits et justificatifs au même endroit.</p>
      </div>
      <button className={styles.action} onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Actualiser</button>
    </div>
    <div className={styles.cards}>
      <div className={styles.card+' '+styles.highlight}><span>Reste à payer</span><strong>{currency(data?.totalDue||0)}</strong><small>{openInvoices} facture(s) non soldée(s)</small></div>
      <div className={styles.card}><span>Déjà réglé</span><strong>{currency(data?.totalPaid||0)}</strong><small>Paiements et encaissements confirmés</small></div>
      <div className={styles.card}><span>Factures soldées</span><strong>{paidInvoices}</strong><small>Consultables avec leur historique</small></div>
    </div>
    {error&&<div className={styles.errorMsg} role="alert">{error}</div>}
    {loading&&!data&&<div className={styles.note}>Chargement des comptes fournisseurs…</div>}
    <div className={styles.toolbar}>
      <input className={styles.input+' '+styles.search} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une facture, un produit…"/>
      <button className={styles.action} onClick={()=>setAll(x=>!x)}>
        {all?'Masquer les factures soldées':'Afficher également les factures soldées'}
      </button>
    </div>
    {visible.length===0&&!loading&&<div className={styles.panel+' '+styles.block}>Aucune dette correspondant à la recherche.</div>}
    {visible.map(s=><section key={s.customerId} className={styles.panel}>
      <div className={styles.panelTop}>
        <div><h2>{s.company?.name||'Fournisseur'}</h2><small>{s.company?.region||'—'} {s.company?.phone?' · '+s.company.phone:''} · {s.sales.length} facture(s) affichée(s)</small></div>
        <div style={{textAlign:'right'}}><small>Solde fournisseur</small><strong style={{display:'block'}}>{currency(s.due)}</strong></div>
      </div>
      {s.sales.map((x,index)=><details key={x.id} className={styles.order} open={index===0}>
        <summary>
          <div className={styles.orderTitle}><strong>{x.reference}</strong><span>Facture du {dt(x.createdAt)}</span></div>
          <div className={styles.amount}><strong>{x.due<=0.0001?'Soldée':currency(x.due)}</strong><span>Payé {currency(x.paid)} / {currency(x.total)}</span></div>
        </summary>
        <div className={styles.detail}>
          <div><h3>Produits de cette facture</h3>
            {x.items.map(i=><div className={styles.line} key={i.id}>
              <div><strong>{i.name}</strong><div><span>{i.sku||''} · Quantité {i.quantity} × {currency(i.unitPrice)}</span></div></div>
              <strong>{currency(i.quantity*i.unitPrice-(i.discount||0))}</strong>
            </div>)}
          </div>
          <div><h3><ReceiptText size={15} style={{verticalAlign:'middle'}}/> Historique exact des paiements</h3>
            {x.payments.length===0&&<div className={styles.note}>Aucun paiement confirmé sur cette facture.</div>}
            {[...x.payments].reverse().map(p=><div className={styles.transaction} key={p.id}>
              <div className={styles.transactionHead}><div><b>{currency(p.amount)} reçu</b><div className={styles.transactionSub}>Le {dt(p.date)} · {method(p.method)} · {via(p)}</div></div><span className={styles.state+' '+styles.ok}><CheckCircle2 size={12}/> Confirmé</span></div>
              <div className={styles.transactionSub}>Référence : {p.reference}{p.note?' · '+p.note:''}
                {p.proofUrl&&<> · <a href={p.proofUrl} target="_blank" rel="noreferrer">Voir la preuve</a></>}</div>
            </div>)}
            {x.pendingCollections.map(p=><div className={styles.transaction+' '+styles.transactionPending} key={p.id}>
              <div className={styles.transactionHead}><b>{currency(p.amount)} déclaré</b><span className={styles.state+' '+styles.pending}>En attente de validation</span></div>
              <div className={styles.transactionSub}>{dt(p.date)} · {via(p)} · {p.reference} — non déduit du solde</div>
            </div>)}
            {x.credits.map(c=><div className={styles.transaction} key={c.id}>
              <div className={styles.transactionHead}><b>Avoir {currency(c.amount)}</b><span className={styles.state+' '+styles.ok}>Retour validé</span></div>
              <div className={styles.transactionSub}>{dt(c.date)} · {c.reference} · Remboursement : {currency(c.refunded)}</div>
            </div>)}
          </div>
          {x.delivery&&<div className={styles.note}><Package size={15} style={{verticalAlign:'middle'}}/> Livraison : {x.delivery.driverName||'Livreur non renseigné'}
            {x.delivery.deliveredAt?' · Livrée le '+dt(x.delivery.deliveredAt):''}
            {x.delivery.recipientName?' · Réception par '+x.delivery.recipientName:''}
          </div>}
        </div>
      </details>)}
    </section>)}
    {!!data?.pendingOrders?.length&&<section className={styles.panel}>
      <div className={styles.panelTop}><div><h2><Clock3 size={17} style={{verticalAlign:'middle'}}/> Commandes pas encore facturées</h2>
        <small>Ces commandes ne sont PAS incluses dans le total dû. Le solde n’augmente qu’après comptabilisation de la facture.</small></div><strong>{data.pendingOrders.length} commande(s)</strong></div>
      <div className={styles.block}>{data.pendingOrders.map(o=><div className={styles.line} key={o.id}>
        <div><strong>{o.reference}</strong><div><span>{o.supplier} · {dt(o.createdAt)} · {o.status}</span></div>
          {(o.collections||[]).map(p=><div key={p.id} style={{marginTop:5}}><span>{p.status==='CONFIRMED'?'Avance confirmée':'Encaissement à valider'} : {currency(p.amount)} · {dt(p.date)} · {via(p)} · {p.reference}</span></div>)}
        </div><strong>{currency(o.total)}</strong>
      </div>)}</div>
    </section>}
    <div className={styles.note}><Wallet size={14} style={{verticalAlign:'middle'}}/> Les paiements en attente ne réduisent pas le solde. Les sommes déjà remises au fournisseur sont distinguées de celles détenues par un livreur.</div>
  </main>;
}
