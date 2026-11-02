'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Phone, ShieldCheck, FileCheck2, Star, Gift, History, CreditCard, WalletCards, MessageCircle, Inbox, Search, Wrench, Hourglass, PackageCheck, Smile, XCircle, CalendarClock, MapPin } from 'lucide-react';
import { money, dateOnly } from '@/lib/format';
import { AdSlot } from '@/components/ad-slot';
import { StatusStepper } from '@/components/status-stepper';
import { shopBrandVars } from '@/lib/brand-color';
import { waLink } from '@/lib/whatsapp-link';

// Ce que voit le client de l'atelier : l'étape en cours en grand, quand c'est prévu,
// ce qu'il reste à payer et un bouton pour appeler l'atelier.
const hero: Record<string, { icon: any; title: string; text: string }> = {
  RECEIVED: { icon: Inbox, title: 'Appareil bien reçu', text: 'Votre appareil est enregistré à l’atelier. Le diagnostic va commencer.' },
  DIAGNOSIS: { icon: Search, title: 'Diagnostic en cours', text: 'Le technicien cherche l’origine de la panne.' },
  IN_REPAIR: { icon: Wrench, title: 'En réparation', text: 'Le technicien répare votre appareil.' },
  WAITING_PART: { icon: Hourglass, title: 'En attente d’une pièce', text: 'La pièce nécessaire a été commandée. La réparation reprend dès son arrivée.' },
  READY: { icon: PackageCheck, title: 'Prêt à récupérer', text: 'Bonne nouvelle : votre appareil est réparé. Passez le récupérer pendant les horaires d’ouverture.' },
  DELIVERED: { icon: Smile, title: 'Appareil rendu', text: 'Merci pour votre confiance. Votre garantie est indiquée ci-dessous.' },
  CANCELLED: { icon: XCircle, title: 'Réparation annulée', text: 'Contactez l’atelier pour plus d’informations.' },
};
const longDate = (v: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(v));

