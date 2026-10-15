import { prisma } from '@/lib/prisma';import { requireSession } from '@/lib/auth';import { bad,ok } from '@/lib/http';
export async function POST(){try{const s=await requireSession();await prisma.notification.updateMany({where:{shopId:s.shopId,readAt:null,userId:s.id},data:{readAt:new Date()}});return ok({ok:true})}catch(e:any){return bad(e.message,e.status||500)}}
