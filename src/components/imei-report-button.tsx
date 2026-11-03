'use client';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from './ui';
import { cleanImei, isImei } from '@/lib/imei';

// Signaler l'IMEI d'un appareil perdu ou volé : les autres ateliers Fixi seront prévenus à la réception.
export function ImeiReportButton({ serial }: { serial?: string | null }) {
  const imei = cleanImei(serial || '');
  const [state, setState] = useState<any>(null);
  useEffect(() => { if (isImei(imei)) fetch('/api/imei/check?imei=' + imei).then(r => r.ok ? r.json() : null).then(setState).catch(() => {}); }, [imei]);
  if (!isImei(imei)) return null;
  async function report() {
    const reason = confirm('Cet appareil a-t-il été VOLÉ ?\nOK = volé · Annuler = perdu') ? 'STOLEN' : 'LOST';
    try { await api('/api/imei/report', { method: 'POST', body: JSON.stringify({ imei, reason }) }); setState({ ...(state || {}), reportedByMe: true }); } catch (e: any) { alert(e.message); }
  }
  async function cancel() { try { await api('/api/imei/report?imei=' + imei, { method: 'DELETE' }); setState({ ...(state || {}), reportedByMe: false }); } catch (e: any) { alert(e.message); } }
  return <div className="fx-imei-report">
    {state?.flagged && <div className="fx-imei-alert" role="alert"><b>⚠ Signalé {state.reason === 'LOST' ? 'perdu' : 'volé'} par {state.reports} autre{state.reports > 1 ? 's' : ''} atelier{state.reports > 1 ? 's' : ''}</b></div>}
    {state?.reportedByMe ? <button className="btn btn-ghost btn-sm" onClick={cancel}><ShieldAlert size={15} /> Retirer mon signalement</button>
      : <button className="btn btn-ghost btn-sm" onClick={report}><ShieldAlert size={15} /> Signaler perdu / volé</button>}
  </div>;
}
