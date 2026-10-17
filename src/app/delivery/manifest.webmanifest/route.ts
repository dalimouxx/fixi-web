export async function GET(){
 return Response.json({
  name:'Fixi Delivery',short_name:'Fixi Delivery',description:'Livraisons, COD, retours et suivi Fixi',
  start_url:'/delivery',scope:'/delivery',display:'standalone',background_color:'#f6f7f9',theme_color:'#ff6b00',
  icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]
 },{headers:{'Content-Type':'application/manifest+json','Cache-Control':'public, max-age=3600'}})
}
