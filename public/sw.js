const CACHE='fixi-v11-public-shell';
const SHELL=['/','/login','/offline-reception.html','/manifest.webmanifest','/icon.svg'];
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
  const identity=String(data.experienceKey||data.data?.experienceKey||'GENERAL');
  const urgentMission=identity==='DRIVER_NEW_MISSION';
  const vibration=urgentMission?[160,90,160,100,230]:
    identity.startsWith('DRIVER_')?[120,80,160]:
    identity.startsWith('SUPPLIER_')?[110,75,110]:[90,60,125];
  const options={
    body:data.body,
    icon:'/icon.svg',
    badge:'/icon.svg',
    data:{href:data.href||'/app/notifications',...(data.data||{})},
    tag:data.tag||('fixi-'+Date.now()),
    renotify:!!data.tag,
    vibrate:vibration,
    timestamp:Date.now(),
    requireInteraction:urgentMission||!!data.requireInteraction,
    actions:Array.isArray(data.actions)?data.actions:[]
  };
  event.waitUntil(self.registration.showNotification(data.title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const action=event.action||'open';
  const data=event.notification.data||{};
  const href=data.href||'/app/notifications';
  if(action==='accept-delivery'&&data.orderId){
    event.waitUntil((async()=>{
      try{
        const r=await fetch('/api/delivery/orders/'+encodeURIComponent(data.orderId)+'/accept',{method:'POST',credentials:'include'});
        if(r.ok){
          await self.registration.showNotification('Livraison acceptée',{body:'La mission vous est réservée.',icon:'/icon.svg',badge:'/icon.svg',tag:'delivery-accepted-'+data.orderId,data:{href:'/delivery'},requireInteraction:true,actions:[{action:'open',title:'Ouvrir la tournée'}]});
        }else{
          const j=await r.json().catch(()=>({}));
          await self.registration.showNotification('Mission indisponible',{body:j.error||'Cette livraison a déjà été prise.',icon:'/icon.svg',badge:'/icon.svg',tag:'delivery-unavailable-'+data.orderId,data:{href:'/delivery'}});
        }
      }catch{
        await self.registration.showNotification('Connexion requise',{body:'Ouvrez Fixi Delivery pour accepter la mission.',icon:'/icon.svg',badge:'/icon.svg',data:{href:'/delivery'}});
      }
      const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      const deliveryClient=clients.find(c=>{try{return new URL(c.url).pathname.startsWith('/delivery')}catch{return false}});
      if(deliveryClient&&'focus'in deliveryClient){await deliveryClient.navigate('/delivery');return deliveryClient.focus();}
      return self.clients.openWindow('/delivery');
    })());
    return;
  }
  // Keep Supplier, Boutique and Delivery sessions in their own tabs/app contexts.
  const allowed=href.startsWith('/supplier')||href.startsWith('/delivery')||href.startsWith('/app/')
    ?href:'/app/notifications';
  const channel=allowed.startsWith('/supplier')?'/supplier':allowed.startsWith('/delivery')?'/delivery':'/app/';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const matching=clients.find(c=>{try{return new URL(c.url).pathname.startsWith(channel)}catch{return false}});
    if(matching&&'focus'in matching){await matching.navigate(allowed);return matching.focus();}
    return self.clients.openWindow(allowed);
  }));
});

self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='DELIVERY_ONGOING'&&d.orderId){
    event.waitUntil(self.registration.showNotification(d.title||'Livraison en cours',{
      body:d.body||'Fixi Delivery suit cette livraison.',
      icon:'/icon.svg',badge:'/icon.svg',
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
