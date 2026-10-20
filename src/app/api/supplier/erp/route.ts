import {prisma} from '@/lib/prisma';
import {requireSupplierSession,SupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {notifySupplier,notifySupplierLowStock} from '@/lib/supplier-notifications';
import {notifyShop} from '@/lib/notifications';
import {NotificationType} from '@prisma/client';
import {supplierCashSummary} from '@/lib/supplier-cash-ledger';

const allow=(role:SupplierRole,roles:SupplierRole[])=>roles.includes(role);
const money=(v:any)=>Math.round(Number(v||0)*1000)/1000;

async function openCash(companyId:string,accountId:string){
 return prisma.supplierErpCashSession.findFirst({where:{companyId,accountId,status:'OPEN'},orderBy:{openedAt:'desc'}});
}
async function cashLike(companyId:string,method:string){
 if(method==='CASH')return true;
 const x=await prisma.supplierPaymentMethod.findFirst({where:{companyId,code:method,active:true}});
 return !!x?.cashLike;
}
async function audit(companyId:string,accountId:string,action:string,entity:string,entityId?:string,metadata?:any){
 await prisma.supplierAuditEvent.create({data:{companyId,accountId,action,entity,entityId:entityId||null,metadata:metadata||undefined}}).catch(()=>{});
}

export async function GET(){
 try{
  const s=await requireSupplierSession();
  const [customers,sales,payments,expenses,purchases,cashSessions,movements,returns]=await Promise.all([
   prisma.supplierErpCustomer.findMany({where:{companyId:s.companyId},orderBy:{updatedAt:'desc'},take:1000}),
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1000}),
   prisma.supplierErpPayment.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:2000}),
   prisma.supplierErpExpense.findMany({where:{companyId:s.companyId},orderBy:{expenseDate:'desc'},take:1000}),
   prisma.supplierErpPurchase.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1000}),
   prisma.supplierErpCashSession.findMany({where:{companyId:s.companyId},orderBy:{openedAt:'desc'},take:250}),
   prisma.supplierErpStockMovement.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1500}),
   prisma.supplierReturn.findMany({where:{companyId:s.companyId,type:'SALE_RETURN',status:'COMPLETED'},orderBy:{createdAt:'desc'},take:1000})
  ]);
  const [saleItems,purchaseItems,returnItems]=await Promise.all([
   sales.length?prisma.supplierErpSaleItem.findMany({where:{saleId:{in:sales.map(x=>x.id)}}}):Promise.resolve([]),
   purchases.length?prisma.supplierErpPurchaseItem.findMany({where:{purchaseId:{in:purchases.map(x=>x.id)}}}):Promise.resolve([]),
   returns.length?prisma.supplierReturnItem.findMany({where:{returnId:{in:returns.map(x=>x.id)}}}):Promise.resolve([])
  ]);
  const grossSales=sales.filter(x=>x.status!=='CANCELLED').reduce((a,x)=>a+Number(x.total),0);
  const returnsTotal=returns.reduce((a,x)=>a+Number(x.total),0);
  const refundsTotal=returns.reduce((a,x)=>a+Number(x.refund),0);
  const returnedCost=returnItems.filter(x=>x.restock).reduce((a,x)=>a+Number(x.unitCost)*x.quantity,0);
  const grossCogs=saleItems.reduce((a,x)=>a+Number(x.unitCost)*x.quantity,0);
  const salesTotal=Math.max(0,grossSales-returnsTotal),cogs=Math.max(0,grossCogs-returnedCost);
  const expensesTotal=expenses.reduce((a,x)=>a+Number(x.amount),0);
  const purchaseTotal=purchases.filter(x=>x.status!=='CANCELLED').reduce((a,x)=>a+Number(x.total),0);
  const retBySale=new Map<string,{total:number;refund:number}>();for(const r of returns){if(!r.sourceSaleId)continue;const x=retBySale.get(r.sourceSaleId)||{total:0,refund:0};x.total+=Number(r.total);x.refund+=Number(r.refund);retBySale.set(r.sourceSaleId,x)}
  const receivables=sales.reduce((a,x)=>{const r=retBySale.get(x.id)||{total:0,refund:0};const netTotal=Math.max(0,Number(x.total)-r.total),netPaid=Math.max(0,Number(x.paid)-r.refund);return a+Math.max(0,netTotal-netPaid)},0);
  const payables=purchases.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);
  const collected=payments.filter(x=>x.kind==='IN').reduce((a,x)=>a+Number(x.amount),0);
  const paidOut=payments.filter(x=>x.kind==='OUT').reduce((a,x)=>a+Number(x.amount),0);
  const metrics={grossSales,returnsTotal,refundsTotal,salesTotal,cogs,grossProfit:salesTotal-cogs,expenses:expensesTotal,netProfit:salesTotal-cogs-expensesTotal,purchaseTotal,receivables,payables,collected,paidOut};
  if(['OWNER','ADMIN','MANAGER','ACCOUNTANT'].includes(s.role))return ok(plain({customers,sales,saleItems,payments,expenses,purchases,purchaseItems,returns,returnItems,cashSessions,movements,metrics}));
  if(s.role==='SALES')return ok(plain({customers,sales,saleItems,payments,returns,returnItems,expenses:[],purchases:[],purchaseItems:[],cashSessions:cashSessions.filter(x=>x.accountId===s.id),movements:[],metrics:{salesTotal:metrics.salesTotal,grossProfit:metrics.grossProfit,receivables:metrics.receivables,collected:metrics.collected,returnsTotal:metrics.returnsTotal}}));
  if(s.role==='CASHIER'){
   const ownSales=sales.filter(x=>x.createdById===s.id),ownIds=new Set(ownSales.map(x=>x.id));
   return ok(plain({customers,sales:ownSales,saleItems:saleItems.filter(x=>ownIds.has(x.saleId)),payments:payments.filter(x=>x.accountId===s.id),expenses:expenses.filter(x=>x.createdById===s.id),purchases:[],purchaseItems:[],cashSessions:cashSessions.filter(x=>x.accountId===s.id),movements:[],metrics:{salesTotal:ownSales.reduce((a,x)=>a+Number(x.total),0),collected:payments.filter(x=>x.accountId===s.id&&x.kind==='IN').reduce((a,x)=>a+Number(x.amount),0)}}));
  }
  if(s.role==='STOCK')return ok(plain({customers:[],sales:[],saleItems:[],payments:[],expenses:[],purchases,purchaseItems,cashSessions:[],movements,metrics:{purchaseTotal:metrics.purchaseTotal,payables:metrics.payables}}));
  return ok(plain({customers:[],sales:[],saleItems:[],payments:[],expenses:[],purchases:[],purchaseItems:[],cashSessions:[],movements:[],metrics:{}}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierSession();const b=await req.json();const action=String(b.action||'');

  if(action==='SALE'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','SALES','CASHIER']))return bad('FORBIDDEN',403);
   const items=Array.isArray(b.items)?b.items:[];if(!items.length)return bad('Aucun article');
   const ids:string[]=[...new Set<string>(items.map((i:any)=>String(i.productId||'')).filter((x:string)=>Boolean(x)))];
   const warehouseId=String(b.warehouseId||'')||null;
   if(warehouseId){const w=await prisma.supplierWarehouse.findFirst({where:{id:warehouseId,companyId:s.companyId,active:true}});if(!w)return bad('Dépôt invalide',404)}
   const [products,warehouseRows]=await Promise.all([
    prisma.supplierProduct.findMany({where:{companyId:s.companyId,id:{in:ids},active:true}}),
    prisma.supplierWarehouseStock.findMany({where:{companyId:s.companyId,productId:{in:ids}},orderBy:{updatedAt:'asc'}})
   ]);
   let subtotal=0;const normalized:any[]=[];
   for(const i of items){
    const p=products.find(x=>x.id===String(i.productId));const q=Math.max(1,Math.trunc(Number(i.quantity||1)));
    if(!p)return bad('Produit introuvable',404);
    const productWarehouseRows=warehouseRows.filter(x=>x.productId===p.id);
    const warehouseRow=warehouseId?productWarehouseRows.find(x=>x.warehouseId===warehouseId):null;
    const available=warehouseId?Number(warehouseRow?.quantity||0)-Number(warehouseRow?.reserved||0):p.stock-p.reservedStock;
    if(available<q)return bad('Stock disponible insuffisant pour '+p.name+(warehouseId?' dans ce dépôt':''),409);
    const allocatedTotal=productWarehouseRows.reduce((a,x)=>a+Number(x.quantity||0),0),unallocated=Math.max(0,p.stock-allocatedTotal);
    const warehouseConsumption=warehouseId?0:Math.max(0,q-unallocated);
    if(!warehouseId&&productWarehouseRows.reduce((a,x)=>a+Math.max(0,Number(x.quantity||0)-Number(x.reserved||0)),0)<warehouseConsumption)return bad('Répartition dépôt incohérente pour '+p.name,409);
    const defaultPrice=Number(p.retailPrice??p.price);const price=money(i.unitPrice??defaultPrice);
    const minimum=p.minimumPrice===null?null:Number(p.minimumPrice);
    if(minimum!==null&&price<minimum&&!allow(s.role,['OWNER','ADMIN','MANAGER']))return bad('Prix inférieur au minimum autorisé pour '+p.name,409);
    subtotal+=price*q;normalized.push({p,q,price,warehouseRow,productWarehouseRows,warehouseConsumption});
   }
   const discount=Math.max(0,money(b.discount||0)),tax=Math.max(0,money(b.tax||0)),total=Math.max(0,money(subtotal-discount+tax));
   const rawPayments=Array.isArray(b.payments)&&b.payments.length?b.payments:(Number(b.paid||0)>0?[{method:String(b.method||'CASH'),amount:Number(b.paid)}]:[]);
   const payments=rawPayments.map((x:any)=>({method:String(x.method||'CASH').toUpperCase(),amount:Math.max(0,money(x.amount||0)),reference:x.reference||null})).filter((x:any)=>x.amount>0);
   const paid=money(payments.reduce((a:number,x:any)=>a+x.amount,0));
   if(paid>total+0.001)return bad('Les paiements dépassent le total de la vente',409);
   if(paid<total&& !b.customerId)return bad('Sélectionnez un client pour une vente à crédit',409);
   if(b.customerId){const customer=await prisma.supplierErpCustomer.findFirst({where:{id:String(b.customerId),companyId:s.companyId,active:true}});if(!customer)return bad('Client invalide',404);const existing=await prisma.supplierErpSale.aggregate({where:{companyId:s.companyId,customerId:customer.id,status:{not:'CANCELLED'}},_sum:{total:true,paid:true}});const due=Number(existing._sum.total||0)-Number(existing._sum.paid||0)+(total-paid);if(Number(customer.creditLimit)>0&&due>Number(customer.creditLimit))return bad('Plafond crédit client dépassé',409)}
   let cashSession:any=null;
   for(const p of payments)if(await cashLike(s.companyId,p.method)){cashSession=await openCash(s.companyId,s.id);if(!cashSession)return bad('Ouvrez votre caisse avant un encaissement espèces',409);break}
   const ref=String(b.reference||('V-'+Date.now()));
   const sale=await prisma.$transaction(async tx=>{
    const sale=await tx.supplierErpSale.create({data:{companyId:s.companyId,customerId:b.customerId||null,warehouseId,cashSessionId:cashSession?.id||null,reference:ref,status:paid>=total?'PAID':paid>0?'PARTIALLY_PAID':'CREDIT',subtotal:money(subtotal),discount,tax,total,paid,dueAt:b.dueAt?new Date(b.dueAt):null,note:b.note||null,createdById:s.id}});
    for(const x of normalized){
     await tx.supplierErpSaleItem.create({data:{saleId:sale.id,productId:x.p.id,sku:x.p.sku,name:x.p.name,quantity:x.q,unitCost:Number(x.p.averageCost||x.p.purchasePrice||0),unitPrice:x.price}});
     const before=x.p.stock,after=before-x.q;
     await tx.supplierProduct.update({where:{id:x.p.id},data:{stock:after}});
     if(warehouseId&&x.warehouseRow)await tx.supplierWarehouseStock.update({where:{id:x.warehouseRow.id},data:{quantity:{decrement:x.q}}});
     if(!warehouseId&&x.warehouseConsumption>0){let remaining=x.warehouseConsumption;for(const row of x.productWarehouseRows){if(remaining<=0)break;const take=Math.min(remaining,Math.max(0,Number(row.quantity||0)-Number(row.reserved||0)));if(take>0){await tx.supplierWarehouseStock.update({where:{id:row.id},data:{quantity:{decrement:take}}});remaining-=take}}}
     await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:x.p.id,type:'SALE',quantity:-x.q,beforeQty:before,afterQty:after,unitCost:x.p.averageCost||x.p.purchasePrice,reference:ref,accountId:s.id}});
    }
    for(const p of payments)await tx.supplierErpPayment.create({data:{companyId:s.companyId,customerId:b.customerId||null,saleId:sale.id,cashSessionId:(await cashLike(s.companyId,p.method))?cashSession?.id:null,kind:'IN',method:p.method,amount:p.amount,reference:p.reference||ref,accountId:s.id}});
    return sale;
   });
   await audit(s.companyId,s.id,'CREATE','SALE',sale.id,{reference:ref,total,paid,itemCount:normalized.length});
   await Promise.allSettled(normalized.map((x:any)=>notifySupplierLowStock(s.companyId,x.p.id)));
   if(paid<total)await notifySupplier(s.companyId,'Vente avec reste à payer',`${ref} · reste ${money(total-paid).toFixed(3)} DT`,{href:'/supplier?tab=dues',kind:'PAYMENT',priority:'NORMAL',roles:['OWNER','ADMIN','MANAGER','ACCOUNTANT'],metadata:{saleId:sale.id,reference:ref,total,paid,due:money(total-paid)}});
   return ok(plain(sale),{status:201});
  }

  if(action==='PURCHASE'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','STOCK']))return bad('FORBIDDEN',403);
   const items=Array.isArray(b.items)&&b.items.length?b.items:[{productId:b.productId,quantity:b.quantity,unitCost:b.unitCost}];
   const ids:string[]=[...new Set<string>(items.map((i:any)=>String(i.productId||'')).filter((x:string)=>Boolean(x)))];if(!ids.length)return bad('Aucun article');
   const warehouseId=String(b.warehouseId||'')||null;
   if(warehouseId){const w=await prisma.supplierWarehouse.findFirst({where:{id:warehouseId,companyId:s.companyId,active:true}});if(!w)return bad('Dépôt invalide',404)}
   const products=await prisma.supplierProduct.findMany({where:{companyId:s.companyId,id:{in:ids}}});
   let total=0;const normalized:any[]=[];
   for(const i of items){const p=products.find(x=>x.id===String(i.productId));const q=Math.max(1,Math.trunc(Number(i.quantity||1))),unitCost=money(i.unitCost);if(!p||!(unitCost>=0))return bad('Achat invalide');total+=unitCost*q;normalized.push({p,q,unitCost})}
   total=money(total);const paid=Math.max(0,Math.min(total,money(b.paid||0)));const ref=String(b.reference||('ACH-'+Date.now()));let cashSession:any=null;
   if(paid>0&&await cashLike(s.companyId,String(b.method||'CASH').toUpperCase()))cashSession=await openCash(s.companyId,s.id);
   const purchase=await prisma.$transaction(async tx=>{
    const pur=await tx.supplierErpPurchase.create({data:{companyId:s.companyId,warehouseId,vendorName:String(b.vendorName||'Fournisseur'),reference:ref,status:'RECEIVED',total,paid,dueAt:b.dueAt?new Date(b.dueAt):null,note:b.note||null,receivedAt:new Date()}});
    for(const x of normalized){
     await tx.supplierErpPurchaseItem.create({data:{purchaseId:pur.id,productId:x.p.id,sku:x.p.sku,name:x.p.name,quantity:x.q,unitCost:x.unitCost}});
     const before=x.p.stock,after=before+x.q;const oldValue=Number(x.p.averageCost||x.p.purchasePrice||0)*Math.max(0,before);const newAverage=after>0?money((oldValue+x.unitCost*x.q)/after):x.unitCost;
     await tx.supplierProduct.update({where:{id:x.p.id},data:{stock:after,purchasePrice:x.unitCost,averageCost:newAverage}});
     if(warehouseId)await tx.supplierWarehouseStock.upsert({where:{warehouseId_productId:{warehouseId,productId:x.p.id}},update:{quantity:{increment:x.q}},create:{companyId:s.companyId,warehouseId,productId:x.p.id,quantity:x.q}});
     await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:x.p.id,type:'PURCHASE',quantity:x.q,beforeQty:before,afterQty:after,unitCost:x.unitCost,reference:ref,accountId:s.id}});
    }
    if(paid>0)await tx.supplierErpPayment.create({data:{companyId:s.companyId,cashSessionId:cashSession?.id||null,kind:'OUT',method:String(b.method||'CASH').toUpperCase(),amount:paid,reference:ref,note:'Paiement achat',accountId:s.id}});
    return pur;
   });
   await audit(s.companyId,s.id,'CREATE','PURCHASE',purchase.id,{reference:ref,total,paid,itemCount:normalized.length});
   await Promise.allSettled(normalized.map((x:any)=>notifySupplierLowStock(s.companyId,x.p.id)));
   return ok(plain(purchase),{status:201});
  }

  if(action==='CUSTOMER'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','SALES','CASHIER','ACCOUNTANT']))return bad('FORBIDDEN',403);
   if(!b.name)return bad('Nom client requis');
   const x=await prisma.supplierErpCustomer.create({data:{companyId:s.companyId,name:String(b.name).trim(),phone:b.phone||null,email:b.email||null,address:b.address||null,region:b.region||null,taxId:b.taxId||null,creditLimit:Number(b.creditLimit||0),notes:b.notes||null}});
   await audit(s.companyId,s.id,'CREATE','CUSTOMER',x.id,{name:x.name});return ok(plain(x),{status:201});
  }

  if(action==='EXPENSE'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','CASHIER','ACCOUNTANT']))return bad('FORBIDDEN',403);
   const amount=money(b.amount),method=String(b.method||'CASH').toUpperCase();if(!b.label||!(amount>0))return bad('Dépense invalide');
   const cs=await cashLike(s.companyId,method)?await openCash(s.companyId,s.id):null;if(await cashLike(s.companyId,method)&&!cs)return bad('Ouvrez votre caisse pour enregistrer une dépense espèces',409);
   const x=await prisma.supplierErpExpense.create({data:{companyId:s.companyId,cashSessionId:cs?.id||null,category:String(b.category||'Général'),label:String(b.label),amount,method,note:b.note||null,createdById:s.id}});
   await audit(s.companyId,s.id,'CREATE','EXPENSE',x.id,{amount,method});return ok(plain(x),{status:201});
  }

  if(action==='PAYMENT'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','SALES','CASHIER','ACCOUNTANT']))return bad('FORBIDDEN',403);
   const amount=money(b.amount),method=String(b.method||'CASH').toUpperCase();if(!(amount>0))return bad('Paiement invalide');
   const cs=await cashLike(s.companyId,method)?await openCash(s.companyId,s.id):null;if(await cashLike(s.companyId,method)&&!cs)return bad('Ouvrez votre caisse avant un paiement espèces',409);
   if(b.saleId){
    const sale=await prisma.supplierErpSale.findFirst({where:{id:String(b.saleId),companyId:s.companyId}});if(!sale)return bad('Vente introuvable',404);
    const credits=await prisma.supplierReturn.findMany({where:{companyId:s.companyId,sourceSaleId:sale.id,type:'SALE_RETURN',status:'COMPLETED'},select:{total:true,refund:true}});
    const creditTotal=credits.reduce((a,x)=>a+Number(x.total),0),refunded=credits.reduce((a,x)=>a+Number(x.refund),0);
    const netTotal=Math.max(0,money(Number(sale.total)-creditTotal)),netPaid=Math.max(0,money(Number(sale.paid)-refunded));
    const beforeRemaining=Math.max(0,money(netTotal-netPaid));if(amount>beforeRemaining+0.001)return bad('Paiement supérieur au reste à payer',409);
    const result=await prisma.$transaction(async tx=>{const p=await tx.supplierErpPayment.create({data:{companyId:s.companyId,customerId:sale.customerId,saleId:sale.id,cashSessionId:cs?.id||null,kind:'IN',method,amount,reference:b.reference||sale.reference,note:b.note||null,accountId:s.id}});const paid=money(Number(sale.paid)+amount),newNetPaid=Math.max(0,money(paid-refunded));await tx.supplierErpSale.update({where:{id:sale.id},data:{paid,status:newNetPaid>=netTotal?'PAID':'PARTIALLY_PAID'}});return p});
    const newPaid=money(Number(sale.paid)+amount),newNetPaid=Math.max(0,money(newPaid-refunded)),remaining=Math.max(0,money(netTotal-newNetPaid));
    await notifySupplier(s.companyId,remaining<=0?'Créance soldée':'Paiement client reçu',`${sale.reference} · ${amount.toFixed(3)} DT${remaining>0?' · reste '+remaining.toFixed(3)+' DT':''}`,{href:'/supplier?tab=dues',kind:'PAYMENT',soundKey:'SUCCESS',roles:['OWNER','ADMIN','MANAGER','ACCOUNTANT'],metadata:{saleId:sale.id,reference:sale.reference,amount,remaining}});
    return ok(plain(result),{status:201});
   }
   return ok(plain(await prisma.supplierErpPayment.create({data:{companyId:s.companyId,customerId:b.customerId||null,cashSessionId:cs?.id||null,kind:String(b.kind||'IN'),method,amount,reference:b.reference||null,note:b.note||null,accountId:s.id}})),{status:201});
  }

  if(action==='CUSTOMER_PAYMENT'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','SALES','CASHIER','ACCOUNTANT']))return bad('FORBIDDEN',403);
   const customerId=String(b.customerId||''),amount=money(b.amount),method=String(b.method||'CASH').toUpperCase();
   if(!customerId||!(amount>0))return bad('Encaissement client invalide');
   const customer=await prisma.supplierErpCustomer.findFirst({where:{id:customerId,companyId:s.companyId,active:true}});if(!customer)return bad('Client introuvable',404);
   const sales=await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId,status:{in:['CREDIT','PARTIALLY_PAID']}},orderBy:{createdAt:'asc'}});
   const totalDue=money(sales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0));
   if(amount>totalDue+0.001)return bad('Montant supérieur au dû client',409);
   const cs=await cashLike(s.companyId,method)?await openCash(s.companyId,s.id):null;if(await cashLike(s.companyId,method)&&!cs)return bad('Ouvrez votre caisse avant un encaissement espèces',409);
   const allocations:any[]=[];
   await prisma.$transaction(async tx=>{
    let remaining=amount;
    for(const sale of sales){
     if(remaining<=0.0001)break;
     const due=Math.max(0,money(Number(sale.total)-Number(sale.paid)));if(due<=0)continue;
     const take=Math.min(remaining,due),paid=money(Number(sale.paid)+take);
     const p=await tx.supplierErpPayment.create({data:{companyId:s.companyId,customerId,saleId:sale.id,cashSessionId:cs?.id||null,kind:'IN',method,amount:take,reference:b.reference||sale.reference,note:b.note||'Encaissement client réparti automatiquement',accountId:s.id}});
     await tx.supplierErpSale.update({where:{id:sale.id},data:{paid,status:paid+0.001>=Number(sale.total)?'PAID':'PARTIALLY_PAID'}});
     allocations.push({saleId:sale.id,reference:sale.reference,paymentId:p.id,amount:take});
     remaining=money(remaining-take);
    }
   });
   const rest=Math.max(0,money(totalDue-amount));
   await audit(s.companyId,s.id,'CUSTOMER_PAYMENT','CUSTOMER',customer.id,{amount,method,remaining:rest,allocations});
   await notifySupplier(s.companyId,rest<=0?'Compte client soldé':'Encaissement client',customer.name+' · '+amount.toFixed(3)+' DT'+(rest>0?' · reste '+rest.toFixed(3)+' DT':' · soldé'),{href:'/supplier?tab=dues',kind:'PAYMENT',soundKey:'SUCCESS',roles:['OWNER','ADMIN','MANAGER','ACCOUNTANT'],metadata:{customerId:customer.id,amount,remaining:rest,allocations}});
   if(customer.shopId)await notifyShop(customer.shopId,'Paiement fournisseur enregistré',amount.toFixed(3)+' DT enregistré chez '+(s.companyName||'votre fournisseur')+'. Reste : '+rest.toFixed(3)+' DT.','/app/suppliers',NotificationType.PAYMENT).catch(()=>{});
   return ok({ok:true,amount,remaining:rest,allocations},{status:201});
  }

  if(action==='PURCHASE_PAYMENT'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','ACCOUNTANT']))return bad('FORBIDDEN',403);
   const purchaseId=String(b.purchaseId||''),amount=money(b.amount),method=String(b.method||'CASH').toUpperCase();
   if(!purchaseId||!(amount>0))return bad('Règlement fournisseur invalide');
   const purchase=await prisma.supplierErpPurchase.findFirst({where:{id:purchaseId,companyId:s.companyId,status:{not:'CANCELLED'}}});if(!purchase)return bad('Achat introuvable',404);
   const remaining=Math.max(0,money(Number(purchase.total)-Number(purchase.paid)));if(amount>remaining+0.001)return bad('Paiement supérieur au reste fournisseur',409);
   const cs=await cashLike(s.companyId,method)?await openCash(s.companyId,s.id):null;if(await cashLike(s.companyId,method)&&!cs)return bad('Ouvrez votre caisse avant un paiement espèces',409);
   const result=await prisma.$transaction(async tx=>{
    const p=await tx.supplierErpPayment.create({data:{companyId:s.companyId,cashSessionId:cs?.id||null,kind:'OUT',method,amount,reference:b.reference||purchase.reference,note:b.note||('Règlement '+purchase.vendorName),accountId:s.id}});
    const paid=money(Number(purchase.paid)+amount);await tx.supplierErpPurchase.update({where:{id:purchase.id},data:{paid,status:paid>=Number(purchase.total)?'PAID':'PARTIALLY_PAID'}});return p;
   });
   const rest=Math.max(0,money(remaining-amount));
   await notifySupplier(s.companyId,rest<=0?'Dette fournisseur soldée':'Paiement fournisseur enregistré',`${purchase.reference} · ${amount.toFixed(3)} DT${rest>0?' · reste '+rest.toFixed(3)+' DT':''}`,{href:'/supplier?tab=dues',kind:'PAYMENT',soundKey:'SUCCESS',roles:['OWNER','ADMIN','MANAGER','ACCOUNTANT'],metadata:{purchaseId:purchase.id,reference:purchase.reference,amount,remaining:rest}});
   return ok(plain(result),{status:201});
  }

  if(action==='CASH_OPEN'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','CASHIER','SALES']))return bad('FORBIDDEN',403);
   const exists=await openCash(s.companyId,s.id);if(exists)return bad('Votre caisse est déjà ouverte',409);
   const openingAmount=Number(b.openingAmount??0);
   if(!Number.isFinite(openingAmount)||openingAmount<0||openingAmount>100000000)return bad('Fond de caisse invalide',400);
   const warehouseId=String(b.warehouseId||'')||null;
   if(warehouseId){const w=await prisma.supplierWarehouse.findFirst({where:{id:warehouseId,companyId:s.companyId,active:true}});if(!w)return bad('Dépôt invalide',404)}
   const x=await prisma.supplierErpCashSession.create({data:{companyId:s.companyId,accountId:s.id,warehouseId,openingAmount:money(openingAmount),note:String(b.note||'').slice(0,500)||null}});
   await audit(s.companyId,s.id,'OPEN','CASH_SESSION',x.id,{openingAmount:money(openingAmount)});
   return ok(plain(x),{status:201});
  }

  if(action==='CASH_CLOSE'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','CASHIER','SALES']))return bad('FORBIDDEN',403);
   const cs=await openCash(s.companyId,s.id);if(!cs)return bad('Aucune caisse ouverte',404);
   const rawClosing=Number(b.closingAmount);
   if(!Number.isFinite(rawClosing)||rawClosing<0||rawClosing>100000000)return bad('Montant compté invalide',400);
   const closing=money(rawClosing);
   const [payments,expenses]=await Promise.all([
    prisma.supplierErpPayment.findMany({where:{companyId:s.companyId,cashSessionId:cs.id},select:{kind:true,method:true,amount:true}}),
    prisma.supplierErpExpense.findMany({where:{companyId:s.companyId,cashSessionId:cs.id},select:{method:true,amount:true}})
   ]);
   const summary=supplierCashSummary(cs.openingAmount,payments,expenses);
   const expected=summary.expected,difference=money(closing-expected);
   const note=String(b.note||'').trim().slice(0,500);
   if(Math.abs(difference)>=0.001&&!note)return bad('Expliquez l’écart avant de clôturer la caisse.',400);
   const x=await prisma.supplierErpCashSession.update({
     where:{id:cs.id},data:{status:'CLOSED',expectedCash:expected,closingAmount:closing,
     difference,closedAt:new Date(),note:note||null}
   });
   await audit(s.companyId,s.id,'CLOSE','CASH_SESSION',x.id,{...summary,closing,difference});
   if(Math.abs(closing-expected)>=0.001)await notifySupplier(s.companyId,'Écart de caisse',`Session clôturée avec un écart de ${money(closing-expected).toFixed(3)} DT.`,{href:'/supplier?tab=finance',kind:'WARNING',priority:'HIGH',soundKey:'WARNING',roles:['OWNER','ADMIN','MANAGER','ACCOUNTANT'],metadata:{cashSessionId:x.id,expected,closing,difference:money(closing-expected)}});
   return ok(plain(x));
  }

  if(action==='STOCK_ADJUST'){
   if(!allow(s.role,['OWNER','ADMIN','MANAGER','STOCK']))return bad('FORBIDDEN',403);
   const productId=String(b.productId||''),delta=Math.trunc(Number(b.delta||0));if(!productId||!delta)return bad('Mouvement invalide');
   const p=await prisma.supplierProduct.findFirst({where:{id:productId,companyId:s.companyId}});if(!p)return bad('Produit introuvable',404);
   const [company,allocated]=await Promise.all([prisma.supplierCompany.findUnique({where:{id:s.companyId},select:{allowNegativeStock:true}}),prisma.supplierWarehouseStock.aggregate({where:{companyId:s.companyId,productId:p.id},_sum:{quantity:true}})]);const after=p.stock+delta;if(after<0&&!company?.allowNegativeStock)return bad('Stock insuffisant',409);if(delta<0&&after<Number(allocated._sum.quantity||0))return bad('Ce retrait ferait passer le stock global sous le stock déjà réparti en dépôts. Ajustez le dépôt concerné.',409);
   const [product]=await prisma.$transaction([
    prisma.supplierProduct.update({where:{id:p.id},data:{stock:after}}),
    prisma.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:String(b.type||'ADJUSTMENT'),quantity:delta,beforeQty:p.stock,afterQty:after,reference:b.reference||null,note:b.note||null,accountId:s.id}})
   ]);
   await audit(s.companyId,s.id,'ADJUST','PRODUCT',p.id,{delta,before:p.stock,after,note:b.note||null});await notifySupplierLowStock(s.companyId,p.id);return ok(plain(product));
  }
  return bad('Action ERP inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
