import {prisma} from '@/lib/prisma';import {requireSession} from '@/lib/auth';import {bad,ok} from '@/lib/http';import {plain} from '@/lib/serializers';import {UserRole} from '@prisma/client';
export async function GET(){try{
 const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION,UserRole.CASHIER]);
 const customers=await prisma.supplierErpCustomer.findMany({where:{shopId:s.shopId,active:true}});
 if(!customers.length)return ok({totalDue:0,suppliers:[]});
 const companyIds=[...new Set(customers.map(x=>x.companyId))];
 const [companies,sales]=await Promise.all([
  prisma.supplierCompany.findMany({where:{id:{in:companyIds}},select:{id:true,name:true,phone:true,address:true,region:true}}),
  prisma.supplierErpSale.findMany({where:{customerId:{in:customers.map(x=>x.id)},status:{not:'CANCELLED'}},orderBy:{createdAt:'desc'}})
 ]);
 const saleIds=sales.map(x=>x.id),orderIds=sales.map(x=>x.sourceOrderId).filter(Boolean) as string[];
 const [items,payments,orders]=await Promise.all([
  saleIds.length?prisma.supplierErpSaleItem.findMany({where:{saleId:{in:saleIds}}}):Promise.resolve([]),
  saleIds.length?prisma.supplierErpPayment.findMany({where:{saleId:{in:saleIds},kind:'IN'},orderBy:{createdAt:'desc'}}):Promise.resolve([]),
  orderIds.length?prisma.supplierOrder.findMany({where:{id:{in:orderIds}},include:{delivery:true}}):Promise.resolve([])
 ]);
 const suppliers=customers.map(c=>{
  const company=companies.find(x=>x.id===c.companyId),rows=sales.filter(x=>x.customerId===c.id).map(x=>{
   const due=Math.max(0,Number(x.total)-Number(x.paid)),order=orders.find(o=>o.id===x.sourceOrderId);
   return {...x,total:Number(x.total),paid:Number(x.paid),due,items:items.filter(i=>i.saleId===x.id).map(i=>({...i,unitPrice:Number(i.unitPrice),quantity:Number(i.quantity)})),payments:payments.filter(p=>p.saleId===x.id).map(p=>({...p,amount:Number(p.amount)})),delivery:order?.delivery?{driverName:order.delivery.driverName,driverPhone:order.delivery.driverPhone,recipientName:order.delivery.recipientName,deliveredAt:order.delivery.deliveredAt}:null};
  });
  return {company,customerId:c.id,due:rows.reduce((a,x)=>a+x.due,0),sales:rows};
 });
 return ok(plain({totalDue:suppliers.reduce((a,x)=>a+x.due,0),suppliers}));
}catch(e:any){return bad(e.message,e.status||500)}}
