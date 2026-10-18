'use client';
import { useEffect, useState } from 'react';

type Order = { id: string; reference: string; shop: { name: string }; total: string; delivery?: { driverAccountId: string } | null; availableToAccept?: boolean };
type Receipt = { id: string; reference: string; amount: string; status: string; remittances: { id: string; amount: string; confirmedAt: string | null }[] };

export default function DriverCollectionsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [ordersResponse, receiptsResponse] = await Promise.all([
        fetch('/api/delivery/orders', { cache: 'no-store' }),
        fetch('/api/supplier/settlements/driver', { cache: 'no-store' }),
      ]);
      if (!ordersResponse.ok || !receiptsResponse.ok) throw new Error('Impossible de charger les encaissements.');
      const [o, r] = await Promise.all([ordersResponse.json(), receiptsResponse.json()]);
      setOrders(Array.isArray(o) ? o : []);
      setReceipts(Array.isArray(r) ? r : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    }
  }
  useEffect(() => { void load(); }, []);

  const assigned = orders.filter(o => o.delivery?.driverAccountId && !o.availableToAccept);
  const chosen = assigned.find(o => o.id === orderId);

  async function record(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setMessage('');
    setError('');
    if (!chosen) { setError('Choisissez une commande attribuée.'); return; }
    if (!amount.trim()) { setError('Indiquez le montant reçu, par exemple 50.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch('/api/supplier/settlements/driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: chosen.id,
          amount: amount.trim(),
          method: 'CASH',
          idempotencyKey: crypto.randomUUID() + '-driver',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Encaissement non enregistré');
      setMessage('Encaissement enregistré : ' + Number(data.amount).toFixed(3) + ' DT. En attente de confirmation du fournisseur.');
      setAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de paiement');
    } finally {
      setSubmitting(false);
    }
  }

  return <main style={{ maxWidth: 760, margin: '24px auto', padding: '18px 16px', fontFamily: 'inherit' }}>
    <a href="/delivery" style={{ display: 'inline-block', marginBottom: 24 }}>← Livraisons</a>
    <h1 style={{ fontSize: 'clamp(25px, 5vw, 36px)', lineHeight: 1.2, margin: '0 0 8px' }}>Encaissements et caisse livreur</h1>
    <p style={{ marginBottom: 24 }}>Choisissez une commande puis saisissez directement la somme reçue.</p>
    <form onSubmit={record} style={{ display: 'grid', gap: 16, padding: 20, border: '1px solid #ddd', borderRadius: 14 }}>
      <label style={{ display: 'grid', gap: 8 }}>
        <strong>Commande attribuée</strong>
        <select required value={orderId} onChange={e => { setOrderId(e.target.value); setError(''); }} style={{ width: '100%', padding: 13, borderRadius: 8, border: '1px solid #aaa', background: 'transparent' }}>
          <option value="">Choisir la commande</option>
          {assigned.map(o => <option key={o.id} value={o.id}>{o.reference} — {o.shop.name}</option>)}
        </select>
      </label>
      {chosen && <p style={{ margin: 0, opacity: .75, fontSize: 14 }}>Commande {chosen.reference} · {chosen.shop.name}</p>}
      <label style={{ display: 'grid', gap: 8 }}>
        <strong>Montant reçu (DT)</strong>
        <input required type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }}
          placeholder="Ex. 50" aria-describedby="amount-help" style={{ width: '100%', boxSizing: 'border-box', padding: 13, borderRadius: 8, border: '1px solid #aaa', fontSize: 18, background: 'transparent' }} />
        <small id="amount-help" style={{ opacity: .75 }}>Écrivez simplement 50 pour 50 DT. Les décimales sont facultatives (ex. 50,5).</small>
      </label>
      <button disabled={submitting || assigned.length === 0} type="submit" style={{ padding: 14, borderRadius: 8, cursor: submitting ? 'wait' : 'pointer' }}>
        {submitting ? 'Enregistrement…' : 'Enregistrer le montant reçu'}
      </button>
      {assigned.length === 0 && <p role="status">Aucune commande ne vous est attribuée pour le moment.</p>}
      {error && <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
      {message && <p role="status" style={{ margin: 0 }}>{message}</p>}
    </form>
    <h2 style={{ marginTop: 32 }}>Historique</h2>
    {receipts.length === 0 && <p>Aucun encaissement enregistré.</p>}
    {receipts.map(r => <article key={r.id} style={{ padding: 14, borderBottom: '1px solid #ddd' }}>
      <strong>{r.reference}</strong> — {Number(r.amount).toFixed(3)} DT ({r.status === 'PENDING' ? 'En attente' : r.status === 'CONFIRMED' ? 'Confirmé' : r.status})
      <p style={{ margin: '6px 0 0' }}>Remis au fournisseur : {(r.remittances || []).filter(x => x.confirmedAt).reduce((n, x) => n + Number(x.amount), 0).toFixed(3)} DT</p>
    </article>)}
  </main>;
}
