(function(root,factory){
  const api=factory(); if(typeof module==='object'&&module.exports) module.exports=api; else root.KrugTelegramContent=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const placeholders=['client_name','service','date','time','duration','staff','price','bonuses'];
  const sample={client_name:'Анна',service:'Запись вокала',date:'20.09.2026',time:'18:00',duration:'2',staff:'Миша',price:'4000',bonuses:'200'};
  function validate(content){
    if(!content||typeof content!=='object'||Array.isArray(content)) throw Error('Нужен текст сообщения.');
    for(const [key,max] of [['title',160],['body',3000],['button_text',64]]){
      const text=content[key]??'';
      if(typeof text!=='string'||text.length>max||(key==='body'&&!text.trim())) throw Error(`Недопустимая длина поля ${key} (максимум ${max}).`);
      const rest=text.replace(/\{([a-z_]+)\}/g,(all,key)=>placeholders.includes(key)?'':all);
      if(/[{}]/.test(rest)) throw Error('Неизвестная переменная или незакрытая скобка.');
    }
    if(!['miniapp','url','none'].includes(content.button_target||'miniapp')) throw Error('Неизвестное назначение кнопки.');
    if(content.button_target==='url'){
      let url;try{url=new URL(content.button_url);}catch{throw Error('Укажи HTTPS-ссылку.');}
      if(url.protocol!=='https:'||url.username||url.password||/[{}\s]/.test(content.button_url)||content.button_url.length>1000) throw Error('Укажи HTTPS-ссылку без пароля и переменных.');
    }
    return content;
  }
  function interpolate(text,context){return String(text||'').replace(/\{([a-z_]+)\}/g,(_,key)=>String(context[key]??'—'));}
  function render(content,context=sample){
    validate(content);
    const text=[interpolate(content.title,context),interpolate(content.body,context)].filter(Boolean).join('\n\n');
    const button_text=interpolate(content.button_text,context);
    if(text.length>4096||button_text.length>64) throw Error('Сообщение после подстановки слишком длинное.');
    return {text,button_text,button_target:content.button_target||'miniapp',button_url:content.button_url||''};
  }
  return {validate,render,sample,placeholders};
});
