(() => {
  'use strict';

  const TOKEN_KEY = 'krug-app-admin-token';
  const API_URL = '/api/app-admin';
  const POLL_MS = 12000;
  let syncing = false;
  let lastFingerprint = '';

  const statusMap = {
    request: 'заявка',
    confirmed: 'подтверждено',
    in_progress: 'в процессе',
    completed: 'завершено',
    cancelled: 'отменено'
  };

  function categoryForService(serviceId) {
    const id = String(serviceId || '');
    if (id.startsWith('recording')) return 'recording';
    if (id.startsWith('rental')) return 'rent';
    if (id.startsWith('studio-')) return 'studioProduction';
    return 'custom';
  }

  function durationLabel(hours) {
    const value = Number(hours || 0);
    if (!Number.isFinite(value) || value <= 0) return '1 час';
    if (!Number.isInteger(value)) return `${value} ч`;
    const mod10 = value % 10;
    const mod100 = value % 100;
    const suffix = mod10 === 1 && mod100 !== 11 ? 'час' : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? 'часа' : 'часов';
    return `${value} ${suffix}`;
  }

  async function request(action) {
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) return null;
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || 'Mini App sync failed');
    return result.data;
  }

  function localClientId(remoteId) {
    return `miniapp-client-${remoteId}`;
  }

  function localBookingId(remoteId) {
    return `miniapp-booking-${remoteId}`;
  }

  function cleanMiniAppClients(rows) {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter(client => {
      if (!client || client.source !== 'miniapp') return true;
      const key = String(client.miniAppClientId || client.id || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function cleanMiniAppBookings(rows) {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter(booking => {
      if (!booking || booking.source !== 'miniapp') return true;
      const key = String(booking.miniAppBookingId || booking.id || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function mergeClients(remoteClients) {
    const remoteIds = new Set(remoteClients.filter(Boolean).map(row => String(row.id || '')).filter(Boolean));
    const original = Array.isArray(state.clients) ? state.clients : [];
    const current = cleanMiniAppClients(original).filter(client => client?.source !== 'miniapp' || remoteIds.has(String(client.miniAppClientId || '').trim()));
    const byMiniAppId = new Map(current.filter(Boolean).filter(client => client.miniAppClientId).map(client => [String(client.miniAppClientId), client]));
    const result = [...current];
    let changed = JSON.stringify(original) !== JSON.stringify(current);

    for (const remote of remoteClients) {
      if (!remote?.id || !String(remote.name || '').trim()) continue;
      const remoteId = String(remote.id);
      const existing = byMiniAppId.get(remoteId) || current.find(client => client.id === localClientId(remoteId));
      const next = {
        ...(existing || {}),
        id: existing?.id || localClientId(remoteId),
        miniAppClientId: remoteId,
        source: 'miniapp',
        name: String(remote.name || 'Клиент'),
        phone: String(remote.phone || ''),
        telegram: String(remote.telegram || ''),
        telegramUserId: remote.telegramUserId == null ? null : Number(remote.telegramUserId),
        registeredInApp: remote.registeredInApp === true,
        miniAppCategory: String(remote.category || ''),
        firstStudioVisitAt: remote.firstStudioVisitAt || '',
        appRegisteredAt: remote.appRegisteredAt || '',
        bannedInMiniApp: remote.banned === true,
        loyaltyBalance: Number(remote.loyaltyBalance || 0),
        tags: Array.isArray(existing?.tags) ? existing.tags : [],
        status: existing?.status || 'Новый',
        notes: existing?.notes || existing?.comment || '',
        notesUpdatedAt: existing?.notesUpdatedAt || '',
        comment: existing?.comment || ''
      };

      if (existing) {
        const index = result.findIndex(client => client.id === existing.id);
        if (index >= 0 && JSON.stringify(result[index]) !== JSON.stringify(next)) {
          result[index] = next;
          changed = true;
        }
      } else {
        result.push(next);
        byMiniAppId.set(remoteId, next);
        changed = true;
      }
    }

    if (changed) state.clients = result;
    return { changed, clients: result };
  }

  function mergeBookings(remoteBookings, clients) {
    const remoteIds = new Set(remoteBookings.filter(Boolean).map(row => String(row.id || '')).filter(Boolean));
    const original = Array.isArray(state.bookings) ? state.bookings : [];
    const current = cleanMiniAppBookings(original).filter(booking => booking?.source !== 'miniapp' || remoteIds.has(String(booking.miniAppBookingId || '').trim()));
    const result = [...current];
    let changed = JSON.stringify(original) !== JSON.stringify(current);

    for (const remote of remoteBookings) {
      if (!remote?.id || !remote?.date || !remote?.startTime) continue;
      const remoteId = String(remote.id);
      const existing = current.find(booking => String(booking.miniAppBookingId || '') === remoteId || booking.id === localBookingId(remoteId));
      const client = clients.find(item => String(item.miniAppClientId || '') === String(remote.clientId || ''));
      const next = {
        ...(existing || {}),
        id: existing?.id || localBookingId(remoteId),
        miniAppBookingId: remoteId,
        miniAppRequestId: remote.requestId || '',
        source: 'miniapp',
        clientId: client?.id || existing?.clientId || '',
        clientName: String(remote.clientName || client?.name || ''),
        client: String(remote.clientName || client?.name || ''),
        phone: String(remote.phone || client?.phone || ''),
        telegram: String(remote.telegram || client?.telegram || ''),
        date: String(remote.date),
        time: String(remote.startTime),
        endTime: String(remote.endTime || ''),
        duration: durationLabel(remote.durationHours),
        durationHours: Number(remote.durationHours || 0),
        serviceCategoryId: categoryForService(remote.serviceId),
        serviceId: String(remote.serviceId || ''),
        serviceName: String(remote.serviceName || 'Услуга Mini App'),
        service: String(remote.serviceName || 'Услуга Mini App'),
        amount: Number(remote.price || 0),
        status: statusMap[remote.status] || 'заявка',
        comment: String(remote.comment || ''),
        paymentStatus: String(remote.paymentStatus || 'unpaid'),
        paidAmount: Number(remote.paidAmount || 0),
        paymentMethod: String(remote.paymentMethod || ''),
        bonusReserved: Number(remote.bonusReserved || 0),
        bonusSpent: Number(remote.bonusSpent || 0),
        amountDue: Number(remote.amountDue || remote.price || 0),
        createdAt: remote.createdAt || existing?.createdAt || ''
      };

      if (existing) {
        const index = result.findIndex(booking => booking.id === existing.id);
        if (index >= 0 && JSON.stringify(result[index]) !== JSON.stringify(next)) {
          result[index] = next;
          changed = true;
        }
      } else {
        result.push(next);
        changed = true;
      }
    }

    if (changed) state.bookings = result;
    return changed;
  }

  function canRenderSafely() {
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return false;
    if (document.querySelector('dialog[open], .modal-backdrop, .app-mgmt-modal-backdrop')) return false;
    return true;
  }

  async function syncNow() {
    if (syncing || !sessionStorage.getItem(TOKEN_KEY)) return;
    if (typeof state === 'undefined' || typeof saveState !== 'function') return;
    syncing = true;
    try {
      const [overview, bookings] = await Promise.all([request('overview'), request('bookingsOverview')]);
      if (!overview || !bookings) return;
      const fingerprint = JSON.stringify({
        clients: (overview.clients || []).map(row => [row.id,row.updatedAt,row.category,row.banned,row.loyaltyBalance]),
        bookings: (bookings || []).map(row => [row.id,row.status,row.date,row.startTime,row.endTime,row.paymentStatus,row.paidAmount,row.bonusReserved,row.amountDue])
      });
      if (fingerprint === lastFingerprint) return;

      const clientResult = mergeClients(Array.isArray(overview.clients) ? overview.clients : []);
      const bookingChanged = mergeBookings(Array.isArray(bookings) ? bookings : [], clientResult.clients);
      lastFingerprint = fingerprint;

      if (clientResult.changed || bookingChanged) {
        saveState();
        if (canRenderSafely() && typeof render === 'function') render();
        document.dispatchEvent(new CustomEvent('krug:miniapp-synced', {
          detail: { clients: (overview.clients || []).length, bookings: (bookings || []).length }
        }));
      }
    } catch (error) {
      console.warn('[KRUG CRM] Mini App sync failed', error?.message || error);
    } finally {
      syncing = false;
    }
  }

  setTimeout(syncNow, 600);
  setInterval(syncNow, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  document.addEventListener('krug:miniapp-refresh', syncNow);
})();
