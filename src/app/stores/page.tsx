import type { Metadata } from 'next';
import Link from 'next/link';
import { StoreLocator } from '@/components/store-locator';
import { ArrowLeft,ShieldCheck } from 'lucide-react';

export const metadata:Metadata={title:'Trouver une boutique',description:'Trouvez une boutique partenaire Fixi par région, ville ou service et contactez-la directement.'};
export default function StoresPage(){return <main className="stores-page"><header className="stores-public-nav"><Link href="/" className="stores-brand"><i>F</i><b>fixi</b></Link><Link href="/"><ArrowLeft/> Retour à Fixi</Link></header><div className="stores-hero"><span><ShieldCheck/> ANNUAIRE OFFICIEL FIXI</span><h1>Votre prochain atelier<br/><em>est peut-être juste à côté.</em></h1><p>Coordonnées, services, horaires et itinéraire des boutiques partenaires visibles sur le réseau Fixi.</p></div><StoreLocator/><footer className="stores-footer">Fixi · Smart Repair Business OS · Annuaire public</footer></main>}
