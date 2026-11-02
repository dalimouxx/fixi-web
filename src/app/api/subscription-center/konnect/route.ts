import { ok } from '@/lib/http';
import { activatePaidRequest } from '@/lib/platform-konnect';

// Webhook Konnect (GET ?payment_ref=…) : le statut est toujours revérifié auprès de Konnect.
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get('payment_ref') || '';
  if (!ref) return ok({ ok: false });
  try { return ok({ ok: true, ...(await activatePaidRequest(ref)) }); }
  catch (e: any) { return ok({ ok: false, error: String(e.message || e) }); }
}
