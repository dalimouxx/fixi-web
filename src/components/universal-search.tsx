'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Smartphone, UserRound, Boxes, FileText, CornerDownLeft, PlusCircle, Banknote, PackageOpen, X } from 'lucide-react';
import { StatusBadge } from './ui';
import type { NavSection } from '@/lib/nav-atelier';
import { itemLabel } from '@/lib/nav-atelier';

type Result = { key: string; href: string; icon: any; title: string; sub?: string; status?: string; group: string };

// Ouverte au clavier (Ctrl K) ou par la barre de recherche : aucune animation d'ouverture.
export function UniversalSearch({ open, onClose, sections, role }: {
  open: boolean; onClose: () => void; sections: NavSection[]; role: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(''); setData(null); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setData(null); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch('/api/search?q=' + encodeURIComponent(term), { signal: ctrl.signal, cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null)).then(setData).catch(() => {}).finally(() => setLoading(false));
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const out: Result[] = [];
    if (!term) {
      const quick = [
        { href: '/app/repairs/new', icon: PlusCircle, title: 'Nouvelle réparation', sub: 'Enregistrer un appareil' },
        { href: '/app/cashier', icon: Banknote, title: 'Encaisser', sub: 'Rendre un appareil prêt' },
        { href: '/app/suppliers', icon: PackageOpen, title: 'Commander une pièce', sub: 'Chez vos fournisseurs' },
      ];
      const allowed = new Set(sections.flatMap(s => s.items.map(i => i.href)));
      quick.filter(x => allowed.has(x.href)).forEach(x => out.push({ ...x, key: 'q' + x.href, group: 'Actions rapides' }));
      return out;
    }
    for (const r of data?.repairs || []) out.push({ key: 'r' + r.code, href: `/app/repairs/${r.code}`, icon: Smartphone, title: `${[r.brand, r.model].filter(Boolean).join(' ')} · ${r.code}`, sub: `${r.client?.fullName || ''} · ${r.client?.phone || ''}`, status: r.status, group: 'Réparations' });
    for (const c of data?.clients || []) out.push({ key: 'c' + c.id, href: `/app/clients/${c.id}`, icon: UserRound, title: c.fullName, sub: c.phone, group: 'Clients' });
    for (const i of data?.items || []) out.push({ key: 'i' + i.id, href: `/app/stock?q=${encodeURIComponent(i.name)}`, icon: Boxes, title: i.name, sub: `Réf. ${i.sku} · ${i.quantity} en stock`, group: 'Pièces en stock' });
    for (const d of data?.documents || []) out.push({ key: 'd' + d.id, href: `/app/documents/${d.id}`, icon: FileText, title: d.number, sub: d.client?.fullName, group: 'Devis & factures' });
    for (const s of sections) for (const item of s.items) {
      const label = itemLabel(item, role);
      if (label.toLowerCase().includes(term) || s.label.toLowerCase().includes(term))
        out.push({ key: 'n' + item.href, href: item.href, icon: item.icon, title: label, sub: s.label + (item.advanced ? ' · Mode Avancé' : ''), group: 'Écrans' });
    }
    return out;
  }, [q, data, sections, role]);

  useEffect(() => { setActive(0); }, [results.length]);
  if (!open) return null;

  function go(r?: Result) {
    if (!r) { const term = q.trim(); if (term) { onClose(); router.push('/app/repairs?q=' + encodeURIComponent(term)); } return; }
    onClose(); router.push(r.href);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') onClose();
  }
  const groups = results.reduce<Record<string, Result[]>>((acc, r) => { (acc[r.group] ||= []).push(r); return acc; }, {});
  let index = -1;
  return <div className="fx-palette-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="fx-palette" role="dialog" aria-modal="true" aria-label="Recherche">
      <div className="fx-palette-input">
        <Search size={20} />
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Téléphone, code, IMEI, client, pièce, facture…" aria-label="Rechercher dans Fixi" role="combobox" aria-expanded="true" aria-controls="fx-search-results" />
        <button type="button" className="fx-icon-btn" onClick={onClose} aria-label="Fermer la recherche"><X size={18} /></button>
      </div>
      <div className="fx-palette-body" id="fx-search-results" role="listbox">
        {Object.entries(groups).map(([group, rows]) => <div className="fx-palette-group" key={group}>
          <h4>{group}</h4>
          {rows.map(r => { index++; const i = index; const Icon = r.icon; return <button type="button" key={r.key} role="option" aria-selected={i === active}
            className="fx-palette-item" onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
            <Icon /><span style={{ minWidth: 0 }}><b>{r.title}</b>{r.sub && <small>{r.sub}</small>}</span>{r.status && <StatusBadge status={r.status} />}
          </button>; })}
        </div>)}
        {q.trim().length >= 2 && !loading && !results.length && <div className="fx-palette-empty">Aucun résultat pour « {q.trim()} ». Essayez le téléphone du client ou le code du ticket.</div>}
        {loading && !results.length && <div className="fx-palette-empty">Recherche…</div>}
      </div>
      <div className="fx-palette-hint"><span>↑ ↓ pour choisir</span><span><CornerDownLeft size={12} /> pour ouvrir</span><span>Échap pour fermer</span></div>
    </div>
  </div>;
}
