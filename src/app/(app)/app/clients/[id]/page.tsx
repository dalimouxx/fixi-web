'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Phone, MessageCircle, PlusCircle, WalletCards, ExternalLink, Smartphone, FileText, ShieldCheck, Gift, Wrench } from 'lucide-react';
import { StatusBadge, useApi } from '@/components/ui';
import { dateOnly, money } from '@/lib/format';
import { waLink } from '@/lib/whatsapp-link';
import { ClientBilling } from '@/components/client-billing';

const docLabels: Record<string, string> = { QUOTE: 'Devis', INVOICE: 'Facture', CREDIT_NOTE: 'Avoir', RECEIPT: 'Reçu' };

// Fiche client complète : qui il est, ce qu'il doit, ses appareils, réparations,
// factures et garanties, avec les actions du quotidien en haut.
export default function ClientDetail() {
  const p = useParams<{ id: string }>();
  const { data: c, error } = useApi<any>(`/api/clients/${p.id}`);
  if (error) return <div className="fx-page"><div className="error">{error}</div></div>;
  if (!c) return <div className="fx-page"><div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /><i /></div></div>;
  const due = (c.repairs || []).reduce((a: number, r: any) => a + Number(r.balance || 0), 0);
  const warranties = (c.repairs || []).filter((r: any) => r.warrantyActive);
  const docs = c.salesDocuments || [];
  return <div className="fx-page">
    <header className="fx-client-head">
      <span className="fx-client-avatar" aria-hidden="true">{String(c.fullName || '?').split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
      <div className="fx-client-id"><h1>{c.fullName}</h1><p>{c.phone}{c.email ? ` · ${c.email}` : ''} · client depuis {dateOnly(c.createdAt)}</p></div>
      <div className="fx-client-actions">
        <a className="btn btn-ghost" href={`tel:${c.phone}`}><Phone size={18} /> Appeler</a>
        <a className="btn btn-ghost" href={waLink(c.phone, `Bonjour ${c.fullName},`)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
        <Link className="btn btn-primary" href={`/app/repairs/new?phone=${encodeURIComponent(c.phone)}`}><PlusCircle size={18} /> Nouvelle réparation</Link>
      </div>
    </header>

    <section className="fx-kpis" aria-label="Résumé du client">
      <div className="fx-kpi"><Wrench /><div><span>Réparations</span><strong>{c.repairs.length}</strong></div></div>
      <div className={`fx-kpi ${due > 0 ? 'fx-kpi--due' : ''}`}><WalletCards /><div><span>Reste à payer</span><strong>{money(due)}</strong></div></div>
      <div className="fx-kpi"><Gift /><div><span>Fidélité</span><strong>{c.loyaltyPoints || 0} pts</strong></div></div>
    </section>

    <ClientBilling client={c} />

    {c.devices?.length > 0 && <section className="fx-panel" style={{ marginTop: 12 }}>
      <div className="fx-panel-head"><h2>Appareils connus</h2></div>
      <div className="fx-chips">{c.devices.map((d: any, i: number) => <span key={i} className="fx-chip"><Smartphone size={15} /> {typeof d === 'string' ? d : [d.brand, d.model].filter(Boolean).join(' ')}</span>)}</div>
    </section>}

    <section className="fx-panel" style={{ marginTop: 12 }}>
      <div className="fx-panel-head"><h2>Réparations</h2><Link className="btn btn-ghost btn-sm" target="_blank" href={`/wallet/${c.walletToken}`}><ExternalLink size={15} /> Espace client</Link></div>
      <div className="fx-list">
        {c.repairs.map((r: any) => <Link key={r.id} href={`/app/repairs/${r.code}`} className="fx-row">
          <Smartphone /><span className="fx-row-main"><b>{[r.brand, r.model].filter(Boolean).join(' ')} · {r.reportedIssue}</b><small>{r.code} · {dateOnly(r.createdAt)}{r.finalPrice != null ? ` · ${money(r.finalPrice)}` : ''}{Number(r.balance) > 0 ? ` · reste ${money(r.balance)}` : ''}</small></span><StatusBadge status={r.status} />
        </Link>)}
        {!c.repairs.length && <div className="fx-empty"><b>Aucune réparation</b><span>Enregistrez la première pour ce client.</span></div>}
      </div>
    </section>

    <div className="fx-grid-2">
      <section className="fx-panel">
        <div className="fx-panel-head"><h2>Devis & factures</h2></div>
        <div className="fx-list">
          {docs.map((d: any) => <Link key={d.id} href={`/app/documents/${d.id}`} className="fx-row"><FileText /><span className="fx-row-main"><b>{docLabels[d.type] || d.type} {d.number}</b><small>{dateOnly(d.createdAt)} · {money(d.total)}</small></span></Link>)}
          {!docs.length && <div className="fx-empty fx-empty--small"><span>Aucun devis ni facture.</span></div>}
        </div>
      </section>
      <section className="fx-panel">
        <div className="fx-panel-head"><h2>Garanties actives</h2></div>
        <div className="fx-list">
          {warranties.map((r: any) => <Link key={r.id} href={`/app/repairs/${r.code}`} className="fx-row fx-row--ok"><ShieldCheck /><span className="fx-row-main"><b>{[r.brand, r.model].filter(Boolean).join(' ')}</b><small>jusqu’au {dateOnly(r.warrantyExpiresAt)}</small></span></Link>)}
          {!warranties.length && <div className="fx-empty fx-empty--small"><span>Aucune garantie en cours.</span></div>}
        </div>
      </section>
    </div>

    {c.notes && <section className="fx-panel" style={{ marginTop: 12 }}><div className="fx-panel-head"><h2>Notes</h2></div><p className="muted" style={{ margin: 0 }}>{c.notes}</p></section>}
  </div>;
}
