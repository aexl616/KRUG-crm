(() => {
  'use strict';
  const root=document.getElementById('app');if(!root)return;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={welcome:'Первый /start',start_repeat:'Повторный /start',created:'Заявка получена',confirmed:'Запись подтверждена',changed:'Запись изменена',cancelled_studio:'Отмена студией',cancelled_client:'Отмена клиентом',reminder_24h:'За 24 часа',reminder_2h:'За 2 часа',reminder_30m:'За 30 минут',completed:'Сессия завершена',loyalty_accrual:'Начисление бонусов',loyalty_refund:'Возврат бонусов',campaign:'Рассылка',test:'Проверка связи',settings:'Настройки'};
  const statuses={draft:'Черновик',scheduled:'Запланирована',sending:'Отправляется',completed:'Завершена',completed_with_errors:'Завершена с ошибками',cancelled:'Отменена'};
  let dialog,data,tab='overview',offset=0;
  function allowed(){try{return ['owner','admin'].includes(JSON.parse(sessionStorage.getItem('krug-crm-session-user-v1')||'null')?.role);}catch{return false;}}
  async function api(action,payload={}){
    const token=window.KrugCrmAuth?.sessionToken?.()||'';
    const response=await fetch('/api/telegram/admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload})});
    const result=await response.json();if(!response.ok||!result.ok)throw Error(result.message||'Не удалось выполнить запрос. Проверь сессию и подключение.');return result.data;
  }
  function notice(text){if(dialog)dialog.querySelector('[data-tg-notice]').textContent=text;}
  async function run(button,action){button.disabled=true;try{await action();}catch(error){notice(error.message);}finally{button.disabled=false;}}
  const date=value=>value?new Date(value).toLocaleString('ru-RU'):'Нет данных';
  const localInput=value=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  function shell(){
    dialog.innerHTML=`<header class="tg-head"><div><small>КРУГ · СВЯЗЬ С КЛИЕНТАМИ</small><h2 id="tg-title">Telegram</h2></div><button class="app-mgmt-btn ghost" data-close aria-label="Закрыть Telegram">Закрыть</button></header>
    <nav class="tg-tabs" aria-label="Разделы Telegram">${[['overview','Уведомления'],['templates','Шаблоны'],['campaigns','Рассылки'],['clients','Клиенты']].map(([id,title])=>`<button class="app-mgmt-btn ${tab===id?'primary':'ghost'}" data-tab="${id}" aria-pressed="${tab===id}">${title}</button>`).join('')}</nav>
    <p data-tg-notice role="status" aria-live="polite"></p><div data-tg-body></div>`;
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
  }
  async function load(){data=await api('overview',{offset});render();}
  function render(){
    if(!dialog?.open)return;shell();const body=dialog.querySelector('[data-tg-body]');
    if(!data){body.textContent='Загружаем Telegram…';return;}
    if(tab==='overview'){
      const h=data.health||{},stale=!data.last_run_at||Date.now()-new Date(data.last_run_at)>180000;
      body.innerHTML=`<div class="tg-stats">${[['В очереди',data.pending],['Отправлено',data.sent],['Ошибок',data.failed]].map(([title,n])=>`<article class="app-mgmt-stat"><span>${title}</span><strong>${Number(n||0)}</strong></article>`).join('')}</div>
       <article class="tg-card"><h3>${h.connected?'Бот на связи':'Нет связи с ботом'} ${h.username?'@'+escape(h.username):''}</h3><p>Webhook: ${h.webhook_matches?'подключён':h.webhook_set?'проверь адрес в настройках сервера':'не настроен'}. Входящих в очереди: ${Number(h.pending_updates||0)}.</p><p>Автоматическая доставка: ${stale?'нет свежего запуска':'работает'}. Последний запуск: ${escape(date(data.last_run_at))}.</p><p>Последнее входящее событие: ${escape(date(data.last_update_at))}. Ошибка webhook: ${h.last_error_at?escape(date(h.last_error_at*1000)):'нет'}.</p><button class="app-mgmt-btn ghost" data-refresh>Обновить статус</button></article>
       <h3>Последние ошибки доставки</h3><div class="tg-list">${(data.errors||[]).map(e=>`<article class="tg-card"><strong>${escape(labels[e.kind]||e.kind)}</strong><p>${escape(e.last_error)} · попыток ${Number(e.attempts)} · ${escape(date(e.created_at))}</p>${e.status==='failed'?`<button class="app-mgmt-btn ghost" data-retry="${escape(e.id)}" data-uncertain="${e.last_error==='DELIVERY_UNCERTAIN'}">Повторить</button>`:''}</article>`).join('')||'<p>Ошибок нет.</p>'}</div>`;
      body.querySelector('[data-refresh]').onclick=e=>run(e.currentTarget,load);bindRetry(body);
    }else if(tab==='templates'){
      body.innerHTML=`<p>Обязательные события записи отправляются независимо от подписки на новости. Напоминания клиент настраивает отдельно.</p><label class="app-mgmt-field">Событие<select data-template>${data.templates.map(t=>`<option value="${escape(t.kind)}">${escape(labels[t.kind]||t.kind)}</option>`).join('')}</select></label><div data-editor></div>`;
      const select=body.querySelector('[data-template]');select.onchange=()=>templateEditor(body,select.value);templateEditor(body,select.value);
    }else if(tab==='campaigns'){
      body.innerHTML=`<p>Только клиенты с явным согласием на новости. Отписки и блокировки проверяются повторно перед доставкой.</p><form data-campaign class="tg-card">
      <label class="app-mgmt-field">Начать с шаблона<select data-source><option value="">Свой текст</option>${data.templates.map(t=>`<option value="${escape(t.kind)}">${escape(labels[t.kind]||t.kind)}</option>`).join('')}</select></label>
      ${fields({title:'',body:'',button_text:'Открыть КРУГ',button_target:'miniapp'})}
      <label class="app-mgmt-field">Аудитория<select name="segment"><option value="all">Все подписанные Telegram-клиенты</option><option value="miniapp">Пользователи Mini App</option><option value="visited">Посетители студии</option></select></label>
      <label class="app-mgmt-field">Тег клиента<select name="tag"><option value="">Все теги</option>${(data.tags||[]).map(t=>`<option value="${escape(t)}">${escape(t)}</option>`).join('')}</select></label><p class="tg-muted">Доступны теги связанных клиентов, сохранённые в общей CRM.</p>
      <label class="app-mgmt-field">Когда отправить (время этого устройства)<input type="datetime-local" name="scheduled_at"></label><p class="tg-muted">Оставь пустым для отправки сейчас.</p>
      <div class="tg-actions"><button type="button" class="app-mgmt-btn ghost" data-preview>Предпросмотр и получатели</button><button class="app-mgmt-btn primary" type="submit">Сохранить черновик</button></div><div class="tg-preview" data-preview-output aria-live="polite"></div></form>
      <h3>Кампании</h3><div class="tg-list">${(data.campaigns||[]).map(c=>`<article class="tg-card"><strong>${escape(c.title||c.message.slice(0,80))}</strong><p>${escape(statuses[c.status]||c.status)} · ${escape(date(c.scheduled_at||c.created_at))}</p><p>Всего ${Number(c.queued_count)} · доставлено ${Number(c.sent_count)} · ошибок ${Number(c.failed_count)} · исключено ${Number(c.skipped_count||0)}</p>${c.status==='draft'?`<label class="app-mgmt-field">Время отправки<input type="datetime-local" data-schedule="${escape(c.id)}" value="${escape(localInput(c.scheduled_at))}"></label><button class="app-mgmt-btn primary" data-launch="${escape(c.id)}">Проверить и отправить</button>`:''}${c.status==='scheduled'?`<button class="app-mgmt-btn ghost" data-cancel-campaign="${escape(c.id)}">Отменить рассылку</button>`:''}${c.failed_count?`<button class="app-mgmt-btn ghost" data-retry-campaign="${escape(c.id)}">Повторить ошибки</button>`:''}</article>`).join('')||'<p>Пока нет рассылок.</p>'}</div>`;
      const form=body.querySelector('[data-campaign]');let requestId=crypto.randomUUID();bindPreview(form,true);
      form.querySelector('[data-source]').onchange=e=>{const t=data.templates.find(t=>t.kind===e.target.value);if(t)fill(form,t);};
      form.onsubmit=e=>{e.preventDefault();run(form.querySelector('[type="submit"]'),async()=>{
        const scheduled=form.elements.scheduled_at.value;
        const c=await api('saveCampaign',{request_id:requestId,content:read(form),audience:{segment:form.elements.segment.value,tag:form.elements.tag.value},scheduled_at:scheduled?new Date(scheduled).toISOString():null});
        await load();const input=dialog.querySelector(`[data-schedule="${c.id}"]`);if(input)input.value=scheduled;
        notice('Черновик сохранён. Проверь получателей перед запуском.');requestId=crypto.randomUUID();
      });};
      body.querySelectorAll('[data-launch]').forEach(b=>b.onclick=()=>run(b,async()=>{
        const c=data.campaigns.find(c=>c.id===b.dataset.launch),count=await api('previewAudience',{audience:c.audience});
        const when=body.querySelector(`[data-schedule="${c.id}"]`).value;
        const text=window.KrugTelegramContent.render({title:c.title,body:c.message,button_text:c.button_text||'',button_target:c.button_target,button_url:c.button_url}).text;
        if(!window.confirm(`${text}\n\nПолучателей сейчас: ${count.count}. Отправить ${when?new Date(when).toLocaleString('ru-RU'):'сейчас'}?`))return;
        await api('launchCampaign',{id:c.id,scheduled_at:when?new Date(when).toISOString():null});await load();notice('Рассылка запущена. Доставку выполняет автоматическая очередь.');
      }));
      body.querySelectorAll('[data-cancel-campaign]').forEach(b=>b.onclick=()=>run(b,async()=>{
        if(!window.confirm('Отменить эту запланированную рассылку?'))return;
        await api('cancelCampaign',{id:b.dataset.cancelCampaign});await load();notice('Запланированная рассылка отменена.');
      }));bindRetry(body);
    }else{
      body.innerHTML=`<p>События записи обязательны. Клиент управляет новостями и напоминаниями командами /settings в боте.</p><div class="tg-list">${(data.clients||[]).map(c=>`<article class="tg-card"><strong>${escape(c.name)}</strong><p>Telegram ${escape(c.telegram_user_id)} · ${c.telegram_blocked_at?'Бот заблокирован':c.telegram_started_at?'Бот запущен':'/start ещё не получен'}</p><p>Новости: ${c.marketing_enabled?'включены':'выключены'}. Напоминания: ${c.reminders_enabled?'включены':'выключены'}.</p><button class="app-mgmt-btn ghost" data-test="${escape(c.id)}" ${c.telegram_blocked_at?'disabled':''}>Тестовое сообщение</button></article>`).join('')||'<p>Клиентов на этой странице нет.</p>'}</div><div class="tg-actions"><button class="app-mgmt-btn ghost" data-prev ${offset===0?'disabled':''}>Назад</button><span>Страница ${offset/100+1}</span><button class="app-mgmt-btn ghost" data-next ${(data.clients||[]).length<100?'disabled':''}>Далее</button></div>`;
      body.querySelector('[data-prev]').onclick=e=>run(e.currentTarget,async()=>{offset=Math.max(0,offset-100);await load();});
      body.querySelector('[data-next]').onclick=e=>run(e.currentTarget,async()=>{offset+=100;await load();});
      body.querySelectorAll('[data-test]').forEach(b=>b.onclick=()=>run(b,async()=>{await api('testSend',{client_id:b.dataset.test});notice('Тестовое сообщение добавлено в очередь.');}));
    }
  }
  function fields(c){return `<div class="tg-fields"><label class="app-mgmt-field">Заголовок<input name="title" maxlength="160" value="${escape(c.title)}"></label><label class="app-mgmt-field">Сообщение<div class="tg-format" role="toolbar" aria-label="Форматирование сообщения">${[['b','Ж'],['i','К'],['u','Ч'],['s','З'],['code','Код'],['blockquote','Цитата'],['a','Ссылка']].map(([tag,title])=>`<button type="button" class="app-mgmt-btn ghost" data-format="${tag}">${title}</button>`).join('')}</div><textarea name="body" rows="7" maxlength="3000" required>${escape(c.body)}</textarea></label><label class="app-mgmt-field">Текст кнопки<input name="button_text" maxlength="64" value="${escape(c.button_text)}"></label><label class="app-mgmt-field">Кнопка открывает<select name="button_target">${[['miniapp','Mini App'],['url','HTTPS-ссылку'],['none','Без кнопки']].map(([v,n])=>`<option value="${v}" ${v===c.button_target?'selected':''}>${n}</option>`).join('')}</select></label><label class="app-mgmt-field">HTTPS-ссылка<input name="button_url" value="${escape(c.button_url||'')}"></label></div><p class="tg-muted">Формат Telegram HTML. Переменные: ${window.KrugTelegramContent.placeholders.map(p=>'{'+p+'}').join(', ')}</p>`;}
  function read(form){return Object.fromEntries(['title','body','button_text','button_target','button_url'].map(k=>[k,form.elements[k].value]));}
  function fill(form,c){for(const k of ['title','body','button_text','button_target','button_url'])form.elements[k].value=c[k]||'';}
  function bindFormats(form){
    const textarea=form.elements.body;
    form.querySelectorAll('[data-format]').forEach(button=>button.onclick=()=>{
      const tag=button.dataset.format,start=textarea.selectionStart,end=textarea.selectionEnd,selected=textarea.value.slice(start,end)||'текст';
      let open=`<${tag}>`,close=`</${tag}>`;
      if(tag==='a'){
        const url=window.prompt('HTTPS-ссылка','https://');if(!url)return;
        open=`<a href="${escape(url)}">`;
      }
      textarea.setRangeText(`${open}${selected}${close}`,start,end,'select');textarea.focus();
    });
  }
  function bindPreview(form,audience=false){bindFormats(form);form.querySelector('[data-preview]').onclick=e=>run(e.currentTarget,async()=>{
    const preview=await api('preview',{content:read(form)}),output=form.querySelector('[data-preview-output]');output.replaceChildren();
    if(preview.parse_mode==='HTML')output.innerHTML=preview.text;else output.textContent=preview.text;
    if(preview.button_text&&preview.button_target!=='none')output.append(document.createTextNode(`\n\n[ ${preview.button_text} ]`));
    if(audience){const count=await api('previewAudience',{audience:{segment:form.elements.segment.value,tag:form.elements.tag.value}});output.append(document.createTextNode(`\n\nПолучателей сейчас: ${count.count}`));}
  });}
  function templateEditor(body,kind){
    const t=data.templates.find(t=>t.kind===kind),holder=body.querySelector('[data-editor]');
    holder.innerHTML=`<form class="tg-card">${fields(t)}<div class="tg-actions"><button type="button" class="app-mgmt-btn ghost" data-preview>Предпросмотр</button><button class="app-mgmt-btn primary" type="submit">Сохранить шаблон</button></div><div class="tg-preview" data-preview-output aria-live="polite"></div></form>`;
    const form=holder.querySelector('form');bindPreview(form);
    form.onsubmit=e=>{e.preventDefault();run(form.querySelector('[type="submit"]'),async()=>{const saved=await api('saveTemplate',{kind:t.kind,version:t.version,content:read(form)});Object.assign(t,saved);notice('Шаблон сохранён.');});};
  }
  function bindRetry(body){body.querySelectorAll('[data-retry],[data-retry-campaign]').forEach(b=>b.onclick=()=>run(b,async()=>{
    const uncertain=b.dataset.uncertain==='true'||Boolean(b.dataset.retryCampaign);
    if(uncertain&&!window.confirm('Для доставок с неизвестным результатом повтор может создать дубликат. Повторить?'))return;
    const result=await api('retry',{id:b.dataset.retry||null,campaign_id:b.dataset.retryCampaign||null,acknowledge_uncertain:uncertain});await load();notice(`Повторно в очереди: ${result.retried}.`);
  }));}
  async function open(){
    if(!allowed())return;if(dialog?.open)return;
    dialog=document.createElement('dialog');dialog.className='tg-dialog';dialog.setAttribute('aria-labelledby','tg-title');document.body.append(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();dialog=null;data=null;},{once:true});dialog.showModal();render();
    try{await load();}catch(error){notice(error.message);}
  }
  function ensure(){
    if(!allowed()){document.querySelectorAll('[data-tg-open]').forEach(n=>n.remove());dialog?.close();return;}
    for(const nav of root.querySelectorAll('.nav,.mobile-tabs')){
      if(nav.querySelector('[data-tg-open]'))continue;const b=document.createElement('button');b.type='button';b.dataset.tgOpen='';b.textContent='Telegram';b.onclick=open;nav.append(b);
    }
  }
  new MutationObserver(()=>queueMicrotask(ensure)).observe(root,{childList:true,subtree:true});ensure();
})();
