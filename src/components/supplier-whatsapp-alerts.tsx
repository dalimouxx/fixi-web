'use client';
import { useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { api } from './ui';

// Réglage fournisseur : recevoir chaque nouvelle commande sur WhatsApp.
export function SupplierWhatsAppAlerts() {
  const [d, setD] = useState<{ enabled: boolean; phone: string; platformReady: boolean; canEdit: boolean } | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/supplier/whatsapp-alerts').then(x => { setD(x); setPhone(x.phone || ''); }).catch(() => {}); }, []);
  if (!d) return null;
  async function save(enabled: boolean) {
    setBusy(true); setMsg('');
    try { const x = await api('/api/supplier/whatsapp-alerts', { method: 'PUT', body: JSON.stringify({ enabled, phone }) }); setD({ ...d!, ...x }); setMsg(enabled ? 'Activé : chaque nouvelle commande arrivera aussi sur WhatsApp.' : 'Alertes WhatsApp désactivées.'); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMsg('');
    try { await api('/api/supplier/whatsapp-alerts', { method: 'POST' }); setMsg('Message d’essai envoyé. Regardez WhatsApp.'); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }
  return <section>
    <h3><MessageCircle size={16} /> WhatsApp</h3>
    {!d.platformReady && <p className="fx-set-status">Bientôt disponible : Fixi active l’envoi WhatsApp de son côté. Vous pouvez déjà enregistrer votre numéro.</p>}
    <div className="fx-set-row">
      <span><b>Nouvelle commande sur WhatsApp</b><small>Un message WhatsApp à chaque commande d’une boutique : le canal qu’on ne rate pas, même sans ouvrir Fixi.</small></span>
      <button type="button" role="switch" aria-checked={d.enabled} aria-label="Nouvelle commande sur WhatsApp" className="fx-switch" disabled={!d.canEdit || busy} onClick={() => save(!d.enabled)}><span /></button>
    </div>
    <label className="fx-set-volume"><span><b>Numéro WhatsApp</b><small>Le téléphone du responsable des commandes.</small></span>
      <input className="input" inputMode="tel" autoComplete="tel" placeholder="21 555 497" value={phone} disabled={!d.canEdit} onChange={e => setPhone(e.target.value)} onBlur={() => d.enabled && phone !== d.phone && save(true)} />
    </label>
    {d.enabled && d.platformReady && <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={test}><Send size={17} /> Envoyer un message d’essai</button>}
    {!d.canEdit && <p className="fx-set-status">Seul le gérant peut modifier ce réglage.</p>}
    {msg && <p className="fx-set-status" role="status">{msg}</p>}
  </section>;
}
