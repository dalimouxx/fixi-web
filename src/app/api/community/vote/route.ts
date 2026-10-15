import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { CommunityKnowledgeStatus,CommunityPostType,CommunityVoteType,CompatibilityConfidence } from '@prisma/client';

async function syncKnowledge(postId:string){
  const post=await prisma.communityPost.findUnique({where:{id:postId},include:{votes:{where:{type:CommunityVoteType.CONFIRM},select:{shopId:true}}}});if(!post)return null;
  const distinctShops=new Set(post.votes.map(v=>v.shopId)).size;const helpful=await prisma.communityVote.count({where:{postId,type:CommunityVoteType.USEFUL}});
  let status=post.knowledgeStatus;
  if(([CommunityPostType.FAULT,CommunityPostType.SOLUTION,CommunityPostType.COMPATIBILITY] as CommunityPostType[]).includes(post.type)&&distinctShops>=3&&status!==CommunityKnowledgeStatus.VERIFIED)status=CommunityKnowledgeStatus.CONFIRMED;
  await prisma.communityPost.update({where:{id:postId},data:{confirmCount:distinctShops,helpfulCount:helpful,knowledgeStatus:status}});
  if(status===CommunityKnowledgeStatus.CONFIRMED&&post.type===CommunityPostType.COMPATIBILITY&&post.deviceModelId&&post.partReference&&post.partName){
    await prisma.partCompatibility.upsert({where:{partReference_modelId:{partReference:post.partReference,modelId:post.deviceModelId}},update:{confidence:CompatibilityConfidence.COMMUNITY,note:`Confirmée par ${distinctShops} boutiques Fixi · ${post.content.slice(0,180)}`},create:{partReference:post.partReference,partName:post.partName,partType:'DISPLAY',modelId:post.deviceModelId,confidence:CompatibilityConfidence.COMMUNITY,tested:false,note:`Confirmée par ${distinctShops} boutiques Fixi · ${post.content.slice(0,180)}`}});
  }
  return {confirmCount:distinctShops,helpfulCount:helpful,knowledgeStatus:status};
}

export async function POST(req:Request){
  try{const s=await requireSession();const b=await req.json();const postId=String(b.postId||'');const type=Object.values(CommunityVoteType).includes(b.type)?b.type:null;if(!postId||!type)return bad('Vote invalide');const post=await prisma.communityPost.findUnique({where:{id:postId}});if(!post)return bad('Publication introuvable',404);
    const key={postId_userId_type:{postId,userId:s.id,type}};const existing=await prisma.communityVote.findUnique({where:key});if(existing)await prisma.communityVote.delete({where:{id:existing.id}});else await prisma.communityVote.create({data:{postId,userId:s.id,shopId:s.shopId,type}});const state=await syncKnowledge(postId);return ok({active:!existing,...state});
  }catch(e:any){return bad(e.message,e.status||500)}
}
