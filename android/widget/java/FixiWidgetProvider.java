package tn.fixi.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Widget de l'écran d'accueil : appareils prêts, en cours, en attente de pièce, à relancer. */
public class FixiWidgetProvider extends AppWidgetProvider {
    static final String ACTION_REFRESH = "tn.fixi.app.WIDGET_REFRESH";
    static final String PREFS = "fixi_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) refresh(context);
    }

    static void refresh(final Context context) {
        final Context app = context.getApplicationContext();
        render(app, null, "…");
        new Thread(new Runnable() {
            @Override public void run() {
                SharedPreferences p = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String token = p.getString("token", null);
                if (token == null) { render(app, null, "Ouvrez Fixi → Plus → Widget écran d’accueil"); return; }
                HttpURLConnection c = null;
                try {
                    String host = app.getString(R.string.hostName);
                    URL url = new URL("https://" + host + "/api/widget/summary?t=" + URLEncoder.encode(token, "UTF-8"));
                    c = (HttpURLConnection) url.openConnection();
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(10000);
                    c.setRequestProperty("Accept", "application/json");
                    int code = c.getResponseCode();
                    BufferedReader r = new BufferedReader(new InputStreamReader(code < 400 ? c.getInputStream() : c.getErrorStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder(); String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                    r.close();
                    JSONObject j = new JSONObject(sb.toString());
                    if (code == 401) { p.edit().remove("token").apply(); render(app, null, "Widget déconnecté : reliez-le depuis Fixi"); return; }
                    if (code >= 400) { render(app, null, j.optString("error", "Fixi indisponible")); return; }
                    p.edit().putString("last", j.toString()).apply();
                    render(app, j, null);
                } catch (Exception e) {
                    String last = p.getString("last", null);
                    try { render(app, last == null ? null : new JSONObject(last), "Hors connexion · dernières données"); }
                    catch (Exception ignored) { render(app, null, "Hors connexion"); }
                } finally { if (c != null) c.disconnect(); }
            }
        }).start();
    }

    static void render(Context context, JSONObject j, String note) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, FixiWidgetProvider.class));
        if (ids.length == 0) return;
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.fixi_widget);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        String host = context.getString(R.string.hostName);
        v.setOnClickPendingIntent(R.id.fixi_widget_root, PendingIntent.getActivity(context, 1, open(context, "https://" + host + "/app/dashboard"), flags));
        v.setOnClickPendingIntent(R.id.fixi_widget_ready_box, PendingIntent.getActivity(context, 2, open(context, "https://" + host + "/app/cashier"), flags));
        v.setOnClickPendingIntent(R.id.fixi_widget_refresh, PendingIntent.getBroadcast(context, 3, new Intent(context, FixiWidgetProvider.class).setAction(ACTION_REFRESH), flags));
        if (j != null) {
            v.setTextViewText(R.id.fixi_widget_title, j.optString("shop", "Fixi"));
            v.setTextViewText(R.id.fixi_widget_ready, String.valueOf(j.optInt("ready")));
            v.setTextViewText(R.id.fixi_widget_repair, String.valueOf(j.optInt("inRepair") + j.optInt("received")));
            v.setTextViewText(R.id.fixi_widget_waiting, String.valueOf(j.optInt("waitingPart")));
            StringBuilder foot = new StringBuilder();
            int remind = j.optInt("toRemind");
            if (remind > 0) foot.append(remind).append(remind > 1 ? " clients à relancer" : " client à relancer");
            if (!j.isNull("revenueToday")) { if (foot.length() > 0) foot.append(" · "); foot.append(fmt(j.optDouble("revenueToday"))).append(" DT aujourd’hui"); }
            if (foot.length() > 0) foot.append(" · ");
            foot.append(new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date()));
            v.setTextViewText(R.id.fixi_widget_foot, note != null && !"…".equals(note) ? note : foot.toString());
        } else {
            v.setTextViewText(R.id.fixi_widget_foot, note == null ? "" : note);
        }
        v.setViewVisibility(R.id.fixi_widget_foot, View.VISIBLE);
        manager.updateAppWidget(ids, v);
    }

    static String fmt(double d) {
        if (Math.abs(d - Math.rint(d)) < 0.0005) return String.valueOf((long) Math.rint(d));
        return String.format(Locale.FRANCE, "%.3f", d).replaceAll("0+$", "").replaceAll(",$", "");
    }

    static Intent open(Context context, String url) {
        Intent i = new Intent(context, LauncherActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return i;
    }
}
