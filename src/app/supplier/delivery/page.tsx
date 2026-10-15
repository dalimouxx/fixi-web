import {redirect} from 'next/navigation';
import {getSupplierSession} from '@/lib/supplier-auth';
import {SupplierDeliveryApp} from '@/components/supplier-delivery-app';
export default async function SupplierDeliveryPage(){const s=await getSupplierSession();if(!s)redirect('/supplier/login');return <SupplierDeliveryApp session={s}/>}
