'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Wrench, Wifi, WifiOff } from 'lucide-react';
import { AdSlot } from '@/components/ad-slot';

const labels: Record<string, string> = { RECEIVED: 'Reçu', DIAGNOSIS: 'Diagnostic', IN_REPAIR: 'En réparation', WAITING_PART: 'Attente pièce', READY: 'Prêt' };

// Écran d'attente (TV de la boutique) : lisible à 5 mètres. À gauche ce qui est prêt,
// à droite ce qui est en cours, avec les couleurs de statut de l'atelier.
export default function Queue() {
  const [data, setData] = useState<any>(null);
  const [shop, setShop] = useState('');
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let alive = true;
    const s = new URLSearchParams(window.location.search).get('shop') || '';
    setShop(s);
    const load = () => fetch('/api/public/queue?shop=' + encodeURIComponent(s), { cache: 'no-store' })
      .then(r => r.json()).then(x => { if (alive) { setData(x); setOnline(true); } }).catch(() => alive && setOnline(false));
    load(); setNow(new Date());
    const t = setInterval(load, 5000), c = setInterval(() => setNow(new Date()), 15000);
    return () => { alive = false; clearInterval(t); clearInterval(c); };
  }, []);
  const repairs = data?.repairs || [];
  const ready = repairs.filter((x: any) => x.status === 'READY');
  const working = repairs.filter((x: any) => x.status !== 'READY');
  return <div className="fx-tv">
    <header className="fx-tv-top">
      <div className="fx-tv-brand">{data?.shop?.logoDataUrl ? <img src={data.shop.logoDataUrl} alt="" /> : <img src="/icons/atelier-192.png" alt="" />}<b>{data?.shop?.name || 'Fixi'}</b></div>
      <div className="fx-tv-time">{now ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(now) : ''}</div>
      <div className={`fx-tv-live ${online ? '' : 'off'}`}>{online ? <Wifi /> : <WifiOff />}{online ? 'En direct' : 'Reconnexion…'}</div>
    </header>
    <main className="fx-tv-main">
      <section className="fx-tv-col fx-tv-ready" aria-label="Prêts à récupérer">
        <h2><CheckCircle2 /> Prêt à récupérer <span>{ready.length}</span></h2>
        <div className="fx-tv-list">
          {ready.map((r: any) => <article key={r.code}><b>{r.code}</b><span>{r.device}</span>{r.client && <small>{r.client}</small>}</article>)}
          {!ready.length && <p className="fx-tv-empty">Aucun appareil prêt pour le moment.</p>}
        </div>
      </section>
      <section className="fx-tv-col" aria-label="En cours">
        <h2><Wrench /> En cours <span>{working.length}</span></h2>
        <div className="fx-tv-list">
          {working.map((r: any) => <article key={r.code} data-status={r.status}><b>{r.code}</b><span>{r.device}</span><em className={`fx-status fx-status--${r.status}`}><i />{labels[r.status] || r.status}</em></article>)}
        </div>
      </section>
      <aside className="fx-tv-side"><AdSlot placement="QUEUE" shop={shop} /><div className="fx-tv-tip"><b>Suivez votre appareil sur votre téléphone</b><span>Scannez le QR code de votre ticket.</span></div></aside>
    </main>
  </div>;
}
