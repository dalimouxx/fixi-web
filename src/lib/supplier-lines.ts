import { prisma } from './prisma';

/**
 * Lignes de produits d'un fournisseur (ex. « MG » : produits d'un importateur en dépôt-vente, « SL » : ses propres produits).
 * Chaque article vendu appartient à la ligne de sa fiche produit (à partir du jour où il y est rangé) : un panier qui
 * mélange SL et MG est donc séparé automatiquement. La remise, le montant payé et le reste dû d'une vente sont
 * répartis entre les lignes au prorata de la valeur de leurs articles.
 *
 * Bénéfice : jamais « prix − coût » (la marge sur MG est confidentielle). Seulement le barème du fournisseur
 * par catégorie (ex. afficheur : 2 DT par pièce vendue), s'il le saisit.
 */
export const OWN = 'own';

export type SaleLite = { id: string; customerId: string | null; total: number; paid: number; createdAt: Date };
export type ItemLite = { saleId: string; productId: string | null; quantity: number; unitPrice: number; unitCost: number; discount: number; extra?: number };

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Barème { catégorie: DT par pièce } nettoyé (montants ≥ 0, catégories non vides). */
export function cleanCommissions(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim().slice(0, 80);
    const n = Math.round(Number(String(v ?? '').replace(',', '.')) * 1000) / 1000;
    if (key && Number.isFinite(n) && n >= 0 && String(v ?? '').trim() !== '') out[key] = n;
  }
  return out;
}

/**
 * Ce que le fournisseur doit au propriétaire pour une pièce vendue (dépôt-vente) :
 *  - avec un barème pour la catégorie : prix de vente − supplément passager − bénéfice du barème ;
 *  - sinon : le prix convenu (coût de la fiche produit).
 */
export function owedPerUnit(unitPrice: number, extra: number, commission: number | null, agreedCost: number) {
  return commission === null ? agreedCost : Math.max(0, unitPrice - (extra || 0) - commission);
}

/** Part de chaque ligne dans chaque vente (0 à 1). */
export function shareByLine(items: ItemLite[], lineOf: (productId: string | null, saleId: string) => string) {
  const gross = new Map<string, Map<string, number>>();
  for (const it of items) {
    const line = lineOf(it.productId, it.saleId);
    const value = Math.max(0, it.unitPrice * it.quantity - (it.discount || 0));
    const m = gross.get(it.saleId) || new Map(); gross.set(it.saleId, m);
    m.set(line, (m.get(line) || 0) + value);
  }
  const out = new Map<string, Map<string, number>>();
  for (const [saleId, m] of gross) {
    const total = [...m.values()].reduce((a, x) => a + x, 0);
    const res = new Map<string, number>();
    for (const [line, v] of m) res.set(line, total > 0 ? v / total : 1 / m.size);
    out.set(saleId, res);
  }
  return out;
}

export type LineFigures = { sales: number; collected: number; due: number; count: number; units: number; profit: number };
const zero = (): LineFigures => ({ sales: 0, collected: 0, due: 0, count: 0, units: 0, profit: 0 });

/** Jour de Tunis (AAAA-MM-JJ) d'une date. */
export function tunisDay(d: Date) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * Chiffres d'une ligne (ou de toutes si line = null) :
 *  - ventes et pièces vendues de la période ;
 *  - encaissé = paiements reçus pendant la période (règlements de dettes plus anciennes compris), répartis selon la vente payée ;
 *  - bénéfice = pièces vendues × barème de leur catégorie (0 sans barème) ;
 *  - par jour (rapport journalier) ;
 *  - dû des clients aujourd'hui, par client.
 */
