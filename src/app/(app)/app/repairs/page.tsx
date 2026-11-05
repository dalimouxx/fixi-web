'use client';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Plus,Search,Columns3,List,ChevronRight,Phone,CheckCircle2,Clock3,PackageOpen,X,MessageCircle,Banknote,ExternalLink} from 'lucide-react';
import {waLink} from '@/lib/whatsapp-link';
import {SwipeCard} from '@/components/swipe-card';
import {repairAge} from '@/lib/repair-age';
import {partQuery} from '@/lib/price-hint';
import {useI18n} from '@/components/language-provider';
import {api,PriorityBadge,StatusBadge,useApi,useRealtimeRefresh} from '@/components/ui';
import {dateTime,money} from '@/lib/format';

const cols=[['RECEIVED','Reçu'],['DIAGNOSIS','Diagnostic'],['IN_REPAIR','En réparation'],['WAITING_PART','Attente pièce'],['READY','Prêt'],['DELIVERED','Livré']] as const;

export default function Repairs(){
  const{lang}=useI18n();const ar=lang==='ar';const ageText=(a:any)=>ar?`${a.days} أيام دون تغيير`:a.label;
  const[q,setQ]=useState('');
  const[view,setView]=useState<'kanban'|'table'>('kanban');
  useEffect(()=>{const v=new URLSearchParams(window.location.search).get('q');if(v)setQ(v);const saved=localStorage.getItem('fixi-repairs-view');if(saved==='table')setView('table')},[]);
  useEffect(()=>{localStorage.setItem('fixi-repairs-view',view)},[view]);
  const[refresh,setRefresh]=useState(0);
  const[mstatus,setMstatus]=useState<string>('ACTIVE');const[sel,setSel]=useState<string|null>(null);const[quick,setQuick]=useState<''|'urgent'|'stale'|'due'>('');
  const{data,loading,error,reload}=useApi<any[]>(`/api/repairs?q=${encodeURIComponent(q)}`,refresh);
  useRealtimeRefresh(useCallback(()=>reload(),[]));
  // 18.0 — filtres rapides : urgents, bloqués (≥ 3 jours sans changement), solde à encaisser.
  const due=(r:any)=>{const paid=(r.payments||[]).reduce((a:number,p:any)=>a+(p.kind==='REFUND'?-1:1)*Number(p.amount||0),0);return Math.max(0,Number(r.finalPrice??r.estimatedPrice??0)-paid)};
  const matchQuick=(r:any)=>!quick||(quick==='urgent'?r.priority==='URGENT':quick==='stale'?(repairAge(r)?.days||0)>=3&&!['DELIVERED','CANCELLED'].includes(r.status):due(r)>0&&!['CANCELLED'].includes(r.status));
  const rows=useMemo(()=>(data||[]).filter(matchQuick),[data,quick]);
  const counts=useMemo(()=>({urgent:(data||[]).filter((r:any)=>r.priority==='URGENT'&&!['DELIVERED','CANCELLED'].includes(r.status)).length,stale:(data||[]).filter((r:any)=>(repairAge(r)?.days||0)>=3&&!['DELIVERED','CANCELLED'].includes(r.status)).length,due:(data||[]).filter((r:any)=>due(r)>0&&r.status!=='CANCELLED').length}),[data]);
  const grouped=useMemo(()=>Object.fromEntries(cols.map(([k])=>[k,rows.filter(r=>r.status===k)])),[rows]);
  async function move(code:string,status:string){try{await api(`/api/repairs/${code}/status`,{method:'PATCH',body:JSON.stringify({status})});setRefresh(x=>x+1)}catch(e:any){alert(e.message)}}
  const activeCount=(data||[]).filter((r:any)=>!['DELIVERED','CANCELLED'].includes(r.status)).length;
  const listRows=rows.filter((r:any)=>mstatus==='ACTIVE'?!['DELIVERED','CANCELLED'].includes(r.status):r.status===mstatus);
  const selected=(data||[]).find((r:any)=>r.code===sel)||null;
  return <div className="page fxm-rp" style={{maxWidth:'none'}}>
    <div className="fxm-rp-head fxm-up">
      <div><h1 className="fxm-h1">Réparations</h1><div className="fxm-dash-sub">{activeCount} en cours{counts.stale?` · ${counts.stale} bloquée(s) 3 j+`:''}{counts.urgent?` · ${counts.urgent} urgente(s)`:''}</div></div>
      <div className="fxm-rp-actions">
        <div className="fxm-seg fx-desktop-only" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={view==='table'} className={view==='table'?'on':''} onClick={()=>setView('table')}><List size={15}/> Liste</button>
          <button type="button" aria-pressed={view==='kanban'} className={view==='kanban'?'on':''} onClick={()=>setView('kanban')}><Columns3 size={15}/> Kanban</button>
        </div>
        <Link href="/app/repairs/new" className="btn fxm-btn-g"><Plus size={17}/> Nouvelle réparation</Link>
      </div>
    </div>

    <div className="fxm-rp-tools fxm-up" style={{'--d':'.06s'} as any}>
      <label className="fxm-search"><Search size={17} aria-hidden="true"/><span className="fxm-sr">Rechercher</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Code, client, téléphone, appareil, IMEI…"/></label>
      <div className="fxm-chips-row" role="group" aria-label="Filtres rapides">{([['','Tout',0],['urgent','Urgents',counts.urgent],['stale','Bloqués 3 j+',counts.stale],['due','Solde à encaisser',counts.due]] as const).map(([k,l,n])=><button type="button" key={k||'all'} className={'fxm-chipbtn'+(quick===k?' on':'')} aria-pressed={quick===k} onClick={()=>setQuick(k as any)}>{l}{k&&n>0?<em>{n}</em>:null}</button>)}</div>
    </div>
    {view==='table'&&<div className="fx-desktop-only"><div className="fxm-chips-row fxm-up" style={{'--d':'.1s'} as any} role="group" aria-label="Filtrer par statut">
      {[['ACTIVE','En cours'],...cols].map(([k,l])=>{const n=k==='ACTIVE'?activeCount:(grouped[k]?.length||0);return <button type="button" key={k} className={'fxm-chipbtn'+(mstatus===k?' on':'')} aria-pressed={mstatus===k} onClick={()=>setMstatus(k)}>{l}<span className="c">{n}</span></button>})}
    </div></div>}

    {error&&<div className="error" style={{marginBottom:15}}>{error}</div>}
    {/* Téléphone : onglets de statut colorés + cartes (le Kanban à 6 colonnes ne tient pas sur un écran) */}
    <div className="fx-mobile-only">
      <p className="fx-swipe-hint">{ar?'اسحب البطاقة: → المرحلة التالية · ← الاتصال بالحريف':'Glissez une carte\u00a0: → étape suivante · ← appeler le client'}</p>
      <nav className="fx-status-tabs" aria-label="Filtrer par statut">
        {[['ACTIVE','En cours'],...cols].map(([k,l])=>{const n=k==='ACTIVE'?(data||[]).filter((r:any)=>!['DELIVERED','CANCELLED'].includes(r.status)).length:(grouped[k]?.length||0);return <button type="button" key={k} data-status={k} aria-pressed={mstatus===k} onClick={()=>setMstatus(k)}><span>{l}</span><b>{n}</b></button>})}
      </nav>
      {loading&&!data?<div className="card card-pad fx-skeleton" role="status" aria-label="Chargement"><i/><i/><i/></div>:
      <div className="fx-repair-cards">
        {rows.filter((r:any)=>mstatus==='ACTIVE'?!['DELIVERED','CANCELLED'].includes(r.status):r.status===mstatus).map((r:any)=>{const ci=cols.findIndex(c=>c[0]===r.status);const next=ci>=0&&ci<cols.length-1?cols[ci+1]:null;const age=repairAge(r);return <SwipeCard key={r.id} className="fx-repair-card" data-status={r.status} data-age={age.level}
          right={next&&r.status!=='DELIVERED'?{label:next[1],icon:<CheckCircle2/>,onSwipe:()=>move(r.code,next[0])}:undefined}
          left={r.client?.phone?{label:ar?'اتصال':'Appeler',icon:<Phone/>,onSwipe:()=>{window.location.href='tel:'+r.client.phone}}:undefined}>
          <Link href={`/app/repairs/${r.code}`} className="fx-repair-card-main">
            <div className="fx-repair-card-top"><b>{[r.brand,r.model].filter(Boolean).join(' ')}</b><StatusBadge status={r.status}/></div>
            <span className="fx-repair-card-issue">{r.reportedIssue}</span>
            <span className="fx-repair-card-meta">{r.client.fullName} · <span className="mono">{r.code}</span>{r.priority==='URGENT'&&<em> · URGENT</em>}</span>
            {age.label&&<span className="fx-age" data-age={age.level}><Clock3 size={14}/><bdi>{ageText(age)}</bdi></span>}
          </Link>
          <div className="fx-repair-card-foot"><span>{r.finalPrice!==null?money(r.finalPrice):'Prix à fixer'}</span>{r.status==='WAITING_PART'&&<Link className="btn btn-soft btn-sm" href={`/app/suppliers?q=${encodeURIComponent(partQuery(r))}`}><PackageOpen size={15}/> Commander</Link>}{next&&r.status!=='DELIVERED'&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>move(r.code,next[0])}>{next[1]} →</button>}</div>
        </SwipeCard>})}
        {!rows.some((r:any)=>mstatus==='ACTIVE'?!['DELIVERED','CANCELLED'].includes(r.status):r.status===mstatus)&&<div className="fx-empty"><b>Aucun appareil ici</b><span>Les appareils de ce statut apparaîtront ici.</span><Link href="/app/repairs/new" className="btn btn-primary">Nouvelle réparation</Link></div>}
      </div>}
    </div>
    <div className="fx-desktop-only">
    {loading&&!data?<div className="fxm-card fxm-skel-card" role="status" aria-label="Chargement"><i className="fxm-skeleton"/><i className="fxm-skeleton"/><i className="fxm-skeleton"/></div>:view==='kanban'?<div className="fxm-kanban">{cols.map(([key,label],ci)=><div className="fxm-kcol fxm-up" data-status={key} key={key} style={{'--d':`${0.1+ci*0.05}s`} as any}>
      <div className="fxm-khead"><span className={`fx-status fx-status--${key}`}><i aria-hidden="true"/>{label}</span><span className="fxm-kcount">{grouped[key]?.length||0}</span></div>
      {(grouped[key]||[]).map((r:any)=>{const age=repairAge(r);return <div className={`fxm-kcard ${r.priority==='URGENT'?'is-urgent':''}`} data-age={age.level} key={r.id}>
        <div className="fxm-kcard-top"><button type="button" className="fxm-rb" onClick={()=>{setSel(r.code);setView('table')}}>{[r.brand,r.model].filter(Boolean).join(' ')||r.code}</button><span className="fxm-mono">{r.code}{r.priority==='URGENT'&&<em className="fxm-urgent"> · URGENT</em>}</span></div>
        <div className="fxm-kcard-issue">{r.reportedIssue}</div>
        {age.label&&<span className="fx-age" data-age={age.level}><Clock3 size={13}/><bdi>{ageText(age)}</bdi></span>}
        <div className="fxm-kcard-foot"><span className="fxm-kcard-who"><span className="fxm-av fxm-av--s" aria-hidden="true"><span>{ini(r.client?.fullName)}</span></span>{r.client?.fullName}</span>{r.finalPrice!==null&&<b className="fxm-num">{money(r.finalPrice)}</b>}</div>
        {ci<cols.length-1&&key!=='DELIVERED'&&<button type="button" className="fxm-next" onClick={()=>move(r.code,cols[ci+1][0])}>{cols[ci+1][1]} →</button>}
      </div>})}
      {!(grouped[key]||[]).length&&<div className="fxm-kempty">Aucun appareil</div>}
    </div>)}</div>:<div className="fxm-rp-split">
      <section className={'fxm-card fxm-up fxm-rp-table'+(selected?' has-drawer':'')} style={{'--d':'.14s'} as any} aria-label="Liste des réparations">
        <div className="fxm-tblw"><table className="fxm-tbl">
          <thead><tr><th>Appareil</th><th>Client</th><th className="fxm-col-opt">Technicien</th><th>Statut</th><th>Avancement</th><th className="fxm-col-opt">Créée</th><th style={{textAlign:'end'}}>Reste</th></tr></thead>
          <tbody>{listRows.map((r:any,i:number)=>{const age=repairAge(r);const left=due(r);return <tr key={r.id} className={(sel===r.code?'is-sel ':'')+'fxm-in'} style={{'--d':`${0.18+Math.min(i,12)*0.04}s`} as any}>
            <td><button type="button" className="fxm-rb" onClick={()=>setSel(r.code)}>{[r.brand,r.model].filter(Boolean).join(' ')||r.code}</button><div className="fxm-sub2"><span className="fxm-mono">{r.code}</span> · {r.reportedIssue}{r.priority==='URGENT'&&<em className="fxm-urgent"> · URGENT</em>}</div></td>
            <td><span className="fxm-kcard-who"><span className="fxm-av fxm-av--s" aria-hidden="true"><span>{ini(r.client?.fullName)}</span></span>{r.client?.fullName}</span></td>
            <td className="fxm-muted fxm-col-opt">{r.technician?.fullName||'Non assigné'}</td>
            <td><StatusBadge status={r.status}/>{age.label&&<div className="fxm-sub2" data-age={age.level}>{ageText(age)}</div>}</td>
            <td style={{minWidth:110}}><div className="fxm-pg"><i style={{width:`${progress(r.status)}%`}}/></div></td>
            <td className="fxm-muted fxm-col-opt">{dateTime(r.createdAt)}</td>
            <td className="fxm-num" style={{textAlign:'end',fontWeight:700}}>{left>0?money(left):<span className="fxm-ok">Payé</span>}</td>
          </tr>})}</tbody>
        </table></div>
        {!listRows.length&&<div className="fxm-empty"><b>Aucune réparation ici</b><span>Changez de filtre ou créez une nouvelle réparation.</span></div>}
      </section>
      {selected&&<aside className="fxm-card fxm-drawer" key={selected.code} aria-label="Aperçu de la réparation">
        <div className="fxm-drawer-head">
          <div><div className="fxm-sub2"><span className="fxm-mono">{selected.code}</span> · reçue le {dateTime(selected.createdAt)}</div><h2>{[selected.brand,selected.model].filter(Boolean).join(' ')||selected.code}</h2><StatusBadge status={selected.status}/></div>
          <button type="button" className="fxm-ib" aria-label="Fermer l’aperçu" onClick={()=>setSel(null)}><X size={16}/></button>
        </div>
        <div className="fxm-drawer-sec">
          <div className="fxm-kv"><span>Client</span><b>{selected.client?.fullName}</b></div>
          {selected.client?.phone&&<div className="fxm-kv"><span>Téléphone</span><span className="fxm-num">{selected.client.phone}</span></div>}
          <div className="fxm-kv"><span>Panne</span><span>{selected.reportedIssue}</span></div>
          <div className="fxm-kv"><span>Technicien</span><span>{selected.technician?.fullName||'Non assigné'}</span></div>
          <div className="fxm-kv"><span>Avancement</span><span style={{flex:'0 0 120px'}}><span className="fxm-pg" style={{display:'block'}}><i style={{width:`${progress(selected.status)}%`}}/></span></span></div>
        </div>
        <div className="fxm-drawer-sec">
          <div className="fxm-kv"><span>Prix</span><span className="fxm-num">{selected.finalPrice!==null?money(selected.finalPrice):'À fixer'}</span></div>
          <div className="fxm-kv fxm-kv--big"><b>Reste à payer</b><b className="fxm-num fxm-gt">{money(due(selected))}</b></div>
        </div>
        <div className="fxm-drawer-foot">
          {selected.client?.phone&&<a className="btn fxm-btn-o btn-sm" href={waLink(selected.client.phone,'')} target="_blank" rel="noreferrer"><MessageCircle size={15}/> WhatsApp</a>}
          {(()=>{const ci=cols.findIndex(c=>c[0]===selected.status);const nx=ci>=0&&ci<cols.length-1&&selected.status!=='DELIVERED'?cols[ci+1]:null;return nx?<button type="button" className="btn fxm-btn-o btn-sm" onClick={()=>move(selected.code,nx[0])}><CheckCircle2 size={15}/> {nx[1]}</button>:null})()}
          {selected.status==='WAITING_PART'&&<Link className="btn fxm-btn-o btn-sm" href={`/app/suppliers?q=${encodeURIComponent(partQuery(selected))}`}><PackageOpen size={15}/> Commander la pièce</Link>}
          {due(selected)>0&&<Link className="btn fxm-btn-g fxm-span2" href={`/app/cashier?repair=${encodeURIComponent(selected.code)}`}><Banknote size={17}/> Encaisser et rendre</Link>}
          <Link className="btn fxm-btn-o fxm-span2" href={`/app/repairs/${selected.code}`}><ExternalLink size={15}/> Ouvrir la fiche complète</Link>
        </div>
      </aside>}
    </div>}
    </div>
  </div>
}

const PROGRESS:Record<string,number>={RECEIVED:10,DIAGNOSIS:25,IN_REPAIR:55,WAITING_PART:45,READY:90,DELIVERED:100,CANCELLED:100};
function progress(status:string){return PROGRESS[status]??10}
function ini(name?:string){return String(name||'?').split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'?'}
