import type {Metadata} from 'next';
export const metadata:Metadata={
 title:'Fixi Delivery',
 description:'Application professionnelle de livraison Fixi',
 manifest:'/delivery/manifest.webmanifest',
 appleWebApp:{capable:true,statusBarStyle:'default',title:'Fixi Delivery'},
 themeColor:'#ff6b00'
};
export default function DeliveryLayout({children}:{children:React.ReactNode}){return children}
