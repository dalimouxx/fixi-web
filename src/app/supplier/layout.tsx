import type {Metadata,Viewport} from 'next';
export const metadata:Metadata={
 title:'Fixi Fournisseur',
 description:'Commandes, caisse, stock et livraisons de votre société.',
 manifest:'/supplier/manifest.webmanifest',
 applicationName:'Fixi Fournisseur',
 icons:{icon:[{url:'/icons/supplier-48.png',sizes:'48x48',type:'image/png'},{url:'/icons/supplier-192.png',sizes:'192x192',type:'image/png'}],apple:[{url:'/icons/supplier-apple-180.png',sizes:'180x180'}]},
 appleWebApp:{capable:true,statusBarStyle:'default',title:'Fixi Fournisseur'}
};
export const viewport:Viewport={themeColor:'#f6f5f3',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function SupplierLayout({children}:{children:React.ReactNode}){return children}
