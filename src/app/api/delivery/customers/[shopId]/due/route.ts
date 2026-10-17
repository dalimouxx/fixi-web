import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {notifySupplier} from '@/lib/supplier-notifications';
import {notifyShop} from '@/lib/notifications';
import {NotificationType} from '@prisma/client';

async function canAccess(companyId:string,driverId:string,shopId:string){
 const x=await prisma.supplierOrder.findFirst({where:{companyId,shopId,status:'OUT_FOR_DELIVERY',delivery:{is:{driverAccountId:driverId}}},select:{id:true}});
 return !!x;
}

export async function GET(_:Request,{params}:{params:Promise<{shopId:string}>}){
 try{
  const s=await requireDeliverySession();const{shopId}=await params;
  if(!await canAccess(s.companyId,s.id,shopId))return bad('Client non autorisé',403);
  const customer=await prisma.supplierErpCustomer.findFirst({where:{companyId:s.companyId,shopId,active:true}});
  if(!customer)return ok({customer:null,due:0,sales:[]});
  const sales=await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId:customer.id,status:{in:['CREDIT','PARTIALLY_PAID']}},orderBy:{createdAt:'asc'},take:100});
  const saleIds=sales.map(x=>x.id),orderIds=sales.map(x=>x.sourceOrderId).filter(Boolean) as string[];
  const [items,payments,orders]=await Promise.all([
   saleIds.length?prisma.supplierErpSaleItem.findMany({where:{saleId:{in:saleIds}}}):Promise.resolve([]),
   saleIds.length?prisma.supplierErpPayment.findMany({where:{saleId:{in:saleIds},kind:'IN'},orderBy:{createdAt:'desc'}}):Promise.resolve([]),
   orderIds.length?prisma.supplierOrder.findMany({where:{id:{in:orderIds}},include:{delivery:true}}):Promise.resolve([])
  ]);
  const detailed=sales.map(x=>{const order=orders.find(o=>o.id===x.sourceOrderId);return {...x,due:Math.max(0,Number(x.total)-Number(x.paid)),items:items.filter(i=>i.saleId===x.id),payments:payments.filter(p=>p.saleId===x.id),delivery:order?.delivery?{driverName:order.delivery.driverName,recipientName:order.delivery.recipientName,deliveredAt:order.delivery.deliveredAt}:null}});
  const due=detailed.reduce((a,x)=>a+Number(x.due),0);
  return ok(plain({customer,due,sales:detailed}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request,{params}:{params:Promise<{shopId:string}>}){
 try{
  const s=await requireDeliverySession();const{shopId}=await params;const b=await req.json();
  if(!await canAccess(s.companyId,s.id,shopId))return bad('Client non autorisé',403);
  const shift=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'}});if(!shift)return bad('Ouvrez votre journée livreur avant tout encaissement.',409);
  const amount=Math.round(Math.max(0,Number(b.amount||0))*1000)/1000;if(!(amount>0))return bad('Montant invalide');
  const customer=await prisma.supplierErpCustomer.findFirst({where:{companyId:s.companyId,shopId,active:true}});if(!customer)return bad('Compte client introuvable',404);
  const sales=await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId:customer.id,status:{in:['CREDIT','PARTIALLY_PAID']}},orderBy:{createdAt:'asc'}});
  const totalDue=sales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);if(amount>totalDue+0.001)return bad('Montant supérieur au dû client',409);
  await prisma.$transaction(async tx=>{
   let remaining=amount;
   for(const sale of sales){
    if(remaining<=0.0001)break;
    const due=Math.max(0,Number(sale.total)-Number(sale.paid));if(due<=0)continue;
    const take=Math.min(remaining,due);
    await tx.supplierErpPayment.create({data:{companyId:s.companyId,customerId:customer.id,saleId:sale.id,kind:'IN',method:String(b.method||'CASH').toUpperCase(),amount:take,reference:b.reference||sale.reference,note:'Encaissement ancien dû via Fixi Delivery',accountId:s.id}});
    const paid=Number(sale.paid)+take;
    await tx.supplierErpSale.update({where:{id:sale.id},data:{paid,status:paid+0.001>=Number(sale.total)?'PAID':'PARTIALLY_PAID'}});
    remaining-=take;
   }
   await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:'DUE:'+shopId,accountId:s.id,type:'DUE_COLLECTED',amount,note:'Encaissement dû client '+customer.name}});
  });
  const rest=Math.max(0,totalDue-amount);
  await Promise.allSettled([
   notifySupplier(s.companyId,'Dû client encaissé',customer.name+' · '+amount.toFixed(3)+' DT encaissé par '+s.fullName+(rest>0?' · reste '+rest.toFixed(3)+' DT':' · compte soldé'),{href:'/supplier?tab=dues',kind:'PAYMENT',soundKey:'SUCCESS',roles:['OWNER','ADMIN','MANAGER','ACCOUNTANT'],metadata:{shopId,customerId:customer.id,amount,remaining:rest,driverAccountId:s.id}}),
   notifyShop(shopId,'Paiement de votre dû enregistré',amount.toFixed(3)+' DT encaissé par le livreur. Reste : '+rest.toFixed(3)+' DT.','/app/suppliers',NotificationType.PAYMENT)
  ]);
  return ok({ok:true,paid:amount,remaining:rest});
 }catch(e:any){return bad(e.message,e.status||500)}
}
