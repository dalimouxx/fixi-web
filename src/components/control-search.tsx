'use client';
import { useEffect, useRef, useState } from 'react';
import { Factory, Search, Smartphone, Store, User, UserCog, Wrench } from 'lucide-react';
import { SupportAccessButton, SupportJournal } from './support-access';
import { AnnouncementsPanel, MaintenancePanel, WatchlistPanel } from './control-ops';
import type { SearchHit } from '@/lib/platform-search';

const META: Record<SearchHit['kind'], [string, any]> = {
  SHOP: ['Boutique', Store], SUPPLIER: ['Fournisseur', Factory], USER: ['Utilisateur atelier', UserCog],
  SUPPLIER_ACCOUNT: ['Compte fournisseur', User], CLIENT: ['Client', Smartphone], REPAIR: ['Réparation', Wrench],
};

/** Fixi Control → Recherche & support : tout retrouver et intervenir en un clic. */
export function ControlSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); return; }
    const n = ++seq.current; setBusy(true);
    const t = setTimeout(() => {
      fetch('/api/platform/search?q=' + encodeURIComponent(term), { cache: 'no-store' })
        .then(r => { if (r.status === 401) { location.href = '/saas/login'; return null; } return r.json(); })
        .then(j => { if (j && n === seq.current) setHits(j.hits || []); })
        .catch(() => { if (n === seq.current) setHits([]); })
        .finally(() => { if (n === seq.current) setBusy(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return <section className="control-content fx-control-search">
    <div className="section-toolbar"><div><h2>Support, suivi & diffusion</h2><p>Boutique, fournisseur, utilisateur, téléphone d’un client, code ou IMEI d’une réparation… puis « Accéder » pour régler le problème.</p></div></div>
    <div className="global-search fx-control-search-box"><Search /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Ex. : 22 123 456, Atelier Gabès, REP-2026-0042, 3569…" aria-label="Recherche globale" />{busy && <span className="fx-control-search-busy" aria-hidden />}</div>
    {hits && <div className="fx-control-hits">{hits.length === 0 ? <p className="muted">Aucun résultat pour « {q.trim()} ».</p> : hits.map(h => {
      const [label, Icon] = META[h.kind];
      const kind = h.shopId ? 'SHOP' : 'SUPPLIER';
      const target = h.shopId || h.companyId;
      return <article key={h.kind + h.id} className={'fx-control-hit' + (h.active === false ? ' is-off' : '')}>
        <span className="fx-control-hit-ico"><Icon size={18} /></span>
        <div><small>{label}{h.active === false ? ' · désactivé' : ''}</small><b>{h.title}</b><span>{h.subtitle}</span></div>
        {target && <SupportAccessButton kind={kind} id={target} name={h.targetName || h.title} compact defaultReason={h.kind === 'REPAIR' ? `Réparation ${h.title.split(' · ')[0]}` : undefined} />}
      </article>;
    })}</div>}
    <div className="control-grid"><WatchlistPanel /><MaintenancePanel /><AnnouncementsPanel /><SupportJournal /></div>
  </section>;
}
