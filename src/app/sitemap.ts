import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=(process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000').replace(/\/$/,'');
 let shops:{slug:string;createdAt:Date}[]=[];
 try{shops=await prisma.shop.findMany({where:{publicVisible:true,isActive:true},select:{slug:true,createdAt:true},orderBy:{createdAt:'desc'}})}catch{}
 return [
  {url:base,lastModified:new Date(),changeFrequency:'weekly',priority:1},
  {url:`${base}/stores`,lastModified:new Date(),changeFrequency:'daily',priority:.9},
  ...shops.map(s=>({url:`${base}/stores/${s.slug}`,lastModified:s.createdAt,changeFrequency:'weekly' as const,priority:.8}))
 ];
}
