'use client';
import { useEffect, useState } from 'react';
import { Banknote, Clock3, HandCoins, ReceiptText, WalletCards } from 'lucide-react';
import { money } from '@/lib/format';

const KIND: Record<string, [string, any]> = { COD: ['Paiement à la livraison', Banknote], DUE: ['Ancien dû', HandCoins], RECEIPT: ['Saisi dans Ma caisse', ReceiptText] };

/** « Ma journée » : tout l'argent encaissé depuis l'ouverture de la journée, exactement comme le caissier le verra. */
export function DriverDayCash({ refresh = 0 }: { refresh?: number }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch('/api/delivery/shift', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, [refresh]);
  if (!d) return null;
  const c = d.cash, pending = d.pendingCashier, last = (d.recent || []).find((x: any) => x.status === 'CLOSED');
  if (!c) return <section className="dvc"><header><WalletCards size={18} /><div><b>Ma journée</b><small>Aucune journée ouverte. Démarrez votre journée sur l’écran Missions pour encaisser.</small></div></header>
    {last && <p className="dvc-last">Dernière remise : {money(last.remittedCod)} reçus par le caissier{Math.abs(Number(last.cashDifference || 0)) >= 0.001 ? ` · écart ${money(last.cashDifference)}` : ' · sans écart ✅'}</p>}</section>;
  return <section className={'dvc' + (pending ? ' is-pending' : '')}>
    <header><WalletCards size={18} /><div><b>{pending ? 'Recette remise · en attente du caissier' : 'Ma journée'}</b><small>Depuis {new Date(pending?.openedAt || d.current?.openedAt).toLocaleString('fr-TN', { dateStyle: 'short', timeStyle: 'short' })}</small></div><strong>{money(c.total)}</strong></header>
    <div className="dvc-split">
      <div><span>Livraisons</span><b>{money(c.cod)}</b></div>
      <div><span>Anciens dûs</span><b>{money(c.dues)}</b></div>
      <div><span>Ma caisse</span><b>{money(c.receipts)}</b></div>
    </div>
    {pending && <p className="dvc-note"><Clock3 size={14} /> Vous avez déclaré {money(pending.declaredRemit || 0)}. Le caissier compte et confirme{Math.abs(Number(pending.declaredRemit || 0) - c.total) >= 0.001 ? ` · différence avec l’attendu : ${money(Number(pending.declaredRemit || 0) - c.total)}` : ''}.</p>}
    {Number(c.startCash || 0) > 0 && <p className="dvc-note">Fond de caisse de départ : {money(c.startCash)} (non compté dans la recette).</p>}
    {c.lines.length > 0 ? <ul className="dvc-lines">{c.lines.slice().reverse().map((l: any) => { const [label, Icon] = KIND[l.kind]; return <li key={l.kind + l.id}>
      <Icon size={15} /><div><b>{l.shopName || label}</b><small>{label}{l.orderReference ? ' · ' + l.orderReference : ''} · {new Date(l.at).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}{l.status === 'PENDING' ? ' · à confirmer' : ''}</small></div><strong>{money(l.amount)}</strong></li>; })}</ul>
      : <p className="dvc-note">Aucun encaissement pour l’instant.</p>}
  </section>;
}
