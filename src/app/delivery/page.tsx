import {redirect} from 'next/navigation';import {getDeliverySession} from '@/lib/delivery-auth';import {DriverApp} from '@/components/driver-app';
export default async function DeliveryPage(){const s=await getDeliverySession();if(!s)redirect('/delivery/login');return <DriverApp session={s}/>}
