'use client';
import { useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, DatabaseBackup, History, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, useApi } from './ui';
import { dateTime } from '@/lib/format';
import { LaunchCheckPanel } from './launch-check';

const KIND: Record<string, string> = { SERVER_ERROR: 'Serveur', CLIENT_ERROR: 'Navigateur', BACKUP_FAIL: 'Sauvegarde', BACKUP_MISSING: 'Sauvegarde', RESTORE_TEST_FAIL: 'Restauration' };
const ago = (d?: string) => { if (!d) return '—'; const h = (Date.now() - new Date(d).getTime()) / 3600_000; return h < 1 ? `il y a ${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `il y a ${Math.round(h)} h` : `il y a ${Math.round(h / 24)} j`; };

/** Fixi Control : état des sauvegardes, test de restauration et erreurs regroupées. */
export function PlatformHealth() {
  const [n, setN] = useState(0); const [msg, setMsg] = useState('');
  const { data } = useApi<any>('/api/platform/health', n);
  async function act(body: any, done: string) { setMsg(''); try { await api('/api/platform/health', { method: 'POST', body: JSON.stringify(body) }); setMsg(done); setN(x => x + 1); } catch (e: any) { setMsg(e.message); } }
  if (!data) return <section className="control-content"><div className="control-panel">Chargement…</div></section>;
  const bAge = data.backup ? (Date.now() - new Date(data.backup.lastAt).getTime()) / 3600_000 : Infinity;
  const bOk = bAge <= 26 && !data.backupFail;
  const rOk = data.restore?.kind === 'RESTORE_TEST_OK';
  const ch = data.channels || {};
  return <section className="control-content ph">
    <LaunchCheckPanel />
    <div className="ph-cards">
      <div className={'ph-card ' + (bOk ? 'ok' : 'bad')}><DatabaseBackup /><div><span>Dernière sauvegarde</span><b>{data.backup ? ago(data.backup.lastAt) : 'Aucune'}</b><small>{data.backupFail ? `Échec ${ago(data.backupFail.lastAt)}` : data.backup?.message || (data.backupExpected ? 'Attendue chaque nuit' : 'Sauvegarde non configurée (voir deploy/vps/README.md)')}</small></div></div>
      <div className={'ph-card ' + (rOk ? 'ok' : data.restore ? 'bad' : 'warn')}><History /><div><span>Test de restauration</span><b>{data.restore ? ago(data.restore.lastAt) : 'Jamais'}</b><small>{data.restore?.message || 'Lancé chaque semaine par le service de sauvegarde'}</small></div></div>
      <div className={'ph-card ' + (data.errorsLast24h ? 'warn' : 'ok')}><AlertTriangle /><div><span>Erreurs (24 h)</span><b>{data.errorsLast24h}</b><small>{data.errors.length} problème(s) ouvert(s)</small></div></div>
      <div className={'ph-card ' + (ch.telegram || ch.webhook ? 'ok' : 'warn')}><BellRing /><div><span>Alertes téléphone</span><b>{[ch.telegram && 'Telegram', ch.webhook && 'Webhook'].filter(Boolean).join(' + ') || 'Non configurées'}</b><small><button type="button" className="ph-link" onClick={() => act({ action: 'test-alert' }, 'Alerte de test envoyée.')}>Envoyer une alerte de test</button></small></div></div>
    </div>
    {msg && <p className="ph-msg" role="status">{msg}</p>}
    <div className="control-panel">
      <div className="panel-head"><h3><ShieldCheck size={17} /> Problèmes ouverts</h3><div className="ph-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setN(x => x + 1)}><RefreshCw size={15} /> Actualiser</button>{data.errors.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => act({ action: 'resolve-all' }, 'Erreurs rangées.')}>Tout marquer corrigé</button>}</div></div>
      {data.errors.length ? <div className="ph-list">{data.errors.map((e: any) => <div key={e.id} className="ph-row">
        <em className={'ph-kind ' + (e.kind === 'CLIENT_ERROR' ? 'c' : 's')}>{KIND[e.kind] || e.kind}</em>
        <div className="ph-main"><b>{e.message}</b><small>{e.details?.path || ''}{e.count > 1 ? ` · ${e.count} fois` : ''} · {ago(e.lastAt)} · depuis {dateTime(e.firstAt)}</small></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => act({ action: 'resolve', id: e.id }, 'Problème rangé.')}><CheckCircle2 size={15} /> Corrigé</button>
      </div>)}</div> : <p className="ph-empty"><CheckCircle2 size={18} /> Aucun problème ouvert. Tout va bien.</p>}
    </div>
  </section>;
}
