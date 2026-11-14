import { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { notifyShop } from './notifications';
import { money } from './format';
import { waLink } from './whatsapp-link';
import { aging, monthlyDue, MONTH_DAYS, reminderLevel, reminderText, shouldRemind } from './field-ops';

/** Niveau réservé, dans le journal des relances, au rappel du règlement mensuel. */
const MONTHLY_LEVEL = 99;

/** Soldes clients d'un fournisseur (factures − avoirs − paiements), avec palier de relance et dernière relance. */
export async function customerDues(companyId: string, now = Date.now()) {
  const [company, customers, sales, returns, reminders, payments] = await Promise.all([
    prisma.supplierCompany.findUnique({ where: { id: companyId }, select: { name: true, autoReminders: true, remindersRunAt: true, monthlyDuePct: true } }),
    prisma.supplierErpCustomer.findMany({ where: { companyId, active: true }, select: { id: true, name: true, phone: true, shopId: true, creditLimit: true, monthlyMin: true } }),
    prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' }, customerId: { not: null } }, select: { id: true, customerId: true, total: true, paid: true, createdAt: true, dueAt: true } }),
    prisma.supplierReturn.findMany({ where: { companyId, status: 'COMPLETED', sourceSaleId: { not: null } }, select: { sourceSaleId: true, total: true, refund: true } }),
    prisma.supplierReminder.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 2000, select: { customerId: true, level: true, createdAt: true, auto: true } }),
    prisma.supplierErpPayment.findMany({ where: { companyId, kind: 'IN', customerId: { not: null }, lineId: null, createdAt: { gte: new Date(now - MONTH_DAYS * 86400_000) } }, select: { customerId: true, saleId: true, amount: true, createdAt: true } }),
  ]);
  const saleAt = new Map(sales.map(s => [s.id, s.createdAt]));
  const paidBy = new Map<string, { amount: number; createdAt: Date; saleCreatedAt: Date | null }[]>();
  for (const p of payments) { const a = paidBy.get(p.customerId!) || []; a.push({ amount: Number(p.amount), createdAt: p.createdAt, saleCreatedAt: p.saleId ? saleAt.get(p.saleId) || null : null }); paidBy.set(p.customerId!, a); }
  const pct = Number(company?.monthlyDuePct || 0);
  const lastMonthly = new Map<string, Date>();
  for (const r of reminders) if (r.level === MONTHLY_LEVEL && !lastMonthly.has(r.customerId)) lastMonthly.set(r.customerId, r.createdAt);
  const credit = new Map<string, number>();
  for (const r of returns) credit.set(r.sourceSaleId!, (credit.get(r.sourceSaleId!) || 0) + Math.max(0, Number(r.total) - Number(r.refund)));
  const bySale = new Map<string, typeof sales>();
  for (const s of sales) { const a = bySale.get(s.customerId!) || []; a.push(s); bySale.set(s.customerId!, a); }
  const last = new Map<string, { level: number; at: Date; auto: boolean }>();
  for (const r of reminders) if (r.level !== MONTHLY_LEVEL && !last.has(r.customerId)) last.set(r.customerId, { level: r.level, at: r.createdAt, auto: r.auto });
  const rows = customers.map(c => {
    const list = (bySale.get(c.id) || []).map(s => ({ id: s.id, total: Number(s.total), paid: Number(s.paid), credit: credit.get(s.id) || 0, createdAt: s.createdAt, dueAt: s.dueAt }));
    const a = aging(list, now);
    const limit = Number(c.creditLimit || 0), monthlyMin = Number(c.monthlyMin || 0);
    const monthly = monthlyDue({ minAmount: monthlyMin, pct }, list, paidBy.get(c.id) || [], now);
    return { ...c, creditLimit: limit, monthlyMin, monthly, lastMonthly: lastMonthly.get(c.id) || null, due: a.due, days: a.days, level: reminderLevel(a.days), last: last.get(c.id) || null, blocked: (limit > 0 && a.due >= limit) || monthly.late };
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
  if (!company) return 0;
  if (!force && company.remindersRunAt && Date.now() - company.remindersRunAt.getTime() < 20 * 3600_000) return 0;
  await prisma.supplierCompany.update({ where: { id: companyId }, data: { remindersRunAt: new Date() } });
  let sent = 0;
  // Règlement mensuel en retard : l'atelier est prévenu (au plus une fois tous les 7 jours), que les relances automatiques soient activées ou non.
  for (const r of rows) if (r.shopId && r.monthly.late && (!r.lastMonthly || Date.now() - r.lastMonthly.getTime() > 7 * 86400_000)) { await sendMonthlyNotice(companyId, r, company.name); sent++; }
  if (!company.autoReminders) return sent;
  for (const r of rows) if (r.shopId && shouldRemind(r.level, r.last)) { await sendReminder(companyId, r, company.name, true); sent++; }
  return sent;
}

export function monthlyText(supplier: string, m: { missing: number; required: number; paid: number }) {
  return `Règlement mensuel en retard chez ${supplier} : il reste ${money(m.missing)} à régler ce mois-ci (minimum ${money(m.required)}, déjà réglé ${money(m.paid)}). Les achats à crédit sont bloqués jusqu'au règlement.`;
}

/** Prévient l'atelier que son règlement mensuel est en retard et que ses achats sont bloqués. */
export async function sendMonthlyNotice(companyId: string, row: Awaited<ReturnType<typeof customerDues>>['rows'][number], supplierName: string) {
  const text = monthlyText(supplierName, row.monthly);
  if (row.shopId) await notifyShop(row.shopId, `Achats bloqués · ${supplierName}`, text, '/app/mes-dettes', NotificationType.WARNING, undefined, { experienceKey: 'SHOP_ORDER_PROGRESS', eventId: `monthly-${row.id}-${new Date().toISOString().slice(0, 10)}` }).catch(() => {});
  await prisma.supplierReminder.create({ data: { companyId, customerId: row.id, level: MONTHLY_LEVEL, channel: row.shopId ? 'FIXI' : 'WHATSAPP', amount: row.monthly.missing, auto: true } });
  return text;
}

/** Règlement mensuel d'un seul client (contrôle au moment d'une vente ou d'une commande). */
export async function customerMonthly(companyId: string, customerId: string, now = Date.now()) {
  const [company, customer, sales, payments] = await Promise.all([
    prisma.supplierCompany.findUnique({ where: { id: companyId }, select: { name: true, monthlyDuePct: true } }),
    prisma.supplierErpCustomer.findFirst({ where: { id: customerId, companyId }, select: { monthlyMin: true } }),
    prisma.supplierErpSale.findMany({ where: { companyId, customerId, status: { not: 'CANCELLED' } }, select: { id: true, total: true, paid: true, createdAt: true, dueAt: true } }),
    prisma.supplierErpPayment.findMany({ where: { companyId, customerId, kind: 'IN', lineId: null, createdAt: { gte: new Date(now - MONTH_DAYS * 86400_000) } }, select: { saleId: true, amount: true, createdAt: true } }),
  ]);
  const rule = { minAmount: Number(customer?.monthlyMin || 0), pct: Number(company?.monthlyDuePct || 0) };
  if (!(rule.minAmount > 0) && !(rule.pct > 0)) return { required: 0, paid: 0, missing: 0, oldDue: 0, late: false, supplier: company?.name || '' };
  const returns = await prisma.supplierReturn.findMany({ where: { companyId, status: 'COMPLETED', sourceSaleId: { in: sales.map(s => s.id) } }, select: { sourceSaleId: true, total: true, refund: true } });
  const credit = new Map<string, number>();
  for (const r of returns) credit.set(r.sourceSaleId!, (credit.get(r.sourceSaleId!) || 0) + Math.max(0, Number(r.total) - Number(r.refund)));
  const saleAt = new Map(sales.map(s => [s.id, s.createdAt]));
  return { ...monthlyDue(rule, sales.map(s => ({ id: s.id, total: Number(s.total), paid: Number(s.paid), credit: credit.get(s.id) || 0, createdAt: s.createdAt, dueAt: s.dueAt })), payments.map(p => ({ amount: Number(p.amount), createdAt: p.createdAt, saleCreatedAt: p.saleId ? saleAt.get(p.saleId) || null : null })), now), supplier: company?.name || '' };
}
