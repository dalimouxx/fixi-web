import { prisma } from './prisma';
export async function audit(shopId:string,userId:string|undefined,action:string,entity:string,entityId?:string,metadata?:Record<string,unknown>){
  await prisma.auditLog.create({data:{shopId,userId,action,entity,entityId,metadata:metadata as any}}).catch(()=>{});
}
