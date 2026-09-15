(function(root,factory){
  const api=factory(); if(typeof module==='object'&&module.exports) module.exports=api; else root.KrugTelegramContent=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const placeholders=['client_name','service','date','time','duration','staff','price','bonuses'];
  const htmlTags=new Set(['b','strong','i','em','u','ins','s','strike','del','code','pre','blockquote','a']);
  const sample={client_name:'Анна',service:'Запись вокала',date:'20.09.2026',time:'18:00',duration:'2',staff:'Миша',price:'4000',bonuses:'200'};
  function validate(content){
    if(!content||typeof content!=='object'||Array.isArray(content)) throw Error('Нужен текст сообщения.');
    for(const [key,max] of [['title',160],['body',3000],['button_text',64]]){
      const text=content[key]??'';
      if(typeof text!=='string'||text.length>max||(key==='body'&&!text.trim())) throw Error(`Недопустимая длина поля ${key} (максимум ${max}).`);
      const rest=text.replace(/\{([a-z_]+)\}/g,(all,key)=>placeholders.includes(key)?'':all);
      if(/[{}]/.test(rest)) throw Error('Неизвестная переменная или незакрытая скобка.');
      if(key!=='button_text') validateHtml(text);
    }
    if(!['miniapp','url','none'].includes(content.button_target||'miniapp')) throw Error('Неизвестное назначение кнопки.');
    if(content.button_target==='url'){
      let url;try{url=new URL(content.button_url);}catch{throw Error('Укажи HTTPS-ссылку.');}
      if(url.protocol!=='https:'||url.username||url.password||/[{}\s]/.test(content.button_url)||content.button_url.length>1000) throw Error('Укажи HTTPS-ссылку без пароля и переменных.');
    }
    return content;
  }
  function validateHtml(text){
    const source=String(text||''),stack=[];let cursor=0,match;
    const tags=/<\/?([a-z]+)(?:\s+href="([^"]+)")?\s*>/gi;
    while((match=tags.exec(source))){
      if(/[<>]/.test(source.slice(cursor,match.index)))throw Error('Проверь Telegram HTML-разметку.');
      const name=match[1].toLowerCase(),closing=match[0][1]==='/';
      if(!htmlTags.has(name))throw Error(`Telegram не поддерживает тег <${name}>.`);
      if(name==='a'&&!closing){let url;try{url=new URL(match[2]);}catch{throw Error('Ссылка в тексте должна быть HTTPS.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('Ссылка в тексте должна быть HTTPS.');}
      if(name!=='a'&&match[2])throw Error('Атрибуты разрешены только для ссылки.');
      if(closing){if(stack.pop()!==name)throw Error('Закрой Telegram HTML-теги в правильном порядке.');}else stack.push(name);
      cursor=tags.lastIndex;
    }
    if(/[<>]/.test(source.slice(cursor))||stack.length)throw Error('Проверь незакрытые Telegram HTML-теги.');
  }
  function escapeHtml(value){return String(value).replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));}
  function normalizeHtml(text){return String(text||'').replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi,'&amp;');}
  function interpolate(text,context,html=false){return String(text||'').replace(/\{([a-z_]+)\}/g,(_,key)=>html?escapeHtml(context[key]??'—'):String(context[key]??'—'));}
  function render(content,context=sample){
    validate(content);
    const html=/<\/?[a-z]+(?:\s+href="[^"]+")?\s*>/i.test(`${content.title||''}${content.body||''}`);
    const title=html?normalizeHtml(content.title):content.title,body=html?normalizeHtml(content.body):content.body;
    const text=[interpolate(title,context,html),interpolate(body,context,html)].filter(Boolean).join('\n\n');
    const button_text=interpolate(content.button_text,context);
    if(text.length>4096||button_text.length>64) throw Error('Сообщение после подстановки слишком длинное.');
    return {text,button_text,button_target:content.button_target||'miniapp',button_url:content.button_url||'',...(html?{parse_mode:'HTML'}:{})};
  }
  return {validate,render,sample,placeholders};
});
