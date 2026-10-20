import {money,dateTime} from '@/lib/format';

type InvoiceReceiptProps={
  company:any;customer:any;sale:any;
  items:any[];payments:any[];
};

/** Thermal 80-mm ticket, printed directly from a stored ERP sale. */
export function SupplierThermalReceipt({company,customer,sale,items,payments}:InvoiceReceiptProps){
  const due=Math.max(0,Number(sale.total)-Number(sale.paid));
  return <article className="fixi-thermal-ticket" aria-label="Ticket de caisse">
    <header>
      {company?.logoUrl&&<img src={company.logoUrl} alt="" className="fixi-ticket-logo"/>}
      <h1>{company?.name||'FIXI SUPPLIER'}</h1>
      {company?.legalName&&company.legalName!==company.name&&<div>{company.legalName}</div>}
      {company?.address&&<div>{company.address}</div>}
      {company?.region&&<div>{company.region}</div>}
      {company?.taxId&&<div>MF : {company.taxId}</div>}
      {company?.tradeRegister&&<div>RC / RNE : {company.tradeRegister}</div>}
      {company?.phone&&<div>Tél. {company.phone}</div>}
    </header>
    <div className="fixi-thermal-separator"/>
    <div className="fixi-thermal-line"><span>TICKET / VENTE</span><strong>{sale.reference}</strong></div>
    <div className="fixi-thermal-line"><span>Date</span><span>{dateTime(sale.createdAt)}</span></div>
    <div className="fixi-thermal-line"><span>Client</span><span>{customer?.name||'Client comptoir'}</span></div>
    <div className="fixi-thermal-separator"/>
    <div className="fixi-thermal-head"><span>Désignation / Qté × PU</span><b>Montant</b></div>
    {items.map(x=><div className="fixi-thermal-item" key={x.id}>
      <strong>{x.name}</strong>
      <div className="fixi-thermal-line"><span>{x.sku&&x.sku+' · '}{x.quantity} × {money(x.unitPrice)}</span>
        <b>{money(Number(x.unitPrice)*Number(x.quantity)-Number(x.discount||0))}</b></div>
    </div>)}
    <div className="fixi-thermal-separator"/>
    <div className="fixi-thermal-line"><span>Sous-total HT / brut</span><b>{money(sale.subtotal)}</b></div>
    {Number(sale.discount)>0&&<div className="fixi-thermal-line"><span>Remise</span><b>- {money(sale.discount)}</b></div>}
    <div className="fixi-thermal-line"><span>Taxes</span><b>{money(sale.tax)}</b></div>
    <div className="fixi-thermal-line total"><span>TOTAL TTC</span><b>{money(sale.total)}</b></div>
    {payments.map(p=><div className="fixi-thermal-line" key={p.id}>
      <span>Règlement {p.method}</span><b>{money(p.amount)}</b></div>)}
    <div className="fixi-thermal-line"><span>Total payé</span><b>{money(sale.paid)}</b></div>
    <div className="fixi-thermal-line"><span>Reste dû</span><b>{money(due)}</b></div>
    <div className="fixi-thermal-separator"/>
    {company?.receiptMessage&&<p className="fixi-thermal-message">{company.receiptMessage}</p>}
    {company?.documentFooter&&<p className="fixi-thermal-message">{company.documentFooter}</p>}
    <footer><b>Merci de votre visite !</b><span>Édité avec Fixi Supplier · {sale.reference}</span></footer>
  </article>;
}
