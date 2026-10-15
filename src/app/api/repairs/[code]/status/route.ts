import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { DigitalWarrantyStatus, PaymentKind, RepairStatus, UserRole } from '@prisma/client';
import { canTransition } from '@/lib/repair';
import { audit } from '@/lib/audit';
import { notifyShop } from '@/lib/notifications';
import { publish } from '@/lib/realtime';
import { defaultQualityChecks } from '@/lib/smart';

export async function PATCH(req:Request,{params}:{params:Promise<{code:string}>}){
  try{
    const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION,UserRole.TECHNICIAN,UserRole.CASHIER]);
    const {code}=await params;
    const body=await req.json();
    const to=body.status as RepairStatus;
    if(!Object.values(RepairStatus).includes(to)) return bad('Statut invalide');
    const r=await prisma.repair.findUnique({
      where:{shopId_code:{shopId:s.shopId,code}},
      include:{payments:true,client:true}
    });
    if(!r) return bad('Réparation introuvable',404);
    if(s.role===UserRole.TECHNICIAN&&r.technicianId&&r.technicianId!==s.id) return bad('Accès refusé',403);
    if(!canTransition(r.status,to,s.role)) return bad(`Transition ${r.status} → ${to} non autorisée`,409);

    if(to===RepairStatus.READY){
      const shop=await prisma.shop.findUnique({where:{id:s.shopId},select:{qualityRequiredBeforeReady:true}});
      if(shop?.qualityRequiredBeforeReady){
        let checks=await prisma.repairQualityCheck.findMany({where:{repairId:r.id,required:true},select:{checked:true}});
        // Migration-safe: old V4 repairs did not have quality rows.
        if(!checks.length){
          await prisma.repairQualityCheck.createMany({
            data:defaultQualityChecks.map(([key,label],i)=>({shopId:s.shopId,repairId:r.id,key,label,required:true,sortOrder:i}))
          });
          checks=await prisma.repairQualityCheck.findMany({where:{repairId:r.id,required:true},select:{checked:true}});
        }
        if(checks.some(c=>!c.checked)) return bad('Contrôle qualité incomplet. Validez la checklist avant de passer l’appareil en Prêt.',409);
      }
    }

    if(to===RepairStatus.DELIVERED){
      const shopRule=await prisma.shop.findUnique({where:{id:s.shopId},select:{deliveryRequiresFullPayment:true}});
      const total=Math.max(0,Number(r.finalPrice||0)-Number(r.discountAmount||0));
      const paid=r.payments.reduce((a,p)=>a+(p.kind===PaymentKind.PAYMENT?Number(p.amount):-Number(p.amount)),0);
      if(shopRule?.deliveryRequiresFullPayment&&total>0&&paid+0.0001<total) return bad(`Paiement incomplet. Reste ${(total-paid).toFixed(3)} à régler.`,409);
    }

    const updated=await prisma.$transaction(async tx=>{
      const deliveredAt=to===RepairStatus.DELIVERED?new Date():r.deliveredAt;
      const x=await tx.repair.update({where:{id:r.id},data:{status:to,deliveredAt}});
      await tx.repairStatusEvent.create({data:{repairId:r.id,fromStatus:r.status,toStatus:to,userId:s.id,note:body.note||null}});
      if(to===RepairStatus.DELIVERED&&deliveredAt&&r.warrantyDays>0){
        const endsAt=new Date(deliveredAt.getTime()+r.warrantyDays*86400000);
        await tx.digitalWarranty.upsert({where:{repairId:r.id},update:{status:DigitalWarrantyStatus.ACTIVE,startsAt:deliveredAt,endsAt},create:{shopId:s.shopId,clientId:r.clientId,repairId:r.id,startsAt:deliveredAt,endsAt,coverageText:`Garantie atelier ${r.warrantyDays} jours sur l’intervention réalisée.`}});
      }
      return x;
    });
    await audit(s.shopId,s.id,'STATUS_CHANGE','REPAIR',r.id,{from:r.status,to});
    if(to===RepairStatus.READY) await notifyShop(s.shopId,'Appareil prêt',`${r.code} · ${r.client.fullName}`,`/app/repairs/${r.code}`,'REPAIR' as any,[UserRole.ADMIN,UserRole.RECEPTION,UserRole.CASHIER]);
    publish(s.shopId,'repair.status',{code,status:to});
    return ok(updated);
  }catch(e:any){return bad(e.message,e.status||500)}
}
