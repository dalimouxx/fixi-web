import {prisma} from '@/lib/prisma';import {requireDeliverySession} from '@/lib/delivery-auth';import {bad,ok} from '@/lib/http';import {plain} from '@/lib/serializers';import {SupplierOrderStatus} from '@prisma/client';
export async function GET(){try{
 const s=await requireDeliverySession();
 const rows=await prisma.supplierOrder.findMany({where:{companyId:s.companyId,OR:[{delivery:{is:{driverAccountId:s.id}}},{status:SupplierOrderStatus.READY_FOR_DELIVERY,delivery:{is:{driverAccountId:null}}}]},include:{shop:{select:{name:true,region:true,address:true,phone:true}},items:{include:{product:true}},delivery:true},orderBy:{createdAt:'desc'},take:200});
 const shopIds=[...new Set(rows.map(x=>x.shopId))];
 const customers=shopIds.length?await prisma.supplierErpCustomer.findMany({where:{companyId:s.companyId,shopId:{in:shopIds}},select:{id:true,shopId:true}}):[];
 const customerIds=customers.map(x=>x.id);
 const sales=customerIds.length?await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId:{in:customerIds},status:{not:'CANCELLED'}},select:{customerId:true,total:true,paid:true}}):[];
 const dueByCustomer=new Map<string,number>();for(const x of sales){if(!x.customerId)continue;dueByCustomer.set(x.customerId,(dueByCustomer.get(x.customerId)||0)+Math.max(0,Number(x.total)-Number(x.paid)))}
 const customerByShop=new Map(customers.map(x=>[x.shopId,x.id]));
 return ok(plain(rows.map(x=>({...x,availableToAccept:x.status===SupplierOrderStatus.READY_FOR_DELIVERY&&!x.delivery?.driverAccountId,customerDue:dueByCustomer.get(customerByShop.get(x.shopId)||'')||0}))))
}catch(e:any){return bad(e.message,e.status||500)}}