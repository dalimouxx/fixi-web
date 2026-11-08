import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {WindowsLabelStudio} from './labels';
import {TicketPrint,type ReceiptData} from './TicketV4';
import {TicketSearchV4} from './TicketSearchV4';
import {CustomerDisplay,publishDisplay,CashCounter,ZReport,ZButton,methodLabel,type CashSummary} from './counter';
import {AtelierApp,switchSpace} from './atelier';
import {FreeItemDialog,DiscountDialog,SettingsDialog,NewProductDialog,type DiscountLine,type NewProduct} from './dialogs';
import {matchScore} from './search';
import {readJson,writeJson,defaultSettings,SETTINGS_KEY,type Settings} from './storage';
import {waPhone,ticketMessage,waUrl} from './whatsapp';
import {useArabic} from './i18n';
import {InvoiceDialog,InvoicePrint,PaymentSlip,type InvoiceData,type PaymentSlipData} from './invoice';
import {InventoryPage} from './inventory';
import {StockInPage,findByCode} from './stock-in';
import {ManageModule,ApprovalDialog,ALL_PERMS,pageAllowed,type Perm,type ManagePage} from './manage';
import {BadgePercent as NavPrice,ShoppingBasket as NavBuy,Receipt as NavExpense,FileText as NavDoc,Route as NavRoute,ChartColumn as NavChart,UsersRound as NavTeam,Warehouse as NavDepot,ShieldCheck as NavShield} from 'lucide-react';
import {ReportDialog} from './report';
import {Banknote,BookOpen,Boxes,Check,ChevronRight,CircleAlert,CircleCheck,CreditCard,Delete,HandCoins,Inbox,KeyRound,Landmark,Lock,LockOpen,LogIn,Minus,PackageOpen,PackageSearch,PanelLeftClose,PanelLeftOpen,Plus,Power,Printer,ReceiptText,RefreshCw,ScanBarcode,Search,ShieldCheck,ShoppingCart,Tags,Trash2,TriangleAlert,Truck,Undo2,UserPlus,UserRound,UserRoundCog,Users,Wallet,X,PencilLine,Percent,PauseCircle,PlayCircle,Settings2,WifiOff,CloudUpload,MessageCircle,Download,Flame,ClipboardList,FileText,type LucideIcon,PackagePlus,Wrench} from 'lucide-react';
import '@fontsource-variable/manrope';
import {FixiLogo,categoryLook,Clock} from './brand';
import './style.css';
import './v4.css';
import './v5.css';
import './fixi-max.css';

type Product={id:string;name:string;sku:string;barcode?:string|null;category:string|null;price:number;wholesalePrice?:number|null;minStock?:number;stock:number;sold30?:number;onHand?:number;tiers?:{minQty:number;unitPrice:number}[]};
type Customer={id:string;name:string;phone?:string|null;taxId?:string|null;address?:string|null;creditLimit?:number;priceMode?:string;discountPct?:number;due?:number};
type Boot={companyName:string;role:string;perms?:Perm[];discountLimitPct?:number;products:Product[];customers:Customer[];pinConfigured?:boolean;receiptProfile?:import('./TicketV4').ReceiptBusinessProfile|null;account?:{id:string;fullName:string}};
type CustomLine={id:string;name:string;price:number;quantity:number};
type SaleItem={productId:string;quantity:number;unitPrice:number;extra?:number}|{custom:true;name:string;quantity:number;unitPrice:number};
type QueuedSale={reference:string;createdAt:string;payload:{reference:string;items:SaleItem[];customerId:string|null;paid:number;method:string;discount:number};ticket:ReceiptData;stock:Record<string,number>;error?:string};
type Parked={id:string;at:string;label:string;cart:Record<string,number>;custom:CustomLine[];linePrice:Record<string,number>;discount:number;customerId:string;priceMode:'RETAIL'|'WHOLESALE'};
type SavedProfile={configured:boolean;server?:string;login?:string;profiles?:{login:string;name:string;server:string}[]};
type Order={id:string;customer:string;createdAt:string;status:string;items:{name:string;sku:string;quantity:number}[]};
type Debt={id:string;reference:string;customer:string;total:number;paid:number;due:number};
type CustomerDebt={customerId:string;customer:string;phone:string;due:number;invoices:number};
type TicketSearch={id:string;reference:string;createdAt:string;customer:string;phone:string;total:number;paid:number;status:string;items:{name:string;sku:string|null;quantity:number;price:number}[]};
type CourierShift={id:string;status:string;expectedCod:number;declaredRemit:number;openedAt:string;submittedAt?:string;driver?:{fullName:string;phone?:string}|null};
type ReturnLine={id:string;name:string;quantity:number;remaining:number;unitPrice:number};
type SaleSource={id:string;reference:string;total:number;items:ReturnLine[]};
type Credit={id:string;reference:string;sourceRef:string;total:number;refund:number;status:string;createdAt:string};
type Hist={sales:{id:string;reference:string;total:number;paid:number;status:string;createdAt:string}[];sessions:{id:string;status:string;openedAt:string;closedAt?:string}[]};
type Draft={cart:Record<string,number>;customerId:string;amount:string;method:string;reference:string;priceMode?:'RETAIL'|'WHOLESALE';custom?:CustomLine[];linePrice?:Record<string,number>;discount?:number};
type DebtRequest={saleId?:string;customerId?:string;amount:number;method:string;reference:string};
type ReturnRequest={sourceSaleId:string;items:{saleItemId:string;quantity:number;restock:boolean;condition:string;reason:string}[];refund:number;refundMethod:string;note:string;reference:string};
type Result={exists:boolean;reference:string;record?:{reference?:string;remaining?:number}|null};
type Page='caisse'|'produits'|'stock'|'clients'|'commandes'|'dettes'|'retours'|'historique'|'session'|'livreurs'|'inventaire'|'entree'|ManagePage;
const MANAGE_PAGES:Page[]=['gestion','achats','depenses','documents','livraison','rapports','equipe','depots','droits'];
// Isolé (\u2066…\u2069) pour que « 185,000 DT » reste lisible en arabe.
const money=(n:number)=>'\u2066'+new Intl.NumberFormat('fr-TN',{minimumFractionDigits:3,maximumFractionDigits:3}).format(n)+' DT\u2069';
/** Adresse du serveur proposée à la connexion : fixée à la construction (variable FIXI_PUBLIC_URL de GitHub), modifiable dans l'écran de connexion. */
const initialServer=((import.meta as any).env?.VITE_FIXI_SERVER as string|undefined)||'https://fixi-web.onrender.com';
type NavItem={id:Page;icon:LucideIcon;label:string;hint?:string};
const nav:NavItem[]=[
 {id:'caisse',icon:ShoppingCart,label:'Caisse'},
 {id:'historique',icon:ReceiptText,label:'Tickets & ventes',hint:'Retrouver une vente et réimprimer son ticket.'},
 {id:'retours',icon:Undo2,label:'Retours & avoirs',hint:'Scannez le ticket du client, puis choisissez les articles rendus.'},
 {id:'session',icon:Wallet,label:'Session de caisse',hint:'Ouvrez la caisse le matin, clôturez-la le soir.'},
 {id:'clients',icon:Users,label:'Clients',hint:'Créez un client et vendez-lui directement.'},
 {id:'dettes',icon:HandCoins,label:'Dettes clients',hint:'Ce que chaque client doit encore, et ses versements.'},
 {id:'commandes',icon:Inbox,label:'Commandes en ligne',hint:'Confirmez, préparez, puis passez au livreur.'},
 {id:'livreurs',icon:Truck,label:'Recettes livreurs',hint:'Comptez l’argent rapporté par chaque livreur.'},
 {id:'produits',icon:BookOpen,label:'Catalogue',hint:'Prix détail et gros de chaque article.'},
 {id:'stock',icon:Boxes,label:'Stock',hint:'Les ruptures d’abord.'},
 {id:'inventaire',icon:ClipboardList,label:'Inventaire',hint:'Scannez les articles du rayon, comparez avec le stock FIXI, corrigez.'},
 {id:'entree',icon:PackagePlus,label:'Entrée de stock',hint:'Scannez la marchandise reçue : 1 scan = +1 pièce, puis validez.'},
 {id:'gestion',icon:NavPrice,label:'Produits & prix',hint:'Modifier, archiver, promotions, prix par quantité, catégories.'},
 {id:'achats',icon:NavBuy,label:'Achats & fournisseurs',hint:'Vos achats chez les grossistes, ce que vous leur devez.'},
 {id:'depenses',icon:NavExpense,label:'Dépenses',hint:'Loyer, transport, salaires… pour connaître le vrai bénéfice.'},
 {id:'documents',icon:NavDoc,label:'Factures & devis',hint:'Devis, proformas, bons de livraison : créer, imprimer, transformer.'},
 {id:'livraison',icon:NavRoute,label:'Attribuer les livraisons',hint:'Confiez chaque commande prête à un livreur.'},
 {id:'rapports',icon:NavChart,label:'Rapports & bénéfice',hint:'Chiffre d’affaires, marge, meilleures ventes, stock.'},
 {id:'equipe',icon:NavTeam,label:'Équipe',hint:'Employés, rôles, mots de passe.'},
 {id:'depots',icon:NavDepot,label:'Dépôts',hint:'Stock par dépôt et transferts.'},
 {id:'droits',icon:NavShield,label:'Rôles & code gérant',hint:'Ce que votre rôle permet, code gérant, limite de remise.'},
];
const navGroups:{label:string;items:Page[]}[]=[
 {label:'Vente',items:['caisse','historique','retours','session']},
 {label:'Clients',items:['clients','dettes']},
 {label:'Livraison',items:['commandes','livraison','livreurs']},
 {label:'Articles',items:['produits','stock','entree','inventaire','gestion','depots']},
 {label:'Gestion',items:['achats','depenses','documents','rapports']},
 {label:'Compte',items:['equipe','droits']},
];
const demo:Boot={companyName:'Mode démonstration',role:'DEMO',products:[
 {id:'d1',name:'Écran Samsung A04',sku:'A04-LCD',price:89,stock:12,category:'Afficheurs'},
 {id:'d2',name:'Écran Samsung A06',sku:'A06-LCD',price:105,stock:4,category:'Afficheurs'},
 {id:'d3',name:'Batterie iPhone',sku:'IP-BAT',price:42,stock:0,category:'Batteries'}],customers:[]};
