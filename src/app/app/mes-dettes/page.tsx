'use client';
import { useEffect, useState } from 'react';
type DebtOrder = {
 id: string; reference: string; total: string; paid: string; due: string;
 company: { name: string };
 items: { id: string; quantity: number; product: { name: string } }[];
 settlements: { id: string; reference: string; amount: string; status: string }[];
};
export default function MySupplierDebts() {
 const [orders,setOrders] = useState<DebtOrder[]>([]);
 const [error,setError] = useState('');
 useEffect(() => {
   fetch('/api/atelier/supplier-debts')
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger les dettes');
      setOrders(data);
    }).catch(e => setError(String(e.message)));
 }, []);
 const due = orders.reduce((n,o) => n + Number(o.due), 0);
 return <main style={{maxWidth:900,margin:'32px auto',padding:20}}>
  <h1>Mes dettes fournisseurs</h1>
  <h2>Solde total : {due.toFixed(3)} DT</h2>
  {error && <p role="alert">{error}</p>}
  {orders.map(o => <details key={o.id} style={{padding:16,border:'1px solid #ddd',marginBottom:12}}>
   <summary>{o.company.name} · {o.reference} · Reste {Number(o.due).toFixed(3)} DT</summary>
   <p>Total {Number(o.total).toFixed(3)} DT — Payé {Number(o.paid).toFixed(3)} DT</p>
   <h3>Produits</h3>
   <ul>{o.items.map(i => <li key={i.id}>{i.product.name} × {i.quantity}</li>)}</ul>
   <h3>Historique paiements</h3>
   <ul>{o.settlements.map(p => <li key={p.id}>{p.reference} : {Number(p.amount).toFixed(3)} DT ({p.status})</li>)}</ul>
  </details>)}
 </main>;
}
