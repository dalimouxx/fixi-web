'use client';
import { useMemo, useState } from 'react';
import { api, useApi } from '@/components/ui';
import { FxSheet } from '@/components/fx-sheet';
import { CheckCircle2, Plus, Search, Smartphone, Wrench, HelpCircle, Users, FlaskConical } from 'lucide-react';
import { money } from '@/lib/format';

const types: Record<string, string> = { DISPLAY: 'Écran', BATTERY: 'Batterie', CHARGING: 'Connecteur de charge', CAMERA: 'Caméra', FLEX: 'Nappe', OTHER: 'Autre' };
const level = (x: any): [string, string, any] => x.tested ? ['Testée à l’atelier', 'ok', FlaskConical] : x.confidence === 'VERIFIED' ? ['Vérifiée', 'ok', CheckCircle2] : x.confidence === 'COMMUNITY' ? ['Confirmée par d’autres ateliers', 'info', Users] : ['À confirmer', 'warning', HelpCircle];
const blank = { partReference: '', partName: '', partType: 'DISPLAY', brandId: '', modelId: '', confidence: 'VERIFIED', tested: false, note: '', sourceName: '', sourceUrl: '', inventoryItemId: '', shareCommunity: true };

// « Cette pièce va-t-elle sur ce téléphone ? » : on tape un modèle ou une référence, la réponse s'affiche.
export default function Compatibility() {
  const [q, setQ] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data: rows, loading } = useApi<any[]>(`/api/compatibility?q=${encodeURIComponent(q)}`, refresh);
  const { data: catalog } = useApi<any[]>('/api/device-catalog');
  const { data: stock } = useApi<any[]>('/api/stock');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>(blank);
  const models = useMemo(() => ((catalog || []).find((b: any) => b.id === f.brandId)?.models || []), [catalog, f.brandId]);
  const grouped = useMemo(() => { const m = new Map<string, any[]>(); for (const r of rows || []) { if (!m.has(r.partReference)) m.set(r.partReference, []); m.get(r.partReference)!.push(r); } return [...m.entries()]; }, [rows]);
  async function save(e: React.FormEvent) { e.preventDefault(); try { await api('/api/compatibility', { method: 'POST', body: JSON.stringify({ ...f, inventoryItemId: f.inventoryItemId || null }) }); setOpen(false); setF(blank); setRefresh(x => x + 1); } catch (err: any) { alert(err.message); } }

  return <div className="fx-page">
    <div className="fx-hello"><div><h1>Pièce compatible ?</h1><p>Tapez un téléphone pour voir ses pièces, ou une référence pour voir les téléphones qu’elle couvre.</p></div>
      <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Ajouter</button></div>

    <div className="fx-searchbar fx-searchbar--big"><Search size={22} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Ex. Smart 5, iPhone 13, LCD-SMART5…" aria-label="Téléphone ou référence" /></div>

    {loading && !rows ? <div className="card card-pad fx-skeleton" role="status" aria-label="Recherche"><i /><i /></div> :
      <div className="fx-compat-grid">
        {grouped.map(([ref, list]) => { const first = list[0]; return <article className="fx-panel fx-compat" key={ref}>
          <header><span className="fx-compat-icon"><Wrench /></span><div><small>{types[first.partType] || first.partType}</small><h2>{first.partName}</h2><code>{ref}</code></div>
            {first.inventoryItem && <div className={`fx-compat-stock ${first.inventoryItem.quantity > 0 ? '' : 'is-out'}`}><b>{first.inventoryItem.quantity}</b><span>en stock</span><small>{money(first.inventoryItem.salePrice)}</small></div>}</header>
          <ul>{list.map((x: any) => { const [l, tone, I] = level(x); return <li key={x.id}><Smartphone size={18} /><span><b>{x.model.brand.name} {x.model.name}</b>{x.note && <small>{x.note}</small>}</span><em className={`fx-chip fx-chip--${tone}`}><I size={14} /> {l}</em></li>; })}</ul>
          {first.sourceUrl && <footer><a href={first.sourceUrl} target="_blank" rel="noreferrer">Source : {first.sourceName || 'voir'}</a></footer>}
        </article>; })}
        {q && !grouped.length && <div className="fx-empty"><b>Aucune correspondance pour « {q} »</b><span>Après l’avoir testée, ajoutez-la : tous les ateliers Fixi en profiteront.</span><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Ajouter cette compatibilité</button></div>}
        {!q && !grouped.length && <div className="fx-empty"><b>Commencez par un modèle</b><span>Exemple : « A15 » ou « Redmi Note 12 ».</span></div>}
      </div>}

    <FxSheet open={open} onClose={() => setOpen(false)} side="bottom" title="Ajouter une compatibilité" label="Ajouter une compatibilité">
      <form onSubmit={save} className="fx-form-grid">
        <label className="field span-2"><span className="label">Pièce *</span><input className="input" required value={f.partName} onChange={e => setF({ ...f, partName: e.target.value })} placeholder="Écran Smart 5 compatible" /></label>
        <label className="field"><span className="label">Référence *</span><input className="input" required value={f.partReference} onChange={e => setF({ ...f, partReference: e.target.value })} placeholder="LCD-SMART5" /></label>
        <label className="field"><span className="label">Type</span><select className="select" value={f.partType} onChange={e => setF({ ...f, partType: e.target.value })}>{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span className="label">Marque du téléphone *</span><select className="select" required value={f.brandId} onChange={e => setF({ ...f, brandId: e.target.value, modelId: '' })}><option value="">Choisir…</option>{(catalog || []).map((b: any) => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
        <label className="field"><span className="label">Modèle *</span><select className="select" required value={f.modelId} onChange={e => setF({ ...f, modelId: e.target.value })}><option value="">Choisir…</option>{models.map((m: any) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
        <div className="span-2 fx-segment" role="radiogroup" aria-label="Certitude">{[['VERIFIED', 'Vérifiée'], ['COMMUNITY', 'D’après un collègue'], ['POSSIBLE', 'À confirmer']].map(([v, l]) => <button type="button" role="radio" key={v} aria-checked={f.confidence === v} onClick={() => setF({ ...f, confidence: v })}>{l}</button>)}</div>
        <label className="fx-check span-2"><input type="checkbox" checked={f.tested} onChange={e => setF({ ...f, tested: e.target.checked })} /><span><b>Je l’ai testée moi-même</b></span></label>
        <label className="field span-2"><span className="label">Pièce de mon stock (facultatif)</span><select className="select" value={f.inventoryItemId} onChange={e => setF({ ...f, inventoryItemId: e.target.value })}><option value="">Non liée</option>{(stock || []).map((x: any) => <option value={x.id} key={x.id}>{x.sku} · {x.name}</option>)}</select></label>
        <label className="field span-2"><span className="label">Note technique</span><textarea className="textarea" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Révision, connecteur, châssis, précautions…" /></label>
        <label className="field"><span className="label">Source</span><input className="input" value={f.sourceName} onChange={e => setF({ ...f, sourceName: e.target.value })} placeholder="Fournisseur, site…" /></label>
        <label className="field"><span className="label">Lien de la source</span><input className="input" type="url" value={f.sourceUrl} onChange={e => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://…" /></label>
        <label className="fx-check span-2"><input type="checkbox" checked={f.shareCommunity !== false} onChange={e => setF({ ...f, shareCommunity: e.target.checked })} /><span><b>Partager avec les autres ateliers Fixi</b><small>Sans aucune donnée client.</small></span></label>
        <button className="btn btn-primary btn-block span-2">Enregistrer</button>
      </form>
    </FxSheet>
  </div>;
}
