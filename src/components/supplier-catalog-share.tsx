'use client';
import { useEffect, useState } from 'react';
import { Share2, MessageCircle, Copy, Globe, Lock } from 'lucide-react';
import { FxSheet } from './fx-sheet';
import { api } from './ui';
import { waLink } from '@/lib/whatsapp-link';

// Partager son catalogue par WhatsApp : une page publique (désactivable) avec les produits, prix et disponibilité.
export function SupplierCatalogShare() {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) fetch('/api/supplier/catalog-share').then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, [open]);
  async function toggle(v: boolean) { try { const x = await api('/api/supplier/catalog-share', { method: 'PUT', body: JSON.stringify({ public: v }) }); setD({ ...d, ...x }); } catch (e: any) { alert(e.message); } }
  const msg = d ? `Bonjour, voici le catalogue de ${d.name} : pièces, prix et disponibilité à jour.\n${d.link}\nCommandez en un toucher avec Fixi.` : '';
  return <>
    <button type="button" className="btn btn-soft" onClick={() => setOpen(true)}><Share2 size={18} /> Partager mon catalogue</button>
    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Partager mon catalogue" subtitle="Les réparateurs voient vos pièces et vos prix, et commandent sur Fixi." label="Partager le catalogue">
      {!d ? <div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i /><i /></div> : <div className="fx-form-stack">
        <div className="fx-segment" role="radiogroup" aria-label="Visibilité du catalogue">
          <button type="button" role="radio" aria-checked={!d.public} onClick={() => toggle(false)}><Lock size={15} /> Privé</button>
          <button type="button" role="radio" aria-checked={!!d.public} onClick={() => toggle(true)}><Globe size={15} /> Public avec le lien</button>
        </div>
        {d.public ? <>
          <div className="fx-invite-preview">{msg}</div>
          <a className="btn btn-success btn-block" href={waLink('', msg)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Envoyer par WhatsApp</a>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => navigator.clipboard?.writeText(d.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })}><Copy size={16} /> {copied ? 'Lien copié' : 'Copier le lien'}</button>
          <a className="btn btn-ghost btn-block" href={d.link} target="_blank" rel="noreferrer">Voir la page</a>
        </> : <p className="fx-form-hint" style={{ color: 'var(--fx-ink-2)' }}>Rendez le catalogue public pour obtenir le lien. Vous pouvez le repasser en privé à tout moment : le lien ne fonctionne plus.</p>}
      </div>}
    </FxSheet>
  </>;
}
