import {EventEmitter} from 'events';

const g=globalThis as unknown as {fixiBus?:EventEmitter};
export const fixiBus=g.fixiBus ?? new EventEmitter();
if(!g.fixiBus){
  fixiBus.setMaxListeners(250);
  g.fixiBus=fixiBus;
}

export function publish(shopId:string,type:string,payload:unknown={}){
  fixiBus.emit(`shop:${shopId}`,{type,payload,at:Date.now()});
}

export function publishSupplierAccount(accountId:string,type:string,payload:unknown={}){
  fixiBus.emit(`supplier-account:${accountId}`,{type,payload,at:Date.now()});
}

export function publishSupplierCompany(companyId:string,type:string,payload:unknown={}){
  fixiBus.emit(`supplier-company:${companyId}`,{type,payload,at:Date.now()});
}
