import {prisma} from '@/lib/prisma';
import {bad,ok} from '@/lib/http';
import {getSession} from '@/lib/auth';
import {getSupplierSession} from '@/lib/supplier-auth';
import {getDeliverySession} from '@/lib/delivery-auth';

const clip=(v:unknown,n:number)=>{const s=String(v??'').trim();return s?s.slice(0,n):null};
const MAX_SHOT=1_500_000;

/** « Signaler un problème » : atelier, fournisseur, livreur ou caisse Windows. Le message arrive dans l'admin Fixi. */
export async function POST(req:Request){
 try{
  const b=await req.json().catch(()=>({}));
  const message=clip(b.message,2000);if(!message||message.length<5)return bad('Décrivez le problème en quelques mots',400);
  const [user,supplier,driver]=await Promise.all([getSession(),getSupplierSession(),getDeliverySession()]);
  let source='',shopId:string|null=null,companyId:string|null=null,reporter:string|null=null;
  const windows=req.headers.get('x-fixi-client')==='windows';
  const hint=String(b.space||'');
  const pick=hint==='atelier'&&user?'u':hint==='delivery'&&driver?'d':(hint==='supplier'||windows)&&supplier?'s':supplier?'s':user?'u':driver?'d':'';
  if(pick==='s'&&supplier){source=windows?'WINDOWS':'SUPPLIER';companyId=supplier.companyId;reporter=`${supplier.fullName} · ${supplier.companyName}`}
  else if(pick==='u'&&user){source='ATELIER';shopId=user.shopId||null;reporter=`${user.fullName} · ${user.shopName}`}
  else if(pick==='d'&&driver){source='DRIVER';companyId=driver.companyId||null;reporter=`${driver.fullName} · ${driver.companyName}`}
  else return bad('Connectez-vous pour signaler un problème',401);
  const since=new Date(Date.now()-3600_000);
  const recent=await prisma.problemReport.count({where:{createdAt:{gte:since},...(shopId?{shopId}:companyId?{companyId}:{reporter})}});
  if(recent>=10)return bad('Trop de signalements en une heure : réessayez plus tard',429);
  let screenshot:string|null=null;
  if(typeof b.screenshot==='string'&&b.screenshot){
   if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.screenshot)||b.screenshot.length>MAX_SHOT)return bad('Capture invalide ou trop lourde (1 Mo max)',400);
   screenshot=b.screenshot;
  }
  const row=await prisma.problemReport.create({data:{source,shopId,companyId,reporter,contact:clip(b.contact,80),message,page:clip(b.page,300),
   userAgent:clip(req.headers.get('user-agent'),300),appVersion:clip(b.appVersion,40),lastError:clip(b.lastError,2000),screenshot}});
  return ok({id:row.id},{status:201});
 }catch(e:any){return bad(e.message||'Envoi impossible',e.status||500)}
}
