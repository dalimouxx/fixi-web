import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { money, dateTime } from '@/lib/format';
import { shopBrandVars } from '@/lib/brand-color';
import { PrintButton } from '@/components/print-button';

const METHOD: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte', D17: 'D17', FLOUCI: 'Flouci', BANK_TRANSFER: 'Virement', ONLINE: 'En ligne', OTHER: 'Autre' };

/** Ticket de caisse d'une vente comptoir (80 mm). */
export default async function CounterReceipt({ params }: { params: Promise<{ number: string }> }) {
  const s = await getSession(); if (!s) { redirect('/login'); return null; }
  const { number } = await params;
  const sale = await prisma.counterSale.findFirst({ where: { shopId: s.shopId, number: decodeURIComponent(number) }, include: { shop: true, lines: true, payments: true, client: true, user: { select: { fullName: true } } } });
  if (!sale) notFound();
  const cur = sale.shop.currency;
  const received = sale.payments.reduce((a, p) => a + Number(p.receivedAmount ?? p.amount), 0);
  const change = sale.payments.reduce((a, p) => a + Number(p.changeAmount || 0), 0);
  return <div style={{ padding: '25px 0' }}>
    <div className="no-print" style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><PrintButton /></div>
    <div className="print-receipt fx-branded" style={shopBrandVars(sale.shop.brandColor) as any}>
      <div className="receipt-center">
        {sale.shop.logoDataUrl && <img src={sale.shop.logoDataUrl} alt="Logo" style={{ width: 55, height: 55, objectFit: 'contain', margin: '0 auto 5px' }} />}
        <strong className="fx-shop-name" style={{ fontSize: 20 }}>{sale.shop.name}</strong>
        <div style={{ fontSize: 10 }}>{sale.shop.address}</div><div style={{ fontSize: 10 }}>{sale.shop.phone}</div>
      </div>
      <div className="receipt-sep" />
      <div className="receipt-row"><span>Ticket</span><strong>{sale.number}</strong></div>
      <div className="receipt-row"><span>Date</span><span>{dateTime(sale.createdAt)}</span></div>
      {sale.user && <div className="receipt-row"><span>Caissier</span><span>{sale.user.fullName}</span></div>}
      {sale.client && <div className="receipt-row"><span>Client</span><span>{sale.client.fullName}</span></div>}
      <div className="receipt-sep" />
      {sale.lines.map(l => <div key={l.id} style={{ margin: '5px 0' }}>
        <div>{l.name}</div>
        <div className="receipt-row" style={{ margin: 0, fontSize: 11 }}><span>{l.quantity} × {money(Number(l.unitPrice), cur)}</span><strong>{money(Number(l.total), cur)}</strong></div>
      </div>)}
      <div className="receipt-sep" />
      <div className="receipt-row"><span>Sous-total</span><span>{money(Number(sale.subtotal), cur)}</span></div>
      {Number(sale.discount) > 0 && <div className="receipt-row"><span>Remise</span><span>− {money(Number(sale.discount), cur)}</span></div>}
      <div className="receipt-row receipt-due"><span>Total</span><strong>{money(Number(sale.total), cur)}</strong></div>
      {sale.payments.map(p => <div className="receipt-row" key={p.id}><span>{METHOD[p.method] || p.method}</span><span>{money(Number(p.amount), cur)}</span></div>)}
      {change > 0 && <><div className="receipt-row"><span>Reçu</span><span>{money(received, cur)}</span></div><div className="receipt-row"><span>Rendu</span><span>{money(change, cur)}</span></div></>}
      <div className="receipt-sep" />
      <div className="receipt-center" style={{ fontSize: 10 }}>{sale.shop.footerText || 'Merci pour votre achat !'}</div>
    </div>
  </div>;
}
