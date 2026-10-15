import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ChangePinForm } from '@/components/change-pin-form';

export default async function ChangePinPage(){
  let s!: Awaited<ReturnType<typeof requireSession>>; try{s=await requireSession()}catch{redirect('/login')}
  const u=await prisma.user.findFirst({where:{id:s.id,shopId:s.shopId},select:{mustChangePin:true,fullName:true}});
  if(!u)redirect('/login');
  return <ChangePinForm required={!!u.mustChangePin} fullName={u.fullName}/>;
}
