'use strict';

const HIDE_MENU_LABEL='Скрыть меню';
const COMMANDS=Object.freeze([
  {command:'/start',label:'Старт',roles:['guest','user','owner','admin'],firstStartOnly:true},
  {command:'/settings',label:'Настройки',roles:['user','owner','admin']},
  {command:'/marketing_on',label:'Новости: включить',roles:['user','owner','admin']},
  {command:'/marketing_off',label:'Новости: выключить',roles:['user','owner','admin']},
  {command:'/reminders_on',label:'Напоминания: включить',roles:['user','owner','admin']},
  {command:'/reminders_off',label:'Напоминания: выключить',roles:['user','owner','admin']},
  {command:'/30m_on',label:'За 30 минут: включить',roles:['user','owner','admin']},
  {command:'/30m_off',label:'За 30 минут: выключить',roles:['user','owner','admin']}
]);

function commandFromInput(value,definitions=COMMANDS){
  const input=String(value||'').trim();
  if(input===HIDE_MENU_LABEL||input.toLowerCase()==='/hide_menu')return '/hide_menu';
  const slash=input.split(/\s/)[0].split('@')[0].toLowerCase();
  if(slash.startsWith('/'))return definitions.some(item=>item.command===slash)?slash:null;
  return definitions.find(item=>item.label===input)?.command||null;
}

function visibleCommands({started=false,role=started?'user':'guest'}={},definitions=COMMANDS){
  return definitions.filter(item=>item.roles.includes(role)&&(!item.firstStartOnly||!started));
}

function commandReplyKeyboard(context={},definitions=COMMANDS){
  const buttons=visibleCommands(context,definitions).map(item=>({text:item.label})),rows=[];
  for(let index=0;index<buttons.length;index+=2)rows.push(buttons.slice(index,index+2));
  rows.push([{text:HIDE_MENU_LABEL}]);
  return {keyboard:rows,resize_keyboard:true,is_persistent:true,input_field_placeholder:'Команда КРУГ'};
}

function configuredHttpsUrl(value,fallback){
  let url;try{url=new URL(String(value||fallback));}catch{url=new URL(fallback);}
  return url.protocol==='https:'&&!url.username&&!url.password?url.href:fallback;
}

function supportUrl(env=process.env){
  const username=String(env.TELEGRAM_SUPPORT_USERNAME||'ae_xl').trim().replace(/^@/,'');
  return `https://t.me/${/^[A-Za-z0-9_]{5,32}$/.test(username)?username:'ae_xl'}`;
}

function linksReplyKeyboard(env=process.env){
  return {inline_keyboard:[[
    {text:'Помощь',url:configuredHttpsUrl(env.TELEGRAM_FAQ_URL,'https://telegra.ph/Voprosy-i-Otvety-09-15')},
    {text:'Поддержка',url:supportUrl(env)}
  ]]};
}

module.exports={COMMANDS,HIDE_MENU_LABEL,commandFromInput,visibleCommands,commandReplyKeyboard,linksReplyKeyboard,supportUrl};