function App(){
 const [profile,setProfile]=useState<SavedProfile|null>(null);
 const [server,setServer]=useState(initialServer),[login,setLogin]=useState(''),[password,setPassword]=useState(''),[pin,setPin]=useState(''),[passwordMode,setPasswordMode]=useState(false);
 const [boot,setBoot]=useState<Boot|null>(null),[page,setPage]=useState<Page>('caisse'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 // Droits du rôle connecté (envoyés par le serveur) : menus et boutons affichés en conséquence. Le serveur revérifie tout.
 const perms:Perm[]=!boot?[]:boot.role==='DEMO'||!boot.perms?ALL_PERMS:boot.perms;
 // Code gérant : une action réservée (remise au-delà de la limite, remboursement) est autorisée sur place.
 const [approval,setApproval]=useState<{perm:'discount'|'refund';reason:string;resolve:(t:string|null)=>void}|null>(null);
 const askApproval=(perm:'discount'|'refund',reason:string)=>new Promise<string|null>(resolve=>setApproval({perm,reason,resolve}));
 const needsApproval=(msg:string)=>/code gérant/i.test(msg);
 useEffect(()=>{if(boot&&!pageAllowed(page,perms)){const first=navGroups.flatMap(g=>g.items).find(id=>pageAllowed(id,perms));if(first)setPage(first)}},[boot?.role,perms.join()]);// eslint-disable-line react-hooks/exhaustive-deps
 const [draftKey,setDraftKey]=useState(''),[cart,setCart]=useState<Record<string,number>>({}),[customerId,setCustomerId]=useState(''),[paid,setPaid]=useState(''),[method,setMethod]=useState('CASH'),[saleRef,setSaleRef]=useState('');
 const [scan,setScan]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState('Tous'),[labels,setLabels]=useState(false);
 const [setupPin,setSetupPin]=useState(''),[lockPin,setLockPin]=useState(''),[locked,setLocked]=useState(false),[pinConfigured,setPinConfigured]=useState(false);
 const [orders,setOrders]=useState<Order[]>([]),[debts,setDebts]=useState<Debt[]>([]),[sources,setSources]=useState<SaleSource[]>([]),[credits,setCredits]=useState<Credit[]>([]),[history,setHistory]=useState<Hist|null>(null);
 const [debtSale,setDebtSale]=useState(''),[debtAmount,setDebtAmount]=useState(''),[debtMethod,setDebtMethod]=useState('CASH'),[debtPending,setDebtPending]=useState<DebtRequest|null>(null);
 const [returnSale,setReturnSale]=useState(''),[returnQty,setReturnQty]=useState<Record<string,number>>({}),[returnDamage,setReturnDamage]=useState(false),[refund,setRefund]=useState('0'),[refundMethod,setRefundMethod]=useState('CASH'),[returnNote,setReturnNote]=useState('Retour client'),[returnPending,setReturnPending]=useState<ReturnRequest|null>(null);
 const [cashAmount,setCashAmount]=useState(''),[cashNote,setCashNote]=useState('');
 const [ticket,setTicket]=useState<ReceiptData|null>(null),[priceMode,setPriceMode]=useState<'RETAIL'|'WHOLESALE'>('RETAIL');
 const [receiptWarning,setReceiptWarning]=useState(''),[printRequest,setPrintRequest]=useState(0);
 const [customerDebts,setCustomerDebts]=useState<CustomerDebt[]>([]),[clientDebtId,setClientDebtId]=useState('');
 const [newClientName,setNewClientName]=useState(''),[newClientPhone,setNewClientPhone]=useState(''),[newClientAddress,setNewClientAddress]=useState('');
 const [ticketQuery,setTicketQuery]=useState(''),[ticketFrom,setTicketFrom]=useState(''),[ticketTo,setTicketTo]=useState('');
 const [ticketMatches,setTicketMatches]=useState<TicketSearch[]>([]);
 const [courierShifts,setCourierShifts]=useState<CourierShift[]>([]),[selectedShift,setSelectedShift]=useState(''),[courierAmount,setCourierAmount]=useState(''),[courierNote,setCourierNote]=useState('');
 const [givenCash,setGivenCash]=useState('');
 const [compact,setCompact]=useState(()=>{try{return localStorage.getItem('fixi:v5:compact')==='1'}catch{return false}});
 // Supplément « passager » : ajouté au prix atelier, tracé au serveur, jamais visible sur le ticket.
 const [walkIn,setWalkIn]=useState(false),[extra,setExtra]=useState<Record<string,number>>({}),[sugg,setSugg]=useState<{byProduct:Record<string,number>;byCategory:Record<string,number>}>({byProduct:{},byCategory:{}});
 const [custom,setCustom]=useState<CustomLine[]>([]),[linePrice,setLinePrice]=useState<Record<string,number>>({}),[cartDiscount,setCartDiscount]=useState(0);
 const [totp,setTotp]=useState('');const [needTotp,setNeedTotp]=useState(false);
 const [dialog,setDialog]=useState<''|'free'|'discount'|'settings'|'parked'|'product'>('');const [newCode,setNewCode]=useState('');
 const [parked,setParked]=useState<Parked[]>([]),[queue,setQueue]=useState<QueuedSale[]>([]),[offline,setOffline]=useState(false),[syncing,setSyncing]=useState(false);
 const [settings,setSettingsState]=useState<Settings>(()=>({...defaultSettings,...readJson<Partial<Settings>>(SETTINGS_KEY,{})}));
 const [version,setVersion]=useState(''),[update,setUpdate]=useState<{version:string;url:string;sha256:string;notes?:string}|null>(null),[updating,setUpdating]=useState(false);
 const [cashSummary,setCashSummary]=useState<CashSummary|null>(null),[zData,setZData]=useState<CashSummary|null>(null);
 const [invoiceFor,setInvoiceFor]=useState<{reference:string;customer?:Customer|null}|null>(null),[invoiceData,setInvoiceData]=useState<InvoiceData|null>(null),[paySlip,setPaySlip]=useState<PaymentSlipData|null>(null),[reportOpen,setReportOpen]=useState(false),[gridLimit,setGridLimit]=useState(120);
 const gridEnd=useRef<HTMLDivElement>(null);
 const [me,setMe]=useState(''),[cashier,setCashier]=useState(''),[pickLogin,setPickLogin]=useState(''),[lockSwitch,setLockSwitch]=useState('');
 const scanRef=useRef<HTMLInputElement>(null);
 const saleRefFn=useRef<()=>void>(()=>{});
 const queued=useMemo(()=>{const m:Record<string,number>={};for(const q of queue)for(const [id,n] of Object.entries(q.stock))m[id]=(m[id]||0)+n;return m},[queue]);
 // Le stock affiché retire les ventes hors ligne pas encore envoyées, même après une synchronisation.
 const products=useMemo(()=>(boot?.products||[]).map(p=>queued[p.id]?{...p,stock:Math.max(0,p.stock-queued[p.id])}:p),[boot,queued]);
 const entries=Object.entries(cart).filter(([id,q])=>q>0&&products.some(p=>p.id===id)).map(([id,quantity])=>({product:products.find(p=>p.id===id)!,quantity}));
 const cust=boot?.customers.find(c=>c.id===customerId);
 // Prix de base : tarif détail/gros, palier de quantité s'il est plus bas, puis remise négociée du client.
 const basePrice=(p:Product,qty=cart[p.id]||1)=>{
  let v=priceMode==='WHOLESALE'&&p.wholesalePrice!==null&&p.wholesalePrice!==undefined?p.wholesalePrice:p.price;
  for(const t of p.tiers||[])if(qty>=t.minQty&&t.unitPrice>0&&t.unitPrice<v)v=t.unitPrice;
  const pct=Math.min(50,Math.max(0,Number(cust?.discountPct||0)));
  return Math.round(v*(1-pct/100)*1000)/1000;
 };
 const suggestFor=(p:Product)=>sugg.byProduct[p.id]??(p.category?sugg.byCategory[p.category]:undefined)??0;
 const extraFor=(p:Product)=>walkIn?Math.max(0,extra[p.id]??suggestFor(p)):0;
 const priceFor=(p:Product)=>linePrice[p.id]!==undefined&&linePrice[p.id]>0?linePrice[p.id]:basePrice(p);
 const subtotal=useMemo(()=>Math.round((entries.reduce((v,x)=>v+x.quantity*(priceFor(x.product)+extraFor(x.product)),0)+custom.reduce((v,c)=>v+c.price*c.quantity,0))*1000)/1000,[entries,custom,priceMode,linePrice,walkIn,extra,sugg]);
 const walkInTotal=Math.round(entries.reduce((v,x)=>v+x.quantity*extraFor(x.product),0)*1000)/1000;
 useEffect(()=>{if(!entries.length&&!custom.length){setExtra({});setWalkIn(false)}},[entries.length,custom.length]);
 useEffect(()=>{if(!walkIn||!boot||boot.role==='DEMO')return;void invoke<any>('supplier_api',{method:'GET',path:'/api/supplier/walk-in-suggestions',body:null}).then(j=>j&&setSugg({byProduct:j.byProduct||{},byCategory:j.byCategory||{}})).catch(()=>{})},[walkIn]);
 const discountValue=Math.min(subtotal,Math.max(0,cartDiscount));
 const total=Math.round((subtotal-discountValue)*1000)/1000;
 const lineCount=entries.length+custom.length;
 const canDiscount=['OWNER','ADMIN','MANAGER','DEMO'].includes(boot?.role||'');
 // Gérant et responsable stock : création de pièces depuis la caisse (le serveur revérifie le rôle).
 const canCreateProduct=['OWNER','ADMIN','MANAGER','STOCK','DEMO'].includes(boot?.role||'');const canCreateRef=useRef(false);canCreateRef.current=canCreateProduct;
 const serverOrigin=profile?.server||server;
 const logo=useMemo(()=>{const u=boot?.receiptProfile?.logoUrl;if(!u)return undefined;try{const x=new URL(u,serverOrigin);return x.protocol==='https:'||x.protocol==='data:'?x.href:undefined}catch{return undefined}},[boot?.receiptProfile?.logoUrl,serverOrigin]);
 const setSettings=(x:Settings)=>{setSettingsState(x);writeJson(SETTINGS_KEY,x)};
 useArabic(settings.lang==='ar');
 const amount=paid.trim()===''?total:Number(paid);
 const due=Math.max(0,total-(Number.isFinite(amount)?amount:0));
 const categories=['Tous',...new Set(products.map(p=>p.category||'Autres'))];
 const visible=useMemo(()=>products.map(p=>({p,score:(category==='Tous'||category==='Top'?true:(p.category||'Autres')===category)&&(category!=='Top'||(p.sold30||0)>0)?matchScore(search,[p.name,p.sku,p.barcode,p.category]):0}))
  .filter(x=>x.score>0).sort((a,b)=>search?b.score-a.score||(b.p.sold30||0)-(a.p.sold30||0):(b.p.sold30||0)-(a.p.sold30||0)||a.p.name.localeCompare(b.p.name,'fr')).map(x=>x.p),[products,search,category]);
 const hasTop=products.some(p=>(p.sold30||0)>0);
 const low=products.filter(p=>p.stock<=(p.minStock??5));
 const focusScan=()=>{if(page==='caisse'&&!locked&&!labels)requestAnimationFrame(()=>scanRef.current?.focus())};
 useEffect(()=>{void invoke<SavedProfile>('supplier_saved_profile').then(p=>{setProfile(p);if(p.configured){setServer(p.server||initialServer);setLogin(p.login||'');setPickLogin(p.login||'')}}).catch(()=>setProfile({configured:false}))},[]);
 useEffect(()=>{void invoke<string>('app_version').then(setVersion).catch(()=>{});const t=window.setTimeout(()=>void checkUpdate(true),8000);return()=>window.clearTimeout(t)},[]);
 useEffect(()=>{const root=document.documentElement;const dark=settings.theme==='dark'||(settings.theme==='auto'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);root.dataset.theme=dark?'dark':'light'},[settings.theme]);
 useEffect(()=>{if(!draftKey||!boot||boot.role==='DEMO')return;
  try{const d:Draft={cart,customerId,amount:paid,method,reference:saleRef,priceMode,custom,linePrice,discount:cartDiscount};localStorage.setItem(draftKey,JSON.stringify(d))}
  catch{setError('Impossible de conserver le panier sur cet ordinateur.')}
 },[draftKey,boot,cart,customerId,paid,method,saleRef,priceMode,custom,linePrice,cartDiscount]);
 useEffect(()=>{if(!draftKey)return;setParked(readJson<Parked[]>(draftKey+':parked',[]));setQueue(readJson<QueuedSale[]>(draftKey+':queue',[]))},[draftKey]);
 const saveParked=(list:Parked[])=>{setParked(list);if(draftKey)writeJson(draftKey+':parked',list)};
 const saveQueue=(list:QueuedSale[])=>{setQueue(list);if(draftKey&&!writeJson(draftKey+':queue',list))setError('Stockage local plein : synchronisez les ventes hors ligne.')};
 useEffect(()=>{if(!draftKey)return;try{
   const debt=localStorage.getItem(draftKey+':debt');setDebtPending(debt?JSON.parse(debt):null);
   const ret=localStorage.getItem(draftKey+':return');setReturnPending(ret?JSON.parse(ret):null)
 }catch{setError('Une opération sauvegardée ne peut pas être lue. Vérifiez le journal fournisseur.')}},[draftKey]);
 useEffect(()=>{focusScan()},[page,locked,labels,boot]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='F2'&&boot&&!locked){e.preventDefault();setPage('caisse');requestAnimationFrame(()=>scanRef.current?.focus())}
   if(e.key==='F9'&&boot&&!locked){e.preventDefault();saleRefFn.current()}
   if(e.key==='F4'&&boot&&!locked){e.preventDefault();setPage('caisse');setDialog('free')}
   if(e.key==='F6'&&boot&&!locked&&canCreateRef.current){e.preventDefault();setPage('caisse');setNewCode('');setDialog('product')}};
  window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)
 },[boot,locked]);
 function connectData(data:Boot,origin:string,user:string){
   const key='fixi:v4:draft:'+encodeURIComponent(origin.trim().toLowerCase())+':'+encodeURIComponent(user.trim().toLowerCase());
   let draft:Draft|null=null;
   try{
     const existing=localStorage.getItem(key);
     if(existing){draft=JSON.parse(existing)}
     else{
       // Import the previous FIXI V3 unpaid cart without deleting its backup.
       const oldKey='fixi:windows-pos:draft:v1:'+encodeURIComponent(origin.trim().toLowerCase())+':'+encodeURIComponent(user.trim().toLowerCase());
       const original=localStorage.getItem(oldKey);
       if(original){const old=JSON.parse(original);draft={cart:old.cart||{},customerId:old.customerId||'',amount:old.amount||'',method:old.payMethod||'CASH',reference:old.saleKey||'',priceMode:'RETAIL'}}
     }
   }catch{setError('Ancien panier illisible : ouvrez la V3 pour vérifier son contenu avant une vente.')}
   const saved:Record<string,number>={};
   if(draft?.cart)for(const [id,q] of Object.entries(draft.cart)){const prod=data.products.find(p=>p.id===id);if(prod&&Number.isInteger(q)&&q>0)saved[id]=Math.min(q,prod.stock)}
   setCart(saved);setCustomerId(data.customers.some(x=>x.id===draft?.customerId)?draft!.customerId:'');
   setCustom(Array.isArray(draft?.custom)?draft!.custom.filter(c=>c&&c.name&&c.price>0&&c.quantity>0):[]);setLinePrice(draft?.linePrice||{});setCartDiscount(Number(draft?.discount)||0);
   setCashier(data.account?.fullName||user);setMe(user.trim().toLowerCase());
   setPaid(draft?.amount||'');setPriceMode(draft?.priceMode==='WHOLESALE'?'WHOLESALE':'RETAIL');setMethod(['CASH','CARD','TRANSFER'].includes(draft?.method||'')?draft!.method:'CASH');
   setSaleRef(draft?.reference||'');setDraftKey(key);setBoot(data);setPage('caisse');setPinConfigured(Boolean(data.pinConfigured));setPassword('');setError('');setMessage(draft?.reference?'Vente interrompue à vérifier avant de continuer.':'');
 }
 // Double vérification (17.5) : le serveur demande un code à 6 chiffres sur un nouvel appareil.
 const twoFa=(e:unknown)=>{const t=String(e);if(t.startsWith('CODE_2FA_REQUIS')){setNeedTotp(true);return t.replace(/^CODE_2FA_REQUIS:\s*/,'')+' — ouvrez votre application d’authentification.'}return t};
 async function connect(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try{const data=await invoke<Boot>('supplier_login',{server,login,password,totp:totp||null});connectData(data,server,login);setTotp('');setNeedTotp(false);void invoke<SavedProfile>('supplier_saved_profile').then(setProfile).catch(()=>{})}
  catch(e){setError(twoFa(e));setTotp('')}finally{setBusy(false)}
 }
 async function quickLogin(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  const who=profile?.profiles?.find(x=>x.login===pickLogin)||profile?.profiles?.[0];
  try{const data=await invoke<Boot>('supplier_pin_login',{pin,login:who?.login||null,totp:totp||null});connectData({...data,pinConfigured:true},who?.server||profile?.server||server,who?.login||profile?.login||login);setPin('');setTotp('');setNeedTotp(false);void invoke<SavedProfile>('supplier_saved_profile').then(setProfile).catch(()=>{})}
  catch(e){const t=String(e);setError(twoFa(e));setTotp('');if(!t.startsWith('CODE_2FA_REQUIS'))setPin('')}finally{setBusy(false)}
 }
 async function refresh(){if(!boot||boot.role==='DEMO')return;setBusy(true);setError('');
  try{const data=await invoke<Boot>('supplier_refresh');setBoot({...data,pinConfigured});setMessage('Catalogue synchronisé. Panier conservé.')}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function load(target:Page){if(!boot||boot.role==='DEMO')return;
  setError('');try{
   if(target==='commandes'){const data=await invoke<{orders:Order[]}>('supplier_orders');setOrders(data.orders)}
   if(target==='dettes'){
    const [old,grouped]=await Promise.all([
      invoke<{debts:Debt[]}>('supplier_debts'),
      invoke<{customers:CustomerDebt[]}>('supplier_customer_debts')
    ]);
    setDebts(old.debts);setCustomerDebts(grouped.customers)
   }
   if(target==='retours'){const data=await invoke<{sales:SaleSource[];returns:Credit[]}>('supplier_returns');setSources(data.sales);setCredits(data.returns)}
   if(target==='historique'||target==='session'){setHistory(await invoke<Hist>('supplier_history'))}
   if(target==='session'){setCashSummary(await invoke<CashSummary>('supplier_cash_summary',{session:null}).catch(()=>null))}
   if(target==='livreurs'){const shifts=await invoke<CourierShift[]>('supplier_delivery_shifts');setCourierShifts(shifts)}
  }catch(e){setError(String(e))}
 }
 useEffect(()=>{if(page!=='commandes'||!boot||boot.role==='DEMO')return;
  const interval=window.setInterval(()=>{void invoke<{orders:Order[]}>('supplier_orders').then(data=>setOrders(data.orders)).catch(()=>{})},20000);
  return()=>window.clearInterval(interval)
 },[page,boot?.role]);
 function navigate(target:Page){setPage(target);setSearch('');setMessage('');void load(target)}
 function add(id:string,delta:number){
   if(busy||saleRef){setError('Une vente est en cours ou à vérifier. Le panier est verrouillé.');return}
   const p=products.find(x=>x.id===id);if(!p)return;
   if(delta>0&&(cart[id]||0)>=p.stock){setError('Stock insuffisant pour '+p.name);return}
   setCart(c=>({...c,[id]:Math.max(0,(c[id]||0)+delta)}));setError('');focusScan()
 }
 function barcode(){const value=scan.trim().toLowerCase();if(!value)return;
  // Code tapé à la main si la douchette ne marche pas : espaces et majuscules ignorés (« 0000 a04 » = 0000A04).
  const p=findByCode(products,value);
  if(p){add(p.id,1);setSearch('');setMessage(p.name+' ajouté au panier')}
  else if(canCreateProduct&&!saleRef){setNewCode(scan.trim());setDialog('product');setScan('');return}
  else setError('Code-barres introuvable : '+scan+(canCreateProduct?'':' — demandez au gérant de créer la pièce.'));
  setScan('');focusScan()
 }
 async function createProduct(x:NewProduct,addToCart:boolean){
  let created:Product;
  if(boot?.role==='DEMO')created={id:'demo-'+Date.now(),name:x.name,sku:'NEW-'+String(Date.now()).slice(-4),barcode:x.barcode||null,category:null,price:x.price,stock:x.stock,onHand:x.stock,sold30:0};
  else{const r=await invoke<any>('supplier_create_product',{product:x});
   created={id:r.id,name:r.name,sku:r.sku,barcode:r.barcode,category:r.category,price:Number(r.retailPrice??r.price),wholesalePrice:r.wholesalePrice==null?null:Number(r.wholesalePrice),minStock:r.minStock||0,stock:Math.max(0,Number(r.stock)-Number(r.reservedStock||0)),onHand:Number(r.stock),sold30:0,tiers:[]}}
  setBoot(b=>b?{...b,products:[created,...b.products.filter(p=>p.id!==created.id)]}:b);
  if(addToCart&&created.stock>0)setCart(c=>({...c,[created.id]:(c[created.id]||0)+1}));
  setMessage(created.name+' créé'+(addToCart&&created.stock>0?' et ajouté au panier':'')+' · '+created.sku);focusScan();
 }
 function localClearSale(){setGivenCash('');setCart({});setCustom([]);setLinePrice({});setCartDiscount(0);setCustomerId('');setPaid('');setSaleRef('');setSearch('')}
 const isOffline=(msg:string)=>/Connexion interrompue|HTTP 50[234]|Délai dépassé|Serveur inaccessible|Connexion HTTPS impossible|Erreur réseau/i.test(msg);
 function saleItems():SaleItem[]{return [...entries.map(e=>({productId:e.product.id,quantity:e.quantity,unitPrice:priceFor(e.product),...(extraFor(e.product)>0?{extra:extraFor(e.product)}:{})})),...custom.map(c=>({custom:true as const,name:c.name,quantity:c.quantity,unitPrice:c.price}))]}
 function receipt(reference:string,offlineSale=false):ReceiptData{return {reference,lines:[...entries.map(x=>({name:x.product.name,quantity:x.quantity,price:priceFor(x.product)+extraFor(x.product)})),...custom.map(c=>({name:c.name,quantity:c.quantity,price:c.price}))],
  paid:amount,total,discount:discountValue||undefined,company:boot!.companyName,profile:boot!.receiptProfile,date:new Date().toLocaleString('fr-FR'),customer:boot!.customers.find(x=>x.id===customerId)?.name,cashier,offline:offlineSale,logo}}
 async function afterSale(t:ReceiptData,cashSale:boolean){
  setTicket(t);setPrintRequest(n=>n+1);
  if(cashSale&&settings.drawerAuto&&settings.drawerPrinter)void invoke('cash_drawer_open',{printer:settings.drawerPrinter}).catch(e=>setError('Tiroir-caisse : '+String(e)));
  const change=givenCash.trim()!==''&&Number.isFinite(given)?Math.max(0,given-t.paid):null;
  publishDisplay({company:boot!.companyName,logo,lines:[],discount:0,total:t.total,given:null,change:null,thanks:change!==null&&change>0?'Monnaie : '+money(change):'Merci !'});
 }
 async function sale(replay=false){
  if(!boot||busy||boot.role==='DEMO'||!lineCount||(saleRef&&!replay))return;
  if(!Number.isFinite(amount)||amount<0||amount>total+0.0005){setError('Montant payé incorrect.');return}
  if(amount<total&&!customerId){setError('Sélectionnez un client pour une vente à crédit.');return}
  const reference=saleRef||'WIN-'+crypto.randomUUID();
  if(!replay&&!window.confirm('Confirmer la vente de '+money(total)+' ?'))return;
  try{if(!draftKey)throw Error('Profil de caisse absent');localStorage.setItem(draftKey,JSON.stringify({cart,customerId,amount:paid,method,reference,priceMode,custom,linePrice,discount:cartDiscount}))}
  catch{setError('Impossible de protéger le panier localement : vente non envoyée.');return}
  const payload={reference,items:saleItems(),customerId:customerId||null,paid:Math.min(amount,total),method,discount:discountValue};
  setSaleRef(reference);setBusy(true);setError('');setMessage('');
  try{const result=await invoke<{reference?:string}>('supplier_checkout',{sale:payload}).catch(async e=>{const m=String(e);if(!needsApproval(m))throw e;const token=await askApproval('discount',m);if(!token)throw Error('Vente annulée : remise non autorisée.');return invoke<{reference?:string}>('supplier_checkout',{sale:{...payload,approval:token}})});
   await afterSale(receipt(result.reference||reference),method==='CASH'&&amount>0);
   setOffline(false);setMessage('Vente enregistrée : '+(result.reference||reference));localClearSale();await refresh();focusScan()
  }catch(e){const msg=String(e);
   if(isOffline(msg)){
    // Pas de réseau : la vente part dans la file locale et sera renvoyée avec la même référence (pas de doublon possible).
    const t=receipt(reference,true);
    saveQueue([...queue.filter(q=>q.reference!==reference),{reference,createdAt:new Date().toISOString(),payload,ticket:t,stock:Object.fromEntries(entries.map(x=>[x.product.id,x.quantity]))}]);
    await afterSale(t,method==='CASH'&&amount>0);setOffline(true);localClearSale();
    setMessage('Pas de connexion : vente gardée sur ce PC, envoi automatique au retour d’Internet.');focusScan()
   }else{setError(msg);if(/HTTP 40[1349]|Vente refusée|Stock insuffisant/i.test(msg)){setSaleRef('')}else setMessage('Vente à vérifier, référence conservée : '+reference)}}
  finally{setBusy(false)}
 }
 async function syncQueue(manual=false){
  if(syncing||!queue.length||!boot||boot.role==='DEMO')return;
  setSyncing(true);let list=[...queue],sent=0,stillOffline=false;
  for(const q of [...list]){
   if(q.error&&!manual)continue;
   try{await invoke('supplier_checkout',{sale:q.payload});list=list.filter(x=>x.reference!==q.reference);sent++}
   catch(e){const msg=String(e);if(isOffline(msg)){stillOffline=true;break}list=list.map(x=>x.reference===q.reference?{...x,error:msg}:x)}
  }
  saveQueue(list);setOffline(stillOffline);setSyncing(false);
  if(sent){setMessage(sent+' vente(s) hors ligne envoyée(s) à FIXI.');await refresh()}
  if(list.some(x=>x.error))setError('Une vente hors ligne a été refusée par le serveur : ouvrez « Ventes hors ligne » pour la régler.');
 }
 useEffect(()=>{if(!queue.length||!boot||boot.role==='DEMO')return;const t=window.setInterval(()=>void syncQueue(),30000);const on=()=>void syncQueue();window.addEventListener('online',on);return()=>{window.clearInterval(t);window.removeEventListener('online',on)}},[queue,boot,syncing]);
 function dropQueued(ref:string){if(!window.confirm('Supprimer cette vente hors ligne ? Elle ne sera jamais envoyée à FIXI.'))return;saveQueue(queue.filter(q=>q.reference!==ref))}
 function chooseCustomer(id:string){setCustomerId(id);const c=boot?.customers.find(x=>x.id===id);if(c?.priceMode)setPriceMode(c.priceMode==='WHOLESALE'?'WHOLESALE':'RETAIL')}
 async function updateCustomer(c:Customer,patch:Partial<Customer>){setError('');try{await invoke('supplier_update_customer',{customer:{id:c.id,...patch}});setBoot(b=>b?{...b,customers:b.customers.map(x=>x.id===c.id?{...x,...patch}:x)}:b);setMessage('Client '+c.name+' mis à jour.')}catch(e){setError(String(e))}}
 function park(){
  if(!lineCount||saleRef)return;
  const name=boot?.customers.find(c=>c.id===customerId)?.name;
  const item:Parked={id:crypto.randomUUID(),at:new Date().toISOString(),label:name||('Client '+(parked.length+1)),cart,custom,linePrice,discount:cartDiscount,customerId,priceMode};
  saveParked([item,...parked].slice(0,12));localClearSale();setMessage('Panier mis en attente. Servez le client suivant.');focusScan()
 }
 function resume(id:string){
  const item=parked.find(x=>x.id===id);if(!item||saleRef)return;
  const rest=parked.filter(x=>x.id!==id);
  if(lineCount){const name=boot?.customers.find(c=>c.id===customerId)?.name;rest.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),label:name||('Client '+(parked.length+1)),cart,custom,linePrice,discount:cartDiscount,customerId,priceMode})}
  const safe:Record<string,number>={};for(const [pid,q] of Object.entries(item.cart)){const prod=products.find(p=>p.id===pid);if(prod&&q>0)safe[pid]=Math.min(q,prod.stock)}
  setCart(safe);setCustom(item.custom||[]);setLinePrice(item.linePrice||{});setCartDiscount(item.discount||0);setCustomerId(boot?.customers.some(c=>c.id===item.customerId)?item.customerId:'');setPriceMode(item.priceMode||'RETAIL');setPaid('');setGivenCash('');
  saveParked(rest);setDialog('');setPage('caisse');focusScan()
 }
 async function checkUpdate(silent=false){
  try{const r=await invoke<{available:boolean;version?:string;url?:string;sha256?:string;notes?:string}>('check_update');
   if(r.available&&r.url&&r.sha256)setUpdate({version:r.version||'',url:r.url,sha256:r.sha256,notes:r.notes});else if(!silent)setMessage('FIXI Caisse est à jour.');
  }catch(e){if(!silent)setError(String(e))}
 }
 async function installUpdate(){if(!update)return;if(lineCount&&!window.confirm('Un panier est en cours : il sera gardé. Installer la mise à jour maintenant ?'))return;
  setUpdating(true);try{await invoke('install_update',{url:update.url,sha256:update.sha256})}catch(e){setError(String(e));setUpdating(false)}}
 function shareTicket(t:ReceiptData,phone?:string|null){
  let num=waPhone(phone||'');
  if(!num){const typed=window.prompt('Numéro WhatsApp du client (8 chiffres) :','');if(typed===null)return;num=waPhone(typed);if(!num){setError('Numéro WhatsApp invalide.');return}}
  void invoke('open_external',{url:waUrl(num,ticketMessage(t))}).catch(e=>setError(String(e)))
 }
 async function verify(kind:'sale'|'debt'|'return',reference:string){
  if(!reference)return;setBusy(true);setError('');
  try{const r=await invoke<Result>('supplier_operation_status',{kind,reference});
   if(!r.exists){setMessage('Aucune opération trouvée pour '+reference+'. Vous pouvez renvoyer la même demande.');return}
   if(kind==='sale'){localClearSale();await refresh();setMessage('Vente retrouvée sur FIXI Cloud : '+reference)}
   if(kind==='debt'){localStorage.removeItem(draftKey+':debt');setDebtPending(null);void load('dettes');setMessage('Règlement retrouvé : '+reference)}
   if(kind==='return'){localStorage.removeItem(draftKey+':return');setReturnPending(null);void load('retours');setMessage('Avoir retrouvé : '+reference)}
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function debtPay(op?:DebtRequest){
  if(busy||!boot)return;
  let request=op;
  if(!request){
   const c=customerDebts.find(x=>x.customerId===clientDebtId),v=Number(debtAmount);
   if(!c||!Number.isFinite(v)||v<=0||v>c.due){setError('Choisissez un client et un versement inférieur au solde total.');return}
   if(!window.confirm('Encaisser '+money(v)+' sur le compte '+c.customer+' (dette : '+money(c.due)+') ?'))return;
   request={customerId:c.customerId,amount:v,method:debtMethod,reference:'WINCUST-'+crypto.randomUUID()};
   try{localStorage.setItem(draftKey+':debt',JSON.stringify(request))}
   catch{setError('Sauvegarde locale impossible : aucun paiement envoyé');return}
   setDebtPending(request)
  }
  if(!request.customerId){setError('Ancien versement par facture en attente : vérifiez-le sur FIXI Supplier avant de commencer un règlement global.');return}
  setBusy(true);setError('');
  try{
   const r=await invoke<{remaining:number;allocated:number}>('supplier_customer_payment',{payment:request});
   localStorage.removeItem(draftKey+':debt');setDebtPending(null);setDebtAmount('');
   setMessage('Règlement global confirmé : '+money(request.amount)+' sur '+r.allocated+' facture(s). Solde : '+money(r.remaining));
   const who=customerDebts.find(x=>x.customerId===request!.customerId)?.customer||'Client';
   printSlip({company:boot.companyName,customer:who,amount:request.amount,method:request.method,allocated:r.allocated,remaining:r.remaining,reference:request.reference,date:new Date().toLocaleString('fr-FR'),cashier});
   await load('dettes')
  }catch(e){const msg=String(e);setError(msg);
   if(/HTTP 40[1349]|versement refusé|Montant non valide/i.test(msg)){localStorage.removeItem(draftKey+':debt');setDebtPending(null)}
  }finally{setBusy(false)}
 }
 async function searchTickets(q=ticketQuery,from=ticketFrom,to=ticketTo){
  if(!boot||boot.role==='DEMO')return;
  setBusy(true);setError('');
  try{const data=await invoke<{sales:TicketSearch[]}>('supplier_find_tickets',{query:q,from,to});
   setTicketMatches(data.sales);
   if(data.sales.length===0)setMessage('Aucun ticket trouvé pour ces critères.')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 function showTicket(x:TicketSearch){
  if(!boot)return;
  setTicket({reference:x.reference,company:boot.companyName,profile:boot.receiptProfile,date:new Date(x.createdAt).toLocaleString('fr-FR'),
   customer:x.customer,lines:x.items,total:x.total,paid:x.paid,logo});setPrintRequest(n=>n+1);
  setMessage('Ticket '+x.reference+' prêt à être réimprimé.')
 }
 async function selectReturnFromTicket(x:TicketSearch){
  setBusy(true);setError('');
  try{
   const result=await invoke<{sale:SaleSource}>('supplier_return_source',{reference:x.reference});
   setSources(rows=>[result.sale,...rows.filter(row=>row.id!==result.sale.id)]);
   setReturnSale(result.sale.id);setReturnQty({});
   setMessage('Vente '+x.reference+' chargée pour retour — vérifiez les articles et quantités.')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function createClient(){
  const name=newClientName.trim(),phone=newClientPhone.trim(),address=newClientAddress.trim();
  if(name.length<2){setError('Indiquez un nom de client valide.');return}
  if(!window.confirm('Créer le client '+name+' dans FIXI Supplier ?'))return;
  setBusy(true);setError('');
  try{
   const client=await invoke<Customer>('supplier_create_customer',{customer:{name,phone:phone||null,address:address||null}});
   const refreshed=await invoke<Boot>('supplier_refresh');
   setBoot({...refreshed,pinConfigured});setCustomerId(client.id);
   setNewClientName('');setNewClientPhone('');setNewClientAddress('');
   setMessage('Client '+name+' ajouté et sélectionné pour la caisse.');setPage('caisse')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function closeCourierShift(){
  if(!boot||busy)return;
  const shift=courierShifts.find(x=>x.id===selectedShift);
  const actual=Number(courierAmount);
  if(!shift||shift.status!=='PENDING_CASHIER'||!Number.isFinite(actual)||actual<0){setError('Sélectionnez une remise en attente et un montant reçu valide.');return}
  const expected=Number(shift.expectedCod||0);
  if(Math.abs(actual-expected)>=.001&&!courierNote.trim()){setError('Indiquez obligatoirement la raison de l’écart de caisse.');return}
  if(!window.confirm('Clôturer la recette livreur : attendu '+money(expected)+' / remis '+money(actual)+' ?'))return;
  setBusy(true);setError('');
  try{
   await invoke('supplier_delivery_close',{closure:{shiftId:shift.id,actualAmount:actual,note:courierNote.trim()}});
   setMessage('Remise livreur clôturée et rattachée à votre session de caisse.');
   setSelectedShift('');setCourierAmount('');setCourierNote('');await load('livreurs')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function returnPay(op?:ReturnRequest){
  if(busy||!boot)return;
  let request=op;
  if(!request){const sale=sources.find(x=>x.id===returnSale);
   if(!sale){setError('Sélectionnez la vente d’origine.');return}
   const lines=sale.items.filter(i=>(returnQty[i.id]||0)>0).map(i=>({saleItemId:i.id,quantity:returnQty[i.id],restock:!returnDamage,condition:returnDamage?'DAMAGED':'BON',reason:returnNote}));
   if(!lines.length||lines.some(i=>i.quantity>(sale.items.find(x=>x.id===i.saleItemId)?.remaining??0))){setError('Quantités retournables invalides.');return}
   const val=Number(refund);if(!Number.isFinite(val)||val<0){setError('Montant du remboursement incorrect.');return}
   if(!window.confirm('Créer l’avoir et enregistrer le remboursement '+money(val)+' ?'))return;
   request={reference:'WINRET-'+crypto.randomUUID(),sourceSaleId:sale.id,items:lines,refund:val,refundMethod,note:returnNote};
   try{localStorage.setItem(draftKey+':return',JSON.stringify(request))}catch{setError('Sauvegarde locale impossible. Retour non envoyé.');return}
   setReturnPending(request)
  }
  setBusy(true);setError('');
  try{await invoke('supplier_return_create',{request}).catch(async e=>{const m=String(e);if(!needsApproval(m))throw e;const token=await askApproval('refund',m);if(!token)throw Error('Retour annulé : remboursement non autorisé.');return invoke('supplier_return_create',{request:{...request,approval:token}})});localStorage.removeItem(draftKey+':return');setReturnPending(null);setReturnSale('');setReturnQty({});setMessage('Retour enregistré : '+request.reference);await load('retours')}
  catch(e){const msg=String(e);setError(msg);if(/HTTP 40[1349]|Retour refusé/i.test(msg)){localStorage.removeItem(draftKey+':return');setReturnPending(null)}}
  finally{setBusy(false)}
 }
 async function orderTransition(o:Order){const target:Record<string,string>={PENDING:'CONFIRMED',CONFIRMED:'PREPARING',PREPARING:'READY_FOR_DELIVERY'};
  if(!target[o.status]||busy)return;if(!window.confirm('Passer cette commande à '+target[o.status]+' ?'))return;
  setBusy(true);setError('');try{await invoke('supplier_order_transition',{orderId:o.id,status:target[o.status]});setMessage('Commande mise à jour');await load('commandes')}catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function cash(action:'CASH_OPEN'|'CASH_CLOSE'){const n=Number(cashAmount);if(cashAmount.trim()===''||!Number.isFinite(n)||n<0){setError('Saisissez un montant de caisse valide.');return}
  if(!window.confirm(action==='CASH_OPEN'?'Ouvrir la caisse ?':'Clôturer cette caisse ?'))return;
  setBusy(true);setError('');try{await invoke('supplier_cash_action',{operation:{action,[action==='CASH_OPEN'?'openingAmount':'closingAmount']:n,note:cashNote}});setMessage('Session de caisse mise à jour.');setCashAmount('');setCashNote('');await load('session')}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function changePin(){if(setupPin.length!==4)return;setBusy(true);setError('');
  try{await invoke('pin_setup',{pin:setupPin,name:cashier||null});setPinConfigured(true);void invoke<SavedProfile>('supplier_saved_profile').then(setProfile).catch(()=>{});setSetupPin('');setMessage('Code PIN protégé dans Windows.')}
  catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function lock(){setError('');try{await invoke('pin_lock');setLocked(true);setLockPin('')}catch(e){setError(String(e))}}
 async function unlock(e:React.FormEvent){e.preventDefault();try{await invoke('pin_unlock',{pin:lockPin});setLocked(false);setLockPin('');focusScan()}catch(e){setError(String(e));setLockPin('')}}
 async function logout(){if(!window.confirm('Retirer '+(cashier||'ce caissier')+' de ce PC ? Son code PIN sera effacé (son compte FIXI reste intact).'))return;try{await invoke('supplier_logout')}catch(e){setError(String(e));return}
  setBoot(null);setDraftKey('');setPasswordMode(false);setLocked(false);setSaleRef('');setCart({});setCustom([]);setDialog('');
  void invoke<SavedProfile>('supplier_saved_profile').then(p=>{setProfile(p);setPickLogin('')}).catch(()=>setProfile({configured:false}))}
 function printTicket(){
  if(!ticket)return;
  document.body.dataset.printMode='ticket';
  window.addEventListener('afterprint',()=>{delete document.body.dataset.printMode;
    setReceiptWarning('Vérifiez que le ticket est bien sorti de l’imprimante. Sinon utilisez Réimprimer.');},{once:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))
 }
 const canRefund=['OWNER','ADMIN','MANAGER'].includes(boot?.role||'');
 useEffect(()=>{
  if(!ticket||printRequest===0)return;
  document.body.dataset.printMode='ticket';
  const clean=()=>{delete document.body.dataset.printMode;setReceiptWarning('Ticket imprimé ou dialogue fermé : vérifiez la sortie papier, réimprimez si nécessaire.')};
  window.addEventListener('afterprint',clean,{once:true});
  requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))
 },[ticket?.reference,printRequest]);
 saleRefFn.current=()=>{if(page==='caisse')void sale()};
 useEffect(()=>{try{localStorage.setItem('fixi:v5:compact',compact?'1':'0')}catch{}},[compact]);
 useEffect(()=>{setGridLimit(120)},[search,category]);
 useEffect(()=>{const el=gridEnd.current;if(!el)return;const io=new IntersectionObserver(e=>{if(e[0]?.isIntersecting)setGridLimit(n=>n+120)},{rootMargin:'400px'});io.observe(el);return()=>io.disconnect()},[visible.length,gridLimit,page]);
 useEffect(()=>{if(!message)return;const t=window.setTimeout(()=>setMessage(''),5000);return()=>window.clearTimeout(t)},[message]);
 useEffect(()=>{if(!boot||!settings.customerDisplay||!lineCount)return;const g=Number(givenCash.replace(',','.'));const hasGiven=givenCash.trim()!==''&&Number.isFinite(g);
  publishDisplay({company:boot.companyName,logo,lines:[...entries.map(x=>({name:x.product.name,quantity:x.quantity,price:priceFor(x.product)+extraFor(x.product)})),...custom.map(c=>({name:c.name,quantity:c.quantity,price:c.price}))],discount:discountValue,total,given:hasGiven?g:null,change:hasGiven?Math.round((g-total)*1000)/1000:null})
 },[cart,custom,linePrice,cartDiscount,total,givenCash,settings.customerDisplay,boot]);
 useEffect(()=>{if(boot&&boot.role!=='DEMO'&&settings.customerDisplay)void invoke('open_customer_display').catch(()=>{})},[boot?.companyName]);
 useEffect(()=>{if(boot&&!pinConfigured&&boot.role!=='DEMO'&&cashier)setMessage('Activez un code PIN (en haut) pour ouvrir la caisse en 2 secondes la prochaine fois.')},[boot?.companyName]);
 function printSlip(x:PaymentSlipData){setZData(null);setPaySlip(x);document.body.dataset.printMode='z';window.addEventListener('afterprint',()=>{delete document.body.dataset.printMode},{once:true});requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))}
 function printInvoice(x:InvoiceData){setInvoiceData(x);document.body.dataset.printMode='invoice';window.addEventListener('afterprint',()=>{delete document.body.dataset.printMode},{once:true});requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))}
 function printZ(data:CashSummary){setPaySlip(null);setZData(data);document.body.dataset.printMode='z';window.addEventListener('afterprint',()=>{delete document.body.dataset.printMode},{once:true});requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))}
 async function closeWithCount(counted:number,note:string){
  if(!window.confirm('Clôturer la caisse avec '+money(counted)+' comptés ?'))return;
  const id=cashSummary?.session?.id||null;setBusy(true);setError('');
  try{await invoke('supplier_cash_action',{operation:{action:'CASH_CLOSE',closingAmount:counted,note}});
   const z=await invoke<CashSummary>('supplier_cash_summary',{session:id}).catch(()=>null);
   setMessage('Caisse clôturée.');if(z)printZ(z);await load('session')
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function switchCashier(){if(lineCount&&!window.confirm('Le panier reste gardé pour ce caissier. Changer de caissier ?'))return;
  try{await invoke('supplier_switch_user')}catch{}
  setBoot(null);setDraftKey('');setLocked(false);setSaleRef('');setCart({});setCustom([]);setPin('');setPasswordMode(false);
  void invoke<SavedProfile>('supplier_saved_profile').then(p=>{setProfile(p);setPickLogin('')}).catch(()=>{})
 }
 async function unlockAs(e:React.FormEvent){e.preventDefault();if(!lockSwitch||lockSwitch===me)return unlock(e);
  const who=profile?.profiles?.find(x=>x.login===lockSwitch);setBusy(true);setError('');
  try{const data=await invoke<Boot>('supplier_pin_login',{pin:lockPin,login:lockSwitch,totp:null});connectData({...data,pinConfigured:true},who?.server||serverOrigin,lockSwitch);setLocked(false);setLockPin('');setLockSwitch('')}
  catch(err){setError(String(err));setLockPin('')}finally{setBusy(false)}
 }
 const pendingOrders=orders.filter(o=>o.status==='PENDING').length;
 const cartCount=entries.reduce((n,e)=>n+e.quantity,0);
 const given=Number(givenCash.replace(',','.'));
 const change=method==='CASH'&&givenCash.trim()!==''&&Number.isFinite(given)?given-(Number.isFinite(amount)?amount:0):null;
 const quickCash=[...new Set([Math.ceil(total),Math.ceil(total/5)*5,Math.ceil(total/10)*10,Math.ceil(total/50)*50].filter(v=>v>0))].slice(0,4);
 const current=nav.find(n=>n.id===page);
 if(!boot&&profile===null)return <div className="v7-splash"><FixiLogo size={96}/><b>FIXI Caisse</b><i/></div>;
 if(!boot)return <div className="v5-login">
  <div className="v5-login-identity"><FixiLogo size={72} className="v7-logo--hero"/><h1>FIXI Caisse</h1><p>La caisse Windows des fournisseurs Fixi.</p>
   <ul><li><ScanBarcode size={18}/> Scanner rapide, panier gardé même après coupure</li><li><Wallet size={18}/> Ventes, dettes clients et retours au même endroit</li><li><Printer size={18}/> Tickets et étiquettes code-barres</li></ul></div>
  <div className="v5-login-panel">{profile?.configured&&!passwordMode?
   <form onSubmit={quickLogin} className="v5-card v5-login-form"><h2>Bonjour 👋</h2>
    {(profile.profiles?.length||0)>1?<><p>Qui ouvre la caisse ?</p><div className="v6-cashiers" role="radiogroup" aria-label="Caissier">{profile.profiles!.map(x=><button type="button" role="radio" key={x.login} aria-checked={(pickLogin||profile.profiles![0].login)===x.login} onClick={()=>{setPickLogin(x.login);setPin('')}}><span className="v6-avatar">{(x.name||x.login).slice(0,1).toUpperCase()}</span><b>{x.name||x.login}</b></button>)}</div></>
    :<p>Ouvrir la caisse de <strong>{profile.profiles?.[0]?.name||profile.login}</strong></p>}
    <PinPad value={pin} onChange={setPin} autoFocus/>
    {needTotp&&<label className="v5-field"><span>Code de vérification</span><input className="v6-totp" autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>}
    <button disabled={busy||pin.length!==4||(needTotp&&totp.length!==6)} className="v5-btn v5-btn--primary v5-btn--lg">{busy?'Ouverture…':'Ouvrir la caisse'}</button>
    <div className="v6-login-links"><button type="button" className="v5-link" onClick={()=>{setPasswordMode(true);setLogin('');setPassword('')}}><UserPlus size={15}/> Ajouter un caissier</button><button type="button" className="v5-link v5-link--muted" onClick={()=>{setPasswordMode(true);setLogin(pickLogin||profile.login||'')}}>Mot de passe</button></div></form>:
   <form onSubmit={connect} className="v5-card v5-login-form"><h2>{profile?.configured?'Ajouter un caissier':'Connexion'}</h2><p>{profile?.configured?'Avec son propre compte FIXI Supplier (créé par le gérant dans Équipe).':'Avec votre compte FIXI Supplier.'}</p>
    <label className="v5-field"><span>Identifiant</span><input autoFocus required value={login} onChange={e=>setLogin(e.target.value)} autoComplete="username"/></label>
    <label className="v5-field"><span>Mot de passe</span><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
    {needTotp&&<label className="v5-field"><span>Code de vérification</span><input className="v6-totp" autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>}
    <details className="v5-advanced"><summary>Serveur</summary><label className="v5-field"><span>Adresse du serveur FIXI</span><input type="url" required value={server} onChange={e=>setServer(e.target.value)}/></label></details>
    <button disabled={busy} className="v5-btn v5-btn--primary v5-btn--lg"><LogIn size={18}/> {busy?'Connexion…':'Se connecter'}</button>
    {profile?.configured&&<button type="button" className="v5-link" onClick={()=>setPasswordMode(false)}>Revenir au code PIN</button>}</form>}
   {error&&<p role="alert" className="v5-alert v5-alert--danger">{error}</p>}
   <button className="v5-link v5-link--muted" onClick={()=>{setBoot(demo);setPage('caisse')}}>Essayer sans connexion (démonstration)</button><button className="v5-link" onClick={()=>switchSpace('atelier')}><Wrench size={15}/> Je suis un atelier de réparation</button></div></div>;
 return <div className={'v4-app v5-app'+(page==='caisse'?' is-checkout':'')+(compact?' is-compact':'')}>
  <aside className="v5-side">
   <div className="v5-brand"><FixiLogo size={40}/><div className="v5-brand-text"><strong>FIXI</strong><small>Caisse</small></div>
    <button className="v5-icon-btn v5-side-toggle" title={compact?'Agrandir le menu':'Réduire le menu'} aria-label={compact?'Agrandir le menu':'Réduire le menu'} onClick={()=>setCompact(v=>!v)}>{compact?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button></div>
   <nav className="v5-nav" aria-label="Menu">{navGroups.map(g=>({...g,items:g.items.filter(id=>pageAllowed(id,perms))})).filter(g=>g.items.length).map(g=><div key={g.label} className="v5-nav-group"><span className="v5-nav-heading">{g.label}</span>
    {g.items.map(id=>{const item=nav.find(n=>n.id===id)!;const I=item.icon;return <button key={id} title={item.label} aria-current={page===id?'page':undefined} className="v5-nav-item" onClick={()=>navigate(id)}><I size={19}/><span>{item.label}</span>{id==='commandes'&&pendingOrders>0&&<b>{pendingOrders}</b>}</button>})}</div>)}</nav>
   <div className="v5-account"><span className="v5-led" aria-hidden/><div><strong>{cashier||boot.companyName}</strong><small>{boot.role==='DEMO'?'Démonstration':(roleLabel[boot.role]||boot.role)+' · '+boot.companyName}</small></div>
    <div className="v5-account-actions"><button className="v5-icon-btn" title="Changer de caissier" aria-label="Changer de caissier" disabled={boot.role==='DEMO'} onClick={()=>void switchCashier()}><UserRoundCog size={17}/></button><button className="v5-icon-btn" title="Réglages" aria-label="Réglages" onClick={()=>setDialog('settings')}><Settings2 size={17}/></button><button className="v5-icon-btn" title="Fermer FIXI Caisse" aria-label="Fermer FIXI Caisse" onClick={()=>void getCurrentWindow().close()}><Power size={17}/></button></div></div>
  </aside>
  <main className="v5-main">
   <header className="v5-header"><Clock/><div className="v7-title"><h1>{page==='caisse'?'Caisse':current?.label}</h1>{current?.hint&&<p>{current.hint}</p>}</div><div className="v5-toolbar">
    {(offline||queue.length>0)&&<button className={'v5-btn v6-offline'+(queue.some(q=>q.error)?' is-error':'')} onClick={()=>setDialog('parked')} title="Ventes hors ligne">{offline?<WifiOff size={16}/>:<CloudUpload size={16}/>} {offline?'Hors ligne':'À envoyer'}{queue.length>0&&<b>{queue.length}</b>}</button>}
    <button className="v5-btn v5-btn--ghost" onClick={()=>void refresh()} disabled={busy||boot.role==='DEMO'} title="Recharger produits, prix et stock"><RefreshCw size={16} className={busy?'v5-spin':''}/> Synchroniser</button>
    <button className="v5-btn v5-btn--ghost" onClick={()=>setLabels(true)}><Tags size={16}/> Étiquettes</button>
    {pinConfigured?<button className="v5-btn v5-btn--ghost" onClick={()=>void lock()} title="Verrouiller la caisse (code PIN)"><Lock size={16}/> Verrouiller</button>:boot.role!=='DEMO'?<div className="v5-pin-setup"><input type="password" inputMode="numeric" maxLength={4} value={setupPin} onChange={e=>setSetupPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="PIN 4 chiffres" aria-label="Nouveau code PIN"/><button className="v5-btn v5-btn--ghost" disabled={busy||setupPin.length!==4} onClick={()=>void changePin()}><KeyRound size={16}/> Activer</button></div>:null}
   </div></header>
   {update&&<div className="v6-update"><Download size={18}/><span><b>FIXI Caisse {update.version} est disponible.</b> {update.notes||'Nouvelles fonctions et corrections.'}</span><button className="v5-btn v5-btn--primary v5-btn--sm" disabled={updating} onClick={()=>void installUpdate()}>{updating?'Téléchargement…':'Mettre à jour'}</button><button className="v5-icon-btn" aria-label="Plus tard" onClick={()=>setUpdate(null)}><X size={15}/></button></div>}
   {error&&<div role="alert" className="v5-alert v5-alert--danger"><CircleAlert size={18}/><span>{error}</span><button aria-label="Fermer" onClick={()=>setError('')}><X size={16}/></button></div>}
   {page==='caisse'&&<>
    <div className="v5-scan"><ScanBarcode size={22}/><input ref={scanRef} autoFocus placeholder="Scannez ou tapez une référence (F2)" value={scan} onChange={e=>setScan(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')barcode();if(e.key==='Escape')setScan('')}}/><button className="v5-btn v5-btn--primary" onClick={barcode}><Plus size={18}/> Ajouter</button></div>
    {low.length>0&&boot.role!=='DEMO'&&<button className="v5-low" onClick={()=>navigate('stock')}><TriangleAlert size={17}/><span><b>{low.filter(p=>p.stock===0).length} en rupture</b> · {low.length} stock(s) faible(s)</span><ChevronRight size={16}/></button>}
    <div className="v5-filters"><label className="v5-search"><Search size={17}/><input placeholder="Chercher un produit…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Effacer" onClick={()=>setSearch('')}><X size={15}/></button>}</label>
     <div className="v5-seg" role="group" aria-label="Tarif" title={entries.length>0?'Videz le panier pour changer de tarif':'Tarif appliqué au panier'}>
      <button aria-pressed={priceMode==='RETAIL'} disabled={busy||!!saleRef||entries.length>0} onClick={()=>setPriceMode('RETAIL')}>Détail</button>
      <button aria-pressed={priceMode==='WHOLESALE'} disabled={busy||!!saleRef||entries.length>0} onClick={()=>setPriceMode('WHOLESALE')}>Gros</button></div>
     <button type="button" className={'v5-btn v5-btn--sm '+(walkIn?'v5-btn--primary':'v5-btn--ghost')} aria-pressed={walkIn} disabled={busy||!!saleRef} onClick={()=>setWalkIn(v=>!v)} title="Client de passage : ajouter un supplément au prix atelier (non visible sur le ticket)">Passager{walkIn&&walkInTotal>0?' +'+money(walkInTotal):''}</button></div>
    <div className="v5-chips">{hasTop&&<button aria-pressed={category==='Top'} onClick={()=>setCategory('Top')}><Flame size={14}/> Les plus vendus</button>}{categories.map(x=><button key={x} aria-pressed={x===category} onClick={()=>setCategory(x)}>{x}<small>{x==='Tous'?products.length:products.filter(p=>(p.category||'Autres')===x).length}</small></button>)}</div>
    {visible.length===0?<div className="v5-empty"><PackageSearch size={40}/><h3>Aucun produit</h3><p>Essayez un autre mot ou une autre catégorie.</p></div>:
    <section className="v5-products">{visible.slice(0,gridLimit).map(p=>{const inCart=cart[p.id]||0;return <button key={p.id} disabled={p.stock<=0||busy||!!saleRef} className={'v5-product'+(inCart?' is-in-cart':'')} style={{['--cat' as any]:categoryLook(p.category,p.name).color}} onClick={()=>add(p.id,1)}>
     {inCart>0&&<span className="v5-product-qty">{inCart}</span>}
     {(()=>{const {Icon,color}=categoryLook(p.category,p.name);return <span className="v7-cat" style={{['--cat' as any]:color}}><Icon size={15}/>{p.category||'Autres'}</span>})()}<strong>{p.name}</strong><small className="v5-mono">{p.sku}</small>
     <span className="v5-product-foot"><b>{money(priceFor(p))}</b><span className={'v5-stock '+(p.stock===0?'is-out':p.stock<=(p.minStock??5)?'is-low':'')}>{p.stock===0?'Rupture':p.stock}</span></span>
     {priceMode==='RETAIL'&&p.wholesalePrice!=null&&<small className="v5-product-alt">Gros {money(p.wholesalePrice)}</small>}{priceMode==='WHOLESALE'&&<small className="v5-product-alt">Détail {money(p.price)}</small>}
    </button>})}</section>}
    {visible.length>gridLimit&&<div ref={gridEnd} className="v6-grid-more"><button className="v5-btn v5-btn--ghost" onClick={()=>setGridLimit(n=>n+120)}>Afficher plus ({visible.length-gridLimit})</button></div>}
   </>}
   {page==='produits'&&<section className="v5-card"><label className="v5-search v5-search--panel"><Search size={17}/><input placeholder="Chercher par nom ou référence" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Produit</th><th>Référence</th><th>Catégorie</th><th className="num">Prix détail</th><th className="num">Prix gros</th><th className="num">Disponible</th></tr></thead><tbody>{products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(search.toLowerCase())).map(p=><tr key={p.id}><td><b>{p.name}</b></td><td className="v5-mono">{p.sku}</td><td>{p.category||'—'}</td><td className="num">{money(p.price)}</td><td className="num">{p.wholesalePrice===undefined||p.wholesalePrice===null?'—':money(p.wholesalePrice)}</td><td className="num"><span className={'v5-stock '+(p.stock===0?'is-out':p.stock<=(p.minStock??5)?'is-low':'')}>{p.stock}</span></td></tr>)}</tbody></table></div></section>}
   {page==='stock'&&<section className="v5-card"><div className="v5-kpis"><div className="v5-kpi is-danger"><span>En rupture</span><b>{products.filter(p=>p.stock===0).length}</b></div><div className="v5-kpi is-warning"><span>Stock faible</span><b>{products.filter(p=>p.stock>0&&p.stock<=(p.minStock??5)).length}</b></div><div className="v5-kpi"><span>Articles</span><b>{products.length}</b></div></div>
    <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Produit</th><th>Référence</th><th className="num">Disponible</th><th>État</th></tr></thead><tbody>{[...products].sort((a,b)=>a.stock-b.stock).map(p=><tr key={p.id}><td><b>{p.name}</b></td><td className="v5-mono">{p.sku}</td><td className="num"><b>{p.stock}</b></td><td>{p.stock===0?<Chip tone="danger">Rupture</Chip>:p.stock<=(p.minStock??5)?<Chip tone="warning">Stock faible</Chip>:<Chip tone="ok">Disponible</Chip>}</td></tr>)}</tbody></table></div></section>}
   {page==='clients'&&<section className="v5-card">
    <h2 className="v5-card-title"><UserPlus size={19}/> Nouveau client</h2>
    <div className="v5-form-row">
     <label className="v5-field"><span>Nom ou société *</span><input placeholder="Nom du client" value={newClientName} onChange={e=>setNewClientName(e.target.value)} maxLength={120}/></label>
     <label className="v5-field"><span>Téléphone</span><input placeholder="+216 …" value={newClientPhone} onChange={e=>setNewClientPhone(e.target.value)} maxLength={30}/></label>
     <label className="v5-field"><span>Adresse</span><input placeholder="Facultatif" value={newClientAddress} onChange={e=>setNewClientAddress(e.target.value)} maxLength={220}/></label>
     <button className="v5-btn v5-btn--primary" disabled={busy||boot.role==='DEMO'||newClientName.trim().length<2} onClick={()=>void createClient()}><Plus size={17}/> Ajouter</button>
    </div>
    <h2 className="v5-card-title">Clients <small>{boot.customers.length}</small></h2>
    {boot.customers.length===0?<Empty icon={Users} title="Aucun client" text="Ajoutez votre premier client ci-dessus."/>:
    <div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Client</th><th>Tarif · remise · plafond</th><th className="act"></th></tr></thead><tbody>
    {boot.customers.map(c=><tr key={c.id}><td><b>{c.name}</b><small>{[c.phone,c.taxId?'MF '+c.taxId:''].filter(Boolean).join(' · ')}{Number(c.due)>0?' · doit '+money(Number(c.due)):''}</small></td>
     <td>{canDiscount&&boot.role!=='DEMO'?<div className="v6-client-terms"><select aria-label={'Tarif '+c.name} value={c.priceMode||'RETAIL'} onChange={e=>void updateCustomer(c,{priceMode:e.target.value})}><option value="RETAIL">Détail</option><option value="WHOLESALE">Gros</option></select>
      <label><input type="number" min={0} max={50} step={0.5} defaultValue={Number(c.discountPct||0)} onBlur={e=>{const v=Number(e.target.value);if(v!==Number(c.discountPct||0))void updateCustomer(c,{discountPct:v})}} aria-label={'Remise '+c.name}/> %</label>
      <label>Plafond <input type="number" min={0} step={10} defaultValue={Number(c.creditLimit||0)} onBlur={e=>{const v=Number(e.target.value);if(v!==Number(c.creditLimit||0))void updateCustomer(c,{creditLimit:v})}} aria-label={'Plafond '+c.name}/></label></div>
      :<small>{c.priceMode==='WHOLESALE'?'Gros':'Détail'}{Number(c.discountPct)>0?' · -'+c.discountPct+' %':''}</small>}</td>
     <td className="act"><button className="v5-btn v5-btn--soft v5-btn--sm" onClick={()=>{chooseCustomer(c.id);setPage('caisse')}}><ShoppingCart size={15}/> Vendre</button></td></tr>)}
    </tbody></table></div>}</section>}
   {page==='commandes'&&<section><div className="v5-section-head"><p>Mise à jour automatique toutes les 20 secondes.</p><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>void load('commandes')}><RefreshCw size={15}/> Actualiser</button></div>
    {orders.length===0?<div className="v5-card"><Empty icon={Inbox} title="Aucune commande en attente" text="Les commandes des ateliers arrivent ici."/></div>:
    <div className="v5-orders">{orders.map(o=><article className="v5-card v5-order" key={o.id} data-status={o.status}><header><div><strong>{o.customer}</strong><small>{new Date(o.createdAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</small></div><StatusChip status={o.status}/></header>
     <ul>{o.items.map((i,n)=><li key={n}><span>{i.name}<small className="v5-mono">{i.sku}</small></span><b>× {i.quantity}</b></li>)}</ul>
     {['PENDING','CONFIRMED','PREPARING'].includes(o.status)?<button className="v5-btn v5-btn--primary" disabled={busy} onClick={()=>void orderTransition(o)}>{o.status==='PENDING'?<><Check size={17}/> Confirmer</>:o.status==='CONFIRMED'?<><PackageOpen size={17}/> Commencer la préparation</>:<><Truck size={17}/> Prête pour le livreur</>}</button>:<p className="v5-order-wait"><Truck size={16}/> En attente du livreur</p>}</article>)}</div>}</section>}
   {page==='dettes'&&<section className="v5-stack">
    {debtPending&&<Risk title="Versement à vérifier" text={debtPending.reference+' · '+money(debtPending.amount)}><button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy} onClick={()=>void verify('debt',debtPending.reference)}>Vérifier</button><button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy||!debtPending.customerId} onClick={()=>void debtPay(debtPending)}>Renvoyer le même paiement</button></Risk>}
    <div className="v5-kpis"><div className="v5-kpi is-warning"><span>Total dû par les clients</span><b>{money(customerDebts.reduce((t,c)=>t+c.due,0))}</b></div><div className="v5-kpi"><span>Clients avec dette</span><b>{customerDebts.length}</b></div></div>
    <div className="v5-card"><h2 className="v5-card-title"><HandCoins size={19}/> Encaisser un versement</h2><p className="v5-hint">La somme règle d’abord les factures les plus anciennes.</p>
     <div className="v5-form-row">
      <label className="v5-field v5-field--wide"><span>Client</span><select disabled={busy||!!debtPending} value={clientDebtId} onChange={e=>setClientDebtId(e.target.value)}>
       <option value="">Choisir le client</option>{customerDebts.map(c=><option key={c.customerId} value={c.customerId}>{c.customer} · {money(c.due)} ({c.invoices} facture{c.invoices>1?'s':''})</option>)}
      </select></label>
      <label className="v5-field"><span>Montant (DT)</span><input disabled={busy||!!debtPending} type="number" min=".001" step=".001" value={debtAmount} onChange={e=>setDebtAmount(e.target.value)} placeholder="0,000"/></label>
      <MethodSeg value={debtMethod} onChange={setDebtMethod} disabled={busy||!!debtPending}/>
      <button className="v5-btn v5-btn--primary" disabled={busy||!!debtPending||!clientDebtId||boot.role==='DEMO'} onClick={()=>void debtPay()}><Check size={17}/> Encaisser</button>
     </div></div>
    <div className="v5-card">{customerDebts.length===0?<Empty icon={HandCoins} title="Aucune dette" text="Tous les clients sont à jour."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Client</th><th>Téléphone</th><th className="num">Factures</th><th className="num">Dette</th><th className="act"></th></tr></thead><tbody>
    {customerDebts.map(c=><tr key={c.customerId} className={clientDebtId===c.customerId?'is-selected':''}><td><b>{c.customer}</b></td><td>{c.phone||'—'}</td><td className="num">{c.invoices}</td><td className="num"><b className="v5-due-amount">{money(c.due)}</b></td>
     <td className="act"><button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy||!!debtPending} onClick={()=>{setClientDebtId(c.customerId);setDebtAmount(String(c.due))}}>Recevoir</button></td></tr>)}
    </tbody></table></div>}</div></section>}
   {page==='retours'&&<section className="v5-stack">
    <div className="v5-card"><h2 className="v5-card-title"><Search size={19}/> Retrouver la vente</h2>
    <TicketSearchV4 query={ticketQuery} from={ticketFrom} to={ticketTo} busy={busy} results={ticketMatches}
     onQuery={setTicketQuery} onFrom={setTicketFrom} onTo={setTicketTo} onSearch={()=>void searchTickets()}
     onPrint={showTicket} onReturn={x=>void selectReturnFromTicket(x)}/></div>
    {returnPending&&<Risk title="Avoir à vérifier" text={returnPending.reference}><button className="v5-btn v5-btn--soft v5-btn--sm" onClick={()=>void verify('return',returnPending.reference)}>Vérifier dans FIXI</button><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>void returnPay(returnPending)}>Renvoyer le même retour</button></Risk>}
    {canRefund?<div className="v5-card"><h2 className="v5-card-title"><Undo2 size={19}/> Retour et avoir</h2>
     <div className="v5-form-row"><label className="v5-field v5-field--wide"><span>Vente d’origine</span><select disabled={!!returnPending} value={returnSale} onChange={e=>{setReturnSale(e.target.value);setReturnQty({})}}><option value="">Choisir la vente</option>{sources.map(s=><option key={s.id} value={s.id}>{s.reference} · {money(s.total)}</option>)}</select></label></div>
     {returnSale&&<div className="v5-return-lines">{sources.find(s=>s.id===returnSale)?.items.map(i=><div key={i.id} className={'v5-return-line'+((returnQty[i.id]||0)>0?' is-on':'')}><span><b>{i.name}</b><small>{i.remaining} retournable(s) · {money(i.unitPrice)}</small></span>
      <Stepper value={returnQty[i.id]||0} max={i.remaining} onChange={v=>setReturnQty(q=>({...q,[i.id]:v}))}/></div>)}</div>}
     <div className="v5-form-row">
      <div className="v5-field v5-field--wide"><span>État du produit</span><div className="v5-seg v5-seg--block" role="group"><button aria-pressed={!returnDamage} title="Remis en stock" onClick={()=>setReturnDamage(false)}>Bon état</button><button aria-pressed={returnDamage} title="Mis de côté, hors stock" onClick={()=>setReturnDamage(true)}>Endommagé</button></div></div>
      <label className="v5-field"><span>Motif</span><input value={returnNote} onChange={e=>setReturnNote(e.target.value)}/></label>
      <label className="v5-field"><span>Remboursement (DT)</span><input type="number" min="0" step=".001" value={refund} onChange={e=>setRefund(e.target.value)}/></label>
      <MethodSeg value={refundMethod} onChange={setRefundMethod}/>
      <button disabled={busy||!returnSale||!!returnPending} className="v5-btn v5-btn--primary" onClick={()=>void returnPay()}><Check size={17}/> Confirmer le retour</button></div></div>:
     <div className="v5-alert v5-alert--info"><ShieldCheck size={18}/><span>Seuls le propriétaire, l’administrateur ou le responsable peuvent enregistrer un retour.</span></div>}
    <div className="v5-card"><h2 className="v5-card-title">Avoirs précédents</h2>{credits.length===0?<Empty icon={Undo2} title="Aucun avoir" text="Les retours enregistrés apparaîtront ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Avoir</th><th>Vente</th><th className="num">Montant</th><th className="num">Remboursé</th><th>État</th></tr></thead><tbody>{credits.map(x=><tr key={x.id}><td className="v5-mono"><b>{x.reference}</b></td><td className="v5-mono">{x.sourceRef}</td><td className="num">{money(x.total)}</td><td className="num">{money(x.refund)}</td><td><StatusChip status={x.status}/></td></tr>)}</tbody></table></div>}</div></section>}
   {page==='historique'&&<section className="v5-stack">
    <div className="v5-card"><h2 className="v5-card-title"><Search size={19}/> Rechercher un ticket</h2>
    <TicketSearchV4 query={ticketQuery} from={ticketFrom} to={ticketTo} busy={busy} results={ticketMatches}
     onQuery={setTicketQuery} onFrom={setTicketFrom} onTo={setTicketTo} onSearch={()=>void searchTickets()}
     onPrint={showTicket} onReturn={x=>{setPage('retours');void selectReturnFromTicket(x)}} onInvoice={x=>setInvoiceFor({reference:x.reference,customer:boot.customers.find(c=>c.name===x.customer)})} onShare={x=>shareTicket({reference:x.reference,company:boot.companyName,profile:boot.receiptProfile,date:new Date(x.createdAt).toLocaleString('fr-FR'),customer:x.customer,lines:x.items,total:x.total,paid:x.paid},x.phone)}/></div>
    <div className="v5-card"><div className="v5-card-head"><h2 className="v5-card-title">Dernières ventes</h2>{ticket&&<button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy} onClick={printTicket}><Printer size={15}/> Réimprimer {ticket.reference}</button>}</div>
    {!history?.sales.length?<Empty icon={ReceiptText} title="Aucune vente" text="Les ventes de la caisse apparaîtront ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Référence</th><th>Date</th><th className="num">Total</th><th className="num">Payé</th><th>État</th></tr></thead><tbody>
    {history.sales.map(x=><tr key={x.id}><td className="v5-mono"><b>{x.reference}</b></td><td>{new Date(x.createdAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</td><td className="num">{money(x.total)}</td><td className="num">{money(x.paid)}</td><td><StatusChip status={x.status}/></td></tr>)}
    </tbody></table></div>}</div></section>}
   {page==='session'&&<section className="v5-stack">{(()=>{const open=history?.sessions.find(s=>s.status==='OPEN');return <div className={'v5-session '+(open?'is-open':'is-closed')}><span className="v5-session-icon">{open?<LockOpen size={24}/>:<Lock size={24}/>}</span><div><b>{open?'Caisse ouverte':'Caisse fermée'}</b><small>{open?'Depuis le '+new Date(open.openedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'Ouvrez la caisse avant d’encaisser des espèces.'}</small></div></div>})()}
    {cashSummary?.session?.status==='OPEN'?<>
     <div className="v5-kpis"><div className="v5-kpi"><span>Fond de caisse</span><b>{money(cashSummary.session.opening)}</b></div><div className="v5-kpi"><span>Ventes de la session</span><b>{cashSummary.sales?.count||0}</b></div><div className="v5-kpi"><span>Encaissé (tous moyens)</span><b>{money(cashSummary.sales?.paid||0)}</b></div><div className="v5-kpi is-warning"><span>Espèces attendues</span><b>{money(cashSummary.expectedCash||0)}</b></div></div>
     <CashCounter expected={cashSummary.expectedCash??null} busy={busy||boot.role==='DEMO'} onClose={(n,note)=>void closeWithCount(n,note)}/>
     <div className="v6-actions"><ZButton disabled={busy} onPrint={()=>printZ(cashSummary)}/><small className="v5-hint">Rapport X : point de la journée sans clôturer.</small></div></>:
    <div className="v5-card"><h2 className="v5-card-title"><LockOpen size={19}/> Ouvrir la caisse</h2><div className="v5-form-row"><label className="v5-field"><span>Fond de caisse (DT)</span><input type="number" min="0" step=".001" value={cashAmount} onChange={e=>setCashAmount(e.target.value)} placeholder="0,000"/></label><label className="v5-field v5-field--wide"><span>Observation</span><input value={cashNote} onChange={e=>setCashNote(e.target.value)} placeholder="Facultatif"/></label>
     <button className="v5-btn v5-btn--primary" disabled={busy} onClick={()=>void cash('CASH_OPEN')}><LockOpen size={17}/> Ouvrir</button></div>
     {cashSummary?.session&&<div className="v6-actions"><ZButton disabled={busy} onPrint={()=>printZ(cashSummary)}/><small className="v5-hint">Rapport Z de la dernière clôture.</small></div>}</div>}
    <div className="v5-card"><h2 className="v5-card-title">Dernières sessions</h2>{!history?.sessions.length?<Empty icon={Wallet} title="Aucune session" text="Les ouvertures et clôtures apparaîtront ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Ouverture</th><th>Clôture</th><th>État</th></tr></thead><tbody>{history.sessions.map(x=><tr key={x.id}><td>{new Date(x.openedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</td><td>{x.closedAt?new Date(x.closedAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'—'}</td><td><StatusChip status={x.status}/></td></tr>)}</tbody></table></div>}</div></section>}
   {page==='livreurs'&&<section className="v5-stack">
    {courierShifts.filter(s=>s.status==='PENDING_CASHIER').length===0?<div className="v5-card"><Empty icon={Truck} title="Aucune recette en attente" text="Quand un livreur termine sa tournée, sa remise apparaît ici."/></div>:
    <div className="v5-shifts">{courierShifts.filter(s=>s.status==='PENDING_CASHIER').map(x=><button key={x.id} className={'v5-card v5-shift'+(selectedShift===x.id?' is-selected':'')} disabled={busy} onClick={()=>{setSelectedShift(x.id);setCourierAmount(String(x.expectedCod??''))}}><Truck size={20}/><span><b>{x.driver?.fullName||'Livreur'}</b><small>Déclaré {money(Number(x.declaredRemit||0))}</small></span><span className="v5-shift-amount"><small>Attendu</small><b>{money(Number(x.expectedCod||0))}</b></span></button>)}</div>}
    {selectedShift&&(()=>{const sh=courierShifts.find(x=>x.id===selectedShift);const diff=Number(courierAmount)-Number(sh?.expectedCod||0);return <div className="v5-card"><h2 className="v5-card-title"><HandCoins size={19}/> Recette de {sh?.driver?.fullName||'livreur'}</h2><div className="v5-form-row">
     <label className="v5-field"><span>Montant reçu (DT)</span><input min="0" step=".001" type="number" disabled={busy} value={courierAmount} onChange={e=>setCourierAmount(e.target.value)}/></label>
     <label className="v5-field v5-field--wide"><span>Raison de l’écart{Number.isFinite(diff)&&Math.abs(diff)>=.001?' *':''}</span><input value={courierNote} disabled={busy} onChange={e=>setCourierNote(e.target.value)} placeholder="Obligatoire si le montant est différent"/></label>
     <button className="v5-btn v5-btn--primary" disabled={busy||boot.role==='DEMO'} onClick={()=>void closeCourierShift()}><Check size={17}/> Clôturer la recette</button></div>
     {Number.isFinite(diff)&&Math.abs(diff)>=.001&&<p className={'v5-diff '+(diff<0?'is-neg':'is-pos')}>Écart : {diff>0?'+':''}{money(diff)}</p>}</div>})()}
    <div className="v5-card"><h2 className="v5-card-title">Remises livreurs</h2>{courierShifts.length===0?<Empty icon={Truck} title="Aucune remise" text="L’historique des remises apparaîtra ici."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Livreur</th><th className="num">Déclaré</th><th className="num">Attendu</th><th>État</th></tr></thead><tbody>{courierShifts.map(x=><tr key={x.id}><td><b>{x.driver?.fullName||'Livreur'}</b></td>
    <td className="num">{money(Number(x.declaredRemit||0))}</td><td className="num">{money(Number(x.expectedCod||0))}</td><td><StatusChip status={x.status}/></td></tr>)}</tbody></table></div>}</div>
   </section>}
   {MANAGE_PAGES.includes(page)&&<ManageModule page={page as ManagePage} perms={perms} products={products} customers={boot.customers||[]} demo={boot.role==='DEMO'} onError={setError} onMessage={setMessage} onCatalogChanged={()=>void refresh()}/>}
   {page==='entree'&&<StockInPage products={products} storageKey={(draftKey||'demo')+':stock-in'} demo={boot.role==='DEMO'} canEnter={['OWNER','ADMIN','MANAGER','DEMO'].includes(boot.role)} onDone={()=>void refresh()} onError={setError} onMessage={setMessage} onUnknown={code=>{setNewCode(code);setDialog('product')}}/>}
   {page==='inventaire'&&<InventoryPage products={products} storageKey={(draftKey||'demo')+':inventory'} demo={boot.role==='DEMO'} canClose={['OWNER','ADMIN','MANAGER','DEMO'].includes(boot.role)} onDone={()=>void refresh()} onError={setError} onMessage={setMessage}/>}
  </main>
  {page==='caisse'&&<aside className="v5-basket" aria-label="Panier">
   <div className="v5-basket-head"><h2><ShoppingCart size={20}/> Panier</h2><span className="v5-count">{cartCount+custom.reduce((n,c)=>n+c.quantity,0)} article{cartCount+custom.length>1?'s':''}</span>{lineCount>0&&!saleRef&&<button className="v5-icon-btn" title="Vider le panier" aria-label="Vider le panier" disabled={busy} onClick={()=>{if(window.confirm('Supprimer ce panier non payé ?')){localClearSale();setGivenCash('');setMessage('Panier vidé.');if(boot)publishDisplay({company:boot.companyName,logo,lines:[],discount:0,total:0,given:null,change:null})}}}><Trash2 size={17}/></button>}</div>
   <div className="v6-basket-tools"><button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy||!!saleRef} onClick={()=>setDialog('free')} title="F4"><PencilLine size={15}/> Article libre</button>{canCreateProduct&&<button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy||!!saleRef} onClick={()=>{setNewCode('');setDialog('product')}} title="F6 · réservé au gérant"><PackagePlus size={15}/> Nouvelle pièce</button>}
    {canDiscount&&<button className={'v5-btn v5-btn--sm '+(discountValue>0||Object.keys(linePrice).length?'v5-btn--soft':'v5-btn--ghost')} disabled={busy||!!saleRef||!lineCount} onClick={()=>setDialog('discount')}><Percent size={15}/> Remise</button>}
    <button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy||!!saleRef||!lineCount} onClick={park}><PauseCircle size={15}/> En attente</button></div>
   {parked.length>0&&<div className="v6-parked" aria-label="Paniers en attente">{parked.map(x=><button key={x.id} disabled={busy||!!saleRef} onClick={()=>resume(x.id)} title={'Reprendre · '+new Date(x.at).toLocaleTimeString('fr-FR',{timeStyle:'short'})}><PlayCircle size={14}/> {x.label}<small>{Object.values(x.cart).reduce((a,b)=>a+b,0)+(x.custom||[]).reduce((a,c)=>a+c.quantity,0)}</small></button>)}</div>}
   {saleRef&&<Risk title="Vente à vérifier" text={saleRef}><button className="v5-btn v5-btn--soft v5-btn--sm" disabled={busy} onClick={()=>void verify('sale',saleRef)}>Vérifier la vente</button><button className="v5-btn v5-btn--ghost v5-btn--sm" disabled={busy} onClick={()=>void sale(true)}>Renvoyer</button></Risk>}
   <div className="v5-basket-items">{lineCount?entries.map(e=><div className="v5-line" key={e.product.id}><div className="v5-line-info"><strong>{e.product.name}</strong><small>{money(priceFor(e.product))} l’unité{walkIn&&<label className="v6-extra" onClick={ev=>ev.stopPropagation()}> + <input inputMode="decimal" aria-label={'Supplément passager pour '+e.product.name} value={extra[e.product.id]??(suggestFor(e.product)||'')} placeholder="0" disabled={busy||!!saleRef} onChange={ev=>{const v=ev.target.value.replace(',','.');setExtra(x=>({...x,[e.product.id]:v===''?0:Math.max(0,Number(v)||0)}))}}/> DT</label>}</small></div>
    <Stepper value={e.quantity} max={e.product.stock} disabled={busy||!!saleRef} onChange={v=>add(e.product.id,v-e.quantity)}/>
    <b className="v5-line-total">{linePrice[e.product.id]!==undefined&&linePrice[e.product.id]<basePrice(e.product)&&<s>{money(e.quantity*basePrice(e.product))}</s>}{money(e.quantity*(priceFor(e.product)+extraFor(e.product)))}</b></div>).concat(custom.map(c=><div className="v5-line is-custom" key={c.id}><div className="v5-line-info"><strong>{c.name}</strong><small>Article libre · {money(c.price)} l’unité</small></div>
    <Stepper value={c.quantity} max={1000} disabled={busy||!!saleRef} onChange={v=>setCustom(list=>v<=0?list.filter(x=>x.id!==c.id):list.map(x=>x.id===c.id?{...x,quantity:v}:x))}/>
    <b className="v5-line-total">{money(c.quantity*c.price)}</b></div>)):<div className="v5-empty v5-empty--basket"><ScanBarcode size={40}/><h3>Panier vide</h3><p>Scannez un article ou touchez un produit.</p></div>}</div>
   <div className="v5-basket-foot">
    <div className="v5-client-row"><label className="v5-field v5-field--inline"><span><UserRound size={15}/> Client</span><select disabled={busy||!!saleRef} value={customerId} onChange={e=>chooseCustomer(e.target.value)}><option value="">Vente comptoir</option>{boot.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="v5-icon-btn" title="Nouveau client" aria-label="Nouveau client" disabled={busy||!!saleRef} onClick={()=>setPage('clients')}><UserPlus size={17}/></button></div>
    {cust&&(cust.priceMode==='WHOLESALE'||Number(cust.discountPct)>0||Number(cust.due)>0||Number(cust.creditLimit)>0)&&(()=>{const limit=Number(cust.creditLimit||0),owed=Number(cust.due||0),after=owed+due,over=limit>0&&after>limit+0.0005;
     return <div className={'v6-credit'+(over?' is-over':'')}><span>{cust.priceMode==='WHOLESALE'?'Tarif gros':'Tarif détail'}{Number(cust.discountPct)>0?' · remise '+cust.discountPct+' %':''}</span>
      {(owed>0||limit>0)&&<span>Doit déjà <b>{money(owed)}</b>{limit>0&&<> · plafond <b>{money(limit)}</b></>}</span>}
      {over&&<b>Plafond dépassé avec cette vente : encaissez au moins {money(after-limit)}.</b>}</div>})()}
    <MethodSeg value={method} onChange={v=>{setMethod(v);if(v!=='CASH')setGivenCash('')}} disabled={busy||!!saleRef}/>
    {discountValue>0&&<div className="v6-discount-row"><span>Sous-total {money(subtotal)}</span><span>Remise <b>-{money(discountValue)}</b></span></div>}
    <div className="v5-total"><span>Total <small>{priceMode==='WHOLESALE'?'tarif gros':'tarif détail'}</small></span><strong key={total}>{money(total)}</strong></div>
    <div className="v5-pay-grid"><label className="v5-field"><span>Payé maintenant</span><input disabled={busy||!!saleRef||!lineCount} min="0" max={total} step=".001" type="number" placeholder={total.toFixed(3)} value={paid} onChange={e=>setPaid(e.target.value)}/></label>
     {method==='CASH'&&<label className="v5-field"><span>Le client donne</span><input disabled={busy||!!saleRef||!lineCount} min="0" step=".5" type="number" placeholder="Espèces reçues" value={givenCash} onChange={e=>setGivenCash(e.target.value)}/></label>}</div>
    {method==='CASH'&&lineCount>0&&!saleRef&&<div className="v5-quick">{quickCash.map(v=><button key={v} onClick={()=>setGivenCash(String(v))}>{v} DT</button>)}</div>}
    {change!==null&&<div className={'v5-change '+(change<0?'is-neg':'')}><span>{change<0?'Il manque':'Monnaie à rendre'}</span><strong>{money(Math.abs(change))}</strong></div>}
    {due>0&&<div className="v5-due"><span>Reste dû {customerId?'(crédit client)':'— choisissez un client'}</span><strong>{money(due)}</strong></div>}
    <button disabled={busy||!!saleRef||!lineCount||boot.role==='DEMO'} className="v5-btn v5-btn--primary v5-pay" onClick={()=>void sale()}>{busy?'Enregistrement…':<><Check size={20}/> Encaisser {lineCount?money(total):''}<kbd>F9</kbd></>}</button>
    {ticket&&<div className="v6-ticket-actions"><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={printTicket}><Printer size={15}/> Réimprimer</button><button className="v5-btn v5-btn--ghost v5-btn--sm v6-wa" onClick={()=>shareTicket(ticket,boot.customers.find(c=>c.name===ticket.customer)?.phone)}><MessageCircle size={15}/> WhatsApp</button>{!ticket.offline&&boot.role!=='DEMO'&&<button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>setInvoiceFor({reference:ticket.reference,customer:boot.customers.find(c=>c.name===ticket.customer)})}><FileText size={15}/> Facture</button>}{settings.drawerPrinter&&<button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>void invoke('cash_drawer_open',{printer:settings.drawerPrinter}).catch(e=>setError(String(e)))}><Banknote size={15}/> Tiroir</button>}</div>}{receiptWarning&&<p className="v5-hint">{receiptWarning}</p>}
   </div>
  </aside>}
  {message&&<div role="status" className="v5-toast"><CircleCheck size={18}/><span>{message}</span><button aria-label="Fermer" onClick={()=>setMessage('')}><X size={15}/></button></div>}
  {labels&&<WindowsLabelStudio products={products} companyName={boot.companyName} onClose={()=>setLabels(false)}/>}
  {locked&&<div className="v5-lock"><form onSubmit={unlockAs} className="v5-card v5-lock-card"><div className="v5-mark v5-mark--xl">F</div><h2>Caisse verrouillée</h2>
   {(profile?.profiles?.length||0)>1?<div className="v6-cashiers v6-cashiers--lock" role="radiogroup" aria-label="Caissier">{profile!.profiles!.map(x=><button type="button" role="radio" key={x.login} aria-checked={(lockSwitch||me)===x.login} onClick={()=>{setLockSwitch(x.login);setLockPin('')}}><span className="v6-avatar">{(x.name||x.login).slice(0,1).toUpperCase()}</span><b>{x.name||x.login}</b></button>)}</div>:<p>{cashier||boot.companyName} · code PIN</p>}<PinPad value={lockPin} onChange={setLockPin} autoFocus/><button className="v5-btn v5-btn--primary v5-btn--lg" disabled={lockPin.length!==4}><LockOpen size={18}/> Déverrouiller</button>{error&&<p className="v5-alert v5-alert--danger">{error}</p>}</form></div>}
  <TicketPrint ticket={ticket}/>
  <ZReport data={zData}/>
  <PaymentSlip data={paySlip}/>
  <InvoicePrint data={invoiceData} logo={logo}/>
  {invoiceFor&&<InvoiceDialog reference={invoiceFor.reference} customer={invoiceFor.customer} onClose={()=>setInvoiceFor(null)} onDone={printInvoice}/>}
  {reportOpen&&<ReportDialog page={page} onClose={()=>setReportOpen(false)} onSent={()=>setMessage('Merci, le problème est envoyé à l’équipe Fixi.')}/>}
  {approval&&<ApprovalDialog perm={approval.perm} reason={approval.reason} onDone={t=>{approval.resolve(t);setApproval(null)}}/>}
  {dialog==='product'&&<NewProductDialog stockIn={page==='entree'} barcode={newCode} onClose={()=>{setDialog('');focusScan()}} onCreate={createProduct}/>}
  {dialog==='free'&&<FreeItemDialog onClose={()=>{setDialog('');focusScan()}} onAdd={x=>setCustom(list=>[...list,{id:crypto.randomUUID(),...x}])}/>}
  {dialog==='discount'&&<DiscountDialog subtotal={subtotal} discount={cartDiscount} onClose={()=>setDialog('')}
   lines={entries.map(e=>({key:e.product.id,name:e.product.name,quantity:e.quantity,base:basePrice(e.product),price:priceFor(e.product)} as DiscountLine))}
   onApply={(d,prices)=>{const next:Record<string,number>={};for(const e of entries){const v=prices[e.product.id];if(v&&Math.abs(v-basePrice(e.product))>=0.0005)next[e.product.id]=v}setLinePrice(next);setCartDiscount(d)}}/>}
  {dialog==='settings'&&<SettingsDialog settings={settings} onChange={setSettings} onClose={()=>setDialog('')} version={version} demo={boot.role==='DEMO'} onCheckUpdate={()=>void checkUpdate(false)} onRemoveCashier={boot.role==='DEMO'?undefined:()=>void logout()} onReport={boot.role==='DEMO'?undefined:()=>{setDialog('');setReportOpen(true)}}/>}
  {dialog==='parked'&&<div className="v6-modal-back" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog('')}}><div className="v5-card v6-modal is-wide" role="dialog" aria-label="Ventes hors ligne">
   <header className="v6-modal-head"><h2><CloudUpload size={19}/> Ventes hors ligne</h2><button className="v5-icon-btn" aria-label="Fermer" onClick={()=>setDialog('')}><X size={17}/></button></header>
   <p className="v5-hint">{offline?'Pas de connexion à FIXI. Les ventes sont gardées sur ce PC et partent toutes seules dès que la connexion revient.':'Ces ventes attendent d’être envoyées à FIXI.'}</p>
   {queue.length===0?<Empty icon={CloudUpload} title="Tout est envoyé" text="Aucune vente en attente."/>:<div className="v5-table-wrap"><table className="v5-table"><thead><tr><th>Vente</th><th className="num">Total</th><th>État</th><th className="act"></th></tr></thead><tbody>
    {queue.map(q=><tr key={q.reference}><td><b>{new Date(q.createdAt).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</b><small>{q.ticket.lines.length} ligne(s){q.ticket.customer?' · '+q.ticket.customer:''}</small></td><td className="num"><b>{money(q.ticket.total)}</b></td>
     <td>{q.error?<span className="v5-chip is-danger" title={q.error}>Refusée</span>:<span className="v5-chip is-warning">En attente</span>}{q.error&&<small>{q.error}</small>}</td>
     <td className="act"><div className="v5-row-actions"><button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>{setTicket(q.ticket);setPrintRequest(n=>n+1)}}><Printer size={14}/></button>{q.error&&<button className="v5-btn v5-btn--ghost v5-btn--sm" onClick={()=>dropQueued(q.reference)}><Trash2 size={14}/></button>}</div></td></tr>)}
   </tbody></table></div>}
   <div className="v6-actions"><button className="v5-btn v5-btn--primary" disabled={syncing||!queue.length} onClick={()=>void syncQueue(true)}><RefreshCw size={16} className={syncing?'v5-spin':''}/> Envoyer maintenant</button></div>
  </div></div>}
 </div>;
}
const statusMap:Record<string,[string,'ok'|'warning'|'danger'|'info'|'muted'|'brand']>={
 PENDING:['Nouvelle','brand'],CONFIRMED:['Confirmée','info'],PREPARING:['En préparation','warning'],READY_FOR_DELIVERY:['Prête','ok'],OUT_FOR_DELIVERY:['En livraison','info'],DELIVERED:['Livrée','ok'],CANCELLED:['Annulée','muted'],RETURNED:['Retournée','muted'],
 PAID:['Payée','ok'],PARTIAL:['Partielle','warning'],UNPAID:['Non payée','danger'],COMPLETED:['Terminée','ok'],REFUNDED:['Remboursé','ok'],ISSUED:['Émis','info'],
 OPEN:['Ouverte','ok'],CLOSED:['Clôturée','muted'],PENDING_CASHIER:['À clôturer','brand'],SUBMITTED:['Déclarée','info']};
const roleLabel:Record<string,string>={OWNER:'Propriétaire',ADMIN:'Administrateur',MANAGER:'Responsable',SALES:'Vendeur',CASHIER:'Caissier',STOCK:'Magasinier',ACCOUNTANT:'Comptable',DELIVERY_MANAGER:'Responsable livraison'};
function Chip({tone,children}:{tone:string;children:React.ReactNode}){return <span className={'v5-chip is-'+tone}>{children}</span>}
function StatusChip({status}:{status:string}){const [l,t]=statusMap[status]||[status.replace(/_/g,' ').toLowerCase(),'muted'];return <Chip tone={t}>{l}</Chip>}
function Empty({icon:I,title,text}:{icon:React.ComponentType<{size?:number}>;title:string;text:string}){return <div className="v5-empty"><I size={36}/><h3>{title}</h3><p>{text}</p></div>}
function Risk({title,text,children}:{title:string;text:string;children:React.ReactNode}){return <div className="v5-risk"><TriangleAlert size={19}/><div><strong>{title}</strong><p className="v5-mono">{text}</p><div className="v5-risk-actions">{children}</div></div></div>}
function Stepper({value,max,onChange,disabled}:{value:number;max:number;onChange:(v:number)=>void;disabled?:boolean}){return <div className="v5-stepper"><button type="button" aria-label="Moins" disabled={disabled||value<=0} onClick={()=>onChange(Math.max(0,value-1))}><Minus size={15}/></button><span>{value}</span><button type="button" aria-label="Plus" disabled={disabled||value>=max} onClick={()=>onChange(Math.min(max,value+1))}><Plus size={15}/></button></div>}
function MethodSeg({value,onChange,disabled}:{value:string;onChange:(v:string)=>void;disabled?:boolean}){return <div className="v5-seg v5-seg--method" role="group" aria-label="Moyen de paiement">{([['CASH','Espèces',Banknote],['CARD','Carte',CreditCard],['TRANSFER','Virement',Landmark]] as const).map(([v,l,I])=><button type="button" key={v} aria-pressed={value===v} disabled={disabled} onClick={()=>onChange(v)}><I size={16}/> {l}</button>)}</div>}
function PinPad({value,onChange,autoFocus}:{value:string;onChange:(v:string)=>void;autoFocus?:boolean}){
 const press=(d:string)=>onChange((value+d).slice(0,4));
 return <div className="v5-pinpad"><input className="v5-pin-input" autoFocus={autoFocus} type="password" inputMode="numeric" maxLength={4} value={value} onChange={e=>onChange(e.target.value.replace(/\D/g,'').slice(0,4))} aria-label="Code PIN"/>
  <div className="v5-pin-dots" aria-hidden>{[0,1,2,3].map(i=><i key={i} className={i<value.length?'is-on':''}/>)}</div>
  <div className="v5-keys">{['1','2','3','4','5','6','7','8','9'].map(d=><button type="button" key={d} onClick={()=>press(d)}>{d}</button>)}<button type="button" aria-label="Effacer" onClick={()=>onChange(value.slice(0,-1))}><Delete size={20}/></button><button type="button" onClick={()=>press('0')}>0</button><button type="button" aria-label="Tout effacer" onClick={()=>onChange('')}><X size={20}/></button></div></div>}
const isCustomerWindow=(()=>{try{return getCurrentWindow().label==='client'}catch{return false}})();
// Un seul installateur : mode fournisseur (par défaut) ou mode atelier (Fixi Pro).
const space=(()=>{try{return localStorage.getItem('fixi-space')}catch{return null}})();
// Thème choisi dans les réglages, appliqué avant le premier rendu (caisse, atelier et écran client).
{const t=readJson<Partial<Settings>>(SETTINGS_KEY,{}).theme||defaultSettings.theme;document.documentElement.dataset.theme=t==='dark'||(t==='auto'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches)?'dark':'light'}
createRoot(document.getElementById('root')!).render(isCustomerWindow?<CustomerDisplay/>:space==='atelier'?<AtelierApp/>:<App/>);