export function computeLineReport(args: {
  line: string | null;
  sales: SaleLite[];
  dueSales: SaleLite[];
  items: ItemLite[];
  payments: { saleId: string | null; amount: number; createdAt: Date; method?: string }[];
  lineOf: (productId: string | null, saleId: string) => string;
  commissionOf?: (productId: string | null) => number | null;
  customerName: (id: string | null) => string;
}) {
  const shares = shareByLine(args.items, args.lineOf);
  const inLine = (pid: string | null, saleId: string) => args.line === null || args.lineOf(pid, saleId) === args.line;
  const shareOf = (saleId: string) => {
    const m = shares.get(saleId);
    if (!m) return args.line === null || args.line === OWN ? 1 : 0; // vente sans article : ligne principale
    if (args.line === null) return 1;
    return m.get(args.line) || 0;
  };
  const itemsBySale = new Map<string, ItemLite[]>();
  for (const it of args.items) { const a = itemsBySale.get(it.saleId) || []; a.push(it); itemsBySale.set(it.saleId, a); }
  const totals = zero();
  const days = new Map<string, LineFigures>();
  const methods = new Map<string, number>(); // recette par moyen de paiement
  const day = (d: Date) => { const k = tunisDay(d); const v = days.get(k) || zero(); days.set(k, v); return v; };
  for (const s of args.sales) {
    const share = shareOf(s.id);
    if (share <= 0) continue;
    let units = 0, profit = 0;
    for (const it of itemsBySale.get(s.id) || []) {
      if (!inLine(it.productId, s.id)) continue;
      units += it.quantity;
      const c = args.commissionOf?.(it.productId);
      if (c !== null && c !== undefined) profit += c * it.quantity;
    }
    for (const t of [totals, day(s.createdAt)]) { t.sales += s.total * share; t.count += 1; t.units += units; t.profit += profit; }
  }
  for (const p of args.payments) {
    const share = p.saleId ? shareOf(p.saleId) : (args.line === null || args.line === OWN ? 1 : 0);
    if (share <= 0) continue;
    const v = p.amount * share;
    totals.collected += v; day(p.createdAt).collected += v;
    const m = p.method || 'CASH'; methods.set(m, (methods.get(m) || 0) + v);
  }
  const byCustomer = new Map<string, number>();
  for (const s of args.dueSales) {
    const rest = Math.max(0, s.total - s.paid);
    if (rest <= 0.0005) continue;
    const share = shareOf(s.id);
    if (share <= 0) continue;
    totals.due += rest * share;
    const k = s.customerId || '';
    byCustomer.set(k, (byCustomer.get(k) || 0) + rest * share);
  }
  const round = (f: LineFigures): LineFigures => ({ sales: r3(f.sales), collected: r3(f.collected), due: r3(f.due), count: f.count, units: f.units, profit: r3(f.profit) });
  return {
    totals: round(totals),
    methods: [...methods.entries()].map(([method, amount]) => ({ method, amount: r3(amount) })).filter(m => m.amount > 0).sort((a, b) => b.amount - a.amount),
    days: [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, f]) => ({ date, ...round(f) })),
    customers: [...byCustomer.entries()].map(([id, due]) => ({ id: id || null, name: args.customerName(id || null), due: r3(due) })).filter(c => c.due > 0).sort((a, b) => b.due - a.due),
  };
}

/** Dépôt-vente : ce que le fournisseur doit au propriétaire = dû sur les pièces vendues − retours − paiements versés. */
export function consignmentBalance(soldOwed: number, returnedOwed: number, paidOut: number) {
  return { sold: r3(soldOwed), returned: r3(returnedOwed), paid: r3(paidOut), owed: r3(soldOwed - returnedOwed - paidOut) };
}

