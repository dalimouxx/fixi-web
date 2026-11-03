import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { MessageCircle, PackageOpen, ShieldCheck, Box } from 'lucide-react';
import { waLink } from '@/lib/whatsapp-link';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };

async function company(slug: string) {
  return prisma.supplierCompany.findUnique({ where: { slug }, select: { id: true, name: true, region: true, phone: true, publicCatalog: true, verified: true } }).catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await company((await params).slug);
  return { title: c ? `Catalogue ${c.name}` : 'Catalogue', robots: { index: false, follow: false }, openGraph: { title: c ? `Catalogue pièces · ${c.name}` : 'Catalogue', images: ['/icons/supplier-512.png'] } };
}

// Catalogue public d'un fournisseur (s'il l'a activé), envoyé par WhatsApp aux réparateurs.
export default async function Catalogue({ params, searchParams }: Props) {
  const { slug } = await params; const q = String((await searchParams).q || '').trim().slice(0, 60);
  const c = await company(slug);
  if (!c || !c.publicCatalog) notFound();
  const products = await prisma.supplierProduct.findMany({ where: { companyId: c.id, active: true, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] } : {}) }, select: { id: true, name: true, sku: true, imageUrl: true, price: true, stock: true, reservedStock: true }, orderBy: { name: 'asc' }, take: 300 });
  return <main className="fx-catalog-page">
    <header className="fx-catalog-head">
      <img src="/icons/supplier-192.png" alt="" width={52} height={52} />
      <div><h1>{c.name}</h1><p>{c.region || 'Fournisseur de pièces'}{c.verified ? ' · fournisseur vérifié' : ''}</p></div>
    </header>
    <form className="fx-searchbar" action=""><input name="q" defaultValue={q} placeholder="Écran A54, batterie, référence…" aria-label="Rechercher une pièce" /></form>
    <div className="fx-catalog-cta">
      <a className="btn btn-primary" href={`/app/suppliers?q=${encodeURIComponent(q)}`}><PackageOpen size={18} /> Commander sur Fixi</a>
      {c.phone && <a className="btn btn-ghost" href={waLink(c.phone, `Bonjour ${c.name}, je viens de votre catalogue Fixi.`)} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>}
    </div>
    <div className="market-grid fx-catalog">
      {products.map(p => { const avail = Math.max(0, p.stock - p.reservedStock); return <article className="market-product" key={p.id}>
        <div className="market-image">{p.imageUrl ? <img src={p.imageUrl} alt="" /> : <Box />}{c.verified && <span><ShieldCheck /> Vérifié</span>}</div>
        <h3>{p.name}</h3><p>{p.sku}</p>
        <footer><strong>{Number(p.price).toFixed(3)} DT</strong><small className={avail ? 'fx-in-stock' : 'fx-out-stock'}>{avail ? 'En stock' : 'Épuisé'}</small></footer>
      </article>; })}
      {!products.length && <div className="fx-empty"><b>Aucune pièce trouvée</b><span>Essayez un autre mot.</span></div>}
    </div>
    <footer className="fx-invite-foot">Commandez en un toucher avec Fixi : suivi de livraison et factures automatiques. Pas encore de compte ? Demandez-le à {c.name}.</footer>
  </main>;
}
