import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';

export async function GET(){
 try{const s=await requireDeliverySession();const a=await prisma.supplierAccount.findUnique({where:{id:s.id},select:{id:true,fullName:true,phone:true,driverAvailable:true}});return ok(a)}
 catch(e:any){return bad(e.message,e.status||500)}
}
export async function PATCH(req:Request){
 try{const s=await requireDeliverySession();const b=await req.json();if(typeof b.driverAvailable!=='boolean')return bad('Statut disponibilité invalide');const a=await prisma.supplierAccount.update({where:{id:s.id},data:{driverAvailable:b.driverAvailable},select:{id:true,driverAvailable:true}});return ok(a)}
 catch(e:any){return bad(e.message,e.status||500)}
}
