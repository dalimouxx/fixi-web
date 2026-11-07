import { prisma } from './prisma';
import { cleanTyped, nextFreeCode, smartBase } from './smart-barcode';

type Db = { supplierProduct: { findFirst: (a: any) => Promise<any>; findMany: (a: any) => Promise<any[]> } };

/** Produit (de n'importe quel fournisseur) qui porte déjà ce code-barres. */
export async function barcodeOwner(db: Db, code: string, exceptId?: string | null) {
  return db.supplierProduct.findFirst({ where: { barcode: { equals: code, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true, companyId: true, name: true } });
}

/** Nouveau code intelligent unique sur toute la plateforme (0000A04, 0000A04-2…). */
export async function generateBarcode(db: Db, name: string, category?: string | null, reserved: Set<string> = new Set()) {
  const base = smartBase(name, category);
  const rows = await db.supplierProduct.findMany({ where: { barcode: { startsWith: base, mode: 'insensitive' } }, select: { barcode: true } });
  const code = nextFreeCode(base, [...rows.map(r => String(r.barcode)), ...reserved]);
  reserved.add(code.toUpperCase());
  return code;
}

export class BarcodeConflict extends Error { status = 409; }

/**
 * Code-barres d'un produit fournisseur :
 *  - vide → code intelligent généré ;
 *  - saisi → refusé s'il appartient déjà à un autre produit (même chez un autre fournisseur).
 */
export async function resolveBarcode(db: Db, companyId: string, input: { barcode?: unknown; name: string; category?: string | null; exceptId?: string | null }, reserved?: Set<string>) {
  const typed = cleanTyped(input.barcode);
  if (!typed) return generateBarcode(db, input.name, input.category, reserved);
  const owner = await barcodeOwner(db, typed, input.exceptId);
  if (owner) throw new BarcodeConflict(owner.companyId === companyId
    ? `Ce code-barres est déjà utilisé dans votre catalogue (${owner.name}).`
    : 'Ce code-barres est déjà utilisé par un autre fournisseur. Laissez le champ vide : Fixi crée un code unique.');
  if (reserved?.has(typed)) throw new BarcodeConflict('Ce code-barres apparaît deux fois dans le fichier.');
  reserved?.add(typed);
  return typed;
}

/** Codes manquants d'un fournisseur (bouton « Générer les codes-barres manquants »). */
export async function fillMissingBarcodes(companyId: string) {
  const rows = await prisma.supplierProduct.findMany({ where: { companyId, OR: [{ barcode: null }, { barcode: '' }] }, select: { id: true, name: true, category: true }, orderBy: { createdAt: 'asc' }, take: 2000 });
  const reserved = new Set<string>(); let done = 0;
  for (const p of rows) {
    const code = await generateBarcode(prisma as any, p.name, p.category, reserved);
    await prisma.supplierProduct.update({ where: { id: p.id }, data: { barcode: code } });
    done++;
  }
  return done;
}
