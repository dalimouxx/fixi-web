'use client';
import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';

export function SupplierInviteForm({ code, done: initialDone, defaultCompany, defaultPhone }: { code: string; done: boolean; defaultCompany: string; defaultPhone: string }) {
  const [f, setF] = useState({ name: '', company: defaultCompany, phone: defaultPhone, city: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initialDone);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch(`/api/public/supplier-invites/${encodeURIComponent(code)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Envoi impossible');
      setDone(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  if (done) return <section className="fx-invite-card fx-invite-done" role="status"><CheckCircle2 /><b>Demande envoyée</b><span>L’équipe Fixi vous appelle pour ouvrir votre espace fournisseur.</span></section>;
  return <form className="fx-invite-card" onSubmit={submit}>
    <h2>Demander mon espace fournisseur</h2>
    <label>Votre nom<input className="input" required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
    <label>Nom de la société<input className="input" required minLength={2} value={f.company} onChange={e => setF({ ...f, company: e.target.value })} autoComplete="organization" /></label>
    <label>Téléphone<input className="input" required type="tel" inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
    <label>Ville<input className="input" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} autoComplete="address-level2" /></label>
    {error && <div className="error" role="alert">{error}</div>}
    <button className="btn btn-primary btn-block" disabled={busy}><Send size={18} />{busy ? 'Envoi…' : 'Envoyer ma demande'}</button>
  </form>;
}
