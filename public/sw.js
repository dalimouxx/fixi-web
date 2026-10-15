const CACHE='fixi-v10-public-shell';
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

self.addEventListener('push',event=>{let data={title:'Fixi',body:'Nouvelle notification',href:'/app/notifications'};try{if(event.data)data={...data,...event.data.json()}}catch{};event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon.svg',badge:'/icon.svg',data:{href:data.href||'/app/notifications'},tag:'fixi-'+Date.now()}))});
self.addEventListener('notificationclick',event=>{event.notification.close();const href=event.notification.data?.href||'/app/notifications';event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const c of clients){if('focus'in c){c.navigate(href);return c.focus()}}return self.clients.openWindow(href)}))});
