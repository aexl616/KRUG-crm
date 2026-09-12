(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const days = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
  async function request(action, payload) {
    const response = await fetch('/api/crm-auth', {method:'POST',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${window.KrugCrmAuth?.sessionToken?.() || ''}`},body:JSON.stringify({action,...payload})});
    const result = await response.json();
    if (!response.ok || !result.ok) throw Error(result.message || 'Не удалось загрузить график.');
    return result.data;
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-staff-schedule]');
    if (!button) return;
    const staffId = button.dataset.staffSchedule;
    const dialog = document.createElement('dialog');
    dialog.className = 'staff-schedule-dialog';
    dialog.innerHTML = '<p role="status">Загружаем график…</p><button type="button" data-close>Закрыть</button>';
    document.body.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => {dialog.remove();button.focus();});
    dialog.addEventListener('click', e => {if (e.target.closest('[data-close]')) dialog.close();});
    let profile;
    try { profile = await request('staffScheduleGet',{staffId}); }
    catch (error) {dialog.querySelector('p').textContent=error.message;return;}
    if (!dialog.isConnected) return;
    const intervals = slots => slots.map(slot => `<div class="staff-interval"><input type="time" required aria-label="Начало интервала" data-start value="${escape(slot.start)}"><span>—</span><input type="time" required aria-label="Конец интервала" data-end value="${escape(slot.end)}"><button type="button" data-remove-interval aria-label="Удалить интервал">×</button></div>`).join('');
    const dayRow = (key,slots,exception=false) => `<fieldset data-day="${escape(key)}" data-kind="${exception?'exceptions':'weekly'}"><legend>${exception?escape(key):days[Number(key)-1]}</legend><div data-intervals>${intervals(slots)}</div><button type="button" data-add-interval>+ Интервал</button>${exception?'<button type="button" data-remove-day>Убрать исключение</button>':''}<small>Без интервалов — выходной</small></fieldset>`;
    dialog.innerHTML = `<form class="staff-schedule-form"><div class="staff-schedule-heading"><h2 id="staff-schedule-title">График работы</h2><button type="button" data-close aria-label="Закрыть">×</button></div><p>Московское время. Конец раньше начала — следующий день. Исключение заменяет весь календарный день, включая ночной интервал предыдущего дня.</p>
      <details><summary>Карточка специалиста и услуги</summary><label>Имя / ник<input name="name" maxlength="120" value="${escape(profile.name)}"></label><label>Фото · ссылка HTTPS<input name="photoUrl" type="url" value="${escape(profile.photoUrl)}"></label><label>В профессии с года<input name="experienceSince" type="number" min="1950" max="2100" value="${escape(profile.experienceSince)}"></label><label>Жанры<input name="genres" maxlength="300" value="${escape(profile.genres)}"></label><label>О себе<textarea name="bio" maxlength="1000">${escape(profile.bio)}</textarea></label><label><input name="published" type="checkbox" ${profile.published?'checked':''}>Показывать в Mini App</label><label>Порядок предложения · меньше — раньше<input name="priority" type="number" value="${profile.priority}"></label><fieldset><legend>Может выполнять услуги</legend>${profile.services.filter(s=>s.staffSelection!=='none').map(s=>`<label><input type="checkbox" name="serviceId" value="${escape(s.id)}" ${profile.serviceIds.includes(s.id)?'checked':''}>${escape(s.name)}</label>`).join('')}</fieldset></details>
      <h3>Регулярный график</h3><div class="staff-week">${days.map((_,i)=>dayRow(String(i+1),profile.schedule.weekly[String(i+1)]||[])).join('')}</div>
      <h3>Исключения и отпуск</h3><div data-exceptions>${Object.entries(profile.schedule.exceptions).sort().map(([date,slots])=>dayRow(date,slots,true)).join('')}</div><div class="staff-exception-add"><label>С даты<input type="date" data-from></label><label>По дату<input type="date" data-to></label><button type="button" data-add-exception>Добавить выходные / отпуск</button></div><p>Для отдельной даты добавь рабочие интервалы в исключении.</p>
      <p role="alert" data-error></p><div class="staff-schedule-actions"><button type="button" data-close>Отмена</button><button class="btn primary" type="submit">Сохранить</button></div></form>`;
    dialog.setAttribute('aria-labelledby','staff-schedule-title');
    dialog.querySelector('#staff-schedule-title').textContent = `График работы${profile.name ? ' · '+profile.name : ''}`;
    const errorBox = dialog.querySelector('[data-error]');
    dialog.addEventListener('click', e => {
      const target=e.target.closest('button');if(!target)return;
      if(target.hasAttribute('data-add-interval')) {
        const parent=target.closest('fieldset').querySelector('[data-intervals]');
        if(parent.children.length>=8){errorBox.textContent='Максимум 8 интервалов в день.';return;}
        parent.insertAdjacentHTML('beforeend',intervals([{start:'12:00',end:'22:00'}]));
      }
      if(target.hasAttribute('data-remove-interval'))target.closest('.staff-interval').remove();
      if(target.hasAttribute('data-remove-day'))target.closest('fieldset').remove();
      if(target.hasAttribute('data-add-exception')) {
        const from=dialog.querySelector('[data-from]').value,to=dialog.querySelector('[data-to]').value||from;
        const length=(Date.parse(to)-Date.parse(from))/86400000+1;
        if(!Number.isInteger(length)||length<1||length>366){errorBox.textContent='Укажи диапазон до 366 дней.';return;}
        const container=dialog.querySelector('[data-exceptions]');
        for(let i=0;i<length;i++) {
          const date=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10);
          if(!container.querySelector(`[data-day="${date}"]`))container.insertAdjacentHTML('beforeend',dayRow(date,[],true));
        }
      }
    });
    dialog.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();const form=e.target;if(!form.reportValidity())return;
      const data=new FormData(form), schedule={weekly:{},exceptions:{}};
      for(const row of dialog.querySelectorAll('[data-day]')) {
        const slots=[...row.querySelectorAll('.staff-interval')].map(el=>({start:el.querySelector('[data-start]').value,end:el.querySelector('[data-end]').value}));
        if(slots.some(s=>s.start===s.end)){errorBox.textContent='Начало и конец интервала должны различаться.';return;}
        schedule[row.dataset.kind][row.dataset.day]=slots;
      }
      const save=form.querySelector('[type="submit"]');save.disabled=true;save.textContent='Сохраняем…';errorBox.textContent='';
      try {
        await request('staffScheduleSave',{staffId,expectedVersion:profile.version,profile:{
          name:data.get('name'),photoUrl:data.get('photoUrl'),experienceSince:data.get('experienceSince')||null,
          genres:data.get('genres'),bio:data.get('bio'),published:data.has('published'),priority:Number(data.get('priority')),
          serviceIds:data.getAll('serviceId'),schedule}});
        dialog.close();
      } catch(error){errorBox.textContent=error.message;}
      finally{save.disabled=false;save.textContent='Сохранить';}
    });
  });
  const style=document.createElement('style');
  style.textContent='.staff-schedule-dialog{color:#eee;background:#1b1b1b;border:1px solid #444;border-radius:20px;padding:24px;width:min(900px,95vw);max-height:90vh}.staff-schedule-dialog::backdrop{background:#000a}.staff-schedule-heading,.staff-schedule-actions,.staff-interval,.staff-exception-add{display:flex;gap:10px;align-items:center;justify-content:space-between}.staff-schedule-dialog label,.staff-schedule-dialog small{display:block;margin:8px 0}.staff-schedule-dialog input:not([type=checkbox]),.staff-schedule-dialog textarea{display:block;max-width:100%;background:#282828;color:#eee;border:1px solid #555;border-radius:8px;padding:8px}.staff-schedule-dialog button{cursor:pointer;padding:8px;border-radius:8px}.staff-schedule-dialog fieldset{border:1px solid #444;border-radius:12px;padding:12px;margin:10px 0}.staff-week{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px}.staff-interval{justify-content:flex-start;margin:8px 0}.staff-schedule-dialog [data-error]{color:#ffa487}.staff-schedule-actions{position:sticky;bottom:-24px;background:#1b1b1b;padding:16px 0}.staff-exception-add{flex-wrap:wrap}';
  document.head.append(style);
  style.textContent += '.staff-schedule-dialog{box-sizing:border-box;font:14px/1.5 system-ui,sans-serif;color-scheme:dark;width:min(948px,calc(100vw - 24px))}.staff-schedule-dialog *{box-sizing:border-box}.staff-schedule-dialog button{font:inherit;background:#303030;color:#eee;border:1px solid #555}.staff-schedule-dialog button[type=submit]{background:#ff6633;color:#111;border-color:#ff6633;font-weight:650}.staff-schedule-dialog h2{font-size:22px}.staff-schedule-dialog button:focus-visible{outline:2px solid #ff6633;outline-offset:2px}.staff-schedule-dialog small{color:#aaa}.staff-week{grid-template-columns:repeat(auto-fit,minmax(min(270px,100%),1fr))}.staff-interval input{min-width:0}.staff-schedule-dialog fieldset{min-width:0}';
})();
