import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER','CASHIER']);
  const [shifts,locations,events,customers,sales]=await Promise.all([
   prisma.supplierDeliveryShift.findMany({where:{companyId:s.companyId,status:'OPEN'},orderBy:{openedAt:'asc'}}),
   prisma.supplierDriverLocation.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1000}),
   prisma.supplierDeliveryEvent.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1000}),
   prisma.supplierErpCustomer.findMany({where:{companyId:s.companyId,shopId:{not:null}},select:{id:true,shopId:true,name:true,phone:true,address:true,region:true,creditLimit:true}}),
   prisma.supplierErpSale.findMany({where:{companyId:s.companyId,status:{not:'CANCELLED'}},select:{id:true,customerId:true,reference:true,total:true,paid:true,status:true,dueAt:true,createdAt:true}})
  ]);
  const latestByOrder:any={};for(const x of locations)if(!latestByOrder[x.orderId])latestByOrder[x.orderId]=x;
  const codByOrder:any={};for(const e of events)if(e.type==='COD_COLLECTED')codByOrder[e.orderId]=(codByOrder[e.orderId]||0)+Number(e.amount||0);
  const today=new Date();today.setHours(0,0,0,0);
  const customerByShop=new Map(customers.filter(x=>x.shopId).map(x=>[x.shopId as string,x]));
  const dueByShop:any={};const dueDetailsByShop:any={};for(const [shopId,customer] of customerByShop){const rows=sales.filter(x=>x.customerId===customer.id&&Number(x.total)-Number(x.paid)>0.0001).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime());dueByShop[shopId]=rows.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);dueDetailsByShop[shopId]=rows.map(x=>({id:x.id,reference:x.reference,status:x.status,total:Number(x.total),paid:Number(x.paid),due:Math.max(0,Number(x.total)-Number(x.paid)),dueAt:x.dueAt,createdAt:x.createdAt}));}
  const metrics={
   openShifts:shifts.length,
   codToday:events.filter(e=>e.type==='COD_COLLECTED'&&e.createdAt>=today).reduce((a,e)=>a+Number(e.amount||0),0),
   incidentsToday:events.filter(e=>['CUSTOMER_ABSENT','DELIVERY_REFUSED','INCIDENT','RETURN_TO_DEPOT'].includes(e.type)&&e.createdAt>=today).length
  };
  return ok(plain({shifts,latestByOrder,codByOrder,dueByShop,dueDetailsByShop,events:events.slice(0,300),metrics}));
 }catch(e:any){return bad(e.message,e.status||500)}
}
