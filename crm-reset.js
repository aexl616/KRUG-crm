(() => {
  const RESET_KEY = 'krug-crm-clean-start-v1';
  const STORAGE_KEY = 'studio-income-app-v1';
  if (localStorage.getItem(RESET_KEY) === '1') return;

  let current = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    current = raw ? JSON.parse(raw) : {};
    if (!current || typeof current !== 'object' || Array.isArray(current)) current = {};
  } catch {
    current = {};
  }

  const cleaned = {
    ...current,
    clients: [],
    bookings: [],
    payments: [],
    payouts: [],
    expenses: [],
    studioBlocks: []
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  localStorage.setItem(RESET_KEY, '1');
  sessionStorage.removeItem('krug-app-admin-import-snapshot');
})();
