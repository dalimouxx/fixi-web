'use client';
import Link from 'next/link';
import {useCallback} from 'react';
import {DollarSign,Wrench,TrendingUp,PackageCheck,ArrowRight,ShieldCheck,BrainCircuit,Sparkles,PlusCircle,CreditCard,Users,Boxes,AlertTriangle,Clock3,Link2,BellRing,Zap,ReceiptText} from 'lucide-react';
import {AreaChart,Area,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {StatCard} from '@/components/stat-card';
import {StatusBadge,useApi,useRealtimeRefresh} from '@/components/ui';
import {money,dateTime} from '@/lib/format';

export default function Dashboard(){
  const{data,loading,error,reload}=useApi<any>('/api/dashboard');
  useRealtimeRefresh(useCallback(()=>reload(),[]));
  if(loading)return <div className="page"><div className="card card-pad">Chargement du tableau de bord…</div></div>;
  if(error||!data)return <div className="page"><div className="error">{error}</div></div>;
  const active=Object.entries(data.statusCounts||{}).filter(([k])=>!['DELIVERED','CANCELLED'].includes(k)).reduce((a,[,v])=>a+Number(v),0);
  const waiting=Number(data.statusCounts?.WAITING_PART||0);
  const diagnosis=Number(data.statusCounts?.DIAGNOSIS||0);
  const inRepair=Number(data.statusCounts?.IN_REPAIR||0);
  const attention=[
    data.lowStock>0&&{label:`${data.lowStock} article(s) en stock faible`,href:'/app/stock',type:'danger',icon:Boxes},
    waiting>0&&{label:`${waiting} réparation(s) attendent une pièce`,href:'/app/repairs',type:'warning',icon:Clock3},
    data.openWarranty>0&&{label:`${data.openWarranty} dossier(s) SAV ouvert(s)`,href:'/app/warranties',type:'warning',icon:ShieldCheck},
    !data.cashOpen&&data.permissions.cash&&{label:'Caisse fermée',href:'/app/cash-sessions',type:'neutral',icon:CreditCard}
  ].filter(Boolean) as any[];
  return <div className="page dashboard-v2">
    <div className="page-head">
      <div><div className="smart-kicker"><Zap size={13}/> COMMAND CENTER</div><h1 className="page-title">Aujourd’hui dans votre atelier</h1><div className="page-sub">L’essentiel d’abord : encaissements, réparations, stock et actions à traiter.</div></div>
      <div className="toolbar"><Link href="/app/repairs/new" className="btn btn-primary"><PlusCircle size={16}/> Nouvelle réception</Link></div>
    </div>

    <div className="quick-actions">
      <Link href="/app/repairs/new"><PlusCircle/><span><b>Réception</b><small>Nouveau téléphone</small></span></Link>
      <Link href="/app/cashier"><CreditCard/><span><b>Vente</b><small>Ouvrir la caisse</small></span></Link>
      <Link href="/app/clients"><Users/><span><b>Client</b><small>Fiche & historique</small></span></Link>
      <Link href="/app/stock"><Boxes/><span><b>Pièce</b><small>Stock atelier</small></span></Link>
      <Link href="/app/documents"><ReceiptText/><span><b>Facture</b><small>Devis & facture</small></span></Link>
      <Link href="/app/compatibility"><Link2/><span><b>Compatibilité</b><small>Tester une pièce</small></span></Link>
    </div>

    <div className="stat-grid dashboard-stat-grid">
      {data.permissions.finance&&<StatCard label="CA aujourd'hui" value={money(data.todayRevenue)} note="Encaissements du jour" icon={<DollarSign size={19}/>}/>}
      <StatCard label="Réparations actives" value={active} note={`${diagnosis} diagnostic · ${inRepair} en réparation`} icon={<Wrench size={19}/>}/>
      {data.permissions.profit&&<StatCard label="Résultat du mois" value={money(data.grossProfit)} note="CA - pièces - dépenses" icon={<TrendingUp size={19}/>}/>}
      <StatCard label="Appareils prêts" value={data.ready} note="À remettre aux clients" icon={<PackageCheck size={19}/>}/>
      {!data.permissions.finance&&!data.permissions.profit&&<StatCard label="Suivi opérationnel" value="En direct" note="Données limitées à votre rôle" icon={<ShieldCheck size={19}/>}/>}
    </div>

    <div className="dashboard-action-grid">
      <section className="card card-pad attention-card">
        <div className="section-head-inline"><div><h2 className="section-title">À traiter maintenant</h2><div className="page-sub">Ce qui nécessite une action dans l’atelier.</div></div><BellRing size={18}/></div>
        <div className="attention-list">
          {attention.length?attention.map((a:any,i:number)=>{const Icon=a.icon;return <Link href={a.href} className={`attention-row ${a.type}`} key={i}><Icon/><span>{a.label}</span><ArrowRight size={15}/></Link>}):<div className="attention-empty"><ShieldCheck/><div><b>Tout est sous contrôle</b><span>Aucune alerte prioritaire pour le moment.</span></div></div>}
        </div>
      </section>
      <section className="card card-pad workshop-pulse">
        <div><h2 className="section-title">Flux atelier</h2><div className="page-sub">Répartition actuelle des appareils.</div></div>
        <div className="pulse-grid">
          {[['RECEIVED','Reçus'],['DIAGNOSIS','Diagnostic'],['IN_REPAIR','En réparation'],['WAITING_PART','Attente pièce'],['READY','Prêts']].map(([k,l])=><Link href="/app/repairs" key={k}><b>{data.statusCounts?.[k]||0}</b><span>{l}</span></Link>)}
        </div>
      </section>
    </div>

    {data.permissions.profit&&<div className="smart-dashboard-banner compact">
      <div><span><Sparkles size={13}/> FIXI SMART</span><h2>Pilotez l’atelier par exception.</h2><p>Fixi Brain et Smart Insights vous montrent ce qui mérite réellement votre attention.</p></div>
      <div className="toolbar"><Link href="/app/insights" className="btn btn-soft">Smart Insights</Link><Link href="/app/brain" className="btn btn-primary"><BrainCircuit size={16}/> Fixi Brain</Link></div>
    </div>}

    <div className="content-grid" style={{marginTop:18}}>
      {data.permissions.finance&&<div className="card card-pad chart-card">
        <div className="page-head" style={{marginBottom:12}}><div><h2 className="section-title">Chiffre d’affaires du mois</h2><div className="page-sub">Évolution journalière des encaissements</div></div><strong>{money(data.monthRevenue)}</strong></div>
        <div style={{height:245}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.series||[]}><defs><linearGradient id="fillOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6b00" stopOpacity={.2}/><stop offset="100%" stopColor="#ff6b00" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" tick={{fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/><Tooltip/><Area type="monotone" dataKey="value" stroke="#ff6b00" strokeWidth={3} fill="url(#fillOrange)"/></AreaChart></ResponsiveContainer></div>
      </div>}
      <div className="card card-pad">
        <h2 className="section-title">Résumé opérationnel</h2><div className="page-sub">Vue compacte de l’activité.</div>
        <div className="metric-list" style={{marginTop:15}}>
          <div className="metric-row"><span>Réparations actives</span><strong>{active}</strong></div>
          <div className="metric-row"><span>Attente pièce</span><strong>{waiting}</strong></div>
          <div className="metric-row"><span>Prêts à livrer</span><strong>{data.ready}</strong></div>
          {data.permissions.stock&&<div className="metric-row"><span>Stock faible</span><strong>{data.lowStock}</strong></div>}
          {data.permissions.profit&&<div className="metric-row"><span>Dépenses du mois</span><strong>{money(data.monthExpenses)}</strong></div>}
        </div>
      </div>
    </div>

    <div className="card" style={{marginTop:18}}>
      <div className="card-pad table-toolbar"><div><h2 className="section-title">Activité récente</h2><div className="page-sub">Dernières réparations mises à jour</div></div><Link href="/app/repairs" className="btn btn-soft btn-sm">Tout voir</Link></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>Code</th><th>Client</th><th>Appareil</th><th>Technicien</th><th>Statut</th><th>Dernière mise à jour</th></tr></thead><tbody>{data.recent.map((r:any)=><tr key={r.id}><td><Link href={`/app/repairs/${r.code}`} className="mono table-primary-link">{r.code}</Link></td><td>{r.client.fullName}</td><td>{[r.brand,r.model].filter(Boolean).join(' ')}</td><td>{r.technician?.fullName||'Non assigné'}</td><td><StatusBadge status={r.status}/></td><td className="muted">{dateTime(r.updatedAt)}</td></tr>)}</tbody></table></div>
    </div>
  </div>
}
