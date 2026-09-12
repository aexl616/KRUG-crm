const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'motion.css'),'utf8');
const js=fs.readFileSync(path.join(root,'motion.js'),'utf8');

test('polish assets are loaded after the base UI layers',()=>{
  assert.ok(html.includes('href="motion.css"'));
  assert.ok(html.includes('src="motion.js"'));
  assert.ok(html.indexOf('ui-cleanup.css') < html.indexOf('motion.css'));
  assert.ok(html.indexOf('real-booking-ui.js') < html.indexOf('motion.js'));
});

test('motion layer respects reduced-motion accessibility',()=>{
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/animation-duration:\.001ms/);
});

test('live Mini App copy removes stale demo loyalty wording',()=>{
  assert.match(js,/Демо-бонусы/);
  assert.match(js,/Демо-баланс/);
  assert.match(js,/демо-бонусов/);
  assert.match(js,/Бонусы ↗/);
});

test('broken profile images are removed consistently',()=>{
  assert.match(js,/profile-photo/);
  assert.match(js,/naturalWidth === 0/);
});

test('Telegram haptics are progressive enhancement only',()=>{
  assert.match(js,/HapticFeedback/);
  assert.match(js,/try \{/);
});
