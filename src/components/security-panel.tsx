'use client';
import { useEffect, useState } from 'react';
import { KeyRound, Loader2, LogOut, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';

/** Double vérification (application d'authentification) + « Déconnecter tous les appareils ». */
export function SecurityPanel({ endpoint, loginHref }: { endpoint: string; loginHref: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState(''); const [mode, setMode] = useState<'' | 'disable'>('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  useEffect(() => { fetch(endpoint, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(x => x && setEnabled(!!x.enabled)).catch(() => {}); }, [endpoint]);
  async function call(body: any) {
    setBusy(true); setErr('');
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Action impossible');
      return j;
    } catch (e: any) { setErr(e.message); return null; } finally { setBusy(false); }
  }
  const relogin = (msg: string) => { setDone(msg); setTimeout(() => { window.location.href = loginHref; }, 2200); };
  if (enabled === null) return null;
  return <section className="sec">
    <header><span className={'sec-ico' + (enabled ? ' on' : '')}>{enabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}</span>
      <div><b>Double vérification</b><small>{enabled ? 'Active : un code de votre téléphone est demandé sur chaque nouvel appareil (mémorisé 30 jours).' : 'Protégez votre compte : même avec votre mot de passe, personne ne peut entrer sans votre téléphone.'}</small></div>
      <em className={enabled ? 'on' : ''}>{enabled ? 'Activée' : 'Désactivée'}</em></header>
    {done ? <p className="sec-done">{done}</p> : <>
      {!enabled && !setup && <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { const j = await call({ action: 'setup' }); if (j) setSetup(j); }}>{busy ? <Loader2 size={15} className="ps-spin" /> : <Smartphone size={15} />} Activer</button>}
      {setup && <div className="sec-setup">
        <img src={setup.qr} alt="QR code à scanner" width={180} height={180} />
        <ol><li>Installez <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> ou <b>2FAS</b> sur votre téléphone.</li><li>Scannez ce QR code (ou tapez la clé : <code>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>).</li><li>Entrez le code à 6 chiffres affiché :</li></ol>
        <form onSubmit={async e => { e.preventDefault(); const j = await call({ action: 'enable', code }); if (j) relogin('Double vérification activée. Reconnectez-vous avec votre code…'); }}>
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="Code à 6 chiffres" />
          <button className="btn btn-primary btn-sm" disabled={busy || code.length !== 6}><KeyRound size={15} /> Confirmer</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSetup(null); setCode(''); }}>Annuler</button>
        </form></div>}
      {enabled && mode !== 'disable' && <button className="btn btn-ghost btn-sm" onClick={() => setMode('disable')}>Désactiver…</button>}
      {enabled && mode === 'disable' && <form className="sec-inline" onSubmit={async e => { e.preventDefault(); const j = await call({ action: 'disable', code }); if (j) relogin('Double vérification désactivée. Reconnexion…'); }}>
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Code actuel" aria-label="Code à 6 chiffres" />
        <button className="btn btn-soft btn-sm" disabled={busy || code.length !== 6}>Désactiver</button></form>}
      <div className="sec-sep" />
      <div className="sec-row"><div><b>Déconnecter tous les appareils</b><small>Téléphone perdu, ancien employé, PC partagé : toutes les sessions sont fermées, y compris celle-ci.</small></div>
        <button className="btn btn-soft btn-sm" disabled={busy} onClick={async () => { if (!window.confirm('Fermer toutes les sessions ouvertes sur tous les appareils ?')) return; const j = await call({ action: 'logout-all' }); if (j) relogin('Toutes les sessions sont fermées. Reconnexion…'); }}><LogOut size={15} /> Tout déconnecter</button></div>
      {err && <p className="sec-err">{err}</p>}
    </>}
  </section>;
}
