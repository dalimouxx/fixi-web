import { prisma } from '@/lib/prisma';
import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { guessProduct } from '@/lib/product-quick';
import { networkSuggestion } from '@/lib/supplier-product-quick';

/** Scan d'un code-barres avant création : produit déjà au catalogue, ou suggestion du réseau Fixi. */
export async function GET(req: Request) {
  try {
    const s = await requireSupplierSession();
    const u = new URL(req.url);
    const barcode = String(u.searchParams.get('barcode') || '').trim();
    const name = String(u.searchParams.get('name') || '').trim();
    if (name) return ok({ guess: guessProduct(name) });
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(barcode)) return bad('Code-barres invalide');
    const own = await prisma.supplierProduct.findFirst({ where: { companyId: s.companyId, OR: [{ barcode }, { sku: barcode.toUpperCase() }] } });
    if (own) return ok({ own: plain(own), suggestion: null });
    return ok({ own: null, suggestion: await networkSuggestion(s.companyId, barcode) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
