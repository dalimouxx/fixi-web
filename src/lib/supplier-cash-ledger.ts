/**
 * Cash register ledger is based only on cash-session-linked movements, not
 * card/bank transfers or gross invoiced sales.
 * Monetary arithmetic is rounded to Tunisian millimes.
 */
type Payment={amount:unknown;kind:string;method:string;reference?:string|null;createdAt?:Date|string;id?:string};
type Expense={amount:unknown;method:string;label?:string;expenseDate?:Date|string;id?:string};

export const millimes=(n:unknown)=>{
  const value=Number(n??0);
  if(!Number.isFinite(value))throw new Error('Montant invalide');
  return Math.round(value*1000);
};
export const dinars=(m:number)=>Math.round(m)/1000;
export function supplierCashSummary(opening:unknown,payments:Payment[],expenses:Expense[]){
  let incoming=0,outgoing=0,expenseTotal=0;
  const byMethod=new Map<string,{incoming:number;outgoing:number}>();
  for(const payment of payments){
    const amount=millimes(payment.amount);
    if(amount<0)throw new Error('Mouvement négatif');
    const method=String(payment.method||'CASH');
    const row=byMethod.get(method)||{incoming:0,outgoing:0};
    if(payment.kind==='IN'){incoming+=amount;row.incoming+=amount;}
    else if(payment.kind==='OUT'){outgoing+=amount;row.outgoing+=amount;}
    else continue;
    byMethod.set(method,row);
  }
  for(const expense of expenses){
    const amount=millimes(expense.amount);
    if(amount<0)throw new Error('Dépense négative');
    expenseTotal+=amount;
  }
  return {
    opening:dinars(millimes(opening)),
    incoming:dinars(incoming),
    outgoing:dinars(outgoing),
    expenses:dinars(expenseTotal),
    expected:dinars(millimes(opening)+incoming-outgoing-expenseTotal),
    payments:payments.length,
    expenseCount:expenses.length,
    byMethod:[...byMethod].map(([method,v])=>({
      method,incoming:dinars(v.incoming),outgoing:dinars(v.outgoing)
    })),
  };
}
