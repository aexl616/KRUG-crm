/* Real Mini App data adapter. Supabase is authoritative through the KRUG Vercel API. */
window.KrugData = (() => {
  const B = window.KrugBooking;
  const API_BASE = String(window.KrugConfig?.API_BASE || '').replace(/\/$/, '');
  const BOOKING_CACHE_KEY = 'krug_mini_booking_cache_v2';
  const MAX_CAPABILITIES = 50;
  const availabilityCache = new Map();
  let servicesCache = null;

  function apiUrl(path) {
    if (!API_BASE) throw new Error('Сервис КРУГ временно недоступен.');
    return `${API_BASE}${path}`;
  }

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(apiUrl(path), options);
    } catch {
      throw Object.assign(new Error('Не удалось связаться со студией. Проверь интернет и попробуй ещё раз.'), { code: 'NETWORK_ERROR' });
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.message || 'Сервис КРУГ временно недоступен. Попробуй ещё раз.');
      error.code = result.error || `HTTP_${response.status}`;
      error.status = response.status;
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
      // Without a server-supplied extrapolation rule only explicit package tiers are selectable.
      row.selectDuration = hasDynamicRule;
    } else if (row.pricingType === 'minimum') {
      row.selectDuration = true;
    }

    return row;
  }

  async function getServices({ force = false } = {}) {
    if (servicesCache && !force) return structuredClone(servicesCache);
    const result = await request('/api/services');
    servicesCache = (result.services || []).map(normalizeService);
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
    const availability = result.availability || { date, closed: true, slots: [] };
    availability.slots = Array.isArray(availability.slots) ? availability.slots : [];
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
    try {
      const raw = localStorage.getItem(BOOKING_CACHE_KEY);
      if (!raw) return [];
      const rows = JSON.parse(raw);
      return Array.isArray(rows) ? rows.filter(row => row && typeof row.requestId === 'string') : [];
    } catch {
      return [];
    }
  }

  function writeCache(rows) {
    const compact = [...rows]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, MAX_CAPABILITIES);
    localStorage.setItem(BOOKING_CACHE_KEY, JSON.stringify(compact));
  }

  function cacheBooking(booking) {
    const rows = readCache();
    const index = rows.findIndex(row => row.requestId === booking.requestId);
    if (index >= 0) rows[index] = { ...rows[index], ...booking };
    else rows.push(booking);
    writeCache(rows);
  }

  function localForRequest(requestId) {
    return readCache().find(row => row.requestId === requestId) || null;
  }

  function mergeRemoteBooking(remote, local = null) {
    const durationHours = Number(remote.durationHours);
    return {
      ...(local || {}),
      ...remote,
      durationHours,
      price: Number(remote.price),
      amountDue: Number(remote.amountDue ?? remote.price),
      client: local?.client || null,
      comment: local?.comment || '',
      priceSnapshot: local?.priceSnapshot ? { ...local.priceSnapshot, totalPrice: Number(remote.price) } : null,
      useBonuses: false,
      bonusSpent: 0,
      bonusEarned: Number(local?.bonusEarned || 0),
      paymentMode: 'on_site_only'
    };
  }

  function invalidateAvailability() {
    availabilityCache.clear();
  }

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
    const requestId = data.requestId || crypto.randomUUID();
    const comment = String(data.comment || '').trim().slice(0, 1000);
    const localQuote = B.quoteFor(service, durationHours, data.startTime);

    const result = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        serviceId: service.id,
        date: data.date,
        startTime: data.startTime,
        durationHours,
        client: { ...client, telegramUserId },
        comment
      })
    });

    const remote = result.booking || {};
    const booking = mergeRemoteBooking(remote, {
      requestId,
      client,
      comment,
      priceSnapshot: {
        ...localQuote,
        totalPrice: Number(remote.price ?? localQuote.totalPrice),
        serviceId: service.id,
        date: data.date,
        pricingType: service.pricingType,
        isEstimate: service.pricingType === 'minimum'
      }
    });

    cacheBooking(booking);
    invalidateAvailability();
    return structuredClone(booking);
  }

  async function getMyBookings() {
    const localRows = readCache();
    const requestIds = [...new Set(localRows.map(row => row.requestId))].slice(0, MAX_CAPABILITIES);
    if (!requestIds.length) return [];

    try {
      const result = await request('/api/bookings/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds })
      });
      const remoteRows = Array.isArray(result.bookings) ? result.bookings : [];
      const merged = remoteRows.map(remote => mergeRemoteBooking(remote, localRows.find(local => local.requestId === remote.requestId)));
      writeCache(merged);
      return structuredClone(merged.sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)));
    } catch (error) {
      // Cached snapshots keep the account screen usable during a short outage.
      if (localRows.length) return structuredClone(localRows.sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)));
      throw error;
    }
  }

  async function cancelBooking(id) {
    const rows = readCache();
    const local = rows.find(row => row.id === id || row.requestId === id);
    if (!local?.requestId) throw new Error('Запись не найдена.');

    const result = await request('/api/bookings/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: local.requestId })
    });

    const booking = mergeRemoteBooking({ ...local, ...(result.booking || {}) }, local);
    cacheBooking(booking);
    invalidateAvailability();
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
