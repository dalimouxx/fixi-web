'use client';
import { useState } from 'react';
import { FlaskConical, Trash2, Plus } from 'lucide-react';
import { api, useApi } from './ui';

export function DemoDataCard() {
  const [refresh, setRefresh] = useState(0);
  const { data } = useApi<{ count: number }>('/api/demo-data', refresh);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const count = data?.count || 0;
  async function run(method: 'POST' | 'DELETE') {
    if (method === 'DELETE' && !confirm('Supprimer les réparations et clients d’exemple ? Vos vraies données ne sont pas touchées.')) return;
    setBusy(true); setMsg('');
    try { const r = await api('/api/demo-data', { method }); setMsg(method === 'POST' ? `${r.count} réparations d’exemple ajoutées.` : `${r.deleted} réparations d’exemple supprimées.`); setRefresh(x => x + 1); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }
  return <section className="card card-pad">
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><FlaskConical size={19} /><h2 className="section-title">Données de démonstration</h2></div>
    <div className="page-sub" style={{ marginTop: 4 }}>Des réparations fictives (codes « DEMO-… ») pour découvrir Fixi ou former un employé. Elles se suppriment sans toucher à vos vraies données.</div>
    <div className="toolbar" style={{ marginTop: 14 }}>
      {count > 0
        ? <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run('DELETE')}><Trash2 size={17} /> Supprimer les {count} exemples</button>
        : <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run('POST')}><Plus size={17} /> Ajouter 5 réparations d’exemple</button>}
    </div>
    {msg && <div className="page-sub" style={{ marginTop: 10 }} role="status">{msg}</div>}
  </section>;
}
