'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, Megaphone, Phone, Power, Radar, Send, StopCircle, Wrench } from 'lucide-react';
import { api } from './ui';
import { useOnce } from './use-once';
import { dateTime } from '@/lib/format';
import { SupportAccessButton } from './support-access';

const AUD: Record<string, string> = { ALL: 'Tout le monde', SHOPS: 'Ateliers', SUPPLIERS: 'Fournisseurs', DRIVERS: 'Livreurs' };

/** Mode maintenance : un interrupteur, un message, une durée. */
export function MaintenancePanel() {
  const [n, setN] = useState(0);
  const { data } = useOnce<any>('/api/platform/maintenance', n);
  const [message, setMessage] = useState(''); const [minutes, setMinutes] = useState(15); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (data?.message) setMessage(data.message); }, [data?.message]);
  async function set(enabled: boolean) {
    if (enabled && !confirm('Activer la maintenance ? Tous les ateliers, fournisseurs et livreurs verront l’écran d’attente (vous gardez l’accès).')) return;
    setBusy(true); setErr('');
    try { await api('/api/platform/maintenance', { method: 'POST', body: JSON.stringify({ enabled, message, minutes }) }); setN(x => x + 1); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const on = !!data?.enabled;
  return <div className={'control-panel fx-ops-mnt' + (on ? ' is-on' : '')}>
    <div className="panel-head"><div><h3><Wrench size={17} /> Mode maintenance</h3><p>{on ? `Actif depuis ${dateTime(data.startedAt)}${data.until ? ` · fin prévue ${dateTime(data.until)}` : ''}` : 'Pendant une mise à jour : écran d’attente animé pour tout le monde sauf vous.'}</p></div>
      <span className={'status-pill ' + (on ? 'active' : 'paused')}>{on ? 'ACTIF' : 'ARRÊTÉ'}</span></div>
    <label className="label" htmlFor="fx-mnt-msg">Message affiché</label>
    <input id="fx-mnt-msg" className="input" maxLength={300} value={message} onChange={e => setMessage(e.target.value)} placeholder="Fixi revient dans quelques minutes, encore plus rapide." />
    <div className="fx-ops-chips" role="group" aria-label="Durée prévue">{[5, 15, 30, 60].map(m => <button key={m} type="button" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>)}<button type="button" aria-pressed={minutes === 0} onClick={() => setMinutes(0)}>Sans durée</button></div>
    {err && <p className="error">{err}</p>}
    <div className="fx-ops-row">
      {on ? <button className="btn btn-success" disabled={busy} onClick={() => set(false)}><Power size={16} /> Terminer la maintenance</button>
        : <button className="btn btn-danger" disabled={busy} onClick={() => set(true)}><Power size={16} /> Activer la maintenance</button>}
      {on && <button className="btn btn-soft" disabled={busy} onClick={() => set(true)}>Mettre à jour le message</button>}
      <a className="btn btn-ghost" href="/maintenance-apercu" target="_blank" rel="noreferrer"><Eye size={16} /> Aperçu</a>
    </div>
  </div>;
}

/** Annonces : bandeau dans les applications. */
export function AnnouncementsPanel() {
  const [n, setN] = useState(0);
  const { data } = useOnce<any[]>('/api/platform/announcements', n);
  const [f, setF] = useState({ title: '', message: '', audience: 'ALL', tone: 'INFO', region: '', days: 3, href: '', notify: false });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try { const r: any = await api('/api/platform/announcements', { method: 'POST', body: JSON.stringify(f) }); setMsg(`Annonce publiée${r.notified ? ` · ${r.notified} atelier(s) notifié(s)` : ''}.`); setF({ ...f, title: '', message: '', href: '' }); setN(x => x + 1); }
    catch (x: any) { setMsg(x.message); } finally { setBusy(false); }
  }
  async function stop(id: string) { await api('/api/platform/announcements', { method: 'PATCH', body: JSON.stringify({ id }) }).catch(() => {}); setN(x => x + 1); }
  const live = (data || []).filter(a => a.active && (!a.endsAt || new Date(a.endsAt).getTime() > Date.now()));
  return <div className="control-panel fx-ops-ann">
    <div className="panel-head"><div><h3><Megaphone size={17} /> Annonces</h3><p>Un bandeau en haut des applications : nouveauté, coupure prévue, conseil…</p></div></div>
    <form onSubmit={send} className="fx-ops-form">
      <input className="input" required maxLength={90} placeholder="Titre (ex. Nouveau : export Excel)" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <textarea className="input" required maxLength={400} rows={2} placeholder="Message" value={f.message} onChange={e => setF({ ...f, message: e.target.value })} />
      <div className="fx-ops-chips">{Object.entries(AUD).map(([k, l]) => <button type="button" key={k} aria-pressed={f.audience === k} onClick={() => setF({ ...f, audience: k })}>{l}</button>)}</div>
      <div className="fx-ops-chips">{[['INFO', 'ℹ️ Info'], ['SUCCESS', '✅ Bonne nouvelle'], ['WARNING', '⚠️ Important']].map(([k, l]) => <button type="button" key={k} aria-pressed={f.tone === k} onClick={() => setF({ ...f, tone: k })}>{l}</button>)}</div>
      <div className="fx-ops-grid">
        <input className="input" placeholder="Région (facultatif)" value={f.region} onChange={e => setF({ ...f, region: e.target.value })} />
        <select className="input" value={f.days} onChange={e => setF({ ...f, days: Number(e.target.value) })}>{[1, 3, 7, 14, 30, 0].map(d => <option key={d} value={d}>{d ? `${d} jour${d > 1 ? 's' : ''}` : 'Jusqu’à arrêt'}</option>)}</select>
        <input className="input" placeholder="Lien (facultatif) : /app/stock" value={f.href} onChange={e => setF({ ...f, href: e.target.value })} />
      </div>
      <label className="toggle-line"><input type="checkbox" checked={f.notify} onChange={e => setF({ ...f, notify: e.target.checked })} /><span>Envoyer aussi en notification aux ateliers</span></label>
      {msg && <p className="ph-msg" role="status">{msg}</p>}
      <button className="btn btn-primary" disabled={busy}><Send size={15} /> Publier l’annonce</button>
    </form>
    {live.length > 0 && <div className="fx-ops-live">{live.map(a => <div key={a.id} className="tool-row"><div><strong>{a.title}</strong><small>{AUD[a.audience]}{a.region ? ' · ' + a.region : ''} · {a.endsAt ? 'jusqu’au ' + dateTime(a.endsAt) : 'sans fin'}</small></div><button className="btn btn-ghost btn-sm" onClick={() => void stop(a.id)}><StopCircle size={14} /> Arrêter</button></div>)}</div>}
  </div>;
}

