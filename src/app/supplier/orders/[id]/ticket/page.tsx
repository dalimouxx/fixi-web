import QRCode from 'qrcode';
import {notFound,redirect} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {DeliveryTicket} from '@/components/delivery-ticket';

export default async function SupplierDeliveryTicketPage({params}:{params:Promise<{id:string}>}){
 let s:any;try{s=await requireSupplierSession()}catch{redirect('/supplier/login')}
 const{id}=await params;
 const order=await prisma.supplierOrder.findFirst({where:{id,companyId:s.companyId},include:{company:true,shop:true,delivery:true,items:{include:{product:true}}}});
 if(!order)notFound();
 const customer=await prisma.supplierErpCustomer.findFirst({where:{companyId:s.companyId,shopId:order.shopId},select:{id:true}});
 const sales=customer?await prisma.supplierErpSale.findMany({where:{companyId:s.companyId,customerId:customer.id,status:{not:'CANCELLED'}},select:{total:true,paid:true}}):[];
 const customerDue=sales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);
 const qr=await QRCode.toDataURL('FIXI-TICKET:'+order.reference,{width:300,margin:1,errorCorrectionLevel:'H'});
 return <DeliveryTicket order={{...order,customerDue}} qr={qr} viewer="supplier"/>
}
