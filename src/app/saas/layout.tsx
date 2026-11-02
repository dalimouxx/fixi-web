import type {Metadata,Viewport} from 'next';
export const metadata:Metadata={
 title:'Fixi Control',
 description:'Pilotage de la plateforme Fixi.',
 manifest:'/saas/manifest.webmanifest',
 applicationName:'Fixi Control',
 icons:{icon:[{url:'/icons/control-48.png',sizes:'48x48',type:'image/png'},{url:'/icons/control-192.png',sizes:'192x192',type:'image/png'}],apple:[{url:'/icons/control-apple-180.png',sizes:'180x180'}]},
 appleWebApp:{capable:true,statusBarStyle:'default',title:'Fixi Control'}
};
export const viewport:Viewport={themeColor:'#f6f5f3',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function ControlLayout({children}:{children:React.ReactNode}){return children}
