package tn.fixi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * Canaux de notification Fixi, chacun avec son propre son (res/raw), audibles même téléphone verrouillé.
 * La catégorie arrive dans l'étiquette de la notification web : « fx-orders|… », « fx-missions|… », etc.
 * L'utilisateur peut changer chaque son dans Paramètres Android → Notifications → Fixi.
 */
final class FixiSounds {
    private FixiSounds() {}

    static final String[][] CHANNELS = {
        // id, nom affiché, description, fichier son, importance haute ?
        { "fixi_orders_v1", "Nouvelles commandes", "Une boutique passe commande (son tiroir-caisse)", "fixi_orders", "1" },
        { "fixi_missions_v1", "Nouvelles livraisons", "Une mission attend un livreur (alerte forte)", "fixi_missions", "1" },
        { "fixi_progress_v1", "Suivi en cours", "Commande confirmée, en route, arrivée", "fixi_progress", "1" },
        { "fixi_done_v1", "Terminé", "Livré, payé, appareil prêt", "fixi_done", "1" },
        { "fixi_general_v1", "Autres messages", "Messages et rappels", "fixi_general", "0" },
    };
    static final String SILENT = "fixi_silent_v1";

    /** Résumé de l'écran verrouillé et livraison en cours : affichés sans son. */
    static boolean silent(String tag) { return tag != null && (tag.startsWith("fixi-summary") || tag.startsWith("ongoing-")); }

    static String categoryOf(String tag) {
        if (tag != null && tag.startsWith("fx-")) {
            int end = tag.indexOf('|');
            String c = end > 3 ? tag.substring(3, end) : "";
            switch (c) { case "orders": case "missions": case "progress": case "done": case "general": return c; }
        }
        return "general";
    }

    static String channelFor(String tag) {
        if (silent(tag)) return SILENT;
        String c = categoryOf(tag);
        for (String[] ch : CHANNELS) if (ch[3].equals("fixi_" + c)) return ch[0];
        return CHANNELS[4][0];
    }

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        for (String[] ch : CHANNELS) {
            if (nm.getNotificationChannel(ch[0]) != null) continue;
            NotificationChannel c = new NotificationChannel(ch[0], ch[1], "1".equals(ch[4]) ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_DEFAULT);
            c.setDescription(ch[2]);
            int res = context.getResources().getIdentifier(ch[3], "raw", context.getPackageName());
            if (res != 0) c.setSound(Uri.parse("android.resource://" + context.getPackageName() + "/" + res), attrs);
            c.enableVibration(true);
            c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            c.setShowBadge(true);
            nm.createNotificationChannel(c);
        }
        if (nm.getNotificationChannel(SILENT) == null) {
            NotificationChannel q = new NotificationChannel(SILENT, "Résumé et suivi", NotificationManager.IMPORTANCE_LOW);
            q.setDescription("Résumé du jour et livraison en cours, sans son");
            q.setSound(null, null);
            q.enableVibration(false);
            q.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(q);
        }
    }
}
