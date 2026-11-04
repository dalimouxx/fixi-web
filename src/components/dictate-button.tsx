'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { speechSupported, startDictation } from '@/lib/speech';

// Bouton micro à côté d'un champ : le réparateur parle, le texte s'ajoute au champ.
// Langue : arabe si l'interface est en arabe, sinon français. Masqué si le navigateur ne sait pas dicter.
export function DictateButton({ onText, label = 'Dicter' }: { onText: (text: string) => void; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<any>(null);
  useEffect(() => { setSupported(speechSupported()); return () => rec.current?.abort?.(); }, []);
  useEffect(() => { if (!error) return; const t = setTimeout(() => setError(''), 6000); return () => clearTimeout(t); }, [error]);
  if (!supported) return null;
  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    setError(''); setLive(''); setListening(true); haptic('tap');
    rec.current = startDictation({
      onText: t => { onText(t); haptic('success'); },
      onInterim: setLive,
      onEnd: () => { setListening(false); setLive(''); },
      onError: m => { setError(m); setListening(false); haptic('error'); },
    });
  }
  return <span className="fx-dictate-wrap">
    <button type="button" className={`fx-dictate ${listening ? 'is-listening' : ''}`} onClick={toggle} aria-pressed={listening} aria-label={listening ? 'Arrêter la dictée' : label} title={label}>
      {listening ? <Square size={16} /> : <Mic size={18} />}<span>{listening ? 'J’écoute…' : label}</span>
    </button>
    {(live || error) && <span className={`fx-dictate-bubble ${error ? 'is-error' : ''}`} role="status">{error || live}</span>}
  </span>;
}
