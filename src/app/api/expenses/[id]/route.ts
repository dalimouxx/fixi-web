import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';

/** Une dépense payée depuis une caisse déjà clôturée ne bouge plus (sinon l'écart de caisse devient faux). */
async function editable(shopId: string, id: string) {
  const x = await prisma.expense.findFirst({ where: { id, shopId }, include: { cashSession: { select: { status: true } } } });
  if (!x) throw Object.assign(new Error('Dépense introuvable'), { status: 404 });
  if (x.cashSession?.status === 'CLOSED') throw Object.assign(new Error('Cette dépense a été payée depuis une caisse déjà clôturée : elle ne peut plus être modifiée. Ajoutez une dépense de correction.'), { status: 409 });
  return x;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const { id } = await params;
    const x = await editable(s.shopId, id);
    const b = await req.json().catch(() => ({}));
    const data: any = {};
    if (b.label !== undefined) { const v = String(b.label || '').trim().slice(0, 160); if (v.length < 2) return bad('Libellé requis'); data.label = v; }
    if (b.category !== undefined) data.category = String(b.category || 'Autre').trim().slice(0, 60) || 'Autre';
    if (b.note !== undefined) data.note = String(b.note || '').trim().slice(0, 500) || null;
    if (b.amount !== undefined) { const n = Number(String(b.amount).replace(',', '.')); if (!(n > 0)) return bad('Montant invalide'); data.amount = n; }
    if (b.expenseDate) { const d = new Date(b.expenseDate); if (Number.isNaN(d.getTime())) return bad('Date invalide'); data.expenseDate = d; }
    const u = await prisma.expense.update({ where: { id }, data });
    await audit(s.shopId, s.id, 'UPDATE', 'EXPENSE', id, { before: { label: x.label, amount: x.amount }, after: data });
    return ok(plain(u));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const { id } = await params;
    const x = await editable(s.shopId, id);
    await prisma.expense.delete({ where: { id } });
    await audit(s.shopId, s.id, 'DELETE', 'EXPENSE', id, { label: x.label, amount: x.amount, category: x.category });
    return ok({ ok: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
