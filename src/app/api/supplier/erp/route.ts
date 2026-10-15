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
