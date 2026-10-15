import { prisma } from '@/lib/prisma';
import { ok,bad } from '@/lib/http';
import { plain } from '@/lib/serializers';

export const dynamic='force-dynamic';

export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){
  try{
    const {slug}=await params;
    const shop=await prisma.shop.findFirst({
      where:{slug,isActive:true,publicVisible:true},
      select:{
        id:true,name:true,slug:true,region:true,city:true,address:true,phone:true,whatsappPhone:true,email:true,website:true,
        latitude:true,longitude:true,logoDataUrl:true,coverDataUrl:true,publicDescription:true,publicServices:true,openingHours:true,publicFeatured:true,
        feedbacks:{select:{rating:true},take:200,orderBy:{createdAt:'desc'}},
        _count:{select:{feedbacks:true}}
      }
    });
    if(!shop)return bad('Boutique introuvable',404);
    const scores=await prisma.clientFeedback.findMany({where:{shopId:shop.id},select:{rating:true}});
    const rating=scores.length?Math.round((scores.reduce((a,x)=>a+x.rating,0)/scores.length)*10)/10:null;
    return ok(plain({...shop,rating,reviewCount:shop._count.feedbacks,_count:undefined}));
  }catch(e:any){return bad(e.message,e.status||500)}
}
