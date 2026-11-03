package tn.fixi.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.os.Build;

/**
 * Reçoit les notifications du site Fixi et les affiche dans le canal Fixi correspondant,
 * pour qu'elles sonnent avec le son Fixi de leur type (commande, livraison, suivi, terminé).
 */
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        FixiSounds.ensureChannels(this);
    }

    @Override
    public boolean onNotifyNotificationWithChannel(String platformTag, int platformId, Notification notification, String channelName) {
        if (Build.VERSION.SDK_INT < 26) return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, channelName);
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null || !nm.areNotificationsEnabled()) return false;
            FixiSounds.ensureChannels(this);
            Notification.Builder b = Notification.Builder.recoverBuilder(this, notification).setChannelId(FixiSounds.channelFor(platformTag));
            nm.notify(platformTag, platformId, b.build());
            return true;
        } catch (Exception e) {
            return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, channelName);
        }
    }
}
