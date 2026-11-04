import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, PackageSearch, Truck, Wallet, FileText } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { BrandLogo } from '@/components/brand-logo';
import { SignupForm } from '@/components/signup-form';
import './signup.css';

export const metadata: Metadata = { title: 'Créer mon atelier · Fixi', description: 'Inscription gratuite pour les ateliers de réparation : catalogue fournisseurs, commandes, livraisons et dettes.' };

const FREE = [
  { icon: PackageSearch, t: 'Catalogue des fournisseurs', d: 'Prix et stock des pièces, commande en quelques clics.' },
  { icon: Truck, t: 'Suivi des livraisons', d: 'Voyez où est votre commande, preuve de remise incluse.' },
  { icon: Wallet, t: 'Dettes et paiements', d: 'Ce que vous devez à chaque fournisseur, toujours à jour.' },
  { icon: FileText, t: 'Factures et retours', d: 'Tous vos documents fournisseurs au même endroit.' },
];

export default async function Inscription() {
  if (await getSession()) redirect('/app/suppliers');
  return <main className="su">
    <aside className="su-side">
      <div className="su-aurora"><i /><i /></div>
      <Link href="/" className="su-back"><ArrowLeft size={16} /> Accueil</Link>
      <div className="su-side-copy">
        <BrandLogo dark />
        <h1>Votre atelier sur Fixi,<br /><em>gratuitement.</em></h1>
        <p>Le compte est créé tout de suite avec l’offre <b>Fixi Connect</b>, gratuite et sans limite de durée.</p>
        <ul className="su-free">{FREE.map(({ icon: I, t, d }, i) => <li key={t} style={{ animationDelay: `${120 + i * 90}ms` }}><span><I size={18} /></span><div><b>{t}</b><small>{d}</small></div></li>)}</ul>
        <div className="su-upgrade"><Check size={15} /> Besoin des réparations, du stock et de la caisse ? Passez à une offre Pro quand vous voulez.</div>
      </div>
    </aside>
    <section className="su-main"><SignupForm /></section>
  </main>;
}
