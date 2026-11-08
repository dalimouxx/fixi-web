import { prisma } from './prisma';

/**
 * Lignes de produits d'un fournisseur (ex. « MG » : produits d'un importateur en dépôt-vente).
 * Chaque article vendu appartient à la ligne de sa fiche produit : un panier qui mélange SL et MG
 * est donc séparé automatiquement. La remise, le montant payé et le reste dû d'une vente sont
 * répartis entre les lignes au prorata de la valeur de leurs articles.
 */
export const OWN = 'own';

export type SaleLite = { id: string; customerId: string | null; total: number; paid: number; createdAt: Date };
export type ItemLite = { saleId: string; productId: string | null; quantity: number; unitPrice: number; unitCost: number; discount: number };

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Part de chaque ligne dans chaque vente (0 à 1) et coût des articles de la ligne. */
export function shareByLine(items: ItemLite[], lineOf: (productId: string | null, saleId: string) => string) {
  const gross = new Map<string, Map<string, { value: number; cost: number }>>();
  for (const it of items) {
    const line = lineOf(it.productId, it.saleId);
    const value = Math.max(0, it.unitPrice * it.quantity - (it.discount || 0));
    const m = gross.get(it.saleId) || new Map(); gross.set(it.saleId, m);
    const cur = m.get(line) || { value: 0, cost: 0 };
    cur.value += value; cur.cost += it.unitCost * it.quantity;
    m.set(line, cur);
  }
  const out = new Map<string, Map<string, { share: number; cost: number }>>();
  for (const [saleId, m] of gross) {
    const total = [...m.values()].reduce((a, x) => a + x.value, 0);
    const n = m.size;
    const res = new Map<string, { share: number; cost: number }>();
    for (const [line, x] of m) res.set(line, { share: total > 0 ? x.value / total : 1 / n, cost: x.cost });
    out.set(saleId, res);
  }
  return out;
}

export type LineFigures = { sales: number; cost: number; profit: number; collected: number; due: number; count: number };
const zero = (): LineFigures => ({ sales: 0, cost: 0, profit: 0, collected: 0, due: 0, count: 0 });

/** Jour de Tunis (AAAA-MM-JJ) d'une date. */
export function tunisDay(d: Date) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * Chiffres d'une ligne (ou de toutes si line = null) :
 *  - ventes, coût et bénéfice des ventes de la période ;
 *  - encaissé = paiements reçus pendant la période (y compris les règlements de dettes plus anciennes), répartis selon la vente payée ;
 *  - par jour (rapport journalier) ;
 *  - dû des clients aujourd'hui, par client.
 */
export function computeLineReport(args: {
  line: string | null;
  sales: SaleLite[];               // ventes non annulées de la période
  dueSales: SaleLite[];            // toutes les ventes non annulées encore dues
  items: ItemLite[];               // articles de toutes ces ventes
  payments: { saleId: string | null; amount: number; createdAt: Date }[]; // encaissements de la période
  lineOf: (productId: string | null, saleId: string) => string;
  customerName: (id: string | null) => string;
}) {
  const shares = shareByLine(args.items, args.lineOf);
  const shareOf = (saleId: string) => {
    const m = shares.get(saleId);
    if (!m) return { share: args.line === null || args.line === OWN ? 1 : 0, cost: 0 }; // vente sans article : ligne principale
    if (args.line === null) return { share: 1, cost: [...m.values()].reduce((a, x) => a + x.cost, 0) };
    return m.get(args.line) || { share: 0, cost: 0 };
  };
  const totals = zero();
  const days = new Map<string, LineFigures>();
  const day = (d: Date) => { const k = tunisDay(d); const v = days.get(k) || zero(); days.set(k, v); return v; };
  for (const s of args.sales) {
    const { share, cost } = shareOf(s.id);
    if (share <= 0) continue;
    const sales = s.total * share, profit = sales - cost;
    for (const t of [totals, day(s.createdAt)]) { t.sales += sales; t.cost += cost; t.profit += profit; t.count += 1; }
  }
  for (const p of args.payments) {
    const share = p.saleId ? shareOf(p.saleId).share : (args.line === null || args.line === OWN ? 1 : 0);
    if (share <= 0) continue;
    const v = p.amount * share;
    totals.collected += v; day(p.createdAt).collected += v;
  }
  const byCustomer = new Map<string, number>();
  for (const s of args.dueSales) {
    const rest = Math.max(0, s.total - s.paid);
    if (rest <= 0.0005) continue;
    const { share } = shareOf(s.id);
    if (share <= 0) continue;
    const v = rest * share;
    totals.due += v;
    const k = s.customerId || '';
    byCustomer.set(k, (byCustomer.get(k) || 0) + v);
  }
  const round = (f: LineFigures): LineFigures => ({ sales: r3(f.sales), cost: r3(f.cost), profit: r3(f.profit), collected: r3(f.collected), due: r3(f.due), count: f.count });
  return {
    totals: round(totals),
    days: [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, f]) => ({ date, ...round(f) })),
    customers: [...byCustomer.entries()].map(([id, due]) => ({ id: id || null, name: args.customerName(id || null), due: r3(due) })).filter(c => c.due > 0).sort((a, b) => b.due - a.due),
  };
}

