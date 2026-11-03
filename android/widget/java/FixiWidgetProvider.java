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
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget de l'écran d'accueil Fixi. Le serveur envoie 3 cases (libellé + nombre) et une ligne de bas,
 * adaptées à l'espace relié : atelier, fournisseur ou livreur. Petite taille : une seule ligne.
 */
public class FixiWidgetProvider extends AppWidgetProvider {
    static final String ACTION_REFRESH = "tn.fixi.app.WIDGET_REFRESH";
    static final String PREFS = "fixi_widget";
    static final int[] VALUE_IDS = { R.id.fixi_widget_v1, R.id.fixi_widget_v2, R.id.fixi_widget_v3 };
    static final int[] LABEL_IDS = { R.id.fixi_widget_l1, R.id.fixi_widget_l2, R.id.fixi_widget_l3 };

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { refresh(context); }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) { renderCached(context); }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) refresh(context);
    }

    static void renderCached(Context context) {
        String last = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("last", null);
        try { render(context, last == null ? null : new JSONObject(last), null); } catch (Exception e) { render(context, null, null); }
    }

    static void refresh(final Context context) {
        final Context app = context.getApplicationContext();
        renderCached(app);
        new Thread(new Runnable() {
            @Override public void run() {
                SharedPreferences p = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String token = p.getString("token", null);
                if (token == null) { render(app, null, "Ouvrez Fixi → Plus → Widget écran d’accueil"); return; }
                HttpURLConnection c = null;
                try {
                    String host = app.getString(R.string.hostName);
                    String lang = p.getString("lang", "fr");
                    URL url = new URL("https://" + host + "/api/widget/summary?t=" + URLEncoder.encode(token, "UTF-8") + "&lang=" + lang);
                    c = (HttpURLConnection) url.openConnection();
                    c.setConnectTimeout(12000);
                    c.setReadTimeout(12000);
                    c.setRequestProperty("Accept", "application/json");
                    int code = c.getResponseCode();
                    InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
                    StringBuilder sb = new StringBuilder();
                    if (in != null) {
                        BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"));
                        String line; while ((line = r.readLine()) != null) sb.append(line);
                        r.close();
                    }
                    JSONObject j = sb.length() > 0 ? new JSONObject(sb.toString()) : new JSONObject();
                    if (code == 401) { p.edit().remove("token").remove("last").apply(); render(app, null, "Widget déconnecté : reliez-le depuis Fixi"); return; }
                    if (code >= 400) { renderWithNote(app, p, j.optString("error", "Fixi indisponible")); return; }
                    p.edit().putString("last", j.toString()).apply();
                    render(app, j, null);
                } catch (Exception e) {
                    renderWithNote(app, p, "Hors connexion · dernières données");
                } finally { if (c != null) c.disconnect(); }
            }
        }).start();
    }

    static void renderWithNote(Context context, SharedPreferences p, String note) {
        String last = p.getString("last", null);
        try { render(context, last == null ? null : new JSONObject(last), note); } catch (Exception e) { render(context, null, note); }
    }

    static void render(Context context, JSONObject j, String note) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, FixiWidgetProvider.class));
        for (int id : ids) {
            Bundle o = manager.getAppWidgetOptions(id);
            int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            boolean small = h > 0 && h < 100;
            manager.updateAppWidget(id, build(context, j, note, small));
        }
    }

    static RemoteViews build(Context context, JSONObject j, String note, boolean small) {
        RemoteViews v = new RemoteViews(context.getPackageName(), small ? R.layout.fixi_widget_small : R.layout.fixi_widget);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        String host = context.getString(R.string.hostName);
        String openPath = j == null ? "/login" : j.optString("openPath", "/login");
        String firstPath = j == null ? openPath : j.optString("firstCellPath", openPath);
        v.setOnClickPendingIntent(R.id.fixi_widget_root, PendingIntent.getActivity(context, 11, open(context, "https://" + host + openPath), flags));
        v.setOnClickPendingIntent(R.id.fixi_widget_c1, PendingIntent.getActivity(context, 12, open(context, "https://" + host + firstPath), flags));
        if (!small) v.setOnClickPendingIntent(R.id.fixi_widget_refresh, PendingIntent.getBroadcast(context, 13, new Intent(context, FixiWidgetProvider.class).setAction(ACTION_REFRESH), flags));

        JSONArray cells = j == null ? null : j.optJSONArray("cells");
        String[] fallback = { "Prêts", "En cours", "Attente pièce" };
        for (int i = 0; i < 3; i++) {
            JSONObject cell = cells == null ? null : cells.optJSONObject(i);
            v.setTextViewText(LABEL_IDS[i], cell == null ? fallback[i] : cell.optString("label", fallback[i]));
            v.setTextViewText(VALUE_IDS[i], cell == null ? "–" : String.valueOf(cell.optInt("value", 0)));
        }
        if (!small) {
            v.setTextViewText(R.id.fixi_widget_title, j == null ? "Fixi" : j.optString("title", "Fixi"));
            String foot = note != null ? note : (j == null ? "Ouvrez Fixi → Plus → Widget écran d’accueil" : j.optString("foot", "") + " · " + new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date()));
            v.setTextViewText(R.id.fixi_widget_foot, foot);
        }
        return v;
    }

    static Intent open(Context context, String url) {
        Intent i = new Intent(context, LauncherActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return i;
    }
}
