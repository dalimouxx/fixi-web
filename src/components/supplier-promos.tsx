'use client';
import { useEffect, useState } from 'react';
import { BellRing, Check, Loader2, Tag, X } from 'lucide-react';
import { api } from './ui';
import { money } from '@/lib/format';
import { parseAmount } from '@/lib/product-quick';

/** Fenêtre « Mettre en promo » : prix appliqué aux commandes des ateliers + notification à vos clients. */
export function SupplierPromoDialog({ product, onClose, onDone }: { product: any; onClose: () => void; onDone: (msg: string) => void }) {
  const regular = Number(product.retailPrice ?? product.price);
  const [price, setPrice] = useState(String(Math.round(regular * 0.9 * 1000) / 1000));
  const [days, setDays] = useState(7); const [message, setMessage] = useState(''); const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const p = parseAmount(price), pct = Number.isFinite(p) && regular > 0 ? Math.round((1 - p / regular) * 100) : 0;
  const cost = Number(product.averageCost || product.purchasePrice || 0);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api<any>('/api/supplier/promos', { method: 'POST', body: JSON.stringify({ productId: product.id, promoPrice: p, days, message, notify }) }); onDone(r.capped ? 'Promo active. Limite de 5 notifications par jour atteinte : vos clients la verront dans le catalogue.' : `Promo active${r.notified ? ` · ${r.notified} atelier(s) prévenu(s)` : ''}.`); onClose(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return <div className="pm-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="pm" onSubmit={save} role="dialog" aria-label="Mettre en promotion">
      <header><Tag size={18} /><div><b>Mettre en promo</b><small>{product.name}</small></div><button type="button" aria-label="Fermer" onClick={onClose}><X size={18} /></button></header>
      <div className="pm-price"><label><span>Prix promo</span><input autoFocus value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" /></label><div><del>{money(regular)}</del>{pct > 0 && <em>-{pct} %</em>}</div></div>
      {cost > 0 && Number.isFinite(p) && <p className={'pm-margin' + (p < cost ? ' neg' : '')}>{p < cost ? 'Attention : vente à perte' : 'Marge restante'} {money(p - cost)}</p>}
      <div className="pm-days">{[3, 7, 14, 30].map(d => <button type="button" key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{d} jours</button>)}</div>
      <label className="pm-field"><span>Message (facultatif)</span><input value={message} maxLength={140} onChange={e => setMessage(e.target.value)} placeholder="Ex. Stock limité, livraison gratuite dès 3 pièces" /></label>
      <label className="pm-check"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /><BellRing size={15} /> Prévenir les ateliers qui ont déjà commandé chez moi</label>
      {err && <p className="pm-err">{err}</p>}
      <button className="pm-save" disabled={busy || !(pct > 0)}>{busy ? <Loader2 size={17} className="ps-spin" /> : <Check size={17} />} Lancer la promo</button>
    </form>
  </div>;
}

/** Promotions en cours, avec arrêt immédiat. */
export function SupplierPromoList({ refresh }: { refresh: number }) {
  const [rows, setRows] = useState<any[]>([]); const [n, setN] = useState(0);
  useEffect(() => { fetch('/api/supplier/promos', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => {}); }, [refresh, n]);
  const live = rows.filter(r => r.active && new Date(r.endsAt) > new Date());
  if (!live.length) return null;
  return <section className="supplier-panel pm-list"><h3><Tag size={16} /> Promotions en cours <small>{live.length}</small></h3>
    <ul>{live.map(r => <li key={r.id}><div><b>{r.product?.name}</b><small>{money(Number(r.promoPrice))} au lieu de {money(Number(r.product?.retailPrice ?? r.product?.price))} · jusqu’au {new Date(r.endsAt).toLocaleDateString('fr-TN')}{r.notified ? ` · ${r.notified} atelier(s) prévenu(s)` : ''}</small></div>
      <button className="btn btn-ghost btn-sm" onClick={async () => { await api('/api/supplier/promos', { method: 'PATCH', body: JSON.stringify({ id: r.id }) }); setN(x => x + 1); }}>Arrêter</button></li>)}</ul>
  </section>;
}
