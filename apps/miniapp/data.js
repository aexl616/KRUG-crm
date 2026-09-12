/* Real Mini App data adapter. Supabase is authoritative through the KRUG Vercel API. */
window.KrugData = (() => {
  const B = window.KrugBooking;
  const API_BASE = String(window.KrugConfig?.API_BASE || '').replace(/\/$/, '');
  const BOOKING_CACHE_KEY = 'krug_mini_booking_cache_v2';
  const MAX_CAPABILITIES = 50;
  const availabilityCache = new Map();
  let servicesCache = null;
  let servicesFetchedAt = 0;
  let memoryRows = null;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function apiUrl(path) {
    if (!API_BASE) throw new Error('Сервис КРУГ временно недоступен.');
    return `${API_BASE}${path}`;
  }

  function telegramHeaders() {
    const initData = window.KrugTelegram?.getInitData?.() || '';
    return initData ? { 'X-Telegram-Init-Data': initData } : {};
  }

  async function request(path, options = {}) {
    const headers = telegramHeaders();
    if (path.startsWith('/api/bookings') && !headers['X-Telegram-Init-Data']) {
      throw Object.assign(new Error('Открой Mini App через Telegram и попробуй ещё раз.'), { code: 'TELEGRAM_AUTH_REQUIRED' });
    }
    let response;
    try {
      response = await fetch(apiUrl(path), {
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
      });
    } catch {
      throw Object.assign(new Error('Не удалось связаться со студией. Проверь интернет и попробуй ещё раз.'), { code: 'NETWORK_ERROR' });
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || 'Сервис КРУГ временно недоступен. Попробуй ещё раз.');
      error.code = result.error || `HTTP_${response.status}`;
      error.status = response.status;
      if (['SLOT_UNAVAILABLE', 'STAFF_UNAVAILABLE', 'STAFF_REQUIRED'].includes(error.code)) invalidateAvailability();
      if (['SERVICE_UNAVAILABLE', 'DURATION_UNAVAILABLE'].includes(error.code)) servicesCache = null;
      throw error;
    }
    return result;
  }

  function normalizeService(service) {
    const row = structuredClone(service);
    row.priceTiers = (row.priceTiers || [])
      .map(tier => ({ ...tier, durationHours: Number(tier.durationHours), totalPrice: Number(tier.totalPrice) }))
      .sort((a, b) => a.durationHours - b.durationHours || a.totalPrice - b.totalPrice);
    row.minDurationHours = row.minDurationHours == null ? null : Number(row.minDurationHours);
    row.defaultDurationHours = row.defaultDurationHours == null ? null : Number(row.defaultDurationHours);
    row.isRentalPackage = !!row.isRentalPackage || row.publicCategory === 'rental_package';

    if (row.isRentalPackage) {
      row.selectDuration = false;
    } else if (row.pricingType === 'hourly') {
      const hasDynamicRule = Number.isFinite(Number(row.pricingRules?.hourlyRate)) || Number.isFinite(Number(row.pricingRules?.regular?.extraHour));
      row.selectDuration = hasDynamicRule;
    } else if (row.pricingType === 'minimum') {
      row.selectDuration = true;
    }
    return row;
  }

  async function getServices({ force = false } = {}) {
    if (servicesCache && !force && Date.now() - servicesFetchedAt < 60000) return structuredClone(servicesCache);
    const result = await request('/api/services');
    if (!Array.isArray(result.services)) throw new Error('Не удалось загрузить каталог студии.');
    servicesCache = result.services.filter(row => row.active !== false && !row.legacyOnly).map(normalizeService);
    servicesFetchedAt = Date.now();
    return structuredClone(servicesCache);
  }

  async function getService(id) {
    const services = await getServices();
    const service = services.find(item => item.id === id && item.active !== false);
    if (!service) throw new Error('Эта услуга сейчас недоступна. Выбери другую.');
    return service;
  }

  function availabilityKey(date, durationHours, serviceId) {
    return `${date}|${Number(durationHours)}|${serviceId}`;
  }

  async function getAvailability(date, durationHours, serviceId, { force = false } = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return { date, closed: true, slots: [] };
    const duration = Number(durationHours);
    if (!Number.isFinite(duration) || duration <= 0 || !serviceId) return { date, closed: true, slots: [] };
    const key = availabilityKey(date, duration, serviceId);
    const cached = availabilityCache.get(key);
    if (!force && cached && Date.now() - cached.at < 15000) return structuredClone(cached.value);
    const params = new URLSearchParams({ date, durationHours: String(duration), serviceId });
    const result = await request(`/api/availability?${params}`);
    const availability = result.availability;
    if (!availability || !Array.isArray(availability.slots)) throw new Error('Не удалось загрузить расписание студии.');
    availabilityCache.set(key, { at: Date.now(), value: availability });
    return structuredClone(availability);
  }

  async function getAvailableSlots(date, durationHours, serviceId) {
    const service = await getService(serviceId);
    if (service.legacyOnly || !B.canBookDuration(service, Number(durationHours))) return [];
    const availability = await getAvailability(date, durationHours, serviceId);
    return availability.closed ? [] : [...availability.slots];
  }

  function readCache() {
    if (memoryRows) return structuredClone(memoryRows);
    try {
      const raw = localStorage.getItem(BOOKING_CACHE_KEY);
      if (!raw) return [];
      const rows = JSON.parse(raw);
      return Array.isArray(rows) ? rows.filter(row => row && UUID_RE.test(row.requestId)) : [];
    } catch {
      return [];
    }
  }

  function writeCache(rows) {
    const compact = [...rows]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, MAX_CAPABILITIES);
    memoryRows = structuredClone(compact);
    // A storage quota failure must never turn a successful server booking into an error.
    try { localStorage.setItem(BOOKING_CACHE_KEY, JSON.stringify(compact)); } catch {}
  }

  function cacheBooking(booking) {
    const rows = readCache();
    const index = rows.findIndex(row => row.requestId === booking.requestId);
    if (index >= 0) rows[index] = { ...rows[index], ...booking };
    else rows.push(booking);
    writeCache(rows);
  }

  function mergeRemoteBooking(remote, local = null) {
    if (!remote || !remote.id || !UUID_RE.test(remote.requestId) ||
        !remote.status || remote.price == null || !Number.isFinite(Number(remote.price))) {
      throw new Error('Студия вернула неполные данные записи. Обнови историю перед повторной отправкой.');
    }
    // Only presentation fields may come from the device. Status, price and all
    // settlement fields must come from this server response, even when absent.
    return {
      ...remote,
      durationHours: Number(remote.durationHours),
      price: Number(remote.price),
      amountDue: Number(remote.amountDue ?? remote.price),
      client: local?.client || null,
      comment: local?.comment || '',
      priceSnapshot: remote.priceSnapshot || null,
      useBonuses: Number(remote.bonusReserved || 0) > 0 || Number(remote.bonusSpent || 0) > 0,
      bonusReserved: Number(remote.bonusReserved || 0),
      bonusSpent: Number(remote.bonusSpent || 0),
      bonusEarned: Number(remote.bonusEarned || 0),
      paymentMode: 'on_site_only'
    };
  }

  function invalidateAvailability() { availabilityCache.clear(); }
  function invalidateLoyalty() { window.KrugLoyalty?.invalidate?.(); }

  async function createBooking(data) {
    const service = await getService(data.serviceId);
    const durationHours = B.durationFor(service, data.durationHours);
    if (!B.canBookDuration(service, durationHours)) throw new Error('Эта длительность недоступна. Выбери другую.');

    const client = {
      name: String(data.client?.name || '').trim(),
      phone: String(data.client?.phone || '').trim(),
      telegram: String(data.client?.telegram || '').trim()
    };
    const fields = B.validateClient(client);
    if (Object.keys(fields).length) throw Object.assign(new Error('Проверь выделенные поля.'), { fields });

    const telegramUserId = window.KrugTelegram?.getTelegramUser?.()?.id || null;
    const requestId = data.requestId || (data.requestId = crypto.randomUUID());
    if (!UUID_RE.test(requestId)) throw new Error('Не удалось идентифицировать заявку. Начни новую запись.');
    const comment = String(data.comment || '').trim().slice(0, 1000);
    // Save the capability before sending so a lost HTTP response can still be retried
    // with the same idempotency key. Server history no longer depends on this cache.
    cacheBooking({ requestId, client, comment, createdAt: new Date().toISOString() });

    const result = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        serviceId: service.id,
        staffId: data.staffId || null,
        date: data.date,
        startTime: data.startTime,
        durationHours,
        client: { ...client, telegramUserId },
        comment,
        useBonuses: data.useBonuses === true
      })
    });

    const booking = mergeRemoteBooking(result.booking, { client, comment });
    cacheBooking(booking);
    invalidateAvailability();
    invalidateLoyalty();
    return structuredClone(booking);
  }

  async function getMyBookings() {
    const localRows = readCache();
    const result = await request('/api/bookings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!Array.isArray(result.bookings)) throw new Error('Не удалось загрузить историю записей.');

    const merged = result.bookings.map(remote =>
      mergeRemoteBooking(remote, localRows.find(local => local.requestId === remote.requestId))
    );

    // Keep only unresolved local idempotency keys alongside authoritative server rows.
    // They are recovery metadata, never offline booking history.
    const unresolved = localRows.filter(local =>
      UUID_RE.test(local.requestId) && !local.id && !merged.some(row => row.requestId === local.requestId)
    );
    writeCache([...unresolved, ...merged]);

    return structuredClone(merged.sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)));
  }

  async function cancelBooking(id) {
    const rows = await getMyBookings();
    const local = rows.find(row => row.id === id || row.requestId === id);
    if (!local?.requestId) throw new Error('Запись не найдена.');
    const result = await request('/api/bookings/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: local.requestId })
    });
    if (!result.booking || result.booking.requestId !== local.requestId || result.booking.status !== 'cancelled') {
      throw new Error('Не удалось подтвердить отмену. Обнови историю записей.');
    }
    const booking = mergeRemoteBooking({ ...local, ...result.booking }, local);
    cacheBooking(booking);
    invalidateAvailability();
    invalidateLoyalty();
    return structuredClone(booking);
  }

  async function completePaidBooking() {
    throw new Error('Оплата и завершение сессии фиксируются сотрудником на студии.');
  }

  return {
    getServices, getService, getAvailability, getAvailableSlots,
    createBooking, getMyBookings, cancelBooking, completePaidBooking
  };
})();
