import type { Metadata,Viewport } from 'next';import './globals.css';import './fixi-mobile.css';import './fixi-supplier-billing.css';
import './fixi-navigation-unified.css';import './fixi-notifications.css';
import './fixi-ux-hotfix.css';import './fixi-brand-system.css';
import './fixi-supplier-pro.css';import './fixi-clear-pro-v2.css';import { I18nProvider } from '@/components/language-provider';
export const metadata:Metadata={title:{default:'Fixi — Smart Repair Business OS',template:'%s · Fixi'},description:"Plateforme Web premium pour ateliers de réparation : réparations, Cash Pro, stock, clients, fournisseurs, suivi public et pilotage.",manifest:'/manifest.webmanifest',icons:{icon:'/icon.svg'},appleWebApp:{capable:true,title:'Fixi'}};
export const viewport:Viewport={themeColor:'#2563eb',width:'device-width',initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr" dir="ltr" suppressHydrationWarning><body><I18nProvider>{children}</I18nProvider></body></html>}
