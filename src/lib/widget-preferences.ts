/**
 * Fixi Smart Widgets – user-specific UI preferences only.
 * Never stores or modifies financial/operational records.
 */
export type WidgetPreference={order:string[];hidden:string[]};

function uniqueKnown(ids:readonly string[],known:readonly string[]):string[]{
  const allowed=new Set(known),seen=new Set<string>();
  return ids.filter(id=>{
    if(!allowed.has(id)||seen.has(id))return false;
    seen.add(id);return true;
  });
}

export function normalizeWidgetPreferences(known:readonly string[],raw:unknown):WidgetPreference{
  const ids=uniqueKnown(known,known);
  const data=raw&&typeof raw==='object'?raw as Partial<WidgetPreference>:{};
  const order=Array.isArray(data.order)?
    [...uniqueKnown(data.order.filter((x):x is string=>typeof x==='string'),ids),
      ...ids.filter(id=>!data.order?.includes(id))]:ids;
  const hidden=Array.isArray(data.hidden)?
    uniqueKnown(data.hidden.filter((x):x is string=>typeof x==='string'),ids):[];
  // Always leave at least one live widget visible.
  if(ids.length&&hidden.length>=ids.length)hidden.pop();
  return {order,hidden};
}

export function toggleWidgetHidden(known:readonly string[],previous:WidgetPreference,id:string):WidgetPreference{
  const state=normalizeWidgetPreferences(known,previous);
  if(!state.order.includes(id))return state;
  const hidden=state.hidden.includes(id)?state.hidden.filter(x=>x!==id):[...state.hidden,id];
  return normalizeWidgetPreferences(known,{order:state.order,hidden});
}

export function moveWidget(known:readonly string[],previous:WidgetPreference,id:string,direction:-1|1):WidgetPreference{
  const state=normalizeWidgetPreferences(known,previous);
  const index=state.order.indexOf(id),target=index+direction;
  if(index<0||target<0||target>=state.order.length)return state;
  const order=[...state.order];[order[index],order[target]]=[order[target],order[index]];
  return {order,hidden:state.hidden};
}
