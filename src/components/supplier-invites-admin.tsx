'use client';
import { useEffect, useState } from 'react';
import { UserPlus, Phone, MessageCircle } from 'lucide-react';
import { api } from './ui';
import { dateTime } from '@/lib/format';
import { waLink } from '@/lib/whatsapp-link';

const label: Record<string, string> = { SENT: 'Lien envoyé', REQUESTED: 'Demande reçue', CONVERTED: 'Compte créé', DECLINED: 'Sans suite' };

// Fixi Control : fournisseurs invités par les ateliers, demandes à rappeler en premier.
export function SupplierInvitesAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() { const r = await fetch('/api/platform/supplier-invites', { cache: 'no-store' }); if (r.ok) setRows(await r.json()); }
  useEffect(() => { load(); }, []);
  async function setStatus(id: string, status: string) { try { await api('/api/platform/supplier-invites', { method: 'PATCH', body: JSON.stringify({ id, status }) }); load(); } catch (e: any) { alert(e.message); } }
  const requested = rows.filter(x => x.status === 'REQUESTED').length;
  return <section className="supplier-admin-invites">
    <h2><UserPlus size={18} /> Fournisseurs invités par les ateliers {requested > 0 && <b>{requested} à rappeler</b>}</h2>
    <div className="table-wrap"><table className="table"><thead><tr><th>Fournisseur</th><th>Contact</th><th>Invité par</th><th>Statut</th><th>Date</th><th></th></tr></thead><tbody>
      {rows.map(x => <tr key={x.id}>
        <td><b>{x.requestCompany || x.supplierName}</b>{x.requestCity && <small> · {x.requestCity}</small>}</td>
        <td>{x.requestName || '—'}<br /><small>{x.requestPhone || x.supplierPhone || '—'}</small></td>
        <td>{x.inviterShop?.name}<br /><small>{x.inviterShop?.city || x.inviterShop?.region || ''}</small></td>
        <td><span className={`status-pill ${String(x.status).toLowerCase()}`}>{label[x.status] || x.status}</span></td>
        <td>{dateTime(x.requestedAt || x.createdAt)}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          {(x.requestPhone || x.supplierPhone) && <><a className="btn btn-ghost btn-sm" href={`tel:${x.requestPhone || x.supplierPhone}`}><Phone size={14} /></a> <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={waLink(x.requestPhone || x.supplierPhone, `Bonjour ${x.requestName || ''}, ici l’équipe Fixi : nous ouvrons votre espace fournisseur.`)}><MessageCircle size={14} /></a> </>}
          {x.status !== 'CONVERTED' && <button className="btn btn-soft btn-sm" onClick={() => setStatus(x.id, 'CONVERTED')}>Compte créé</button>}
          {x.status === 'REQUESTED' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(x.id, 'DECLINED')}>Sans suite</button>}
        </td>
      </tr>)}
      {!rows.length && <tr><td colSpan={6}>Aucune invitation pour le moment.</td></tr>}
    </tbody></table></div>
  </section>;
}
