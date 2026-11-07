import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { deliveryProof } from '@/lib/delivery-proof';

/** Fournisseur : preuve de remise d'une commande. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSupplierSession();
    const { id } = await params;
    const p = await deliveryProof({ id, companyId: s.companyId });
    return p ? ok(plain(p)) : bad('Commande introuvable', 404);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
