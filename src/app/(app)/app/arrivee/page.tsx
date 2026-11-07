'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { useApi } from '@/components/ui';
import '@/app/fixi-astuces.css';

/** Affiche à imprimer pour le comptoir : QR code d'enregistrement autonome des clients. */
export default function CheckInPoster() {
  const { data } = useApi<any>('/api/checkins'); const canvas = useRef<HTMLCanvasElement>(null); const [url, setUrl] = useState('');
  useEffect(() => { if (!data?.slug) return; const u = `${window.location.origin}/arrivee/${data.slug}`; setUrl(u); if (canvas.current) void QRCode.toCanvas(canvas.current, u, { width: 520, margin: 1 }); }, [data?.slug]);
  return <div className="fx-page ci-poster-page">
    <div className="no-print ci-poster-tools"><p>Imprimez cette affiche et posez-la sur le comptoir : les clients s’enregistrent eux-mêmes et apparaissent dans <b>Nouvelle réparation</b>.</p><button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> Imprimer l’affiche</button></div>
    <article className="ci-poster"><h1>Gagnez du temps !</h1><p>Scannez avec votre téléphone pour vous enregistrer</p><canvas ref={canvas} aria-label="QR code d’enregistrement" /><ol><li>Scannez le code</li><li>Indiquez votre nom et la panne</li><li>On vous appelle au comptoir</li></ol><small>{url}</small></article>
  </div>;
}