export default function TrackClient() {
  const p = useParams<{ code: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [shop, setShop] = useState('');
  const [token, setToken] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  async function load() {
    const sp = new URLSearchParams(window.location.search); const s = sp.get('shop') || ''; const t = sp.get('t') || '';
    setShop(s); setToken(t);
    try {
      const r = await fetch('/api/public/track/' + encodeURIComponent(p.code) + '?shop=' + encodeURIComponent(s) + '&t=' + encodeURIComponent(t), { cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j);
    } catch (e: any) { setError(e.message || 'Lien de suivi invalide'); }
  }
  useEffect(() => { load(); const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000); return () => clearInterval(t); }, [p.code]);

  async function payOnline() {
    setPayBusy(true);
    try { const r = await fetch('/api/public/payment-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop, code: p.code, token }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); window.location.href = j.url; }
    catch (e: any) { alert(e.message); } finally { setPayBusy(false); }
  }
  async function feedback() {
    setSending(true);
    try {
      const r = await fetch(`/api/public/feedback/${encodeURIComponent(p.code)}?shop=${encodeURIComponent(shop)}&t=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, comment }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); setReviewDone(true);
      if (j.googleReviewUrl && rating >= 4) setTimeout(() => window.open(j.googleReviewUrl, '_blank'), 600);
      await load();
    } catch (e: any) { alert(e.message); } finally { setSending(false); }
  }

  if (error) return <div className="fx-track"><main className="fx-track-main"><section className="fx-track-card fx-track-error" role="alert"><XCircle /><b>Suivi introuvable</b><span>{error}. Vérifiez le lien reçu par WhatsApp ou contactez l’atelier.</span></section></main></div>;
  if (!data) return <div className="fx-track"><main className="fx-track-main"><div className="fx-track-card fx-skeleton" role="status" aria-label="Chargement de votre réparation"><i /><i /><i /></div></main></div>;

  const h = hero[data.status] || hero.RECEIVED; const Icon = h.icon;
  const device = [data.brand, data.model].filter(Boolean).join(' ');
  const s = data.shop;
  const showEta = data.promisedAt && !['READY', 'DELIVERED', 'CANCELLED'].includes(data.status);
  const late = showEta && new Date(data.promisedAt).getTime() < Date.now();
  const contact = s.whatsappPhone || s.phone;

  return <div className="fx-track" style={shopBrandVars(s.brandColor) as any}>
    <header className="fx-track-top">
      {s.logoDataUrl ? <img src={s.logoDataUrl} alt="" /> : <i aria-hidden="true">{String(s.name || 'F').charAt(0)}</i>}
      <div><b>{s.name}</b>{(s.city || s.address) && <span><MapPin size={13} /> {s.city || s.address}</span>}</div>
      <span className="fx-track-secure"><ShieldCheck size={14} /> Lien privé</span>
    </header>

    <main className="fx-track-main">
      <section className="fx-track-card fx-track-hero" data-status={data.status}>
        <div className="fx-track-hero-icon" aria-hidden="true"><Icon /></div>
        <h1>{h.title}</h1>
        <p>{h.text}</p>
        <div className="fx-track-device"><b>{device}</b><span>Réparation <code>{data.code}</code></span></div>
        {showEta && <div className={`fx-track-eta ${late ? 'is-late' : ''}`}><CalendarClock size={20} /><span><small>{late ? 'Prévu initialement pour' : 'Prévu pour'}</small><b>{longDate(data.promisedAt)}</b></span></div>}
      </section>

      {data.finalPrice !== null && data.finalPrice !== undefined && <section className="fx-track-card fx-track-money">
        <div><span>Reste à payer</span><b className={data.balance > 0 ? 'is-due' : 'is-paid'}>{data.balance > 0 ? money(data.balance, s.currency) : 'Tout est payé'}</b></div>
        <div><span>Total de la réparation</span><strong>{money(data.finalPrice, s.currency)}</strong></div>
        {data.balance > 0 && data.onlinePaymentAvailable && <button className="btn fx-track-btn" onClick={payOnline} disabled={payBusy}><CreditCard size={18} />{payBusy ? 'Création du lien…' : 'Payer en ligne'}</button>}
      </section>}

      <div className="fx-track-actions">
        {s.phone && <a className="btn fx-track-btn" href={`tel:${s.phone}`}><Phone size={19} /> Appeler</a>}
        {contact && <a className="btn fx-track-btn-soft" href={waLink(contact, `Bonjour ${s.name}, je vous contacte pour ma réparation ${data.code} (${device}).`)} target="_blank" rel="noreferrer"><MessageCircle size={19} /> WhatsApp</a>}
      </div>

      {data.quote && ['DRAFT', 'SENT'].includes(data.quote.status) && <Link href={`/approve/${data.quote.publicToken}`} className="fx-track-card fx-track-quote"><FileCheck2 /><span><b>Votre devis attend votre accord</b><small>{data.quote.number} · {money(data.quote.total, s.currency)}</small></span><strong>Voir →</strong></Link>}

      <section className="fx-track-card">
        <h2>Avancement</h2>
        <StatusStepper status={data.status} events={data.events} />
      </section>

      {(data.warranty?.expiresAt || data.loyaltyPoints > 0) && <section className="fx-track-card fx-track-rows">
        {data.warranty?.expiresAt && <div><ShieldCheck /><span><b>Garantie {data.warranty.active ? 'active' : 'terminée'}</b><small>Jusqu’au {dateOnly(data.warranty.expiresAt)} · {data.warranty.days} jours</small></span></div>}
        {data.loyaltyPoints > 0 && <div><Gift /><span><b>{data.loyaltyPoints} points fidélité</b><small>Votre fidélité est reconnue par l’atelier.</small></span></div>}
      </section>}

      {data.deviceHistory?.length > 0 && <details className="fx-track-card fx-track-history"><summary><History size={18} /> Réparations précédentes de cet appareil <span>{data.deviceHistory.length}</span></summary>
        <div>{data.deviceHistory.map((x: any) => <div key={x.code}><b>{dateOnly(x.deliveredAt || x.createdAt)}</b><span>{x.reportedIssue}</span><small>{x.code}</small></div>)}</div>
      </details>}

      {data.status === 'DELIVERED' && !data.feedback && !reviewDone && <section className="fx-track-card fx-track-feedback">
        <h2><Star size={18} /> Comment s’est passée votre réparation ?</h2>
        <div className="fx-track-stars" role="radiogroup" aria-label="Note">{[1, 2, 3, 4, 5].map(n => <button key={n} role="radio" aria-checked={n === rating} aria-label={`${n} sur 5`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>)}</div>
        <textarea className="textarea" placeholder="Un commentaire (facultatif)" value={comment} onChange={e => setComment(e.target.value)} />
        <button className="btn fx-track-btn" disabled={sending} onClick={feedback}>{sending ? 'Envoi…' : 'Envoyer mon avis'}</button>
      </section>}
      {(data.feedback || reviewDone) && <div className="fx-track-card fx-track-thanks"><CheckCircle2 /> Merci pour votre avis !</div>}

      {data.walletToken && <Link className="btn fx-track-btn-soft fx-track-wallet" href={`/wallet/${data.walletToken}`}><WalletCards size={18} /> Mon espace client</Link>}
      <p className="fx-track-privacy"><ShieldCheck size={13} /> Ce lien est privé : il n’affiche ni votre téléphone ni vos données personnelles.</p>
      <AdSlot placement="TRACK" shop={shop} />
    </main>
    <footer className="fx-track-foot">Suivi propulsé par <b>Fixi</b></footer>
  </div>;
}
