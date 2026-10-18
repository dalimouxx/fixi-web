'use client';
import { useEffect, useState } from 'react';
type Order = {id:string;reference:string;shop:{name:string};total:string;delivery?:{driverAccountId:string}|null;availableToAccept?:boolean};
type Receipt = {id:string;reference:string;amount:string;status:string;remittances:{id:string;amount:string;confirmedAt:string|null}[]};
export default function DriverCollectionsPage(){
 const [orders,setOrders]=useState<Order[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]);
 const [orderId,setOrderId]=useState(''),[amount,setAmount]=useState(''),[message,setMessage]=useState('');
 const load=async()=>{const [o,r]=await Promise.all([fetch('/api/delivery/orders'),fetch('/api/supplier/settlements/driver')]);
   if(o.ok){const x=await o.json();setOrders(Array.isArray(x)?x:[])}if(r.ok){const x=await r.json();setReceipts(Array.isArray(x)?x:[])}};
 useEffect(()=>{void load()},[]);
 async function record(e:React.FormEvent){e.preventDefault();setMessage('');
 const r=await fetch('/api/supplier/settlements/driver',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId,amount,method:'CASH',idempotencyKey:crypto.randomUUID()+'-driver'})});
 const x=await r.json();setMessage(r.ok?'Encaissement transmis pour confirmation : '+x.reference:x.error||'Erreur');if(r.ok){setAmount('');await load()}}
 return <main style={{maxWidth:800,margin:'35px auto',padding:20,fontFamily:'sans-serif'}}>
 <a href="/delivery">← Livraisons</a><h1>Encaissements et caisse livreur</h1>
 <form onSubmit={record} style={{display:'grid',gap:12,maxWidth:480}}>
 <label>Commande attribuée <select required value={orderId} onChange={e=>setOrderId(e.target.value)} style={{width:'100%',padding:10}}>
 <option value="">Choisir</option>{orders.filter(o=>o.delivery?.driverAccountId&&!o.availableToAccept).map(o=><option key={o.id} value={o.id}>{o.reference} — {o.shop.name}</option>)}</select></label>
 <label>Montant reçu (DT) <input required value={amount} onChange={e=>setAmount(e.target.value)} pattern="[0-9]+\\.[0-9]{3}" placeholder="50.000" style={{width:'100%',padding:10}}/></label>
 <button style={{padding:12}}>Déclarer l'encaissement</button></form>
 <p role="status">{message}</p><h2>Historique</h2>
 {receipts.map(r=><article key={r.id} style={{borderBottom:'1px solid #ccc',padding:12}}>
 <strong>{r.reference}</strong> — {Number(r.amount).toFixed(3)} DT ({r.status})
 <p>Reversements confirmés : {r.remittances.filter(x=>x.confirmedAt).reduce((n,x)=>n+Number(x.amount),0).toFixed(3)} DT</p>
 </article>)}
 </main>;
}
