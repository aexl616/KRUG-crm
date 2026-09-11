(() => {
  const API = window.KrugData;
  const Client = window.KrugClient;
  const Account = window.KrugAccount;

  if (!API || !Client || !Account) return;

  Object.assign(Account.statuses, {
    request: 'Ожидает подтверждения',
    in_progress: 'Сессия идёт'
  });

  // Keep onboarding out of the first paint. The profile form is still forced
  // before a client can submit a real booking.
  const rawGetClient = Client.getCurrentClient.bind(Client);
  Client.getCurrentClient = async () => ({ ...(await rawGetClient()), onboarded: true });

  const rawGetBookings = API.getMyBookings.bind(API);
  const rawCancelBooking = API.cancelBooking.bind(API);

  API.getMyBookings = async () => {
    const bookings = await rawGetBookings();
    const now = Date.now();
    return bookings.map(booking => {
      if (!['request', 'confirmed'].includes(booking.status)) return booking;
      const start = new Date(`${booking.date}T${booking.startTime}:00+03:00`).getTime();
      const end = start + Number(booking.durationHours) * 3600000;
      return now >= start && now < end ? { ...booking, status: 'in_progress' } : booking;
    });
  };

  API.cancelBooking = async id => {
    const booking = (await rawGetBookings()).find(item => item.id === id || item.requestId === id);
    if (booking) {
      const start = new Date(`${booking.date}T${booking.startTime}:00+03:00`).getTime();
      if (Date.now() >= start) {
        throw new Error('После начала сессии отменить запись в приложении нельзя. Свяжись со студией.');
      }
    }
    const result = await rawCancelBooking(id);
    window.KrugLoyalty?.invalidate?.();
    return result;
  };
})();
