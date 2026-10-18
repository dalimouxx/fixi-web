import Link from 'next/link';
import { CheckCircle2, LockKeyhole, PackageOpen, Sparkles, Truck, WalletCards, Wrench, ArrowRight } from 'lucide-react';

export default function FixiUpgradePage() {
  const free = [
    'Catalogue des fournisseurs et commandes sans abonnement',
    'Suivi des livraisons et bons de réception',
    'Factures, dettes et paiements, même après expiration d’un abonnement',
    'Historique, retours et justificatifs disponibles',
  ];
  const premium = [
    'Réception express des réparations et gestion clients',
    'Stock atelier, caisse et documents de vente',
    'Statistiques, équipe et modules avancés selon votre offre',
  ];
  return <main className="page" style={{maxWidth:1050,margin:'0 auto',paddingBottom:60}}>
    <div className="page-head">
      <div><div className="smart-kicker"><Sparkles size={14}/> FIXI FREEMIUM</div>
        <h1>Commandez gratuitement. Développez votre atelier avec Fixi Pro.</h1>
        <p>Fixi Connect reste accessible pour vos fournisseurs et vos livraisons. Aucun historique n’est effacé si votre abonnement Pro prend fin.</p>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:18,marginTop:24}}>
      <section className="card card-pad" style={{borderRadius:18}}>
        <div className="smart-kicker"><PackageOpen size={15}/> FIXI CONNECT</div>
        <h2 style={{fontSize:30,margin:'16px 0 7px'}}>Gratuit</h2>
        <p style={{color:'var(--muted,#777)',fontSize:13}}>Pour commander des pièces téléphoniques et suivre ses fournisseurs.</p>
        <div style={{display:'grid',gap:12,margin:'22px 0'}}>
          {free.map(s=><div key={s} style={{display:'flex',gap:10,fontSize:13,alignItems:'flex-start'}}>
            <CheckCircle2 color="#179964" size={17}/>{s}</div>)}
        </div>
        <Link className="btn btn-soft btn-block" href="/app/suppliers"><Truck size={16}/> Accéder à mes commandes</Link>
      </section>
      <section className="card card-pad" style={{border:'1px solid #f39a57',borderRadius:18}}>
        <div className="smart-kicker"><Wrench size={15}/> FIXI PRO / BUSINESS</div>
        <h2 style={{fontSize:30,margin:'16px 0 7px'}}>Offres professionnelles</h2>
        <p style={{color:'var(--muted,#777)',fontSize:13}}>Tarifs et modules configurés depuis l’administration Fixi.</p>
        <div style={{display:'grid',gap:12,margin:'22px 0'}}>
          {premium.map(s=><div key={s} style={{display:'flex',gap:10,fontSize:13,alignItems:'flex-start'}}>
            <CheckCircle2 color="#f07519" size={17}/>{s}</div>)}
        </div>
        <Link className="btn btn-primary btn-block" href="/app/subscription"><Sparkles size={16}/> Voir les offres et demander Pro <ArrowRight size={15}/></Link>
      </section>
    </div>
    <div className="card card-pad" style={{marginTop:20,display:'flex',alignItems:'center',gap:12,borderRadius:15}}>
      <LockKeyhole size={19}/><div><strong>Vos données sont préservées</strong>
      <p style={{margin:'5px 0 0',fontSize:13}}>Un retour vers Fixi Connect désactive uniquement les outils payants.
      Les commandes, paiements et documents fournisseurs restent visibles.</p></div>
    </div>
  </main>;
}
