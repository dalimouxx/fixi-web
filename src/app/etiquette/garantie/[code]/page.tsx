import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dateOnly } from '@/lib/format';
import { QrCanvas, PrintNow } from '@/components/qr-canvas';
import '@/app/fixi-astuces.css';

/** Étiquette garantie (50 × 30 mm) à coller sur l'appareil réparé : le client la scanne pour voir sa garantie et revient chez vous. */
export default async function WarrantyLabel({ params }: { params: Promise<{ code: string }> }) {
  const s = await getSession(); if (!s) { redirect('/login'); return null; }
  const { code } = await params;
  const r = await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code: decodeURIComponent(code) } }, include: { shop: { select: { name: true, phone: true, slug: true } }, digitalWarranty: true } });
  if (!r) notFound();
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const ends = r.digitalWarranty?.endsAt || new Date(Date.now() + r.warrantyDays * 86400_000);
  const url = r.digitalWarranty ? `${base}/warranty/${r.digitalWarranty.publicToken}` : `${base}/track/${encodeURIComponent(r.code)}?shop=${encodeURIComponent(r.shop.slug)}&t=${encodeURIComponent(r.publicToken)}`;
  return <div className="wl-page">
    <PrintNow label="Imprimer l’étiquette" />
    {!r.digitalWarranty && <p className="wl-note no-print">L’appareil n’est pas encore rendu : la garantie démarrera à la remise. Le QR mène au suivi en attendant.</p>}
    <article className="wl">
      <QrCanvas value={url} size={84} />
      <div><b>{r.shop.name}</b><span>Réparé · garantie {r.warrantyDays} j</span><span>jusqu’au <strong>{dateOnly(ends)}</strong></span><small>{r.code}{r.shop.phone ? ` · ${r.shop.phone}` : ''}</small><em>Scannez en cas de souci</em></div>
    </article>
  </div>;
}
