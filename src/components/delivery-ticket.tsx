import {PrintButton} from './print-button';
import {money,dateTime} from '@/lib/format';

export function DeliveryTicket({order,qr,viewer}:{order:any;qr:string;viewer:'supplier'|'driver'|'shop'}){
 const qty=(order.items||[]).reduce((a:number,x:any)=>a+Number(x.quantity||0),0);
 return <main className="delivery-ticket-page">
  <div className="delivery-ticket-toolbar no-print"><div><b>Bon de livraison</b><span>{order.reference}</span></div><PrintButton/></div>
  <article className="delivery-ticket">
   <header>
    <div className="delivery-ticket-brand"><i>F</i><span><b>FIXI · BON DE LIVRAISON</b><small>Traçabilité fournisseur → livreur → atelier</small></span></div>
    <div className="delivery-ticket-ref"><span>Commande</span><b>{order.reference}</b><small>{dateTime(order.confirmedAt||order.createdAt)}</small></div>
   </header>
   <section className="delivery-ticket-parties">
    <div><span>FOURNISSEUR</span><b>{order.company.name}</b><small>{order.company.phone||'Téléphone —'}</small><small>{order.company.address||order.company.region||'Adresse —'}</small></div>
    <div><span>ATELIER DESTINATAIRE</span><b>{order.shop.name}</b><small>{order.shop.phone||'Téléphone —'}</small><small>{order.deliveryAddress||order.shop.address||order.shop.region||'Adresse —'}</small></div>
    <div><span>LIVREUR</span><b>{order.delivery?.driverName||'À affecter / à accepter'}</b><small>{order.delivery?.driverPhone||'Téléphone —'}</small><small>{order.delivery?.acceptedAt?'Accepté '+dateTime(order.delivery.acceptedAt):'En attente de prise en charge'}</small></div>
   </section>
   <section className="delivery-ticket-lines">
    <div className="delivery-ticket-line head"><span>Produit / Référence</span><b>Qté</b><b>Prix U.</b><b>Total</b></div>
    {(order.items||[]).map((x:any)=><div className="delivery-ticket-line" key={x.id}><span><strong>{x.product.name}</strong><small>{x.product.sku||'—'}{x.product.qualityGrade?' · '+x.product.qualityGrade:''}</small></span><b>{x.quantity}</b><b>{money(x.unitPrice)}</b><b>{money(Number(x.unitPrice)*Number(x.quantity))}</b></div>)}
   </section>
   <section className="delivery-ticket-summary">
    <div><span>Références</span><b>{order.items?.length||0}</b></div><div><span>Quantité totale</span><b>{qty}</b></div><div><span>Total commande</span><b>{money(order.total)}</b></div><div><span>Ancien dû client</span><b>{money(order.customerDue||0)}</b></div>
   </section>
   <section className="delivery-ticket-proof">
    <div className="delivery-ticket-qr"><img src={qr} alt="QR d’identification du bon de livraison"/><span><b>QR DU BON LOGISTIQUE</b><small>Ce QR identifie uniquement la commande. Il ne valide pas la remise. Le code sécurisé est affiché dans Fixi Atelier.</small></span></div>
    <div className="delivery-ticket-code"><span>VALIDATION SÉCURISÉE</span><b style={{fontSize:15}}>Code fourni par la boutique</b><small>Le livreur demande le QR/code secret sur l’application Atelier au moment de remettre physiquement les produits.</small></div>
   </section>
   <section className="delivery-ticket-chain">
    <div><span>1 · FOURNISSEUR</span><b>Commande contrôlée et remise</b><small>Nom / signature : ____________________</small><small>Date/heure : ____________________</small></div>
    <div><span>2 · LIVREUR</span><b>Produits pris en charge</b><small>Nom / signature : ____________________</small><small>Date/heure : ____________________</small></div>
    <div><span>3 · ATELIER</span><b>Produits reçus et contrôlés</b><small>Nom / signature : ____________________</small><small>Date/heure : ____________________</small></div>
   </section>
   <footer>
    <b>Preuve Fixi</b><span>Le QR/code confirme la réception numérique. Les paiements, dus, retours et incidents restent liés à cette commande dans les trois applications.</span><code>{order.id}</code>
   </footer>
  </article>
  <div className="delivery-ticket-viewer no-print">Vue : {viewer==='supplier'?'Fournisseur':viewer==='driver'?'Livreur':'Atelier'}</div>
 </main>
}
