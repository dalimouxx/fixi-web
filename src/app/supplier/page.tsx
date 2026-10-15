import { redirect } from 'next/navigation';import { getSupplierSession } from '@/lib/supplier-auth';import { SupplierDashboard } from '@/components/supplier-dashboard';
export default async function SupplierPage(){const s=await getSupplierSession();if(!s)redirect('/supplier/login');return <SupplierDashboard session={s}/>}
