import type {Metadata,Viewport} from 'next';
export const metadata:Metadata={
 title:'Fixi Livreur',
 description:'Missions, encaissements et preuves de livraison.',
 manifest:'/delivery/manifest.webmanifest',
 applicationName:'Fixi Livreur',
 icons:{icon:[{url:'/icons/delivery-48.png',sizes:'48x48',type:'image/png'},{url:'/icons/delivery-192.png',sizes:'192x192',type:'image/png'}],apple:[{url:'/icons/delivery-apple-180.png',sizes:'180x180'}]},
 appleWebApp:{capable:true,statusBarStyle:'default',title:'Fixi Livreur'}
};
export const viewport:Viewport={themeColor:'#f6f5f3',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function DeliveryLayout({children}:{children:React.ReactNode}){return children}
