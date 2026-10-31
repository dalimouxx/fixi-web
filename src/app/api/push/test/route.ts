import {NotificationType} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {sendPushToUsers} from '@/lib/push';
import {publish} from '@/lib/realtime';
import {bad,ok} from '@/lib/http';

export async function POST(){
 try{
  if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)
   return bad('Push non configuré sur FIXI Cloud : clés VAPID manquantes',503);
  const s=await requireSession(undefined,'CONNECT');
  const subscriptions=await prisma.pushSubscription.count({where:{userId:s.id}});
  if(!subscriptions)return bad('Aucun appareil Atelier abonné aux notifications Push',409);
  const recent=await prisma.notification.findFirst({where:{
   shopId:s.shopId,userId:s.id,title:'Test notification FIXI Atelier',
   createdAt:{gte:new Date(Date.now()-60_000)}
  },select:{id:true}});
  if(recent)return bad('Attendez 60 secondes entre deux tests',429);
  const row=await prisma.notification.create({data:{
   shopId:s.shopId,userId:s.id,title:'Test notification FIXI Atelier',
   message:'Vérifiez la réception sur votre téléphone. Le son dépend du système.',
   href:'/app/notifications',type:NotificationType.INFO,
   experienceKey:'SHOP_ORDER_PROGRESS',soundKey:'SHOP_PROGRESS',priority:'LOW'
  }});
  publish(s.shopId,'notification.created',{kind:'INFO'});
  let gateway;
  try{
    gateway=await sendPushToUsers([s.id],{title:row.title,body:row.message,
      href:'/app/notifications',experienceKey:'SHOP_ORDER_PROGRESS',
      tag:'fixi-shop-test-'+row.id});
  }catch(e){
    console.warn('Fixi shop push gateway unreachable',String(e));
  }
  const accepted=gateway?.accepted||0;
  return ok({created:true,subscribedDevices:subscriptions,
    gatewayChecked:!!gateway,pushAcceptedByGateway:accepted,
    pushExpired:gateway?.expired||0,pushFailed:gateway?.failed||0,deliveryConfirmed:false,
    note:accepted>0
      ?'Le service Push a accepté '+accepted+' envoi(s). Vérifiez la notification système du téléphone.'
      :'Aucun envoi accepté par le service Push. Vérifiez l’abonnement et les autorisations.'});
 }catch(e:any){return bad(e.message||'Test Atelier indisponible',e.status||500)}
}
