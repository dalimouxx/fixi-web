import { prisma } from '@/lib/prisma';
import { ok,bad } from '@/lib/http';
import { plain } from '@/lib/serializers';

export const dynamic='force-dynamic';

export async function GET(req:Request){
  try{
    const u=new URL(req.url);
    const q=(u.searchParams.get('q')||'').trim();
    const region=(u.searchParams.get('region')||'').trim();
    const city=(u.searchParams.get('city')||'').trim();
    const service=(u.searchParams.get('service')||'').trim();
    const rows=await prisma.shop.findMany({
      where:{
        isActive:true,
        publicVisible:true,
        ...(region?{region}:{ }),
        ...(city?{city}:{ }),
        ...(service?{publicServices:{has:service}}:{}),
        ...(q?{OR:[
          {name:{contains:q,mode:'insensitive'}},
          {city:{contains:q,mode:'insensitive'}},
          {region:{contains:q,mode:'insensitive'}},
          {address:{contains:q,mode:'insensitive'}},
          {publicDescription:{contains:q,mode:'insensitive'}},
          {publicServices:{has:q}}
        ]}:{})
      },
      select:{
        id:true,name:true,slug:true,region:true,city:true,address:true,phone:true,whatsappPhone:true,email:true,website:true,
        latitude:true,longitude:true,logoDataUrl:true,coverDataUrl:true,publicDescription:true,publicServices:true,openingHours:true,publicFeatured:true,
        feedbacks:{select:{rating:true},take:200,orderBy:{createdAt:'desc'}},
        _count:{select:{feedbacks:true}}
      },
      orderBy:[{publicFeatured:'desc'},{region:'asc'},{name:'asc'}],
      take:250
    });
    const stores=rows.map(({feedbacks,_count,...s})=>({
      ...s,
      rating:feedbacks.length?Math.round((feedbacks.reduce((a,x)=>a+x.rating,0)/feedbacks.length)*10)/10:null,
      reviewCount:_count.feedbacks
    }));
    const regions=Array.from(new Set(stores.map(x=>x.region).filter(Boolean))).sort();
    const cities=Array.from(new Set(stores.map(x=>x.city).filter(Boolean) as string[])).sort();
    const services=Array.from(new Set(stores.flatMap(x=>x.publicServices||[]))).sort();
    return ok(plain({stores,filters:{regions,cities,services}}));
  }catch(e:any){return bad(e.message,e.status||500)}
}
