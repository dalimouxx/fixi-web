package tn.fixi.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

/** Reçoit fixiapp://widget?token=… depuis Fixi, garde le jeton et propose d'ajouter le widget. */
public class WidgetSetupActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri u = getIntent() == null ? null : getIntent().getData();
        String token = u == null ? null : u.getQueryParameter("token");
        if (u != null && "fixiapp".equals(u.getScheme()) && token != null && token.matches("[A-Za-z0-9_-]{20,100}")) {
            String lang = "ar".equals(u.getQueryParameter("lang")) ? "ar" : "fr";
            getSharedPreferences(FixiWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().putString("token", token).putString("lang", lang).remove("last").apply();
            AppWidgetManager m = AppWidgetManager.getInstance(this);
            ComponentName cn = new ComponentName(this, FixiWidgetProvider.class);
            boolean placed = m.getAppWidgetIds(cn).length > 0;
            FixiWidgetProvider.refresh(this);
            if (!placed && Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported()) m.requestPinAppWidget(cn, null, null);
            Toast.makeText(this, placed ? "Widget Fixi mis à jour" : "Widget Fixi prêt : ajoutez-le sur l’écran d’accueil", Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(this, "Lien de widget invalide", Toast.LENGTH_LONG).show();
        }
        finish();
    }
}
