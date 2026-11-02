'use client';
import { useState } from 'react';
import { UserPlus, KeyRound, Phone, ShieldCheck, Wrench, Banknote, ClipboardList } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';

const roles: [string, string, string, any][] = [
  ['ADMIN', 'Gérant', 'Tout voir, tout régler, l’argent et les paramètres.', ShieldCheck],
  ['RECEPTION', 'Réception', 'Reçoit les appareils et prévient les clients.', ClipboardList],
  ['TECHNICIAN', 'Technicien', 'Voit ses réparations, le stock et les pièces compatibles.', Wrench],
  ['CASHIER', 'Caissier', 'Rend les appareils et encaisse.', Banknote],
];
const roleOf = (r: string) => roles.find(x => x[0] === r) || roles[2];
const blank = { fullName: '', loginCode: '', phone: '', email: '', role: 'TECHNICIAN', pin: '' };

// Équipe : chacun son code à 6 chiffres et un écran adapté à son rôle.
export default function Team() {
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [pinFor, setPinFor] = useState<any>(null);
  const [pin, setPin] = useState('');
  const { data, error, loading } = useApi<any[]>('/api/users', refresh);
  const [f, setF] = useState<any>(blank);
  async function save(e: React.FormEvent) { e.preventDefault(); try { await api('/api/users', { method: 'POST', body: JSON.stringify(f) }); setOpen(false); setF(blank); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); } }
  async function savePin(e: React.FormEvent) { e.preventDefault(); try { await api('/api/users/' + pinFor.id, { method: 'PATCH', body: JSON.stringify({ pin }) }); setPinFor(null); setPin(''); } catch (err: any) { alert(err.message); } }
  async function toggle(u: any) { if (u.isActive && !confirm(`Désactiver ${u.fullName} ? Il ne pourra plus se connecter.`)) return; try { await api('/api/users/' + u.id, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) }); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); } }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Équipe</h1><p>Chaque personne a son code et ne voit que ce qui concerne son travail.</p></div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><UserPlus size={18} /> Ajouter une personne</button></div>
    {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
    {loading && !data ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /></div> :
      <div className="fx-list">
        {(data || []).map(u => { const [, label, , I] = roleOf(u.role); return <div key={u.id} className={`fx-row fx-team-row ${u.isActive ? '' : 'is-off'}`}>
          <I />
          <span className="fx-row-main"><b>{u.fullName}</b><small>{label} · identifiant <span className="mono">{u.loginCode}</span>{u.phone ? ` · ${u.phone}` : ''}</small></span>
          <span className={`fx-chip fx-chip--${u.isActive ? 'ok' : 'muted'}`}>{u.isActive ? 'Actif' : 'Désactivé'}</span>
          <div className="fx-appt-actions">
            {u.phone && <a className="fx-icon-btn" href={`tel:${u.phone}`} aria-label={`Appeler ${u.fullName}`}><Phone size={16} /></a>}
            <button className="btn btn-ghost btn-sm" onClick={() => { setPinFor(u); setPin(''); }}><KeyRound size={15} /> Changer le code</button>
            <button className={`btn btn-sm ${u.isActive ? 'btn-ghost' : 'btn-soft'}`} onClick={() => toggle(u)}>{u.isActive ? 'Désactiver' : 'Réactiver'}</button>
          </div>
        </div>; })}
      </div>}

    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Ajouter une personne" label="Ajouter une personne">
      <form onSubmit={save} className="fx-form-stack">
        <div className="fx-role-grid" role="radiogroup" aria-label="Rôle">{roles.map(([v, l, d, I]) => <button type="button" role="radio" key={v} aria-checked={f.role === v} onClick={() => setF({ ...f, role: v })}><I size={20} /><b>{l}</b><small>{d}</small></button>)}</div>
        <div className="fx-form-grid">
          <label className="field span-2"><span className="label">Nom complet *</span><input className="input" required value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value, loginCode: f.loginCode || '' })} /></label>
          <label className="field"><span className="label">Identifiant *</span><input className="input" required pattern="[a-zA-Z0-9._-]{2,30}" value={f.loginCode} onChange={e => setF({ ...f, loginCode: e.target.value.toLowerCase() })} placeholder="ex. ahmed" autoCapitalize="off" /></label>
          <label className="field"><span className="label">Code à 6 chiffres *</span><input className="input" required pattern="\d{6}" inputMode="numeric" maxLength={6} value={f.pin} onChange={e => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="field"><span className="label">Téléphone</span><input className="input" type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
          <label className="field"><span className="label">E-mail</span><input className="input" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-block"><UserPlus size={18} /> Créer le compte</button>
      </form>
    </FxSheet>

    <FxSheet open={!!pinFor} onClose={() => setPinFor(null)} side="bottom" title="Changer le code" subtitle={pinFor?.fullName} label="Changer le code">
      <form onSubmit={savePin} className="fx-form-stack">
        <label className="field"><span className="label">Nouveau code à 6 chiffres</span><input className="input fx-input-big" required pattern="\d{6}" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} autoFocus /></label>
        <button className="btn btn-primary btn-block"><KeyRound size={18} /> Enregistrer le code</button>
      </form>
    </FxSheet>
  </div>;
}
