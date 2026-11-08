import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { rolesWith } from '@/lib/supplier-permissions';
import { bad, ok } from '@/lib/http';

/** Paiement versé au propriétaire d'une ligne en dépôt-vente (ex. MG). En espèces, il sort de la caisse ouverte. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierRole(rolesWith('vendorPay') as any);
    const { id } = await params;
    const line = await prisma.supplierProductLine.findFirst({ where: { id, companyId: s.companyId } });
    if (!line) return bad('Ligne introuvable', 404);
    const b = await req.json().catch(() => ({}));
    const amount = Math.round(Number(String(b.amount ?? '').replace(',', '.')) * 1000) / 1000;
    if (!(amount > 0) || amount > 100000000) return bad('Montant invalide');
    const method = ['CASH', 'TRANSFER', 'CHEQUE', 'D17', 'CARD'].includes(String(b.method)) ? String(b.method) : 'CASH';
    const session = method === 'CASH' ? await prisma.supplierErpCashSession.findFirst({ where: { companyId: s.companyId, accountId: s.id, status: 'OPEN' }, select: { id: true } }) : null;
    const note = String(b.note || '').trim().slice(0, 300);
    const x = await prisma.supplierErpPayment.create({ data: {
      companyId: s.companyId, kind: 'OUT', method, amount, lineId: id, accountId: s.id, cashSessionId: session?.id || null,
      reference: String(b.reference || '').trim().slice(0, 80) || null, note: `Paiement ${line.tag}${note ? ' — ' + note : ''}`,
    } });
    await prisma.supplierAuditEvent.create({ data: { companyId: s.companyId, accountId: s.id, action: 'LINE_PAYMENT', entity: 'PRODUCT_LINE', entityId: id, metadata: { amount, method, tag: line.tag } } }).catch(() => null);
    return ok({ id: x.id, amount, method, fromCash: !!session }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
