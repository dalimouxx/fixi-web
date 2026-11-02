'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { haptic } from '@/lib/haptics';

// Bouton micro à côté d'un champ : le réparateur parle, le texte s'ajoute au champ.
// Langue : arabe si l'interface est en arabe, sinon français. Masqué si le navigateur ne sait pas dicter.
export function DictateButton({ onText, label = 'Dicter' }: { onText: (text: string) => void; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  useEffect(() => { setSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); return () => rec.current?.abort?.(); }, []);
  if (!supported) return null;
  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new C();
    r.lang = document.documentElement.lang === 'ar' ? 'ar-TN' : 'fr-FR';
    r.interimResults = false; r.continuous = false;
    r.onresult = (e: any) => { const t = String(e.results?.[0]?.[0]?.transcript || '').trim(); if (t) { onText(t.charAt(0).toUpperCase() + t.slice(1)); haptic('success'); } };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; setListening(true); haptic('tap'); r.start();
  }
  return <button type="button" className={`fx-dictate ${listening ? 'is-listening' : ''}`} onClick={toggle} aria-pressed={listening} aria-label={listening ? 'Arrêter la dictée' : label} title={label}>
    {listening ? <Square size={16} /> : <Mic size={18} />}<span>{listening ? 'J’écoute…' : label}</span>
  </button>;
}
