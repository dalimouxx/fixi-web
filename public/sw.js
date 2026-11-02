const CACHE='fixi-v12-public-shell';
const SHELL=['/','/login','/offline-reception.html','/manifest.webmanifest','/icon.svg','/icons/atelier-192.png','/icons/supplier-192.png','/icons/delivery-192.png','/icons/control-192.png','/icons/badge-96.png'];

// Identité visuelle des notifications : l'icône de l'espace concerné (PNG, lisible sur Android),
// une pastille monochrome pour la barre d'état, et une vibration propre à chaque type.
const BADGE='/icons/badge-96.png';
function spaceOf(href){href=String(href||'');return href.startsWith('/supplier')?'supplier':href.startsWith('/delivery')?'delivery':href.startsWith('/saas')?'control':'atelier';}
const iconOf=href=>'/icons/'+spaceOf(href)+'-192.png';
// Catégories : ce qui exige une action reste affiché jusqu'au toucher et vibre plus fort.
const PROFILE={
  DRIVER_NEW_MISSION:{vibrate:[220,100,220,100,320],sticky:true,actions:[{action:'accept-delivery',title:'Accepter'},{action:'open',title:'Voir'}]},
  SUPPLIER_NEW_ORDER:{vibrate:[200,90,200,90,280],sticky:true,actions:[{action:'open',title:'Voir la commande'}]},
  DRIVER_ARRIVED:{vibrate:[140,80,180],sticky:false,actions:[{action:'open',title:'Ouvrir'}]},
  DRIVER_DELIVERED:{vibrate:[120,70,200],sticky:false,actions:[{action:'open',title:'Voir'}]},
  SHOP_ORDER_DELIVERED:{vibrate:[120,70,200],sticky:false,actions:[{action:'open',title:'Voir'}]},
  SHOP_ORDER_PROGRESS:{vibrate:[100,60,140],sticky:false,actions:[{action:'open',title:'Suivre'}]},
  SUPPLIER_UPDATE:{vibrate:[110,70,140],sticky:false,actions:[{action:'open',title:'Ouvrir'}]},
  GENERAL:{vibrate:[90,60,130],sticky:false,actions:[{action:'open',title:'Ouvrir'}]},
};
async function setBadge(count){try{if(self.navigator&&'setAppBadge'in self.navigator){count>0?await self.navigator.setAppBadge(count):await self.navigator.clearAppBadge();}}catch{}}
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  // Never persist authenticated pages, API responses, receipts, tracking data or RSC payloads.
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/app/')||url.pathname.startsWith('/receipt/')||url.pathname.startsWith('/track/')||url.pathname.startsWith('/saas')||event.request.headers.get('RSC')==='1')return;
  const cacheable=url.pathname.startsWith('/_next/static/')||SHELL.includes(url.pathname);
  if(!cacheable)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request).then(response=>response||caches.match('/login'))));
});

self.addEventListener('push',event=>{
  let data={title:'Fixi',body:'Nouvelle notification',href:'/app/notifications',actions:[],data:{}};
  try{if(event.data)data={...data,...event.data.json()}}catch{}
  const href=data.href||data.data?.href||'/app/notifications';
  // Résumé « écran verrouillé » poussé par le serveur : notification silencieuse remplacée sur place.
  if(data.type==='SUMMARY'){event.waitUntil(showSummary(data));return;}
  const identity=String(data.experienceKey||data.data?.experienceKey||'GENERAL');
  const profile=PROFILE[identity]||PROFILE.GENERAL;
  const options={
    body:data.body,
    icon:iconOf(href),
    badge:BADGE,
    image:data.image||undefined,
    data:{href,...(data.data||{}),experienceKey:identity},
    tag:data.tag||('fixi-'+Date.now()),
    renotify:true,
    vibrate:profile.vibrate,
    timestamp:Date.now(),
    requireInteraction:profile.sticky||!!data.requireInteraction,
    actions:(Array.isArray(data.actions)&&data.actions.length?data.actions:profile.actions).slice(0,2)
  };
  event.waitUntil((async()=>{
    await self.registration.showNotification(data.title,options);
    const open=await self.registration.getNotifications();
    await setBadge(typeof data.unread==='number'?data.unread:open.filter(n=>!String(n.tag||'').startsWith('fixi-summary')).length);
  })());
});

