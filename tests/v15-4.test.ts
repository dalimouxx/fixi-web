import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('sons Fixi natifs dans l’application Android', () => {
  for (const f of ['fixi_orders', 'fixi_missions', 'fixi_progress', 'fixi_done', 'fixi_general']) {
    const b = fs.readFileSync(path.join(root, `android/widget/res/raw/${f}.wav`));
    assert.equal(b.subarray(0, 4).toString(), 'RIFF', f);
    assert.ok(b.length > 20000, f);
  }
  const ds = read('android/widget/java/DelegationService.java');
  assert.match(ds, /onNotifyNotificationWithChannel/); assert.match(ds, /recoverBuilder/);
  const fs2 = read('android/widget/java/FixiSounds.java');
  assert.match(fs2, /fixi-summary/, 'le résumé reste silencieux');
  assert.match(read('android/patch-widget.mjs'), /'raw'/);
});

test('l’étiquette web porte la catégorie de son', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /SUPPLIER_NEW_ORDER:'orders'/);
  assert.match(sw, /DRIVER_NEW_MISSION:'missions'/);
  assert.match(sw, /tag:catTag\(identity/);
  // le résumé silencieux garde son étiquette d'origine
  assert.match(sw, /const tag='fixi-summary-'\+space/);
});
