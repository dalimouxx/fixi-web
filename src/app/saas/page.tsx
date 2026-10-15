import { redirect } from 'next/navigation';import { getPlatformSession } from '@/lib/platform-auth';import { SaasDashboard } from '@/components/saas-dashboard';
export default async function Saas(){const s=await getPlatformSession();if(!s)redirect('/saas/login');return <SaasDashboard admin={s}/>}
