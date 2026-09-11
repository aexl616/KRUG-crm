(() => {
  const root = document.getElementById('app');
  if (!root || !window.KrugConfig?.BOOKING_BACKEND) return;
  let running = false;

  async function enhanceRealBookingUi() {
    if (running) return;
    running = true;
    try {
      const homeBonusCopy = root.querySelector('.home-bonus small');
      if (homeBonusCopy && /Демо-бонусы/i.test(homeBonusCopy.textContent)) homeBonusCopy.textContent = 'Бонусы ↗';

      const profile = root.querySelector('.loyalty-section');
      if (profile) {
        const paragraphs = [...profile.querySelectorAll('.muted')];
        const demoCopy = paragraphs.find(node => /Демо-баланс|Демонстрац|тестов/i.test(node.textContent));
        if (demoCopy) demoCopy.textContent = 'Баллы хранятся в КРУГ и обновляются после оплаты сессии на студии.';
      }

      const bonus = root.querySelector('.bonus-choice');
      if (bonus) {
        const loyalty = await window.KrugLoyalty.getLoyaltyBalance().catch(() => null);
        if (!root.contains(bonus)) return;
        const checkbox = bonus.querySelector('#use-bonuses');
        const text = bonus.querySelector('p.muted');
        if (checkbox && loyalty?.requiresTelegram) {
          checkbox.checked = false;
          checkbox.disabled = true;
          if (text) text.textContent = 'Использование баллов доступно при запуске Mini App через Telegram.';
        } else if (checkbox && loyalty?.requiresProfile) {
          checkbox.checked = false;
          checkbox.disabled = true;
          if (text) text.textContent = 'Баллы появятся после сохранения профиля. Заявку можно отправить без них.';
        } else if (loyalty) {
          if (text && !checkbox?.checked) text.textContent = `После оплаченной сессии начислим ${loyalty.accrualPercent}% баллами`;
          if (text && checkbox?.checked) text.textContent = text.textContent.replace(/^Спишется/i, 'Зарезервируем');
        }
        if (!bonus.querySelector('.on-site-payment-note')) {
          bonus.insertAdjacentHTML('beforeend','<p class="muted on-site-payment-note">Деньги оплачиваются только на студии. Баллы до оплаты лишь резервируются.</p>');
        }
      }
    } finally {
      running = false;
    }
  }

  function enhanceLoyaltyDialog() {
    document.querySelectorAll('.loyalty-dialog').forEach(dialog => {
      const balanceSmall = dialog.querySelector('.dialog-balance small');
      if (balanceSmall && /демо/i.test(balanceSmall.textContent)) balanceSmall.textContent = 'баллов';
      [...dialog.querySelectorAll('.dialog-scroll .muted')].forEach(node => {
        if (/Демонстрационная история/i.test(node.textContent)) node.textContent = 'История операций · 1 бонус = 1 ₽';
      });
    });
  }

  const rootObserver = new MutationObserver(() => queueMicrotask(enhanceRealBookingUi));
  rootObserver.observe(root, { childList: true, attributes: true, attributeFilter: ['data-screen'] });
  const dialogObserver = new MutationObserver(() => queueMicrotask(enhanceLoyaltyDialog));
  dialogObserver.observe(document.body, { childList: true, subtree: true });
  enhanceRealBookingUi();
  enhanceLoyaltyDialog();
})();
