export type WarehouseQty={quantity:number;reserved?:number};

export function stockDistribution(globalStock:number,rows:WarehouseQty[]){
 const allocated=rows.reduce((a,x)=>a+Math.max(0,Number(x.quantity||0)),0);
 const unallocated=Math.max(0,Number(globalStock||0)-allocated);
 const warehouseAvailable=rows.reduce((a,x)=>a+Math.max(0,Number(x.quantity||0)-Number(x.reserved||0)),0);
 return {allocated,unallocated,warehouseAvailable};
}

export function marketplaceAllocation(globalStock:number,rows:WarehouseQty[],quantity:number){
 const q=Math.max(0,Math.trunc(quantity));
 const d=stockDistribution(globalStock,rows);
 return {fromUnallocated:Math.min(q,d.unallocated),fromWarehouses:Math.max(0,q-d.unallocated),...d};
}

export function warehouseAdjustmentGlobalDelta(globalStock:number,allocatedBefore:number,currentWarehouse:number,nextWarehouse:number){
 const diff=Math.trunc(nextWarehouse)-Math.trunc(currentWarehouse);
 const unallocated=Math.max(0,Math.trunc(globalStock)-Math.trunc(allocatedBefore));
 const globalDelta=diff>0?Math.max(0,diff-unallocated):diff;
 return {diff,unallocated,globalDelta,nextGlobal:Math.max(0,Math.trunc(globalStock)+globalDelta)};
}

export function remainingReturnQuantity(sold:number,alreadyReturned:number){
 return Math.max(0,Math.trunc(sold)-Math.max(0,Math.trunc(alreadyReturned)));
}

export function netReceivable(total:number,paid:number,creditTotal=0,refundTotal=0){
 const netTotal=Math.max(0,Number(total)-Math.max(0,Number(creditTotal)));
 const netPaid=Math.max(0,Number(paid)-Math.max(0,Number(refundTotal)));
 return {netTotal,netPaid,due:Math.max(0,netTotal-netPaid)};
}
