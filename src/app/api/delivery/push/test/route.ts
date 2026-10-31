import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {notifySupplier} from '@/lib/supplier-notifications';
import {bad,ok} from '@/lib/http';

export async function POST(){
 try{
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)
   return bad('Push non configuré sur FIXI Cloud : clés VAPID manquantes',503);
  const s=await requireDeliverySession();
  const subscriptions=await prisma.supplierPushSubscription.count({where:{companyId:s.companyId,accountId:s.id}});
  if(!subscriptions)return bad('Aucun appareil livreur abonné aux notifications Push',409);
  const recent=await prisma.supplierNotification.findFirst({where:{
    companyId:s.companyId,accountId:s.id,title:'Test notification FIXI Livreur',
    createdAt:{gte:new Date(Date.now()-60_000)}
   },select:{id:true}});
  if(recent)return bad('Attendez 60 secondes entre deux tests',429);
  const rows=await notifySupplier(s.companyId,'Test notification FIXI Livreur',
    'Message de contrôle de réception sur le téléphone. Le son dépend de vos réglages Android/iOS.',
    {accountIds:[s.id],kind:'INFO',priority:'LOW',experienceKey:'DRIVER_ARRIVED',href:'/delivery'});
  return ok({created:rows.length>0,queued:subscriptions,deliveryConfirmed:false,
   note:'Test demandé. Vérifiez la notification système sur le téléphone.'});
 }catch(e:any){return bad(e.message||'Test livreur indisponible',e.status||500)}
}
