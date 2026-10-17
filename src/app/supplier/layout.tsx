import type {Metadata} from 'next';
export const metadata:Metadata={
 title:'Fixi Supplier',
 description:'ERP fournisseur Fixi',
 manifest:'/supplier/manifest.webmanifest',
 appleWebApp:{capable:true,statusBarStyle:'default',title:'Fixi Supplier'},
 themeColor:'#ff6b00'
};
export default function SupplierLayout({children}:{children:React.ReactNode}){return children}
