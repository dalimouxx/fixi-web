import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(){
 try{
  const s=await requireSupplierSession();
  const [customers,sales,payments,expenses,purchases,cashSessions,movements]=await Promise.all([
   prisma.supplierErpCustomer.findMany({where:{companyId:s.companyId},orderBy:{updatedAt:'desc'},take:500}),
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:500}),
   prisma.supplierErpPayment.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1000}),
   prisma.supplierErpExpense.findMany({where:{companyId:s.companyId},orderBy:{expenseDate:'desc'},take:500}),
   prisma.supplierErpPurchase.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:500}),
   prisma.supplierErpCashSession.findMany({where:{companyId:s.companyId},orderBy:{openedAt:'desc'},take:100}),
   prisma.supplierErpStockMovement.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:500})
  ]);
  return ok(plain({customers,sales,payments,expenses,purchases,cashSessions,movements}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierSession();const b=await req.json();const action=String(b.action||'');
  if(action==='SALE'){
   const items=Array.isArray(b.items)?b.items:[];if(!items.length)return bad('Aucun article');
   const products=await prisma.supplierProduct.findMany({where:{companyId:s.companyId,id:{in:items.map((i:any)=>String(i.productId))}}});
   let subtotal=0;const normalized:any[]=[];
   for(const i of items){const p=products.find(x=>x.id===String(i.productId));const q=Math.max(1,Math.trunc(Number(i.quantity||1)));if(!p)return bad('Produit introuvable',404);if(p.stock<q)return bad('Stock insuffisant pour '+p.name,409);const price=Number(i.unitPrice??p.price);subtotal+=price*q;normalized.push({p,q,price});}
   const discount=Math.max(0,Number(b.discount||0));const tax=Math.max(0,Number(b.tax||0));const total=Math.max(0,subtotal-discount+tax);const paid=Math.max(0,Math.min(total,Number(b.paid??total)));const ref=String(b.reference||('V-'+Date.now()));
   const sale=await prisma.$transaction(async tx=>{const sale=await tx.supplierErpSale.create({data:{companyId:s.companyId,customerId:b.customerId||null,reference:ref,status:paid>=total?'PAID':'PARTIALLY_PAID',subtotal,discount,tax,total,paid,dueAt:b.dueAt?new Date(b.dueAt):null,note:b.note||null,createdById:s.id}});for(const x of normalized){await tx.supplierErpSaleItem.create({data:{saleId:sale.id,productId:x.p.id,sku:x.p.sku,name:x.p.name,quantity:x.q,unitCost:Number(x.p.purchasePrice||0),unitPrice:x.price}});const before=x.p.stock,after=before-x.q;await tx.supplierProduct.update({where:{id:x.p.id},data:{stock:after}});await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:x.p.id,type:'SALE',quantity:-x.q,beforeQty:before,afterQty:after,unitCost:x.p.purchasePrice,reference:ref,accountId:s.id}})}if(paid>0)await tx.supplierErpPayment.create({data:{companyId:s.companyId,customerId:b.customerId||null,saleId:sale.id,kind:'IN',method:String(b.method||'CASH'),amount:paid,reference:ref,accountId:s.id}});return sale});return ok(plain(sale),{status:201});
  }
  if(action==='PURCHASE'){
   const productId=String(b.productId||'');const quantity=Math.max(1,Math.trunc(Number(b.quantity||1)));const unitCost=Number(b.unitCost);if(!productId||!(unitCost>=0))return bad('Achat invalide');const p=await prisma.supplierProduct.findFirst({where:{id:productId,companyId:s.companyId}});if(!p)return bad('Produit introuvable',404);const ref=String(b.reference||('ACH-'+Date.now()));const total=unitCost*quantity;const paid=Math.max(0,Math.min(total,Number(b.paid||0)));const purchase=await prisma.$transaction(async tx=>{const pur=await tx.supplierErpPurchase.create({data:{companyId:s.companyId,vendorName:String(b.vendorName||'Fournisseur'),reference:ref,status:'RECEIVED',total,paid,dueAt:b.dueAt?new Date(b.dueAt):null,note:b.note||null,receivedAt:new Date()}});await tx.supplierErpPurchaseItem.create({data:{purchaseId:pur.id,productId:p.id,sku:p.sku,name:p.name,quantity,unitCost}});const before=p.stock,after=before+quantity;await tx.supplierProduct.update({where:{id:p.id},data:{stock:after,purchasePrice:unitCost}});await tx.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:'PURCHASE',quantity,beforeQty:before,afterQty:after,unitCost,reference:ref,accountId:s.id}});if(paid>0)await tx.supplierErpPayment.create({data:{companyId:s.companyId,kind:'OUT',method:String(b.method||'CASH'),amount:paid,reference:ref,note:'Paiement achat '+p.name,accountId:s.id}});return pur});return ok(plain(purchase),{status:201});
  }
  if(action==='CUSTOMER'){
   if(!b.name)return bad('Nom client requis');
   return ok(plain(await prisma.supplierErpCustomer.create({data:{companyId:s.companyId,name:String(b.name).trim(),phone:b.phone||null,email:b.email||null,address:b.address||null,region:b.region||null,taxId:b.taxId||null,creditLimit:Number(b.creditLimit||0),notes:b.notes||null}})),{status:201});
  }
  if(action==='EXPENSE'){
   const amount=Number(b.amount);if(!b.label||!(amount>0))return bad('Dépense invalide');
   return ok(plain(await prisma.supplierErpExpense.create({data:{companyId:s.companyId,category:String(b.category||'Général'),label:String(b.label),amount,method:String(b.method||'CASH'),note:b.note||null,createdById:s.id}})),{status:201});
  }
  if(action==='PAYMENT'){
   const amount=Number(b.amount);if(!(amount>0))return bad('Paiement invalide');
   return ok(plain(await prisma.supplierErpPayment.create({data:{companyId:s.companyId,customerId:b.customerId||null,saleId:b.saleId||null,kind:String(b.kind||'IN'),method:String(b.method||'CASH'),amount,reference:b.reference||null,note:b.note||null,accountId:s.id}})),{status:201});
  }
  if(action==='CASH_OPEN'){
   const exists=await prisma.supplierErpCashSession.findFirst({where:{companyId:s.companyId,status:'OPEN'}});
   if(exists)return bad('Une caisse est déjà ouverte',409);
   return ok(plain(await prisma.supplierErpCashSession.create({data:{companyId:s.companyId,accountId:s.id,openingAmount:Number(b.openingAmount||0)}})),{status:201});
  }
  if(action==='CASH_CLOSE'){
   const cs=await prisma.supplierErpCashSession.findFirst({where:{companyId:s.companyId,status:'OPEN'},orderBy:{openedAt:'desc'}});if(!cs)return bad('Aucune caisse ouverte',404);
   const closing=Number(b.closingAmount||0);const incoming=await prisma.supplierErpPayment.aggregate({where:{companyId:s.companyId,kind:'IN',createdAt:{gte:cs.openedAt}},_sum:{amount:true}});
   const outgoing=await prisma.supplierErpPayment.aggregate({where:{companyId:s.companyId,kind:'OUT',createdAt:{gte:cs.openedAt}},_sum:{amount:true}});
   const expenses=await prisma.supplierErpExpense.aggregate({where:{companyId:s.companyId,expenseDate:{gte:cs.openedAt}},_sum:{amount:true}});
   const expected=Number(cs.openingAmount)+Number(incoming._sum.amount||0)-Number(outgoing._sum.amount||0)-Number(expenses._sum.amount||0);
   return ok(plain(await prisma.supplierErpCashSession.update({where:{id:cs.id},data:{status:'CLOSED',expectedCash:expected,closingAmount:closing,difference:closing-expected,closedAt:new Date(),note:b.note||null}})));
  }
  if(action==='STOCK_ADJUST'){
   const productId=String(b.productId||'');const delta=Math.trunc(Number(b.delta||0));if(!productId||!delta)return bad('Mouvement invalide');
   const p=await prisma.supplierProduct.findFirst({where:{id:productId,companyId:s.companyId}});if(!p)return bad('Produit introuvable',404);
   const after=p.stock+delta;if(after<0)return bad('Stock insuffisant',409);
   const [product]=await prisma.$transaction([
    prisma.supplierProduct.update({where:{id:p.id},data:{stock:after}}),
    prisma.supplierErpStockMovement.create({data:{companyId:s.companyId,productId:p.id,type:String(b.type||'ADJUSTMENT'),quantity:delta,beforeQty:p.stock,afterQty:after,reference:b.reference||null,note:b.note||null,accountId:s.id}})
   ]);
   return ok(plain(product));
  }
  return bad('Action ERP inconnue');
 }catch(e:any){return bad(e.message,e.status||500)}
}
