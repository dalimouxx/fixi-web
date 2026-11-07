import { prisma } from '@/lib/prisma';
import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { clearMaintenanceCache, getMaintenance } from '@/lib/maintenance';

export async function GET() {
  try { await requirePlatformSession(); return ok(await getMaintenance(true)); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}

/** { enabled, message?, minutes? } : active ou arrête la maintenance pour tout le monde (sauf vous). */
export async function POST(req: Request) {
  try {
    const admin = await requirePlatformSession();
    const b = await req.json().catch(() => ({}));
    const enabled = b.enabled === true;
    const minutes = Math.min(24 * 60, Math.max(0, Math.round(Number(b.minutes) || 0)));
    const data = enabled
      ? { maintenanceEnabled: true, maintenanceMessage: String(b.message || '').trim().slice(0, 300) || null, maintenanceStartedAt: new Date(), maintenanceUntil: minutes ? new Date(Date.now() + minutes * 60_000) : null }
      : { maintenanceEnabled: false, maintenanceUntil: null };
    await prisma.platformSettings.upsert({ where: { id: 'platform' }, create: { id: 'platform', ...data }, update: data });
    clearMaintenanceCache();
    console.info(`[maintenance] ${enabled ? 'ACTIVÉE' : 'arrêtée'} par ${admin.fullName}`);
    return ok(await getMaintenance(true));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
