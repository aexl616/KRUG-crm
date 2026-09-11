/* Live loyalty adapter. The backend owns balances, reservations and history. */
window.KrugLoyalty = (() => {
  const API_BASE = String(window.KrugConfig?.API_BASE || '').replace(/\/$/, '');
  let cache = null;

  function telegramHeaders() {
    const initData = window.KrugTelegram?.getInitData?.() || '';
    return initData ? { 'X-Telegram-Init-Data': initData } : {};
  }

  function emptySnapshot(extra = {}) {
    return { balance: 0, ledgerBalance: 0, reserved: 0, rublesPerBonus: 1, accrualPercent: 0, enabled: false, history: [], ...extra };
  }

  async function fetchSnapshot({ force = false } = {}) {
    if (cache && !force && Date.now() - cache.at < 10000) return structuredClone(cache.value);
    const client = await window.KrugClient.getCurrentClient();
    const telegramUserId = Number(client.telegramUserId);
    if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) return emptySnapshot({ requiresTelegram: true });

    let response;
    try {
      response = await fetch(`${API_BASE}/api/loyalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...telegramHeaders() },
        body: JSON.stringify({ telegramUserId })
      });
    } catch {
      throw new Error('Не удалось загрузить баллы. Проверь интернет и попробуй ещё раз.');
    }
    const result = await response.json().catch(() => ({}));
    if (response.status === 404 && result.error === 'CLIENT_NOT_FOUND') {
      return emptySnapshot({ requiresProfile: true });
    }
    if (!response.ok || !result.ok) throw new Error(result.message || 'Баллы временно недоступны.');
    const value = result.loyalty || {};
    value.balance = Number(value.balance || 0);
    value.ledgerBalance = Number(value.ledgerBalance || value.balance || 0);
    value.reserved = Number(value.reserved || 0);
    value.rublesPerBonus = Number(value.rublesPerBonus || 1);
    value.accrualPercent = Number(value.accrualPercent || 0);
    value.history = Array.isArray(value.history) ? value.history : [];
    cache = { at: Date.now(), value };
    return structuredClone(value);
  }

  async function getLoyaltyBalance(options) {
    const snapshot = await fetchSnapshot(options);
    return {
      balance: snapshot.balance,
      ledgerBalance: snapshot.ledgerBalance,
      reserved: snapshot.reserved,
      rublesPerBonus: snapshot.rublesPerBonus,
      accrualPercent: snapshot.accrualPercent,
      enabled: snapshot.enabled !== false,
      requiresTelegram: !!snapshot.requiresTelegram,
      requiresProfile: !!snapshot.requiresProfile
    };
  }

  async function getLoyaltyHistory(options) {
    const snapshot = await fetchSnapshot(options);
    return snapshot.history.map(entry => ({
      ...entry,
      amount: Number(entry.amount || 0),
      date: String(entry.date || String(entry.createdAt || '').slice(0, 10))
    }));
  }

  async function getRedemptionQuote(price, useBonuses) {
    const snapshot = await fetchSnapshot();
    const amount = Math.max(0, Number(price) || 0);
    const rublesPerBonus = Math.max(1, Number(snapshot.rublesPerBonus || 1));
    const maxPointsByPrice = Math.floor(amount / rublesPerBonus);
    const canRedeem = snapshot.enabled !== false && !snapshot.requiresTelegram && !snapshot.requiresProfile;
    const applied = useBonuses && canRedeem
      ? Math.min(Math.max(0, Number(snapshot.balance || 0)), maxPointsByPrice)
      : 0;
    return {
      balance: Number(snapshot.balance || 0),
      applied,
      payable: Math.max(0, amount - applied * rublesPerBonus),
      remaining: Number(snapshot.balance || 0) - applied,
      rublesPerBonus,
      accrualPercent: Number(snapshot.accrualPercent || 0),
      enabled: canRedeem,
      requiresTelegram: !!snapshot.requiresTelegram,
      requiresProfile: !!snapshot.requiresProfile
    };
  }

  function invalidate() { cache = null; }

  return { getLoyaltyBalance, getLoyaltyHistory, getRedemptionQuote, invalidate };
})();
