(() => {
  'use strict';
  const TOKEN_KEY='krug-app-admin-token';
  const root=document.getElementById('app');
  if(!root)return;

  async function api(path,body){
    const token=sessionStorage.getItem(TOKEN_KEY)||'';
    if(!token)throw new Error('Нужен ключ управления Mini App.');
    const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(body||{})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok)throw new Error(j.message||'Ошибка Telegram.');
    return j.data||j.stats||j;
  }

  async function processQueue(){
    if(!sessionStorage.getItem(TOKEN_KEY))return;
    try{await api('/api/telegram/process',{});}catch{}
  }

  async function load(panel){
    try{
      const data=await api('/api/telegram/admin',{action:'overview'});
      const campaigns=Array.isArray(data.campaigns)?data.campaigns:[];
      panel.innerHTML=`
        <div class="app-mgmt-section-head"><div><h2>Telegram уведомления</h2><p>Подтверждения, отмены, напоминания и рассылки клиентам Mini App.</p></div><button class="app-mgmt-btn ghost" data-tg-process>Обработать очередь</button></div>
        <div class="app-mgmt-grid">
          <article class="app-mgmt-stat"><span>В очереди</span><strong>${Number(data.pending||0)}</strong></article>
          <article class="app-mgmt-stat"><span>Отправлено</span><strong>${Number(data.sent||0)}</strong></article>
          <article class="app-mgmt-stat"><span>Ошибок</span><strong>${Number(data.failed||0)}</strong></article>
        </div>
        <form id="tgCampaignForm" class="app-mgmt-modal-fields" style="margin-top:20px">
          <label class="app-mgmt-field">Получатели<select name="segment"><option value="all">Все пользователи Mini App</option><option value="app_registered">Зарегистрировались, ещё не были</option><option value="app_visited">Были на студии</option></select></label>
          <label class="app-mgmt-field">Текст рассылки<textarea name="message" rows="5" maxlength="3500" required placeholder="Напиши сообщение…"></textarea></label>
          <label class="app-mgmt-field">Текст кнопки<input name="buttonText" maxlength="64" placeholder="Записаться"></label>
          <label class="app-mgmt-field">Ссылка кнопки<input name="buttonUrl" value="https://krug-miniapp.vercel.app" placeholder="https://…"></label>
          <button class="app-mgmt-btn primary" type="submit">Поставить рассылку в очередь</button>
          <div data-tg-result></div>
        </form>
        ${campaigns.length?`<div class="app-booking-list" style="margin-top:20px">${campaigns.slice(0,8).map(c=>`<article class="app-booking-row"><div class="app-booking-main"><small>${new Date(c.createdAt).toLocaleString('ru-RU')}</small><strong>${String(c.message||'').slice(0,100)}</strong><span>${c.segment}</span></div><div class="app-booking-money"><small>в очередь ${c.queued||0}</small></div></article>`).join('')}</div>`:''}`;

      panel.querySelector('[data-tg-process]')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await processQueue();await load(panel);}finally{e.currentTarget.disabled=false;}});
      panel.querySelector('#tgCampaignForm')?.addEventListener('submit',async e=>{
        e.preventDefault(); const btn=e.currentTarget.querySelector('button[type="submit"]'); const out=e.currentTarget.querySelector('[data-tg-result]'); btn.disabled=true;
        try{const f=new FormData(e.currentTarget); const result=await api('/api/telegram/admin',{action:'createCampaign',segment:f.get('segment'),message:f.get('message'),buttonText:f.get('buttonText'),buttonUrl:f.get('buttonUrl')}); out.textContent=`В очередь добавлено: ${result.queued||0}`; await processQueue(); setTimeout(()=>load(panel),700);}catch(err){out.textContent=err.message;}finally{btn.disabled=false;}
      });
    }catch(err){panel.innerHTML=`<div class="app-mgmt-error">${String(err.message||err)}</div>`;}
  }

  function ensure(){
    const screen=root.querySelector('.app-management-screen');
    if(!screen||!sessionStorage.getItem(TOKEN_KEY)||screen.querySelector('#tgNotificationsPanel'))return;
    const panel=document.createElement('section'); panel.id='tgNotificationsPanel'; panel.className='app-mgmt-card'; screen.appendChild(panel); load(panel); processQueue();
  }
  new MutationObserver(()=>queueMicrotask(ensure)).observe(root,{childList:true,subtree:true});
  setInterval(processQueue,30000);
  ensure();
})();
