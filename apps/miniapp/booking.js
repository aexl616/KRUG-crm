/* Pure booking rules. No DOM or persistence dependencies. */
window.KrugBooking = (() => {
  const timeZone = 'Europe/Moscow';

  function today(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = type => parts.find(p => p.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function addDays(date, count) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + count);
    return value.toISOString().slice(0, 10);
  }

  const toMinutes = time => Number(time.split(':')[0]) * 60 + Number(time.split(':')[1]);
  const toTime = minutes => `${String(Math.floor((minutes % 1440 + 1440) % 1440 / 60)).padStart(2, '0')}:${String((minutes % 60 + 60) % 60).padStart(2, '0')}`;
  const endTime = (start, hours) => toTime(toMinutes(start) + hours * 60) + (toMinutes(start) + hours * 60 >= 1440 ? ' следующего дня' : '');

  function periodTiers(service, period = 'regular') {
    return (service?.priceTiers || [])
      .filter(tier => (tier.period || 'regular') === period)
      .map(tier => ({ ...tier, durationHours: Number(tier.durationHours), totalPrice: Number(tier.totalPrice) }))
      .filter(tier => Number.isFinite(tier.durationHours) && Number.isFinite(tier.totalPrice))
      .sort((a, b) => a.durationHours - b.durationHours);
  }

  function priceForPeriod(service, hours, period = 'regular') {
    const durationHours = Number(hours);
    if (!service || !Number.isFinite(durationHours) || durationHours <= 0) return null;

    const tiers = periodTiers(service, period);
    const exact = tiers.find(tier => tier.durationHours === durationHours);
    if (exact) return exact.totalPrice;

    const hourlyRate = Number(service.pricingRules?.hourlyRate);
    if (Number.isFinite(hourlyRate) && hourlyRate >= 0) return Math.round(durationHours * hourlyRate);

    const extraHour = Number(service.pricingRules?.[period]?.extraHour);
    if (Number.isFinite(extraHour) && extraHour >= 0) {
      const base = [...tiers].reverse().find(tier => tier.durationHours < durationHours);
      if (!base) return Math.round(durationHours * extraHour);
      return base.totalPrice + Math.round((durationHours - base.durationHours) * extraHour);
    }

    return null;
  }

  function priceFor(service, hours) {
    const durationHours = Number(hours ?? service?.defaultDurationHours);
    if (!service || !Number.isFinite(durationHours) || durationHours <= 0) {
      if (['fixed', 'minimum'].includes(service?.pricingType) && Number.isFinite(Number(service?.price))) return Number(service.price);
      throw new Error('Эта длительность недоступна. Выбери другую.');
    }

    if (service.minDurationHours && durationHours < Number(service.minDurationHours)) {
      throw new Error('Эта длительность недоступна. Выбери другую.');
    }

    if (['fixed', 'minimum'].includes(service.pricingType)) {
      if (!Number.isFinite(Number(service.price))) throw new Error('Цена этой услуги временно недоступна.');
      return Number(service.price);
    }

    const price = priceForPeriod(service, durationHours, 'regular');
    if (!Number.isFinite(price)) throw new Error('Эта длительность недоступна. Выбери другую.');
    return price;
  }

  function canBookDuration(service, hours) {
    const durationHours = Number(hours);
    if (!service || !Number.isFinite(durationHours) || durationHours <= 0) return false;
    if (service.minDurationHours && durationHours < Number(service.minDurationHours)) return false;
    if (service.isRentalPackage) return durationHours === Number(service.defaultDurationHours);
    if (service.pricingType === 'minimum') return Number.isFinite(Number(service.price));
    try {
      return Number.isFinite(priceFor(service, durationHours));
    } catch {
      return false;
    }
  }

  function durationFor(service, hours) {
    return !service.selectDuration && ['fixed', 'minimum'].includes(service.pricingType)
      ? Number(service.defaultDurationHours)
      : Number(hours);
  }

  function quoteFor(service, hours, startTime) {
    const durationHours = Number(hours);
    const regularPrice = priceFor(service, durationHours);
    const start = startTime ? toMinutes(startTime) : NaN;
    const morning = service?.pricingRules?.morning;
    const morningStart = morning?.start ? toMinutes(String(morning.start).slice(0, 5)) : NaN;
    const morningEnd = morning?.end ? toMinutes(String(morning.end).slice(0, 5)) : NaN;
    const base = {
      totalPrice: regularPrice,
      pricingPeriod: 'regular',
      regularPrice,
      durationHours,
      startTime: startTime || null,
      endTime: startTime ? endTime(startTime, durationHours) : null,
      version: 4
    };

    if (!morning || !Number.isFinite(start) || !Number.isFinite(morningStart) || !Number.isFinite(morningEnd)) return base;

    const end = start + durationHours * 60;
    const boundaries = [...new Set([start, end, morningStart, morningEnd].filter(value => value >= start && value <= end))].sort((a, b) => a - b);
    const segments = boundaries.slice(0, -1).map((from, index) => {
      const to = boundaries[index + 1];
      const segmentHours = (to - from) / 60;
      const period = from >= morningStart && to <= morningEnd ? 'morning' : 'regular';
      const totalPrice = priceForPeriod(service, segmentHours, period);
      if (!Number.isFinite(totalPrice)) throw new Error('Не удалось рассчитать стоимость этого времени.');
      return {
        startTime: toTime(from),
        endTime: toTime(to),
        durationHours: segmentHours,
        hourlyRate: Math.round(totalPrice / segmentHours),
        totalPrice,
        pricingPeriod: period
      };
    });

    const periods = new Set(segments.map(segment => segment.pricingPeriod));
    return {
      ...base,
      totalPrice: segments.reduce((sum, segment) => sum + segment.totalPrice, 0),
      pricingPeriod: periods.size > 1 ? 'mixed' : segments[0]?.pricingPeriod || 'regular',
      segments
    };
  }

  function availableSlots(availability, durationHours, now = new Date()) {
    if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 12 || availability.closed) return [];
    if (Array.isArray(availability.slots)) return [...availability.slots];
    const slots = [];
    for (let start = availability.open; start + durationHours * 60 <= availability.close; start += 60) {
      const end = start + durationHours * 60;
      if (new Date(`${availability.date}T${toTime(start)}:00+03:00`) <= now) continue;
      if (availability.busy.some(interval => start < interval.end && end > interval.start)) continue;
      slots.push(toTime(start));
    }
    return slots;
  }

  function newDraft() {
    return { staffId: null, staffName: null, staffChoice: 'auto', staffContext: null, staffInvalid: false, serviceId: null, durationHours: null, date: null, startTime: null, price: null, client: { name: '', phone: '', telegram: '' }, comment: '', requestId: crypto.randomUUID() };
  }

  function validateClient(client = {}) {
    const errors = {};
    const name = String(client.name || '').trim();
    const phone = String(client.phone || '').trim();
    const telegram = String(client.telegram || '').trim();
    if (name.length < 2 || name.length > 80) errors.name = 'Напиши своё имя — от 2 до 80 символов.';
    const digits = phone.replace(/\D/g, '');
    if (!/^[+\d\s().\-–—]+$/.test(phone) || digits.length < 7 || digits.length > 15) errors.phone = 'Введи телефон с кодом страны, например +7 999 123-45-67.';
    if (telegram && !/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegram)) errors.telegram = 'Проверь имя в Telegram, например @your_name, или оставь поле пустым.';
    return errors;
  }

  function changeService(draft, service) {
    if (draft.serviceId === service.id) return;
    const fixedDuration = !service.selectDuration && ['fixed', 'minimum'].includes(service.pricingType)
      ? Number(service.defaultDurationHours)
      : null;
    Object.assign(draft, {
      staffId: null, staffName: null, staffChoice: 'auto', staffContext: null, staffInvalid: false,
      serviceId: service.id,
      durationHours: fixedDuration,
      date: null,
      startTime: null,
      price: fixedDuration ? priceFor(service, fixedDuration) : (['fixed', 'minimum'].includes(service.pricingType) ? Number(service.price) : null)
    });
  }

  async function changeDuration(draft, service, hours, getSlots) {
    const durationHours = Number(hours);
    if (draft.durationHours === durationHours) return false;
    const price = priceFor(service, durationHours);
    const previousDate = draft.date;
    Object.assign(draft, { durationHours, price, date: null, startTime: null });
    if (previousDate && (await getSlots(previousDate, durationHours, service.id)).length) draft.date = previousDate;
    return !!previousDate && !draft.date;
  }

  // Manual 'any' is a deliberate preference; never silently replace it with a named person.
  function reconcileStaff(draft, availability) {
    const mode = availability.staffSelection || 'none';
    const context = [draft.serviceId, draft.date, draft.startTime, draft.durationHours].join('|');
    const choice = availability.staffBySlot?.[draft.startTime];
    const staff = choice?.staff || [];
    const selected = staff.find(row => row.id === draft.staffId);
    let message = '';
    if (mode === 'none') {
      Object.assign(draft, {staffId:null,staffName:null,staffChoice:'auto',staffInvalid:false});
    } else if (draft.staffChoice === 'any' && mode !== 'required') {
      Object.assign(draft, {staffId:null,staffName:null,staffInvalid:false});
    } else if (draft.staffChoice === 'manual') {
      if (!selected) {
        draft.staffId=null; draft.staffName=null; draft.staffInvalid=true;
        message='Выбранный специалист недоступен. Выбери другого или «Любой доступный».';
      } else { draft.staffName=selected.name; draft.staffInvalid=false; }
    } else {
      const recommended=staff.find(row=>row.id===choice?.defaultStaffId) || staff[0];
      draft.staffId=recommended?.id || null; draft.staffName=recommended?.name || null;
      draft.staffInvalid=false;
    }
    draft.staffContext=context;
    return {mode,staff,message,ready:mode==='none' || (mode==='optional' && !draft.staffInvalid) || (!!staff.length && !draft.staffInvalid && !!draft.staffId)};
  }
  function chooseStaff(draft, id, staff) {
    const chosen=staff.find(row=>row.id===id);
    if (id && !chosen) return false;
    Object.assign(draft,{staffId:chosen?.id || null,staffName:chosen?.name || null,staffChoice:id?'manual':'any',staffInvalid:false});
    return true;
  }
  const staffBadge = (date, now = new Date()) => date === today(now) ? 'Сегодня работает' : 'В этот день работает';

  return {
    reconcileStaff, chooseStaff, staffBadge,
    today, addDays, toMinutes, toTime, endTime,
    priceFor, quoteFor, durationFor, canBookDuration,
    availableSlots, newDraft, validateClient, changeService, changeDuration
  };
})();
