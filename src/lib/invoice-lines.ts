const m=(v:unknown)=>Math.round(Number(v||0)*1000)/1000;

/** Ventile une vente en HT / TVA par ligne. Les ventes caisse sont en TTC (tax = 0), celles avec TVA ajoutée sont en HT. */
export function invoiceLines(sale:{subtotal:unknown;discount:unknown;tax:unknown},items:{name:string;sku:string|null;quantity:number;unitPrice:unknown;productId:string|null}[],rates:Record<string,number>){
 const subtotal=Number(sale.subtotal||0),discount=Math.max(0,Number(sale.discount||0));
 const ratio=subtotal>0?Math.max(0,(subtotal-discount)/subtotal):1;
 const pricesIncludeTax=Number(sale.tax||0)<=0;
 const lines=items.map(i=>{
  const rate=Math.max(0,Number(rates[i.productId||'']||0));
  const net=Number(i.unitPrice)*i.quantity*ratio;
  const ht=pricesIncludeTax?net/(1+rate/100):net;
  const tva=pricesIncludeTax?net-ht:ht*rate/100;
  return {name:i.name,sku:i.sku,quantity:i.quantity,taxRate:rate,unitHT:m(ht/Math.max(1,i.quantity)),totalHT:m(ht),tva:m(tva)};
 });
 const taxes=new Map<number,{rate:number;base:number;amount:number}>();
 for(const l of lines){const t=taxes.get(l.taxRate)||{rate:l.taxRate,base:0,amount:0};t.base=m(t.base+l.totalHT);t.amount=m(t.amount+l.tva);taxes.set(l.taxRate,t)}
 const ht=m(lines.reduce((a,l)=>a+l.totalHT,0)),tva=m(lines.reduce((a,l)=>a+l.tva,0));
 return {lines,taxes:[...taxes.values()].sort((a,b)=>a.rate-b.rate),ht,tva,ttc:m(ht+tva)};
}

