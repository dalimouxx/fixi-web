import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {notifySupplier} from '@/lib/supplier-notifications';
import type {PushDispatchReport} from '@/lib/push';
import {bad,ok} from '@/lib/http';

/** Explicitly requested, account-scoped diagnostic notification.
 * A created Push request is not proof of device delivery or sound.
 */
export async function POST(){
 try{
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)
   return bad('Push non configuré sur FIXI Cloud : clés VAPID manquantes',503);
  const s=await requireSupplierSession();
  const subscriptions=await prisma.supplierPushSubscription.count({where:{companyId:s.companyId,accountId:s.id}});
  if(!subscriptions)return bad('Aucun appareil abonné aux notifications Push pour ce compte',409);
  const recent=await prisma.supplierNotification.findFirst({where:{
   companyId:s.companyId,accountId:s.id,title:'Test notification FIXI Supplier',
   createdAt:{gte:new Date(Date.now()-60_000)}
  },select:{id:true}});
  if(recent)return bad('Attendez 60 secondes avant de renvoyer un test',429);
  const pushResult:{current?:PushDispatchReport}={};
  const rows=await notifySupplier(s.companyId,'Test notification FIXI Supplier',
   'Si ce message s’affiche sur votre téléphone, les notifications arrivent. Le son dépend des réglages du téléphone.',
   {accountIds:[s.id],kind:'INFO',priority:'LOW',experienceKey:'SUPPLIER_UPDATE',href:'/supplier',onPushReport:r=>{pushResult.current=r}});
  const report=pushResult.current;
  const accepted=report?.accepted||0;
  return ok({created:rows.length>0,subscribedDevices:subscriptions,
   pushAcceptedByGateway:accepted,pushExpired:report?.expired||0,pushFailed:report?.failed||0,
   gatewayChecked:!!report,deliveryConfirmed:false,
   note:accepted>0
     ?'Le service Push a accepté '+accepted+' envoi(s). Vérifiez maintenant la notification sur le téléphone : réception et son non garantis.'
     :'Aucun envoi accepté par le service Push. Vérifiez les autorisations, l’abonnement et la connexion du téléphone.'});
 }catch(e:any){return bad(e.message||'Test notifications indisponible',e.status||500)}
}
