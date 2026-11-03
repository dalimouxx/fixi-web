import React,{useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {FileText,Printer} from 'lucide-react';
import {Modal} from './dialogs';

const dt=(n:number)=>new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT';
export type InvoiceData={document:{id:string;reference:string;issuedAt:string;partyName?:string|null;partyTaxId?:string|null;partyAddress?:string|null;partyPhone?:string|null;ht:number;tva:number;stamp:number;total:number};
 lines:{name:string;sku?:string|null;quantity:number;taxRate:number;unitHT:number;totalHT:number;tva:number}[];taxes:{rate:number;base:number;amount:number}[];
 company:{name?:string;legalName?:string|null;address?:string|null;region?:string|null;phone?:string|null;email?:string|null;taxId?:string|null;tradeRegister?:string|null;logoUrl?:string|null;documentFooter?:string|null;invoiceTerms?:string|null;bankName?:string|null;bankRib?:string|null}|null;
 sale:{reference:string;createdAt:string;total:number;paid:number}};

/** Demande les informations du client (si besoin) puis crée la facture numérotée du ticket. */
export function InvoiceDialog({reference,customer,onDone,onClose}:{reference:string;customer?:{name:string;taxId?:string|null;address?:string|null;phone?:string|null}|null;onDone:(x:InvoiceData)=>void;onClose:()=>void}){
 const [name,setName]=useState(customer?.name||''),[taxId,setTaxId]=useState(customer?.taxId||''),[address,setAddress]=useState(customer?.address||''),[stamp,setStamp]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{onDone(await invoke<InvoiceData>('supplier_invoice',{request:{reference,partyName:name,partyTaxId:taxId,partyAddress:address,partyPhone:customer?.phone||null,stamp}}));onClose()}
  catch(err){setError(String(err))}finally{setBusy(false)}}
 return <Modal title="Facture du ticket" icon={<FileText size={19}/>} onClose={onClose}>
  <p className="v5-hint">Ticket <b className="v5-mono">{reference}</b>. Si la facture existe déjà, elle est réimprimée à l’identique (même numéro).</p>
  <form className="v6-form" onSubmit={create}>
   <label className="v5-field"><span>Client (nom ou raison sociale)</span><input autoFocus value={name} maxLength={160} onChange={e=>setName(e.target.value)} placeholder="Laisser vide : client comptoir"/></label>
   <div className="v6-form-2"><label className="v5-field"><span>Matricule fiscal</span><input value={taxId} maxLength={40} onChange={e=>setTaxId(e.target.value.toUpperCase())} placeholder="1234567/A/M/000"/></label>
    <label className="v5-field"><span>Adresse</span><input value={address} maxLength={240} onChange={e=>setAddress(e.target.value)}/></label></div>
   <label className="v6-check"><input type="checkbox" checked={stamp} onChange={e=>setStamp(e.target.checked)}/> Ajouter le timbre fiscal (1,000 DT)</label>
   {error&&<p className="v5-alert v5-alert--danger">{error}</p>}
   <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy}><Printer size={18}/> {busy?'Création…':'Créer et imprimer la facture'}</button>
  </form></Modal>;
}

/** Facture A4 (imprimée seule grâce à body[data-print-mode=invoice]). */
export function InvoicePrint({data,logo}:{data:InvoiceData|null;logo?:string}){
 if(!data)return null;
 const d=data.document,c=data.company||{},due=Math.max(0,d.total-data.sale.paid);
 return <div className="v6-invoice" aria-label="Facture imprimable"><article>
  <header><div className="v6-inv-brand">{logo&&<img src={logo} alt=""/>}<div><h1>{c.name}</h1>{c.legalName&&c.legalName!==c.name&&<p>{c.legalName}</p>}<p>{[c.address,c.region].filter(Boolean).join(' · ')}</p><p>{[c.phone,c.email].filter(Boolean).join(' · ')}</p>{c.taxId&&<p>MF : {c.taxId}</p>}{c.tradeRegister&&<p>RNE : {c.tradeRegister}</p>}</div></div>
   <div className="v6-inv-title"><span>FACTURE</span><b>{d.reference}</b><small>Date : {new Date(d.issuedAt).toLocaleDateString('fr-FR')}</small><small>Ticket : {data.sale.reference}</small></div></header>
  <section className="v6-inv-party"><span>Client</span><b>{d.partyName||'Client comptoir'}</b>{d.partyTaxId&&<p>MF : {d.partyTaxId}</p>}{d.partyAddress&&<p>{d.partyAddress}</p>}{d.partyPhone&&<p>Tél. {d.partyPhone}</p>}</section>
  <table><thead><tr><th>Désignation</th><th>Qté</th><th>P.U. HT</th><th>TVA</th><th>Total HT</th></tr></thead>
   <tbody>{data.lines.map((l,i)=><tr key={i}><td>{l.name}{l.sku&&<small>{l.sku}</small>}</td><td>{l.quantity}</td><td>{dt(l.unitHT)}</td><td>{l.taxRate} %</td><td>{dt(l.totalHT)}</td></tr>)}</tbody></table>
  <div className="v6-inv-bottom"><table className="v6-inv-taxes"><thead><tr><th>Taux</th><th>Base HT</th><th>TVA</th></tr></thead><tbody>{data.taxes.map(t=><tr key={t.rate}><td>{t.rate} %</td><td>{dt(t.base)}</td><td>{dt(t.amount)}</td></tr>)}</tbody></table>
   <div className="v6-inv-totals"><p><span>Total HT</span><b>{dt(d.ht)}</b></p><p><span>Total TVA</span><b>{dt(d.tva)}</b></p>{d.stamp>0&&<p><span>Timbre fiscal</span><b>{dt(d.stamp)}</b></p>}<p className="v6-inv-net"><span>Net à payer TTC</span><b>{dt(d.total)}</b></p><p><span>Déjà payé</span><b>{dt(data.sale.paid)}</b></p>{due>0.0005&&<p><span>Reste à payer</span><b>{dt(due)}</b></p>}</div></div>
  {(c.invoiceTerms||c.bankRib)&&<section className="v6-inv-terms">{c.invoiceTerms&&<p><b>Conditions :</b> {c.invoiceTerms}</p>}{c.bankRib&&<p><b>Banque :</b> {c.bankName||''} · RIB {c.bankRib}</p>}</section>}
  <footer>{c.documentFooter||'Facture générée par FIXI Caisse'}</footer>
 </article></div>;
}

export type PaymentSlipData={company:string;customer:string;amount:number;method:string;allocated:number;remaining:number;reference:string;date:string;cashier?:string};
/** Reçu de versement (ticket 80 mm) après un paiement de dette. */
export function PaymentSlip({data}:{data:PaymentSlipData|null}){
 if(!data)return null;
 const m:Record<string,string>={CASH:'Espèces',CARD:'Carte',TRANSFER:'Virement'};
 return <div className="v4-receipt v6-z" aria-label="Reçu de versement"><article>
  <header><strong>{data.company}</strong><small>Reçu de versement</small><small>{data.date}</small>{data.cashier&&<small>Caissier : {data.cashier}</small>}</header>
  <hr/><p>Client <b>{data.customer}</b></p><p>Montant versé <b>{dt(data.amount)}</b></p><p>Moyen <b>{m[data.method]||data.method}</b></p><p>Factures réglées <b>{data.allocated}</b></p>
  <hr/><p>Reste à payer <b>{dt(data.remaining)}</b></p>
  <small>Réf. {data.reference.slice(0,22)}</small><small>Merci de votre confiance</small>
 </article></div>;
}
