import { requirePlatformSession } from '@/lib/platform-auth';
import { bad, ok } from '@/lib/http';
import { securityAction, securityState } from '@/lib/security-actions';

export const dynamic = 'force-dynamic';
export async function GET() { try { const s = await requirePlatformSession(); return ok(await securityState('platform', s.id)); } catch (e: any) { return bad(e.message, e.status || 500); } }
export async function POST(req: Request) {
  try { const s = await requirePlatformSession(); return ok(await securityAction('platform', s.id, `Admin ${s.login}`, await req.json().catch(() => ({})))); }
  catch (e: any) { return bad(e.message, e.status || 500); }
}
