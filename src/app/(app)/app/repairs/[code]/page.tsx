import { RepairDetail } from '@/components/repair-detail';import { getSession } from '@/lib/auth';
export default async function Page({params}:{params:Promise<{code:string}>}){const{code}=await params;const s=await getSession();return <RepairDetail code={code} role={s?.role||''}/> }
