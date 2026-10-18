'use client';
import { useEffect, useState } from 'react';
type Order = { id:string; reference:string; status:string; total:string; shop:{name:string}; delivery?:{cashCollected:string}|null };
type Receipt = { id:string; reference:string; amount:string; status:string; collector:string; order?:{reference:string}|null };
export default function SupplierSettlementsPage() {
  const [orders,setOrders]=useState<Order[]>([]);
  const [receipts,setReceipts]=useState<Receipt[]>([]);
  const [orderId,setOrderId]=useState('');
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState('CASH');
  const [message,setMessage]=useState('');
  const load=async()=> {
    const [o,p]=await Promise.all([fetch('/api/supplier/orders'),fetch('/api/supplier/settlements')]);
    if(o.ok){ const data=await o.json();setOrders(Array.isArray(data)?data:[]); }
    if(p.ok){ const data=await p.json();setReceipts(Array.isArray(data)?data:[]); }
  };
  useEffect(()=>{void load()},[]);
  async function submit(e:React.FormEvent) {
    e.preventDefault();setMessage('');
    const response=await fetch('/api/supplier/settlements',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({orderId,amount,method,idempotencyKey:crypto.randomUUID()+'-supplier'})});
    const data=await response.json();
    setMessage(response.ok?'Paiement enregistre : '+data.reference:(data.error||'Erreur'));
    if(response.ok){setAmount('');await load()}
  }
  async function confirm(id:string){
    const response=await fetch('/api/supplier/settlements/'+encodeURIComponent(id)+'/confirm',{method:'POST'});
    const data=await response.json();setMessage(response.ok?'Encaissement confirme':data.error||'Erreur');await load();
  }
  return <main style={{maxWidth:960,margin:'40px auto',padding:20,fontFamily:'sans-serif'}}>
    <a href="/supplier">← Fournisseur</a><h1>Comptes & règlements</h1>
    <p>Encaissements partiels et validation des paiements livreur.</p>
    <form onSubmit={submit} style={{display:'grid',gap:12,maxWidth:520,marginBottom:32}}>
      <label>Commande <select required value={orderId} onChange={e=>setOrderId(e.target.value)} style={{width:'100%',padding:10}}>
        <option value="">Choisir une commande</option>
        {orders.filter(x=>x.status!=='CANCELLED').map(x=><option key={x.id} value={x.id}>{x.reference} — {x.shop?.name} — {Number(x.total).toFixed(3)} DT</option>)}
      </select></label>
      <label>Montant (DT) <input required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="150.000" pattern="[0-9]+\\.[0-9]{3}" style={{width:'100%',padding:10}}/></label>
      <label>Mode <select value={method} onChange={e=>setMethod(e.target.value)} style={{width:'100%',padding:10}}>
        <option value="CASH">Espèces</option><option value="BANK_TRANSFER">Virement</option><option value="D17">D17</option><option value="FLOUCI">Flouci</option><option value="CARD">Carte</option>
      </select></label>
      <button style={{padding:12,cursor:'pointer'}}>Enregistrer le règlement</button>
    </form>
    {message&&<p role="status">{message}</p>}
    <h2>Historique des encaissements</h2>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderSpacing:12}}>
      <thead><tr><th>Référence</th><th>Commande</th><th>Montant</th><th>Origine</th><th>Statut</th><th>Action</th></tr></thead>
      <tbody>{receipts.map(r=><tr key={r.id}><td>{r.reference}</td><td>{r.order?.reference||'—'}</td><td>{Number(r.amount).toFixed(3)} DT</td><td>{r.collector}</td><td>{r.status}</td><td>{r.status==='PENDING'&&<button onClick={()=>void confirm(r.id)}>Confirmer</button>}</td></tr>)}</tbody>
    </table></div>
  </main>;
}
