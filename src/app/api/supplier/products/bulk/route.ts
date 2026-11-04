import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { PRODUCT_EDITORS, saveQuickRows } from '@/lib/supplier-product-quick';

/** Saisie en série / import Excel : jusqu'à 500 lignes simples (code-barres, nom, prix, stock, coût). */
export async function POST(req: Request) {
  try {
    const s = await requireSupplierRole(PRODUCT_EDITORS);
    const b = await req.json().catch(() => ({}));
    const rows = Array.isArray(b.rows) ? b.rows : [];
    if (!rows.length) return bad('Aucune ligne à enregistrer');
    if (rows.length > 500) return bad('500 lignes maximum par envoi');
    return ok(await saveQuickRows(s.companyId, s.id, rows, String(b.source || 'serie').slice(0, 20)));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
