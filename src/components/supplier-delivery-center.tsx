'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {
  Activity,AlertTriangle,Banknote,CheckCircle2,MapPinned,Navigation,
  Phone,Plus,RefreshCw,Route,Truck,UserRound,X
} from 'lucide-react';
import {api} from './ui';
import {dateTime,money} from '@/lib/format';

type Props={orders:any[];drivers:any[];onChanged:()=>void};

export function SupplierDeliveryCenter({orders,drivers,onChanged}:Props){
  const[overview,setOverview]=useState<any>({shifts:[],latestByOrder:{},codByOrder:{},events:[],metrics:{}});
  const[selected,setSelected]=useState('');
  const[assignments,setAssignments]=useState<Record<string,string>>({});
  const[msg,setMsg]=useState('');
  const[err,setErr]=useState('');
  const[busy,setBusy]=useState('');
  const[showDriver,setShowDriver]=useState(false);
  const[driverForm,setDriverForm]=useState({fullName:'',login:'',phone:'',password:''});

  async function load(){
    const r=await fetch('/api/supplier/delivery/overview',{cache:'no-store'});
    const j=await r.json();
    if(r.ok)setOverview(j);
  }
  useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[]);

  const ready=orders.filter(o=>o.status==='READY_FOR_DELIVERY');
  const moving=orders.filter(o=>o.status==='OUT_FOR_DELIVERY');
  const todayDone=orders.filter(o=>o.status==='DELIVERED'&&new Date(o.delivery?.deliveredAt||o.updatedAt).toDateString()===new Date().toDateString());
  const activeDrivers=drivers.filter(d=>d.isActive);
  const selectedOrder=orders.find(o=>o.id===selected)||moving[0]||ready[0]||null;
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
          <p>Affectations, livreurs actifs, GPS, COD et incidents dans une seule vue.</p>
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
        <DeliveryKpi icon={AlertTriangle} label="Incidents" value={overview.metrics?.incidentsToday||0}/>
      </div>

      <div className="supplier-delivery-control-grid">
        <section className="supplier-panel">
          <div className="supplier-section-head">
            <div><b>File d'affectation</b><span>Commandes prêtes et courses en cours.</span></div>
          </div>
          <div className="supplier-dispatch-list">
            {[...moving,...ready].map(o=>{
              const latest=overview.latestByOrder?.[o.id];
              return (
                <article key={o.id} className={selectedOrder?.id===o.id?'selected':''} onClick={()=>setSelected(o.id)}>
                  <div className="supplier-dispatch-main">
                    <div>
                      <code>{o.reference}</code>
                      <b>{o.shop?.name}</b>
                      <span>{o.deliveryAddress||o.shop?.address||o.shop?.region||'Adresse manquante'}</span>
                    </div>
                    <span className={'status-pill '+o.status.toLowerCase()}>{o.status==='OUT_FOR_DELIVERY'?'En route':'Prête'}</span>
                  </div>
                  <div className="supplier-dispatch-meta">
                    <span><Truck/>{o.delivery?.driverName||'Non affectée'}</span>
                    <span><Banknote/>COD {money(overview.codByOrder?.[o.id]||0)}</span>
                    <span><Activity/>{latest?'GPS '+new Date(latest.createdAt).toLocaleTimeString('fr-TN',{hour:'2-digit',minute:'2-digit'}):'GPS —'}</span>
                  </div>
                  {o.status==='READY_FOR_DELIVERY'&&(
                    <div className="supplier-dispatch-assign" onClick={e=>e.stopPropagation()}>
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
                <div><span>Tentatives</span><b>{selectedOrder.delivery?.attemptCount||0}</b></div>
              </div>
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
                  <button className="driver-state-btn" disabled={busy===d.id||!!sh} onClick={()=>toggleDriver(d)}>
                    {d.isActive?'Désactiver':'Activer'}
                  </button>
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
