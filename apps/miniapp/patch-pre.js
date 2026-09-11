(() => {
  const B = window.KrugBooking;
  const API = window.KrugData;
  const Client = window.KrugClient;
  const Loyalty = window.KrugLoyalty;
  const Account = window.KrugAccount;

  if (!B || !API || !Client || !Loyalty || !Account) return;

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
    return rawCancelBooking(id);
  };

  // Loyalty remains explicitly test-only until authenticated client identity and
  // the CRM payment event are connected in 0.5. It is never sent to /api/bookings.
  const openingBalance = 700;
  const baseEntries = [
    { id: 'demo-3', amount: -500, title: 'Списание', daysAgo: 3 },
    { id: 'demo-2', amount: 240, title: 'Запись', daysAgo: 7 },
    { id: 'demo-1', amount: 300, title: 'Запись', daysAgo: 14 }
  ];

  async function loyaltyHistory() {
    return baseEntries
      .map(({ daysAgo, ...entry }) => ({ ...entry, date: B.addDays(B.today(), -daysAgo) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  Loyalty.getLoyaltyHistory = loyaltyHistory;
  Loyalty.getLoyaltyBalance = async () => {
    const history = await loyaltyHistory();
    return {
      balance: openingBalance + history.reduce((sum, entry) => sum + entry.amount, 0),
      rublesPerBonus: 1,
      openingBalance,
      demo: true
    };
  };
  Loyalty.getRedemptionQuote = async price => {
    const { balance } = await Loyalty.getLoyaltyBalance();
    return {
      balance,
      applied: 0,
      payable: Math.max(0, Number(price) || 0),
      remaining: balance,
      disabled: true
    };
  };
})();
