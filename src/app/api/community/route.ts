import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { CommunityKnowledgeStatus,CommunityPostType,CommunityScope,CommunityVoteType } from '@prisma/client';

const allowedSpecialties=['iPhone','Samsung','Xiaomi','Oppo','Infinix / Tecno / Itel','Micro-soudure','PC','Général'];

export async function GET(req:Request){
  try{
    const s=await requireSession();
    const shop=await prisma.shop.findUnique({where:{id:s.shopId},select:{region:true}});
    const u=new URL(req.url);const scope=(u.searchParams.get('scope')||'GLOBAL') as CommunityScope;
    const q=(u.searchParams.get('q')||'').trim();const type=u.searchParams.get('type') as CommunityPostType|null;
    const specialty=(u.searchParams.get('specialty')||'').trim();const knowledge=u.searchParams.get('knowledge')==='1';
    const where:any={replyToId:null};
    if(Object.values(CommunityScope).includes(scope))where.scope=scope;
    if(scope===CommunityScope.REGION)where.region=shop?.region||'Non classée';
    if(scope===CommunityScope.SPECIALTY&&specialty)where.specialty=specialty;
    if(type&&Object.values(CommunityPostType).includes(type))where.type=type;
    if(knowledge)where.knowledgeStatus={in:[CommunityKnowledgeStatus.CONFIRMED,CommunityKnowledgeStatus.VERIFIED]};
    if(q)where.OR=[{content:{contains:q,mode:'insensitive'}},{partReference:{contains:q,mode:'insensitive'}},{partName:{contains:q,mode:'insensitive'}},{solution:{contains:q,mode:'insensitive'}},{deviceModel:{name:{contains:q,mode:'insensitive'}}},{deviceModel:{brand:{name:{contains:q,mode:'insensitive'}}}}];
    const rows=await prisma.communityPost.findMany({where,include:{user:{select:{id:true,fullName:true,role:true}},shop:{select:{id:true,name:true,region:true}},deviceModel:{include:{brand:true}},replies:{orderBy:{createdAt:'asc'},take:8,include:{user:{select:{fullName:true,role:true}},shop:{select:{name:true,region:true}}}},votes:{where:{userId:s.id},select:{type:true}}},orderBy:{createdAt:'desc'},take:120});
    return ok({region:shop?.region||'',specialties:allowedSpecialties,rows});
  }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
  try{
    const s=await requireSession();const b=await req.json();
    const content=String(b.content||'').trim();if(!content)return bad('Message requis');if(content.length>5000)return bad('Message trop long');const imageDataUrl=b.imageDataUrl?String(b.imageDataUrl):'';if(imageDataUrl&&(!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(imageDataUrl)||imageDataUrl.length>2_900_000))return bad('Image invalide ou trop lourde');
    const shop=await prisma.shop.findUnique({where:{id:s.shopId},select:{region:true}});if(!shop)return bad('Boutique introuvable',404);
    const scope=Object.values(CommunityScope).includes(b.scope)?b.scope:CommunityScope.GLOBAL;
    const type=Object.values(CommunityPostType).includes(b.type)?b.type:CommunityPostType.CHAT;
    const replyToId=b.replyToId?String(b.replyToId):null;
    let region:string|null=null,specialty:string|null=null;
    if(replyToId){const parent=await prisma.communityPost.findUnique({where:{id:replyToId}});if(!parent)return bad('Discussion introuvable',404);region=parent.region;specialty=parent.specialty;}
    else{if(scope===CommunityScope.REGION)region=shop.region;if(scope===CommunityScope.SPECIALTY){specialty=String(b.specialty||'Général').trim();if(!allowedSpecialties.includes(specialty))specialty='Général';}}
    const isKnowledge=([CommunityPostType.FAULT,CommunityPostType.SOLUTION,CommunityPostType.COMPATIBILITY] as CommunityPostType[]).includes(type);
    if(type===CommunityPostType.COMPATIBILITY&&(!b.deviceModelId||!String(b.partReference||'').trim()||!String(b.partName||'').trim()))return bad('Modèle, référence et nom de pièce requis pour une compatibilité');
    const row=await prisma.communityPost.create({data:{shopId:s.shopId,userId:s.id,scope,region,specialty,type,content,deviceModelId:b.deviceModelId||null,partReference:b.partReference?String(b.partReference).trim().toUpperCase():null,partName:b.partName?String(b.partName).trim():null,solution:b.solution?String(b.solution).trim():null,imageDataUrl:imageDataUrl||null,replyToId,knowledgeStatus:replyToId?CommunityKnowledgeStatus.DISCUSSION:(isKnowledge?CommunityKnowledgeStatus.PROPOSED:CommunityKnowledgeStatus.DISCUSSION),confirmCount:isKnowledge&&!replyToId?1:0}});
    if(isKnowledge&&!replyToId)await prisma.communityVote.create({data:{postId:row.id,userId:s.id,shopId:s.shopId,type:CommunityVoteType.CONFIRM}}).catch(()=>{});
    return ok(row,{status:201});
  }catch(e:any){return bad(e.message,e.status||500)}
}
