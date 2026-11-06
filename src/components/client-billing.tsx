'use client';
import { useState } from 'react';
import { Building2, Check } from 'lucide-react';
import { api } from './ui';

/** Client professionnel : adresse et matricule fiscal, imprimés sur ses factures. */
export function ClientBilling({ client }: { client: { id: string; address?: string | null; taxId?: string | null } }) {
  const [f, setF] = useState({ address: client.address || '', taxId: client.taxId || '' });
  const [open, setOpen] = useState(!!(client.address || client.taxId));
  const [msg, setMsg] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try { await api(`/api/clients/${client.id}`, { method: 'PATCH', body: JSON.stringify(f) }); setMsg('Enregistré : visible sur les prochaines factures.'); }
    catch (x: any) { setMsg(x.message); }
  }
  if (!open) return <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}><Building2 size={15} /> Client professionnel (adresse, matricule fiscal)</button>;
  return <form className="fx-panel fx-client-billing" style={{ marginTop: 12 }} onSubmit={save}>
    <div className="fx-panel-head"><h2><Building2 size={17} /> Facturation</h2></div>
    <div className="fx-form-grid">
      <label className="field span-2"><span className="label">Adresse</span><input className="input" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="Rue, ville" /></label>
      <label className="field"><span className="label">Matricule fiscal</span><input className="input mono" value={f.taxId} onChange={e => setF({ ...f, taxId: e.target.value.toUpperCase() })} placeholder="1234567/A/M/000" /></label>
      <div className="field" style={{ alignSelf: 'end' }}><button className="btn btn-soft"><Check size={16} /> Enregistrer</button></div>
    </div>
    {msg && <p className="page-sub" role="status">{msg}</p>}
  </form>;
}
