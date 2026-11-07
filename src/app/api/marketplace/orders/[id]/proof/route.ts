import { UserRole } from '@prisma/client';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { deliveryProof } from '@/lib/delivery-proof';

/** Atelier : preuve de remise d'une commande (photo, signature, réceptionnaire, livreur). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION], 'CONNECT');
    const { id } = await params;
    const p = await deliveryProof({ id, shopId: s.shopId });
    return p ? ok(plain(p)) : bad('Commande introuvable', 404);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
