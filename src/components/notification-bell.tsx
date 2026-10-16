'use client';
import {RealtimeNotificationCenter} from './realtime-notification-center';
export function NotificationBell(){
  return <RealtimeNotificationCenter apiUrl="/api/notifications" eventsUrl="/api/events" storageKey="fixi-atelier-notifications" allHref="/app/notifications"/>;
}
