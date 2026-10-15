export function plain<T>(value:T):T { return JSON.parse(JSON.stringify(value,(_,v)=> typeof v==='object' && v && v.constructor?.name==='Decimal' ? Number(v) : v)); }
