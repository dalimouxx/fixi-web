import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export async function GET(){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER']);
  const [shifts,locations,events]=await Promise.all([
   prisma.supplierDeliveryShift.findMany({where:{companyId:s.companyId,status:'OPEN'},orderBy:{openedAt:'asc'}}),
   prisma.supplierDriverLocation.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1000}),
   prisma.supplierDeliveryEvent.findMany({where:{companyId:s.companyId},orderBy:{createdAt:'desc'},take:1000})
  ]);
  const latestByOrder:any={};for(const x of locations)if(!latestByOrder[x.orderId])latestByOrder[x.orderId]=x;
  const codByOrder:any={};for(const e of events)if(e.type==='COD_COLLECTED')codByOrder[e.orderId]=(codByOrder[e.orderId]||0)+Number(e.amount||0);
  const today=new Date();today.setHours(0,0,0,0);
  const metrics={
   openShifts:shifts.length,
   codToday:events.filter(e=>e.type==='COD_COLLECTED'&&e.createdAt>=today).reduce((a,e)=>a+Number(e.amount||0),0),
   incidentsToday:events.filter(e=>['CUSTOMER_ABSENT','DELIVERY_REFUSED','INCIDENT','RETURN_TO_DEPOT'].includes(e.type)&&e.createdAt>=today).length
  };
  return ok(plain({shifts,latestByOrder,codByOrder,events:events.slice(0,300),metrics}));
 }catch(e:any){return bad(e.message,e.status||500)}
}
