'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, MessageCircle, PackageOpen, Banknote, CheckCircle2, Clock3 } from 'lucide-react';
import { api } from './ui';
import { useI18n } from './language-provider';
import { money } from '@/lib/format';
import { waLink, waTemplate, type WaTemplateId } from '@/lib/whatsapp-link';

type Step = { title: string; hint: string; to?: string; label: string; href?: string; icon?: any };

// Une seule grosse action : la suivante. Les autres changements de statut restent
// disponibles plus bas dans « Toutes les étapes ».
export function RepairNextAction({ r, balance, role, settings, onChanged }: {
  r: any; balance: number; role: string; settings: any; onChanged: () => void;
}) {
  const { lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const canCash = role === 'ADMIN' || role === 'CASHIER';
  const canOrder = role === 'ADMIN' || role === 'RECEPTION';
  const currency = settings?.currency || 'DT';
  const device = [r.brand, r.model].filter(Boolean).join(' ');

  const steps: Record<string, Step> = {
    RECEIVED: { title: 'Appareil reçu', hint: 'Prochaine étape : le diagnostic.', to: 'DIAGNOSIS', label: 'Commencer le diagnostic' },
    DIAGNOSIS: { title: 'Diagnostic en cours', hint: 'Indiquez le prix ci-dessous, puis lancez la réparation.', to: 'IN_REPAIR', label: 'Lancer la réparation' },
    IN_REPAIR: { title: 'En réparation', hint: 'Quand c’est terminé, prévenez le client.', to: 'READY', label: 'Marquer comme prêt' },
    WAITING_PART: { title: 'En attente d’une pièce', hint: 'Dès que la pièce arrive, reprenez la réparation.', to: 'IN_REPAIR', label: 'Pièce reçue : reprendre' },
    READY: canCash && balance > 0
      ? { title: 'Prêt à rendre', hint: `Reste à encaisser : ${money(balance, currency)}.`, label: 'Encaisser et rendre', href: `/app/cashier?repair=${encodeURIComponent(r.code)}`, icon: Banknote }
      : { title: 'Prêt à rendre', hint: balance > 0 ? `Reste à encaisser : ${money(balance, currency)} (à la caisse).` : 'Tout est payé.', to: balance > 0 ? undefined : 'DELIVERED', label: 'Remettre au client' },
    DELIVERED: { title: 'Rendu au client', hint: 'Réparation terminée.', label: '' },
    CANCELLED: { title: 'Annulée', hint: 'Cette réparation est annulée.', label: '' },
  };
  const step = steps[r.status] || steps.RECEIVED;

  async function go(to: string) {
    setBusy(true); setErr('');
    try { await api(`/api/repairs/${r.code}/status`, { method: 'PATCH', body: JSON.stringify({ status: to }) }); onChanged(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const trackUrl = settings?.slug && r.publicToken ? `${origin}/track/${r.code}?shop=${encodeURIComponent(settings.slug)}&t=${r.publicToken}` : undefined;
  const vars = { client: r.client?.fullName || '', device, code: r.code, balance: balance > 0 ? money(balance, currency) : '', shop: settings?.name || '', trackUrl, price: r.finalPrice != null ? money(r.finalPrice, currency) : '' };
  const templates: { id: WaTemplateId; label: string; show: boolean }[] = [
    { id: 'received', label: 'Appareil reçu', show: ['RECEIVED', 'DIAGNOSIS'].includes(r.status) },
    { id: 'quote', label: 'Envoyer le prix', show: ['DIAGNOSIS', 'IN_REPAIR'].includes(r.status) && r.finalPrice != null },
    { id: 'waiting', label: 'Pièce commandée', show: r.status === 'WAITING_PART' },
    { id: 'ready', label: 'C’est prêt', show: r.status === 'READY' },
    { id: 'thanks', label: 'Merci + avis', show: r.status === 'DELIVERED' },
  ];
  const Icon = step.icon || (r.status === 'DELIVERED' ? CheckCircle2 : ArrowRight);

  return <section className="fx-next" aria-label="Prochaine action">
    <div className="fx-next-copy"><span>ÉTAPE ACTUELLE</span><b>{step.title}</b><small>{step.hint}</small>{err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}</div>
    <div className="fx-next-actions">
      {step.href && <Link href={step.href} className="btn btn-primary"><Icon size={19} />{step.label}</Link>}
      {!step.href && step.to && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => go(step.to!)}>{busy ? 'Un instant…' : step.label}<Icon size={19} /></button>}
      {['DIAGNOSIS', 'IN_REPAIR'].includes(r.status) && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => go('WAITING_PART')}><Clock3 size={18} /> Attente pièce</button>}
      {r.status === 'WAITING_PART' && canOrder && <Link className="btn btn-soft" href={`/app/suppliers?q=${encodeURIComponent(r.model || '')}`}><PackageOpen size={18} /> Commander chez mon fournisseur</Link>}
    </div>
    {r.client?.phone && <div className="fx-wa" style={{ width: '100%' }}>
      {templates.filter(t => t.show).map(t => <a key={t.id} href={waLink(r.client.phone, waTemplate(t.id, vars, lang))} target="_blank" rel="noreferrer"><MessageCircle size={17} /> WhatsApp : {t.label}</a>)}
    </div>}
  </section>;
}
