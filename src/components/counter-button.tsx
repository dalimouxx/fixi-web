'use client';
import { useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { api } from './ui';

// Envoie la réparation sur l'écran tourné vers le client (tablette du comptoir, page /comptoir).
export function CounterButton({ code }: { code: string }) {
  const [sent, setSent] = useState(false);
  async function send() { try { await api('/api/counter', { method: 'PUT', body: JSON.stringify({ code }) }); setSent(true); setTimeout(() => setSent(false), 2500); } catch (e: any) { alert(e.message); } }
  return <button className="btn btn-ghost" onClick={send} title="Ouvrez /comptoir sur la tablette tournée vers le client"><MonitorSmartphone size={17} /> {sent ? 'Affiché au client ✓' : 'Montrer au client'}</button>;
}
