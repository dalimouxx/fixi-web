import { Prisma } from '@prisma/client';

/**
 * Caisse du livreur : UNE seule vérité pour la journée.
 * L'argent en main du livreur vient de trois gestes possibles :
 *  1. « Encaisser » sur une mission (événement COD_COLLECTED) ;
 *  2. « Ancien dû » encaissé chez l'atelier (événement DUE_COLLECTED) ;
 *  3. un encaissement saisi dans « Ma caisse » (SupplierSettlement collecté par le livreur).
 * L'écran du livreur, la fin de journée et le caissier du fournisseur utilisent tous ce calcul.
 */
type Db = Prisma.TransactionClient | { supplierDeliveryEvent: any; supplierSettlement: any };

export type CashLine = { id: string; kind: 'COD' | 'DUE' | 'RECEIPT'; amount: number; at: Date; orderId: string | null; reference: string | null; status?: string };
export type DriverCash = { cod: number; dues: number; receipts: number; receiptsPending: number; total: number; lines: CashLine[] };

export const r3 = (n: unknown) => Math.round((Number(n) || 0) * 1000) / 1000;

/** Somme détenue par le livreur entre `from` et `to` (journée ouverte → maintenant, ou journée remise). */
export async function driverCash(db: Db, companyId: string, driverId: string, from: Date, to: Date = new Date()): Promise<DriverCash> {
  const [events, receipts] = await Promise.all([
    db.supplierDeliveryEvent.findMany({ where: { companyId, accountId: driverId, type: { in: ['COD_COLLECTED', 'DUE_COLLECTED'] }, createdAt: { gte: from, lte: to } }, select: { id: true, type: true, amount: true, createdAt: true, orderId: true }, orderBy: { createdAt: 'asc' } }),
    db.supplierSettlement.findMany({ where: { companyId, driverAccountId: driverId, collector: 'DRIVER', status: { in: ['PENDING', 'CONFIRMED'] }, collectedAt: { gte: from, lte: to } }, select: { id: true, amount: true, collectedAt: true, orderId: true, reference: true, status: true }, orderBy: { collectedAt: 'asc' } }),
  ]);
  return summarize(events, receipts);
}

export function summarize(events: { id: string; type: string; amount: unknown; createdAt: Date; orderId: string | null }[], receipts: { id: string; amount: unknown; collectedAt: Date; orderId: string | null; reference: string; status: string }[]): DriverCash {
  const lines: CashLine[] = [
    ...events.map(e => ({ id: e.id, kind: (e.type === 'DUE_COLLECTED' ? 'DUE' : 'COD') as CashLine['kind'], amount: r3(e.amount), at: new Date(e.createdAt), orderId: e.orderId, reference: null })),
    ...receipts.map(r => ({ id: r.id, kind: 'RECEIPT' as const, amount: r3(r.amount), at: new Date(r.collectedAt), orderId: r.orderId, reference: r.reference, status: r.status })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const sum = (k: CashLine['kind']) => r3(lines.filter(l => l.kind === k).reduce((a, l) => a + l.amount, 0));
  const cod = sum('COD'), dues = sum('DUE'), receipts_ = sum('RECEIPT');
  return { cod, dues, receipts: receipts_, receiptsPending: r3(lines.filter(l => l.kind === 'RECEIPT' && l.status === 'PENDING').reduce((a, l) => a + l.amount, 0)), total: r3(cod + dues + receipts_), lines };
}

export const CASH_KIND_LABEL: Record<CashLine['kind'], string> = { COD: 'Paiement à la livraison', DUE: 'Ancien dû', RECEIPT: 'Saisi dans Ma caisse' };
