'use client';
import { useState } from 'react';
import { BarChart3,CreditCard,Headphones,ShieldCheck,UserRound,Wrench } from 'lucide-react';
const roles=[
 ['Gérant',BarChart3,'Pilotez sans fouiller dans 10 écrans.','CA, bénéfice, alertes, équipe, stock, objectifs et vue propriétaire mobile.',['Dashboard exécutif','Insights & anomalies','Contrôle des permissions']],
 ['Réception',Headphones,'Accueillez vite, sans ressaisie.','Client reconnu, caméra, Smart Diagnostic, devis et affectation technicien.',['Recherche client instantanée','Photos avant réparation','Prix & durée suggérés']],
 ['Technicien',Wrench,'Concentrez-vous sur la réparation.','Mes dossiers, checklist qualité, pièces utilisées, photos et historique.',['Vue personnelle','Stock connecté','Contrôle qualité']],
 ['Caissier',CreditCard,'Encaissez en quelques secondes.','Cash Pro, scan, paiement combiné, remises contrôlées et reçu.',['Paiements multiples','Clôture de caisse','Raccourcis clavier']],
 ['Client',UserRound,'Suivez sans appeler l’atelier.','État, devis, paiement, garantie, historique et avis depuis un lien privé.',['Suivi QR privé','Validation du devis','Paiement en ligne']],
];
export function LandingRoleShowcase(){const[a,setA]=useState(0);const r=roles[a];const I:any=r[1];return <section className="role-showcase-v7"><div className="section-heading-v4"><span>UNE EXPÉRIENCE PAR RÔLE</span><h2>Chacun voit exactement<br/><em>ce dont il a besoin.</em></h2></div><div className="role-v7-wrap"><div className="role-v7-tabs">{roles.map((x,i)=><button key={String(x[0])} className={i===a?'active':''} onClick={()=>setA(i)}>{String(x[0])}</button>)}</div><div className="role-v7-card"><div className="role-v7-icon"><I/></div><div><span>{String(r[0]).toUpperCase()}</span><h3>{String(r[2])}</h3><p>{String(r[3])}</p><div className="role-v7-points">{(r[4] as string[]).map(x=><b key={x}><ShieldCheck/>{x}</b>)}</div></div></div></div></section>}
