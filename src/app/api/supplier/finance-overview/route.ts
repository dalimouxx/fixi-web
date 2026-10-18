import { prisma } from '@/lib/prisma';
import { requireSupplierRole } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
const d = (v: unknown) => new Prisma.Decimal(String(v ?? 0));
const num = (v: Prisma.Decimal) => Number(v.toFixed(3));
const zero = new Prisma.Decimal(0);

export async function GET() {
  try {
    const s = await requireSupplierRole(['OWNER','ADMIN','MANAGER','ACCOUNTANT','CASHIER']);
    const companyId = s.companyId;
    const [customers, sales, receipts, shifts, accounts] = await Promise.all([
      prisma.supplierErpCustomer.findMany({ where: { companyId },
        select: { id:true,shopId:true,name:true,phone:true,region:true }, orderBy: { name:'asc' } }),
      prisma.supplierErpSale.findMany({ where: { companyId, status: { not: 'CANCELLED' } },
        orderBy: { createdAt:'desc' } }),
      prisma.supplierSettlement.findMany({ where: { companyId },
        include: { remittances:true, shop: { select:{ name:true } },
          order: { select:{ reference:true } } }, orderBy: { createdAt:'desc' } }),
      prisma.supplierDeliveryShift.findMany({ where:{ companyId },
        orderBy:{ openedAt:'desc' }, take:100 }),
      prisma.supplierAccount.findMany({ where:{ companyId },select:{ id:true,fullName:true,role:true } }),
    ]);
    const saleIds = sales.map(x => x.id);
    const [payments,returns] = await Promise.all([
      saleIds.length ? prisma.supplierErpPayment.findMany({ where: { companyId, saleId: { in:saleIds } },
        orderBy:{ createdAt:'desc' } }) : Promise.resolve([]),
      saleIds.length ? prisma.supplierReturn.findMany({ where: { companyId, type:'SALE_RETURN',
        status:'COMPLETED', sourceSaleId:{in:saleIds} },
        select:{id:true,reference:true,sourceSaleId:true,total:true,refund:true,createdAt:true} }) : Promise.resolve([]),
    ]);
    const accountName = new Map(accounts.map(x=>[x.id,x.fullName]));
    const customerName = new Map(customers.map(x=>[x.id,x.name]));
    const receiptMap = new Map(receipts.map(x=>[x.reference,x]));
    const salesMap = new Map(sales.map(x=>[x.id,x]));
    const invoiceRows = sales.map(x=>{
      const credits=returns.filter(r=>r.sourceSaleId===x.id);
      const netTotal=Prisma.Decimal.max(zero,x.total.minus(credits.reduce((n,r)=>n.plus(r.total),zero)));
      const netPaid=Prisma.Decimal.max(zero,x.paid.minus(credits.reduce((n,r)=>n.plus(r.refund),zero)));
      return {id:x.id,reference:x.reference,customerId:x.customerId,customerName:x.customerId ? customerName.get(x.customerId)||'Client':'Sans client',
        sourceOrderId:x.sourceOrderId,createdAt:x.createdAt,total:num(netTotal),
        paid:num(netPaid),due:num(Prisma.Decimal.max(zero,netTotal.minus(netPaid)))};
    });
    const clients=customers.map(c=>{
      const rows=invoiceRows.filter(r=>r.customerId===c.id);
      return {id:c.id,name:c.name,shopId:c.shopId,phone:c.phone,region:c.region,
        due:num(rows.reduce((n,x)=>n.plus(x.due),zero)),paid:num(rows.reduce((n,x)=>n.plus(x.paid),zero)),
        invoices:rows};
    }).filter(c=>c.invoices.length).sort((a,b)=>b.due-a.due);

    const cashReceipts=receipts.map(r=>{
      const remitted=r.remittances.filter(x=>x.confirmedAt).reduce((n,x)=>n.plus(x.amount),zero);
      return {id:r.id,reference:r.reference,companyId:r.companyId,orderId:r.orderId,
        orderReference:r.order?.reference||null,shopId:r.shopId,shopName:r.shop.name,
        driverName:r.driverAccountId?accountName.get(r.driverAccountId)||'Livreur':null,
        collector:r.collector,status:r.status,method:r.method,amount:num(r.amount),note:r.note,
        proofUrl:r.proofUrl,createdAt:r.createdAt,collectedAt:r.collectedAt,confirmedAt:r.confirmedAt,
        remitted:num(remitted),remainingToRemit:r.collector==='DRIVER'&&r.status==='CONFIRMED'
          ?num(Prisma.Decimal.max(zero,r.amount.minus(remitted))):0,
        remittances:r.remittances.map(x=>({id:x.id,reference:x.reference,amount:num(x.amount),
          createdAt:x.createdAt,confirmedAt:x.confirmedAt}))};
    });
    const approved= cashReceipts.filter(r=>r.collector==='DRIVER'&&r.status==='CONFIRMED');
    const owed=approved.reduce((n,r)=>n+r.remainingToRemit,0);
    const waiting=cashReceipts.filter(r=>r.collector==='DRIVER'&&r.status==='PENDING');
    const openShifts=shifts.filter(x=>x.status==='OPEN');
    const openedEvents=openShifts.length?await prisma.supplierDeliveryEvent.findMany({
      where: { companyId, type: { in:['COD_COLLECTED','DUE_COLLECTED'] },
        accountId: {in:openShifts.map(x=>x.driverAccountId)},
        createdAt: {gte: new Date(Math.min(...openShifts.map(x=>x.openedAt.getTime()))) } },
      select:{ accountId:true,createdAt:true,amount:true },
    }):[];
    const deliveryShifts=shifts.map(shift=>{
      const collected=shift.status==='OPEN' ? openedEvents.filter(e=>e.accountId===shift.driverAccountId &&
        e.createdAt>=shift.openedAt).reduce((n,e)=>n.plus(e.amount||0),zero) : shift.collectedCod;
      return {id:shift.id,driverName:accountName.get(shift.driverAccountId)||'Livreur',
        status:shift.status,openedAt:shift.openedAt,submittedAt:shift.submittedAt,
        confirmedAt:shift.confirmedAt,closedAt:shift.closedAt,
        collected:num(collected),declared:num(d(shift.declaredRemit)),
        remitted:num(shift.remittedCod),
        outstanding:num(Prisma.Decimal.max(zero,collected.minus(shift.remittedCod))),
        difference:num(d(shift.cashDifference)),note:shift.note};
    });
    const paymentEvents=payments.map(p=>{
      const match=receiptMap.get(p.reference||'');
      const sale=p.saleId?salesMap.get(p.saleId):null;
      const source=match?.collector==='DRIVER'?'Livreur : '+(match.driverAccountId?accountName.get(match.driverAccountId)||'Livreur':'Livreur'):
        p.note==='COD Fixi Delivery'?'Livraison COD (historique)':p.accountId?accountName.get(p.accountId)||'Fournisseur':'Fournisseur';
      return {id:'pay:'+p.id,type:p.kind==='OUT'?'REMBOURSEMENT':'PAIEMENT',date:match?.confirmedAt||p.createdAt,
        amount:num(p.amount),reference:p.reference||sale?.reference||'—',invoiceReference:sale?.reference||'—',
        customerName:p.customerId?customerName.get(p.customerId)||'Client':'—',
        method:p.method,source,status:'CONFIRMED',proofUrl:match?.proofUrl||null,note:p.note||match?.note||null};
    });
    const pendingEvents=cashReceipts.filter(x=>x.status==='PENDING').map(x=>({
      id:'pending:'+x.id,type:'PAIEMENT_A_VALIDER',date:x.collectedAt,amount:x.amount,
      reference:x.reference,invoiceReference:x.orderReference||'—',customerName:x.shopName,
      method:x.method,source:x.driverName||'Fournisseur',status:'PENDING',proofUrl:x.proofUrl,note:x.note,
    }));
    const remittanceEvents=cashReceipts.flatMap(x=>x.remittances.filter(r=>r.confirmedAt).map(r=>({
      id:'remit:'+r.id,type:'REMISE_LIVREUR',date:r.confirmedAt!,amount:r.amount,reference:r.reference,
      invoiceReference:x.orderReference||'—',customerName:x.shopName,method:'CASH',
      source:x.driverName||'Livreur',status:'CONFIRMED',proofUrl:null,note:'Reversé au fournisseur',
    })));
    const creditEvents=returns.map(r=>{
      const sale=r.sourceSaleId?salesMap.get(r.sourceSaleId):null;
      return {id:'credit:'+r.id,type:'AVOIR',date:r.createdAt,amount:num(r.total),reference:r.reference,
        invoiceReference:sale?.reference||'—',
        customerName:sale?.customerId?customerName.get(sale.customerId)||'Client':'—',
        method:'—',source:'Fournisseur',status:'CONFIRMED',proofUrl:null,
        note:'Remboursé : '+num(r.refund).toFixed(3)+' DT'};
    });
    const journal=[...paymentEvents,...pendingEvents,...remittanceEvents,...creditEvents]
      .sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,1000);
    return ok({role:s.role,metrics:{
      customerDue:num(invoiceRows.reduce((n,r)=>n.plus(r.due),zero)),
      atelierDue:num(clients.filter(c=>c.shopId).reduce((n,r)=>n.plus(r.due),zero)),
      outstandingCourierCash:Number(owed.toFixed(3)),
      pendingCourierCollections:num(waiting.reduce((n,r)=>n.plus(r.amount),zero)),
      openInvoices:invoiceRows.filter(x=>x.due>0.0001).length,
    }, clients, invoices:invoiceRows, settlements:cashReceipts,
       deliveryShifts, journal});
  }catch(e:any){return bad(e.message,e.status||500);}
}
