import { PaymentKind, RepairStatus } from '@prisma/client';

export function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
export function smartPrice(cost:number,targetMarginPercent=30,labor=30){
  const c=Math.max(0,Number(cost)||0), m=clamp(Number(targetMarginPercent)||30,0,85), l=Math.max(0,Number(labor)||0);
  const base=c+l; const price=m>=85?base*2:base/(1-m/100); const rounded=Math.ceil(price/5)*5;
  return {cost:c,labor:l,targetMargin:m,recommendedPrice:rounded,estimatedProfit:rounded-base,actualMargin:rounded?((rounded-base)/rounded)*100:0};
}
export function netPayments(rows:{kind:PaymentKind|string;amount:any}[]){return rows.reduce((a,p)=>a+(p.kind===PaymentKind.REFUND||p.kind==='REFUND'?-Number(p.amount):Number(p.amount)),0)}
export function businessScore(input:{revenueChange:number;avgRating:number;overdueReady:number;lowStock:number;openWarranty:number;cashDiffCount:number}){
  const profitability=clamp(78+input.revenueChange*.55,20,100);
  const satisfaction=clamp((input.avgRating||4)*20,20,100);
  const speed=clamp(100-input.overdueReady*4,25,100);
  const stock=clamp(100-input.lowStock*5,25,100);
  const quality=clamp(100-input.openWarranty*4-input.cashDiffCount*5,25,100);
  const overall=Math.round(profitability*.25+satisfaction*.25+speed*.2+stock*.15+quality*.15);
  return {overall,profitability:Math.round(profitability),satisfaction:Math.round(satisfaction),speed:Math.round(speed),stock:Math.round(stock),quality:Math.round(quality)};
}
export const defaultQualityChecks=[
  ['screen','Écran / affichage'],['touch','Tactile / clavier'],['camera','Caméra'],['microphone','Microphone'],['speaker','Haut-parleur'],['charging','Charge'],['network','Réseau / SIM'],['wifi','Wi‑Fi / Bluetooth'],['biometric','Face ID / empreinte'],['cleaning','Nettoyage final']
] as const;
export function statusWeight(s:RepairStatus|string){return ({RECEIVED:1,DIAGNOSIS:2,WAITING_PART:3,IN_REPAIR:4,READY:5,DELIVERED:6,CANCELLED:0} as Record<string,number>)[s]||0}
