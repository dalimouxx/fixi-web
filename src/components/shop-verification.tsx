'use client';
import { useEffect, useState } from 'react';
import { BadgeCheck, Camera, Clock3, FileText, Loader2, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { compressProductImage } from '@/lib/image-compress';
import { humanError } from '@/lib/human-error';

type State = { status: string; note?: string | null; file?: any; defaults?: any };

/** Statut de vérification de l'atelier (null tant que ce n'est pas chargé). */
export function useShopVerification(key = 0) {
  const [d, setD] = useState<State | null>(null);
  useEffect(() => { fetch('/api/verification', { cache: 'no-store' }).then(r => r.ok ? r.json() : { status: 'VERIFIED' }).then(setD).catch(() => setD({ status: 'VERIFIED' })); }, [key]);
  return d;
}

function Photo({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [err, setErr] = useState('');
  return <label className={'sv-photo' + (value ? ' is-set' : '')}>
    {value ? <img src={value} alt="" /> : <Camera size={22} />}
    <span><b>{label}</b><small>{err || (value ? 'Photo ajoutée · toucher pour changer' : hint)}</small></span>
    <input type="file" accept="image/*" capture="environment" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setErr(''); try { onChange(await compressProductImage(f)); } catch (x: any) { setErr(x.message); } }} />
  </label>;
}

/** Carte affichée à la place du catalogue fournisseurs tant que l'atelier n'est pas vérifié par Fixi. */
export function ShopVerificationGate({ state, onSent }: { state: State; onSent: () => void }) {
  const d = state.defaults || {};
  const [f, setF] = useState({ legalName: d.legalName || '', ownerName: d.ownerName || '', taxId: d.taxId || '', tradeRegister: d.tradeRegister || '', address: d.address || '', city: d.city || '', documentUrl: '', facadeUrl: '', insideUrl: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [edit, setEdit] = useState(state.status !== 'PENDING');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await fetch('/api/verification', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error); setEdit(false); onSent(); }
    catch (x) { setErr(humanError(x)); } finally { setBusy(false); }
  }
  return <section className="sv">
    <header className="sv-head">
      <span className={'sv-ico sv-' + state.status.toLowerCase()}>{state.status === 'PENDING' ? <Clock3 size={24} /> : state.status === 'REJECTED' ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}</span>
      <div>
        <h2>{state.status === 'PENDING' ? 'Vérification en cours' : state.status === 'REJECTED' ? 'Vérification refusée' : 'Faites vérifier votre atelier'}</h2>
        <p>{state.status === 'PENDING' ? 'Fixi vérifie vos documents (en général sous 24 h). Le catalogue des fournisseurs s’ouvrira dès la validation, vous serez prévenu.'
          : state.status === 'REJECTED' ? <>Motif : <b>{state.note || '—'}</b>. Corrigez puis renvoyez vos documents.</>
            : 'Le catalogue et les prix des fournisseurs sont réservés aux ateliers de réparation. Envoyez vos documents : Fixi les vérifie puis ouvre l’accès.'}</p>
      </div>
    </header>
    {state.status === 'PENDING' && !edit && <div className="sv-sent"><BadgeCheck size={18} /> Dossier envoyé{state.file?.submittedAt ? ' le ' + new Date(state.file.submittedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : ''} · {state.file?.legalName} · MF {state.file?.taxId}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>Modifier le dossier</button></div>}
    {edit && <form className="sv-form" onSubmit={send}>
      <div className="sv-grid">
        <label className="field"><span className="label"><Store size={14} /> Nom commercial / raison sociale *</span><input className="input" required value={f.legalName} onChange={set('legalName')} /></label>
        <label className="field"><span className="label">Nom et prénom du gérant *</span><input className="input" required value={f.ownerName} onChange={set('ownerName')} /></label>
        <label className="field"><span className="label">Matricule fiscal *</span><input className="input" required value={f.taxId} onChange={set('taxId')} placeholder="1234567A/A/M/000" /></label>
        <label className="field"><span className="label">Registre de commerce (RNE)</span><input className="input" value={f.tradeRegister} onChange={set('tradeRegister')} placeholder="Facultatif" /></label>
        <label className="field sv-wide"><span className="label">Adresse de l’atelier *</span><input className="input" required value={f.address} onChange={set('address')} placeholder="Rue, quartier" /></label>
        <label className="field"><span className="label">Ville</span><input className="input" value={f.city} onChange={set('city')} /></label>
      </div>
      <div className="sv-photos">
        <Photo label="Patente ou registre de commerce *" hint="Photo lisible du document" value={f.documentUrl} onChange={v => setF({ ...f, documentUrl: v })} />
        <Photo label="Façade de l’atelier *" hint="Avec l’enseigne visible" value={f.facadeUrl} onChange={v => setF({ ...f, facadeUrl: v })} />
        <Photo label="Intérieur / poste de travail" hint="Facultatif" value={f.insideUrl} onChange={v => setF({ ...f, insideUrl: v })} />
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="ps-spin" /> : <FileText size={16} />} Envoyer pour vérification</button>
      <small className="sv-privacy">🔒 Vos documents ne sont vus que par l’équipe Fixi, jamais par les fournisseurs.</small>
    </form>}
  </section>;
}