/** Boutiques à surveiller pendant le test réel. */
export function WatchlistPanel() {
  const { data } = useOnce<any>('/api/platform/watchlist', 0);
  return <div className="control-panel span2 fx-watch">
    <div className="panel-head"><div><h3><Radar size={17} /> Boutiques à surveiller</h3><p>{data ? `${data.rows.length} sur ${data.total} : à appeler ou à aider en priorité.` : 'Chargement…'}</p></div></div>
    {data?.rows?.length === 0 && <p className="muted">Toutes les boutiques vont bien 🎉</p>}
    <div className="fx-watch-list">{(data?.rows || []).map((r: any) => <article key={r.id} className={'fx-watch-row' + (r.score >= 5 ? ' is-hot' : '')}>
      <div><b>{r.name}</b><small>{r.region}{r.lastSeenAt ? ' · vue ' + dateTime(r.lastSeenAt) : ''}</small>
        <div className="fx-watch-tags">{r.reasons.map((x: any) => <span key={x.code} className={'fx-watch-tag w' + x.weight}>{x.weight >= 3 && <AlertTriangle size={11} />}{x.label}</span>)}</div></div>
      <div className="fx-watch-act">{r.phone && <a className="btn btn-ghost btn-sm" href={'tel:' + r.phone}><Phone size={14} /> Appeler</a>}<SupportAccessButton kind="SHOP" id={r.id} name={r.name} compact defaultReason="Suivi pendant le test réel" /></div>
    </article>)}</div>
  </div>;
}
