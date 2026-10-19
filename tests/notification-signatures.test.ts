import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationExperiences,getNotificationExperience,experienceTag} from '../src/lib/notification-experience';
import {soundPattern} from '../src/lib/notification-sound-patterns';

test('new supplier order and courier mission have distinct recognizable sounds',()=>{
  const shop=soundPattern(notificationExperiences.SHOP_ORDER_PROGRESS.sound);
  const supplier=soundPattern(notificationExperiences.SUPPLIER_NEW_ORDER.sound);
  const driver=soundPattern(notificationExperiences.DRIVER_NEW_MISSION.sound);
  assert.ok(supplier.length>=3&&driver.length>=3);
  assert.notDeepEqual(shop,supplier);
  assert.notDeepEqual(supplier,driver);
  assert.notDeepEqual(driver,shop);
});
test('arrival and completed delivery have different courier sounds',()=>{
  assert.notDeepEqual(soundPattern(notificationExperiences.DRIVER_ARRIVED.sound),
    soundPattern(notificationExperiences.DRIVER_DELIVERED.sound));
  assert.notDeepEqual(soundPattern(notificationExperiences.DRIVER_NEW_MISSION.sound),
    soundPattern(notificationExperiences.DRIVER_DELIVERED.sound));
});
test('all alert signatures are short, audible, and safe in UI',()=>{
  for(const [name,config] of Object.entries(notificationExperiences)){
    assert.ok(config.duration<=12000&&config.duration>=2000,name);
    assert.ok(['general','supplier','shop','driver'].includes(config.channel),name);
    for(const [frequency,delay,duration] of soundPattern(config.sound)){
      assert.ok(frequency>=350&&frequency<=1700,name);
      assert.ok(delay>=0&&delay<=.9,name);
      assert.ok(duration>0&&duration<=.35,name);
    }
  }
});
test('per-order OS push tags are app and event specific',()=>{
  assert.notEqual(experienceTag('DRIVER_NEW_MISSION','o123'),experienceTag('SUPPLIER_NEW_ORDER','o123'));
  assert.notEqual(experienceTag('SHOP_ORDER_PROGRESS','o123'),experienceTag('SHOP_ORDER_DELIVERED','o123'));
  assert.equal(experienceTag('DRIVER_NEW_MISSION','o123'),experienceTag('DRIVER_NEW_MISSION','o123'));
});
test('unknown notification identities safely use standard generic style',()=>{
  assert.equal(getNotificationExperience('MISPRINT').sound,'CHIME');
  assert.equal(getNotificationExperience(null).channel,'general');
});
