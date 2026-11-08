import { requireSupplierRole } from '@/lib/supplier-auth';
import { rolesWith } from '@/lib/supplier-permissions';
import { bad, ok } from '@/lib/http';
import { checkLineId, lineReport, OWN } from '@/lib/supplier-lines';

const day = (v: string | null, fallback: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : fallback);

/** Rapport d'une ligne : ?line=<id>|own|all &from=AAAA-MM-JJ &to=AAAA-MM-JJ (jours de Tunis, inclus). */
export async function GET(req: Request) {
  try {
    const s = await requireSupplierRole(rolesWith('reports') as any);
    const u = new URL(req.url);
    const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
    const from = day(u.searchParams.get('from'), today), to = day(u.searchParams.get('to'), today);
    if (from > to) return bad('La date de début est après la date de fin');
    const start = new Date(`${from}T00:00:00+01:00`), end = new Date(new Date(`${to}T00:00:00+01:00`).getTime() + 86400000);
    if (end.getTime() - start.getTime() > 400 * 86400000) return bad('Période trop longue (400 jours maximum)');
    const raw = u.searchParams.get('line') || 'all';
    const line = raw === 'all' ? null : raw === OWN ? OWN : await checkLineId(s.companyId, raw);
    return ok({ from, to, ...(await lineReport(s.companyId, line, start, end)) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
