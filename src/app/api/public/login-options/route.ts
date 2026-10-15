import { prisma } from '@/lib/prisma';
import { ok,bad } from '@/lib/http';
import { roleLabels } from '@/lib/auth';

export async function GET(req:Request){
  try{
    const u=new URL(req.url);const region=u.searchParams.get('region');const shopSlug=u.searchParams.get('shop');
    if(shopSlug){
      const shop=await prisma.shop.findFirst({where:{slug:shopSlug,isActive:true},select:{id:true,name:true,slug:true,region:true,logoDataUrl:true,users:{where:{isActive:true},select:{id:true,fullName:true,loginCode:true,role:true},orderBy:{fullName:'asc'}}}});
      if(!shop)return bad('Boutique introuvable',404);
      return ok({...shop,users:shop.users.map(x=>({...x,roleLabel:roleLabels[x.role]}))});
    }
    if(region){
      const shops=await prisma.shop.findMany({where:{region,isActive:true},select:{id:true,name:true,slug:true,region:true,logoDataUrl:true,lastSeenAt:true},orderBy:{name:'asc'}});
      return ok({region,shops});
    }
    const rows=await prisma.shop.findMany({where:{isActive:true},select:{region:true},distinct:['region'],orderBy:{region:'asc'}});
    return ok({regions:rows.map(x=>x.region)});
  }catch(e:any){return bad(e.message||'Impossible de charger les boutiques',500)}
}
