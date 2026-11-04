import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { notifyShop } from './notifications';
import { money } from './format';
import { waLink } from './whatsapp-link';
import { aging, reminderLevel, reminderText, shouldRemind } from './field-ops';

/** Soldes clients d'un fournisseur (factures − avoirs − paiements), avec palier de relance et dernière relance. */
export async function customerDues(companyId: string, now = Date.now()) {
  const [company, customers, sales, returns, reminders] = await Promise.all([
    prisma.supplierCompany.findUnique({ where: { id: companyId }, select: { name: true, autoReminders: true, remindersRunAt: true } }),
    prisma.supplierErpCustomer.findMany({ where: { companyId, active: true }, select: { id: true, name: true, phone: true, shopId: true, creditLimit: true } }),
    prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' }, customerId: { not: null } }, select: { id: true, customerId: true, total: true, paid: true, createdAt: true, dueAt: true } }),
    prisma.supplierReturn.findMany({ where: { companyId, status: 'COMPLETED', sourceSaleId: { not: null } }, select: { sourceSaleId: true, total: true, refund: true } }),
    prisma.supplierReminder.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 2000, select: { customerId: true, level: true, createdAt: true, auto: true } }),
  ]);
  const credit = new Map<string, number>();
  for (const r of returns) credit.set(r.sourceSaleId!, (credit.get(r.sourceSaleId!) || 0) + Math.max(0, Number(r.total) - Number(r.refund)));
  const bySale = new Map<string, typeof sales>();
  for (const s of sales) { const a = bySale.get(s.customerId!) || []; a.push(s); bySale.set(s.customerId!, a); }
  const last = new Map<string, { level: number; at: Date; auto: boolean }>();
  for (const r of reminders) if (!last.has(r.customerId)) last.set(r.customerId, { level: r.level, at: r.createdAt, auto: r.auto });
  const rows = customers.map(c => {
    const a = aging((bySale.get(c.id) || []).map(s => ({ id: s.id, total: Number(s.total), paid: Number(s.paid), credit: credit.get(s.id) || 0, createdAt: s.createdAt, dueAt: s.dueAt })), now);
    const limit = Number(c.creditLimit || 0);
    return { ...c, creditLimit: limit, due: a.due, days: a.days, level: reminderLevel(a.days), last: last.get(c.id) || null, blocked: limit > 0 && a.due >= limit };
  }).filter(r => r.due > 0.0005).sort((a, b) => b.days - a.days || b.due - a.due);
  return { company, rows };
}

/** Envoie une relance : notification dans Fixi (si le client est un atelier Fixi) + trace. Renvoie aussi le lien WhatsApp. */
export async function sendReminder(companyId: string, row: Awaited<ReturnType<typeof customerDues>>['rows'][number], supplierName: string, auto: boolean) {
  const level = row.level || 7;
  const text = reminderText(level, { customer: row.name, supplier: supplierName, due: money(row.due), days: row.days });
  if (row.shopId) await notifyShop(row.shopId, `Rappel de paiement · ${supplierName}`, text, '/app/mes-dettes', NotificationType.INFO, undefined, { experienceKey: 'SHOP_ORDER_PROGRESS', eventId: `rem-${row.id}-${level}-${new Date().toISOString().slice(0, 10)}` }).catch(() => {});
  await prisma.supplierReminder.create({ data: { companyId, customerId: row.id, level, channel: row.shopId ? 'FIXI' : 'WHATSAPP', amount: row.due, auto } });
  return { text, wa: row.phone ? waLink(row.phone, text) : null, notified: !!row.shopId };
}

/** Relances automatiques, au plus une passe toutes les 20 h par fournisseur (déclenchée à l'ouverture du tableau ou par la tâche planifiée). */
export async function runAutoReminders(companyId: string, force = false) {
  const { company, rows } = await customerDues(companyId);
  if (!company?.autoReminders) return 0;
  if (!force && company.remindersRunAt && Date.now() - company.remindersRunAt.getTime() < 20 * 3600_000) return 0;
  await prisma.supplierCompany.update({ where: { id: companyId }, data: { remindersRunAt: new Date() } });
  let sent = 0;
  for (const r of rows) if (r.shopId && shouldRemind(r.level, r.last)) { await sendReminder(companyId, r, company.name, true); sent++; }
  return sent;
}
