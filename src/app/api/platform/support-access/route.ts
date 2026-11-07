import { requirePlatformSession } from '@/lib/platform-auth';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { clientIp } from '@/lib/login-guard';
import { cleanReason, startSupportAccess } from '@/lib/support-access';

/** Journal des accès support (50 derniers). */
export async function GET() {
  try {
    await requirePlatformSession();
    const rows = await prisma.supportAccess.findMany({ orderBy: { startedAt: 'desc' }, take: 50 });
    return ok(rows);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Ouvre l'espace d'une boutique (kind SHOP) ou d'un fournisseur (kind SUPPLIER) en mode support. */
export async function POST(req: Request) {
  try {
    const admin = await requirePlatformSession();
    const b = await req.json().catch(() => ({}));
    const kind = b.kind === 'SUPPLIER' ? 'SUPPLIER' : b.kind === 'SHOP' ? 'SHOP' : null;
    if (!kind || !b.id) return bad('Boutique ou fournisseur requis');
    const reason = cleanReason(b.reason);
    if (!reason) return bad('Indiquez le motif de l’intervention (5 caractères minimum)');
    return ok(await startSupportAccess(admin, kind, String(b.id), reason, clientIp(req), b.readOnly === true));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
