import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {notifySupplier} from '@/lib/supplier-notifications';
import type {PushDispatchReport} from '@/lib/push';
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
  const pushResult:{current?:PushDispatchReport}={};
  const rows=await notifySupplier(s.companyId,'Test notification FIXI Livreur',
    'Message de contrôle de réception sur le téléphone. Le son dépend de vos réglages Android/iOS.',
    {accountIds:[s.id],kind:'INFO',priority:'LOW',experienceKey:'DRIVER_ARRIVED',href:'/delivery',onPushReport:r=>{pushResult.current=r}});
  const report=pushResult.current;
  const accepted=report?.accepted||0;
  return ok({created:rows.length>0,subscribedDevices:subscriptions,
   pushAcceptedByGateway:accepted,pushExpired:report?.expired||0,pushFailed:report?.failed||0,
   gatewayChecked:!!report,deliveryConfirmed:false,
   note:accepted>0
     ?'Le service Push a accepté '+accepted+' envoi(s). Vérifiez maintenant la notification sur le téléphone : réception et son non garantis.'
     :'Aucun envoi accepté par le service Push. Vérifiez les autorisations, l’abonnement et la connexion du téléphone.'});
 }catch(e:any){return bad(e.message||'Test livreur indisponible',e.status||500)}
}
