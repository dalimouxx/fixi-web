export function money(v:number|string|null|undefined,currency='DT'){const n=Number(v||0);return `\u200E${new Intl.NumberFormat('fr-TN',{minimumFractionDigits:0,maximumFractionDigits:3}).format(n)} ${currency}`} // \u200E : le montant reste « 180 DT » en arabe
export function dateTime(v:string|Date){return new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}
export function dateOnly(v:string|Date){return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(v))}
