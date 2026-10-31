import webpush from 'web-push';
import {prisma} from './prisma';

/** "Accepted" means a Push gateway accepted the request, NOT that a phone
 * displayed it or played a sound. Never expose subscriber endpoints in logs.
 */
export type PushDispatchReport={
  subscriptions:number;
  accepted:number;
  expired:number;
  failed:number;
  configured:boolean;
};

function ready(){
  const pub=process.env.VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
  if(!pub||!priv)return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@localhost',pub,priv);
  return true;
}

type PushPayload={
  title:string;body:string;href?:string;experienceKey?:string;tag?:string;
  actions?:{action:string;title:string}[];
  data?:Record<string,unknown>;requireInteraction?:boolean;
};

type SubscriptionRow={id:string;endpoint:string;p256dh:string;auth:string};
async function dispatch(
  rows:SubscriptionRow[],
  payload:PushPayload,
  removeExpired:(id:string)=>Promise<unknown>
):Promise<PushDispatchReport>{
  const report:PushDispatchReport={subscriptions:rows.length,accepted:0,expired:0,failed:0,configured:false};
  if(!ready())return report;
  report.configured=true;
  const results=await Promise.allSettled(rows.map(async row=>{
    try{
      // Bound the request so a slow gateway cannot block the business workflow.
      await webpush.sendNotification(
        {endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},
        JSON.stringify(payload),
        {TTL:300,timeout:6000}
      );
      return 'accepted' as const;
    }catch(e:unknown){
      const status=(e as {statusCode?:number}|null)?.statusCode;
      if(status===404||status===410){
        await removeExpired(row.id).catch(()=>{});
        return 'expired' as const;
      }
      return 'failed' as const;
    }
  }));
  for(const result of results){
    if(result.status==='rejected'){report.failed++;continue}
    report[result.value]++;
  }
  return report;
}

export async function sendPushToUsers(userIds:string[],payload:PushPayload):Promise<PushDispatchReport>{
  if(!userIds.length)return {subscriptions:0,accepted:0,expired:0,failed:0,configured:!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)};
  const rows=await prisma.pushSubscription.findMany({where:{userId:{in:userIds}}});
  return dispatch(rows,payload,id=>prisma.pushSubscription.delete({where:{id}}));
}

export async function sendPushToSupplierAccounts(accountIds:string[],payload:PushPayload):Promise<PushDispatchReport>{
  if(!accountIds.length)return {subscriptions:0,accepted:0,expired:0,failed:0,configured:!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)};
  const rows=await prisma.supplierPushSubscription.findMany({where:{accountId:{in:accountIds}}});
  return dispatch(rows,payload,id=>prisma.supplierPushSubscription.delete({where:{id}}));
}
