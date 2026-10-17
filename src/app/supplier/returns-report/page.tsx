import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getSupplierSession} from '@/lib/supplier-auth';
import {prisma} from '@/lib/prisma';
import {SupplierPrintButton} from '@/components/supplier-print-button';
import {money} from '@/lib/format';

export default async function ReturnsReport(){
 const s=await getSupplierSession();if(!s)redirect('/supplier/login');
 const company=await prisma.supplierCompany.findUnique({where:{id:s.companyId}});
 const rows=await prisma.supplierReturn.findMany({where:{companyId:s.companyId,status:'COMPLETED'},orderBy:{createdAt:'desc'},take:500});
 const items=rows.length?await prisma.supplierReturnItem.findMany({where:{returnId:{in:rows.map(x=>x.id)}}}):[];
 const damaged=items.filter(x=>['DAMAGED','ENDOMMAGE','DEFECTUEUX'].includes(String(x.condition||'').toUpperCase())||!x.restock);
 return <div className="supplier-print-page"><header><div><b>{company?.name||'Fixi Supplier'}</b><span>Registre retours & produits endommagés</span></div><div className="no-print"><Link className="btn btn-soft" href="/supplier">Retour</Link><SupplierPrintButton label="Imprimer / Enregistrer PDF"/></div></header>
 <section className="supplier-print-summary"><div><span>Retours enregistrés</span><b>{rows.length}</b></div><div><span>Articles retournés</span><b>{items.reduce((a,x)=>a+x.quantity,0)}</b></div><div><span>Endommagés / hors stock</span><b>{damaged.reduce((a,x)=>a+x.quantity,0)}</b></div><div><span>Valeur retours</span><b>{money(rows.reduce((a,x)=>a+Number(x.total),0))}</b></div></section>
 <table><thead><tr><th>Date</th><th>Retour</th><th>Source</th><th>Produit</th><th>Qté</th><th>État</th><th>Remis stock</th><th>Motif</th></tr></thead><tbody>{rows.flatMap(r=>items.filter(i=>i.returnId===r.id).map(i=><tr key={i.id}><td>{new Date(r.createdAt).toLocaleDateString('fr-TN')}</td><td>{r.reference}</td><td>{r.sourceRef||r.type}</td><td>{i.name}<small>{i.sku||''}</small></td><td>{i.quantity}</td><td>{i.condition||'—'}</td><td>{i.restock?'Oui':'Non'}</td><td>{i.reason||r.note||'—'}</td></tr>))}</tbody></table>
 <footer>Généré par Fixi Supplier · Registre retours</footer></div>
}
