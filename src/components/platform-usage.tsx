'use client';
import { useState } from 'react';
import { useApi } from './ui';
import { atelierNav } from '@/lib/nav-atelier';

const labelFor = (path: string) => {
  for (const s of atelierNav) for (const i of s.items) if (path === i.href) return `${i.label} · ${s.label}`;
  if (path.startsWith('/app/repairs/')) return 'Fiche réparation';
  if (path.startsWith('/app/clients/')) return 'Fiche client';
  return path;
};

// Fixi Control : écrans réellement ouverts par les boutiques. Ce qui n'est jamais
// utilisé est candidat à être masqué ou retiré.
export function PlatformUsage() {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useApi<any>(`/api/platform/usage?days=${days}`);
  const max = Math.max(1, ...(data?.screens || []).map((s: any) => s.views));
  const used = new Set((data?.screens || []).map((s: any) => s.path));
  const never = atelierNav.flatMap(s => s.items).filter(i => !used.has(i.href));
  return <section className="control-content">
    <div className="fx-panel">
      <div className="fx-panel-head">
        <h2>Écrans utilisés par les boutiques</h2>
        <select className="select" style={{ width: 160 }} value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Période">
          <option value={7}>7 derniers jours</option><option value={30}>30 derniers jours</option><option value={90}>90 derniers jours</option>
        </select>
      </div>
      {error && <div className="error">{error}</div>}
      {loading && !data && <div className="page-sub">Chargement…</div>}
      {data && <>
        <div className="page-sub" style={{ marginBottom: 12 }}>{data.activeShops} boutique(s) active(s) · Mode Simple : {data.modes?.simple || 0} vues · Mode Avancé : {data.modes?.advanced || 0} vues</div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Écran</th><th>Vues</th><th>Boutiques</th><th style={{ width: '35%' }}></th></tr></thead><tbody>
          {data.screens.map((s: any) => <tr key={s.path}><td>{labelFor(s.path)}</td><td>{s.views}</td><td>{s.shops}</td>
            <td><div aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'var(--fx-brand)', width: `${Math.max(2, (s.views / max) * 100)}%` }} /></td></tr>)}
          {!data.screens.length && <tr><td colSpan={4} className="muted">Aucune donnée encore : les vues sont enregistrées depuis cette version.</td></tr>}
        </tbody></table></div>
        {never.length > 0 && data.screens.length > 0 && <div className="fx-help-tip"><b>Jamais ouverts sur la période :</b> {never.map(i => i.label).join(' · ')}</div>}
      </>}
    </div>
  </section>;
}
