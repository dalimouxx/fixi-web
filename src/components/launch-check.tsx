'use client';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Rocket, XCircle } from 'lucide-react';
import { useOnce } from './use-once';

/** Fixi Control → Santé : liste « Prêt pour la mise en ligne ? ». */
export function LaunchCheckPanel() {
  const [n, setN] = useState(0);
  const { data } = useOnce<any>('/api/platform/launch-check', n);
  if (!data) return null;
  const s = data.score;
  return <div className={'control-panel fx-launch ' + (s.ready ? (s.warn ? 'warn' : 'ok') : 'bad')}>
    <div className="panel-head"><div><h3><Rocket size={17} /> Prêt pour la mise en ligne ?</h3>
      <p>{s.ready ? (s.warn ? `L’essentiel est en place · ${s.warn} conseil(s) restant(s).` : 'Tout est prêt. Bonne mise en ligne !') : `${s.bad} point(s) bloquant(s) à régler avant d’ouvrir au public.`}</p></div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setN(x => x + 1)}><RefreshCw size={15} /> Revérifier</button></div>
    <div className="fx-launch-bar" aria-hidden><i style={{ width: `${Math.round((s.done / s.total) * 100)}%` }} /></div>
    <ul className="fx-launch-list">{data.checks.map((c: any) => <li key={c.key} className={c.ok ? 'ok' : c.level}>
      {c.ok ? <CheckCircle2 size={17} /> : c.level === 'bad' ? <XCircle size={17} /> : <AlertTriangle size={17} />}
      <div><b>{c.label}</b>{!c.ok && <small>{c.hint}</small>}</div></li>)}</ul>
  </div>;
}
