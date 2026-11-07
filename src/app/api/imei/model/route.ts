import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { guessModel } from '@/lib/tac';

/** Marque et modèle devinés depuis l'IMEI (appris dans le réseau Fixi). */
export async function GET(req: Request) {
  try {
    await requireSession(undefined, 'CONNECT');
    const g = await guessModel(new URL(req.url).searchParams.get('imei') || '');
    return ok(g || { brand: null, model: null, confidence: 0 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
