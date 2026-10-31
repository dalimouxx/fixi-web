import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {notifySupplier} from '@/lib/supplier-notifications';
import {bad,ok} from '@/lib/http';

/** Explicitly requested, account-scoped diagnostic notification.
 * A created Push request is not proof of device delivery or sound.
 */
export async function POST(){
 try{
  const s=await requireSupplierSession();
  const subscriptions=await prisma.supplierPushSubscription.count({where:{companyId:s.companyId,accountId:s.id}});
  if(!subscriptions)return bad('Aucun appareil abonné aux notifications Push pour ce compte',409);
  const recent=await prisma.supplierNotification.findFirst({where:{
   companyId:s.companyId,accountId:s.id,title:'Test notification FIXI Supplier',
   createdAt:{gte:new Date(Date.now()-60_000)}
  },select:{id:true}});
  if(recent)return bad('Attendez 60 secondes avant de renvoyer un test',429);
  const rows=await notifySupplier(s.companyId,'Test notification FIXI Supplier',
   'Si ce message s’affiche sur votre téléphone, les notifications arrivent. Le son dépend des réglages du téléphone.',
   {accountIds:[s.id],kind:'INFO',priority:'LOW',experienceKey:'SUPPLIER_UPDATE',href:'/supplier'});
  return ok({created:rows.length>0,queued:subscriptions,deliveryConfirmed:false,
   note:'Test demandé. Vérifiez l’appareil : le serveur ne peut pas garantir l’affichage ou le son.'});
 }catch(e:any){return bad(e.message||'Test notifications indisponible',e.status||500)}
}
