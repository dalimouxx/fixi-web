'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, MapPin, PackageCheck, Rocket, ShoppingCart, Sparkles, Truck, UserPlus, X } from 'lucide-react';
import { InviteSupplierButton } from './invite-supplier';
import { TrialButton } from './trial-button';

type Data = { steps: { key: string; done: boolean }[]; done: number; total: number; pct: number; trialAvailable: boolean; shop: { address: string; city: string; phone: string } };
const TXT: Record<string, { t: string; d: string; icon: any }> = {
  account: { t: 'Compte créé', d: 'Votre atelier est sur Fixi.', icon: Check },
  address: { t: 'Adresse de livraison', d: 'Pour que les livreurs vous trouvent du premier coup.', icon: MapPin },
  order: { t: 'Première commande', d: 'Choisissez vos pièces dans le catalogue des fournisseurs.', icon: ShoppingCart },
  invite: { t: 'Inviter votre fournisseur habituel', d: 'Il n’est pas encore sur Fixi ? Envoyez-lui l’invitation.', icon: UserPlus },
  delivery: { t: 'Première livraison reçue', d: 'Confirmez la réception avec le code de livraison.', icon: Truck },
  pro: { t: 'Essayer Fixi Pro', d: 'Réparations, stock et caisse pour tout l’atelier.', icon: Sparkles },
};
const HIDE = 'fixi-connect-start-hidden';

export function ConnectGettingStarted({ onShop }: { onShop?: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<string>('');
  const [hidden, setHidden] = useState(true);
  const [addr, setAddr] = useState<{ address: string; city: string; phone: string; latitude?: number; longitude?: number }>({ address: '', city: '', phone: '' });const [gps, setGps] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => fetch('/api/connect/getting-started', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(x => { if (!x) return; setD(x); setAddr(x.shop); setOpen(o => o || x.steps.find((s: any) => !s.done)?.key || ''); });
  useEffect(() => { try { setHidden(localStorage.getItem(HIDE) === '1'); } catch { setHidden(false); } void load(); }, []);
  if (!d || hidden || d.done === d.total) return null;

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await fetch('/api/connect/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(addr) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Enregistrement impossible'); setOpen(''); await load(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return <section className="gs" aria-label="Premiers pas">
    <header className="gs-head">
      <div className="gs-ring" style={{ ['--p' as any]: d.pct }}><Rocket size={18} /></div>
      <div><b>Premiers pas</b><span>{d.done} sur {d.total} · encore {d.total - d.done} étape{d.total - d.done > 1 ? 's' : ''} pour bien démarrer</span></div>
      <button className="gs-x" aria-label="Masquer les premiers pas" onClick={() => { try { localStorage.setItem(HIDE, '1'); } catch {} setHidden(true); }}><X size={16} /></button>
    </header>
    <div className="gs-bar"><i style={{ width: d.pct + '%' }} /></div>
    <ol className="gs-list">{d.steps.filter(s => s.key !== 'pro' || d.trialAvailable || s.done).map(s => { const T = TXT[s.key]; const I = T.icon; const isOpen = open === s.key && !s.done; return <li key={s.key} className={(s.done ? 'is-done' : '') + (isOpen ? ' is-open' : '')}>
      <button className="gs-row" onClick={() => !s.done && setOpen(isOpen ? '' : s.key)} aria-expanded={isOpen} disabled={s.done}>
        <span className="gs-ico">{s.done ? <Check size={15} strokeWidth={3} /> : <I size={16} />}</span>
        <span className="gs-txt"><b>{T.t}</b>{!s.done && <small>{T.d}</small>}</span>
        {!s.done && <ChevronDown size={16} className="gs-chev" />}
      </button>
      {isOpen && <div className="gs-body">
        {s.key === 'address' && <form className="gs-form" onSubmit={saveAddress}>
          <input value={addr.address} onChange={e => setAddr({ ...addr, address: e.target.value })} placeholder="Rue, numéro, repère (ex. à côté de la pharmacie)" maxLength={200} />
          <div><input value={addr.city} onChange={e => setAddr({ ...addr, city: e.target.value })} placeholder="Ville" maxLength={80} /><input value={addr.phone} onChange={e => setAddr({ ...addr, phone: e.target.value })} placeholder="Téléphone" inputMode="tel" /></div>
          <button type="button" className="btn btn-ghost btn-sm gs-gps" onClick={() => { if (!navigator.geolocation) { setGps('Position indisponible sur cet appareil'); return; } setGps('Localisation…'); navigator.geolocation.getCurrentPosition(p => { setAddr(a => ({ ...a, latitude: p.coords.latitude, longitude: p.coords.longitude })); setGps('Position de la boutique enregistrée : le livreur vous trouvera et vous serez prévenu de son arrivée.'); }, () => setGps('Autorisez la localisation, ou laissez seulement l’adresse.'), { enableHighAccuracy: true, timeout: 10000 }); }}><MapPin size={15} /> Je suis à la boutique : utiliser ma position</button>
          {gps && <p className="gs-note">{gps}</p>}
          {err && <p className="gs-err">{err}</p>}
          <button className="btn btn-primary btn-sm" disabled={busy}><Check size={15} /> Enregistrer</button>
        </form>}
        {s.key === 'order' && <button className="btn btn-primary btn-sm" onClick={() => { onShop?.(); document.querySelector('.market-search, input[type=search], .global-search input')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><ShoppingCart size={15} /> Voir le catalogue</button>}
        {s.key === 'invite' && <InviteSupplierButton />}
        {s.key === 'delivery' && <p className="gs-note"><PackageCheck size={15} /> À l’arrivée du livreur, donnez-lui le code affiché dans « Mes commandes ».</p>}
        {s.key === 'pro' && <div className="gs-pro"><TrialButton /><Link href="/app/upgrade" className="btn btn-ghost btn-sm">Voir ce qui est inclus</Link></div>}
      </div>}
    </li>; })}</ol>
  </section>;
}
