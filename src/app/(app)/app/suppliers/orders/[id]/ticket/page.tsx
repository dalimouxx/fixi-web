import QRCode from 'qrcode';
import {notFound,redirect} from 'next/navigation';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {DeliveryTicket} from '@/components/delivery-ticket';

export default async function ShopDeliveryTicketPage({params}:{params:Promise<{id:string}>}){
 let s:any;try{s=await requireSession()}catch{redirect('/login')}
 const{id}=await params;
 const order=await prisma.supplierOrder.findFirst({where:{id,shopId:s.shopId},include:{company:true,shop:true,delivery:true,items:{include:{product:true}}}});
 if(!order)notFound();
 const customer=await prisma.supplierErpCustomer.findFirst({where:{companyId:order.companyId,shopId:s.shopId},select:{id:true}});
 const sales=customer?await prisma.supplierErpSale.findMany({where:{companyId:order.companyId,customerId:customer.id,status:{not:'CANCELLED'}},select:{total:true,paid:true}}):[];
 const customerDue=sales.reduce((a,x)=>a+Math.max(0,Number(x.total)-Number(x.paid)),0);
 const qr=await QRCode.toDataURL(String(order.deliveryCode||order.reference),{width:300,margin:1,errorCorrectionLevel:'H'});
 return <DeliveryTicket order={{...order,customerDue}} qr={qr} viewer="shop"/>
}
