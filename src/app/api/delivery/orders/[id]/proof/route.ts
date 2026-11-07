import { requireDeliverySession } from '@/lib/delivery-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { deliveryProof } from '@/lib/delivery-proof';

/** Livreur : sa propre preuve de remise (historique). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireDeliverySession();
    const { id } = await params;
    const p = await deliveryProof({ id, delivery: { is: { driverAccountId: s.id } } });
    return p ? ok(plain(p)) : bad('Commande introuvable', 404);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
