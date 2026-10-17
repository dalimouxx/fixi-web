import {prisma} from '@/lib/prisma';import {requireDeliverySession} from '@/lib/delivery-auth';import {bad,ok} from '@/lib/http';import {plain} from '@/lib/serializers';import {SupplierOrderStatus} from '@prisma/client';
export async function GET(){try{
 const s=await requireDeliverySession();
 const activeStatuses:[SupplierOrderStatus,...SupplierOrderStatus[]]=[SupplierOrderStatus.READY_FOR_DELIVERY,SupplierOrderStatus.OUT_FOR_DELIVERY,SupplierOrderStatus.RETURNING,SupplierOrderStatus.RETURNED];
 const [liveRows,historyRows]=await Promise.all([
  prisma.supplierOrder.findMany({where:{companyId:s.companyId,OR:[{delivery:{is:{driverAccountId:s.id}},status:{in:activeStatuses}},{status:SupplierOrderStatus.READY_FOR_DELIVERY,delivery:{is:{driverAccountId:null}}}]},include:{shop:{select:{name:true,region:true,address:true,phone:true}},items:{include:{product:true}},delivery:true},orderBy:{createdAt:'desc'},take:100}),
  prisma.supplierOrder.findMany({where:{companyId:s.companyId,delivery:{is:{driverAccountId:s.id}},status:{in:[SupplierOrderStatus.DELIVERED,SupplierOrderStatus.CANCELLED]}},include:{shop:{select:{name:true,region:true,address:true,phone:true}},items:{include:{product:true}},delivery:true},orderBy:{updatedAt:'desc'},take:20})
 ]);
 const rows=[...liveRows,...historyRows.filter(h=>!liveRows.some(x=>x.id===h.id))];
 const shopIds=[...new Set(liveRows.filter(x=>x.delivery?.driverAccountId===s.id).map(x=>x.shopId))];
 const customers=shopIds.length?await prisma.supplierErpCustomer.findMany({where:{companyId:s.companyId,shopId:{in:shopIds}},select:{id:true,shopId:true}}):[];
 const customerIds=customers.map(x=>x.id);
 const sales=customerIds.length?await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId:{in:customerIds},status:{in:['CREDIT','PARTIALLY_PAID']}},select:{id:true,customerId:true,reference:true,status:true,total:true,paid:true,dueAt:true,createdAt:true},orderBy:{createdAt:'asc'}}):[];
 const dueByCustomer=new Map<string,number>();for(const x of sales){if(!x.customerId)continue;dueByCustomer.set(x.customerId,(dueByCustomer.get(x.customerId)||0)+Math.max(0,Number(x.total)-Number(x.paid)))}
 const customerByShop=new Map(customers.map(x=>[x.shopId,x.id]));
 return ok(plain(rows.map(x=>{const availableToAccept=x.status===SupplierOrderStatus.READY_FOR_DELIVERY&&!x.delivery?.driverAccountId;const mine=x.delivery?.driverAccountId===s.id;const customerId=customerByShop.get(x.shopId)||'';const dueDetails=mine&&activeStatuses.includes(x.status)?sales.filter(a=>a.customerId===customerId&&Number(a.total)-Number(a.paid)>0.0001).map(a=>({id:a.id,reference:a.reference,status:a.status,total:Number(a.total),paid:Number(a.paid),due:Math.max(0,Number(a.total)-Number(a.paid)),dueAt:a.dueAt,createdAt:a.createdAt})):[];return {...x,shop:availableToAccept?{...x.shop,phone:null,address:null}:x.shop,deliveryAddress:availableToAccept?null:x.deliveryAddress,availableToAccept,customerDue:mine?(dueByCustomer.get(customerId)||0):0,dueDetails}})))
}catch(e:any){return bad(e.message,e.status||500)}}