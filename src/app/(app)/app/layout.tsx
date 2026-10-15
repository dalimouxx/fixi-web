import { redirect } from 'next/navigation';
import { requireSession, roleLabels } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export default async function Layout({children}:{children:React.ReactNode}) {
  let s!: Awaited<ReturnType<typeof requireSession>>;
  try { s=await requireSession(); } catch { redirect('/login'); }
  const [shop,user]=await Promise.all([
    prisma.shop.findUnique({where:{id:s.shopId},select:{setupCompletedAt:true}}),
    prisma.user.findUnique({where:{id:s.id},select:{mustChangePin:true}}),
  ]);
  if(user?.mustChangePin) redirect('/change-pin');
  if(!shop?.setupCompletedAt && s.role===UserRole.ADMIN) redirect('/onboarding');
  return <AppShell user={{...s,roleLabel:roleLabels[s.role]}}>{children}</AppShell>;
}
