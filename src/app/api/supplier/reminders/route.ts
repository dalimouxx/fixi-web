import { requireSupplierRole } from '@/lib/supplier-auth';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { customerDues, runAutoReminders, sendReminder } from '@/lib/supplier-collections';
import { reminderText } from '@/lib/field-ops';
import { waLink } from '@/lib/whatsapp-link';
import { money } from '@/lib/format';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES'] as const;
export const dynamic = 'force-dynamic';

/** Clients à relancer : solde, ancienneté, palier, dernière relance, blocage crédit. */
export async function GET() {
  try {
    const s = await requireSupplierRole(ROLES);
    const autoSent = await runAutoReminders(s.companyId).catch(() => 0);
    const { company, rows } = await customerDues(s.companyId);
    return ok({
      autoReminders: !!company?.autoReminders, autoSent, monthlyDuePct: Number(company?.monthlyDuePct || 0), canEdit: ['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(s.role),
      totals: { due: Math.round(rows.reduce((a, r) => a + r.due, 0) * 1000) / 1000, late30: rows.filter(r => r.days >= 30).reduce((a, r) => a + r.due, 0), customers: rows.length, blocked: rows.filter(r => r.blocked).length, monthlyLate: rows.filter(r => r.monthly.late).length },
      rows: rows.map(r => ({ ...r, wa: r.phone ? waLink(r.phone, reminderText(r.level || 7, { customer: r.name, supplier: company?.name || '', due: money(r.due), days: r.days })) : null })),
    });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Relance manuelle d'un client. */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(ROLES);
    const b = await req.json().catch(() => ({}));
    const { rows } = await customerDues(s.companyId);
    const row = rows.find(r => r.id === String(b.customerId || ''));
    if (!row) return bad('Aucun solde à relancer pour ce client', 404);
    return ok(await sendReminder(s.companyId, row, s.companyName, false));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Activer / couper les relances automatiques (J+7, J+15, J+30). */
export async function PATCH(req: Request) {
  try {
    const s = await requireSupplierRole(['OWNER', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);
    const b = await req.json().catch(() => ({}));
    const data: any = { remindersRunAt: null };
    if (b.autoReminders !== undefined) data.autoReminders = !!b.autoReminders;
    if (b.monthlyDuePct !== undefined) { const v = Number(b.monthlyDuePct); if (!Number.isFinite(v) || v < 0 || v > 100) return bad('Pourcentage entre 0 et 100', 400); data.monthlyDuePct = Math.round(v * 100) / 100; }
    if (b.customerId && b.monthlyMin !== undefined) {
      const v = Number(b.monthlyMin); if (!Number.isFinite(v) || v < 0) return bad('Montant mensuel invalide', 400);
      const done = await prisma.supplierErpCustomer.updateMany({ where: { id: String(b.customerId), companyId: s.companyId }, data: { monthlyMin: Math.round(v * 1000) / 1000 } });
      if (!done.count) return bad('Client introuvable', 404);
    }
    const c = await prisma.supplierCompany.update({ where: { id: s.companyId }, data, select: { autoReminders: true, monthlyDuePct: true } });
    return ok({ autoReminders: c.autoReminders, monthlyDuePct: Number(c.monthlyDuePct) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
