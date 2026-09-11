/* Shared KRUG contracts. Keep browser-safe until the apps move to a build step. */
(function(root) {
  const contracts = Object.freeze({
    timezone: 'Europe/Moscow',
    bookingStatuses: Object.freeze(['request', 'confirmed', 'in_progress', 'completed', 'cancelled']),
    activeBookingStatuses: Object.freeze(['request', 'confirmed', 'in_progress']),
    pricingTypes: Object.freeze(['hourly', 'fixed', 'minimum']),
    api: Object.freeze({
      health: '/api/health',
      services: '/api/services',
      availability: '/api/availability',
      bookings: '/api/bookings',
      clients: '/api/clients'
    })
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = contracts;
  else root.KrugContracts = contracts;
})(globalThis);
