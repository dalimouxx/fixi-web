'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {
  Activity,AlertTriangle,Banknote,CheckCircle2,MapPinned,Navigation,
  Phone,Plus,RefreshCw,Route,Truck,UserRound,X,PackageCheck
} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

type Props={orders:any[];drivers:any[];onChanged:()=>void};

export function SupplierDeliveryCenter({orders,drivers,onChanged}:Props){
  const[overview,setOverview]=useState<any>({shifts:[],latestByOrder:{},codByOrder:{},dueByShop:{},dueDetailsByShop:{},events:[],metrics:{}});const[settlements,setSettlements]=useState<any[]>([]);const[settlementAmounts,setSettlementAmounts]=useState<Record<string,string>>({});
  const[selected,setSelected]=useState('');
  const[assignments,setAssignments]=useState<Record<string,string>>({});
  const[msg,setMsg]=useState('');
  const[err,setErr]=useState('');
  const[busy,setBusy]=useState('');
  const[showDriver,setShowDriver]=useState(false);
  const[driverForm,setDriverForm]=useState({fullName:'',login:'',phone:'',password:''});

  async function load(){
    const [r,s]=await Promise.all([fetch('/api/supplier/delivery/overview',{cache:'no-store'}),fetch('/api/supplier/delivery/settlements',{cache:'no-store'})]);
    const j=await r.json(),sj=await s.json();
    if(r.ok)setOverview(j);if(s.ok)setSettlements(Array.isArray(sj)?sj:[]);
  }
  useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[]);

  const ready=orders.filter(o=>o.status==='READY_FOR_DELIVERY');
  const moving=orders.filter(o=>o.status==='OUT_FOR_DELIVERY');
  const returning=orders.filter(o=>o.status==='RETURNING');
  const returned=orders.filter(o=>['RETURNING','RETURNED'].includes(o.status));
  const todayDone=orders.filter(o=>o.status==='DELIVERED'&&new Date(o.delivery?.deliveredAt||o.updatedAt).toDateString()===new Date().toDateString());
  const activeDrivers=drivers.filter(d=>d.isActive);
  const selectedOrder=orders.find(o=>o.id===selected)||moving[0]||returning[0]||ready[0]||returned[0]||null;
  const loc=selectedOrder?overview.latestByOrder?.[selectedOrder.id]:null;
  const lastEvents=useMemo(
    ()=>overview.events?.filter((e:any)=>!String(e.orderId).startsWith('SHIFT:')).slice(0,15)||[],
    [overview.events]
  );

  async function assign(order:any){
    const id=assignments[order.id]||order.delivery?.driverAccountId||'';
    if(!id){setErr('Choisissez un livreur.');return}
    setBusy(order.id);setErr('');
    try{
      await api('/api/supplier/delivery/assign',{method:'POST',body:JSON.stringify({orderId:order.id,driverAccountId:id})});
      setMsg('Livraison affectée.');onChanged();await load();
    }catch(e:any){setErr(e.message)}
    finally{setBusy('')}
  }

  async function resolveReturn(order:any,action:'RESTOCK'|'DAMAGED'|'REDELIVER'){const note=action==='DAMAGED'?prompt('Note / motif dommage')||'Endommagé':action==='RESTOCK'?'Retour contrôlé et remis en stock':'Relivraison demandée';setBusy(order.id);setErr('');try{await api('/api/supplier/delivery/returns',{method:'POST',body:JSON.stringify({orderId:order.id,action,note})});setMsg(action==='RESTOCK'?'Retour remis en stock.':action==='DAMAGED'?'Retour classé endommagé.':'Commande remise dans le pool livreurs.');onChanged();await load()}catch(e:any){setErr(e.message)}finally{setBusy('')}}

  async function confirmSettlement(x:any){const raw=settlementAmounts[x.id]??String(Number(x.declaredRemit??x.expectedCod??0));const actual=Number(raw);if(!(actual>=0)){setErr('Montant remis invalide.');return}setBusy('SETTLE:'+x.id);setErr('');try{await api('/api/supplier/delivery/settlements',{method:'POST',body:JSON.stringify({shiftId:x.id,actualAmount:actual})});setMsg('Remise livreur confirmée en caisse.');await load();onChanged()}catch(e:any){setErr(e.message)}finally{setBusy('')}}
  async function revokeDriver(d:any){if(!confirm('Déconnecter immédiatement ce livreur de tous ses appareils ?'))return;setBusy('REVOKE:'+d.id);setErr('');try{await api('/api/supplier/drivers',{method:'PATCH',body:JSON.stringify({id:d.id,revokeSessions:true})});setMsg('Sessions livreur révoquées. Il devra se reconnecter.')}catch(e:any){setErr(e.message)}finally{setBusy('')}}

  async function createDriver(e:any){
    e.preventDefault();setBusy('DRIVER');setErr('');
    try{
      await api('/api/supplier/drivers',{method:'POST',body:JSON.stringify(driverForm)});
      setDriverForm({fullName:'',login:'',phone:'',password:''});
      setShowDriver(false);setMsg('Compte livreur créé.');onChanged();await load();
    }catch(e:any){setErr(e.message)}
    finally{setBusy('')}
  }

  async function toggleDriver(d:any){
    setBusy(d.id);setErr('');
    try{
      await api('/api/supplier/drivers',{method:'PATCH',body:JSON.stringify({id:d.id,isActive:!d.isActive})});
      setMsg(d.isActive?'Livreur désactivé.':'Livreur réactivé.');onChanged();
    }catch(e:any){setErr(e.message)}
    finally{setBusy('')}
  }

  return (
    <div className="supplier-delivery-center">
      <div className="supplier-delivery-control-head">
        <div>
          <span className="smart-kicker"><Route size={13}/> CONTROL TOWER</span>
          <h2>Exploitation livraison</h2>
          <p>Dispatch automatique, livreurs actifs, GPS, COD, dus clients et retours dans une seule vue.</p>
        </div>
        <div className="toolbar">
          <button className="btn btn-soft" onClick={load}><RefreshCw/> Actualiser</button>
          <button className="btn btn-soft" onClick={()=>setShowDriver(true)}><Plus/> Nouveau livreur</button>
          <Link className="btn btn-primary" href="/delivery/login" target="_blank"><Truck/> App livreur</Link>
        </div>
      </div>

      {err&&<div className="supplier-pos-alert error"><AlertTriangle/>{err}</div>}
      {msg&&<div className="supplier-pos-alert success"><CheckCircle2/>{msg}</div>}

      <div className="supplier-delivery-kpis">
        <DeliveryKpi icon={UserRound} label="Livreurs en journée" value={overview.metrics?.openShifts||0}/>
        <DeliveryKpi icon={Truck} label="Prêtes à partir" value={ready.length}/>
        <DeliveryKpi icon={Route} label="En route" value={moving.length}/>
        <DeliveryKpi icon={CheckCircle2} label="Livrées aujourd'hui" value={todayDone.length}/>
        <DeliveryKpi icon={Banknote} label="COD aujourd'hui" value={money(overview.metrics?.codToday||0)}/>
        <DeliveryKpi icon={AlertTriangle} label="Incidents" value={overview.metrics?.incidentsToday||0}/><DeliveryKpi icon={PackageCheck} label="Retours à traiter" value={returned.length}/>
      </div>

      <div className="supplier-delivery-control-grid">
        <section className="supplier-panel">
          <div className="supplier-section-head">
            <div><b>Dispatch automatique</b><span>Les commandes prêtes sont proposées à tous les livreurs actifs. L’affectation manuelle reste disponible en secours.</span></div>
          </div>
          <div className="supplier-dispatch-list">
            {[...moving,...returning,...ready].map(o=>{
              const latest=overview.latestByOrder?.[o.id];
              return (
                <article key={o.id} className={selectedOrder?.id===o.id?'selected':''} onClick={()=>setSelected(o.id)}>
                  <div className="supplier-dispatch-main">
                    <div>
                      <code>{o.reference}</code>
                      <b>{o.shop?.name}</b>
                      <span>{o.deliveryAddress||o.shop?.address||o.shop?.region||'Adresse manquante'}</span>
                    </div>
                    <span className={'status-pill '+o.status.toLowerCase()}>{o.status==='OUT_FOR_DELIVERY'?'En route':o.status==='RETURNING'?'Retour fournisseur':o.delivery?.driverAccountId?'Acceptée':'Disponible livreurs'}</span>
                  </div>
                  <div className="supplier-dispatch-meta">
                    <span><Truck/>{o.delivery?.driverName||'Non affectée'}</span>
                    <span><Banknote/>COD {money(overview.codByOrder?.[o.id]||0)}</span>
                    <span><Activity/>{latest?'GPS '+new Date(latest.createdAt).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'}):'GPS —'}</span>
                  </div>
                  {o.status==='READY_FOR_DELIVERY'&&(
                    <div className="supplier-dispatch-assign" onClick={e=>e.stopPropagation()}><small style={{alignSelf:'center'}}>{o.delivery?.driverAccountId?'Livreur déjà sélectionné':'Auto-dispatch actif · affectation manuelle optionnelle'}</small>
                      <select
                        value={assignments[o.id]??o.delivery?.driverAccountId??''}
                        onChange={e=>setAssignments({...assignments,[o.id]:e.target.value})}
                      >
                        <option value="">Choisir un livreur…</option>
                        {activeDrivers.map(d=><option key={d.id} value={d.id}>{d.fullName} · {d.phone||d.login}</option>)}
                      </select>
                      <button disabled={busy===o.id} className="btn btn-primary btn-sm" onClick={()=>assign(o)}>
                        {o.delivery?.driverAccountId?'Réaffecter':'Affecter'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
            {!ready.length&&!moving.length&&(
              <div className="delivery-empty"><CheckCircle2/><h3>Aucune course active</h3><p>Les commandes prêtes apparaîtront ici.</p></div>
            )}
          </div>
        </section>

        <aside className="supplier-panel supplier-live-panel">
          <div className="supplier-section-head">
            <div><b>Suivi terrain</b><span>{selectedOrder?selectedOrder.reference:'Sélectionnez une course'}</span></div>
          </div>
          {selectedOrder?(
            <>
              <div className="supplier-live-order">
                <div><b>{selectedOrder.shop?.name}</b><span>{selectedOrder.delivery?.driverName||'Non affectée'}</span></div>
                {selectedOrder.shop?.phone&&<a href={'tel:'+selectedOrder.shop.phone}><Phone/> Appeler</a>}
              </div>
              {loc?(
                <iframe title="Position livreur" src={osm(Number(loc.latitude),Number(loc.longitude))}/>
              ):(
                <div className="supplier-no-gps">
                  <MapPinned/><b>Aucune position reçue</b>
                  <span>La position remonte automatiquement pendant une livraison active.</span>
                </div>
              )}
              <div className="supplier-live-details">
                <div><span>Dernière position</span><b>{loc?dateTime(loc.createdAt):'—'}</b></div>
                <div><span>Précision</span><b>{loc?.accuracy?Math.round(Number(loc.accuracy))+' m':'—'}</b></div>
                <div><span>COD encaissé</span><b>{money(overview.codByOrder?.[selectedOrder.id]||0)}</b></div>
                <div><span>Dû client</span><b>{money(overview.dueByShop?.[selectedOrder.shopId]||0)}</b></div>
                <div><span>Tentatives</span><b>{selectedOrder.delivery?.attemptCount||0}</b></div>
                <div><span>Code remise</span><b>{selectedOrder.deliveryCode||'—'}</b></div>
              </div>
              <div className="supplier-delivery-order-detail"><div><b>Détails client</b><span>{selectedOrder.shop?.name}</span><span>{selectedOrder.shop?.phone||'Téléphone —'}</span><span>{selectedOrder.deliveryAddress||selectedOrder.shop?.address||selectedOrder.shop?.region||'Adresse —'}</span></div><div><b>Détails commande</b>{selectedOrder.items?.map((i:any)=><span key={i.id}>{i.product?.name} × {i.quantity} · {money(Number(i.unitPrice)*i.quantity)}</span>)}<strong>Total {money(selectedOrder.total)}</strong></div></div>{(overview.dueDetailsByShop?.[selectedOrder.shopId]||[]).length>0&&<div className="supplier-delivery-due-detail"><b>Créances client</b>{overview.dueDetailsByShop[selectedOrder.shopId].map((d:any)=><div key={d.id}><span><strong>{d.reference}</strong><small>{dateTime(d.createdAt)}</small></span><span>Total {money(d.total)} · payé {money(d.paid)} · <b>reste {money(d.due)}</b></span></div>)}</div>}
              {loc&&(
                <a
                  target="_blank"
                  className="btn btn-soft btn-block"
                  href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(loc.latitude+','+loc.longitude)}
                ><Navigation/> Ouvrir la position</a>
              )}
            </>
          ):(
            <div className="supplier-no-gps"><MapPinned/><b>Aucune course</b></div>
          )}
        </aside>
      </div>

      {returned.length>0&&<section className="supplier-panel supplier-returned-deliveries"><div className="supplier-section-head"><div><b>Retours physiques à contrôler</b><span>Le livreur déclare le retour, mais seul Supplier peut confirmer la réception et modifier le stock.</span></div><span className="supplier-count-badge">{returned.length}</span></div><div className="supplier-dispatch-list">{returned.map(o=><article key={o.id}><div className="supplier-dispatch-main"><div><code>{o.reference}</code><b>{o.shop?.name}</b><span>{o.delivery?.returnNote||'Retour sans note'}</span></div><span className="status-pill returned">Contrôle physique requis</span></div><div className="supplier-order-items">{o.items?.map((i:any)=><div key={i.id}><span>{i.product?.name} × {i.quantity}</span><b>{money(Number(i.unitPrice)*i.quantity)}</b></div>)}</div><div className="toolbar"><button disabled={busy===o.id} className="btn btn-primary btn-sm" onClick={()=>resolveReturn(o,'RESTOCK')}><CheckCircle2/> Reçu conforme · remettre en stock</button><button disabled={busy===o.id} className="btn btn-danger btn-sm" onClick={()=>resolveReturn(o,'DAMAGED')}><AlertTriangle/> Endommagé</button><button disabled={busy===o.id} className="btn btn-soft btn-sm" onClick={()=>resolveReturn(o,'REDELIVER')}><RefreshCw/> Relivrer</button></div></article>)}</div></section>}

      {settlements.some((x:any)=>x.status==='PENDING_CASHIER')&&<section className="supplier-panel supplier-settlements"><div className="supplier-section-head"><div><b>Remises livreurs à confirmer</b><span>Le livreur déclare son montant. La caisse recompte et confirme avant clôture définitive.</span></div></div><div className="supplier-settlement-list">{settlements.filter((x:any)=>x.status==='PENDING_CASHIER').map((x:any)=>{const expected=Number(x.expectedCod||x.collectedCod||0),declared=Number(x.declaredRemit||0),value=settlementAmounts[x.id]??String(declared);return <article key={x.id}><div><b>{x.driver?.fullName||x.driverAccountId}</b><span>{x.driver?.phone||x.driver?.login||'—'} · journée {dateTime(x.openedAt)}</span></div><div><span>Attendu</span><strong>{money(expected)}</strong></div><div><span>Déclaré livreur</span><strong>{money(declared)}</strong></div><div className={Math.abs(declared-expected)>.001?'settlement-diff bad':'settlement-diff'}><span>Écart déclaré</span><strong>{money(declared-expected)}</strong></div><label><span>Montant réellement reçu caisse</span><input className="input" type="number" min="0" step=".001" value={value} onChange={e=>setSettlementAmounts({...settlementAmounts,[x.id]:e.target.value})}/></label><details><summary>Détail encaissements</summary>{(x.collections||[]).map((e:any)=><div key={e.id}><span>{String(e.type).replaceAll('_',' ')} · {dateTime(e.createdAt)}</span><b>{money(e.amount||0)}</b></div>)}</details><button className="btn btn-primary" disabled={busy==='SETTLE:'+x.id} onClick={()=>confirmSettlement(x)}><CheckCircle2/> Confirmer remise caisse</button></article>})}</div></section>}
      <div className="supplier-delivery-lower">
        <section className="supplier-panel">
          <div className="supplier-section-head">
            <div><b>Livreurs</b><span>Comptes et journées actuellement ouvertes.</span></div>
          </div>
          <div className="driver-admin-list">
            {drivers.map(d=>{
              const sh=overview.shifts?.find((x:any)=>x.driverAccountId===d.id);
              const subtitle=!d.isActive
                ?' · désactivé'
                :sh
                  ?' · en journée depuis '+new Date(sh.openedAt).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'})
                  :' · hors tournée';
              return (
                <div key={d.id}>
                  <span className={d.isActive&&sh?'driver-dot on':'driver-dot'}/>
                  <div><b>{d.fullName}</b><small>{d.phone||d.login}{subtitle}</small></div>
                  <div className="driver-security-actions"><button className="driver-state-btn" disabled={busy===d.id||!!sh} onClick={()=>toggleDriver(d)}>{d.isActive?'Désactiver':'Activer'}</button><button className="driver-state-btn danger" disabled={busy==='REVOKE:'+d.id} onClick={()=>revokeDriver(d)}>Déconnecter appareils</button></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="supplier-panel">
          <div className="supplier-section-head"><div><b>Journal terrain</b><span>Derniers événements de livraison.</span></div></div>
          <div className="supplier-delivery-event-table">
            {lastEvents.map((e:any)=>(
              <div key={e.id}>
                <i/>
                <span>
                  <b>{String(e.type).replaceAll('_',' ')}</b>
                  <small>{orders.find(o=>o.id===e.orderId)?.reference||e.orderId} · {e.note||'—'}</small>
                </span>
                <strong>{e.amount?money(e.amount):dateTime(e.createdAt)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showDriver&&(
        <div className="supplier-modal-backdrop">
          <form className="supplier-modal" onSubmit={createDriver}>
            <button type="button" className="supplier-modal-x" onClick={()=>setShowDriver(false)}><X/></button>
            <span className="smart-kicker"><UserRound size={13}/> COMPTE LIVREUR</span>
            <h2>Nouveau livreur</h2>
            <p>Ce compte donne accès uniquement à Fixi Delivery et aux courses affectées.</p>
            <label className="label">Nom complet</label>
            <input className="input" required value={driverForm.fullName} onChange={e=>setDriverForm({...driverForm,fullName:e.target.value})}/>
            <label className="label">Identifiant</label>
            <input className="input" required autoCapitalize="none" value={driverForm.login} onChange={e=>setDriverForm({...driverForm,login:e.target.value.toLowerCase()})}/>
            <label className="label">Téléphone</label>
            <input className="input" inputMode="tel" value={driverForm.phone} onChange={e=>setDriverForm({...driverForm,phone:e.target.value})}/>
            <label className="label">Mot de passe</label>
            <input className="input" required minLength={4} type="password" value={driverForm.password} onChange={e=>setDriverForm({...driverForm,password:e.target.value})}/>
            <button disabled={busy==='DRIVER'} className="btn btn-primary btn-block">Créer le compte</button>
          </form>
        </div>
      )}
    </div>
  );
}

function DeliveryKpi({icon:Icon,label,value}:{icon:any;label:string;value:any}){
  return <div><Icon/><span>{label}</span><b>{value}</b></div>;
}

function osm(lat:number,lng:number){
  const d=.008;
  return 'https://www.openstreetmap.org/export/embed.html?bbox='+(lng-d)+'%2C'+(lat-d)+'%2C'+(lng+d)+'%2C'+(lat+d)+'&layer=mapnik&marker='+lat+'%2C'+lng;
}