/** Dépôt-vente : ce que le fournisseur doit au propriétaire de la ligne = coût des articles vendus − paiements versés. */
export function consignmentBalance(soldCost: number, paidOut: number) {
  return { soldCost: r3(soldCost), paid: r3(paidOut), owed: r3(soldCost - paidOut) };
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
  const [products, lines] = await Promise.all([
    prisma.supplierProduct.findMany({ where: { companyId, lineId: { not: null } }, select: { id: true, lineId: true, lineSince: true } }),
    companyLines(companyId),
  ]);
  const productLine = new Map(products.map(p => [p.id, { line: p.lineId as string, since: p.lineSince ? p.lineSince.getTime() : 0 }]));
  const saleDate = new Map<string, number>();
  // Un produit compte dans sa ligne à partir du jour où il y a été rangé ; ses ventes plus anciennes restent dans « mes produits ».
  const lineOf = (pid: string | null, saleId: string) => { const x = pid ? productLine.get(pid) : null; return x && (saleDate.get(saleId) ?? Infinity) >= x.since ? x.line : OWN; };
  const [periodSales, dueSales, payments] = await Promise.all([
    prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' }, createdAt: { gte: from, lt: to } }, select: { id: true, customerId: true, total: true, paid: true, createdAt: true } }),
    prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' } }, select: { id: true, customerId: true, total: true, paid: true, createdAt: true } }),
    prisma.supplierErpPayment.findMany({ where: { companyId, kind: 'IN', createdAt: { gte: from, lt: to } }, select: { saleId: true, amount: true, createdAt: true } }),
  ]);
  const num = (s: any): SaleLite => ({ id: s.id, customerId: s.customerId, total: Number(s.total), paid: Number(s.paid), createdAt: s.createdAt });
  for (const s of [...periodSales, ...dueSales]) saleDate.set(s.id, s.createdAt.getTime());
  const due = dueSales.map(num).filter(s => s.total - s.paid > 0.0005);
  const saleIds = [...new Set([...periodSales.map(s => s.id), ...due.map(s => s.id), ...payments.map(p => p.saleId).filter(Boolean) as string[]])];
  const items: ItemLite[] = saleIds.length ? (await prisma.supplierErpSaleItem.findMany({ where: { saleId: { in: saleIds } }, select: { saleId: true, productId: true, quantity: true, unitPrice: true, unitCost: true, discount: true } }))
    .map(i => ({ saleId: i.saleId, productId: i.productId, quantity: i.quantity, unitPrice: Number(i.unitPrice), unitCost: Number(i.unitCost), discount: Number(i.discount) })) : [];
  const unknown = saleIds.filter(id => !saleDate.has(id));
  if (unknown.length) for (const s of await prisma.supplierErpSale.findMany({ where: { id: { in: unknown } }, select: { id: true, createdAt: true } })) saleDate.set(s.id, s.createdAt.getTime());
  const customerIds = [...new Set(due.map(s => s.customerId).filter(Boolean) as string[])];
  const customers = customerIds.length ? await prisma.supplierErpCustomer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }) : [];
  const cname = new Map(customers.map(c => [c.id, c.name]));
  const report = computeLineReport({
    line, sales: periodSales.map(num), dueSales: due, items,
    payments: payments.map(p => ({ saleId: p.saleId, amount: Number(p.amount), createdAt: p.createdAt })),
    lineOf, customerName: id => (id && cname.get(id)) || 'Client comptoir',
  });
  // Dépôt-vente : coût de tout ce qui a été vendu depuis le début − paiements déjà versés au propriétaire.
  let consignment = null as null | ReturnType<typeof consignmentBalance> & { periodCost: number };
  const meta = line && line !== OWN ? lines.find(l => l.id === line) : null;
  if (meta?.consignment) {
    const lineProducts = products.filter(p => p.lineId === line).map(p => p.id);
    const allItems = lineProducts.length ? await prisma.supplierErpSaleItem.findMany({ where: { productId: { in: lineProducts } }, select: { saleId: true, productId: true, quantity: true, unitCost: true } }) : [];
    const valid = new Map((await prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' }, id: { in: [...new Set(allItems.map(i => i.saleId))] } }, select: { id: true, createdAt: true } })).map(s => [s.id, s.createdAt.getTime()]));
    const since = (pid: string | null) => (pid && productLine.get(pid)?.since) || 0;
    const soldCost = allItems.filter(i => valid.has(i.saleId) && valid.get(i.saleId)! >= since(i.productId)).reduce((a, i) => a + Number(i.unitCost) * i.quantity, 0);
    const paidOut = await prisma.supplierErpPayment.aggregate({ where: { companyId, kind: 'OUT', lineId: line }, _sum: { amount: true } });
    consignment = { ...consignmentBalance(soldCost, Number(paidOut._sum.amount || 0)), periodCost: report.totals.cost };
  }
  return { line, lines, ...report, consignment };
}
