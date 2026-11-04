import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { LEGAL_UPDATED, LEGAL_VALIDATED, legalDocs, type LegalDoc } from '@/lib/legal';
import '@/app/legal.css';

export async function legalContext() {
  const s = await prisma.platformSettings.findUnique({ where: { id: 'platform' }, select: { appName: true, supportEmail: true, supportPhone: true } }).catch(() => null);
  return { app: s?.appName || 'Fixi', email: s?.supportEmail || '', phone: s?.supportPhone || '' };
}

export async function LegalPage({ slug }: { slug: LegalDoc['slug'] }) {
  const docs = legalDocs(await legalContext());
  const doc = docs.find(d => d.slug === slug)!;
  return <main className="lg">
    <nav className="lg-nav"><Link href="/"><ArrowLeft size={16} /> Accueil</Link><div>{docs.map(d => <Link key={d.slug} href={'/' + d.slug} aria-current={d.slug === slug ? 'page' : undefined}>{d.title}</Link>)}</div></nav>
    <article className="lg-doc">
      <div className="lg-kicker"><FileText size={14} /> Mis à jour le {LEGAL_UPDATED}</div>
      <h1>{doc.title}</h1>
      {!LEGAL_VALIDATED && <p className="lg-draft">Version provisoire, en cours de validation.</p>}
      <p className="lg-intro">{doc.intro}</p>
      {doc.sections.map(s => <section key={s.h}><h2>{s.h}</h2>{s.p.map((p, i) => <p key={i}>{p}</p>)}</section>)}
    </article>
  </main>;
}
