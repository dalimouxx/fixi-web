'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {TrendingUp,WalletCards,Warehouse,AlertTriangle,Users,Boxes,RefreshCw,ArrowUpRight,BarChart3,FileText,RotateCcw} from 'lucide-react';
import {money} from '@/lib/format';

export function SupplierReports(){
 const[days,setDays]=useState(30);const[data,setData]=useState<any>(null);const[busy,setBusy]=useState(false);
 async function load(d=days){setBusy(true);try{const r=await fetch('/api/supplier/reports?days='+d,{cache:'no-store'});const j=await r.json();if(r.ok)setData(j)}finally{setBusy(false)}}
 useEffect(()=>{load(days)},[days]);
 const m=data?.metrics||{};
 return <div className="supplier-reports-v2">
  <div className="supplier-report-head"><div><span className="smart-kicker"><BarChart3 size={13}/> BUSINESS INTELLIGENCE</span><h2>Rapports de gestion</h2><p>Ventes, marge, trésorerie, stock, crédit et performance commerciale.</p></div><div className="toolbar"><select className="input" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option><option value={180}>180 jours</option><option value={365}>12 mois</option></select><button className="btn btn-soft" onClick={()=>load()}><RefreshCw/> {busy?'Calcul…':'Actualiser'}</button><Link className="btn btn-soft" target="_blank" href="/supplier/daily-report"><FileText/> Recette du jour PDF</Link><Link className="btn btn-soft" target="_blank" href="/supplier/returns-report"><RotateCcw/> Retours PDF</Link></div></div>
  <div className="supplier-report-kpis"><R icon={TrendingUp} label="Chiffre d’affaires" value={money(m.revenue||0)} sub={(m.salesCount||0)+' vente(s)'}/><R icon={ArrowUpRight} label="Marge brute" value={money(m.grossProfit||0)} sub={'COGS '+money(m.cogs||0)}/><R icon={WalletCards} label="Résultat net" value={money(m.netProfit||0)} sub={'Dépenses '+money(m.expenses||0)}/><R icon={Users} label="Créances clients" value={money(m.receivables||0)} sub={'Dettes '+money(m.payables||0)}/><R icon={Warehouse} label="Stock au coût" value={money(m.stockCost||0)} sub={'Vente '+money(m.stockRetail||0)}/><R icon={Boxes} label="Cash-flow période" value={money(m.cashFlow||0)} sub={'Encaissé '+money(m.collected||0)}/></div>
  <div className="supplier-report-layout">
   <section className="supplier-panel"><div className="supplier-section-head"><div><b>Produits les plus vendus</b><span>CA, quantité et marge par produit.</span></div></div><div className="supplier-rank-list">{(data?.topProducts||[]).slice(0,10).map((x:any,i:number)=><div key={x.id}><em>{i+1}</em><span><b>{x.name}</b><small>{x.sku||'—'} · {x.quantity} u.</small></span><strong>{money(x.revenue)}<small>marge {money(x.profit)}</small></strong></div>)}</div></section>
   <section className="supplier-panel"><div className="supplier-section-head"><div><b>Ventes par catégorie</b><span>Répartition commerciale.</span></div></div><div className="supplier-breakdown">{(data?.salesByCategory||[]).slice(0,10).map((x:any)=><div key={x.name}><span><b>{x.name}</b><small>{x.quantity} article(s)</small></span><strong>{money(x.revenue)}</strong></div>)}</div></section>
   <section className="supplier-panel"><div className="supplier-section-head"><div><b>Meilleurs clients</b><span>Ventes et reste à encaisser.</span></div></div><div className="supplier-breakdown">{(data?.topCustomers||[]).slice(0,10).map((x:any)=><div key={x.id}><span><b>{x.name}</b><small>{x.sales} vente(s)</small></span><strong>{money(x.revenue)}<small className={x.due>0?'negative':''}>reste {money(x.due)}</small></strong></div>)}</div></section>
   <section className="supplier-panel"><div className="supplier-section-head"><div><b>Ancienneté des créances</b><span>Priorités de recouvrement.</span></div></div><div className="supplier-aging"><div><span>Récentes</span><b>{money(data?.aging?.current||0)}</b></div><div><span>1–7 jours</span><b>{money(data?.aging?.d1_7||0)}</b></div><div><span>8–30 jours</span><b>{money(data?.aging?.d8_30||0)}</b></div><div className="danger"><span>+30 jours</span><b>{money(data?.aging?.over30||0)}</b></div></div></section>
  </div>
  <div className="supplier-report-layout lower">
   <section className="supplier-panel"><div className="supplier-section-head"><div><b>Alertes stock</b><span>Disponible ≤ seuil minimum.</span></div><span className="supplier-count-badge">{data?.lowStock?.length||0}</span></div><div className="supplier-alert-list">{(data?.lowStock||[]).slice(0,12).map((x:any)=><div key={x.id}><AlertTriangle/><span><b>{x.name}</b><small>{x.sku}</small></span><strong>{x.available} / min {x.minStock}</strong></div>)}</div></section>
   <section className="supplier-panel"><div className="supplier-section-head"><div><b>Stock sans vente sur la période</b><span>Capital immobilisé à surveiller.</span></div><span className="supplier-count-badge">{data?.deadStock?.length||0}</span></div><div className="supplier-alert-list dead">{(data?.deadStock||[]).slice(0,12).map((x:any)=><div key={x.id}><Warehouse/><span><b>{x.name}</b><small>{x.sku} · {x.stock} u.</small></span><strong>{money(x.value)}</strong></div>)}</div></section>
  </div>
 </div>
}
function R({icon:Icon,label,value,sub}:any){return <div><i><Icon/></i><span>{label}</span><b>{value}</b><small>{sub}</small></div>}
