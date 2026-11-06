import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { decryptSecret } from '@/lib/crypto';
import { money, dateTime, dateOnly } from '@/lib/format';
import { amountInWords } from '@/lib/tn-invoice';
import { conditionLabel, storageLabel } from '@/lib/used-devices';
import { PrintButton } from '@/components/print-button';
import '@/app/fixi-occasion.css';

/** Attestation d'achat (déclaration de cession) en deux exemplaires, à signer par le vendeur et l'atelier. */
export default async function UsedAttestation({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession(); if (!s) { redirect('/login'); return null; }
  if (!['ADMIN', 'RECEPTION', 'CASHIER'].includes(String(s.role))) return <div className="occ-att-page"><p>Accès réservé au gérant, à l’accueil et à la caisse.</p></div>;
  const { id } = await params;
  const d = await prisma.usedDevice.findFirst({ where: { shopId: s.shopId, OR: [{ id }, { number: id }] }, include: { shop: true, boughtBy: { select: { fullName: true } } } });
  if (!d) notFound();
  await audit(s.shopId, s.id, 'PRINT_ATTESTATION', 'USED_DEVICE', d.id, { number: d.number });
  const idNumber = decryptSecret(d.sellerIdEncrypted) || '';
  const idLabel = d.sellerIdType === 'PASSPORT' ? 'passeport' : d.sellerIdType === 'SEJOUR' ? 'carte de séjour' : 'CIN';
  const cur = d.shop.currency;
  const copy = (who: string) => <article className="occ-att">
    <header><div><b>{d.shop.name}</b><small>{[d.shop.address, d.shop.phone, d.shop.taxId ? `MF ${d.shop.taxId}` : ''].filter(Boolean).join(' · ')}</small></div><div className="occ-att-ref"><b>{d.number}</b><small>{dateTime(d.purchasedAt)}</small><em>{who}</em></div></header>
    <h1>Attestation de vente d’un téléphone d’occasion</h1>
    <p>Je soussigné(e) <b>{d.sellerName}</b>, titulaire de la {idLabel} n° <b>{idNumber}</b>{d.sellerIdIssuedAt ? <> délivrée le {dateOnly(d.sellerIdIssuedAt)}</> : null}{d.sellerAddress ? <>, demeurant {d.sellerAddress}</> : null}{d.sellerPhone ? <>, téléphone {d.sellerPhone}</> : null}, déclare vendre à <b>{d.shop.name}</b> le téléphone suivant :</p>
    <table className="occ-att-tab"><tbody>
      <tr><th>Appareil</th><td>{d.brand} {d.model}{d.storageGb ? ` · ${storageLabel(d.storageGb)}` : ''}{d.color ? ` · ${d.color}` : ''}</td></tr>
      <tr><th>IMEI</th><td className="mono">{d.imei}{d.imei2 ? ` / ${d.imei2}` : ''}</td></tr>
      {d.serialNumber && <tr><th>N° de série</th><td className="mono">{d.serialNumber}</td></tr>}
      <tr><th>État constaté</th><td>{conditionLabel(d.condition)}{d.batteryHealth != null ? ` · batterie ${d.batteryHealth} %` : ''}{d.defects ? ` · ${d.defects}` : ''}</td></tr>
      {d.accessories && <tr><th>Accessoires</th><td>{d.accessories}</td></tr>}
      <tr><th>Prix</th><td><b>{money(Number(d.purchasePrice), cur)}</b> ({amountInWords(Number(d.purchasePrice))}), réglé en {({ CASH: 'espèces', BANK_TRANSFER: 'virement', D17: 'D17', OTHER: 'autre moyen' } as Record<string, string>)[d.purchaseMethod] || d.purchaseMethod}.</td></tr>
    </tbody></table>
    <p>Je certifie être le propriétaire légitime de cet appareil, qu’il ne provient ni d’un vol ni d’une perte, qu’il n’est ni gagé ni sous contrat, et que j’ai retiré mon compte iCloud / Google. En cas de déclaration inexacte, j’en assume seul(e) l’entière responsabilité.</p>
    <div className="occ-att-sign"><div><span>Signature du vendeur</span><small>précédée de « lu et approuvé »</small></div><div><span>Pour {d.shop.name}</span><small>{d.boughtBy?.fullName || ''}</small></div></div>
  </article>;
  return <div className="occ-att-page"><div className="no-print occ-att-tools"><PrintButton label="Imprimer l’attestation" /></div>{copy('Exemplaire atelier')}<div className="occ-att-cut" aria-hidden="true">✂</div>{copy('Exemplaire vendeur')}</div>;
}
