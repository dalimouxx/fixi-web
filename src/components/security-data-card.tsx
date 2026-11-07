'use client';
import { useEffect, useState } from 'react';
import { Copy, Download, KeyRound, Printer, ShieldCheck } from 'lucide-react';
import { api } from './ui';
import { dateTime } from '@/lib/format';

/** Paramètres → Sécurité et données : code de secours du gérant + copie complète des données. */
export function SecurityDataCard() {
  const [st, setSt] = useState<{ exists: boolean; createdAt: string | null } | null>(null);
  const [code, setCode] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api<any>('/api/auth/recovery-code').then(setSt).catch(() => setSt(null)); }, []);
  async function create() {
    if (st?.exists && !confirm('Un nouveau code remplace l’ancien, qui ne fonctionnera plus. Continuer ?')) return;
    setBusy(true); setMsg('');
    try { const r = await api<any>('/api/auth/recovery-code', { method: 'POST' }); setCode(r.code); setSt({ exists: true, createdAt: new Date().toISOString() }); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }
  function print() {
    const w = window.open('', '_blank', 'width=420,height=520'); if (!w) return;
    w.document.write(`<html><head><title>Code de secours Fixi</title></head><body style="font-family:system-ui;padding:24px;text-align:center"><h2>Code de secours Fixi</h2><p>À garder en lieu sûr. Il permet au gérant de choisir un nouveau code PIN s’il l’a oublié. Il ne sert qu’une fois.</p><p style="font:700 24px ui-monospace,monospace;letter-spacing:2px;border:2px dashed #999;padding:14px;border-radius:12px">${code}</p><p style="color:#666">Créé le ${new Date().toLocaleString('fr-FR')}</p><script>window.print()</script></body></html>`);
    w.document.close();
  }
  return <section id="securite" className="card card-pad fx-sec">
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><ShieldCheck size={19} /><h2 className="section-title">Sécurité et données</h2></div>
    <div className="fx-sec-grid">
      <div className="fx-sec-box">
        <b><KeyRound size={16} /> Code de secours du gérant</b>
        <p>Si vous oubliez votre code PIN, ce code vous permet d’en choisir un nouveau depuis l’écran de connexion (« Code PIN oublié ? »). Imprimez-le et rangez-le.</p>
        {code ? <div className="fx-sec-code" role="status">
          <span className="mono">{code}</span>
          <small>Notez-le maintenant : il ne sera plus jamais affiché.</small>
          <div className="fx-sec-actions"><button type="button" className="btn btn-soft btn-sm" onClick={() => { void navigator.clipboard?.writeText(code); setMsg('Code copié.'); }}><Copy size={15} /> Copier</button><button type="button" className="btn btn-soft btn-sm" onClick={print}><Printer size={15} /> Imprimer</button></div>
        </div> : <p className={'fx-sec-state ' + (st?.exists ? 'ok' : 'warn')}>{st === null ? '…' : st.exists ? `Code actif depuis le ${st.createdAt ? dateTime(st.createdAt) : "?"}` : 'Aucun code : sans code PIN, seul le support Fixi pourra vous débloquer.'}</p>}
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={create}>{st?.exists ? 'Créer un nouveau code' : 'Créer mon code de secours'}</button>
      </div>
      <div className="fx-sec-box">
        <b><Download size={16} /> Copie complète de vos données</b>
        <p>Clients, réparations, paiements, stock, factures, ventes comptoir, dépenses, caisse et équipe : un fichier ZIP (CSV pour Excel + JSON complet). Les codes PIN et clés ne sont jamais exportés.</p>
        <a className="btn btn-soft btn-sm" href="/api/export/full" download><Download size={15} /> Télécharger mes données</a>
      </div>
    </div>
    {msg && <p className="fx-sec-msg">{msg}</p>}
  </section>;
}
