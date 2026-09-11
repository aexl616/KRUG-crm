window.KrugTelegram = (() => {
  const webApp = () => window.Telegram?.WebApp;
  function expandApp() { webApp()?.expand?.(); }
  function closeApp() { webApp()?.close?.(); }
  function getTelegramUser() { return webApp()?.initDataUnsafe?.user || null; }
  function getInitData() { return String(webApp()?.initData || ''); }
  function getStartParam() { return webApp()?.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('tgWebAppStartParam') || ''; }
  function haptic(type = 'light') { webApp()?.HapticFeedback?.impactOccurred?.(type); }
  function initTelegram(onBack) {
    const app = webApp();
    if (!app) return;
    app.ready?.();
    expandApp();
    app.setHeaderColor?.('#111111');
    app.setBackgroundColor?.('#111111');
    app.setBottomBarColor?.('#111111');
    app.BackButton?.onClick?.(onBack);
    const updateInsets = () => {
      const top = (app.safeAreaInset?.top || 0) + (app.contentSafeAreaInset?.top || 0);
      const bottom = (app.safeAreaInset?.bottom || 0) + (app.contentSafeAreaInset?.bottom || 0);
      document.documentElement.style.setProperty('--tg-inset-top', `${top}px`);
      document.documentElement.style.setProperty('--tg-inset-bottom', `${bottom}px`);
    };
    updateInsets();
    app.onEvent?.('safeAreaChanged', updateInsets);
    app.onEvent?.('contentSafeAreaChanged', updateInsets);
  }
  function showBack(visible) {
    const back = webApp()?.BackButton;
    if (visible) back?.show?.(); else back?.hide?.();
  }
  const isTelegram = () => !!webApp() && !!getInitData();
  return { initTelegram, getTelegramUser, getInitData, getStartParam, haptic, expandApp, closeApp, showBack, isTelegram };
})();
