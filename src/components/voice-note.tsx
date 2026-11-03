'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, Trash2 } from 'lucide-react';
import { haptic } from '@/lib/haptics';

const MAX_SECONDS = 60;

// Note vocale du technicien : jusqu'à 60 s, enregistrée avec la réparation.
export function VoiceNote({ code, onSaved }: { code: string; onSaved?: () => void }) {
  const [supported, setSupported] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<any>(null);
  const url = blob ? URL.createObjectURL(blob) : '';
  useEffect(() => { setSupported(typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => clearInterval(timer.current), []);
  if (!supported) return null;

  async function start() {
    setError(''); setBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
      const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 24000 } : undefined);
      const chunks: BlobPart[] = [];
      r.ondataavailable = e => e.data.size && chunks.push(e.data);
      r.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(timer.current); setBlob(new Blob(chunks, { type: (r.mimeType || 'audio/webm').split(';')[0] })); setRec(null); };
      r.start(); setRec(r); setSecs(0); haptic('tap');
      timer.current = setInterval(() => setSecs(s => { if (s + 1 >= MAX_SECONDS) r.stop(); return s + 1; }), 1000);
    } catch { setError('Micro refusé : autorisez-le dans le navigateur.'); }
  }
  async function save() {
    if (!blob) return; setBusy(true); setError('');
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const f = new FormData(); f.append('file', new File([blob], `note-${code}.${ext}`, { type: blob.type })); f.append('type', 'VOICE_NOTE');
      const r = await fetch(`/api/repairs/${encodeURIComponent(code)}/attachments`, { method: 'POST', body: f });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Envoi impossible');
      setBlob(null); haptic('success'); onSaved?.();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="fx-panel fx-voice-note" aria-label="Note vocale">
    <div className="fx-panel-head"><h2>Note vocale</h2><small>{rec ? `${secs} s / ${MAX_SECONDS} s` : 'Expliquez en parlant au lieu d’écrire'}</small></div>
    {!blob ? <button type="button" className={`btn ${rec ? 'btn-danger' : 'btn-soft'} btn-block`} onClick={() => rec ? rec.stop() : start()}>{rec ? <><Square size={18} /> Arrêter</> : <><Mic size={18} /> Enregistrer une note</>}</button>
      : <div className="fx-voice-preview"><audio src={url} controls /><div className="fx-voice-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setBlob(null)}><Trash2 size={16} /> Refaire</button><button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}><Send size={16} /> {busy ? 'Envoi…' : 'Enregistrer'}</button></div></div>}
    {error && <small className="push-error" role="alert">{error}</small>}
  </section>;
}
