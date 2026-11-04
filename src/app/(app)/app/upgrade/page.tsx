import Link from 'next/link';
import { ArrowRight, BarChart3, Boxes, CheckCircle2, LockKeyhole, PackageOpen, ReceiptText, Sparkles, Truck, Users, Wrench } from 'lucide-react';
import { TrialButton } from '@/components/trial-button';

const MODULES = [
  { match: ['/app/repairs', '/app/clients', '/app/warranties', '/app/appointments', '/app/compatibility'], icon: Wrench, name: 'Réparations', lines: ['Fiche de réception en 30 secondes, photo et code de suivi', 'Le client suit sa réparation et reçoit « prêt » sur WhatsApp', 'Garanties, devis et historique de chaque client'] },
  { match: ['/app/stock', '/app/purchases', '/app/inventory'], icon: Boxes, name: 'Stock', lines: ['Pièces liées aux réparations, déduites automatiquement', 'Alerte de rupture et commande fournisseur en un clic', 'Valeur du stock et pièces qui dorment'] },
  { match: ['/app/cashier', '/app/cash-sessions', '/app/fin-de-journee', '/app/expenses', '/app/documents'], icon: ReceiptText, name: 'Caisse', lines: ['Encaissement, ticket et facture', 'Clôture de caisse et fin de journée', 'Dépenses et documents de vente'] },
  { match: ['/app/dashboard', '/app/insights', '/app/rapport-mensuel'], icon: BarChart3, name: 'Tableau de bord', lines: ['Chiffre du jour, marge et réparations en cours', 'Rapport du mois prêt à partager', 'Conseils pour gagner plus par réparation'] },
  { match: ['/app/team', '/app/settings'], icon: Users, name: 'Équipe', lines: ['Un code PIN par employé et des écrans par rôle', 'Réception, technicien, caissier', 'Qui a fait quoi, à quelle heure'] },
];

export default async function FixiUpgradePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from = '' } = await searchParams;
  const safeFrom = from.startsWith('/app/') && !from.startsWith('/app/upgrade') ? from : '';
  const focus = MODULES.find(m => m.match.some(x => safeFrom.startsWith(x)));
  const ordered = focus ? [focus, ...MODULES.filter(m => m !== focus)] : MODULES;
  const free = ['Catalogue des fournisseurs et commandes', 'Suivi des livraisons et preuve de réception', 'Factures, dettes et paiements fournisseurs', 'Historique conservé, même après un abonnement Pro'];
  return <main className="page upg">
    <section className="upg-hero">
      <div className="upg-hero-copy">
        <div className="smart-kicker"><LockKeyhole size={14} /> {focus ? `MODULE ${focus.name.toUpperCase()}` : 'FIXI PRO'}</div>
        <h1>{focus ? <>« {focus.name} » fait partie de Fixi Pro.</> : <>Tout l’atelier dans Fixi Pro.</>}</h1>
        <p>Essayez gratuitement avec vos vraies réparations. Aucun paiement demandé : à la fin de l’essai, votre atelier revient à l’offre gratuite et rien n’est effacé.</p>
        <div className="upg-cta"><TrialButton big next={safeFrom || '/app/dashboard'} /><Link className="btn btn-ghost" href="/app/subscription">Voir les offres <ArrowRight size={15} /></Link></div>
      </div>
      {focus && <div className="upg-preview" aria-hidden="true"><div className="upg-preview-card"><focus.icon size={22} /><b>{focus.name}</b>{focus.lines.map((l, i) => <span key={l} style={{ animationDelay: i * 120 + 'ms' }}><CheckCircle2 size={15} /> {l}</span>)}</div></div>}
    </section>
    <section className="upg-grid">{ordered.map(m => <article key={m.name} className={'upg-mod' + (m === focus ? ' is-focus' : '')}><m.icon size={20} /><h3>{m.name}</h3><ul>{m.lines.map(l => <li key={l}><CheckCircle2 size={15} /> {l}</li>)}</ul></article>)}</section>
    <section className="upg-free">
      <div><div className="smart-kicker"><PackageOpen size={14} /> FIXI CONNECT · GRATUIT</div><h2>Ce qui reste gratuit, toujours</h2></div>
      <ul>{free.map(s => <li key={s}><CheckCircle2 size={16} /> {s}</li>)}</ul>
      <Link className="btn btn-soft" href="/app/suppliers"><Truck size={16} /> Mes commandes fournisseurs</Link>
    </section>
    <p className="upg-foot"><Sparkles size={14} /> Un seul essai par atelier. Vous pouvez demander une offre Pro à tout moment depuis « Mon abonnement ».</p>
  </main>;
}
