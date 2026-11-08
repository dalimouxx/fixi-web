import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

// Lu à chaque requête : l'adresse publique (NEXT_PUBLIC_APP_URL) n'est connue qu'au démarrage du serveur, pas à la construction.
export const dynamic='force-dynamic';

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=(process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000').replace(/\/$/,'');
 let shops:{slug:string;createdAt:Date}[]=[];
 try{shops=await prisma.shop.findMany({where:{publicVisible:true,isActive:true},select:{slug:true,createdAt:true},orderBy:{createdAt:'desc'}})}catch{}
 return [
  {url:base,lastModified:new Date(),changeFrequency:'weekly',priority:1},
  {url:`${base}/stores`,lastModified:new Date(),changeFrequency:'daily',priority:.9},
  {url:`${base}/aide`,lastModified:new Date(),changeFrequency:'monthly',priority:.6},{url:`${base}/conditions`,lastModified:new Date(),changeFrequency:'yearly',priority:.3},{url:`${base}/confidentialite`,lastModified:new Date(),changeFrequency:'yearly',priority:.3},
  {url:`${base}/inscription`,lastModified:new Date(),changeFrequency:'monthly',priority:.7},
  ...shops.map(s=>({url:`${base}/stores/${s.slug}`,lastModified:s.createdAt,changeFrequency:'weekly' as const,priority:.8}))
 ];
}
