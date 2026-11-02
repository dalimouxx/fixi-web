import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ok } from '@/lib/http';

// Enregistre l'ouverture d'un écran de l'Atelier. Silencieux : ne bloque jamais l'interface.
export async function POST(req: Request) {
  try {
    const s = await getSession();
    if (!s) return ok({ ok: false });
    const b = await req.json().catch(() => ({}));
    const path = String(b.path || '').split('?')[0].slice(0, 120);
    if (!path.startsWith('/app')) return ok({ ok: false });
    // Les identifiants (codes réparation, id client…) sont remplacés pour regrouper les écrans.
    const normalized = path.replace(/\/(F-\d+|DEMO-\d+|[a-z0-9]{20,})(?=\/|$)/gi, '/[id]');
    await prisma.usageEvent.create({
      data: { shopId: s.shopId, userId: s.id, role: s.role, path: normalized, uiMode: b.mode === 'advanced' ? 'advanced' : 'simple' },
    });
    return ok({ ok: true });
  } catch {
    return ok({ ok: false });
  }
}
