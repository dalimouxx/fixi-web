import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { decryptSecret } from '@/lib/crypto';
import { money, dateOnly } from '@/lib/format';
import { conditionLabel, storageLabel } from '@/lib/used-devices';
import { PrintButton } from '@/components/print-button';
import '@/app/fixi-occasion.css';

/** Registre des achats d'occasion (gérant) : chronologique, identité complète du vendeur, à présenter en cas de contrôle. */
export default async function UsedRegister({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const s = await getSession(); if (!s) { redirect('/login'); return null; }
  if (s.role !== 'ADMIN') return <div className="occ-reg-page"><p>Le registre est réservé au gérant.</p></div>;
  const sp = await searchParams;
  const from = sp.from ? new Date(sp.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = sp.to ? new Date(sp.to + 'T23:59:59') : new Date();
  const [shop, rows] = await Promise.all([
    prisma.shop.findUniqueOrThrow({ where: { id: s.shopId }, select: { name: true, address: true, taxId: true, currency: true } }),
    prisma.usedDevice.findMany({ where: { shopId: s.shopId, purchasedAt: { gte: from, lte: to } }, orderBy: { purchasedAt: 'asc' }, include: { buyer: { select: { fullName: true, phone: true } } } }),
  ]);
  await audit(s.shopId, s.id, 'VIEW_REGISTER', 'USED_DEVICE', undefined, { count: rows.length });
  const q = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;
  return <div className="occ-reg-page"><style>{'@media print{@page{size:A4 landscape;margin:10mm}}'}</style>
    <div className="no-print occ-att-tools"><form><label>Du <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} /></label><label>au <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} /></label><button>Afficher</button></form><a href={`/api/used-devices/register?${q}&format=csv`}>Excel (CSV)</a><PrintButton label="Imprimer le registre" /></div>
    <h1>Registre des téléphones d’occasion</h1>
    <p className="occ-reg-sub">{shop.name}{shop.address ? ` · ${shop.address}` : ''}{shop.taxId ? ` · MF ${shop.taxId}` : ''} — du {dateOnly(from)} au {dateOnly(to)} · {rows.length} achat(s)</p>
    <table className="occ-reg"><thead><tr><th>N°</th><th>Date</th><th>Appareil</th><th>IMEI</th><th>État</th><th>Prix d’achat</th><th>Vendeur</th><th>Pièce</th><th>Revente</th></tr></thead>
      <tbody>{rows.map(d => <tr key={d.id}><td>{d.number}</td><td>{dateOnly(d.purchasedAt)}</td><td>{d.brand} {d.model}{d.storageGb ? ` ${storageLabel(d.storageGb)}` : ''}{d.color ? ` (${d.color})` : ''}</td><td className="mono">{d.imei}</td><td>{conditionLabel(d.condition)}</td><td>{money(Number(d.purchasePrice), shop.currency)}</td><td>{d.sellerName}{d.sellerPhone ? <><br />{d.sellerPhone}</> : null}{d.sellerAddress ? <><br />{d.sellerAddress}</> : null}</td><td>{d.sellerIdType} {decryptSecret(d.sellerIdEncrypted)}</td><td>{d.soldAt ? <>{dateOnly(d.soldAt)} · {money(Number(d.soldPrice), shop.currency)}{d.buyer ? <><br />{d.buyer.fullName}</> : null}</> : '—'}</td></tr>)}</tbody></table>
  </div>;
}
