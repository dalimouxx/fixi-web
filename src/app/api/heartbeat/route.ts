import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { NotificationType,SubscriptionStatus } from '@prisma/client';

export async function POST(){
  try{
    const s=await requireSession(undefined,'CONNECT');
    const now=new Date();
    await prisma.$transaction([
      prisma.shop.update({where:{id:s.shopId},data:{lastSeenAt:now}}),
      prisma.user.update({where:{id:s.id},data:{lastSeenAt:now}})
    ]);

    // Avertissement automatique boutique : au plus une notification d'échéance par jour.
    const sub=await prisma.subscription.findFirst({where:{tenantId:s.tenantId},orderBy:{createdAt:'desc'}});
    if(sub?.endsAt&&(sub.status===SubscriptionStatus.TRIAL||sub.status===SubscriptionStatus.ACTIVE)){
      const ms=sub.endsAt.getTime()-now.getTime();
      const days=Math.ceil(ms/86400000);
      if(days>=0&&days<=7){
        const since=new Date(now.getTime()-20*60*60*1000);
        const existing=await prisma.notification.findFirst({where:{shopId:s.shopId,title:'Abonnement Fixi bientôt expiré',createdAt:{gte:since}}});
        if(!existing)await prisma.notification.create({data:{shopId:s.shopId,type:NotificationType.WARNING,title:'Abonnement Fixi bientôt expiré',message:days===0?'Votre accès Fixi arrive à échéance aujourd’hui. Contactez Fixi pour éviter une interruption.':`Votre abonnement Fixi expire dans ${days} jour${days>1?'s':''}.`,href:'/app/support'}});
      }
    }
    return ok({ok:true,at:now});
  }catch(e:any){return bad(e.message,e.status||500)}
}
