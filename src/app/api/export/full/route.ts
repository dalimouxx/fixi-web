import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad } from '@/lib/http';
import { audit } from '@/lib/audit';
import { buildZip, toCsv } from '@/lib/zip';

/**
 * Copie complète des données de l'atelier (gérant seulement) : un ZIP avec un CSV par sujet
 * (ouvrable dans Excel) et un JSON complet. Jamais de codes PIN, de jetons ni de clés.
 */
export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    const shopId = s.shopId;
    const [shop, users, clients, repairs, payments, inventory, movements, documents, counterSales, expenses, cashSessions, suppliers, purchases, warranties, appointments] = await Promise.all([
      prisma.shop.findUniqueOrThrow({ where: { id: shopId } }),
      prisma.user.findMany({ where: { shopId }, select: { id: true, fullName: true, loginCode: true, role: true, phone: true, email: true, isActive: true, createdAt: true } }),
      prisma.client.findMany({ where: { shopId }, orderBy: { createdAt: 'asc' } }),
      prisma.repair.findMany({ where: { shopId }, include: { parts: true, statusEvents: true }, orderBy: { createdAt: 'asc' } }),
      prisma.payment.findMany({ where: { shopId }, orderBy: { createdAt: 'asc' } }),
      prisma.inventoryItem.findMany({ where: { shopId }, orderBy: { name: 'asc' } }),
      prisma.stockMovement.findMany({ where: { shopId }, orderBy: { createdAt: 'asc' } }),
      prisma.salesDocument.findMany({ where: { shopId }, include: { lines: true, payments: true }, orderBy: { createdAt: 'asc' } }),
      prisma.counterSale.findMany({ where: { shopId }, include: { lines: true }, orderBy: { createdAt: 'asc' } }),
      prisma.expense.findMany({ where: { shopId }, orderBy: { createdAt: 'asc' } }),
      prisma.cashSession.findMany({ where: { shopId }, orderBy: { openedAt: 'asc' } }),
      prisma.supplier.findMany({ where: { shopId } }),
      prisma.purchase.findMany({ where: { shopId }, include: { items: true } }),
      prisma.warrantyClaim.findMany({ where: { shopId } }),
      prisma.appointment.findMany({ where: { shopId } }),
    ]);
    // Paramètres de la boutique sans aucun secret (jetons WhatsApp, clés de paiement, IA…).
    const safeShop = Object.fromEntries(Object.entries(shop).filter(([k]) => !/token|secret|apikey|api_key|key$|password|hash/i.test(k)));
    const stamp = new Date().toISOString().slice(0, 10);
    const files = [
      { name: 'LISEZ-MOI.txt', data: `Export complet Fixi — ${shop.name} — ${new Date().toLocaleString('fr-FR',{timeZone:'Africa/Tunis'})}\r\n\r\nLes fichiers CSV s'ouvrent dans Excel (séparateur « ; », UTF-8).\r\ndonnees-completes.json contient tout, y compris l'historique des réparations et les lignes de documents.\r\nLes codes PIN, jetons et clés ne sont jamais exportés.\r\n` },
      { name: 'clients.csv', data: toCsv(clients as any[], ['id', 'fullName', 'phone', 'email', 'notes', 'loyaltyPoints', 'createdAt']) },
      { name: 'reparations.csv', data: toCsv(repairs.map(({ parts, statusEvents, publicToken, ...r }) => r) as any[]) },
      { name: 'pieces-utilisees.csv', data: toCsv(repairs.flatMap(r => r.parts.map(p => ({ repairCode: r.code, ...p }))) as any[]) },
      { name: 'paiements.csv', data: toCsv(payments as any[]) },
      { name: 'stock.csv', data: toCsv(inventory as any[]) },
      { name: 'mouvements-stock.csv', data: toCsv(movements as any[]) },
      { name: 'devis-factures.csv', data: toCsv(documents.map(d => ({ ...d, lines: undefined, payments: undefined })) as any[]) },
      { name: 'ventes-comptoir.csv', data: toCsv(counterSales.flatMap(v => v.lines.map(l => ({ vente: v.number, date: v.createdAt, article: l.name, quantite: l.quantity, rendus: l.returnedQuantity, prix: l.unitPrice, total: l.total, remiseVente: v.discount, totalVente: v.total, rembourse: v.refundedTotal })))) },
      { name: 'depenses.csv', data: toCsv(expenses as any[]) },
      { name: 'sessions-caisse.csv', data: toCsv(cashSessions as any[]) },
      { name: 'equipe.csv', data: toCsv(users as any[]) },
      { name: 'donnees-completes.json', data: JSON.stringify({ exportedAt: new Date(), shop: safeShop, users, clients, repairs, payments, inventory, movements, documents, counterSales, expenses, cashSessions, suppliers, purchases, warranties, appointments }, (k, v) => /^(publicToken|walletToken|pinHash|recoveryCodeHash)$/.test(k) ? undefined : typeof v === 'bigint' ? String(v) : v && typeof v === 'object' && v.constructor?.name === 'Decimal' ? Number(v) : v, 1) },
    ];
    const zip = buildZip(files);
    await audit(shopId, s.id, 'EXPORT_FULL', 'SHOP', shopId, { bytes: zip.length, clients: clients.length, repairs: repairs.length });
    return new Response(new Uint8Array(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="fixi-${shop.slug}-${stamp}.zip"`, 'Cache-Control': 'no-store' } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}
