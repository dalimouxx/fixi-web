import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWidgetPreferences,toggleWidgetHidden,moveWidget} from '../src/lib/widget-preferences';

const items=['orders','stock','finance'] as const;

test('unknown/duplicate widget preference IDs never leak into dashboard',()=>{
  assert.deepEqual(normalizeWidgetPreferences(items,{
    order:['unknown','stock','stock','orders'],hidden:['removed','stock','stock'],
  }),{order:['stock','orders','finance'],hidden:['stock']});
});
test('new widget is appended to the saved order automatically',()=>{
  assert.deepEqual(normalizeWidgetPreferences(items,{order:['finance','orders'],hidden:[]}),
    {order:['finance','orders','stock'],hidden:[]});
});
test('cannot hide all cards, even with malformed saved state',()=>{
  const s=normalizeWidgetPreferences(items,{order:[...items],hidden:[...items]});
  assert.equal(s.order.filter(id=>!s.hidden.includes(id)).length,1);
  let cur=normalizeWidgetPreferences(items,null);
  cur=toggleWidgetHidden(items,cur,'orders');
  cur=toggleWidgetHidden(items,cur,'stock');
  cur=toggleWidgetHidden(items,cur,'finance');
  assert.equal(cur.hidden.length,2);
});
test('toggle hidden and show again retains widget position',()=>{
  let state=normalizeWidgetPreferences(items,null);
  state=toggleWidgetHidden(items,state,'stock');
  assert.deepEqual(state.hidden,['stock']);
  state=toggleWidgetHidden(items,state,'stock');
  assert.deepEqual(state.hidden,[]);
  assert.deepEqual(state.order,[...items]);
});
test('widget movement stays in bounds',()=>{
  const start=normalizeWidgetPreferences(items,null);
  assert.deepEqual(moveWidget(items,start,'stock',-1).order,['stock','orders','finance']);
  assert.deepEqual(moveWidget(items,start,'stock',1).order,['orders','finance','stock']);
  assert.deepEqual(moveWidget(items,start,'orders',-1).order,[...items]);
  assert.deepEqual(moveWidget(items,start,'missing',1).order,[...items]);
});
test('preferences are area-specific by caller and do not hold business data',()=>{
  const pref=normalizeWidgetPreferences(items,{order:['stock','finance','orders'],hidden:['finance'],revenue:99999});
  assert.deepEqual(Object.keys(pref).sort(),['hidden','order']);
});
