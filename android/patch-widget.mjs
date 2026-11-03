// Ajoute le widget natif Fixi au projet Android généré (android/build).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const build = path.join(here, 'build', 'app', 'src', 'main');
const pkg = process.env.TWA_PACKAGE_ID || 'tn.fixi.app';
const javaDir = path.join(build, 'java', ...pkg.split('.'));
const copy = (from, to, edit = s => s) => { fs.mkdirSync(path.dirname(to), { recursive: true }); if (/\.(wav|ogg|mp3|png)$/.test(from)) return fs.copyFileSync(from, to); fs.writeFileSync(to, edit(fs.readFileSync(from, 'utf8'))); };

for (const f of fs.readdirSync(path.join(here, 'widget', 'java')))
  copy(path.join(here, 'widget', 'java', f), path.join(javaDir, f), s => s.replace(/^package tn\.fixi\.app;/m, `package ${pkg};`).replaceAll('"tn.fixi.app.WIDGET_REFRESH"', `"${pkg}.WIDGET_REFRESH"`));
for (const dir of ['layout', 'xml', 'drawable', 'values', 'raw'])
  for (const f of fs.readdirSync(path.join(here, 'widget', 'res', dir))) copy(path.join(here, 'widget', 'res', dir, f), path.join(build, 'res', dir, f));

const manifestPath = path.join(build, 'AndroidManifest.xml');
let m = fs.readFileSync(manifestPath, 'utf8');
if (!m.includes('FixiWidgetProvider')) {
  const block = `
        <receiver android:name=".FixiWidgetProvider" android:exported="false" android:label="Fixi">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="${pkg}.WIDGET_REFRESH" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/fixi_widget_info" />
        </receiver>
        <activity android:name=".WidgetSetupActivity" android:exported="true" android:excludeFromRecents="true" android:noHistory="true"
            android:theme="@android:style/Theme.Translucent.NoTitleBar">
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="fixiapp" android:host="widget" />
            </intent-filter>
        </activity>
`;
  m = m.replace(/<\/application>/, block + '    </application>');
  if (!m.includes('android.permission.INTERNET')) m = m.replace(/<application/, '<uses-permission android:name="android.permission.INTERNET"/>\n\n    <application');
  fs.writeFileSync(manifestPath, m);
}
console.log('Widget Fixi ajouté au projet Android.');
