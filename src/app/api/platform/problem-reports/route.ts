import {prisma} from '@/lib/prisma';
import {requirePlatformSession} from '@/lib/platform-auth';
import {bad,ok} from '@/lib/http';

export async function GET(req:Request){
 try{
  await requirePlatformSession();
  const u=new URL(req.url),status=u.searchParams.get('status')==='RESOLVED'?'RESOLVED':'OPEN',id=u.searchParams.get('id');
  if(id){const r=await prisma.problemReport.findUnique({where:{id}});return r?ok(r):bad('Introuvable',404)}
  const rows=await prisma.problemReport.findMany({where:{status},orderBy:{createdAt:'desc'},take:200,
   select:{id:true,source:true,shopId:true,companyId:true,reporter:true,contact:true,message:true,page:true,userAgent:true,appVersion:true,lastError:true,status:true,createdAt:true,resolvedAt:true,screenshot:false}});
  const withShot=await prisma.problemReport.findMany({where:{id:{in:rows.map(r=>r.id)},screenshot:{not:null}},select:{id:true}});
  const shots=new Set(withShot.map(x=>x.id));
  const open=await prisma.problemReport.count({where:{status:'OPEN'}});
  return ok({open,rows:rows.map(r=>({...r,hasScreenshot:shots.has(r.id)}))});
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function PATCH(req:Request){
 try{
  await requirePlatformSession();
  const b=await req.json();const id=String(b.id||'');const resolved=b.status!=='OPEN';
  const r=await prisma.problemReport.update({where:{id},data:{status:resolved?'RESOLVED':'OPEN',resolvedAt:resolved?new Date():null}});
  return ok({id:r.id,status:r.status});
 }catch(e:any){return bad(e.message,e.status||500)}
}
