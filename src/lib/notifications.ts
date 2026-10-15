import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { publish } from './realtime';
import { sendPushToUsers } from './push';

export async function notifyShop(shopId:string,title:string,message:string,href?:string,type:NotificationType=NotificationType.INFO,roles?:UserRole[]){
  const users=await prisma.user.findMany({
    where:{shopId,isActive:true,...(roles?.length?{role:{in:roles}}:{})},
    select:{id:true},
  });
  if(users.length){
    await prisma.notification.createMany({data:users.map(u=>({shopId,userId:u.id,title,message,href,type}))});
  }
  publish(shopId,'notification.created',{title,type});
  sendPushToUsers(users.map(u=>u.id),{title,body:message,href}).catch(()=>{});
}
