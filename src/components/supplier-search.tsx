'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, ClipboardList, UserRound, X } from 'lucide-react';

type Hit = { key: string; icon: any; title: string; sub: string; go: () => void; group: string };

// Recherche fournisseur : produit (nom, référence, code-barres), commande, client.
// Tout est déjà chargé dans l'écran : la recherche est instantanée, même hors ligne.
export function SupplierSearch({ products, orders, customers, onProduct, onOrder, onCustomer }: {
  products: any[]; orders: any[]; customers: any[];
  onProduct: (q: string) => void; onOrder: (q: string) => void; onCustomer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(v => !v); } };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }, []);
  useEffect(() => { if (open) { setQ(''); setActive(0); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLocaleLowerCase('fr');
    if (t.length < 2) return [];
    const has = (...v: any[]) => v.some(x => String(x || '').toLocaleLowerCase('fr').includes(t));
    const close = (fn: () => void) => () => { setOpen(false); fn(); };
    return [
      ...products.filter(p => has(p.name, p.sku, p.barcode, p.brand, p.category)).slice(0, 6).map(p => ({ key: 'p' + p.id, icon: Package, group: 'Produits', title: p.name, sub: `${p.sku || ''} · stock ${Number(p.stock || 0) - Number(p.reservedStock || 0)}`, go: close(() => onProduct(p.name)) })),
      ...orders.filter(o => has(o.reference, o.shop?.name, o.shop?.phone)).slice(0, 5).map(o => ({ key: 'o' + o.id, icon: ClipboardList, group: 'Commandes', title: `${o.reference} · ${o.shop?.name || ''}`, sub: o.status, go: close(() => onOrder(o.reference)) })),
      ...customers.filter(c => has(c.name, c.phone)).slice(0, 5).map(c => ({ key: 'c' + c.id, icon: UserRound, group: 'Clients', title: c.name, sub: c.phone || '', go: close(onCustomer) })),
    ];
  }, [q, products, orders, customers]);
  useEffect(() => setActive(0), [hits.length]);
  let i = -1;
  return <>
    <button type="button" className="fx-icon-btn" onClick={() => setOpen(true)} aria-label="Rechercher : produit, code-barres, commande, client" title="Rechercher (Ctrl K)"><Search size={19} /></button>
    {open && createPortal(<div className="fx-palette-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
      <div className="fx-palette" role="dialog" aria-modal="true" aria-label="Recherche">
        <div className="fx-palette-input"><Search size={20} />
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Produit, code-barres, commande, client…" aria-label="Rechercher"
            onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(hits.length - 1, a + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); } else if (e.key === 'Enter') hits[active]?.go(); else if (e.key === 'Escape') setOpen(false); }} />
          <button type="button" className="fx-icon-btn" onClick={() => setOpen(false)} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="fx-palette-body" role="listbox">
          {['Produits', 'Commandes', 'Clients'].map(g => { const rows = hits.filter(h => h.group === g); if (!rows.length) return null; return <div className="fx-palette-group" key={g}><h4>{g}</h4>
            {rows.map(h => { i++; const k = i; const I = h.icon; return <button type="button" key={h.key} role="option" aria-selected={k === active} className="fx-palette-item" onMouseEnter={() => setActive(k)} onClick={h.go}><I /><span><b>{h.title}</b><small>{h.sub}</small></span></button>; })}
          </div>; })}
          {q.trim().length >= 2 && !hits.length && <div className="fx-palette-empty">Aucun résultat pour « {q.trim()} ».</div>}
          {q.trim().length < 2 && <div className="fx-palette-empty">Tapez au moins 2 lettres, un code-barres ou un numéro de commande.</div>}
        </div>
      </div>
    </div>, document.body)}
  </>;
}
