import { prisma } from './prisma';
import { PaymentKind, DocumentType, DocumentStatus } from '@prisma/client';
import { monthRange } from './monthly-report';
import { issueFamily } from './price-hint';

const FAMILY_LABEL: Record<string, string> = { ecran: 'Écran', batterie: 'Batterie', charge: 'Connecteur de charge', camera: 'Caméra', eau: 'Oxydation / eau', 'vitre-arriere': 'Vitre arrière', son: 'Son / micro', logiciel: 'Logiciel', allumage: 'Ne s’allume pas' };

/** Chiffres d'un mois pour un atelier (rapport mensuel et export comptable). */
export async function monthlyData(shopId: string, ym: string) {
  const { start, end } = monthRange(ym);
  const [payments, expenses, parts, received, delivered, documents, shop] = await Promise.all([
    prisma.payment.findMany({ where: { shopId, createdAt: { gte: start, lt: end } }, select: { createdAt: true, amount: true, kind: true, method: true, note: true, repair: { select: { code: true, brand: true, model: true, client: { select: { fullName: true } } } }, user: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.expense.findMany({ where: { shopId, expenseDate: { gte: start, lt: end } }, select: { expenseDate: true, category: true, label: true, amount: true, note: true }, orderBy: { expenseDate: 'asc' } }),
    prisma.repairPart.findMany({ where: { repair: { shopId, deliveredAt: { gte: start, lt: end } } }, select: { quantity: true, unitCost: true } }),
    prisma.repair.findMany({ where: { shopId, createdAt: { gte: start, lt: end } }, select: { reportedIssue: true } }),
    prisma.repair.findMany({ where: { shopId, deliveredAt: { gte: start, lt: end } }, select: { finalPrice: true, technician: { select: { fullName: true } } } }),
    prisma.salesDocument.findMany({ where: { shopId, type: { in: [DocumentType.INVOICE, DocumentType.CREDIT_NOTE] }, status: { not: DocumentStatus.CANCELLED }, issuedAt: { gte: start, lt: end } }, select: { number: true, type: true, issuedAt: true, subtotal: true, discount: true, taxRate: true, taxAmount: true, total: true, client: { select: { fullName: true } } }, orderBy: { issuedAt: 'asc' } }),
    prisma.shop.findUnique({ where: { id: shopId }, select: { name: true, currency: true, taxId: true, address: true } }),
  ]);
  const revenue = payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
  const expenseTotal = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const partsCost = parts.reduce((a, p) => a + p.quantity * Number(p.unitCost), 0);
  const fam: Record<string, number> = {};
  for (const r of received) { const f = issueFamily(r.reportedIssue); if (f) fam[f] = (fam[f] || 0) + 1; }
  const topIssues = Object.entries(fam).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ label: FAMILY_LABEL[k] || k, count: n }));
  const tech: Record<string, number> = {};
  for (const r of delivered) { const n = r.technician?.fullName || 'Non assigné'; tech[n] = (tech[n] || 0) + 1; }
  const byMethod: Record<string, number> = {};
  for (const p of payments) byMethod[p.method] = (byMethod[p.method] || 0) + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount));
  const taxTotal = documents.reduce((a, d) => a + (d.type === DocumentType.CREDIT_NOTE ? -1 : 1) * Number(d.taxAmount), 0);
  return {
    shop, ym, payments, expenses, documents,
    summary: { revenue, expenseTotal, partsCost, profit: revenue - expenseTotal - partsCost, received: received.length, delivered: delivered.length, avgTicket: delivered.length ? delivered.reduce((a, r) => a + Number(r.finalPrice || 0), 0) / delivered.length : 0, topIssues, technicians: Object.entries(tech).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })), byMethod, taxTotal },
  };
}
