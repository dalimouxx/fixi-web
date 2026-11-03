import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { PaymentKind, UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';
import { installmentStatus, splitInstallments } from '@/lib/installments';
import { plain } from '@/lib/serializers';

async function load(shopId: string, code: string) {
  const r = await prisma.repair.findUnique({ where: { shopId_code: { shopId, code } }, include: { payments: { select: { amount: true, kind: true } }, installments: true } });
  if (!r) throw Object.assign(new Error('Réparation introuvable'), { status: 404 });
  const paid = r.payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
  const total = Math.max(0, Number(r.finalPrice || 0) - Number(r.discountAmount || 0));
  // Les échéances couvrent ce qui restait à leur création : ce qui a été payé avant ne compte pas dedans.
  const planned = r.installments.reduce((a, x) => a + Number(x.amount), 0);
  const paidForPlan = Math.max(0, paid - Math.max(0, total - planned));
  return { r, paid, total, list: installmentStatus(r.installments.map(x => ({ id: x.id, dueDate: x.dueDate, amount: Number(x.amount) })), paidForPlan) };
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try { const s = await requireSession(); const { code } = await params; const { paid, total, list } = await load(s.shopId, code); return ok(plain({ paid, total, installments: list })); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}

// Crée (ou remplace) l'échéancier : le reste à payer est réparti en 2 à 6 fois.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER, UserRole.RECEPTION]);
    const { code } = await params; const b = await req.json().catch(() => ({}));
    const { r, paid, total } = await load(s.shopId, code);
    if (!r.finalPrice) return bad('Fixez d’abord le prix de la réparation', 409);
    const remaining = Math.max(0, total - paid);
    if (remaining <= 0.0005) return bad('Rien ne reste à payer', 409);
    const first = b.firstDate ? new Date(b.firstDate) : new Date();
    if (!Number.isFinite(first.getTime())) return bad('Date invalide');
    const parts = splitInstallments(remaining, Number(b.count || 3), first, Math.max(7, Math.min(62, Number(b.everyDays || 30))));
    await prisma.$transaction([
      prisma.repairInstallment.deleteMany({ where: { repairId: r.id } }),
      ...parts.map(p => prisma.repairInstallment.create({ data: { shopId: s.shopId, repairId: r.id, dueDate: p.dueDate, amount: p.amount } })),
    ]);
    await audit(s.shopId, s.id, 'INSTALLMENTS', 'REPAIR', r.id, { count: parts.length, remaining });
    const after = await load(s.shopId, code);
    return ok(plain({ paid: after.paid, total: after.total, installments: after.list }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try { const s = await requireSession([UserRole.ADMIN, UserRole.CASHIER]); const { code } = await params; const { r } = await load(s.shopId, code); await prisma.repairInstallment.deleteMany({ where: { repairId: r.id } }); return ok({ ok: true }); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}
