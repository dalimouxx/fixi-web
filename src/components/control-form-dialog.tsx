'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { humanError } from '@/lib/human-error';

export type FormField = {
  name: string; label: string; type?: 'text' | 'number' | 'select' | 'textarea' | 'date';
  options?: [string, string][]; required?: boolean; placeholder?: string; defaultValue?: string; hint?: string;
};

/** Petite fenêtre de saisie de Fixi Control (remplace les boîtes « prompt » du navigateur). */
export function FormDialog({ title, subtitle, fields, submitLabel = 'Enregistrer', onSubmit, onClose }: {
  title: string; subtitle?: string; fields: FormField[]; submitLabel?: string;
  onSubmit: (values: Record<string, string>) => Promise<void>; onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.name, f.defaultValue ?? ''])));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await onSubmit(v); onClose(); } catch (x) { setErr(humanError(x)); } finally { setBusy(false); }
  }
  return createPortal(<div className="fx-support-modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <form className="fx-support-card" onSubmit={submit}>
      <header><div><b>{title}</b>{subtitle && <small>{subtitle}</small>}</div><button type="button" className="fx-icon-btn" aria-label="Fermer" onClick={onClose}><X size={16} /></button></header>
      {fields.map(f => <label key={f.name} className="field" style={{ display: 'grid', gap: 6 }}>
        <span className="label">{f.label}{f.required ? ' *' : ''}</span>
        {f.type === 'select'
          ? <select className="input" required={f.required} value={v[f.name]} onChange={e => setV({ ...v, [f.name]: e.target.value })}>
              <option value="">Choisir…</option>{(f.options || []).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
            </select>
          : f.type === 'textarea'
            ? <textarea className="input" rows={3} required={f.required} placeholder={f.placeholder} value={v[f.name]} onChange={e => setV({ ...v, [f.name]: e.target.value })} />
            : <input className="input" type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} required={f.required} placeholder={f.placeholder} value={v[f.name]} onChange={e => setV({ ...v, [f.name]: e.target.value })} />}
        {f.hint && <small className="muted">{f.hint}</small>}
      </label>)}
      {err && <div className="error" role="alert">{err}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy && <Loader2 size={16} className="ps-spin" />} {submitLabel}</button>
    </form>
  </div>, document.body);
}
