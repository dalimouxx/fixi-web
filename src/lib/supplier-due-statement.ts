import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Common invoice-based source for both Atelier screens. Open orders are not invoices.
const zero = new Prisma.Decimal(0);
const fmt = (n: Prisma.Decimal) => Number(n.toFixed(3));

export async function shopSupplierStatement(shopId: string) {
  const customers = await prisma.supplierErpCustomer.findMany({
    where: { shopId }, select: { id: true, companyId: true, name: true },
  });
  const customerIds = customers.map(c => c.id);
  if (!customerIds.length) return { totalDue: 0, totalPaid: 0, totalInvoiced: 0, suppliers: [], pendingOrders: [] };

  const companyIds = [...new Set(customers.map(c => c.companyId))];
  const [companies, sales, pendingOrders, receipts] = await Promise.all([
    prisma.supplierCompany.findMany({ where: { id: { in: companyIds } },
      select: { id: true, name: true, phone: true, region: true, address: true } }),
    prisma.supplierErpSale.findMany({ where: {
      companyId: { in: companyIds }, customerId: { in: customerIds }, status: { not: 'CANCELLED' },
    }, orderBy: { createdAt: 'desc' } }),
    prisma.supplierOrder.findMany({
      where: { shopId, status: { notIn: ['CANCELLED', 'DELIVERED'] } },
      select: { id: true, reference: true, total: true, status: true, createdAt: true,
        company: { select: { name: true } } }, orderBy: { createdAt: 'desc' },
    }),
    prisma.supplierSettlement.findMany({
      where: { shopId, companyId: { in: companyIds } },
      select: { id: true, orderId: true, companyId: true, reference: true, amount: true,
        method: true, collector: true, status: true, note: true, proofUrl: true,
        driverAccountId: true, collectedAt: true, confirmedAt: true, createdAt: true },
    }),
  ]);

  const saleIds = sales.map(s => s.id);
  const orderIds = sales.map(s => s.sourceOrderId).filter((x): x is string => !!x);
  const [lines, payments, returns, orders, drivers] = await Promise.all([
    saleIds.length ? prisma.supplierErpSaleItem.findMany({
      where: { saleId: { in: saleIds } }, select: { id: true, saleId: true, name: true, sku: true,
        quantity: true, unitPrice: true, discount: true },
    }) : Promise.resolve([]),
    saleIds.length ? prisma.supplierErpPayment.findMany({
      where: { companyId: { in: companyIds }, saleId: { in: saleIds }, kind: 'IN' },
      orderBy: { createdAt: 'asc' },
    }) : Promise.resolve([]),
    saleIds.length ? prisma.supplierReturn.findMany({
      where: { companyId: { in: companyIds }, sourceSaleId: { in: saleIds },
        type: 'SALE_RETURN', status: 'COMPLETED' },
      select: { id: true, reference: true, sourceSaleId: true, total: true, refund: true, createdAt: true },
    }) : Promise.resolve([]),
    orderIds.length ? prisma.supplierOrder.findMany({ where: { id: { in: orderIds }, shopId },
      select: { id: true, reference: true, delivery: { select: {
        driverName: true, deliveredAt: true, recipientName: true, proofUrl: true,
      } } } }) : Promise.resolve([]),
    receipts.some(r => r.driverAccountId) ? prisma.supplierAccount.findMany({
      where: { id: { in: receipts.map(r => r.driverAccountId).filter((x): x is string => !!x) } },
      select: { id: true, fullName: true },
    }) : Promise.resolve([]),
  ]);

  const receiptMap = new Map(receipts.map(r => [r.reference, r]));
  const driverMap = new Map(drivers.map(d => [d.id, d.fullName]));
  const orderMap = new Map(orders.map(o => [o.id, o]));
  const supplierRows = customers.map(customer => {
    const company = companies.find(c => c.id === customer.companyId) || null;
    const invoiceRows = sales.filter(s => s.customerId === customer.id).map(sale => {
      const credits = returns.filter(r => r.sourceSaleId === sale.id);
      const creditTotal = credits.reduce((n,r) => n.plus(r.total), zero);
      const refunded = credits.reduce((n,r) => n.plus(r.refund), zero);
      // Match the existing Supplier ERP's net credit computation exactly.
      const netTotal = Prisma.Decimal.max(zero, sale.total.minus(creditTotal));
      const netPaid = Prisma.Decimal.max(zero, sale.paid.minus(refunded));
      const due = Prisma.Decimal.max(zero, netTotal.minus(netPaid));
      const order = sale.sourceOrderId ? orderMap.get(sale.sourceOrderId) : null;
      const journal = payments.filter(p => p.saleId === sale.id).map(p => {
        const receipt = receiptMap.get(p.reference || '');
        const sameInvoice = !!receipt && receipt.companyId === customer.companyId &&
          (!receipt.orderId || receipt.orderId === sale.sourceOrderId);
        const collector = sameInvoice ? receipt.collector :
          (p.note === 'COD Fixi Delivery' ? 'DELIVERY_LEGACY' : 'SUPPLIER');
        return {
          id: p.id, reference: sameInvoice ? receipt.reference : (p.reference || sale.reference),
          amount: fmt(p.amount), method: p.method, date: sameInvoice
            ? (receipt.confirmedAt || p.createdAt) : p.createdAt,
          createdAt: p.createdAt, status: 'CONFIRMED', collector,
          collectorName: sameInvoice && receipt.driverAccountId
            ? driverMap.get(receipt.driverAccountId) || 'Livreur' : null,
          note: sameInvoice ? receipt.note : p.note,
          proofUrl: sameInvoice ? receipt.proofUrl : null,
        };
      });
      const pending = receipts.filter(r => r.status === 'PENDING' && r.orderId === sale.sourceOrderId &&
        r.companyId === customer.companyId).map(r => ({
          id: r.id, reference: r.reference, amount: fmt(r.amount), method: r.method,
          date: r.collectedAt, status: r.status, collector: r.collector,
          collectorName: r.driverAccountId ? driverMap.get(r.driverAccountId) || 'Livreur' : null,
        }));
      return {
        id: sale.id, reference: sale.reference, sourceOrderId: sale.sourceOrderId,
        createdAt: sale.createdAt, status: sale.status, total: fmt(netTotal),
        originalTotal: fmt(sale.total), paid: fmt(netPaid), due: fmt(due),
        items: lines.filter(i => i.saleId === sale.id).map(i => ({
          id: i.id, name: i.name, sku: i.sku, quantity: i.quantity,
          unitPrice: fmt(i.unitPrice), discount: fmt(i.discount),
        })),
        payments: journal, pendingCollections: pending,
        credits: credits.map(r => ({
          id: r.id, reference: r.reference, date: r.createdAt,
          amount: fmt(r.total), refunded: fmt(r.refund),
        })),
        delivery: order?.delivery || null,
      };
    });
    return {
      customerId: customer.id, company,
      totalInvoiced: fmt(invoiceRows.reduce((n,r) => n.plus(r.total), zero)),
      totalPaid: fmt(invoiceRows.reduce((n,r) => n.plus(r.paid), zero)),
      due: fmt(invoiceRows.reduce((n,r) => n.plus(r.due), zero)),
      sales: invoiceRows,
    };
  });
  return {
    totalDue: fmt(supplierRows.reduce((n,r) => n.plus(r.due), zero)),
    totalPaid: fmt(supplierRows.reduce((n,r) => n.plus(r.totalPaid), zero)),
    totalInvoiced: fmt(supplierRows.reduce((n,r) => n.plus(r.totalInvoiced), zero)),
    suppliers: supplierRows,
    pendingOrders: pendingOrders.map(o => ({
      id: o.id, reference: o.reference, createdAt: o.createdAt,
      supplier: o.company.name, status: o.status, total: fmt(o.total),
      collections: receipts.filter(r=>r.orderId===o.id)
        .map(r=>({ id:r.id,reference:r.reference,amount:fmt(r.amount),date:r.confirmedAt||r.collectedAt,
          collector:r.collector,status:r.status,method:r.method,
          collectorName:r.driverAccountId?driverMap.get(r.driverAccountId)||'Livreur':null })),
    })),
  };
}
