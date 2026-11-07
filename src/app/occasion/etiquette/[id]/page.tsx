import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { money } from '@/lib/format';
import { conditionLabel, storageLabel } from '@/lib/used-devices';
import { UsedLabelBarcode, UsedLabelToolbar } from '@/components/used-label-tools';
import '@/app/fixi-occasion.css';

/** Étiquette vitrine : « iPhone 15 · 256 Go · Excellent état · Batterie 80 % · 2 450 DT ». */
export default async function UsedLabel({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession(); if (!s) { redirect('/login'); return null; }
  const { id } = await params;
  const d = await prisma.usedDevice.findFirst({ where: { shopId: s.shopId, OR: [{ id }, { number: id }] }, include: { shop: { select: { name: true, currency: true, phone: true } } } });
  if (!d) notFound();
  const name = /^iphone|^galaxy|^redmi|^pixel/i.test(d.model) ? d.model : `${d.brand} ${d.model}`;
  return <div className="occ-lbl-page">
    <UsedLabelToolbar />
    <article className="occ-lbl">
      <header><b>{name}</b>{d.storageGb && <span className="occ-lbl-gb">{storageLabel(d.storageGb)}</span>}</header>
      <div className="occ-lbl-specs">
        <span>{conditionLabel(d.condition)}</span>
        {d.batteryHealth != null && <span>🔋 Batterie {d.batteryHealth} %</span>}
        {d.color && <span>{d.color}</span>}
        {d.warrantyDays > 0 && <span>✓ Garantie {d.warrantyDays} j</span>}
      </div>
      <div className="occ-lbl-price">{d.askingPrice ? money(Number(d.askingPrice), d.shop.currency) : 'Prix en boutique'}</div>
      <footer><UsedLabelBarcode value={d.number} /><small>{d.number} · IMEI …{String(d.imei || '').slice(-5)} · {d.shop.name}</small></footer>
    </article>
  </div>;
}
