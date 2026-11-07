import { bad, ok } from '@/lib/http';
import { endSupportAccess } from '@/lib/support-access';

/** Quitte le mode support et revient à Fixi Control. */
export async function POST() {
  try { await endSupportAccess(); return ok({ url: '/saas' }); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}