// Résumé permanent (équivalent web d'un widget d'écran verrouillé) : une seule notification
// silencieuse par espace, mise à jour sans son ni vibration.
async function showSummary(d){
  const space=d.space||spaceOf(d.href);
  const tag='fixi-summary-'+space;
  if(d.clear){const list=await self.registration.getNotifications({tag});list.forEach(n=>n.close());return;}
  await self.registration.showNotification(d.title||'Fixi',{
    body:d.body||'',icon:'/icons/'+space+'-192.png',badge:BADGE,tag,renotify:false,silent:true,
    requireInteraction:true,timestamp:Date.now(),data:{href:d.href||'/'},actions:[{action:'open',title:'Ouvrir'}]
  });
  if(typeof d.badge==='number')await setBadge(d.badge);
}

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.registration.getNotifications().then(list=>setBadge(list.filter(n=>!String(n.tag||'').startsWith('fixi-summary')).length)));
  const action=event.action||'open';
  const data=event.notification.data||{};
  const href=data.href||'/app/notifications';
  // Fournisseur : confirmer une nouvelle commande sans ouvrir l'application.
  if(action==='accept-order'&&data.orderId){
    event.waitUntil((async()=>{
      try{
        const r=await fetch('/api/supplier/orders/'+encodeURIComponent(data.orderId),{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'CONFIRMED'})});
        if(r.ok){
          await self.registration.showNotification('Commande confirmée ✓',{body:'La boutique est prévenue. Préparez la commande.',icon:'/icons/supplier-192.png',badge:BADGE,tag:'order-confirmed-'+data.orderId,data:{href:'/supplier?tab=orders'},actions:[{action:'open',title:'Préparer'}]});
        }else{
          const j=await r.json().catch(()=>({}));
          await self.registration.showNotification('Confirmation impossible',{body:r.status===401?'Reconnectez-vous à Fixi Fournisseur puis confirmez la commande.':r.status===403?'Votre rôle ne permet pas de confirmer une commande.':(j.error||'Cette commande a déjà été traitée.'),icon:'/icons/supplier-192.png',badge:BADGE,tag:'order-confirm-failed-'+data.orderId,data:{href:'/supplier?tab=orders'}});
        }
      }catch{
        await self.registration.showNotification('Pas de connexion',{body:'Ouvrez Fixi Fournisseur pour confirmer la commande.',icon:'/icons/supplier-192.png',badge:BADGE,data:{href:'/supplier?tab=orders'}});
      }
    })());
    return;
  }
  if(action==='accept-delivery'&&data.orderId){
    event.waitUntil((async()=>{
      try{
        const r=await fetch('/api/delivery/orders/'+encodeURIComponent(data.orderId)+'/accept',{method:'POST',credentials:'include'});
        if(r.ok){
          await self.registration.showNotification('Livraison acceptée',{body:'La mission vous est réservée.',icon:'/icons/delivery-192.png',badge:BADGE,tag:'delivery-accepted-'+data.orderId,data:{href:'/delivery'},requireInteraction:true,actions:[{action:'open',title:'Ouvrir la tournée'}]});
        }else{
          const j=await r.json().catch(()=>({}));
          await self.registration.showNotification('Mission indisponible',{body:j.error||'Cette livraison a déjà été prise.',icon:'/icons/delivery-192.png',badge:BADGE,tag:'delivery-unavailable-'+data.orderId,data:{href:'/delivery'}});
        }
      }catch{
        await self.registration.showNotification('Connexion requise',{body:'Ouvrez Fixi Livreur pour accepter la mission.',icon:'/icons/delivery-192.png',badge:BADGE,data:{href:'/delivery'}});
      }
      const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      const deliveryClient=clients.find(c=>{try{return new URL(c.url).pathname.startsWith('/delivery')}catch{return false}});
      if(deliveryClient&&'focus'in deliveryClient){await deliveryClient.navigate('/delivery');return deliveryClient.focus();}
      return self.clients.openWindow('/delivery');
    })());
    return;
  }
  // Keep Supplier, Boutique and Delivery sessions in their own tabs/app contexts.
  const allowed=href.startsWith('/supplier')||href.startsWith('/delivery')||href.startsWith('/app/')||href.startsWith('/saas')
    ?href:'/app/notifications';
  const channel=allowed.startsWith('/supplier')?'/supplier':allowed.startsWith('/delivery')?'/delivery':allowed.startsWith('/saas')?'/saas':'/app/';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const matching=clients.find(c=>{try{return new URL(c.url).pathname.startsWith(channel)}catch{return false}});
    if(matching&&'focus'in matching){await matching.navigate(allowed);return matching.focus();}
    return self.clients.openWindow(allowed);
  }));
});

self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='FIXI_SUMMARY'){event.waitUntil(showSummary(d));return;}
  if(d.type==='FIXI_BADGE'){event.waitUntil(setBadge(Number(d.count)||0));return;}
  if(d.type==='DELIVERY_ONGOING'&&d.orderId){
    event.waitUntil(self.registration.showNotification(d.title||'Livraison en cours',{
      body:d.body||'Fixi Livreur suit cette livraison.',
      icon:'/icons/delivery-192.png',badge:BADGE,
      tag:'ongoing-delivery-'+d.orderId,
      renotify:false,requireInteraction:true,silent:true,
      data:{href:'/delivery',orderId:d.orderId},
      actions:[{action:'open',title:'Ouvrir'}]
    }));
  }
  if(d.type==='DELIVERY_ONGOING_CLEAR'&&d.orderId){
    event.waitUntil(self.registration.getNotifications({tag:'ongoing-delivery-'+d.orderId}).then(list=>list.forEach(n=>n.close())));
  }
});
