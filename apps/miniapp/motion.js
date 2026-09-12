(() => {
  'use strict';
  const root = document.getElementById('app');
  if (!root) return;

  let lastScreenKey = '';

  function cleanCopy() {
    // Old prototype wording leaked into the live server-backed product.
    root.querySelectorAll('*').forEach(node => {
      if (node.children.length) return;
      const text = node.textContent.trim();
      if (text === 'Демо-бонусы ↗') node.textContent = 'Бонусы ↗';
      if (text === 'Демо-бонусы') node.textContent = 'Бонусы';
      if (text === 'Демо-баланс. Списания, возвраты и начисления сохраняются на этом устройстве.') node.remove();
      if (text === 'По завершённым записям.') node.remove();
      if (text === 'Только дни, в которых есть время на всю сессию.') node.remove();
      if (text === 'Это время свободно на всю выбранную длительность.') node.remove();
      if (text === 'Некоторые варианты длительности недоступны для этой услуги.') node.remove();
    });

    const homeEyebrow = root.querySelector('[data-screen="home"] .home-hero .eyebrow, .home-hero .eyebrow');
    if (homeEyebrow?.textContent.includes('ГЛАВНАЯ')) homeEyebrow.remove();

    const profile = root.dataset.screen === 'profile';
    if (profile) {
      root.querySelectorAll('.muted').forEach(node => {
        if (/^Демо-баланс\./.test(node.textContent.trim())) node.remove();
      });
    }
  }

  function cleanDialogs() {
    document.querySelectorAll('.loyalty-dialog').forEach(dialog => {
      dialog.querySelectorAll('*').forEach(node => {
        if (node.children.length) return;
        const text = node.textContent.trim();
        if (text === 'демо-бонусов') node.textContent = 'бонусов';
        if (text.startsWith('Демонстрационная история')) node.remove();
      });
    });
  }

  function animateScreen() {
    const content = root.querySelector('.screen-content');
    if (!content) return;
    const step = root.querySelector('.flow-nav > span')?.textContent?.trim() || '';
    const key = `${root.dataset.screen || 'home'}|${step}`;
    if (key === lastScreenKey && content.dataset.krugAnimated === '1') return;
    lastScreenKey = key;
    content.dataset.krugAnimated = '1';
    content.classList.remove('krug-enter');
    void content.offsetWidth;
    content.classList.add('krug-enter');
    content.querySelectorAll('.quick-grid,.service-list,.booking-list').forEach(list => list.classList.add('krug-stagger'));
  }

  function fixBrokenImages() {
    root.querySelectorAll('.profile-photo,.home-user-avatar img,.profile-identity .avatar img').forEach(img => {
      if (img.complete && img.naturalWidth === 0) img.remove();
    });
  }

  function enhance() {
    cleanCopy();
    cleanDialogs();
    fixBrokenImages();
    animateScreen();
  }

  const observer = new MutationObserver(() => queueMicrotask(enhance));
  observer.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['data-screen'] });
  const dialogObserver = new MutationObserver(() => queueMicrotask(cleanDialogs));
  dialogObserver.observe(document.body, { childList:true, subtree:true });

  root.addEventListener('error', event => {
    if (event.target.matches?.('.profile-photo,.home-user-avatar img,.profile-identity .avatar img')) event.target.remove();
  }, true);

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    try {
      const haptic = window.Telegram?.WebApp?.HapticFeedback;
      if (!haptic) return;
      if (button.matches('.duration,.date-card,.time-card,[data-service],[data-service-quick],[data-rental]')) haptic.selectionChanged();
      else if (button.matches('.primary,[data-cancel]')) haptic.impactOccurred(button.matches('[data-cancel]') ? 'medium' : 'light');
    } catch {}
  }, {passive:true});

  enhance();
})();
