import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await requireSession(undefined,'CONNECT');
    return ok({accessTier:session.accessTier,planName:session.planName,
      freeModules:['supplier-market','orders','delivery','supplier-debts','supplier-invoices'],
      upgradeHref:'/app/subscription'});
  } catch(e:any){return bad(e.message,e.status||500);}
}
