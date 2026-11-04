import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { runAutoReminders } from '@/lib/supplier-collections';
import { sweepBackInStock } from '@/lib/stock-alerts';

export const dynamic = 'force-dynamic';

/** Tâche planifiée (même secret que les automatisations) : retours en stock + relances automatiques de tous les fournisseurs. */
export async function POST(req: Request) {
  try {
    if (!process.env.CRON_SECRET || req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) return bad('Accès refusé', 403);
    const backInStock = await sweepBackInStock(true);
    const companies = await prisma.supplierCompany.findMany({ where: { active: true, autoReminders: true }, select: { id: true } });
    let reminders = 0;
    for (const c of companies) reminders += await runAutoReminders(c.id).catch(() => 0);
    return ok({ backInStock, reminders, companies: companies.length });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
