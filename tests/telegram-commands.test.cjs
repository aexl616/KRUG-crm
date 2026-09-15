const {test}=require('node:test');
const assert=require('node:assert/strict');
const {COMMANDS,commandFromInput,visibleCommands,commandReplyKeyboard,linksReplyKeyboard,supportUrl}=require('../api/_lib/telegram-commands');

const labels=keyboard=>keyboard.keyboard.flat().map(button=>button.text);

test('first-time user sees Start and a started user does not',()=>{
  assert.ok(labels(commandReplyKeyboard({started:false,role:'guest'})).includes('Старт'));
  assert.ok(!labels(commandReplyKeyboard({started:true,role:'user'})).includes('Старт'));
});

test('every current user slash command has one button and manual slash input remains valid',()=>{
  const keyboardLabels=labels(commandReplyKeyboard({started:true,role:'user'}));
  for(const definition of COMMANDS.filter(item=>!item.firstStartOnly)){
    assert.ok(keyboardLabels.includes(definition.label));
    assert.equal(commandFromInput(`${definition.command}@krug_studio_bot debug`),definition.command);
  }
  assert.equal(commandFromInput('/start payload'),'/start');
});

test('button labels and slash commands resolve to the same canonical handler command',()=>{
  for(const definition of COMMANDS)assert.equal(commandFromInput(definition.label),commandFromInput(definition.command));
});

test('Help and Support buttons use the required direct URLs and support is configurable',()=>{
  const buttons=linksReplyKeyboard({}).inline_keyboard.flat();
  assert.equal(buttons.find(button=>button.text==='Помощь').url,'https://telegra.ph/Voprosy-i-Otvety-09-15');
  assert.equal(buttons.find(button=>button.text==='Поддержка').url,'https://t.me/ae_xl');
  assert.equal(supportUrl({TELEGRAM_SUPPORT_USERNAME:'@krug_support'}),'https://t.me/krug_support');
});

test('role-restricted definitions stay hidden from regular users',()=>{
  const definitions=[...COMMANDS,{command:'/owner_audit',label:'Аудит владельца',roles:['owner']}];
  assert.ok(!visibleCommands({started:true,role:'user'},definitions).some(item=>item.command==='/owner_audit'));
  assert.ok(visibleCommands({started:true,role:'owner'},definitions).some(item=>item.command==='/owner_audit'));
});
