'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronDown, Eye, EyeOff, Loader2, MapPin, Phone, ShieldCheck, Store, UserRound } from 'lucide-react';
import { GOUVERNORATS, validateSignup } from '@/lib/signup';

export function SignupForm() {
  const router = useRouter();
  const [f, setF] = useState({ shopName: '', region: '', city: '', fullName: '', phone: '', pin: '', pinConfirm: '', accept: false, website: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const t = e.target as HTMLInputElement;
    let v: string | boolean = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'pin' || k === 'pinConfirm') v = String(v).replace(/\D/g, '').slice(0, 6);
    setF(p => ({ ...p, [k]: v })); setError('');
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateSignup(f);
    if (!v.ok) { setError(v.error); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/public/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Inscription impossible');
      try { localStorage.setItem('fixi-region', f.region); localStorage.setItem('fixi-shop', j.shopSlug); localStorage.setItem('fixi-user-' + j.shopSlug, j.userId); } catch {}
      setDone(true);
      setTimeout(() => { router.push(j.next || '/app/suppliers'); router.refresh(); }, 1400);
    } catch (err: any) { setError(err.message); setBusy(false); }
  }

  if (done) return <div className="su-card su-done" role="status">
    <div className="su-done-ring"><Check size={34} strokeWidth={3} /></div>
    <h2>Bienvenue sur Fixi !</h2>
    <p><b>{f.shopName}</b> est créée avec l’offre <b>Fixi Connect gratuite</b>. Ouverture de votre espace…</p>
  </div>;

  const pinOk = f.pin.length === 6 && f.pin === f.pinConfirm;
  return <form className="su-card" onSubmit={submit} noValidate>
    <div className="su-head"><span className="su-badge"><Check size={13} /> Gratuit · sans carte bancaire</span><h2>Créer mon atelier</h2><p>Deux minutes, et votre boutique est en ligne.</p></div>

    <fieldset className="su-group"><legend>Votre boutique</legend>
      <label className="su-field"><span><Store size={14} /> Nom de la boutique</span><input value={f.shopName} onChange={set('shopName')} placeholder="Ex. Phone Clinic Sousse" maxLength={60} autoComplete="organization" required /></label>
      <div className="su-row">
        <label className="su-field"><span><MapPin size={14} /> Gouvernorat</span><div className="su-select"><select value={f.region} onChange={set('region')} required><option value="">Choisir…</option>{GOUVERNORATS.map(g => <option key={g}>{g}</option>)}</select><ChevronDown size={16} /></div></label>
        <label className="su-field"><span>Ville <i>(facultatif)</i></span><input value={f.city} onChange={set('city')} placeholder="Ex. Sahloul" maxLength={80} autoComplete="address-level2" /></label>
      </div>
    </fieldset>

    <fieldset className="su-group"><legend>Le gérant</legend>
      <div className="su-row">
        <label className="su-field"><span><UserRound size={14} /> Nom complet</span><input value={f.fullName} onChange={set('fullName')} placeholder="Prénom et nom" maxLength={60} autoComplete="name" required /></label>
        <label className="su-field"><span><Phone size={14} /> Téléphone</span><div className="su-phone"><b>+216</b><input value={f.phone} onChange={set('phone')} placeholder="20 123 456" inputMode="tel" autoComplete="tel-national" required /></div></label>
      </div>
      <div className="su-row">
        <label className="su-field"><span><ShieldCheck size={14} /> Code PIN (6 chiffres)</span><div className="su-pin"><input type={show ? 'text' : 'password'} value={f.pin} onChange={set('pin')} placeholder="••••••" inputMode="numeric" autoComplete="new-password" required /><button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Masquer le code' : 'Afficher le code'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
        <label className="su-field"><span>Confirmer le code</span><div className={'su-pin' + (pinOk ? ' is-ok' : '')}><input type={show ? 'text' : 'password'} value={f.pinConfirm} onChange={set('pinConfirm')} placeholder="••••••" inputMode="numeric" autoComplete="new-password" required />{pinOk && <Check size={16} className="su-pin-ok" />}</div></label>
      </div>
      <p className="su-hint">Ce code sert à vous connecter chaque jour. Vous pourrez ajouter vos employés ensuite.</p>
    </fieldset>

    <input className="su-trap" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} aria-hidden="true" />
    <label className="su-accept"><input type="checkbox" checked={f.accept} onChange={set('accept')} /><span>J’accepte les <Link href="/conditions" target="_blank">conditions d’utilisation</Link> et la <Link href="/confidentialite" target="_blank">politique de confidentialité</Link>.</span></label>
    {error && <div className="su-error" role="alert">{error}</div>}
    <button className="su-submit" disabled={busy}>{busy ? <><Loader2 size={18} className="su-spin" /> Création…</> : <>Créer mon compte gratuit <ArrowRight size={18} /></>}</button>
    <p className="su-login">Déjà un compte ? <Link href="/login">Se connecter</Link></p>
  </form>;
}
