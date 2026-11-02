import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LabelTools } from '@/components/label-tools';

// Étiquette à coller sur l'appareil à la réception (rouleau 50 × 30 mm ou papier A4).
// Le QR ouvre la fiche de la réparation dans Fixi ; le code-barres se scanne dans la recherche.
export default async function Label({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await getSession();
  if (!s) { redirect('/login'); return null; }
  const { code } = await params;
  const sp = await searchParams;
  const r = await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code } }, include: { client: { select: { fullName: true, phone: true } }, shop: { select: { name: true } } } });
  if (!r) notFound();
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const url = `${base}/app/repairs/${encodeURIComponent(r.code)}`;
  const copies = Math.max(1, Math.min(4, Number(sp.n || 1) || 1));
  const device = [r.brand, r.model].filter(Boolean).join(' ');
  const date = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(r.createdAt);
  const phone = String(r.client.phone || '').replace(/\D/g, '');
  return <div className="fx-label-page">
    {Array.from({ length: copies }).map((_, i) => <div className="fx-label" key={i}>
      <div className="fx-label-main">
        <b className="fx-label-code">{r.code}</b>
        <span className="fx-label-client">{r.client.fullName}</span>
        <span className="fx-label-device">{device}</span>
        <span className="fx-label-issue">{r.reportedIssue}</span>
        <span className="fx-label-foot">{date}{phone ? ` · …${phone.slice(-3)}` : ''}{r.priority === 'URGENT' ? ' · URGENT' : ''}</span>
      </div>
      <div className="fx-label-qr" data-url={url} data-code={r.code} />
    </div>)}
    <LabelTools code={r.code} url={url} copies={copies} />
  </div>;
}
