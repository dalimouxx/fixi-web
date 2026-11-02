'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Users, Wrench, Star, Phone, MessageCircle, ChevronRight, PlusCircle } from 'lucide-react';
import { useApi } from '@/components/ui';
import { money } from '@/lib/format';
import { waLink } from '@/lib/whatsapp-link';

const initials = (n: string) => String(n || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();

// Clients : on cherche par nom ou téléphone, on appelle ou on écrit en un toucher.
export default function Clients() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'value' | 'repairs'>('recent');
  const { data, loading, error } = useApi<any[]>(`/api/clients?q=${encodeURIComponent(q)}`);
  const rows = useMemo(() => [...(data || [])].sort((a, b) => sort === 'value' ? Number(b.totalValue) - Number(a.totalValue) : sort === 'repairs' ? Number(b.repairCount) - Number(a.repairCount) : +new Date(b.updatedAt) - +new Date(a.updatedAt)), [data, sort]);
  const totalValue = rows.reduce((a, c) => a + Number(c.totalValue || 0), 0);
  const loyal = rows.filter(c => Number(c.loyaltyPoints || 0) > 0).length;

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Clients</h1><p>Tous vos clients, leurs réparations et leur fidélité.</p></div>
      <Link href="/app/repairs/new" className="btn btn-primary"><PlusCircle size={18} /> Nouvelle réparation</Link></div>

    <section className="fx-kpis" aria-label="Résumé des clients">
      <div className="fx-kpi"><Users /><div><span>Clients</span><strong>{rows.length}</strong></div></div>
      <div className="fx-kpi"><Star /><div><span>Fidèles</span><strong>{loyal}</strong></div></div>
      <div className="fx-kpi"><Wrench /><div><span>Valeur totale</span><strong>{money(totalValue)}</strong></div></div>
    </section>

    <div className="fx-toolbar">
      <div className="fx-searchbar"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou téléphone…" aria-label="Rechercher un client" inputMode="search" /></div>
      <div className="fx-filter-chips" role="group" aria-label="Trier">
        {([['recent', 'Récents'], ['value', 'Meilleurs clients'], ['repairs', 'Plus de réparations']] as const).map(([k, l]) => <button type="button" key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
      </div>
    </div>

    {error && <div className="error">{error}</div>}
    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div> :
      <div className="fx-list">
        {rows.map(c => <div key={c.id} className="fx-row fx-client-row">
          <span className="fx-avatar-sm" aria-hidden="true">{initials(c.fullName)}</span>
          <Link href={`/app/clients/${c.id}`} className="fx-row-main"><b>{c.fullName}</b><small><span className="mono">{c.phone}</span> · {c.repairCount} réparation{Number(c.repairCount) > 1 ? 's' : ''}{Number(c.totalValue) > 0 ? ` · ${money(c.totalValue)}` : ''}{Number(c.loyaltyPoints) > 0 ? ` · ★ ${c.loyaltyPoints} pts` : ''}</small></Link>
          <a className="fx-icon-btn" href={`tel:${c.phone}`} aria-label={`Appeler ${c.fullName}`}><Phone size={18} /></a>
          <a className="fx-icon-btn fx-wa" href={waLink(c.phone, `Bonjour ${c.fullName},`)} target="_blank" rel="noreferrer" aria-label={`WhatsApp à ${c.fullName}`}><MessageCircle size={18} /></a>
          <Link href={`/app/clients/${c.id}`} className="fx-row-chevron" aria-hidden="true" tabIndex={-1}><ChevronRight size={18} className="fx-flip" /></Link>
        </div>)}
        {!rows.length && <div className="fx-empty"><b>{q ? 'Aucun client trouvé' : 'Aucun client'}</b><span>{q ? 'Essayez un autre nom ou numéro.' : 'Chaque nouvelle réparation crée la fiche du client.'}</span></div>}
      </div>}
  </div>;
}
