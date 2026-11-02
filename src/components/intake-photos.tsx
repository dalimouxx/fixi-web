'use client';
import { useEffect, useMemo } from 'react';
import { Camera, X, ShieldCheck } from 'lucide-react';

export const MAX_INTAKE_PHOTOS = 4;

// Photos de l'appareil à la prise en charge : l'appareil photo arrière s'ouvre directement.
// Les fichiers sont envoyés juste après la création de la réparation (type « Avant réparation »).
export function IntakePhotos({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const urls = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls]);
  return <div className="fx-intake-photos">
    <div className="fx-intake-photos-head"><ShieldCheck size={18} /><span><b>Photos de l’appareil</b><small>Rayures, écran déjà fêlé… protège l’atelier en cas de litige.</small></span></div>
    <div className="fx-intake-photos-row">
      {urls.map((u, i) => <figure key={u}><img src={u} alt={`Photo ${i + 1}`} /><button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => onChange(files.filter((_, j) => j !== i))}><X size={14} /></button></figure>)}
      {files.length < MAX_INTAKE_PHOTOS && <label className="fx-intake-add">
        <Camera size={22} /><span>{files.length ? 'Une autre' : 'Prendre une photo'}</span>
        <input type="file" accept="image/*" capture="environment" hidden onChange={async e => { const input = e.currentTarget; const f = input.files?.[0]; input.value = ''; if (f) onChange([...files, await compressPhoto(f)].slice(0, MAX_INTAKE_PHOTOS)); }} />
      </label>}
    </div>
  </div>;
}

export async function uploadIntakePhotos(code: string, files: File[]) {
  let failed = 0;
  for (const file of files) {
    const f = new FormData(); f.append('file', file); f.append('type', 'BEFORE');
    const r = await fetch(`/api/repairs/${encodeURIComponent(code)}/attachments`, { method: 'POST', body: f }).catch(() => null);
    if (!r || !r.ok) failed++;
  }
  return failed;
}

/** Réduit une photo de téléphone (souvent 4 à 8 Mo) à environ 1600 px en JPEG : envoi rapide, même en 3G. */
export function compressPhoto(file: File, max = 1600): Promise<File> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d'); if (!ctx) { URL.revokeObjectURL(url); return resolve(file); }
      ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => resolve(b ? new File([b], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
