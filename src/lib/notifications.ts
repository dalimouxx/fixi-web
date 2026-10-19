import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { publish } from './realtime';
import { sendPushToUsers } from './push';
import { experienceTag, getNotificationExperience, type FixiExperienceKey } from './notification-experience';

type ShopNotificationOptions={
  experienceKey?: FixiExperienceKey;
  priority?: 'LOW'|'NORMAL'|'HIGH'|'URGENT';
  eventId?: string;
  metadata?: Record<string,unknown>;
};

/** Persist for the intended users first; background push is best effort. */
export async function notifyShop(
  shopId:string,title:string,message:string,href?:string,
  type:NotificationType=NotificationType.INFO,roles?:UserRole[],
  options:ShopNotificationOptions={}
){
  const experienceKey=options.experienceKey||'GENERAL';
  // Supplier purchasing screens are available to these workshop roles only.
  const allowedRoles=roles?.length?roles:experienceKey.startsWith('SHOP_')
    ?[UserRole.ADMIN,UserRole.RECEPTION]:undefined;
  const users=await prisma.user.findMany({
    where:{shopId,isActive:true,...(allowedRoles?.length?{role:{in:allowedRoles}}:{})},
    select:{id:true},
  });
  if(!users.length)return;
  const config=getNotificationExperience(experienceKey);
  const safeHref=href&&href.startsWith('/')&&!href.startsWith('//')?href:'/app/notifications';
  await prisma.notification.createMany({data:users.map(u=>({
    shopId,userId:u.id,title,message,href:safeHref,type,
    experienceKey,soundKey:config.sound,priority:options.priority||'NORMAL'
  }))});
  // Do not broadcast private notification details to unauthorized roles in the shop.
  publish(shopId,'notification.created',{kind:type});
  void sendPushToUsers(users.map(u=>u.id),{
    title,body:message,href:safeHref,experienceKey,
    tag:experienceTag(experienceKey,options.eventId),
    data:{...(options.metadata||{}),experienceKey},
  }).catch(err=>console.warn('Shop push notification failed',String(err)));
}
