import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','ACCOUNTANT','STOCK','SALES']);
  const u=new URL(req.url);const days=Math.max(1,Math.min(366,Number(u.searchParams.get('days')||30)));const from=new Date(Date.now()-days*86400000);
  const [products,sales,saleItems,purchases,purchaseItems,payments,expenses,movements,customers]=await Promise.all([
   prisma.supplierProduct.findMany({where:{companyId:s.companyId}}),
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId,createdAt:{gte:from},status:{not:'CANCELLED'}},orderBy:{createdAt:'desc'}}),
   prisma.supplierErpSaleItem.findMany({where:{saleId:{in:(await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,createdAt:{gte:from},status:{not:'CANCELLED'}},select:{id:true}})).map(x=>x.id)}}}),
   prisma.supplierErpPurchase.findMany({where:{companyId:s.companyId,createdAt:{gte:from},status:{not:'CANCELLED'}}}),
   prisma.supplierErpPurchaseItem.findMany({where:{purchaseId:{in:(await prisma.supplierErpPurchase.findMany({where:{companyId:s.companyId,createdAt:{gte:from},status:{not:'CANCELLED'}},select:{id:true}})).map(x=>x.id)}}}),
   prisma.supplierErpPayment.findMany({where:{companyId:s.companyId,createdAt:{gte:from}}}),
   prisma.supplierErpExpense.findMany({where:{companyId:s.companyId,expenseDate:{gte:from}}}),
   prisma.supplierErpStockMovement.findMany({where:{companyId:s.companyId,createdAt:{gte:from}},orderBy:{createdAt:'desc'},take:3000}),
   prisma.supplierErpCustomer.findMany({where:{companyId:s.companyId}})
  ]);
  const productMap=new Map(products.map(p=>[p.id,p]));
  const salesMap=new Map(sales.map(x=>[x.id,x]));
  const revenue=sales.reduce((a,x)=>a+Number(x.total),0),cogs=saleItems.reduce((a,x)=>a+Number(x.unitCost)*x.quantity,0),expenseTotal=expenses.reduce((a,x)=>a+Number(x.amount),0);
  const collected=payments.filter(x=>x.kind==='IN').reduce((a,x)=>a+Number(x.amount),0),out=payments.filter(x=>x.kind==='OUT').reduce((a,x)=>a+Number(x.amount),0);
  const receivables=sales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);
  const purchaseTotal=purchases.reduce((a,x)=>a+Number(x.total),0),payables=purchases.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);
  const stockCost=products.reduce((a,p)=>a+Number(p.stock)*Number(p.averageCost||p.purchasePrice||0),0),stockRetail=products.reduce((a,p)=>a+Number(p.stock)*Number(p.retailPrice??p.price),0);
  const byProduct=new Map<string,any>(),byCategory=new Map<string,any>(),byBrand=new Map<string,any>(),byCustomer=new Map<string,any>();
  for(const i of saleItems){const p=i.productId?productMap.get(i.productId):null;const val=Number(i.unitPrice)*i.quantity;const cost=Number(i.unitCost)*i.quantity;const key=i.productId||i.sku||i.name;const x=byProduct.get(key)||{id:key,name:i.name,sku:i.sku,quantity:0,revenue:0,cost:0,profit:0};x.quantity+=i.quantity;x.revenue+=val;x.cost+=cost;x.profit+=val-cost;byProduct.set(key,x);const cat=p?.category||'Sans catégorie';const cx=byCategory.get(cat)||{name:cat,quantity:0,revenue:0,profit:0};cx.quantity+=i.quantity;cx.revenue+=val;cx.profit+=val-cost;byCategory.set(cat,cx);const brand=p?.brand||'Sans marque';const bx=byBrand.get(brand)||{name:brand,quantity:0,revenue:0,profit:0};bx.quantity+=i.quantity;bx.revenue+=val;bx.profit+=val-cost;byBrand.set(brand,bx)}
  for(const sale of sales){const key=sale.customerId||'WALK_IN';const customer=customers.find(c=>c.id===sale.customerId);const x=byCustomer.get(key)||{id:key,name:customer?.name||'Marketplace / comptoir',revenue:0,paid:0,due:0,sales:0};x.revenue+=Number(sale.total);x.paid+=Number(sale.paid);x.due+=Math.max(0,Number(sale.total)-Number(sale.paid));x.sales++;byCustomer.set(key,x)}
  const saleProductIds=new Set(saleItems.map(x=>x.productId).filter(Boolean));
  const deadStock=products.filter(p=>p.stock>0&&!saleProductIds.has(p.id)).map(p=>({id:p.id,sku:p.sku,name:p.name,stock:p.stock,value:Number(p.stock)*Number(p.averageCost||p.purchasePrice||0),updatedAt:p.updatedAt})).sort((a,b)=>b.value-a.value).slice(0,100);
  const lowStock=products.filter(p=>p.active&&Number(p.stock)-Number(p.reservedStock||0)<=Number(p.minStock||0)).map(p=>({id:p.id,sku:p.sku,name:p.name,available:Number(p.stock)-Number(p.reservedStock||0),minStock:p.minStock}));
  const paymentMethods=[...payments.reduce((m,p)=>{const x=m.get(p.method)||{method:p.method,in:0,out:0,count:0};x[p.kind==='IN'?'in':'out']+=Number(p.amount);x.count++;m.set(p.method,x);return m},new Map<string,any>()).values()];
  const aging={current:0,d1_7:0,d8_30:0,over30:0};for(const sale of sales){const due=Math.max(0,Number(sale.total)-Number(sale.paid));if(!due)continue;const age=(Date.now()-new Date(sale.createdAt).getTime())/86400000;if(age<=1)aging.current+=due;else if(age<=7)aging.d1_7+=due;else if(age<=30)aging.d8_30+=due;else aging.over30+=due}
  return ok(plain({period:{days,from,to:new Date()},metrics:{revenue,cogs,grossProfit:revenue-cogs,expenses:expenseTotal,netProfit:revenue-cogs-expenseTotal,collected,out,cashFlow:collected-out-expenseTotal,purchaseTotal,receivables,payables,stockCost,stockRetail,stockPotentialMargin:stockRetail-stockCost,salesCount:sales.length,purchaseCount:purchases.length},topProducts:[...byProduct.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,20),salesByCategory:[...byCategory.values()].sort((a,b)=>b.revenue-a.revenue),salesByBrand:[...byBrand.values()].sort((a,b)=>b.revenue-a.revenue),topCustomers:[...byCustomer.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,20),deadStock,lowStock,paymentMethods,aging,movements:movements.slice(0,100)}));
 }catch(e:any){return bad(e.message,e.status||500)}
}
