(() => {
  const root = document.getElementById('app');
  if (!root || !window.KrugConfig?.BOOKING_BACKEND) return;

  function enhanceRealBookingUi() {
    const bonus = root.querySelector('.bonus-choice');
    if (bonus && !bonus.dataset.realBookingNotice) {
      bonus.dataset.realBookingNotice = 'true';
      bonus.innerHTML = `
        <div class="bonus-payable">
          <span>Оплата</span>
          <strong>На студии</strong>
        </div>
        <p class="muted">Бонусы пока не применяются к онлайн-заявке. Подключим их после серверной синхронизации программы лояльности.</p>`;
    }

    if (root.dataset.screen === 'profile' && window.KrugConfig?.LOYALTY_DEMO) {
      const loyalty = root.querySelector('.loyalty-section');
      if (loyalty && !loyalty.dataset.demoClarified) {
        loyalty.dataset.demoClarified = 'true';
        const paragraphs = [...loyalty.querySelectorAll('.muted')];
        const demoCopy = paragraphs.find(node => /Демо-баланс|Демонстрац/i.test(node.textContent));
        if (demoCopy) demoCopy.textContent = 'Бонусная программа пока работает в тестовом режиме и не влияет на реальные заявки.';
      }
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceRealBookingUi));
  observer.observe(root, { childList: true, attributes: true, attributeFilter: ['data-screen'] });
  enhanceRealBookingUi();
})();
