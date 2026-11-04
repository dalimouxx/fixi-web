'use client';
import Link from 'next/link';
import {Banknote,History,Truck,WalletCards} from 'lucide-react';

/** Barre d'onglets du livreur, partagée entre les missions et la caisse. */
export function DriverTabs({active}:{active:'orders'|'dues'|'history'|'cash'}){
 return <nav className="dv-tabs" aria-label="Navigation livreur">
  <Link className={active==='orders'?'active':''} href="/delivery"><Truck size={22}/><span>Missions</span></Link>
  <Link className={active==='dues'?'active':''} href="/delivery?v=dues"><WalletCards size={22}/><span>Dus</span></Link>
  <Link className={active==='history'?'active':''} href="/delivery?v=history"><History size={22}/><span>Historique</span></Link>
  <Link className={active==='cash'?'active':''} href="/delivery/encaissements"><Banknote size={22}/><span>Ma caisse</span></Link>
 </nav>;
}
