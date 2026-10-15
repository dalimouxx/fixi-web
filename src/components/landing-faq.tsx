'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
const items=[
 ['Fixi fonctionne-t-il sur téléphone et tablette ?','Oui. Fixi est une plateforme Web responsive et PWA : PC, tablette et smartphone utilisent le même système.'],
 ['Puis-je gérer plusieurs boutiques ?','Oui. Fixi Network et Fixi Control centralisent plusieurs boutiques, leurs utilisateurs, performances et abonnements.'],
 ['Le client doit-il créer un compte ?','Non. Le suivi réparation utilise un lien privé sécurisé avec QR code.'],
 ['Puis-je utiliser D17, Flouci, carte et espèces ?','Oui. Cash Pro gère plusieurs modes de paiement et même des paiements combinés dans un même encaissement.'],
 ['WhatsApp est-il obligatoire ?','Non. Fixi fonctionne sans WhatsApp Cloud. Si l’API officielle est configurée, les messages peuvent être envoyés directement depuis la plateforme.'],
 ['Mes boutiques doivent-elles apparaître dans l’annuaire ?','Non. La visibilité publique est contrôlée boutique par boutique depuis Fixi Control.'],
];
export function LandingFaq(){const[a,setA]=useState<number|null>(0);return <section className="faq-v7" id="faq"><div className="section-heading-v4"><span>FAQ</span><h2>Les questions<br/><em>avant de passer à Fixi.</em></h2></div><div className="faq-v7-list">{items.map((x,i)=><article key={x[0]} className={a===i?'open':''}><button onClick={()=>setA(a===i?null:i)}><span>{x[0]}</span><ChevronDown/></button>{a===i&&<p>{x[1]}</p>}</article>)}</div></section>}
