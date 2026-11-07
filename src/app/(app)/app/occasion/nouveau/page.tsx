'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, IdCard, Loader2, ScanBarcode, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { api } from '@/components/ui';
import { BarcodeCamera } from '@/components/barcode-camera';
import { cleanImei, isImei } from '@/lib/imei';
import { CONDITIONS, STORAGE_OPTIONS, purchaseIssues, storageLabel, suggestedPrice, validateSellerId } from '@/lib/used-devices';
import '@/app/fixi-occasion.css';

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Realme', 'Huawei', 'Honor', 'Infinix', 'Tecno', 'Vivo', 'Autre'];

/** Achat d'un téléphone à un particulier : appareil, état, vendeur (pièce d'identité), prix. */
export default function BuyUsedDevice() {
  const r = useRouter();
  const [f, setF] = useState<any>({ brand: 'Apple', model: '', storageGb: 128, color: '', imei: '', imei2: '', condition: 'TRES_BON', batteryHealth: '', accountUnlocked: false, accessories: '', defects: '', sellerName: '', sellerIdType: 'CIN', sellerId: '', sellerIdIssuedAt: '', sellerPhone: '', sellerAddress: '', purchasePrice: '', purchaseMethod: 'CASH', askingPrice: '', warrantyDays: 30 });
  const [check, setCheck] = useState<{ state: 'idle' | 'checking' | 'ok' | 'flagged' | 'invalid'; text?: string }>({ state: 'idle' });
  const [declared, setDeclared] = useState(false); const [scan, setScan] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const imei = cleanImei(f.imei);
  const suggestion = useMemo(() => suggestedPrice(Number(f.purchasePrice), f.condition), [f.purchasePrice, f.condition]);
  const idCheck = f.sellerId ? validateSellerId(f.sellerIdType, f.sellerId) : null;

  // Vérification de l'IMEI dans le réseau Fixi dès qu'il est complet.
  useEffect(() => {
    if (!imei) { setCheck({ state: 'idle' }); return; }
    if (!isImei(imei)) { setCheck({ state: imei.length >= 15 ? 'invalid' : 'idle', text: 'IMEI invalide (15 chiffres)' }); return; }
    setCheck({ state: 'checking' });
    const t = setTimeout(() => { api<any>(`/api/imei/check?imei=${imei}`).then(x => setCheck(x.flagged ? { state: 'flagged', text: `Signalé ${x.reason === 'LOST' ? 'perdu' : 'volé'} dans le réseau Fixi` } : { state: 'ok', text: 'Aucun signalement dans le réseau Fixi' })).catch(() => setCheck({ state: 'idle' })); }, 300);
    return () => clearTimeout(t);
  }, [imei]);

  const issues = purchaseIssues({ ...f, imei, purchasePrice: Number(f.purchasePrice), batteryHealth: f.batteryHealth === '' ? null : Number(f.batteryHealth) }, isImei(imei));
  if (!idCheck?.ok) issues.push(f.sellerIdType === 'CIN' ? 'CIN du vendeur (8 chiffres)' : 'pièce d’identité du vendeur');
  if (!declared) issues.push('déclaration du vendeur');
  const blocked = check.state === 'flagged';

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (issues.length || blocked) { setErr('Il manque : ' + issues.join(', ') + '.'); return; }
    setBusy(true); setErr('');
    try { const d = await api<any>('/api/used-devices', { method: 'POST', body: JSON.stringify({ ...f, imei, batteryHealth: f.batteryHealth === '' ? null : Number(f.batteryHealth), purchasePrice: Number(f.purchasePrice), askingPrice: Number(f.askingPrice || suggestion || 0) }) }); r.push(`/app/occasion/${d.id}?nouveau=1`); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return <form className="fx-page fxm-occ fxm-occ-form" onSubmit={save} noValidate>
    <div className="fx-hello"><div><h1>Acheter un téléphone</h1><p>Fixi vérifie l’IMEI, enregistre le vendeur dans le registre et prépare l’attestation et l’étiquette.</p></div></div>

    <section className="fx-panel fxm-in"><div className="fx-panel-head"><h2><Smartphone size={18} /> Le téléphone</h2></div>
      <div className="fxm-occ-chips" role="group" aria-label="Marque">{BRANDS.map(b => <button type="button" key={b} className={f.brand === b ? 'on' : ''} aria-pressed={f.brand === b} onClick={() => set('brand', b)}>{b}</button>)}</div>
      <div className="fx-form-grid">
        <label className="field span-2"><span className="label">Modèle *</span><input className="input" value={f.model} onChange={e => set('model', e.target.value)} placeholder={f.brand === 'Apple' ? 'iPhone 15 Pro' : 'Galaxy S23'} /></label>
        <div className="field span-2"><span className="label">Stockage</span><div className="fxm-occ-chips">{STORAGE_OPTIONS.map(g => <button type="button" key={g} className={f.storageGb === g ? 'on' : ''} aria-pressed={f.storageGb === g} onClick={() => set('storageGb', g)}>{storageLabel(g)}</button>)}</div></div>
        <label className="field"><span className="label">Couleur</span><input className="input" value={f.color} onChange={e => set('color', e.target.value)} placeholder="Noir, Titane…" /></label>
        <label className="field"><span className="label">Santé de la batterie (%)</span><input className="input" inputMode="numeric" value={f.batteryHealth} onChange={e => set('batteryHealth', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Réglages → Batterie" /></label>
        <label className="field span-2"><span className="label">IMEI * <small>(composez *#06#)</small></span><span className="fxm-occ-pricebox"><input className="input mono" inputMode="numeric" value={f.imei} onChange={e => set('imei', e.target.value)} placeholder="15 chiffres" /><button type="button" className="btn btn-soft btn-sm" onClick={() => setScan(true)} aria-label="Scanner l’IMEI"><ScanBarcode size={17} /></button></span>
          {check.state !== 'idle' && <span className={'fxm-occ-check ' + check.state}>{check.state === 'checking' ? <Loader2 size={14} className="ps-spin" /> : check.state === 'ok' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />} {check.state === 'checking' ? 'Vérification dans le réseau Fixi…' : check.text}</span>}</label>
      </div>
      <div className="field"><span className="label">État</span><div className="fxm-occ-chips">{CONDITIONS.map(([v, l]) => <button type="button" key={v} className={f.condition === v ? 'on' : ''} aria-pressed={f.condition === v} onClick={() => set('condition', v)}>{l}</button>)}</div></div>
      <div className="fx-form-grid">
        <label className="field"><span className="label">Accessoires</span><input className="input" value={f.accessories} onChange={e => set('accessories', e.target.value)} placeholder="Boîte, chargeur…" /></label>
        <label className="field"><span className="label">Défauts</span><input className="input" value={f.defects} onChange={e => set('defects', e.target.value)} placeholder="Rayure dos, Face ID…" /></label>
      </div>
      <label className={'fxm-occ-unlock' + (f.accountUnlocked ? ' on' : '')}><input type="checkbox" checked={f.accountUnlocked} onChange={e => set('accountUnlocked', e.target.checked)} /> Compte iCloud / Google retiré par le vendeur devant moi <small>(sinon le téléphone sera bloqué au prochain réglage)</small></label>
    </section>

    <section className="fx-panel fxm-in" style={{ '--d': '.05s' } as any}><div className="fx-panel-head"><h2><IdCard size={18} /> Le vendeur</h2></div>
      <div className="fx-form-grid">
        <label className="field span-2"><span className="label">Nom et prénom *</span><input className="input" value={f.sellerName} onChange={e => set('sellerName', e.target.value)} placeholder="Comme sur la pièce d’identité" /></label>
        <label className="field"><span className="label">Pièce d’identité</span><select className="select" value={f.sellerIdType} onChange={e => set('sellerIdType', e.target.value)}><option value="CIN">CIN</option><option value="PASSPORT">Passeport</option><option value="SEJOUR">Carte de séjour</option></select></label>
        <label className="field"><span className="label">Numéro *</span><input className="input mono" inputMode={f.sellerIdType === 'CIN' ? 'numeric' : 'text'} value={f.sellerId} onChange={e => set('sellerId', e.target.value.toUpperCase())} placeholder={f.sellerIdType === 'CIN' ? '8 chiffres' : 'Numéro'} />{idCheck && !idCheck.ok && <small className="fxm-occ-bad">{idCheck.error}</small>}</label>
        <label className="field"><span className="label">Délivrée le</span><input className="input" type="date" value={f.sellerIdIssuedAt} onChange={e => set('sellerIdIssuedAt', e.target.value)} /></label>
        <label className="field"><span className="label">Téléphone</span><input className="input" inputMode="tel" value={f.sellerPhone} onChange={e => set('sellerPhone', e.target.value)} /></label>
        <label className="field span-2"><span className="label">Adresse</span><input className="input" value={f.sellerAddress} onChange={e => set('sellerAddress', e.target.value)} /></label>
      </div>
      <p className="fxm-occ-privacy"><ShieldCheck size={14} /> Le numéro de pièce est chiffré : seuls les 3 derniers chiffres s’affichent. Il apparaît en entier sur l’attestation et dans le registre du gérant.</p>
    </section>

    <section className="fx-panel fxm-in" style={{ '--d': '.1s' } as any}><div className="fx-panel-head"><h2><Wallet size={18} /> Prix</h2></div>
      <div className="fx-form-grid">
        <label className="field"><span className="label">Prix d’achat (DT) *</span><input className="input" inputMode="decimal" value={f.purchasePrice} onChange={e => set('purchasePrice', e.target.value.replace(',', '.'))} /></label>
        <label className="field"><span className="label">Payé en</span><select className="select" value={f.purchaseMethod} onChange={e => set('purchaseMethod', e.target.value)}><option value="CASH">Espèces (sortie de caisse)</option><option value="BANK_TRANSFER">Virement</option><option value="D17">D17</option><option value="OTHER">Autre</option></select></label>
        <label className="field"><span className="label">Prix de revente (DT)</span><input className="input" inputMode="decimal" value={f.askingPrice} onChange={e => set('askingPrice', e.target.value.replace(',', '.'))} placeholder={suggestion ? `Suggestion : ${suggestion}` : ''} /></label>
        <label className="field"><span className="label">Garantie à la revente (jours)</span><input className="input" inputMode="numeric" value={f.warrantyDays} onChange={e => set('warrantyDays', e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <label className="fxm-occ-declare"><input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} /> Le vendeur déclare être le propriétaire légitime de ce téléphone, qu’il n’est ni volé ni gagé, et a présenté sa pièce d’identité originale.</label>
    </section>

    {blocked && <div className="error" role="alert"><AlertTriangle size={16} /> Cet IMEI est signalé {check.text?.includes('perdu') ? 'perdu' : 'volé'} dans le réseau Fixi : n’achetez pas cet appareil.</div>}
    {err && !blocked && <div className="error" role="alert">{err}</div>}
    <div className="fxm-occ-submit"><span>{issues.length ? `Il manque : ${issues.slice(0, 3).join(', ')}${issues.length > 3 ? '…' : ''}` : 'Tout est prêt.'}</span><button className="btn btn-primary btn-lg" disabled={busy || blocked}>{busy ? <Loader2 size={18} className="ps-spin" /> : <CheckCircle2 size={18} />} Enregistrer l’achat</button></div>
    {scan && <BarcodeCamera kicker="IMEI" title="Scanner l’IMEI" text="Composez *#06# sur le téléphone et présentez l’écran, ou scannez l’étiquette de la boîte." submitLabel="Utiliser" onDetected={(c: string) => { set('imei', cleanImei(c)); setScan(false); }} onClose={() => setScan(false)} />}
  </form>;
}
