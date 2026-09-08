/* Editing hourly tariffs and duration previews; calculations live in hourly-core. */
const hourlyEscape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderHourlyServiceRow(service) {
  const esc=hourlyEscape;
  return `<form class="card section hourly-service-row" data-service-item-row="${esc(service.id)}">
    <h4>${esc(service.name)} · Почасовая</h4>
    <div class="form-grid"><div class="field"><label>Название</label><input name="name" value="${esc(service.name)}" required></div>
    <div class="field"><label>Категория</label><select name="categoryId">${catalogGroups().map(group=>`<option value="${esc(group.id)}" ${group.id===service.categoryId?'selected':''}>${esc(group.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Порядок</label><input name="order" type="number" min="1" value="${service.order}"></div>
    <label class="mini-check"><input name="active" type="checkbox" ${service.active!==false?'checked':''}> Доступна для новых записей</label></div>
    <p class="muted">Цены за всю сессию, не за один час. Изменение тарифов не пересчитывает сохранённые записи.</p>
    <div class="hourly-tier-grid">${service.priceTiers.map(tier=>`<label>${tier.hours} ч — цена, ₽<input name="tier-${tier.hours}" aria-label="${esc(service.name)}: ${tier.hours} ч, цена" type="number" min="0" step="0.01" required value="${tier.totalPrice}"><small>${tier.source==='existing'?'Исходный тариф':'Рассчитан из сетки'}</small></label>`).join('')}</div>
    <button class="btn" data-save-service-item="${esc(service.id)}" type="button">Сохранить тарифы</button>
  </form>`;
}
function saveHourlyServiceTiers(id,data) {
  if(!canEditSettings())return false;
  const service=serviceById(id);
  if(service?.pricingType!=='hourly'||!String(data.name||'').trim()||!catalogGroups().some(g=>g.id===data.categoryId))return false;
  const tiers=service.priceTiers.map(tier=>({...tier,totalPrice:Math.round(Number(data[`tier-${tier.hours}`])*100)/100}));
  if(tiers.length!==8||tiers.some(tier=>String(data[`tier-${tier.hours}`]??'').trim()===''||!Number.isFinite(tier.totalPrice)||tier.totalPrice<0))return false;
  state.serviceItems=state.serviceItems.map(s=>s.id===id?{...s,name:data.name.trim(),categoryId:data.categoryId,order:Number(data.order)||s.order,active:data.active==='on',priceTiers:tiers,price:tiers.find(t=>t.hours===1).totalPrice}:s);
  syncServicesFromCatalog();return true;
}
document.addEventListener('change', event=>{
  const input=event.target,form=input.form;
  if(input.name!=='duration'||!form||!['bookingModalForm','bookingForm'].includes(form.getAttribute('id')))return;
  const service=serviceById(form.querySelector('[name="serviceId"]').value);
  form.querySelector('[name="priceRecalculate"]').value='yes';
  if(service?.pricingType==='hourly') {
    try {
      const result=calculateHourlyServicePrice(service,bookingDurationMinutes({duration:input.value})/60);
      form.querySelector('[name="amount"]').value=result.totalPrice;
      const hint=form.querySelector('[data-service-lock-hint]');
      if(hint)hint.textContent=`${money(result.totalPrice)} за ${hourlyDurationLabel(result.durationHours)} · ${money(result.effectiveHourlyRate)} / час`;
    } catch(error) { alert(error.message); }
  }
  if(form.getAttribute('id')==='bookingModalForm')updateBookingConflictWarning();
});
