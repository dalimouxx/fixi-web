import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';

/** Trace de la préparation vérifiée au scanner (qui, quand, combien de pièces scannées). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER', 'STOCK', 'SALES']);
    const { id } = await params; const b = await req.json().catch(() => ({}));
    const o = await prisma.supplierOrder.findFirst({ where: { id, companyId: s.companyId }, select: { id: true } });
    if (!o) return bad('Commande introuvable', 404);
    const scanned = Math.max(0, Math.trunc(Number(b.scanned || 0))), manual = Math.max(0, Math.trunc(Number(b.manual || 0)));
    await prisma.supplierDeliveryEvent.create({ data: { companyId: s.companyId, orderId: id, accountId: s.id, type: 'PICK_VERIFIED', note: `Préparation vérifiée par ${s.fullName} · ${scanned} scannée(s)${manual ? ` · ${manual} validée(s) à la main` : ''}` } });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
