import {destroyDeliverySession} from '@/lib/delivery-auth';import {ok} from '@/lib/http';
export async function POST(){await destroyDeliverySession();return ok({ok:true})}