/** Lignes d'un fournisseur. */
export async function companyLines(companyId: string) {
  return prisma.supplierProductLine.findMany({ where: { companyId }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
}

/** Étiquette saisie dans un fichier Excel (« MG ») → ligne, créée si elle n'existe pas encore. Vide = produits du fournisseur. */
export async function lineIdFromTag(companyId: string, tag: unknown, cache: Map<string, string | null>) {
  const t = String(tag ?? '').trim().toUpperCase().slice(0, 12);
  if (!t) return null;
  if (cache.has(t)) return cache.get(t)!;
  const company = await prisma.supplierCompany.findUnique({ where: { id: companyId }, select: { ownLineTag: true } });
  if (company?.ownLineTag && company.ownLineTag.toUpperCase() === t) { cache.set(t, null); return null; } // « SL » = ses propres produits
  let line = await prisma.supplierProductLine.findFirst({ where: { companyId, tag: { equals: t, mode: 'insensitive' } } });
  if (!line) line = await prisma.supplierProductLine.create({ data: { companyId, name: t, tag: t, consignment: true } });
  cache.set(t, line.id);
  return line.id;
}

/** Vérifie qu'une ligne appartient bien au fournisseur (null = produits du fournisseur). */
export async function checkLineId(companyId: string, raw: unknown) {
  const id = String(raw ?? '').trim();
  if (!id || id === OWN) return null;
  const line = await prisma.supplierProductLine.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!line) throw Object.assign(new Error('Ligne de produits introuvable'), { status: 400 });
  return line.id;
}

/** Rapport complet d'une ligne pour une période (dates de Tunis incluses). */
export async function lineReport(companyId: string, line: string | null, from: Date, to: Date) {
  const [products, lines, company] = await Promise.all([
    prisma.supplierProduct.findMany({ where: { companyId }, select: { id: true, name: true, sku: true, barcode: true, category: true, stock: true, price: true, retailPrice: true, purchasePrice: true, averageCost: true, active: true, lineId: true, lineSince: true } }),
    companyLines(companyId),
    prisma.supplierCompany.findUnique({ where: { id: companyId }, select: { ownLineTag: true } }),
  ]);
  const byId = new Map(products.map(p => [p.id, p]));
  const meta = line && line !== OWN ? lines.find(l => l.id === line) || null : null;
  const commissions = meta ? cleanCommissions(meta.commissions) : {};
  const hasScale = Object.keys(commissions).length > 0;
  const saleDate = new Map<string, number>();
  // Un produit compte dans sa ligne à partir du jour où il y a été rangé ; ses ventes plus anciennes restent dans « mes produits ».
  const lineOf = (pid: string | null, saleId: string) => {
    const p = pid ? byId.get(pid) : null;
    if (!p?.lineId) return OWN;
    const since = p.lineSince ? p.lineSince.getTime() : 0;
    return (saleDate.get(saleId) ?? Infinity) >= since ? p.lineId : OWN;
  };
  const commissionOf = (pid: string | null) => {
    if (!hasScale || !pid) return null;
    const c = byId.get(pid)?.category || '';
    return c in commissions ? commissions[c] : null;
  };
  const [periodSales, dueSales, payments] = await Promise.all([
    prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' }, createdAt: { gte: from, lt: to } }, select: { id: true, customerId: true, total: true, paid: true, createdAt: true, reference: true } }),
    prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' } }, select: { id: true, customerId: true, total: true, paid: true, createdAt: true } }),
    prisma.supplierErpPayment.findMany({ where: { companyId, kind: 'IN', createdAt: { gte: from, lt: to } }, select: { saleId: true, amount: true, createdAt: true, method: true } }),
  ]);
  const num = (s: any): SaleLite => ({ id: s.id, customerId: s.customerId, total: Number(s.total), paid: Number(s.paid), createdAt: s.createdAt });
  for (const s of [...periodSales, ...dueSales]) saleDate.set(s.id, s.createdAt.getTime());
  const due = dueSales.map(num).filter(s => s.total - s.paid > 0.0005);
  const saleIds = [...new Set([...periodSales.map(s => s.id), ...due.map(s => s.id), ...payments.map(p => p.saleId).filter(Boolean) as string[]])];
  const toItem = (i: any): ItemLite => ({ saleId: i.saleId, productId: i.productId, quantity: i.quantity, unitPrice: Number(i.unitPrice), unitCost: Number(i.unitCost), discount: Number(i.discount), extra: Number(i.extra || 0) });
  const itemSelect = { saleId: true, productId: true, quantity: true, unitPrice: true, unitCost: true, discount: true, extra: true } as const;
  const rawItems = saleIds.length ? await prisma.supplierErpSaleItem.findMany({ where: { saleId: { in: saleIds } }, select: { ...itemSelect, name: true } }) : [];
  const items: ItemLite[] = rawItems.map(toItem);
  const unknown = saleIds.filter(id => !saleDate.has(id));
  if (unknown.length) for (const s of await prisma.supplierErpSale.findMany({ where: { id: { in: unknown } }, select: { id: true, createdAt: true } })) saleDate.set(s.id, s.createdAt.getTime());
  const customerIds = [...new Set(due.map(s => s.customerId).filter(Boolean) as string[])];
  const customers = customerIds.length ? await prisma.supplierErpCustomer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }) : [];
  const cname = new Map(customers.map(c => [c.id, c.name]));
  const report = computeLineReport({
    line, sales: periodSales.map(num), dueSales: due, items,
    payments: payments.map(p => ({ saleId: p.saleId, amount: Number(p.amount), createdAt: p.createdAt, method: p.method })),
    lineOf, commissionOf, customerName: id => (id && cname.get(id)) || 'Client comptoir',
  });

  // Journal de la ligne : chaque article vendu sur la période (heure, ticket, produit, quantité, montant) — sans coût ni bénéfice.
  const inPeriod = new Map(periodSales.map(s => [s.id, s]));
  const journalAll = rawItems.filter(i => inPeriod.has(i.saleId) && (line === null || lineOf(i.productId, i.saleId) === line))
    .map(i => { const sale = inPeriod.get(i.saleId)!; return { at: sale.createdAt, reference: sale.reference, name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), total: r3(Number(i.unitPrice) * i.quantity - Number(i.discount)) }; })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const journal = journalAll.slice(0, 1500), journalMore = journalAll.length - journal.length;

  // Stock de la ligne : liste des produits, quantités et valeur au coût (pour l'inventaire de la ligne).
  const inStock = products.filter(p => p.active && (line === null || (line === OWN ? !p.lineId : p.lineId === line)));
  const cost = (p: typeof products[number]) => Number(p.purchasePrice) || Number(p.averageCost) || 0;
  const stock = {
    products: inStock.length,
    quantity: inStock.reduce((a, p) => a + Math.max(0, p.stock), 0),
    value: r3(inStock.reduce((a, p) => a + Math.max(0, p.stock) * cost(p), 0)),
    items: inStock.sort((a, b) => a.name.localeCompare(b.name, 'fr')).slice(0, 1000).map(p => ({
      id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, category: p.category, stock: p.stock,
      price: Number(p.retailPrice ?? p.price), cost: cost(p), value: r3(Math.max(0, p.stock) * cost(p)),
    })),
  };

  // Dépôt-vente : dû sur tout ce qui a été vendu depuis l'entrée dans la ligne, moins les retours et les paiements.
  let consignment = null as null | ReturnType<typeof consignmentBalance>;
  if (meta?.consignment) {
    const lineProducts = products.filter(p => p.lineId === line).map(p => p.id);
    const allItems = lineProducts.length ? (await prisma.supplierErpSaleItem.findMany({ where: { productId: { in: lineProducts } }, select: itemSelect })).map(toItem) : [];
    const valid = new Map((await prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' }, id: { in: [...new Set(allItems.map(i => i.saleId))] } }, select: { id: true, createdAt: true } })).map(s => [s.id, s.createdAt.getTime()]));
    const since = (pid: string | null) => { const p = pid ? byId.get(pid) : null; return p?.lineSince ? p.lineSince.getTime() : 0; };
    const sold = allItems.filter(i => valid.has(i.saleId) && valid.get(i.saleId)! >= since(i.productId))
      .reduce((a, i) => a + owedPerUnit(i.unitPrice, i.extra || 0, commissionOf(i.productId), i.unitCost) * i.quantity, 0);
    // Retours clients terminés sur ces produits : la pièce revient, le dû diminue d'autant.
    const returned = lineProducts.length ? await prisma.supplierReturnItem.findMany({ where: { productId: { in: lineProducts } }, select: { returnId: true, productId: true, quantity: true, unitPrice: true } }) : [];
    const doneReturns = returned.length ? new Map((await prisma.supplierReturn.findMany({ where: { companyId, status: 'COMPLETED', id: { in: [...new Set(returned.map(r => r.returnId))] } }, select: { id: true, createdAt: true } })).map(r => [r.id, r.createdAt.getTime()])) : new Map<string, number>();
    const back = returned.filter(r => doneReturns.has(r.returnId) && doneReturns.get(r.returnId)! >= since(r.productId))
      .reduce((a, r) => { const p = byId.get(r.productId as string); return a + owedPerUnit(Number(r.unitPrice), 0, commissionOf(r.productId), p ? cost(p) : 0) * r.quantity; }, 0);
    const paidOut = await prisma.supplierErpPayment.aggregate({ where: { companyId, kind: 'OUT', lineId: line as string }, _sum: { amount: true } });
    consignment = consignmentBalance(sold, back, Number(paidOut._sum.amount || 0));
  }
  return { line, lines, ownTag: company?.ownLineTag || null, hasScale, commissions, ...report, journal, journalMore, stock, consignment };
}
