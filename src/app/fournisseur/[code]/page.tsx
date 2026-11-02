import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BellRing, PackageCheck, Truck, WalletCards } from 'lucide-react';
import { SupplierInviteForm } from './form';

export const metadata: Metadata = { title: 'Rejoindre Fixi Fournisseur', robots: { index: false, follow: false }, openGraph: { title: 'Vos clients réparateurs commandent sur Fixi', images: ['/icons/supplier-512.png'] } };

// Page reçue par WhatsApp par le fournisseur invité.
export default async function SupplierInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inv = await prisma.supplierInvite.findUnique({ where: { code }, include: { inviterShop: { select: { name: true, city: true } } } }).catch(() => null);
  if (!inv) notFound();
  const perks = [
    { icon: BellRing, t: 'Chaque commande sonne', d: 'Alerte claire sur le téléphone, confirmation en un geste.' },
    { icon: PackageCheck, t: 'Votre catalogue chez vos clients', d: 'Photos, prix et stock visibles par les ateliers du réseau.' },
    { icon: Truck, t: 'Livraison suivie', d: 'Vos livreurs et vos clients suivent chaque course.' },
    { icon: WalletCards, t: 'Dettes et encaissements', d: 'Chaque paiement reste lié à sa facture.' },
  ];
  return <main className="fx-invite">
    <header className="fx-invite-head">
      <img src="/icons/supplier-192.png" alt="" width={64} height={64} />
      <p className="fx-invite-kicker">Invitation de {inv.inviterShop.name}{inv.inviterShop.city ? ` · ${inv.inviterShop.city}` : ''}</p>
      <h1>Recevez les commandes de vos réparateurs sur Fixi</h1>
      <p>{inv.inviterShop.name} commande déjà ses pièces avec Fixi. Demandez votre espace fournisseur : l’équipe Fixi vous rappelle et l’ouvre avec vous.</p>
    </header>
    <ul className="fx-invite-perks">{perks.map(p => <li key={p.t}><p.icon /><span><b>{p.t}</b><small>{p.d}</small></span></li>)}</ul>
    <SupplierInviteForm code={code} done={inv.status === 'REQUESTED' || inv.status === 'CONVERTED'} defaultCompany={inv.supplierName} defaultPhone={inv.supplierPhone || ''} />
    <footer className="fx-invite-foot">Fixi · logiciel des ateliers de réparation et de leurs fournisseurs</footer>
  </main>;
}
