const STORAGE_KEY = "studio-income-app-v1";
const PAYOUT_RESET_VERSION = 2;
const CALENDAR_START_HOUR = 9;
const CALENDAR_END_HOUR = 23;
const CALENDAR_HOUR_HEIGHT = 72;
const studioBlockTypes = ["Тех. блок", "Уборка", "Ремонт", "Контент", "Личное", "Закрыто", "Другое"];

const defaultServiceGroups = [
  { id: "recording", name: "Запись", order: 1 },
  { id: "mixing", name: "Сведение", order: 2 },
  { id: "education", name: "Обучение", order: 3 },
  { id: "consulting", name: "Консультации", order: 4 },
  { id: "production", name: "Продакшн", order: 5 },
  { id: "design", name: "Дизайн", order: 6 },
  { id: "rent", name: "Аренда", order: 7 },
  { id: "extra", name: "Дополнительные услуги", order: 8 }
];

const defaultServiceItems = [
  { id: "svc-recording-1", name: "Запись 1 час", categoryId: "recording", price: 1200, duration: "1 час", order: 1, mode: "fixed" },
  { id: "svc-recording-2", name: "Запись 2 часа", categoryId: "recording", price: 2400, duration: "2 часа", order: 2, mode: "fixed" },
  { id: "svc-recording-3", name: "Запись 3 часа", categoryId: "recording", price: 3300, duration: "3 часа", order: 3, mode: "fixed" },
  { id: "svc-recording-5", name: "Запись 5 часов", categoryId: "recording", price: 5200, duration: "5 часов", order: 4, mode: "fixed" },
  { id: "svc-mixing", name: "Сведение", categoryId: "mixing", price: 2500, duration: "1 день", order: 1, mode: "fixed" },
  { id: "svc-vocal", name: "Коррекция вокала", categoryId: "mixing", price: 2000, duration: "1 день", order: 2, mode: "fixed" },
  { id: "svc-multitrack", name: "Мультитрек", categoryId: "mixing", price: 5000, duration: "1 день", order: 3, mode: "minimum" },
  { id: "svc-ableton", name: "Ableton", categoryId: "education", price: 3000, duration: "2 часа", order: 1, mode: "fixed" },
  { id: "svc-fl", name: "FL Studio", categoryId: "education", price: 3000, duration: "2 часа", order: 2, mode: "fixed" },
  { id: "svc-edu-mixing", name: "Сведение", categoryId: "education", price: 3500, duration: "2 часа", order: 3, mode: "fixed" },
  { id: "svc-beat", name: "Написание бита", categoryId: "production", price: 5000, duration: "2 часа", order: 1, mode: "minimum" },
  { id: "svc-ghost", name: "Ghostwriting", categoryId: "production", price: 3000, duration: "1 день", order: 2, mode: "minimum" },
  { id: "svc-artist-audit", name: "Анализ артиста", categoryId: "consulting", price: 3000, duration: "1 час", order: 1, mode: "fixed" },
  { id: "svc-track-audit", name: "Анализ трека", categoryId: "consulting", price: 1500, duration: "1 час", order: 2, mode: "fixed" },
  { id: "svc-cover", name: "Обложка", categoryId: "design", price: 3000, duration: "1 день", order: 1, mode: "fixed" },
  { id: "svc-poster", name: "Афиша", categoryId: "design", price: 2500, duration: "1 день", order: 2, mode: "fixed" },
  { id: "svc-rent-hour", name: "Почасовая", categoryId: "rent", price: 1000, duration: "1 час", order: 1, mode: "fixed" },
  { id: "svc-extra", name: "Любые дополнительные", categoryId: "extra", price: 0, duration: "1 час", order: 1, mode: "manual" }
];

const employeeRoles = ["Владелец", "Администратор", "Звукорежиссёр", "Исполнитель", "Дизайнер", "Продюсер", "Другое"];

const defaultState = {
  sessionUserId: null,
  users: [
    { id: "u1", name: "AE XL", login: "admin", password: "admin123", role: "admin", position: "Владелец", percent: 0, fixedRate: 0, color: "#ff6633", phone: "", telegram: "", active: true },
    { id: "u2", name: "Сотрудник", login: "staff", password: "staff123", role: "staff", position: "Звукорежиссёр", percent: 25, fixedRate: 0, color: "#7c8cff", phone: "", telegram: "", active: true }
  ],
  services: ["Запись", "Сведение", "Мастеринг", "Аренда студии"],
  serviceGroups: defaultServiceGroups,
  serviceItems: defaultServiceItems,
  clients: [],
  payments: [
    {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      client: "Иван Петров",
      service: "Запись",
      amount: 12000,
      method: "Наличные",
      comment: "Демо-запись",
      employee: "AE XL"
    },
    {
      id: crypto.randomUUID(),
      date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
      client: "Mira",
      service: "Сведение",
      amount: 18000,
      method: "Перевод",
      comment: "Сингл",
      employee: "Сотрудник"
    }
  ],
  bookings: [],
  studioBlocks: [],
  calendarSettings: {
    mode: "week",
    date: new Date().toISOString().slice(0, 10),
    employee: "",
    status: "",
    service: ""
  },
  payouts: [],
  expenses: [],
  payoutResetVersion: PAYOUT_RESET_VERSION
};

const bookingStatuses = ["заявка", "подтверждено", "в процессе", "завершено", "отменено"];

const budgetWallets = ["общак", "AE XL", "AURA 13", "Даня", "Даня в кепке"];
const migrationServiceCatalog = [
  { name: "Запись утро 1 час", category: "recording", price: 1000, mode: "fixed" },
  { name: "Запись утро 3 часа", category: "recording", price: 2800, mode: "fixed" },
  { name: "Запись утро 5 часов", category: "recording", price: 4400, mode: "fixed" },
  { name: "Запись утро доп. час", category: "recording", price: 1000, mode: "fixed" },
  { name: "Запись 1 час", category: "recording", price: 1200, mode: "fixed" },
  { name: "Запись 3 часа", category: "recording", price: 3300, mode: "fixed" },
  { name: "Запись 5 часов", category: "recording", price: 5200, mode: "fixed" },
  { name: "Запись доп. час", category: "recording", price: 1200, mode: "fixed" },
  { name: "Запись + сведение 1 час", category: "recording", price: 1800, mode: "fixed" },
  { name: "Запись + сведение 2 часа", category: "recording", price: 3600, mode: "fixed" },
  { name: "Запись + сведение 3 часа", category: "recording", price: 4800, mode: "fixed" },
  { name: "Запись + сведение 4 часа", category: "recording", price: 6000, mode: "fixed" },
  { name: "Запись + сведение 5 часов", category: "recording", price: 7200, mode: "fixed" },
  { name: "Запись + сведение 6 часов", category: "recording", price: 8400, mode: "fixed" },
  { name: "Аренда 1 час", category: "rent", price: 1000, mode: "fixed" },
  { name: "Аренда 3 часа", category: "rent", price: 2800, mode: "fixed" },
  { name: "Аренда 5 часов", category: "rent", price: 4400, mode: "fixed" },
  { name: "Аренда 8 часов", category: "rent", price: 6500, mode: "fixed" },
  { name: "Аренда 12 часов день", category: "rent", price: 9000, mode: "fixed" },
  { name: "Аренда 12 часов ночь", category: "rent", price: 7500, mode: "fixed" },
  { name: "Сведение онлайн", category: "online", price: 2500, mode: "fixed" },
  { name: "Сведение + мастер онлайн", category: "online", price: 3000, mode: "fixed" },
  { name: "Сведение все допы онлайн", category: "online", price: 5000, mode: "fixed" },
  { name: "Мастеринг онлайн", category: "online", price: 1000, mode: "fixed" },
  { name: "Битмейкинг онлайн", category: "online", price: 4000, mode: "minimum" },
  { name: "Гострайтинг онлайн", category: "online", price: 3000, mode: "minimum" },
  { name: "Анализ 1 трека", category: "online", price: 1500, mode: "fixed" },
  { name: "Разбор артиста", category: "online", price: 3000, mode: "fixed" },
  { name: "План развития 3 мес", category: "online", price: 8000, mode: "minimum" },
  { name: "Полноценная стратегия релиза", category: "online", price: 5000, mode: "fixed" },
  { name: "Сведение на студии 2 часа", category: "studioProduction", price: 4000, mode: "minimum" },
  { name: "Битмейкинг на студии 1 час", category: "studioProduction", price: 5000, mode: "minimum" },
  { name: "Сведение + мастер на студии", category: "studioProduction", price: 3000, mode: "fixed" },
  { name: "Сведение все допы на студии", category: "studioProduction", price: 5000, mode: "fixed" }
];
const migrationServiceNames = migrationServiceCatalog.map((service) => service.name);
const serviceAliases = {
  "Сведение на студии 1 час": "Сведение на студии 2 часа"
};
const legacyCatalogServices = [
  "Запись 1 час 9:00-14:00",
  "Запись 3 часа 9:00-14:00",
  "Запись 5 часов 9:00-14:00",
  "Запись доп. час 9:00-14:00",
  "Запись 1 час 14:00-9:00",
  "Запись 3 часа 14:00-9:00",
  "Запись 5 часов 14:00-9:00",
  "Запись доп. час 14:00-9:00",
  ...Object.keys(serviceAliases)
];
const serviceCategories = [
  { key: "recording", label: "Запись" },
  { key: "rent", label: "Аренда" },
  { key: "online", label: "Онлайн" },
  { key: "studioProduction", label: "На студии" },
  { key: "custom", label: "Другое" }
];

const budgetRules = {
  recording: {
    title: "Запись",
    note: "1200 р./час, звукореж 300 р./час",
    base: 1200,
    baseHourly: 1200,
    soundRate: 300,
    wallets: { "общак": 500 / 1200, "AE XL": 100 / 1200, "AURA 13": 100 / 1200, "Даня": 100 / 1200, "Даня в кепке": 100 / 1200 },
    outside: { "Звукореж": 300 / 1200 }
  },
  rent: {
    title: "Аренда",
    note: "1000 р./час",
    base: 1000,
    wallets: { "общак": 0.6, "AE XL": 0.1, "AURA 13": 0.1, "Даня": 0.1, "Даня в кепке": 0.1 },
    outside: {}
  },
  online: {
    title: "Услуги онлайн",
    note: "исполнитель получает 40%",
    base: 5000,
    wallets: { "общак": 0.4, "AE XL": 0.05, "AURA 13": 0.05, "Даня": 0.05, "Даня в кепке": 0.05 },
    outside: { "Исполнитель": 0.4 }
  },
  studioProduction: {
    title: "Сведение/бит на студии",
    note: "4000 р. за 2 часа, звукореж 600 р./час",
    base: 4000,
    baseHourly: 2000,
    soundRate: 600,
    wallets: { "общак": 0.5, "AE XL": 0.05, "AURA 13": 0.05, "Даня": 0.05, "Даня в кепке": 0.05 },
    outside: { "Звукореж": 0.3 }
  },
  unknown: {
    title: "Другая услуга",
    note: "вся сумма уходит в общак, пока нет правила",
    base: 0,
    wallets: { "общак": 1, "AE XL": 0, "AURA 13": 0, "Даня": 0, "Даня в кепке": 0 },
    outside: {}
  }
};

let state = loadState();
state = normalizeState(state);
let view = "dashboard";
let editingPaymentId = null;
let editingBookingId = null;
let bookingModalOpen = false;
let bookingSlotDraft = null;
let selectedBookingId = null;
let studioBlockModalOpen = false;
let editingStudioBlockId = null;
let studioBlockDraft = null;
let selectedStudioBlockId = null;
let calendarMode = state.calendarSettings?.mode === "day" ? "day" : "week";
let calendarDate = state.calendarSettings?.date || new Date().toISOString().slice(0, 10);
let calendarWeekStart = weekStart(calendarDate);
let calendarEmployeeFilter = state.calendarSettings?.employee || "";
let calendarStatusFilter = state.calendarSettings?.status || "";
let calendarServiceFilter = state.calendarSettings?.service || "";
let clientFilter = "";
let bookingDateFilter = "";
let bookingStatusFilter = "";
let bookingServiceFilter = "";
let bookingEmployeeFilter = "";
let bookingSearchFilter = "";
let selectedClientName = null;
let clientSortMode = "last";
let payoutModalOpen = false;
let payoutEmployeeIdDraft = "";
let payoutEmployeeFilter = "";
let payoutStatusFilter = "";
let payoutPeriodFilter = "all";
let payoutProblemsOnly = false;
let highlightedPayoutId = "";
let settingsTab = "services";
let notificationPanelOpen = false;
let globalSearchQuery = "";
let commandPaletteOpen = false;
let commandPaletteQuery = "";

const app = document.querySelector("#app");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function servicePriceRuleFromStatic(serviceName) {
  const catalogItem = migrationServiceCatalog.find((item) => item.name === serviceName);
  if (!catalogItem) return { mode: "manual", price: 0, min: 0 };
  return { mode: catalogItem.mode, price: catalogItem.price, min: catalogItem.price };
}

function durationFromServiceName(serviceName) {
  const match = String(serviceName || "").match(/(\d+)\s*час/);
  if (!match) return "1 час";
  const hours = Number(match[1]);
  if (hours === 1) return "1 час";
  if ([2, 3, 4].includes(hours)) return `${hours} часа`;
  return `${hours} часов`;
}

function normalizeState(nextState) {
  const legacyServices = new Set(["Запись", "Сведение", "Мастеринг", "Аренда студии", "Аренда", "Услуги онлайн", "Сведение на студии", "Бит на студии", "Написание бита на студии"]);
  legacyCatalogServices.forEach((service) => legacyServices.add(service));
  const customServices = (nextState.services || []).filter((service) => !legacyServices.has(service) && !migrationServiceNames.includes(service));
  const serviceGroups = [...(nextState.serviceGroups || defaultServiceGroups)].map((group, index) => ({
    id: group.id || crypto.randomUUID(),
    name: group.name || group.label || "Категория",
    order: Number(group.order || index + 1)
  }));
  const groupIds = new Set(serviceGroups.map((group) => group.id));
  const serviceItems = [...(nextState.serviceItems || defaultServiceItems)].map((service, index) => ({
    id: service.id || crypto.randomUUID(),
    name: service.name || String(service || "Услуга"),
    categoryId: groupIds.has(service.categoryId) ? service.categoryId : service.category || "extra",
    price: Number(service.price || service.amount || 0),
    duration: service.duration || "1 час",
    order: Number(service.order || index + 1),
    mode: service.mode || "fixed",
    active: service.active !== false
  }));
  [...migrationServiceNames, ...customServices].forEach((name) => {
    if (!serviceItems.some((service) => service.name === name)) {
      const categoryId = classifyService(name);
      serviceItems.push({
        id: crypto.randomUUID(),
        name,
        categoryId: groupIds.has(categoryId) ? categoryId : "extra",
        price: servicePriceRuleFromStatic(name).price || 0,
        duration: durationFromServiceName(name),
        order: serviceItems.length + 1,
        mode: servicePriceRuleFromStatic(name).mode || "manual",
        active: true
      });
    }
  });
  const services = serviceItems.map((service) => service.name);
  const users = (nextState.users || defaultState.users).map((user, index) => ({
    id: user.id || crypto.randomUUID(),
    name: user.name === "Я" ? "AE XL" : user.name || `Сотрудник ${index + 1}`,
    login: user.login || `staff${index + 1}`,
    password: user.password || "1234",
    role: user.role || "staff",
    position: (user.name === "Я" || user.name === "AE XL") ? "Владелец" : user.position || (user.role === "admin" ? "Администратор" : "Звукорежиссёр"),
    percent: Number(user.percent || 0),
    fixedRate: Number(user.fixedRate || 0),
    color: user.color || (index === 0 ? "#ff6633" : "#7c8cff"),
    phone: user.phone || "",
    telegram: user.telegram || "",
    active: user.active !== false
  }));
  const payments = (nextState.payments || []).map((payment) => {
    const service = serviceAliases[payment.service] || payment.service;
    const category = classifyService(service);
    const employeeName = payment.employee === "Я" ? "AE XL" : payment.employee || "";
    const soundEngineer = payment.soundEngineer || (["recording", "studioProduction"].includes(category) ? employeeName : "") || "";
    const performer = payment.performer || (category === "online" ? employeeName : "") || "";
    return {
      ...payment,
      service,
      amount: numberOrZero(payment.amount),
      soundEngineer,
      performer,
      employee: employeeName || soundEngineer || performer || ""
    };
  });
  const bookings = (nextState.bookings || []).map((booking) => {
    const serviceName = serviceAliases[booking.serviceName || booking.service] || booking.serviceName || booking.service || services[0] || "";
    const serviceItem = serviceItems.find((service) => service.id === booking.serviceId) || serviceItems.find((service) => service.name === serviceName);
    const employeeName = booking.employeeName || (booking.employee === "Я" ? "AE XL" : booking.employee) || "";
    const employee = users.find((user) => user.id === booking.employeeId) || users.find((user) => user.name === employeeName);
    const status = bookingStatuses.includes(booking.status) ? booking.status : "заявка";
    const createdAt = booking.createdAt || new Date().toISOString();
    return {
      ...booking,
      id: booking.id || crypto.randomUUID(),
      date: booking.date || new Date().toISOString().slice(0, 10),
      time: booking.time || "12:00",
      duration: booking.duration || serviceItem?.duration || "1 час",
      clientName: booking.clientName || booking.client || "",
      client: booking.clientName || booking.client || "",
      phone: booking.phone || "",
      telegram: booking.telegram || "",
      serviceCategoryId: booking.serviceCategoryId || serviceItem?.categoryId || serviceGroups[0]?.id || "",
      serviceId: booking.serviceId || serviceItem?.id || "",
      serviceName,
      service: serviceName,
      amount: numberOrZero(booking.amount || booking.cost || serviceItem?.price),
      employeeId: booking.employeeId || employee?.id || "",
      employeeName: employee?.name || employeeName || "",
      employee: employee?.name || employeeName || "",
      comment: booking.comment || "",
      status,
      paymentCreated: Boolean(booking.paymentCreated || booking.paymentId),
      paymentId: booking.paymentId || "",
      createdAt,
      updatedAt: booking.updatedAt || createdAt,
      statusHistory: booking.statusHistory || [{ status, at: createdAt, user: "Система", note: "создана запись" }]
    };
  });
  const expenses = (nextState.expenses || []).map((expense) => ({
    id: expense.id || crypto.randomUUID(),
    date: expense.date || new Date().toISOString().slice(0, 10),
    title: expense.title || "Расход",
    amount: numberOrZero(expense.amount),
    comment: expense.comment || ""
  }));
  const clientMap = new Map((nextState.clients || []).map((client) => [client.id || client.name, client]));
  [...payments, ...bookings].forEach((item) => {
    const name = String(item.clientName || item.client || "").trim();
    if (!name) return;
    const previousEntry = [...clientMap.entries()].find(([, client]) =>
      (item.phone && client.phone === item.phone) ||
      (item.telegram && client.telegram === item.telegram) ||
      client.name === name
    );
    const previousKey = previousEntry?.[0];
    const previous = previousEntry?.[1] || {};
    const nextClient = {
      id: previous.id || crypto.randomUUID(),
      name,
      phone: item.phone || previous.phone || "",
      telegram: item.telegram || previous.telegram || "",
      comment: previous.comment || ""
    };
    if (previousKey) clientMap.delete(previousKey);
    clientMap.set(nextClient.id, nextClient);
  });
  const payouts = (nextState.payouts || []).map((payout) => {
    const employee = users.find((user) => user.id === payout.employeeId) || users.find((user) => user.name === (payout.employeeName || payout.recipient));
    return {
      ...payout,
      id: payout.id || crypto.randomUUID(),
      employeeId: payout.employeeId || employee?.id || "",
      employeeName: payout.employeeName || employee?.name || payout.recipient || "",
      recipient: payout.recipient || employee?.name || "",
      amount: numberOrZero(payout.amount),
      createdAt: payout.createdAt || payout.paidAt || new Date().toISOString()
    };
  });
  const studioBlocks = (nextState.studioBlocks || []).map((block) => {
    const createdAt = block.createdAt || new Date().toISOString();
    return {
      ...block,
      id: block.id || crypto.randomUUID(),
      date: block.date || localDateKey(),
      time: block.time || "12:00",
      duration: block.duration || "1 час",
      title: block.title || block.type || "Технический блок",
      type: studioBlockTypes.includes(block.type) ? block.type : "Другое",
      comment: block.comment || "",
      status: block.status === "cancelled" ? "cancelled" : "active",
      createdAt,
      updatedAt: block.updatedAt || createdAt
    };
  });
  return {
    ...nextState,
    users,
    serviceGroups,
    serviceItems,
    services: [...services],
    clients: [...clientMap.values()],
    payments,
    bookings,
    studioBlocks,
    calendarSettings: {
      mode: nextState.calendarSettings?.mode === "day" ? "day" : "week",
      date: nextState.calendarSettings?.date || new Date().toISOString().slice(0, 10),
      employee: nextState.calendarSettings?.employee || "",
      status: nextState.calendarSettings?.status || "",
      service: nextState.calendarSettings?.service || ""
    },
    payouts,
    expenses,
    payoutResetVersion: PAYOUT_RESET_VERSION
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

saveState();

function currentUser() {
  return state.users.find((user) => user.id === state.sessionUserId);
}

function isAdmin() {
  return currentUser()?.role === "admin";
}

function money(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
}

function serviceIcon(serviceName = "") {
  const category = serviceByName(serviceName)?.categoryId || classifyService(serviceName);
  return {
    recording: "●",
    mixing: "≋",
    education: "◌",
    consulting: "?",
    production: "◆",
    design: "▣",
    rent: "□",
    extra: "+"
  }[category] || "●";
}

function activeCatalogServices() {
  return catalogServices().filter((service) => service.active !== false);
}

function paymentForBooking(bookingId) {
  const booking = state.bookings.find((item) => item.id === bookingId);
  return state.payments.find((payment) => payment.bookingId === bookingId || (booking?.paymentId && payment.id === booking.paymentId));
}

function bookingForPayment(payment) {
  return state.bookings.find((booking) => booking.id === payment.bookingId);
}

function formatDate(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "дата не указана" : new Intl.DateTimeFormat("ru-RU").format(date);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function weekStart(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return localDateKey(date);
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekDays(startDate = calendarWeekStart) {
  return Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
}

function weekdayLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date);
  return `${weekday}, ${shortDate(dateString)}`;
}

function statusTitle(status) {
  return {
    "заявка": "Заявка",
    "подтверждено": "Подтверждено",
    "в процессе": "В процессе",
    "завершено": "Завершено",
    "отменено": "Отменено"
  }[status] || status || "Заявка";
}

function periodKey(date, mode) {
  const d = new Date(`${date}T00:00:00`);
  if (mode === "day") return date;
  if (mode === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const start = new Date(d);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return `Неделя с ${formatDate(start.toISOString().slice(0, 10))}`;
}

function groupSum(items, keyGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item);
    acc[key] = (acc[key] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
}

function sortedEntries(group) {
  return Object.entries(group).sort((a, b) => b[1] - a[1]);
}

function knownClients() {
  const clients = [];
  const upsertKnownClient = (item = {}) => {
    const name = String(item.name || item.clientName || item.client || "").trim();
    if (!name) return null;
    const phone = String(item.phone || "").trim();
    const telegram = String(item.telegram || "").trim();
    const normalizedName = name.toLowerCase();
    const existing = clients.find((client) =>
      (phone && client.phone === phone) ||
      (telegram && client.telegram === telegram) ||
      client.name.toLowerCase() === normalizedName
    );
    if (!existing) {
      const client = { name, phone, telegram, total: 0, visits: 0, lastDate: "", last: null };
      clients.push(client);
      return client;
    }
    existing.name = name || existing.name;
    existing.phone = phone || existing.phone;
    existing.telegram = telegram || existing.telegram;
    return existing;
  };

  state.clients.forEach(upsertKnownClient);
  state.bookings.forEach((booking) => {
    const client = upsertKnownClient(booking);
    if (!client) return;
    if (booking.status === "завершено") {
      client.visits += 1;
      const hasLinkedPayment = state.payments.some((payment) =>
        payment.bookingId === booking.id || (booking.paymentId && payment.id === booking.paymentId)
      );
      if (!hasLinkedPayment) client.total += Number(booking.amount || 0);
    }
    if (!client.lastDate || String(booking.date || "").localeCompare(client.lastDate) > 0) {
      client.lastDate = booking.date || "";
      client.last = booking;
    }
  });
  state.payments.forEach((payment) => {
    const client = upsertKnownClient(payment);
    if (!client) return;
    client.total += Number(payment.amount || 0);
    if (!payment.bookingId) client.visits += 1;
    if (!client.lastDate || String(payment.date || "").localeCompare(client.lastDate) > 0) {
      client.lastDate = payment.date || "";
      client.last = payment;
    }
  });

  return clients.sort((a, b) => String(b.lastDate || "").localeCompare(String(a.lastDate || "")) || a.name.localeCompare(b.name));
}

function clientSuggestions(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return knownClients().slice(0, 5);
  return knownClients()
    .filter((client) => [client.name, client.phone, client.telegram].some((value) => String(value || "").toLowerCase().includes(normalized)))
    .slice(0, 6);
}

function render() {
  if (!currentUser()) {
    renderLogin();
    return;
  }

  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <section class="content">
        ${renderTopbar()}
        ${view === "calendar" ? renderCalendar() : ""}
        ${view === "dashboard" ? renderDashboard() : ""}
        ${view === "bookings" ? renderBookings() : ""}
        ${view === "finance" ? renderFinance() : ""}
        ${view === "payments" ? renderPayments() : ""}
        ${view === "payouts" ? renderPayouts() : ""}
        ${view === "clients" ? renderClients() : ""}
        ${view === "budget" ? renderBudget() : ""}
        ${view === "reports" ? renderReports() : ""}
        ${view === "settings" ? renderSettings() : ""}
      </section>
      ${renderMobileTabs()}
      ${bookingModalOpen ? renderBookingModal() : ""}
      ${studioBlockModalOpen ? renderStudioBlockModal() : ""}
      ${payoutModalOpen ? renderPayoutModal() : ""}
      ${commandPaletteOpen ? renderCommandPalette() : ""}
    </div>
  `;

  bindCommonEvents();
  bindViewEvents();
}

function renderLogin() {
  app.innerHTML = `
    <section class="login-screen">
      <form class="card login-card" id="loginForm">
        <div class="brand">
          <img class="brand-mark" src="krug-logo.png" alt="КРУГ" />
          <div>
            <strong>КРУГ CRM</strong>
            <span>внутренняя CRM студии</span>
          </div>
        </div>
        <span class="preview-badge">Preview</span>
        <h1>Вход</h1>
        <p class="muted">Внутреннее приложение KRUG CRM для сотрудников студии.</p>
        <div class="grid">
          <div class="field">
            <label>Логин</label>
            <input name="login" autocomplete="username" required value="admin" />
          </div>
          <div class="field">
            <label>Пароль</label>
            <input name="password" type="password" autocomplete="current-password" required value="admin123" />
          </div>
          <button class="btn" type="submit">Войти</button>
          <div class="hint">Админ: admin / admin123. Сотрудник: staff / staff123.</div>
        </div>
      </form>
    </section>
  `;

  document.querySelector("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const user = state.users.find((item) => item.login === data.login && item.password === data.password);
    if (!user) {
      alert("Неверный логин или пароль");
      return;
    }
    state.sessionUserId = user.id;
    saveState();
    render();
  });
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <img class="brand-mark" src="krug-logo.png" alt="КРУГ" />
        <div>
          <strong>КРУГ</strong>
          <span>CRM студии · Preview</span>
        </div>
      </div>
      <span class="preview-badge sidebar-preview">Preview</span>
      <nav class="nav">${navButtons()}</nav>
      <div class="user-card">
        <strong>${currentUser().name}</strong>
        <span>${isAdmin() ? "администратор" : "сотрудник"}</span>
        <button class="logout" data-action="logout">Выйти</button>
      </div>
    </aside>
  `;
}

function navButtons() {
  const items = [
    ["dashboard", "Сегодня"],
    ["calendar", "Календарь"],
    ["bookings", "Записи"],
    ["clients", "Клиенты"],
    ["finance", "Финансы"],
    ["payments", "Платежи"],
    ["payouts", "Выплаты"],
    ["budget", "Бюджет"],
    ["reports", "Отчёты"],
    ["settings", "Настройки"]
  ];
  return items
    .filter(([key]) => key !== "settings" || isAdmin())
    .map(([key, label]) => `<button class="${view === key ? "active" : ""}" data-view="${key}">${label}</button>`)
    .join("");
}

function renderMobileTabs() {
  return `<nav class="mobile-tabs">${navButtons()}</nav>`;
}

function renderTopbar() {
  const notifications = studioNotifications();
  return `
    <header class="topbar">
      <div>
        <h1>${pageTitle()}</h1>
        <p class="muted">${pageSubtitle()}</p>
      </div>
      <div class="topbar-tools">
        <div class="global-search">
          <span>⌕</span>
          <input id="globalSearch" placeholder="Поиск" value="${globalSearchQuery}" autocomplete="off" />
          <div class="global-search-results ${globalSearchQuery ? "open" : ""}" id="globalSearchResults">${globalSearchQuery ? renderGlobalSearchResults(globalSearchQuery) : ""}</div>
        </div>
        <button class="topbar-icon ${notificationPanelOpen ? "active" : ""}" type="button" title="Уведомления" data-action="toggleNotifications">
          🔔
          ${notifications.length ? `<em>${notifications.length}</em>` : ""}
        </button>
        <button class="topbar-profile" type="button" data-action="openCommandPalette" title="Ctrl + K">
          <span>${initials(currentUser().name)}</span>
          <strong>${currentUser().name}</strong>
        </button>
        ${notificationPanelOpen ? `<div class="notification-popover">${renderNotifications(notifications)}</div>` : ""}
      </div>
    </header>
  `;
}

function pageTitle() {
  return {
    dashboard: "Сегодня",
    calendar: "Календарь",
    bookings: "Записи",
    payments: "Платежи",
    finance: "Финансы",
    payouts: "Выплаты",
    clients: "Клиенты",
    budget: "Бюджет",
    reports: "Отчёты",
    settings: "Настройки"
  }[view];
}

function pageSubtitle() {
  return {
    dashboard: "Оперативный центр студии на сегодня.",
    calendar: "Недельное расписание студии и статусы записей.",
    bookings: "Заявки, расписание и статусы студийных записей.",
    payments: "Добавление, поиск и редактирование оплат.",
    finance: "Обзор доходов, расходов, прибыли, выплат и бюджета.",
    payouts: "Плановые и выполненные выплаты.",
    clients: "База клиентов, история оплат и посещений.",
    budget: "Пять копилок студии и распределение дохода по правилам.",
    reports: "Разбивка по дням, неделям, месяцам, клиентам и сотрудникам.",
    settings: "Услуги, сотрудники и доступы."
  }[view];
}

function classifyService(service) {
  const catalogItem = (state?.serviceItems || defaultServiceItems).find((item) => item.name === service) || migrationServiceCatalog.find((item) => item.name === service);
  if (catalogItem?.categoryId) return budgetCategoryForServiceGroup(catalogItem.categoryId);
  if (catalogItem?.category) return catalogItem.category;
  const value = String(service || "").toLowerCase();
  if (value.includes("аренд")) return "rent";
  if (value.includes("онлайн") || value.includes("online")) return "online";
  if (value.includes("бит") || value.includes("сведен")) return "studioProduction";
  if (value.includes("запис")) return "recording";
  return "unknown";
}

function budgetCategoryForServiceGroup(categoryId) {
  if (categoryId === "recording") return "recording";
  if (categoryId === "rent") return "rent";
  if (["mixing", "production"].includes(categoryId)) return "studioProduction";
  if (["education", "consulting", "design"].includes(categoryId)) return "online";
  return "unknown";
}

function paymentCategory(payment) {
  const category = classifyService(payment.service);
  return category === "unknown" ? "custom" : category;
}

function categoryLabel(category) {
  return serviceCategories.find((item) => item.key === category)?.label || "Другое";
}

function servicesForCategory(category) {
  return catalogServices().filter((service) => service.categoryId === category && service.active !== false).map((service) => service.name);
}

function firstServiceForCategory(category) {
  return servicesForCategory(category)[0] || catalogServices()[0]?.name || "";
}

function serviceHours(payment, rule) {
  const service = String(payment.service || "").toLowerCase();
  const explicitHours = service.match(/(\d+)\s*час/);
  const minHours = service.includes("сведение на студии") ? 2 : 1;
  if (explicitHours) return Math.max(minHours, Number(explicitHours[1]));
  if (service.includes("доп") && service.includes("час")) return minHours;
  if (rule.baseHourly) return Math.max(minHours, Math.round(Number(payment.amount || 0) / rule.baseHourly));
  return 1;
}

function outsideRecipient(payment, label) {
  if (label === "Звукореж") return payment.soundEngineer || payment.employee || "не указан";
  if (label === "Исполнитель") return payment.performer || payment.employee || "не указан";
  return payment.employee || "не указан";
}

function outsideLabel(payment, label) {
  return `${label}: ${outsideRecipient(payment, label)}`;
}

function splitWalletRemainder(amount, rule, outsideTotal) {
  const remainder = Math.max(0, amount - outsideTotal);
  const walletRatioTotal = budgetWallets.reduce((sum, wallet) => sum + (rule.wallets[wallet] || 0), 0) || 1;
  return Object.fromEntries(budgetWallets.map((wallet) => [wallet, remainder * ((rule.wallets[wallet] || 0) / walletRatioTotal)]));
}

function splitPayment(payment) {
  const ruleKey = classifyService(payment.service);
  const rule = budgetRules[ruleKey];
  const amount = Number(payment.amount || 0);
  let outside = Object.fromEntries(Object.entries(rule.outside).map(([label, ratio]) => [outsideLabel(payment, label), amount * ratio]));

  if (rule.soundRate) {
    outside = { [outsideLabel(payment, "Звукореж")]: serviceHours(payment, rule) * rule.soundRate };
  }

  const outsideTotal = Object.values(outside).reduce((sum, value) => sum + value, 0);
  const wallets = rule.soundRate
    ? splitWalletRemainder(amount, rule, outsideTotal)
    : Object.fromEntries(budgetWallets.map((wallet) => [wallet, amount * (rule.wallets[wallet] || 0)]));
  return { ruleKey, rule, wallets, outside, amount };
}

function calculateBudget() {
  return state.payments.reduce(
    (acc, payment) => {
      const split = splitPayment(payment);
      budgetWallets.forEach((wallet) => {
        acc.wallets[wallet] += split.wallets[wallet];
      });
      Object.entries(split.outside).forEach(([label, value]) => {
        acc.outside[label] = (acc.outside[label] || 0) + value;
      });
      acc.rows.push({ payment, split });
      acc.total += split.amount;
      return acc;
    },
    {
      total: 0,
      wallets: Object.fromEntries(budgetWallets.map((wallet) => [wallet, 0])),
      outside: {},
      rows: []
    }
  );
}

function payoutTotalsFromBudget(budget = calculateBudget()) {
  const owed = Object.values(budget.outside).reduce((sum, value) => sum + value, 0);
  const activePayouts = (state.payouts || []).filter((payout) => payout.status !== "Отменено");
  const paid = activePayouts
    .filter((payout) => payout.status === "Выплачено")
    .reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
  const planned = activePayouts
    .filter((payout) => payout.status === "Запланировано")
    .reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
  const reserved = paid + planned;
  return {
    owed,
    paid,
    planned,
    reserved,
    available: Math.max(0, owed - reserved)
  };
}

function employeePayoutStats(employeeId) {
  const employee = (state.users || []).find((user) => user.id === employeeId);
  const emptyStats = {
    employee: employee || null,
    completedBookings: [],
    completedBookingsCount: 0,
    totalEarned: 0,
    totalPaid: 0,
    totalPlanned: 0,
    availableToPay: 0,
    overpaid: 0,
    lastPayoutDate: "",
    lastPayoutAmount: 0
  };
  if (!employee) return emptyStats;
  const completedBookings = (state.bookings || []).filter((booking) =>
    booking.status === "завершено" && bookingEmployeeId(booking) === employee.id && numberOrZero(booking.amount) > 0
  );
  const employeePayouts = (state.payouts || []).filter((payout) =>
    payout.status !== "Отменено" && (payout.employeeId === employee.id || (!payout.employeeId && payout.recipient === employee.name))
  );
  const totalEarned = completedBookings.reduce((sum, booking) => sum + numberOrZero(booking.amount), 0);
  const totalPaid = employeePayouts
    .filter((payout) => !payout.status || payout.status === "Выплачено")
    .reduce((sum, payout) => sum + Math.max(0, numberOrZero(payout.amount)), 0);
  const totalPlanned = employeePayouts
    .filter((payout) => payout.status === "Запланировано")
    .reduce((sum, payout) => sum + Math.max(0, numberOrZero(payout.amount)), 0);
  const reserved = totalPaid + totalPlanned;
  const paidPayouts = employeePayouts
    .filter((payout) => !payout.status || payout.status === "Выплачено")
    .sort((a, b) => payoutDateValue(b).localeCompare(payoutDateValue(a)));
  const lastPayout = paidPayouts[0];
  return {
    employee,
    completedBookings,
    completedBookingsCount: completedBookings.length,
    totalEarned,
    totalPaid,
    totalPlanned,
    availableToPay: Math.max(0, totalEarned - reserved),
    overpaid: Math.max(0, reserved - totalEarned),
    lastPayoutDate: payoutDateValue(lastPayout),
    lastPayoutAmount: numberOrZero(lastPayout?.amount)
  };
}

function allEmployeePayoutStats() {
  return (state.users || []).map((employee) => employeePayoutStats(employee.id));
}

function totalEmployeePayoutAvailable() {
  return allEmployeePayoutStats().reduce((sum, stats) => sum + stats.availableToPay, 0);
}

function validateEmployeePayout(employeeId, amountValue) {
  const employee = (state.users || []).find((user) => user.id === employeeId);
  const stats = employeePayoutStats(employeeId);
  const amount = Number(amountValue || 0);
  if (!employee) return { ok: false, error: "Выбери сотрудника для выплаты.", employee, stats, amount };
  if (!amount || amount <= 0) return { ok: false, error: "Укажи сумму выплаты больше нуля.", employee, stats, amount };
  if (amount > stats.availableToPay) {
    return { ok: false, error: `Нельзя выплатить больше доступной суммы. Доступно: ${money(stats.availableToPay)}.`, employee, stats, amount };
  }
  return { ok: true, error: "", employee, stats, amount };
}

function payoutDateValue(payout) {
  return String(payout?.paidAt || payout?.createdAt || "");
}

function payoutDateKey(payout) {
  const value = payoutDateValue(payout).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : value;
}

function payoutOverLimitIds() {
  const result = new Set();
  allEmployeePayoutStats().forEach((stats) => {
    if (!stats.employee) return;
    let reserved = 0;
    (state.payouts || [])
      .filter((payout) => payout.status !== "Отменено" && payout.employeeId === stats.employee.id && numberOrZero(payout.amount) > 0)
      .sort((a, b) => payoutDateValue(a).localeCompare(payoutDateValue(b)))
      .forEach((payout) => {
        reserved += numberOrZero(payout.amount);
        if (reserved > stats.totalEarned) result.add(payout.id);
      });
  });
  return result;
}

function payoutDataProblems(payout) {
  const problems = [];
  if (!payout.employeeId) problems.push("нет employeeId");
  else if (!(state.users || []).some((employee) => employee.id === payout.employeeId)) problems.push("сотрудник не найден");
  if (numberOrZero(payout.amount) <= 0) problems.push("сумма не больше нуля");
  if (!payoutDateKey(payout)) problems.push("некорректная дата");
  if (payoutOverLimitIds().has(payout.id)) problems.push("превышена доступная сумма");
  return problems;
}

function payoutMatchesFilters(payout) {
  if (payoutEmployeeFilter && payout.employeeId !== payoutEmployeeFilter) return false;
  const status = payout.status || "Без статуса";
  if (payoutStatusFilter && status !== payoutStatusFilter) return false;
  if (payoutProblemsOnly && !payoutDataProblems(payout).length) return false;
  if (payoutPeriodFilter === "all") return true;
  const date = payoutDateKey(payout);
  if (!date) return false;
  const today = todayKey();
  if (payoutPeriodFilter === "today") return date === today;
  if (payoutPeriodFilter === "week") return date >= weekStart(today) && date <= addDays(weekStart(today), 6);
  if (payoutPeriodFilter === "month") return date.slice(0, 7) === today.slice(0, 7);
  return true;
}

function payoutSummary(statsList = allEmployeePayoutStats(), warnings = financialWarnings()) {
  return {
    totalEarned: statsList.reduce((sum, stats) => sum + stats.totalEarned, 0),
    totalPaid: statsList.reduce((sum, stats) => sum + stats.totalPaid, 0),
    totalPlanned: statsList.reduce((sum, stats) => sum + stats.totalPlanned, 0),
    availableToPay: statsList.reduce((sum, stats) => sum + stats.availableToPay, 0),
    overpaid: statsList.reduce((sum, stats) => sum + stats.overpaid, 0),
    payableEmployees: statsList.filter((stats) => stats.availableToPay > 0).length,
    warningsCount: warnings.length
  };
}

function financialWarnings() {
  const bookings = state.bookings || [];
  const payments = state.payments || [];
  const payouts = state.payouts || [];
  const employees = state.users || [];
  const warnings = [];
  const add = (warning) => warnings.push({ level: "warning", date: "", amount: null, action: "", targetId: "", employeeId: "", ...warning });

  bookings.filter((booking) => booking.status === "завершено").forEach((booking) => {
    const payment = payments.find((item) => item.bookingId === booking.id || (booking.paymentId && item.id === booking.paymentId));
    const bookingLabel = `${booking.clientName || booking.client || "Клиент не указан"} · ${booking.serviceName || booking.service || "услуга не указана"}`;
    if (!payment) add({ level: "critical", type: "Завершённая запись без платежа", description: bookingLabel, date: booking.date, amount: numberOrZero(booking.amount), action: "booking", targetId: booking.id, employeeId: bookingEmployeeId(booking) });
    if (!bookingEmployeeId(booking)) add({ level: "critical", type: "Запись завершена без сотрудника", description: bookingLabel, date: booking.date, amount: numberOrZero(booking.amount), action: "booking", targetId: booking.id });
    if (numberOrZero(booking.amount) <= 0) add({ level: "critical", type: "Запись завершена без суммы", description: bookingLabel, date: booking.date, amount: numberOrZero(booking.amount), action: "booking", targetId: booking.id, employeeId: bookingEmployeeId(booking) });
    if (payment && Math.abs(numberOrZero(payment.amount) - numberOrZero(booking.amount)) > 0.01) {
      add({ type: "Сумма платежа отличается от записи", description: bookingLabel, date: payment.date || booking.date, amount: numberOrZero(payment.amount), action: "payment", targetId: payment.id, employeeId: bookingEmployeeId(booking) });
    }
  });

  payments.forEach((payment) => {
    const linkedBookingMissing = payment.bookingId && !bookings.some((booking) => booking.id === payment.bookingId);
    const deletedBookingMarker = !payment.bookingId && String(payment.comment || "").includes("Исходная запись удалена");
    if (linkedBookingMissing || deletedBookingMarker) {
      add({ type: "Платёж связан с удалённой записью", description: `${payment.client || "Клиент не указан"} · ${payment.service || "услуга не указана"}`, date: payment.date, amount: numberOrZero(payment.amount), action: "payment", targetId: payment.id });
    }
  });

  payouts.forEach((payout) => {
    if (!payout.employeeId) add({ type: "Выплата без сотрудника", description: payout.employeeName || payout.recipient || "Получатель не указан", date: payoutDateValue(payout), amount: numberOrZero(payout.amount), action: "payout", targetId: payout.id });
    if (numberOrZero(payout.amount) <= 0) add({ level: "critical", type: "Некорректная сумма выплаты", description: payout.employeeName || payout.recipient || "Получатель не указан", date: payoutDateValue(payout), amount: numberOrZero(payout.amount), action: "payout", targetId: payout.id, employeeId: payout.employeeId });
    if (!payoutDateKey(payout)) add({ level: "info", type: "У выплаты некорректная дата", description: payout.employeeName || payout.recipient || "Получатель не указан", amount: numberOrZero(payout.amount), action: "payout", targetId: payout.id, employeeId: payout.employeeId });
  });

  allEmployeePayoutStats().forEach((stats) => {
    if (!stats.employee || stats.overpaid <= 0) return;
    add({ level: "critical", type: "У сотрудника переплата", description: stats.employee.name, date: stats.lastPayoutDate, amount: stats.overpaid, action: "employee", targetId: stats.employee.id, employeeId: stats.employee.id });
    const activePayouts = payouts
      .filter((payout) => payout.status !== "Отменено" && payout.employeeId === stats.employee.id && numberOrZero(payout.amount) > 0)
      .sort((a, b) => payoutDateValue(a).localeCompare(payoutDateValue(b)));
    let reserved = 0;
    activePayouts.forEach((payout) => {
      const before = reserved;
      reserved += numberOrZero(payout.amount);
      if (before <= stats.totalEarned && reserved > stats.totalEarned) {
        add({ level: "critical", type: "Выплата превышает доступную сумму", description: stats.employee.name, date: payoutDateValue(payout), amount: numberOrZero(payout.amount), action: "payout", targetId: payout.id, employeeId: stats.employee.id });
      }
    });
  });

  payouts.filter((payout) => payout.employeeId && !employees.some((employee) => employee.id === payout.employeeId)).forEach((payout) => {
    add({ level: "critical", type: "Сотрудник выплаты не найден", description: payout.employeeName || payout.recipient || payout.employeeId, date: payoutDateValue(payout), amount: numberOrZero(payout.amount), action: "payout", targetId: payout.id, employeeId: payout.employeeId });
  });

  return warnings.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function availableOutsideBudget() {
  return payoutTotalsFromBudget().available;
}

function servicePriceRule(serviceName) {
  const stateCatalogItem = serviceByName(serviceName);
  if (stateCatalogItem) {
    const min = stateCatalogItem.mode === "manual" ? 0 : Number(stateCatalogItem.price || 0);
    return {
      mode: stateCatalogItem.mode || "fixed",
      price: Number(stateCatalogItem.price || 0),
      min,
      hint: stateCatalogItem.mode === "manual" ? "Цена задаётся вручную." : `Цена по каталогу: ${money(stateCatalogItem.price)} · ${stateCatalogItem.duration}`
    };
  }

  const catalogItem = migrationServiceCatalog.find((item) => item.name === serviceName);
  if (!catalogItem) {
    return {
      mode: "manual",
      price: 0,
      min: 0,
      hint: "Цена задаётся вручную, потому что для этой услуги нет правила в прайсе."
    };
  }

  if (catalogItem.mode === "fixed") {
    return {
      mode: "fixed",
      price: catalogItem.price,
      min: catalogItem.price,
      hint: `Фиксированная цена: ${money(catalogItem.price)}`
    };
  }

  return {
    mode: "minimum",
    price: catalogItem.price,
    min: catalogItem.price,
    hint: `Можно указать больше, минимум: ${money(catalogItem.price)}`
  };
}

function applyServicePrice(serviceName) {
  const priceRule = servicePriceRule(serviceName);
  const amountInput = document.querySelector("#amountInput");
  const priceHint = document.querySelector("#priceHint");
  const durationInput = document.querySelector("#bookingInlineDurationInput");
  const service = serviceByName(serviceName);
  if (!amountInput) return;

  amountInput.min = String(priceRule.min);
  if (priceHint) priceHint.textContent = priceRule.hint;
  if (service) applyBookingServiceFields(service);
  if (durationInput && !service) durationInput.readOnly = false;
}

function applyServiceCategory(category) {
  const serviceSelect = document.querySelector("#serviceSelect");
  if (!serviceSelect) return;

  const services = catalogServices().filter((service) => service.categoryId === category && service.active !== false);
  serviceSelect.innerHTML = services.map((service) => `<option value="${service.id}">${service.name}</option>`).join("");
  serviceSelect.value = services[0]?.id || "";
  applyServicePrice(services[0]?.name || "");
}

function renderClientSuggestions(query = "") {
  const box = document.querySelector("#clientSuggestions");
  const input = document.querySelector("#clientInput");
  if (!box || !input) return;

  const suggestions = clientSuggestions(query);
  box.innerHTML = "";
  box.classList.toggle("open", suggestions.length > 0);

  suggestions.forEach((client) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "client-suggestion";
    button.innerHTML = `
      <span><strong></strong><small></small></span>
      <em></em>
    `;
    button.querySelector("strong").textContent = client.name;
    button.querySelector("small").textContent = `Последний визит: ${client.lastDate ? formatDate(client.lastDate) : "пока нет"} · ${client.visits} посещ.`;
    button.querySelector("em").textContent = money(client.total);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      input.value = client.name;
      box.classList.remove("open");
    });
    box.appendChild(button);
  });
}

function updatePayoutEmployeeSummary(fillAmount = true) {
  const employeeId = document.querySelector("#payoutEmployee")?.value;
  const amount = document.querySelector("#payoutAmount");
  const hint = document.querySelector("#payoutAvailableHint");
  if (!employeeId || !amount) return;
  const stats = employeePayoutStats(employeeId);
  amount.max = String(stats.availableToPay);
  if (fillAmount || Number(amount.value || 0) > stats.availableToPay) amount.value = stats.availableToPay || "";
  if (hint) hint.textContent = stats.availableToPay > 0 ? `Доступно к выплате: ${money(stats.availableToPay)}` : "Сейчас выплачивать нечего.";
  const earned = document.querySelector("#payoutEarnedValue");
  const paid = document.querySelector("#payoutPaidValue");
  const planned = document.querySelector("#payoutPlannedValue");
  const available = document.querySelector("#payoutAvailableValue");
  const overpaid = document.querySelector("#payoutOverpaidValue");
  const last = document.querySelector("#payoutLastValue");
  const overpaidHint = document.querySelector("#payoutOverpaidHint");
  if (earned) earned.textContent = money(stats.totalEarned);
  if (paid) paid.textContent = money(stats.totalPaid);
  if (planned) planned.textContent = money(stats.totalPlanned);
  if (available) available.textContent = money(stats.availableToPay);
  if (overpaid) overpaid.textContent = money(stats.overpaid);
  if (last) last.textContent = stats.lastPayoutDate ? `${formatDate(stats.lastPayoutDate.slice(0, 10))} · ${money(stats.lastPayoutAmount)}` : "не было";
  if (overpaidHint) {
    overpaidHint.hidden = stats.overpaid <= 0;
    overpaidHint.textContent = `Есть переплата: ${money(stats.overpaid)}. Новая выплата недоступна.`;
  }
  updatePayoutAmountFeedback();
}

function updatePayoutAmountFeedback() {
  const employeeId = document.querySelector("#payoutEmployee")?.value || "";
  const amountInput = document.querySelector("#payoutAmount");
  const hint = document.querySelector("#payoutAvailableHint");
  if (!amountInput || !hint) return;
  const stats = employeePayoutStats(employeeId);
  const amount = Number(amountInput.value || 0);
  let error = "";
  if (!employeeId) error = "Выбери сотрудника для выплаты.";
  else if (amount <= 0) error = "Укажи сумму выплаты больше нуля.";
  else if (amount > stats.availableToPay) error = `Нельзя выплатить больше доступной суммы. Доступно: ${money(stats.availableToPay)}.`;
  amountInput.setCustomValidity(error);
  hint.textContent = error || `Доступно к выплате: ${money(stats.availableToPay)}`;
  hint.classList.toggle("field-error", Boolean(error));
}

function previousMonthKey(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function lastDays(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function shortDate(dateString) {
  const [, month, day] = dateString.split("-");
  return `${day}.${month}`;
}

function renderMetricCard(title, value, caption, delta, deltaCaption, isMoney = true) {
  const trendClass = delta >= 0 ? "up" : "down";
  const trendValue = delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${delta}${isMoney ? "%" : ""}`;
  return `
    <article class="card stat metric-card">
      <span>${title}</span>
      <strong>${isMoney ? money(value) : value}</strong>
      <div class="metric-foot">
        <small>${caption}</small>
        <em class="${trendClass}">${trendValue}<small>${deltaCaption}</small></em>
      </div>
    </article>
  `;
}

function renderColumnChart(entries) {
  const max = Math.max(...entries.map(([, total]) => total), 1);
  return `
    <div class="column-chart">
      <div class="chart-scale">
        <span>${money(max)}</span>
        <span>${money(Math.round(max / 2))}</span>
        <span>0 ₽</span>
      </div>
      <div class="chart-bars">
        ${entries
          .map(
            ([date, total]) => `
              <div class="column-item">
                <div class="column-track"><div class="column-fill" style="height:${Math.max(4, (total / max) * 100)}%"></div></div>
                <span>${shortDate(date)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderDonutChart(entries) {
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return renderEmptyState("Данных пока нет", "Когда появятся платежи, здесь будет диаграмма.");
  let offset = 0;
  const colors = ["#ff6633", "#d94c1c", "#9d725c", "#777", "#b8b8b8"];
  const stops = entries
    .map(([, value], index) => {
      const start = offset;
      const end = offset + (value / total) * 100;
      offset = end;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return `
    <div class="donut-wrap">
      <div class="donut" style="background: conic-gradient(${stops})">
        <div><strong>${money(total)}</strong><span>за период</span></div>
      </div>
      <div class="donut-legend">
        ${entries
          .map(
            ([label, value], index) => `
              <div><i style="background:${colors[index % colors.length]}"></i><span>${label}</span><strong>${money(value)}</strong></div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderRecentPayments(payments) {
  return `
    <div class="compact-list">
      ${payments
        .map(
          (payment) => `
            <div class="compact-row">
              <span>${formatDate(payment.date)}</span>
              <strong>${payment.client}</strong>
              <em>+ ${money(payment.amount)}</em>
            </div>
          `
        )
        .join("") || renderEmptyState("Платежей пока нет", "Завершённые записи и ручные доходы появятся здесь.")}
    </div>
  `;
}

function renderRankedList(entries) {
  return `
    <div class="rank-list">
      ${entries
        .map(
          ([label, total], index) => `
            <div class="rank-row">
              <span>${index + 1}</span>
              <strong>${label}</strong>
              <em>${money(total)}</em>
            </div>
          `
        )
        .join("") || renderEmptyState("Данных пока нет", "Здесь появится рейтинг после первых оплат.")}
    </div>
  `;
}

function renderEmptyState(title, text, actionLabel = "", actionAttrs = "") {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">○</span>
      <h3>${title}</h3>
      <p>${text}</p>
      ${actionLabel ? `<button class="btn secondary" ${actionAttrs}>${actionLabel}</button>` : ""}
    </div>
  `;
}

function todayKey() {
  return localDateKey();
}

function weekdayLong(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("ru-RU", { weekday: "long" });
}

function currentClock() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function parseDurationHours(duration = "") {
  const match = String(duration).match(/(\d+)/);
  return Math.max(1, Number(match?.[1] || 1));
}

function minutesUntil(dateString, timeString) {
  const start = new Date(`${dateString}T${timeString || "00:00"}`);
  return Math.round((start - new Date()) / 60000);
}

function untilLabel(booking) {
  const minutes = minutesUntil(booking.date, booking.time);
  if (minutes < -15) return "уже началась";
  if (minutes <= 0) return "сейчас";
  if (minutes < 60) return `через ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `через ${hours} ч ${rest} мин` : `через ${hours} ч`;
}

function todaysBookings() {
  const today = todayKey();
  return state.bookings.filter((booking) => booking.date === today).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
}

function nextTodayBooking(bookings = todaysBookings()) {
  const inProgress = bookings.find((booking) => booking.status === "в процессе");
  if (inProgress) return inProgress;
  const upcomingStatuses = ["заявка", "подтверждено"];
  return bookings.find((booking) => upcomingStatuses.includes(booking.status) && minutesUntil(booking.date, booking.time) >= -15) || null;
}

function formatMinutes(totalMinutes) {
  const safe = Math.max(0, Math.min(24 * 60, Number(totalMinutes || 0)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function eventTimeRange(event) {
  return `${formatMinutes(bookingStartMinutes(event))}–${formatMinutes(bookingEndMinutes(event))}`;
}

function studioBusyIntervals(date) {
  const dayStart = CALENDAR_START_HOUR * 60;
  const dayEnd = (CALENDAR_END_HOUR + 1) * 60;
  const events = [
    ...(state.bookings || []).filter((booking) => booking.date === date && isActiveBooking(booking)),
    ...(state.studioBlocks || []).filter((block) => block.date === date && isActiveStudioBlock(block))
  ];
  return events
    .filter(hasValidEventTime)
    .map((event) => ({ start: Math.max(dayStart, bookingStartMinutes(event)), end: Math.min(dayEnd, bookingEndMinutes(event)) }))
    .filter((slot) => slot.end > slot.start)
    .sort((a, b) => a.start - b.start);
}

function freeWindowRanges(date = todayKey()) {
  const busy = studioBusyIntervals(typeof date === "string" ? date : date?.[0]?.date || todayKey());
  const ranges = [];
  let cursor = CALENDAR_START_HOUR * 60;
  busy.forEach((slot) => {
    if (slot.start > cursor) ranges.push([cursor, slot.start]);
    cursor = Math.max(cursor, slot.end);
  });
  const dayEnd = (CALENDAR_END_HOUR + 1) * 60;
  if (cursor < dayEnd) ranges.push([cursor, dayEnd]);
  return ranges.filter(([start, end]) => end - start >= 30).slice(0, 8);
}

function studioNotifications() {
  const today = todayKey();
  const bookingsToday = todaysBookings();
  const notifications = [];
  const soon = bookingsToday.find((booking) => {
    const minutes = minutesUntil(booking.date, booking.time);
    return booking.status !== "отменено" && minutes > 0 && minutes <= 30;
  });
  if (soon) notifications.push({ icon: "⏱", title: `Через ${minutesUntil(soon.date, soon.time)} минут запись`, text: `${soon.client || "Без имени"} · ${soon.service}` });
  const pending = state.bookings.filter((booking) => booking.status === "заявка");
  if (pending.length) notifications.push({ icon: "!", title: `Осталось подтвердить ${pending.length} ${plural(pending.length, "запись", "записи", "записей")}`, text: "Открой раздел Записи или календарь." });
  const payoutAvailable = totalEmployeePayoutAvailable();
  if (payoutAvailable > 0) notifications.push({ icon: "₽", title: "Нужно выплатить сотруднику", text: `Доступно к выплате: ${money(payoutAvailable)}` });
  const birthdayClient = state.clients.find((client) => client.birthday === today || client.birthDate === today);
  if (birthdayClient) notifications.push({ icon: "○", title: "Сегодня день рождения клиента", text: birthdayClient.name });
  return notifications;
}

function plural(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return few;
  return many;
}

function searchItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const items = [];
  state.clients.forEach((client) => {
    items.push({ type: "client", id: client.name, icon: "К", title: client.name, text: [client.phone, client.telegram].filter(Boolean).join(" · ") || "клиент" });
  });
  state.bookings.forEach((booking) => {
    items.push({ type: "booking", id: booking.id, icon: serviceIcon(booking.service), title: `${booking.client || "Без имени"} · ${booking.time || ""}`, text: [formatDate(booking.date), booking.service, booking.employee, booking.phone, booking.telegram, statusTitle(booking.status)].filter(Boolean).join(" · ") });
  });
  catalogServices().forEach((service) => {
    const group = catalogGroups().find((item) => item.id === service.categoryId);
    items.push({ type: "service", id: service.id, icon: serviceIcon(service.name), title: service.name, text: `${group?.name || "Услуга"} · ${money(service.price)} · ${service.duration}` });
  });
  state.users.forEach((user) => {
    items.push({ type: "employee", id: user.id, icon: initials(user.name), title: user.name, text: `${user.position || "Сотрудник"} · ${user.telegram || user.phone || "контакты не указаны"}` });
  });
  return items
    .filter((item) => [item.title, item.text].some((value) => String(value || "").toLowerCase().includes(q)))
    .slice(0, 8);
}

function commandItems(query = "") {
  const commands = [
    { type: "action", id: "new-booking", icon: "+", title: "Создать запись", text: "Ctrl + N" },
    { type: "view", id: "calendar", icon: "К", title: "Открыть календарь", text: "Недельное расписание" },
    { type: "view", id: "payments", icon: "₽", title: "Добавить доход", text: "Раздел платежей" },
    { type: "view", id: "finance", icon: "−", title: "Добавить расход", text: "Финансы" }
  ];
  const q = query.trim().toLowerCase();
  const filtered = q ? commands.filter((item) => [item.title, item.text].some((value) => value.toLowerCase().includes(q))) : commands;
  return [...filtered, ...searchItems(query)].slice(0, 10);
}

function renderGlobalSearchResults(query) {
  const results = searchItems(query);
  return `
    ${results.map(renderSearchResult).join("") || '<div class="search-empty">Ничего не найдено</div>'}
  `;
}

function renderSearchResult(item) {
  return `
    <button class="search-result" type="button" data-search-type="${item.type}" data-search-id="${encodeURIComponent(item.id)}">
      <span>${item.icon}</span>
      <strong>${item.title}</strong>
      <small>${item.text}</small>
    </button>
  `;
}

function renderNotifications(notifications) {
  return `
    <div class="popover-head">
      <strong>Уведомления</strong>
      <span>${notifications.length || "нет"}</span>
    </div>
    <div class="notification-list">
      ${notifications.map((item) => `<div class="notification-item"><span>${item.icon}</span><div><strong>${item.title}</strong><small>${item.text}</small></div></div>`).join("") || renderEmptyState("Всё спокойно", "На сегодня нет срочных уведомлений.")}
    </div>
  `;
}

function renderCommandPalette() {
  return `
    <div class="modal-backdrop command-backdrop" data-action="closeCommandPalette">
      <section class="card modal command-palette" role="dialog" aria-modal="true" aria-label="Командная палитра">
        <div class="command-input">
          <span>⌕</span>
          <input id="commandSearch" value="${commandPaletteQuery}" placeholder="Команда, клиент, услуга, сотрудник..." autocomplete="off" autofocus />
        </div>
        <div class="command-list">
          ${commandItems(commandPaletteQuery).map(renderSearchResult).join("") || renderEmptyState("Ничего не найдено", "Попробуй имя клиента, услугу или команду.")}
        </div>
      </section>
    </div>
  `;
}

function openSearchItem(type, id) {
  const decodedId = decodeURIComponent(id || "");
  notificationPanelOpen = false;
  globalSearchQuery = "";
  commandPaletteOpen = false;
  commandPaletteQuery = "";
  if (type === "action" && decodedId === "new-booking") {
    editingBookingId = null;
    bookingSlotDraft = null;
    bookingModalOpen = true;
    render();
    return;
  }
  if (type === "view") {
    view = decodedId;
    render();
    return;
  }
  if (type === "booking") {
    selectedBookingId = decodedId;
    view = "calendar";
    render();
    return;
  }
  if (type === "client") {
    selectedClientName = decodedId;
    view = "clients";
    render();
    return;
  }
  if (type === "employee") {
    settingsTab = "employees";
    view = "settings";
    render();
    return;
  }
  if (type === "service") {
    settingsTab = "services";
    view = "settings";
    render();
  }
}

function studioTodayData() {
  const today = todayKey();
  const bookings = todaysBookings();
  const activeStatuses = ["заявка", "подтверждено", "в процессе"];
  const counts = Object.fromEntries(bookingStatuses.map((status) => [status, bookings.filter((booking) => booking.status === status).length]));
  const actualIncome = state.payments.filter((payment) => payment.date === today).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const expectedIncome = bookings.filter((booking) => activeStatuses.includes(booking.status)).reduce((sum, booking) => sum + Number(booking.amount || 0), 0);
  const completed = bookings.filter((booking) => booking.status === "завершено");
  const completedAmount = completed.reduce((sum, booking) => sum + Number(booking.amount || 0), 0);
  const studioBlocks = (state.studioBlocks || []).filter((block) => block.date === today && isActiveStudioBlock(block));
  return {
    today,
    bookings,
    counts,
    actualIncome,
    expectedIncome,
    completedCount: completed.length,
    averageCheck: completed.length ? completedAmount / completed.length : 0,
    employeePayoutAvailable: totalEmployeePayoutAvailable(),
    studioBlocks,
    availability: currentStudioAvailability(today),
    cancelledAmount: bookings.filter((booking) => booking.status === "отменено").reduce((sum, booking) => sum + Number(booking.amount || 0), 0),
    nextBooking: nextTodayBooking(bookings)
  };
}

function studioAttentionItems() {
  const today = todayKey();
  const until = addDays(today, 7);
  const activeStatuses = ["заявка", "подтверждено", "в процессе"];
  const items = [];
  state.bookings.forEach((booking) => {
    const active = activeStatuses.includes(booking.status);
    const addIssue = (type, text, priority) => items.push({ booking, type, text, priority, dateTime: `${booking.date} ${booking.time || "00:00"}` });
    if (booking.status === "заявка" && booking.date >= today && booking.date <= until) addIssue("Заявка", "Ожидает подтверждения", 1);
    if (active && studioConflictsForBooking(booking).length) addIssue("Конфликт студии", "Пространство занято другим событием", 0);
    if (active && !booking.phone && !booking.telegram) addIssue("Нет контактов", "Не указан телефон или Telegram", 2);
    if (active && !bookingEmployeeId(booking)) addIssue("Нет сотрудника", "Нужно назначить исполнителя", 2);
    if (booking.status === "завершено" && !paymentForBooking(booking.id)) addIssue("Нет платежа", "Завершённая запись без связанной оплаты", 0);
  });
  return items.sort((a, b) => a.priority - b.priority || a.dateTime.localeCompare(b.dateTime)).slice(0, 12);
}

function renderTodaySummary(data) {
  const metrics = [
    ["Всего", data.bookings.length], ["Подтверждено", data.counts["подтверждено"]],
    ["В процессе", data.counts["в процессе"]], ["Завершено", data.counts["завершено"]],
    ["Отменено", data.counts["отменено"]], ["Заявок", data.counts["заявка"]],
    ["Доход", money(data.actualIncome)], ["Ожидается", money(data.expectedIncome)]
  ];
  return `<div class="today-metrics">${metrics.map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("")}</div>`;
}

function currentStudioAvailability(date = todayKey()) {
  const now = new Date();
  const nowMinutes = date === todayKey() ? now.getHours() * 60 + now.getMinutes() : CALENDAR_START_HOUR * 60;
  const activeEvents = [
    ...(state.bookings || []).filter((booking) => booking.date === date && isActiveBooking(booking)),
    ...(state.studioBlocks || []).filter((block) => block.date === date && isActiveStudioBlock(block))
  ].filter(hasValidEventTime);
  const current = activeEvents.find((event) => bookingStartMinutes(event) <= nowMinutes && bookingEndMinutes(event) > nowMinutes) || null;
  const free = freeWindowRanges(date);
  const nextFree = free.find((range) => range[0] <= nowMinutes && range[1] > nowMinutes) || free.find((range) => range[0] >= nowMinutes) || null;
  return { current, nextFree };
}

function renderTodayAvailability(data) {
  const current = data.availability.current;
  const currentIsBlock = current && (state.studioBlocks || []).some((block) => block.id === current.id);
  return `
    <section class="card section studio-availability-strip ${current ? "busy" : "free"}">
      <div><span>Студия сейчас</span><strong>${current ? "Занята" : "Свободна"}</strong></div>
      <div><span>${current ? "До какого времени" : "Ближайшее окно"}</span><strong>${current ? `${formatMinutes(bookingEndMinutes(current))} · ${currentIsBlock ? current.title : current.client || current.service}` : data.availability.nextFree ? `${formatMinutes(data.availability.nextFree[0])}–${formatMinutes(data.availability.nextFree[1])}` : "окон нет"}</strong></div>
      <div><span>Технических блоков сегодня</span><strong>${data.studioBlocks.length}</strong></div>
      <button class="btn secondary" type="button" data-view="calendar">Открыть календарь</button>
    </section>
  `;
}

function renderAttentionList(items) {
  return `<div class="attention-list">${items.map(({ booking, type, text }) => `
    <article class="attention-item">
      <span class="attention-type">${type}</span>
      <div><strong>${booking.client || "Без имени"}</strong><small>${formatDate(booking.date)} · ${booking.time} · ${text}</small></div>
      <button class="btn secondary" type="button" data-open-booking="${booking.id}">Открыть</button>
    </article>
  `).join("") || renderEmptyState("Всё спокойно", "Нет записей, требующих внимания.")}</div>`;
}

function renderTodayMoney(data) {
  const metrics = [
    ["Фактический доход", money(data.actualIncome)], ["Ожидаемый доход", money(data.expectedIncome)],
    ["Завершено записей", data.completedCount], ["Средний чек", money(data.averageCheck)],
    ["Сумма отмен", money(data.cancelledAmount)], ["К выплате сотрудникам", money(data.employeePayoutAvailable)]
  ];
  return `<div class="today-money-grid">${metrics.map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("")}</div>`;
}

function renderDashboard() {
  const data = studioTodayData();
  const attention = studioAttentionItems();

  return `
    <section class="studio-today-hero card section">
      <div>
        <span>Главная / Сегодня</span>
        <h2>${formatDate(data.today)}</h2>
        <p>${weekdayLong(data.today)} · ${currentClock()}</p>
      </div>
      <div class="studio-today-pulse">
        <strong>${data.bookings.length}</strong>
        <span>${plural(data.bookings.length, "запись", "записи", "записей")} сегодня</span>
      </div>
    </section>
    <section class="card section today-summary-section">
      <div class="section-head"><h2>Сегодняшняя сводка</h2><span class="muted">Оперативные показатели дня</span></div>
      ${renderTodaySummary(data)}
    </section>
    ${renderTodayAvailability(data)}
    <div class="dashboard-layout studio-home">
      <section class="card section next-booking-card studio-home-next">
        <div class="section-head">
          <h2>Ближайшая запись</h2>
          ${data.nextBooking ? `<span class="select-chip">${untilLabel(data.nextBooking)}</span>` : ""}
        </div>
        ${data.nextBooking ? renderNextBooking(data.nextBooking) : renderEmptyState("На сегодня активных записей больше нет", "Можно проверить будущие даты в календаре.")}
      </section>
      <section class="card section studio-home-schedule">
        <div class="section-head">
          <h2>Записи на сегодня</h2>
          <button class="link-button" data-view="calendar">Календарь</button>
        </div>
        ${renderTodayBookingList(data.bookings)}
      </section>
      <section class="card section studio-home-attention">
        <div class="section-head"><h2>Требует внимания</h2><span class="select-chip">${attention.length}</span></div>
        ${renderAttentionList(attention)}
      </section>
      <section class="card section studio-home-money">
        <h2>Деньги сегодня</h2>
        ${renderTodayMoney(data)}
      </section>
      <section class="card section studio-home-quick">
        <h2>Быстрые действия</h2>
        <div class="quick-actions">
          <button class="quick-action" data-action="openBookingModal"><span>+</span>Новая запись</button>
          <button class="quick-action" data-view="calendar"><span>○</span>Открыть календарь</button>
          <button class="quick-action" data-view="clients"><span>К</span>Добавить клиента</button>
          <button class="quick-action" data-view="payments"><span>₽</span>Добавить платёж</button>
          <button class="quick-action" data-view="reports"><span>↗</span>Открыть отчёты</button>
        </div>
      </section>
    </div>
  `;
}

function renderNextBooking(booking) {
  const employee = state.users.find((user) => user.id === booking.employeeId) || employeeByName(booking.employee);
  const color = employee?.color || "#ff6633";
  return `
    <div class="next-booking" style="--employee-color:${color}">
      <div class="next-booking-main">
        <span class="service-icon">${serviceIcon(booking.service)}</span>
        <div>
          <h3>${booking.client || "Без имени"}</h3>
          <p class="muted">${booking.service} · ${booking.employee || "сотрудник не указан"}</p>
        </div>
      </div>
      <div class="next-booking-time">
        <strong>${booking.time}</strong>
        <span>${untilLabel(booking)}</span>
      </div>
      <div class="next-booking-details">
        <span>${booking.phone || "телефон не указан"}</span>
        <span>${booking.telegram || "Telegram не указан"}</span>
        <span>${money(booking.amount)}</span>
        <em class="status-pill status-${booking.status.replaceAll(" ", "-")}">${statusTitle(booking.status)}</em>
      </div>
      ${booking.comment ? `<p class="next-booking-comment">${booking.comment}</p>` : ""}
      <div class="next-booking-actions">
        <button class="btn secondary" type="button" data-open-booking="${booking.id}">Открыть запись</button>
        ${booking.status === "заявка" ? `<button class="btn" type="button" data-booking-status="${booking.id}" data-status="подтверждено">Подтвердить</button>` : ""}
        ${booking.status === "подтверждено" ? `<button class="btn" type="button" data-booking-status="${booking.id}" data-status="в процессе">В процесс</button>` : ""}
        ${booking.status === "в процессе" ? `<button class="btn" type="button" data-booking-status="${booking.id}" data-status="завершено">Завершить</button>` : ""}
        <button class="btn danger" type="button" data-booking-status="${booking.id}" data-status="отменено">Отменить</button>
      </div>
    </div>
  `;
}

function renderTodayBookingList(bookings) {
  return `
    <div class="today-booking-list">
      ${bookings.map((booking) => {
        const employee = state.users.find((user) => user.id === booking.employeeId) || employeeByName(booking.employee);
        const conflicts = studioConflictsForBooking(booking);
        return `
          <button class="today-booking-card status-${booking.status.replaceAll(" ", "-")}" type="button" data-open-booking="${booking.id}" style="--employee-color:${employee?.color || "#ff6633"}">
            <div class="today-booking-time"><strong>${booking.time}</strong><span>${booking.duration || "1 час"}</span></div>
            <div class="today-booking-content">
              <strong>${booking.client || "Без имени"}</strong>
              <span>${booking.service} · ${booking.employee || "сотрудник не указан"}</span>
              ${booking.comment ? `<small>${booking.comment}</small>` : ""}
            </div>
            <div class="today-booking-side">
              <strong>${money(booking.amount)}</strong>
              <span class="status-pill status-${booking.status.replaceAll(" ", "-")}">${statusTitle(booking.status)}</span>
              ${conflicts.length ? '<em class="calendar-conflict-badge">Студия занята</em>' : ""}
            </div>
          </button>
        `;
      }).join("") || renderEmptyState("Сегодня записей нет", "Добавь запись или выбери свободное время в календаре.", "Новая запись", 'type="button" data-action="openBookingModal"')}
    </div>
  `;
}

function renderTodaySchedule(bookings) {
  const byHour = new Map(bookings.map((booking) => [Number(String(booking.time || "0").slice(0, 2)), booking]));
  const rows = [];
  for (let hour = CALENDAR_START_HOUR; hour <= Math.min(CALENDAR_END_HOUR, 20); hour += 2) {
    const booking = byHour.get(hour);
    rows.push(booking ? renderTodayScheduleRow(booking) : renderTodayFreeRow(hour));
  }
  return `<div class="today-schedule">${rows.join("")}</div>`;
}

function renderTodayScheduleRow(booking) {
  const employee = employeeByName(booking.employee);
  const color = employee?.color || "#ff6633";
  return `
    <button class="today-schedule-row busy" type="button" data-open-booking="${booking.id}" style="--employee-color:${color}">
      <strong>${booking.time}</strong>
      <span>${booking.client || "Без имени"}</span>
      <span><i>${serviceIcon(booking.service)}</i>${booking.service}</span>
      <em class="status-text status-${booking.status.replaceAll(" ", "-")}">${statusTitle(booking.status)}</em>
    </button>
  `;
}

function renderTodayFreeRow(hour) {
  const time = `${String(hour).padStart(2, "0")}:00`;
  return `
    <button class="today-schedule-row free" type="button" data-calendar-slot="${todayKey()}|${time}">
      <strong>${time}</strong>
      <span>Свободно</span>
      <span>окно для записи</span>
      <em>создать</em>
    </button>
  `;
}

function renderFreeWindows(date = todayKey()) {
  const free = freeWindowRanges(date);
  return `
    <div class="free-slots">
      ${free.map(([start, end]) => `<button class="select-chip" data-calendar-slot="${date}|${formatMinutes(start)}">${formatMinutes(start)}–${formatMinutes(end)}</button>`).join("") || renderEmptyState(date === todayKey() ? "Сегодня свободных окон нет" : "Свободных окон нет", "Студия занята в пределах рабочего дня.")} 
    </div>
  `;
}

function renderTodayTimeline(bookings) {
  return `
    <div class="timeline-list">
      ${bookings
        .map((booking) => `
          <button class="timeline-row" data-open-booking="${booking.id}">
            <strong>${booking.time}</strong>
            <span>${booking.client || "Без имени"}</span>
            <span>${booking.service}</span>
            <em class="status-text status-${booking.status.replaceAll(" ", "-")}">${statusTitle(booking.status)}</em>
          </button>
        `)
        .join("") || renderEmptyState("На сегодня записей нет", "Создай первую запись или выбери свободный слот.")}
    </div>
  `;
}

function renderTodayRows(bookings) {
  return `
    <div class="compact-list">
      ${bookings
        .map((booking) => `
          <button class="compact-row timeline-button" data-open-booking="${booking.id}">
            <span>${booking.time}</span>
            <strong>${booking.client || "Без имени"} — ${booking.service}</strong>
            <em>${statusTitle(booking.status)}</em>
          </button>
        `)
        .join("") || renderEmptyState("Сегодня свободно", "Расписание пока пустое.")}
    </div>
  `;
}

function renderBookingMiniList(bookings) {
  return `
    <div class="compact-list">
      ${bookings
        .map((booking) => `
          <button class="compact-row timeline-button" data-open-booking="${booking.id}">
            <span>${formatDate(booking.date)}</span>
            <strong>${booking.client || "Без имени"}</strong>
            <em>${booking.time}</em>
          </button>
        `)
        .join("") || renderEmptyState("Заявок нет", "Все записи обработаны.")}
    </div>
  `;
}

function activeEmployees() {
  return state.users.filter((user) => user.active !== false);
}

function bookingEmployeeOptions(selectedName = "") {
  const active = activeEmployees();
  const selected = state.users.find((user) => user.name === selectedName);
  return selected && selected.active === false ? [...active, selected] : active;
}

function catalogGroups() {
  return [...(state.serviceGroups || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function catalogServices() {
  return [...(state.serviceItems || [])].sort((a, b) => {
    const groupA = catalogGroups().find((group) => group.id === a.categoryId)?.order || 99;
    const groupB = catalogGroups().find((group) => group.id === b.categoryId)?.order || 99;
    return groupA - groupB || Number(a.order || 0) - Number(b.order || 0);
  });
}

function serviceByName(name) {
  return catalogServices().find((service) => service.name === name);
}

function serviceById(id) {
  return catalogServices().find((service) => service.id === id);
}

function serviceFieldLocks(service = {}) {
  const manual = service.mode === "manual";
  const hasPrice = Number(service.price || 0) > 0;
  const hasDuration = Boolean(String(service.duration || "").trim()) && !/^0(?:\D|$)/.test(String(service.duration).trim());
  return {
    price: !manual && (service.mode === "fixed" || (!service.mode && hasPrice)),
    duration: !manual && hasDuration
  };
}

function serviceLockHint(service = {}) {
  const locks = serviceFieldLocks(service);
  if (locks.price && locks.duration) return "Стоимость и длительность заданы выбранной услугой.";
  if (locks.price) return "Стоимость задана выбранной услугой.";
  if (locks.duration) return "Длительность задана выбранной услугой.";
  return "Значения можно изменить вручную.";
}

function applyBookingServiceFields(service = {}) {
  const locks = serviceFieldLocks(service);
  const amountInputs = document.querySelectorAll("#bookingAmountInput, #amountInput");
  const durationInputs = document.querySelectorAll("#bookingDurationInput, #bookingInlineDurationInput");
  amountInputs.forEach((input) => {
    if (service.id) input.value = service.price || "";
    input.readOnly = locks.price;
    input.classList.toggle("catalog-locked", locks.price);
  });
  durationInputs.forEach((input) => {
    if (service.id) input.value = service.duration || "1 час";
    input.readOnly = locks.duration;
    input.classList.toggle("catalog-locked", locks.duration);
  });
  document.querySelectorAll("[data-service-lock-hint]").forEach((hint) => {
    hint.textContent = serviceLockHint(service);
    hint.classList.toggle("locked", locks.price || locks.duration);
  });
}

function employeeByName(name) {
  return state.users.find((user) => user.name === name);
}

function saveCalendarSettings() {
  state.calendarSettings = {
    mode: calendarMode,
    date: calendarDate,
    employee: calendarEmployeeFilter,
    status: calendarStatusFilter,
    service: calendarServiceFilter
  };
  saveState();
}

function bookingEmployeeId(booking) {
  return booking.employeeId || state.users.find((user) => user.name === booking.employee)?.id || booking.employee || "";
}

function bookingStartMinutes(booking) {
  const match = String(booking?.time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;
  return hours * 60 + minutes;
}

function bookingDurationMinutes(booking) {
  if (typeof booking?.duration === "number") {
    if (!Number.isFinite(booking.duration) || booking.duration <= 0) return 60;
    return Math.max(15, booking.duration <= 24 ? booking.duration * 60 : booking.duration);
  }
  const value = String(booking?.duration || "1 час").toLowerCase();
  const amount = Number(value.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".") || 1);
  if (!Number.isFinite(amount) || amount <= 0) return 60;
  if (/^\d+(?:[.,]\d+)?$/.test(value.trim())) return Math.max(15, amount <= 24 ? amount * 60 : amount);
  if (value.includes("мин")) return Math.max(15, amount);
  if (value.includes("день") || value.includes("дня") || value.includes("дней")) return 8 * 60;
  return Math.max(15, amount * 60);
}

function bookingEndMinutes(booking) {
  return bookingStartMinutes(booking) + bookingDurationMinutes(booking);
}

function hasValidEventTime(event) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(event?.time || ""));
}

function bookingsOverlap(a, b) {
  if (!a || !b || a.date !== b.date || !hasValidEventTime(a) || !hasValidEventTime(b)) return false;
  return bookingStartMinutes(a) < bookingEndMinutes(b) && bookingStartMinutes(b) < bookingEndMinutes(a);
}

function isActiveBooking(booking) {
  return ["заявка", "подтверждено", "в процессе"].includes(booking?.status);
}

function isActiveStudioBlock(block) {
  return block?.status !== "cancelled";
}

function studioConflictsForBooking(booking, excludeId = booking?.id) {
  if (!isActiveBooking(booking) || !booking?.date || !hasValidEventTime(booking)) return [];
  const bookingConflicts = (state.bookings || [])
    .filter((candidate) => candidate.id !== excludeId && isActiveBooking(candidate) && bookingsOverlap(booking, candidate))
    .map((candidate) => ({ kind: "booking", item: candidate }));
  const blockConflicts = (state.studioBlocks || [])
    .filter((block) => isActiveStudioBlock(block) && bookingsOverlap(booking, block))
    .map((block) => ({ kind: "block", item: block }));
  return [...bookingConflicts, ...blockConflicts];
}

function studioConflictsForBlock(block, excludeId = block?.id) {
  if (!isActiveStudioBlock(block) || !block?.date || !hasValidEventTime(block)) return [];
  const bookingConflicts = (state.bookings || [])
    .filter((booking) => isActiveBooking(booking) && bookingsOverlap(block, booking))
    .map((booking) => ({ kind: "booking", item: booking }));
  const blockConflicts = (state.studioBlocks || [])
    .filter((candidate) => candidate.id !== excludeId && isActiveStudioBlock(candidate) && bookingsOverlap(block, candidate))
    .map((candidate) => ({ kind: "block", item: candidate }));
  return [...bookingConflicts, ...blockConflicts];
}

function employeeConflictsForBooking(booking, excludeId = booking?.id) {
  if (!isActiveBooking(booking) || !bookingEmployeeId(booking)) return [];
  return (state.bookings || []).filter((candidate) =>
    candidate.id !== excludeId &&
    isActiveBooking(candidate) &&
    bookingEmployeeId(candidate) === bookingEmployeeId(booking) &&
    bookingsOverlap(booking, candidate)
  );
}

function calendarBookingGeometry(booking) {
  const startMinutes = bookingStartMinutes(booking);
  const visibleEndMinutes = (CALENDAR_END_HOUR + 1) * 60;
  const durationMinutes = Math.min(bookingDurationMinutes(booking), Math.max(15, visibleEndMinutes - startMinutes));
  const minuteOffset = startMinutes % 60;
  const top = (minuteOffset / 60) * CALENDAR_HOUR_HEIGHT;
  const height = Math.max(34, (durationMinutes / 60) * CALENDAR_HOUR_HEIGHT - 6);
  return {
    startMinutes,
    durationMinutes,
    top,
    height,
    sizeClass: durationMinutes <= 45 ? "duration-short" : durationMinutes <= 90 ? "duration-compact" : durationMinutes >= 180 ? "duration-long" : "duration-medium"
  };
}

function bookingConflicts(booking, excludeId = booking.id) {
  return employeeConflictsForBooking(booking, excludeId);
}

function calendarBookingMatches(booking) {
  if (calendarEmployeeFilter && bookingEmployeeId(booking) !== calendarEmployeeFilter) return false;
  if (calendarStatusFilter && booking.status !== calendarStatusFilter) return false;
  if (calendarServiceFilter.startsWith("group:") && booking.serviceCategoryId !== calendarServiceFilter.slice(6)) return false;
  if (calendarServiceFilter.startsWith("service:") && booking.serviceId !== calendarServiceFilter.slice(8)) return false;
  return true;
}

function calendarBookings() {
  return state.bookings.filter(calendarBookingMatches);
}

function renderCalendarFilters() {
  return `
    <div class="calendar-filters">
      <select id="calendarEmployeeFilter" aria-label="Сотрудник">
        <option value="">Все сотрудники</option>
        ${state.users.map((user) => `<option value="${user.id}" ${calendarEmployeeFilter === user.id ? "selected" : ""}>${user.name}</option>`).join("")}
      </select>
      <select id="calendarStatusFilter" aria-label="Статус">
        <option value="">Все статусы</option>
        ${bookingStatuses.map((status) => `<option value="${status}" ${calendarStatusFilter === status ? "selected" : ""}>${statusTitle(status)}</option>`).join("")}
      </select>
      <select id="calendarServiceFilter" aria-label="Услуга или категория">
        <option value="">Все услуги</option>
        ${catalogGroups().map((group) => `<option value="group:${group.id}" ${calendarServiceFilter === `group:${group.id}` ? "selected" : ""}>Категория · ${group.name}</option>`).join("")}
        ${catalogServices().map((service) => `<option value="service:${service.id}" ${calendarServiceFilter === `service:${service.id}` ? "selected" : ""}>${service.name}</option>`).join("")}
      </select>
      ${(calendarEmployeeFilter || calendarStatusFilter || calendarServiceFilter) ? '<button class="btn secondary" type="button" data-action="clearCalendarFilters">Сбросить</button>' : ""}
    </div>
  `;
}

function renderDaySummary(day, bookings) {
  const now = new Date();
  const next = bookings.find((booking) => booking.status !== "отменено" && new Date(`${booking.date}T${booking.time}`) >= now);
  const completedTotal = bookings.filter((booking) => booking.status === "завершено").reduce((sum, booking) => sum + Number(booking.amount || 0), 0);
  return `
    <div class="calendar-day-summary">
      <article><span>Записей</span><strong>${bookings.length}</strong></article>
      <article><span>Следующая</span><strong>${next ? `${next.time} · ${next.client}` : "нет"}</strong></article>
      <article><span>Завершено</span><strong>${money(completedTotal)}</strong></article>
      <article><span>Заявок</span><strong>${bookings.filter((booking) => booking.status === "заявка").length}</strong></article>
      <article><span>Отмен</span><strong>${bookings.filter((booking) => booking.status === "отменено").length}</strong></article>
      <article><span>Тех. блоков</span><strong>${(state.studioBlocks || []).filter((block) => block.date === day && isActiveStudioBlock(block)).length}</strong></article>
    </div>
  `;
}

function renderDayAvailability(day) {
  return `
    <section class="card section calendar-availability-summary">
      <div class="section-head"><div><h3>Свободные окна</h3><p class="muted">Активные записи и технические блоки учитываются вместе.</p></div></div>
      ${renderFreeWindows(day)}
    </section>
  `;
}

function renderCalendar() {
  const today = todayKey();
  calendarWeekStart = weekStart(calendarDate);
  const days = calendarMode === "day" ? [calendarDate] : weekDays(calendarWeekStart);
  const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 }, (_, index) => CALENDAR_START_HOUR + index);
  const visibleBookings = calendarBookings();
  if (selectedBookingId && !visibleBookings.some((booking) => booking.id === selectedBookingId)) selectedBookingId = null;
  if (selectedStudioBlockId && !(state.studioBlocks || []).some((block) => block.id === selectedStudioBlockId && days.includes(block.date))) selectedStudioBlockId = null;
  const periodStart = days[0];
  const periodEnd = days[days.length - 1];
  const title = calendarMode === "day" ? `${formatDate(periodStart)} · ${weekdayLong(periodStart)}` : `${formatDate(periodStart)} — ${formatDate(periodEnd)}`;

  return `
    <section class="calendar-page calendar-mode-${calendarMode}">
      <div class="card section calendar-toolbar">
        <div>
          <h2>${title}</h2>
          <p class="muted">Нажми на свободный слот, чтобы добавить запись.</p>
        </div>
        <div class="actions">
          <button class="btn secondary" data-action="prevCalendarPeriod">Назад</button>
          <button class="btn secondary" data-action="todayCalendar">Сегодня</button>
          <button class="btn secondary" data-action="nextCalendarPeriod">Вперёд</button>
          <div class="calendar-view-switch" role="group" aria-label="Вид календаря">
            <button type="button" class="${calendarMode === "week" ? "active" : ""}" data-calendar-mode="week">Неделя</button>
            <button type="button" class="${calendarMode === "day" ? "active" : ""}" data-calendar-mode="day">День</button>
          </div>
          <button class="btn" data-action="openBookingModal">Добавить запись</button>
          <button class="btn secondary" data-action="openStudioBlockModal">Заблокировать время</button>
        </div>
      </div>
      ${renderCalendarFilters()}
      ${calendarMode === "day" ? renderDaySummary(calendarDate, visibleBookings.filter((booking) => booking.date === calendarDate)) : ""}
      ${calendarMode === "day" ? renderDayAvailability(calendarDate) : ""}
      <div class="calendar-workspace">
        <section class="card calendar-grid" style="--calendar-days:${days.length}">
          <div class="calendar-corner"></div>
          ${days.map((day) => `<div class="calendar-day-head ${day === today ? "today" : ""}"><strong>${weekdayLabel(day)}</strong></div>`).join("")}
          ${hours
            .map(
              (hour) => `
                <div class="calendar-hour">${String(hour).padStart(2, "0")}:00</div>
                ${days.map((day) => renderCalendarSlot(day, hour, today)).join("")}
              `
            )
            .join("")}
        </section>
        ${renderBookingDetailsPanel()}
      </div>
    </section>
  `;
}

function renderCalendarSlot(day, hour, today) {
  const hourText = `${String(hour).padStart(2, "0")}:`;
  const bookings = calendarBookings().filter((booking) => booking.date === day && String(booking.time || "").startsWith(hourText));
  const blocks = (state.studioBlocks || []).filter((block) => block.date === day && isActiveStudioBlock(block) && String(block.time || "").startsWith(hourText));
  const currentLine = day === today && currentHourLine(hour);
  return `
    <button class="calendar-slot ${day === today ? "today" : ""}" data-calendar-slot="${day}|${String(hour).padStart(2, "0")}:00">
      ${currentLine ? `<span class="current-time-line" style="top:${currentLine}%"></span>` : ""}
      ${bookings.map(renderCalendarBooking).join("")}
      ${blocks.map(renderCalendarStudioBlock).join("")}
    </button>
  `;
}

function currentHourLine(hour) {
  const now = new Date();
  const currentHour = now.getHours();
  if (currentHour !== hour) return 0;
  if (currentHour < CALENDAR_START_HOUR || currentHour > CALENDAR_END_HOUR) return 0;
  return Math.max(4, Math.min(96, (now.getMinutes() / 60) * 100));
}

function renderCalendarBooking(booking) {
  const employee = state.users.find((user) => user.id === booking.employeeId) || employeeByName(booking.employee);
  const color = employee?.color || "#ff6633";
  const studioConflicts = studioConflictsForBooking(booking);
  const employeeConflicts = employeeConflictsForBooking(booking);
  const geometry = calendarBookingGeometry(booking);
  return `
    <article class="calendar-booking ${geometry.sizeClass} ${selectedBookingId === booking.id ? "selected" : ""} ${studioConflicts.length ? "has-conflict studio-conflict" : employeeConflicts.length ? "has-conflict employee-conflict" : ""} status-${booking.status.replaceAll(" ", "-")}" data-calendar-booking="${booking.id}" style="--employee-color:${color};--booking-top:${geometry.top}px;--booking-height:${geometry.height}px">
      <strong><i>${serviceIcon(booking.service)}</i>${booking.time} · ${booking.client || "Без имени"}</strong>
      <span>${booking.service} · ${booking.duration || "1 час"}</span>
      <span class="calendar-booking-employee"><b></b>${booking.employee || "Сотрудник не указан"}</span>
      <span class="calendar-booking-meta">${Number(booking.amount || 0) ? money(booking.amount) : "Стоимость не указана"}</span>
      <div class="calendar-booking-badges">
        <em class="calendar-status-badge">${statusTitle(booking.status)}</em>
        ${studioConflicts.length ? '<em class="calendar-conflict-badge">Студия занята</em>' : employeeConflicts.length ? '<em class="calendar-conflict-badge secondary">Сотрудник занят</em>' : ""}
      </div>
    </article>
  `;
}

function renderCalendarStudioBlock(block) {
  const geometry = calendarBookingGeometry(block);
  const conflicts = studioConflictsForBlock(block);
  return `
    <article class="calendar-booking studio-block-card ${geometry.sizeClass} ${selectedStudioBlockId === block.id ? "selected" : ""} ${conflicts.length ? "has-conflict studio-conflict" : ""}" data-calendar-studio-block="${block.id}" style="--booking-top:${geometry.top}px;--booking-height:${geometry.height}px">
      <strong><i>■</i>${eventTimeRange(block)}</strong>
      <span>${block.type} · ${block.duration || "1 час"}</span>
      <span class="calendar-booking-employee"><b></b>${block.title || "Студия недоступна"}</span>
      ${block.comment ? `<span class="calendar-booking-meta">${block.comment}</span>` : ""}
      <div class="calendar-booking-badges">
        <em class="calendar-status-badge">Технический блок</em>
        ${conflicts.length ? '<em class="calendar-conflict-badge">Конфликт студии</em>' : ""}
      </div>
    </article>
  `;
}

function renderBookingDetailsPanel() {
  const studioBlock = (state.studioBlocks || []).find((block) => block.id === selectedStudioBlockId);
  if (studioBlock) return renderStudioBlockDetailsPanel(studioBlock);
  const booking = state.bookings.find((item) => item.id === selectedBookingId && calendarBookingMatches(item));
  if (!booking) {
    return `
      <aside class="card section booking-details empty">
        <h2>Детали записи</h2>
        <p class="muted">Выбери запись в календаре.</p>
      </aside>
    `;
  }

  return `
    <aside class="card section booking-details">
      <div class="section-head">
        <h2>${booking.client || "Без имени"}</h2>
        <span class="status-pill status-${booking.status.replaceAll(" ", "-")}">${statusTitle(booking.status)}</span>
      </div>
      <div class="details-list">
        ${renderDetailRow("Услуга", booking.service)}
        ${renderDetailRow("Дата", formatDate(booking.date))}
        ${renderDetailRow("Время", booking.time)}
        ${renderDetailRow("Длительность", booking.duration)}
        ${renderDetailRow("Телефон", booking.phone || "не указан")}
        ${renderDetailRow("Telegram", booking.telegram || "не указан")}
        ${renderDetailRow("Сумма", money(booking.amount))}
        ${renderDetailRow("Сотрудник", booking.employee || "не указан")}
        ${renderDetailRow("Платёж", paymentForBooking(booking.id) ? `<button class="link-button inline-link" data-open-payment="${paymentForBooking(booking.id).id}">${money(paymentForBooking(booking.id).amount)}</button>` : "ещё не создан")}
        ${renderDetailRow("Комментарий", booking.comment || "нет")}
      </div>
      <div class="booking-side-actions">
        <button class="btn secondary" data-side-edit-booking="${booking.id}">Редактировать</button>
        ${booking.status === "заявка" ? `<button class="btn" data-side-status-booking="${booking.id}" data-status="подтверждено">Подтвердить</button>` : ""}
        ${booking.status === "подтверждено" ? `<button class="btn" data-side-status-booking="${booking.id}" data-status="в процессе">В процесс</button>` : ""}
        ${booking.status === "в процессе" ? `<button class="btn" data-side-status-booking="${booking.id}" data-status="завершено">Завершить</button>` : ""}
        ${!["завершено", "отменено"].includes(booking.status) ? `<button class="btn danger" data-side-status-booking="${booking.id}" data-status="отменено">Отменить</button>` : ""}
        <button class="btn danger" data-side-delete-booking="${booking.id}">Удалить запись</button>
      </div>
      <div class="status-history">
        <h3>История статусов</h3>
        ${(booking.statusHistory || []).map((item) => `<div><span>${new Date(item.at).toLocaleString("ru-RU")}</span><strong>${statusTitle(item.status)}</strong><small>${item.user || "Система"} · ${item.note || ""}</small></div>`).join("") || '<p class="muted">Истории пока нет</p>'}
      </div>
    </aside>
  `;
}

function renderStudioBlockDetailsPanel(block) {
  const conflicts = studioConflictsForBlock(block);
  return `
    <aside class="card section booking-details studio-block-details">
      <div class="section-head"><h2>${block.title || "Технический блок"}</h2><span class="status-pill studio-block-pill">${block.type}</span></div>
      <div class="details-list">
        ${renderDetailRow("Дата", formatDate(block.date))}
        ${renderDetailRow("Время", eventTimeRange(block))}
        ${renderDetailRow("Длительность", block.duration || "1 час")}
        ${renderDetailRow("Тип", block.type)}
        ${renderDetailRow("Комментарий", block.comment || "нет")}
        ${renderDetailRow("Занятость", conflicts.length ? `Конфликт студии · ${conflicts.length}` : "Студия заблокирована")}
      </div>
      <div class="booking-side-actions">
        <button class="btn secondary" type="button" data-edit-studio-block="${block.id}">Редактировать</button>
        <button class="btn danger" type="button" data-delete-studio-block="${block.id}">Удалить блок</button>
      </div>
    </aside>
  `;
}

function renderDetailRow(label, value) {
  return `<div><span>${label}</span><strong>${value}</strong></div>`;
}

function renderBookingModal() {
  const booking = state.bookings.find((item) => item.id === editingBookingId) || bookingSlotDraft || {};
  const service = serviceById(booking.serviceId) || serviceByName(booking.serviceName || booking.service) || catalogServices()[0] || {};
  const selectedCategoryId = service.categoryId || catalogGroups()[0]?.id || "";
  const visibleServices = catalogServices().filter((item) => item.categoryId === selectedCategoryId && (item.active !== false || item.name === booking.service));
  const filteredEmployee = state.users.find((user) => user.id === calendarEmployeeFilter);
  const defaultEmployee = filteredEmployee?.name || currentUser()?.name || activeEmployees()[0]?.name || "";
  const employeeOptions = bookingEmployeeOptions(booking.employee || defaultEmployee);
  const status = booking.status || "подтверждено";
  const fieldLocks = serviceFieldLocks(service);
  const durationValue = fieldLocks.duration ? service.duration : booking.duration || service.duration || "1 час";
  const amountValue = fieldLocks.price ? service.price : booking.amount || service.price || 0;
  const conflictDraft = {
    ...booking,
    employeeId: booking.employeeId || filteredEmployee?.id || employeeOptions[0]?.id || "",
    employee: booking.employee || filteredEmployee?.name || defaultEmployee,
    status
  };
  const conflicts = studioConflictsForBooking(conflictDraft, booking.id || editingBookingId);

  return `
    <div class="modal-backdrop" data-action="closeBookingModal">
      <section class="card modal booking-modal" role="dialog" aria-modal="true" aria-label="Запись">
        <div class="modal-head">
          <div>
            <h2>${editingBookingId ? "Редактировать запись" : "Добавить запись"}</h2>
            <p class="muted">Внутреннее расписание KRUG CRM.</p>
          </div>
          <button class="icon-btn" type="button" data-action="closeBookingModal">×</button>
        </div>
        <form id="bookingModalForm" class="form-grid">
          <input type="hidden" name="id" value="${booking.id || ""}" />
          <div class="field">
            <label>Клиент</label>
            <input name="client" required value="${booking.client || ""}" />
          </div>
          <div class="field">
            <label>Телефон</label>
            <input name="phone" value="${booking.phone || ""}" />
          </div>
          <div class="field">
            <label>Telegram</label>
            <input name="telegram" value="${booking.telegram || ""}" />
          </div>
          <div class="field">
            <label>Категория услуги</label>
            <select name="categoryId" id="bookingCategorySelect" required>
              ${catalogGroups().map((group) => `<option value="${group.id}" ${selectedCategoryId === group.id ? "selected" : ""}>${group.name}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Услуга</label>
            <select name="serviceId" id="bookingServiceSelect" required>
              ${visibleServices.map((item) => `<option value="${item.id}" ${((booking.serviceId || service.id) === item.id) ? "selected" : ""}>${item.name}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Дата</label>
            <input name="date" type="date" required value="${booking.date || todayKey()}" />
          </div>
          <div class="field">
            <label>Время</label>
            <input name="time" type="time" required value="${booking.time || "12:00"}" />
          </div>
          <div class="field">
            <label>Длительность</label>
            <input name="duration" id="bookingDurationInput" class="${fieldLocks.duration ? "catalog-locked" : ""}" value="${durationValue}" ${fieldLocks.duration ? "readonly" : ""} />
          </div>
          <div class="field">
            <label>Стоимость</label>
            <input name="amount" id="bookingAmountInput" class="${fieldLocks.price ? "catalog-locked" : ""}" type="number" min="0" step="1" required value="${amountValue}" ${fieldLocks.price ? "readonly" : ""} />
            <span class="field-note ${fieldLocks.price || fieldLocks.duration ? "locked" : ""}" data-service-lock-hint>${serviceLockHint(service)}</span>
          </div>
          <div class="field">
            <label>Сотрудник</label>
            <select name="employeeId">${employeeOptions.map((user) => `<option value="${user.id}" ${((booking.employeeId || "") === user.id || (booking.employee || defaultEmployee) === user.name) ? "selected" : ""}>${user.name}${user.active === false ? " · неактивен" : ""}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Статус</label>
            <select name="status">${bookingStatuses.map((item) => `<option value="${item}" ${status === item ? "selected" : ""}>${statusTitle(item)}</option>`).join("")}</select>
          </div>
          <div class="field full">
            <label>Комментарий</label>
            <textarea name="comment">${booking.comment || ""}</textarea>
          </div>
          <div id="bookingConflictWarning" class="booking-conflict-warning full ${conflicts.length ? "visible" : ""}">
            <strong>В это время студия уже занята</strong>
            <span>${conflicts.length ? conflicts.map(describeStudioConflict).join(" ") : ""}</span>
          </div>
          <div class="actions full modal-actions">
            <button class="btn" type="submit">Сохранить</button>
            ${editingBookingId ? '<button class="btn" type="button" data-action="completeBookingFromModal">Завершить</button>' : ""}
            ${editingBookingId ? '<button class="btn secondary" type="button" data-action="cancelBookingFromModal">Отменить</button>' : ""}
            ${editingBookingId ? '<button class="btn danger" type="button" data-action="deleteBookingFromModal">Удалить</button>' : ""}
            <button class="btn secondary" type="button" data-action="closeBookingModal">Закрыть</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function updateBookingConflictWarning() {
  const form = document.querySelector("#bookingModalForm");
  const warning = document.querySelector("#bookingConflictWarning");
  if (!form || !warning) return;
  const data = Object.fromEntries(new FormData(form));
  const employee = state.users.find((user) => user.id === data.employeeId);
  const conflicts = studioConflictsForBooking({
    id: data.id,
    date: data.date,
    time: data.time,
    duration: data.duration,
    employeeId: data.employeeId,
    employee: employee?.name || "",
    status: data.status
  }, data.id || editingBookingId);
  warning.classList.toggle("visible", conflicts.length > 0);
  const text = warning.querySelector("span");
  if (text) text.textContent = conflicts.length ? conflicts.map(describeStudioConflict).join(" ") : "";
}

function describeStudioConflict(conflict) {
  const item = conflict.item;
  if (conflict.kind === "block") return `Конфликт с блоком: ${item.title || item.type}, ${eventTimeRange(item)}.`;
  return `Конфликт: ${eventTimeRange(item)}, ${item.client || "Без имени"}, ${item.service || "услуга не указана"}, ${statusTitle(item.status)}.`;
}

function studioBlockFromForm(data) {
  const existing = (state.studioBlocks || []).find((block) => block.id === data.id);
  const now = new Date().toISOString();
  return {
    id: data.id || crypto.randomUUID(),
    date: data.date,
    time: data.time,
    duration: String(data.duration || "").trim() || "1 час",
    type: studioBlockTypes.includes(data.type) ? data.type : "Другое",
    title: String(data.title || "").trim() || data.type || "Технический блок",
    comment: String(data.comment || "").trim(),
    status: "active",
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function renderStudioBlockModal() {
  const block = (state.studioBlocks || []).find((item) => item.id === editingStudioBlockId) || studioBlockDraft || {};
  const draft = { ...block, status: "active", date: block.date || calendarDate, time: block.time || "12:00", duration: block.duration || "1 час" };
  const conflicts = studioConflictsForBlock(draft, block.id || editingStudioBlockId);
  return `
    <div class="modal-backdrop" data-action="closeStudioBlockModal">
      <section class="card modal studio-block-modal" role="dialog" aria-modal="true" aria-label="Технический блок">
        <div class="modal-head">
          <div><h2>${editingStudioBlockId ? "Редактировать блок" : "Заблокировать время"}</h2><p class="muted">Блок занимает всё пространство студии и не связан с финансами.</p></div>
          <button class="icon-btn" type="button" data-action="closeStudioBlockModal">×</button>
        </div>
        <form id="studioBlockForm" class="form-grid">
          <input type="hidden" name="id" value="${block.id || ""}" />
          <div class="field"><label>Дата</label><input name="date" type="date" required value="${draft.date}" /></div>
          <div class="field"><label>Время</label><input name="time" type="time" required value="${draft.time}" /></div>
          <div class="field"><label>Длительность</label><input name="duration" required value="${draft.duration}" placeholder="Например: 1 час или 90 минут" /></div>
          <div class="field"><label>Тип</label><select name="type">${studioBlockTypes.map((type) => `<option ${draft.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></div>
          <div class="field full"><label>Название</label><input name="title" required value="${block.title || ""}" placeholder="Например: уборка и подготовка" /></div>
          <div class="field full"><label>Комментарий</label><textarea name="comment" placeholder="Что нужно учесть сотрудникам">${block.comment || ""}</textarea></div>
          <div id="studioBlockConflictWarning" class="booking-conflict-warning full ${conflicts.length ? "visible" : ""}">
            <strong>В это время студия уже занята</strong>
            <span>${conflicts.length ? conflicts.map(describeStudioConflict).join(" ") : ""}</span>
          </div>
          <div class="actions full modal-actions"><button class="btn" type="submit">Сохранить блок</button><button class="btn secondary" type="button" data-action="closeStudioBlockModal">Отмена</button></div>
        </form>
      </section>
    </div>
  `;
}

function updateStudioBlockConflictWarning() {
  const form = document.querySelector("#studioBlockForm");
  const warning = document.querySelector("#studioBlockConflictWarning");
  if (!form || !warning) return;
  const data = Object.fromEntries(new FormData(form));
  const conflicts = studioConflictsForBlock({ ...data, status: "active" }, data.id || editingStudioBlockId);
  warning.classList.toggle("visible", conflicts.length > 0);
  const text = warning.querySelector("span");
  if (text) text.textContent = conflicts.length ? conflicts.map(describeStudioConflict).join(" ") : "";
}

function filteredBookings() {
  const search = bookingSearchFilter.trim().toLowerCase();
  return [...state.bookings]
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .filter((booking) => !bookingDateFilter || booking.date === bookingDateFilter)
    .filter((booking) => !bookingStatusFilter || booking.status === bookingStatusFilter)
    .filter((booking) => !bookingServiceFilter || booking.serviceId === bookingServiceFilter || booking.service === bookingServiceFilter)
    .filter((booking) => !bookingEmployeeFilter || booking.employeeId === bookingEmployeeFilter || booking.employee === bookingEmployeeFilter)
    .filter((booking) => !search || [booking.clientName, booking.client, booking.phone, booking.telegram].some((value) => String(value || "").toLowerCase().includes(search)));
}

function renderBookings() {
  const bookings = filteredBookings();
  const services = [...new Map([...catalogServices().map((service) => [service.id, service]), ...state.bookings.filter((booking) => booking.service).map((booking) => [booking.serviceId || booking.service, { id: booking.serviceId || booking.service, name: booking.service }])]).values()];
  const employees = [...new Map([...state.users.map((user) => [user.id || user.name, user]), ...state.bookings.filter((booking) => booking.employee).map((booking) => [booking.employeeId || booking.employee, { id: booking.employeeId || booking.employee, name: booking.employee }])]).values()];

  return `
    <div class="grid two-col bookings-page">
      <section class="card section">
        <div class="toolbar booking-filters">
          <input id="bookingSearchFilter" placeholder="Клиент, телефон, Telegram" value="${bookingSearchFilter}" />
          <input id="bookingDateFilter" type="date" value="${bookingDateFilter}" />
          <select id="bookingStatusFilter">
            <option value="">Все статусы</option>
            ${bookingStatuses.map((status) => `<option value="${status}" ${bookingStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <select id="bookingEmployeeFilter">
            <option value="">Все сотрудники</option>
            ${employees.map((employee) => `<option value="${employee.id || employee.name}" ${bookingEmployeeFilter === (employee.id || employee.name) || bookingEmployeeFilter === employee.name ? "selected" : ""}>${employee.name}</option>`).join("")}
          </select>
          <select id="bookingServiceFilter">
            <option value="">Все услуги</option>
            ${services.map((service) => `<option value="${service.id || service.name}" ${bookingServiceFilter === (service.id || service.name) || bookingServiceFilter === service.name ? "selected" : ""}>${service.name}</option>`).join("")}
          </select>
        </div>
        <div class="booking-list">
          ${bookings.map(renderBookingCard).join("") || renderEmptyState("Пока нет записей", "Создай первую запись из календаря или кнопкой ниже.", "Создать первую запись", 'type="button" data-action="openBookingModal"')}
        </div>
      </section>
      ${renderBookingForm()}
    </div>
  `;
}

function renderBookingCard(booking) {
  const employee = employeeByName(booking.employee);
  const color = employee?.color || "#ff6633";
  const canConfirm = booking.status === "заявка";
  const canStart = ["заявка", "подтверждено"].includes(booking.status);
  const canComplete = booking.status !== "завершено" && booking.status !== "отменено";
  const canCancel = booking.status !== "завершено" && booking.status !== "отменено";
  return `
    <article class="booking-card ${selectedBookingId === booking.id ? "selected" : ""}" data-open-booking="${booking.id}" style="--employee-color:${color}">
      <div class="booking-card-head">
        <div>
          <h3><span class="service-icon">${serviceIcon(booking.service)}</span>${booking.client || "Без имени"}</h3>
          <span class="muted">${formatDate(booking.date)} в ${booking.time} · ${booking.duration}</span>
        </div>
        <span class="status-pill status-${booking.status.replaceAll(" ", "-")}">${statusTitle(booking.status)}</span>
      </div>
      <div class="booking-meta">
        <span>${booking.phone || "телефон не указан"}</span>
        <span>${booking.telegram || "telegram не указан"}</span>
        <span>${booking.employee || "сотрудник не указан"}</span>
      </div>
      <div class="booking-service">
        <span class="pill">${booking.service}</span>
        <strong>${money(booking.amount)}</strong>
      </div>
      ${booking.comment ? `<p class="muted booking-comment">${booking.comment}</p>` : ""}
      <div class="row-actions booking-actions">
        ${canConfirm ? `<button class="btn secondary" data-booking-status="${booking.id}" data-status="подтверждено">Подтвердить</button>` : ""}
        ${canStart ? `<button class="btn secondary" data-booking-status="${booking.id}" data-status="в процессе">Начать</button>` : ""}
        ${canComplete ? `<button class="btn" data-booking-status="${booking.id}" data-status="завершено">Завершить</button>` : ""}
        ${canCancel ? `<button class="btn danger" data-booking-status="${booking.id}" data-status="отменено">Отменить</button>` : ""}
        <button class="icon-btn" title="Редактировать" data-edit-booking="${booking.id}">✎</button>
        ${isAdmin() ? `<button class="icon-btn" title="Удалить" data-delete-booking="${booking.id}">×</button>` : ""}
      </div>
    </article>
  `;
}

function renderBookingForm() {
  const booking = state.bookings.find((item) => item.id === editingBookingId) || {};
  const selectedService = booking.serviceName || booking.service || catalogServices()[0]?.name || "";
  const selectedServiceItem = serviceById(booking.serviceId) || serviceByName(selectedService) || catalogServices()[0] || {};
  const selectedCategoryId = booking.serviceCategoryId || selectedServiceItem.categoryId || catalogGroups()[0]?.id || "";
  const selectableBookingServices = catalogServices().filter((service) => service.categoryId === selectedCategoryId && (service.active !== false || service.name === selectedService));
  const priceRule = servicePriceRule(selectedService);
  const fieldLocks = serviceFieldLocks(selectedServiceItem);
  const amountValue = fieldLocks.price ? selectedServiceItem.price : booking.amount || priceRule.price || "";
  const durationValue = fieldLocks.duration ? selectedServiceItem.duration : booking.duration || selectedServiceItem.duration || "1 час";
  const defaultUser = currentUser()?.name || state.users[0]?.name || "";
  const employeeOptions = bookingEmployeeOptions(booking.employee || defaultUser);

  return `
    <section class="card section">
      <h2>${editingBookingId ? "Редактировать запись" : "Добавить запись"}</h2>
      <form id="bookingForm" class="form-grid">
        <input type="hidden" name="id" value="${booking.id || ""}" />
        <div class="field">
          <label>Имя клиента</label>
          <div class="client-picker">
            <input name="client" id="clientInput" autocomplete="off" required value="${booking.client || ""}" />
            <div class="client-suggestions" id="clientSuggestions"></div>
          </div>
        </div>
        <div class="field">
          <label>Телефон</label>
          <input name="phone" value="${booking.phone || ""}" />
        </div>
        <div class="field">
          <label>Telegram</label>
          <input name="telegram" value="${booking.telegram || ""}" />
        </div>
        <div class="field">
          <label>Категория услуги</label>
          <select name="categoryId" id="categorySelect" required>
            ${catalogGroups().map((group) => `<option value="${group.id}" ${selectedCategoryId === group.id ? "selected" : ""}>${group.name}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Услуга</label>
          <select name="serviceId" id="serviceSelect" required>
            ${selectableBookingServices.map((service) => `<option value="${service.id}" ${(selectedServiceItem.id || booking.serviceId) === service.id ? "selected" : ""}>${service.name}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Дата</label>
          <input name="date" type="date" required value="${booking.date || todayKey()}" />
        </div>
        <div class="field">
          <label>Время</label>
          <input name="time" type="time" required value="${booking.time || "12:00"}" />
        </div>
        <div class="field">
          <label>Длительность</label>
          <input name="duration" id="bookingInlineDurationInput" class="${fieldLocks.duration ? "catalog-locked" : ""}" value="${durationValue}" ${fieldLocks.duration ? "readonly" : ""} />
        </div>
        <div class="field">
          <label>Стоимость</label>
          <input name="amount" id="amountInput" class="${fieldLocks.price ? "catalog-locked" : ""}" type="number" min="${priceRule.min}" step="1" required value="${amountValue}" ${fieldLocks.price ? "readonly" : ""} />
          <span class="field-note" id="priceHint">${priceRule.hint}</span>
          <span class="field-note ${fieldLocks.price || fieldLocks.duration ? "locked" : ""}" data-service-lock-hint>${serviceLockHint(selectedServiceItem)}</span>
        </div>
        <div class="field">
          <label>Сотрудник</label>
          <select name="employeeId">${employeeOptions.map((user) => `<option value="${user.id}" ${((booking.employeeId || "") === user.id || (booking.employee || defaultUser) === user.name) ? "selected" : ""}>${user.name}${user.active === false ? " · неактивен" : ""}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Статус</label>
          <select name="status">${bookingStatuses.map((status) => `<option value="${status}" ${((booking.status || "подтверждено") === status) ? "selected" : ""}>${statusTitle(status)}</option>`).join("")}</select>
        </div>
        <div class="field full">
          <label>Комментарий</label>
          <textarea name="comment">${booking.comment || ""}</textarea>
        </div>
        <button class="btn" type="submit">${editingBookingId ? "Сохранить" : "Добавить"}</button>
        ${editingBookingId ? '<button class="btn secondary" type="button" data-action="cancelBookingEdit">Отмена</button>' : ""}
      </form>
    </section>
  `;
}

function renderPayments() {
  const payments = filteredPayments();
  const formTitle = editingPaymentId ? "Редактировать оплату" : "Новая оплата";
  const payment = state.payments.find((item) => item.id === editingPaymentId) || {};
  const selectedService = payment.service || catalogServices()[0]?.name || "";
  const selectablePaymentServices = catalogServices().filter((service) => service.active !== false || service.name === selectedService);
  const priceRule = servicePriceRule(selectedService);
  const amountValue = payment.amount || priceRule.price || "";
  const defaultUser = currentUser()?.name || state.users[0]?.name || "";
  const selectedSoundEngineer = payment.soundEngineer || payment.employee || defaultUser;
  const selectedPerformer = payment.performer || payment.employee || defaultUser;
  const selectedBookingForPayment = payment.bookingId || "";

  return `
    <div class="grid two-col">
      <section class="card section">
        <div class="toolbar">
          <input id="searchPayments" placeholder="Поиск по клиенту, услуге, исполнителю или звукорежу" value="${clientFilter}" />
        </div>
        ${
          payments.length
            ? `<div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Дата</th><th>Клиент</th><th>Услуга</th><th>Сумма</th><th>Оплата</th><th>Исполнитель / звукореж</th><th></th>
                    </tr>
                  </thead>
                  <tbody>${payments.map(renderPaymentRow).join("")}</tbody>
                </table>
              </div>`
            : renderEmptyState("Пока нет платежей", "Платёж появится автоматически после завершения записи или может быть внесён вручную.", "Создать запись", 'type="button" data-action="openBookingModal"')
        }
      </section>
      <section class="card section">
        <h2>${formTitle}</h2>
        <form id="paymentForm" class="form-grid">
          <input type="hidden" name="id" value="${payment.id || ""}" />
          <div class="field">
            <label>Дата</label>
            <input name="date" type="date" required value="${payment.date || new Date().toISOString().slice(0, 10)}" />
          </div>
          <div class="field">
            <label>Клиент</label>
            <div class="client-picker">
              <input name="client" id="clientInput" autocomplete="off" required value="${payment.client || ""}" />
              <div class="client-suggestions" id="clientSuggestions"></div>
            </div>
          </div>
          <div class="field full">
            <label>Запись</label>
            <select name="bookingId">
              <option value="">Ручной доход без записи</option>
              ${state.bookings.map((booking) => `<option value="${booking.id}" ${selectedBookingForPayment === booking.id ? "selected" : ""}>${formatDate(booking.date)} ${booking.time} · ${booking.client || "Без имени"} · ${booking.service}</option>`).join("")}
            </select>
          </div>
          <div class="field full">
            <label>Услуга</label>
            <select name="service" id="serviceSelect" required>
              ${catalogGroups()
                .map((group) => {
                  const options = selectablePaymentServices
                    .filter((service) => service.categoryId === group.id)
                    .map((service) => `<option value="${service.name}" ${selectedService === service.name ? "selected" : ""}>${service.name}</option>`)
                    .join("");
                  return options ? `<optgroup label="${group.name}">${options}</optgroup>` : "";
                })
                .join("")}
            </select>
          </div>
          <div class="field">
            <label>Сумма</label>
            <input name="amount" id="amountInput" type="number" min="${priceRule.min}" step="1" required value="${amountValue}" ${priceRule.mode === "fixed" ? "readonly" : ""} />
            <span class="field-note" id="priceHint">${priceRule.hint}</span>
          </div>
          <div class="field">
            <label>Способ оплаты</label>
            <select name="method">
              ${["Наличные", "Перевод", "Карта", "СБП", "Другое"].map((method) => `<option ${payment.method === method ? "selected" : ""}>${method}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Звукореж</label>
            <select name="soundEngineer">${state.users.map((user) => `<option ${selectedSoundEngineer === user.name ? "selected" : ""}>${user.name}</option>`).join("")}</select>
            <span class="field-note">Для записи, сведения и бита на студии.</span>
          </div>
          <div class="field">
            <label>Исполнитель</label>
            <select name="performer">${state.users.map((user) => `<option ${selectedPerformer === user.name ? "selected" : ""}>${user.name}</option>`).join("")}</select>
            <span class="field-note">Для онлайн-услуг и выплат исполнителю.</span>
          </div>
          <div class="field full">
            <label>Комментарий</label>
            <textarea name="comment">${payment.comment || ""}</textarea>
          </div>
          <button class="btn" type="submit">${editingPaymentId ? "Сохранить" : "Добавить"}</button>
          ${editingPaymentId ? '<button class="btn secondary" type="button" data-action="cancelEdit">Отмена</button>' : ""}
        </form>
      </section>
    </div>
  `;
}

function paymentTeamSummary(payment) {
  const label = paymentTeamLabel(payment);
  return label ? label.replaceAll(" · ", "<br>") : '<span class="muted">не указан</span>';
}

function paymentTeamLabel(payment) {
  const parts = [];
  if (payment.soundEngineer) parts.push(`Звукореж: ${payment.soundEngineer}`);
  if (payment.performer) parts.push(`Исполнитель: ${payment.performer}`);
  if (!parts.length && payment.employee) parts.push(payment.employee);
  return parts.join(" · ");
}

function renderPaymentRow(item) {
  const booking = bookingForPayment(item);
  return `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td><strong>${item.client}</strong><br><span class="muted">${item.comment || ""}</span>${booking ? `<br><button class="link-button inline-link" data-open-booking="${booking.id}">Запись ${formatDate(booking.date)} ${booking.time}</button>` : '<br><span class="muted">ручной доход</span>'}</td>
      <td><span class="pill">${item.service}</span></td>
      <td><strong>${money(Number(item.amount))}</strong></td>
      <td>${item.method}</td>
      <td>${paymentTeamSummary(item)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Редактировать" data-edit="${item.id}">✎</button>
          ${isAdmin() ? `<button class="icon-btn" title="Удалить" data-delete="${item.id}">×</button>` : ""}
        </div>
      </td>
    </tr>
  `;
}

function filteredPayments() {
  const q = clientFilter.trim().toLowerCase();
  return [...state.payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((item) => !q || [item.client, item.service, item.employee, item.soundEngineer, item.performer, item.method, item.comment].some((value) => String(value || "").toLowerCase().includes(q)));
}

function renderClients() {
  const clientNames = [...new Set([
    ...state.clients.map((item) => item.name),
    ...state.payments.map((item) => item.client),
    ...state.bookings.map((item) => item.client)
  ].map((name) => String(name || "").trim()).filter(Boolean))];
  const clients = clientNames
    .map((name) => [name, clientStats(name).total])
    .sort((a, b) => sortClients(a[0], b[0], a[1], b[1]))
    .filter(([name]) => !clientFilter || name.toLowerCase().includes(clientFilter.toLowerCase()));
  if (selectedClientName) return renderClientDetail(selectedClientName);

  return `
    <section class="card section">
      <div class="toolbar">
        <input id="searchPayments" placeholder="Найти клиента" value="${clientFilter}" />
        <select id="clientSort">
          <option value="last" ${clientSortMode === "last" ? "selected" : ""}>Сначала последние</option>
          <option value="total" ${clientSortMode === "total" ? "selected" : ""}>По сумме</option>
          <option value="visits" ${clientSortMode === "visits" ? "selected" : ""}>По посещениям</option>
          <option value="name" ${clientSortMode === "name" ? "selected" : ""}>По имени</option>
        </select>
      </div>
      <div class="client-card-grid">
        ${clients
          .map(([name, total]) => renderClientCard(name, total))
          .join("") || renderEmptyState("Пока нет клиентов", "Клиенты появятся автоматически из записей и платежей.", "Создать запись", 'type="button" data-action="openBookingModal"')}
      </div>
    </section>
  `;
}

function sortClients(nameA, nameB, totalA, totalB) {
  const statsA = clientStats(nameA);
  const statsB = clientStats(nameB);
  if (clientSortMode === "total") return totalB - totalA;
  if (clientSortMode === "visits") return statsB.visits - statsA.visits;
  if (clientSortMode === "name") return nameA.localeCompare(nameB);
  return String(statsB.lastDate || "").localeCompare(String(statsA.lastDate || ""));
}

function renderClientCard(name, total) {
  const stats = clientStats(name);
  const client = state.clients.find((item) => item.name === name) || {};
  const lastLabel = stats.lastDate ? formatDate(stats.lastDate) : "пока нет";
  return `
    <button class="client-card" data-client="${encodeURIComponent(name)}">
      <span class="avatar client-avatar">${initials(name)}</span>
      <div>
        <h3>${name}</h3>
        <span class="muted">${client.phone || "телефон не указан"} · ${client.telegram || "telegram не указан"}</span>
        <div class="client-card-stats">
          <span>Посещений: <strong>${stats.visits}</strong></span>
          <span>Сумма: <strong>${money(total)}</strong></span>
          <span>Последнее: <strong>${lastLabel}</strong></span>
        </div>
      </div>
    </button>
  `;
}

function renderClientDetail(name) {
  const stats = clientStats(name);
  const history = stats.payments.sort((a, b) => b.date.localeCompare(a.date));
  const bookingHistory = stats.bookings.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const total = stats.total;
  const client = state.clients.find((item) => item.name === name) || {};

  if (!history.length && !bookingHistory.length) {
    selectedClientName = null;
    return renderClients();
  }

  return `
    <section class="card section">
      <div class="toolbar client-toolbar">
        <button class="btn secondary" type="button" data-action="backToClients">Назад</button>
        <input id="searchPayments" placeholder="Найти клиента" value="${clientFilter}" />
      </div>
      <div class="client-profile">
        <div>
          <h2>${name}</h2>
          <p class="muted">Последний визит: ${stats.lastDate ? formatDate(stats.lastDate) : "пока нет"}. Общая сумма оплат: ${money(total)}.</p>
          <p class="muted">${client.phone || "телефон не указан"} · ${client.telegram || "telegram не указан"}</p>
        </div>
        <div class="client-profile-stats">
          <article><span>Оплаты</span><strong>${money(total)}</strong></article>
          <article><span>Посещений</span><strong>${stats.visits}</strong></article>
          <article><span>Записей</span><strong>${bookingHistory.length}</strong></article>
        </div>
      </div>
      <h3>История записей клиента</h3>
      <div class="booking-list client-booking-history">
        ${bookingHistory.map(renderBookingCard).join("") || '<p class="muted">Записей пока нет</p>'}
      </div>
      <h3>История оплат</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
                <th>Дата</th><th>Услуга</th><th>Сумма</th><th>Оплата</th><th>Исполнитель / звукореж</th><th>Комментарий</th>
            </tr>
          </thead>
          <tbody>
            ${history
              .map(
                (item) => `
                  <tr>
                    <td>${formatDate(item.date)}</td>
                    <td><span class="pill">${item.service}</span></td>
                    <td><strong>${money(item.amount)}</strong></td>
                    <td>${item.method}</td>
                    <td>${paymentTeamSummary(item)}</td>
                    <td>${item.comment || '<span class="muted">нет</span>'}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBudget() {
  const budget = calculateBudget();
  const walletEntries = budgetWallets.map((wallet) => [wallet, budget.wallets[wallet]]);
  const outsideEntries = sortedEntries(budget.outside);
  const payoutTotals = payoutTotalsFromBudget(budget);
  const outsideRows = [
    ...outsideEntries,
    ["Выплачено", payoutTotals.paid],
    ["Запланировано", payoutTotals.planned],
    ["Доступно к выплате", payoutTotals.available]
  ].filter(([label, value]) => value > 0 || label === "Доступно к выплате");

  return `
    <div class="budget-page">
      <div class="budget-wallets">
        ${walletEntries.map(([wallet, total], index) => renderBudgetWalletCard(wallet, total, index)).join("")}
      </div>
      <div class="budget-main-grid">
        <section class="card section">
          <h2>Копилки</h2>
          ${renderBudgetProgress(walletEntries)}
        </section>
        <section class="card section">
          <div class="section-head">
            <h2>Выплаты вне копилок</h2>
            <button class="btn payout-button" type="button" data-action="openPayout">Выплатить</button>
          </div>
          ${renderBudgetPayouts(outsideRows)}
          ${renderPayoutHistory()}
        </section>
      </div>
      <section class="card section budget-rules-section">
        <h2>Правила распределения</h2>
        <div class="budget-rule-grid">
          ${Object.values(budgetRules)
            .filter((rule) => rule !== budgetRules.unknown)
            .map(renderBudgetRule)
            .join("")}
        </div>
      </section>
      <section class="card section budget-table-card">
        <h2>Расшифровка по платежам</h2>
        ${budget.rows.length
          ? `<div class="table-wrap">
              <table class="budget-table">
                <thead>
                  <tr>
                    <th>Дата</th><th>Клиент</th><th>Услуга</th><th>Сумма</th><th>Распределение</th><th>Вне копилок</th><th></th>
                  </tr>
                </thead>
                <tbody>${budget.rows.map(renderBudgetRow).join("")}</tbody>
              </table>
            </div>`
          : renderEmptyState("Платежей пока нет", "После завершения записи доход попадёт сюда автоматически.")}
      </section>
    </div>
  `;
}

function renderFinance() {
  const income = state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const expenses = (state.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paidPayouts = (state.payouts || []).filter((payout) => payout.status === "Выплачено").reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
  const budget = calculateBudget();
  const profit = income - expenses - paidPayouts;

  return `
    <div class="grid stats dashboard-stats">
      ${renderMetricCard("Доходы", income, "Все платежи", 0, "за всё время")}
      ${renderMetricCard("Расходы", expenses, "Ручные расходы", 0, "учтено")}
      ${renderMetricCard("Прибыль", profit, "Доходы минус расходы и выплаты", 0, "итог")}
      ${renderMetricCard("Выплаты", paidPayouts, "Выплачено", 0, "команде")}
    </div>
    <div class="grid two-col" style="margin-top:16px">
      <section class="card section">
        <h2>Добавить расход</h2>
        <form id="expenseForm" class="form-grid">
          <div class="field"><label>Дата</label><input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field"><label>Название</label><input name="title" required placeholder="Аренда, расходники, реклама" /></div>
          <div class="field"><label>Сумма</label><input name="amount" type="number" min="1" step="1" required /></div>
          <div class="field full"><label>Комментарий</label><textarea name="comment"></textarea></div>
          <button class="btn" type="submit">Сохранить расход</button>
        </form>
      </section>
      <section class="card section">
        <h2>Бюджет / копилки</h2>
        ${renderBudgetProgress(budgetWallets.map((wallet) => [wallet, budget.wallets[wallet]]))}
      </section>
      <section class="card section wide-card">
        <h2>Последние расходы</h2>
        <div class="list">
          ${(state.expenses || []).slice(-8).reverse().map((expense) => `<div class="list-item"><span>${formatDate(expense.date)} · ${expense.title}<br><span class="muted">${expense.comment || ""}</span></span><strong>${money(expense.amount)}</strong></div>`).join("") || renderEmptyState("Пока нет расходов", "Добавь первый расход, чтобы видеть чистую прибыль точнее.")}
        </div>
      </section>
    </div>
  `;
}

function renderPayouts() {
  const employeeStats = allEmployeePayoutStats();
  const warnings = financialWarnings();
  const payoutHistory = [...(state.payouts || [])].sort((a, b) => payoutDateValue(b).localeCompare(payoutDateValue(a)));
  const filteredHistory = payoutHistory.filter(payoutMatchesFilters);
  const summary = payoutSummary(employeeStats, warnings);
  const hasCompletedBookings = employeeStats.some((stats) => stats.completedBookingsCount > 0);
  return `
    <section class="payouts-page">
      <section class="card section payout-summary-section">
        <div class="section-head"><div><h2>Сводка выплат</h2><p class="muted">Текущее состояние расчётов с командой.</p></div><span class="select-chip">${summary.payableEmployees} к выплате</span></div>
        ${renderPayoutSummary(summary)}
      </section>
      <section class="card section">
        <div class="section-head">
          <div><h2>Расчёты с сотрудниками</h2><p class="muted">Заработок считается по завершённым записям.</p></div>
          <button class="btn payout-button" type="button" data-action="openPayout">Новая выплата</button>
        </div>
        ${employeeStats.length && !hasCompletedBookings ? '<div class="payout-accrual-empty"><strong>Пока нет завершённых услуг — начислений сотрудникам нет.</strong></div>' : ""}
        <div class="employee-payout-grid">
          ${employeeStats.map((stats) => renderEmployeePayoutCard(stats, warnings)).join("") || renderEmptyState("Нет сотрудников", "Добавьте сотрудников в настройках, чтобы считать выплаты.")}
        </div>
      </section>
      <section class="card section">
        <div class="section-head"><h2>Финансовые предупреждения</h2><span class="select-chip">${warnings.length}</span></div>
        ${renderFinancialWarnings(warnings)}
      </section>
      <section class="card section">
        <div class="section-head"><h2>История выплат</h2><span class="muted">Все статусы сохранены</span></div>
        ${renderPayoutFilters()}
        ${renderPayoutRows(filteredHistory, payoutHistory.length)}
      </section>
    </section>
  `;
}

function renderPayoutSummary(summary) {
  const items = [
    ["Заработано", money(summary.totalEarned), ""],
    ["Выплачено", money(summary.totalPaid), ""],
    ["Запланировано", money(summary.totalPlanned), ""],
    ["Доступно", money(summary.availableToPay), "accent"],
    ["Переплата", money(summary.overpaid), summary.overpaid > 0 ? "warning" : ""],
    ["Сотрудников к выплате", summary.payableEmployees, ""],
    ["Предупреждений", summary.warningsCount, summary.warningsCount > 0 ? "warning" : ""]
  ];
  return `<div class="payout-summary-grid">${items.map(([label, value, className]) => `<article class="${className}"><span>${label}</span><strong>${value}</strong></article>`).join("")}</div>`;
}

function renderPayoutFilters() {
  const employees = state.users || [];
  return `
    <div class="payout-filters">
      <label><span>Сотрудник</span><select id="payoutEmployeeFilter"><option value="">Все сотрудники</option>${employees.map((employee) => `<option value="${employee.id}" ${payoutEmployeeFilter === employee.id ? "selected" : ""}>${employee.name}</option>`).join("")}</select></label>
      <label><span>Статус</span><select id="payoutStatusFilter">
        <option value="">Все статусы</option>
        ${["Выплачено", "Запланировано", "Отменено", "Без статуса"].map((status) => `<option value="${status}" ${payoutStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
      </select></label>
      <label><span>Период</span><select id="payoutPeriodFilter">
        ${[["all", "Всё время"], ["today", "Сегодня"], ["week", "Эта неделя"], ["month", "Этот месяц"]].map(([value, label]) => `<option value="${value}" ${payoutPeriodFilter === value ? "selected" : ""}>${label}</option>`).join("")}
      </select></label>
      <label><span>Проблемные</span><select id="payoutProblemsFilter"><option value="all" ${!payoutProblemsOnly ? "selected" : ""}>Все выплаты</option><option value="problems" ${payoutProblemsOnly ? "selected" : ""}>Только проблемные</option></select></label>
      <button class="btn secondary" type="button" data-action="resetPayoutFilters">Сбросить</button>
    </div>
  `;
}

function renderEmployeePayoutCard(stats, warnings = []) {
  const { employee, completedBookingsCount, totalEarned, totalPaid, totalPlanned, availableToPay, overpaid, lastPayoutDate, lastPayoutAmount } = stats;
  const employeeWarnings = warnings.filter((warning) => warning.employeeId === employee.id);
  return `
    <article class="employee-payout-card ${overpaid > 0 ? "has-warning" : ""}" style="--employee-color:${employee.color || "#ff6633"}">
      <div class="employee-payout-head">
        <span class="avatar">${initials(employee.name)}</span>
        <div><h3>${employee.name}</h3><small>${employee.position || employee.role || "Сотрудник"}</small></div>
      </div>
      <div class="employee-payout-values">
        <span>Заработано<strong>${money(totalEarned)}</strong></span>
        <span>Выплачено<strong>${money(totalPaid)}</strong></span>
        <span>Запланировано<strong>${money(totalPlanned)}</strong></span>
        <span class="available">Доступно<strong>${money(availableToPay)}</strong></span>
        <span>Завершено записей<strong>${completedBookingsCount}</strong></span>
        <span>Последняя выплата<strong>${lastPayoutDate ? `${formatDate(lastPayoutDate.slice(0, 10))} · ${money(lastPayoutAmount)}` : "не было"}</strong></span>
      </div>
      ${overpaid ? `<p class="payout-warning">Переплата относительно завершённых записей: ${money(overpaid)}</p>` : ""}
      ${employeeWarnings.length ? `<p class="payout-warning">${employeeWarnings.length} ${plural(employeeWarnings.length, "предупреждение", "предупреждения", "предупреждений")} по расчётам.</p>` : ""}
      ${!completedBookingsCount ? `<p class="muted payout-card-empty">Нет завершённых записей.</p>` : ""}
      <div class="employee-payout-actions">
        <button class="btn" type="button" data-open-employee-payout="${employee.id}" ${availableToPay <= 0 || overpaid > 0 ? "disabled" : ""}>Выплатить</button>
        <button class="btn secondary" type="button" data-payout-filter-employee="${employee.id}">История</button>
        <button class="btn secondary" type="button" data-open-employee-bookings="${employee.id}">Записи</button>
      </div>
    </article>
  `;
}

function renderFinancialWarnings(warnings) {
  if (!warnings.length) return '<div class="finance-warning-empty"><strong>Финансовых предупреждений нет.</strong><span>Связи записей, платежей и выплат выглядят корректно.</span></div>';
  return `
    <div class="finance-warning-list">
      ${warnings.map((warning) => `
        <article class="finance-warning-item level-${warning.level}">
          <span class="finance-warning-icon">${warning.level === "info" ? "i" : "!"}</span>
          <div>
            <span class="finance-warning-level">${warning.level === "critical" ? "Критично" : warning.level === "info" ? "Информация" : "Предупреждение"}</span>
            <strong>${warning.type}</strong>
            <small><b>${warning.action === "booking" ? "Запись" : warning.action === "payment" ? "Платёж" : warning.action === "payout" ? "Выплата" : warning.action === "employee" ? "Сотрудник" : "Данные"}</b> · ${warning.description}${warning.date ? ` · ${formatDate(String(warning.date).slice(0, 10))}` : ""}</small>
          </div>
          ${warning.amount !== null ? `<b>${money(warning.amount)}</b>` : ""}
          ${warning.action === "booking" ? `<button class="btn secondary" type="button" data-open-booking="${warning.targetId}">Открыть</button>` : ""}
          ${warning.action === "payment" ? `<button class="btn secondary" type="button" data-open-payment="${warning.targetId}">Открыть</button>` : ""}
          ${warning.action === "payout" ? `<button class="btn secondary" type="button" data-open-payout="${warning.targetId}">Открыть</button>` : ""}
          ${warning.action === "employee" ? `<button class="btn secondary" type="button" data-open-employee-settings="${warning.targetId}">Сотрудник</button>` : ""}
          ${!warning.action ? '<span class="finance-warning-manual">Проверьте вручную</span>' : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function renderPayoutRows(payouts, totalCount = payouts.length) {
  return `
    <div class="list">
      ${payouts.map((payout) => {
        const problems = payoutDataProblems(payout);
        const date = payoutDateValue(payout);
        const employee = (state.users || []).find((item) => item.id === payout.employeeId);
        const canRepeat = employee && employeePayoutStats(employee.id).availableToPay > 0 && employeePayoutStats(employee.id).overpaid <= 0;
        return `<div class="list-item payout-list-item ${problems.length ? "has-warning" : ""} ${highlightedPayoutId === payout.id ? "selected" : ""}" data-payout-row="${payout.id}">
          <span>${formatDate(date.slice(0, 10))} · ${payout.employeeName || payout.recipient || "Получатель не указан"}<br>
            <span class="muted payout-comment" title="${payout.comment || ""}">${payout.method || "способ не указан"}${payout.comment ? ` · ${payout.comment}` : ""}${payout.createdBy ? ` · создал ${payout.createdBy}` : ""}</span>
            ${Number.isFinite(Number(payout.remainingAfter)) ? `<br><small class="muted">Остаток после выплаты: ${money(payout.remainingAfter)}</small>` : ""}
            ${problems.length ? `<br><small class="payout-row-warning">Проблема: ${problems.join(", ")}</small>` : ""}
            <span class="payout-row-actions">
              ${canRepeat ? `<button class="link-button" type="button" data-repeat-payout="${payout.id}">Повторить выплату</button>` : ""}
              ${employee ? `<button class="link-button" type="button" data-payout-filter-employee="${employee.id}">Фильтр по сотруднику</button><button class="link-button" type="button" data-open-employee-settings="${employee.id}">Открыть сотрудника</button>` : ""}
              ${payout.status === "Запланировано" ? `<button class="link-button danger-text" type="button" data-cancel-payout="${payout.id}">Отменить выплату</button>` : ""}
            </span>
          </span>
          <span class="payout-row-meta"><em class="status-pill">${payout.status || "Выплачено"}</em><strong>${money(payout.amount)}</strong></span>
        </div>`;
      }).join("") || (totalCount ? renderEmptyState("По фильтрам ничего не найдено", "Измени фильтры или сбрось их, чтобы увидеть историю.") : renderEmptyState("История выплат пока пустая", "Первая выплата появится здесь после сохранения."))}
    </div>
  `;
}

function renderBudgetWalletCard(wallet, total, index) {
  const icons = ["◎", "♙", "♙", "♙", "♙"];
  return `
    <article class="card budget-wallet-card ${index === 0 ? "primary" : ""}">
      <div>
        <span>${wallet}</span>
        <strong>${money(total)}</strong>
      </div>
      <i>${icons[index]}</i>
    </article>
  `;
}

function renderBudgetProgress(entries) {
  const max = Math.max(...entries.map(([, total]) => total), 1);
  return `
    <div class="budget-progress-list">
      ${entries
        .map(
          ([label, total]) => `
            <div class="budget-progress-row">
              <span>${label}</span>
              <div class="budget-progress-track"><div style="width:${Math.max(5, (total / max) * 100)}%"></div></div>
              <strong>${money(total)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderBudgetPayouts(entries) {
  return `
    <div class="budget-payout-list">
      ${entries.map(([label, total]) => `<div class="${label === "Доступно к выплате" ? "available-row" : ""}"><span>${label}</span><strong>${money(total)}</strong></div>`).join("") || '<p class="muted">Выплат пока нет</p>'}
    </div>
  `;
}

function renderPayoutHistory() {
  const payouts = [...(state.payouts || [])].sort((a, b) => payoutDateValue(b).localeCompare(payoutDateValue(a))).slice(0, 4);
  if (!payouts.length) return '<p class="muted payout-empty">Журнал выплат пока пуст</p>';
  return `
    <div class="payout-history">
      <h3>Последние выплаты</h3>
      ${payouts
        .map(
          (payout) => `
            <div class="payout-history-row">
              <span>${formatDate(payoutDateValue(payout).slice(0, 10))}</span>
              <strong>${payout.employeeName || payout.recipient || "Получатель не указан"}<small>${payout.service || "Выплата сотруднику"}</small></strong>
              <div class="payout-history-amount">
                <em>${money(payout.amount)}</em>
                <b class="payout-status">${payout.status || "Выплачено"}</b>
                ${
                  payout.status === "Запланировано"
                    ? `<button class="mini-confirm" type="button" title="Подтвердить выплату" data-confirm-payout="${payout.id}">✓</button><button class="mini-cancel" type="button" title="Убрать из плана" data-cancel-payout="${payout.id}">×</button>`
                    : ""
                }
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function localDateTimeValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function payoutAmountForService(serviceName, payoutType) {
  const catalogItem = serviceByName(serviceName) || migrationServiceCatalog.find((item) => item.name === serviceName);
  const rule = budgetRules[catalogItem?.category || classifyService(serviceName)];
  const amount = catalogItem?.price || rule?.base || 0;
  if (payoutType === "Исполнитель") return Math.round(amount * 0.4);
  if (rule?.soundRate) return serviceHours({ service: serviceName, amount }, rule) * rule.soundRate;
  return 0;
}

function renderPayoutModal() {
  const statsList = allEmployeePayoutStats();
  const selectedStats = statsList.find((stats) => stats.employee?.id === payoutEmployeeIdDraft) || statsList.find((stats) => stats.availableToPay > 0) || statsList[0] || employeePayoutStats("");
  const selectedEmployeeId = selectedStats.employee?.id || "";
  const available = selectedStats.availableToPay || 0;
  return `
    <div class="modal-backdrop" data-action="closePayout">
      <section class="card modal" role="dialog" aria-modal="true" aria-label="Новая выплата">
        <div class="modal-head">
          <div>
            <h2>Новая выплата</h2>
            <p class="muted">Сумма ограничена заработком по завершённым записям.</p>
          </div>
          <button class="icon-btn" type="button" data-action="closePayout">×</button>
        </div>
        <form id="payoutForm" class="form-grid">
          <div class="field full">
            <label>Сотрудник</label>
            <select name="employeeId" id="payoutEmployee" required>
              ${statsList.map((stats) => `<option value="${stats.employee.id}" ${stats.employee.id === selectedEmployeeId ? "selected" : ""}>${stats.employee.name} · доступно ${money(stats.availableToPay)}</option>`).join("")}
            </select>
          </div>
          <div class="payout-form-summary full">
            <span>Заработано<strong id="payoutEarnedValue">${money(selectedStats.totalEarned)}</strong></span>
            <span>Уже выплачено<strong id="payoutPaidValue">${money(selectedStats.totalPaid)}</strong></span>
            <span>Запланировано<strong id="payoutPlannedValue">${money(selectedStats.totalPlanned)}</strong></span>
            <span class="available">Доступно<strong id="payoutAvailableValue">${money(available)}</strong></span>
            <span>Переплата<strong id="payoutOverpaidValue">${money(selectedStats.overpaid)}</strong></span>
            <span>Последняя выплата<strong id="payoutLastValue">${selectedStats.lastPayoutDate ? `${formatDate(selectedStats.lastPayoutDate.slice(0, 10))} · ${money(selectedStats.lastPayoutAmount)}` : "не было"}</strong></span>
          </div>
          <p class="payout-warning full" id="payoutOverpaidHint" ${selectedStats.overpaid <= 0 ? "hidden" : ""}>Есть переплата: ${money(selectedStats.overpaid)}. Новая выплата недоступна.</p>
          <div class="field">
            <label>Сумма</label>
            <input name="amount" id="payoutAmount" type="number" min="1" max="${available}" step="1" required value="${available || ""}" />
            <span class="field-note" id="payoutAvailableHint">${available > 0 ? `Доступно к выплате: ${money(available)}` : "Сейчас выплачивать нечего."}</span>
            <button class="link-button payout-all-button" type="button" data-action="payoutAll" ${available <= 0 ? "disabled" : ""}>Выплатить всё</button>
          </div>
          <div class="field">
            <label>Способ выплаты</label>
            <select name="method">
              <option>Карта</option>
              <option>Наличные</option>
            </select>
          </div>
          <div class="field">
            <label>Дата и время</label>
            <input name="paidAt" type="datetime-local" required value="${localDateTimeValue()}" />
          </div>
          <div class="field">
            <label>Статус</label>
            <select name="status">
              <option>Выплачено</option>
              <option>Запланировано</option>
            </select>
          </div>
          <div class="field full">
            <label>Комментарий</label>
            <textarea name="comment" placeholder="Например: выплата за смены / запись / неделя"></textarea>
          </div>
          <button class="btn" type="submit" ${available <= 0 ? "disabled" : ""}>Сохранить выплату</button>
          <button class="btn secondary" type="button" data-action="closePayout">Отмена</button>
        </form>
      </section>
    </div>
  `;
}

function renderBudgetRule(rule) {
  const walletText = budgetWallets
    .map((wallet) => `<span>${wallet}: ${money((rule.wallets[wallet] || 0) * rule.base)}</span>`)
    .join("");
  const outsideText = Object.entries(rule.outside)
    .map(([label, ratio]) => `<span>${label}: ${money(ratio * rule.base)}</span>`)
    .join("");
  const icons = {
    "Запись": "◉",
    "Аренда": "▣",
    "Услуги онлайн": "◌",
    "Сведение/бит на студии": "≋"
  };
  return `
    <article class="budget-rule-card">
      <i>${icons[rule.title] || "◎"}</i>
      <div>
        <h3>${rule.title}</h3>
        <p class="muted">${rule.note}</p>
        <div class="budget-rule-lines">${walletText}${outsideText}</div>
      </div>
    </article>
  `;
}

function renderBudgetRow({ payment, split }) {
  const walletLines = budgetWallets
    .filter((wallet) => split.wallets[wallet] > 0)
    .map((wallet) => `${wallet}: ${money(split.wallets[wallet])}`)
    .join("<br>");
  const outsideLines = Object.entries(split.outside)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => `${label}: ${money(value)}`)
    .join("<br>");

  return `
    <tr>
      <td>${formatDate(payment.date)}</td>
      <td><strong>${payment.client}</strong></td>
      <td><span class="pill">${split.rule.title}</span><br><span class="muted">${payment.service}</span></td>
      <td><strong>${money(split.amount)}</strong></td>
      <td>${walletLines}</td>
      <td>${outsideLines || '<span class="muted">нет</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Редактировать" data-edit="${payment.id}">✎</button>
          ${isAdmin() ? `<button class="icon-btn danger-icon" title="Удалить" data-delete="${payment.id}">×</button>` : ""}
        </div>
      </td>
    </tr>
  `;
}

function renderReports() {
  const byDay = sortedEntries(groupSum(state.payments, (item) => periodKey(item.date, "day")));
  const byWeek = sortedEntries(groupSum(state.payments, (item) => periodKey(item.date, "week")));
  const byMonth = sortedEntries(groupSum(state.payments, (item) => periodKey(item.date, "month")));
  const byClient = sortedEntries(groupSum(state.payments, (item) => item.client));
  const byEmployee = sortedEntries(groupSum(state.payments, (item) => paymentTeamLabel(item) || "не указан"));
  const paidPayouts = (state.payouts || []).filter((item) => item.status === "Выплачено");
  const plannedPayouts = (state.payouts || []).filter((item) => item.status === "Запланировано");
  const payoutByDay = sortedEntries(groupSum(paidPayouts, (item) => periodKey(item.paidAt.slice(0, 10), "day")));
  const payoutByRecipient = sortedEntries(groupSum(paidPayouts, (item) => item.recipient));
  const recentPayouts = [...paidPayouts].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 8).map((item) => [`${formatDate(item.paidAt.slice(0, 10))} · ${item.recipient} · ${item.service}`, item.amount]);
  const plannedPayoutRows = [...plannedPayouts].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).slice(0, 8).map((item) => [`${formatDate(item.paidAt.slice(0, 10))} · ${item.recipient} · ${item.service}`, item.amount]);

  return `
    <div class="grid two-col">
      <section class="card section"><h2>По дням</h2>${renderList(byDay)}</section>
      <section class="card section"><h2>По неделям</h2>${renderList(byWeek)}</section>
      <section class="card section"><h2>По месяцам</h2>${renderList(byMonth)}</section>
      <section class="card section"><h2>Топ клиентов</h2>${renderBars(byClient)}</section>
      <section class="card section"><h2>Доход по исполнителям / звукорежам</h2>${renderBars(byEmployee)}</section>
      <section class="card section"><h2>Выплаты по дням</h2>${renderList(payoutByDay)}</section>
      <section class="card section"><h2>Выплаты по получателям</h2>${renderBars(payoutByRecipient)}</section>
      <section class="card section"><h2>Последние выплаты</h2>${renderList(recentPayouts)}</section>
      <section class="card section"><h2>Запланированные выплаты</h2>${renderList(plannedPayoutRows)}</section>
    </div>
  `;
}

function renderSettings() {
  if (!isAdmin()) return "";
  return `
    <section class="card section settings-shell">
      <div class="settings-tabs">
        ${[
          ["services", "Каталог услуг"],
          ["employees", "Сотрудники"],
          ["payouts", "Выплаты"],
          ["budget", "Бюджет / копилки"],
          ["general", "Общие настройки"],
          ["profile", "Профиль"]
        ].map(([key, label]) => `<button class="${settingsTab === key ? "active" : ""}" data-settings-tab="${key}">${label}</button>`).join("")}
      </div>
      ${settingsTab === "services" ? renderServiceSettings() : ""}
      ${settingsTab === "employees" ? renderEmployeeSettings() : ""}
      ${settingsTab === "payouts" ? renderSettingsPlaceholder("Выплаты", "Настройки правил выплат будут расширяться здесь. Текущие выплаты доступны в отдельном разделе “Выплаты”.") : ""}
      ${settingsTab === "budget" ? renderSettingsPlaceholder("Бюджет / копилки", "Базовые правила копилок сохранены в текущей логике бюджета. Здесь заложена отдельная вкладка для дальнейшей настройки.") : ""}
      ${settingsTab === "general" ? renderSettingsPlaceholder("Общие настройки", "Общие параметры CRM: профиль студии, уведомления и рабочее время можно будет развивать в этом разделе.") : ""}
      ${settingsTab === "profile" ? renderProfileSettings() : ""}
    </section>
  `;
}

function renderSettingsPlaceholder(title, text) {
  return `
    <div class="settings-grid single">
      <section>
        <h2>${title}</h2>
        <p class="muted">${text}</p>
      </section>
    </div>
  `;
}

function renderServiceSettings() {
  return `
    <div class="settings-grid">
      <section>
        <div class="section-head"><h2>Категории</h2></div>
        <form id="serviceGroupForm" class="form-grid compact-form">
          <input type="hidden" name="id" />
          <div class="field"><label>Название</label><input name="name" required placeholder="Например: Запись" /></div>
          <div class="field"><label>Порядок</label><input name="order" type="number" min="1" step="1" value="${catalogGroups().length + 1}" /></div>
          <button class="btn full" type="submit">Создать категорию</button>
        </form>
        <div class="list settings-list">
          ${catalogGroups().map((group) => `
            <form class="list-item settings-row" data-service-group-row="${group.id}">
              <input name="name" value="${group.name}" />
              <input name="order" type="number" min="1" step="1" value="${group.order}" />
              <button class="icon-btn" title="Сохранить" data-save-service-group="${group.id}" type="button">✓</button>
              <button class="icon-btn" title="Удалить" data-delete-service-group="${group.id}" type="button">×</button>
            </form>
          `).join("")}
        </div>
      </section>
      <section>
        <div class="section-head"><h2>Услуги</h2></div>
        <form id="serviceItemForm" class="form-grid">
          <div class="field"><label>Название</label><input name="name" required placeholder="Запись 1 час" /></div>
          <div class="field"><label>Категория</label><select name="categoryId">${catalogGroups().map((group) => `<option value="${group.id}">${group.name}</option>`).join("")}</select></div>
          <div class="field"><label>Стоимость</label><input name="price" type="number" min="0" step="1" value="0" /></div>
          <div class="field"><label>Длительность</label><input name="duration" value="1 час" /></div>
          <div class="field"><label>Порядок</label><input name="order" type="number" min="1" step="1" value="${catalogServices().length + 1}" /></div>
          <button class="btn" type="submit">Создать услугу</button>
        </form>
        <div class="service-catalog-list">
          ${catalogGroups().map((group) => renderServiceGroupBlock(group)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderServiceGroupBlock(group) {
  const services = catalogServices().filter((service) => service.categoryId === group.id);
  return `
    <article class="catalog-group-card">
      <h3>${group.name}</h3>
      <div class="list">
        ${services.map((service) => `
          <form class="list-item service-edit-row" data-service-item-row="${service.id}">
            <input name="name" value="${service.name}" />
            <select name="categoryId">${catalogGroups().map((item) => `<option value="${item.id}" ${service.categoryId === item.id ? "selected" : ""}>${item.name}</option>`).join("")}</select>
            <input name="price" type="number" min="0" step="1" value="${service.price}" />
            <input name="duration" value="${service.duration}" />
            <input name="order" type="number" min="1" step="1" value="${service.order}" />
            <label class="mini-check"><input name="active" type="checkbox" ${service.active !== false ? "checked" : ""} /> активна</label>
            <button class="icon-btn" title="Сохранить" data-save-service-item="${service.id}" type="button">✓</button>
            <button class="icon-btn" title="Удалить" data-delete-service-item="${service.id}" type="button">×</button>
          </form>
        `).join("") || renderEmptyState("Услуг пока нет", "Добавь первую услугу в эту категорию через форму выше.")}
      </div>
    </article>
  `;
}

function renderEmployeeSettings() {
  return `
    <div class="settings-grid">
      <section>
        <h2>Новый сотрудник</h2>
        <form id="userForm" class="form-grid">
          <div class="field"><label>Имя</label><input name="name" required /></div>
          <div class="field"><label>Должность</label><input name="position" value="Звукорежиссёр" /></div>
          <div class="field"><label>Роль</label><select name="role">${employeeRoles.map((role) => `<option>${role}</option>`).join("")}</select></div>
          <div class="field"><label>Процент</label><input name="percent" type="number" min="0" max="100" step="1" value="0" /></div>
          <div class="field"><label>Фикс. ставка</label><input name="fixedRate" type="number" min="0" step="1" value="0" /></div>
          <div class="field"><label>Цвет календаря</label><input name="color" type="color" value="#ff6633" /></div>
          <div class="field"><label>Телефон</label><input name="phone" /></div>
          <div class="field"><label>Telegram</label><input name="telegram" /></div>
          <div class="field"><label>Логин</label><input name="login" required /></div>
          <div class="field"><label>Пароль</label><input name="password" required /></div>
          <button class="btn full" type="submit">Создать сотрудника</button>
        </form>
      </section>
      <section>
        <h2>Команда</h2>
        <div class="employee-list">
          ${state.users.map(renderEmployeeCard).join("") || renderEmptyState("Сотрудников пока нет", "Создай первого сотрудника, чтобы назначать его на записи.")}
        </div>
      </section>
    </div>
  `;
}

function renderEmployeeCard(user) {
  return `
    <form class="employee-card" data-user-row="${user.id}" style="--employee-color:${user.color || "#ff6633"}">
      <div class="employee-card-head">
        <span class="avatar employee-avatar" style="background:${user.color || "#ff6633"}">${initials(user.name)}</span>
        <div>
          <strong>${user.name}</strong>
          <span>${user.position || "Сотрудник"} · ${user.active === false ? "неактивен" : "активен"}</span>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Имя</label><input name="name" value="${user.name}" /></div>
        <div class="field"><label>Должность</label><input name="position" value="${user.position || ""}" /></div>
        <div class="field"><label>Роль</label><select name="positionRole">${employeeRoles.map((role) => `<option ${((user.position || "") === role) ? "selected" : ""}>${role}</option>`).join("")}</select></div>
        <div class="field"><label>Процент</label><input name="percent" type="number" min="0" max="100" step="1" value="${user.percent || 0}" /></div>
        <div class="field"><label>Фикс. ставка</label><input name="fixedRate" type="number" min="0" step="1" value="${user.fixedRate || 0}" /></div>
        <div class="field"><label>Цвет</label><input name="color" type="color" value="${user.color || "#ff6633"}" /></div>
        <div class="field"><label>Телефон</label><input name="phone" value="${user.phone || ""}" /></div>
        <div class="field"><label>Telegram</label><input name="telegram" value="${user.telegram || ""}" /></div>
        <div class="field"><label>Доступ</label><select name="role"><option value="staff" ${user.role !== "admin" ? "selected" : ""}>Сотрудник</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>Админ</option></select></div>
        <label class="check-row"><input name="active" type="checkbox" ${user.active !== false ? "checked" : ""} /> активен</label>
      </div>
      <div class="actions">
        <button class="btn secondary" type="button" data-save-user="${user.id}">Сохранить</button>
        ${user.id !== currentUser().id ? `<button class="btn danger" type="button" data-remove-user="${user.id}">Удалить</button>` : ""}
      </div>
    </form>
  `;
}

function renderProfileSettings() {
  return `
    <div class="settings-grid single">
      <section>
        <h2>Профиль администратора</h2>
        <p class="muted">Отображаемое имя администратора во всём интерфейсе: <strong>AE XL</strong>.</p>
        <div class="list">
          <div class="list-item"><span>Текущий пользователь</span><strong>${currentUser().name}</strong></div>
          <div class="list-item"><span>Роль</span><strong>${isAdmin() ? "администратор" : "сотрудник"}</strong></div>
        </div>
      </section>
    </div>
  `;
}

function renderList(entries) {
  return `<div class="list">${entries.map(([label, total]) => `<div class="list-item"><span>${label}</span><strong>${money(total)}</strong></div>`).join("") || renderEmptyState("Данных пока нет", "После первых операций здесь появится список.")}</div>`;
}

function renderBars(entries) {
  const max = Math.max(...entries.map(([, total]) => total), 1);
  return `<div class="bars">${entries.map(([label, total]) => `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (total / max) * 100)}%"></div></div><strong>${money(total)}</strong></div>`).join("") || renderEmptyState("Данных пока нет", "График появится, когда накопятся операции.")}</div>`;
}

function bookingFromForm(data) {
  const existing = state.bookings.find((booking) => booking.id === data.id);
  const service = serviceByName(data.service) || serviceById(data.serviceId) || {};
  const fieldLocks = serviceFieldLocks(service);
  const employee = state.users.find((user) => user.id === data.employeeId) || state.users.find((user) => user.name === data.employee) || {};
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt || now;
  const serviceName = service.name || data.service || existing?.service || "";
  const employeeName = employee.name || data.employee || existing?.employee || "";
  return {
    id: data.id || crypto.randomUUID(),
    date: data.date,
    time: data.time,
    duration: fieldLocks.duration ? service.duration : data.duration.trim() || service.duration || "1 час",
    clientName: data.client.trim(),
    client: data.client.trim(),
    phone: data.phone.trim(),
    telegram: data.telegram.trim(),
    serviceCategoryId: data.categoryId || service.categoryId || existing?.serviceCategoryId || "",
    serviceId: service.id || existing?.serviceId || "",
    serviceName,
    service: serviceName,
    amount: fieldLocks.price ? Number(service.price || 0) : Number(data.amount || 0),
    employeeId: employee.id || existing?.employeeId || "",
    employeeName,
    employee: employeeName,
    comment: data.comment.trim(),
    status: bookingStatuses.includes(data.status) ? data.status : "подтверждено",
    paymentCreated: Boolean(existing?.paymentCreated || existing?.paymentId),
    paymentId: existing?.paymentId || "",
    createdAt,
    updatedAt: now,
    statusHistory: existing?.statusHistory || []
  };
}

function upsertClientFromBooking(booking) {
  const name = String(booking.clientName || booking.client || "").trim();
  if (!name) return;
  const phone = String(booking.phone || "").trim();
  const telegram = String(booking.telegram || "").trim();
  const existing = state.clients.find((client) =>
    (phone && client.phone === phone) ||
    (telegram && client.telegram === telegram) ||
    client.name === name
  );
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name,
    phone: phone || existing?.phone || "",
    telegram: telegram || existing?.telegram || "",
    comment: existing?.comment || ""
  };
  if (existing) {
    state.clients = state.clients.map((client) => (client.id === existing.id ? payload : client));
  } else {
    state.clients.push(payload);
  }
}

function upsertClientFromPayment(payment) {
  const name = String(payment.client || "").trim();
  if (!name) return;
  const existing = state.clients.find((client) => client.name === name);
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name,
    phone: existing?.phone || "",
    telegram: existing?.telegram || "",
    comment: existing?.comment || ""
  };
  if (existing) {
    state.clients = state.clients.map((client) => (client.id === existing.id ? payload : client));
  } else {
    state.clients.push(payload);
  }
}

function syncServicesFromCatalog() {
  state.services = catalogServices().map((service) => service.name);
}

function paymentFromBooking(booking) {
  const serviceName = booking.serviceName || booking.service;
  const employeeName = booking.employeeName || booking.employee;
  const category = classifyService(serviceName);
  const soundEngineer = ["recording", "studioProduction"].includes(category) ? employeeName : "";
  const performer = category === "online" ? employeeName : "";
  return {
    id: crypto.randomUUID(),
    date: booking.date,
    client: booking.clientName || booking.client,
    service: serviceName,
    amount: Number(booking.amount || 0),
    method: "По записи",
    comment: booking.comment ? `Запись: ${booking.comment}` : "Запись завершена",
    soundEngineer,
    performer,
    employee: soundEngineer || performer || employeeName || "",
    bookingId: booking.id
  };
}

function completeBooking(bookingId) {
  const booking = state.bookings.find((item) => item.id === bookingId);
  if (!booking) return;

  if (booking.status !== "завершено") {
    appendStatusHistory(booking, "завершено", "завершена");
  }
  booking.status = "завершено";
  upsertClientFromBooking(booking);
  const existingPayment = state.payments.find((payment) => payment.id === booking.paymentId || payment.bookingId === booking.id);
  if (existingPayment) {
    const updatedPayment = { ...paymentFromBooking(booking), id: existingPayment.id };
    state.payments = state.payments.map((payment) => (payment.id === existingPayment.id ? updatedPayment : payment));
    booking.paymentId = existingPayment.id;
  } else {
    const payment = paymentFromBooking(booking);
    state.payments.push(payment);
    booking.paymentId = payment.id;
  }
  booking.paymentCreated = true;
  booking.updatedAt = new Date().toISOString();
}

function appendStatusHistory(booking, status, note = "") {
  booking.statusHistory = booking.statusHistory || [];
  booking.statusHistory.push({
    status,
    at: new Date().toISOString(),
    user: currentUser()?.name || "Система",
    note
  });
}

function updateBookingStatus(bookingId, status) {
  const booking = state.bookings.find((item) => item.id === bookingId);
  if (!booking || !bookingStatuses.includes(status)) return;
  if (status === "завершено") {
    completeBooking(bookingId);
    return;
  }
  if (booking.status !== status) {
    appendStatusHistory(booking, status, status === "в процессе" ? "в процессе" : status === "отменено" ? "отменена" : "статус изменён");
  }
  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  upsertClientFromBooking(booking);
}

function deleteBookingSafely(bookingId) {
  const booking = state.bookings.find((item) => item.id === bookingId);
  if (!booking) return false;
  const linkedPayments = state.payments.filter((payment) =>
    payment.bookingId === bookingId || (booking.paymentId && payment.id === booking.paymentId)
  );
  const linkedPaymentIds = new Set(linkedPayments.map((payment) => payment.id));
  const message = linkedPayments.length
    ? "У этой записи есть связанный платёж. Удалить только запись? Платёж останется в финансах."
    : "Удалить запись?";
  if (!confirm(message)) return false;

  if (linkedPayments.length) {
    const marker = "Исходная запись удалена";
    state.payments = state.payments.map((payment) =>
      linkedPaymentIds.has(payment.id)
        ? {
            ...payment,
            comment: String(payment.comment || "").includes(marker)
              ? payment.comment
              : `${payment.comment || "Запись завершена"} · ${marker}`
          }
        : payment
    );
  }

  state.bookings = state.bookings.filter((item) => item.id !== bookingId);
  if (selectedBookingId === bookingId) selectedBookingId = null;
  return true;
}

function clientStats(name) {
  const payments = state.payments.filter((item) => item.client === name);
  const bookings = state.bookings.filter((item) => item.client === name);
  const completedBookings = bookings.filter((item) => item.status === "завершено");
  const standalonePayments = payments.filter((payment) => !payment.bookingId);
  const visits = completedBookings.length + standalonePayments.length;
  const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const dates = [
    ...completedBookings.map((item) => item.date),
    ...standalonePayments.map((item) => item.date)
  ].filter(Boolean).sort((a, b) => b.localeCompare(a));
  return {
    payments,
    bookings,
    total,
    visits,
    lastDate: dates[0] || bookings.sort((a, b) => b.date.localeCompare(a.date))[0]?.date || ""
  };
}

function bindCommonEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.view;
      editingPaymentId = null;
      editingBookingId = null;
      bookingModalOpen = false;
      bookingSlotDraft = null;
      notificationPanelOpen = false;
      commandPaletteOpen = false;
      if (view !== "clients") selectedClientName = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='openBookingModal']").forEach((button) => {
    button.addEventListener("click", () => {
      editingBookingId = null;
      bookingSlotDraft = null;
      studioBlockModalOpen = false;
      bookingModalOpen = true;
      commandPaletteOpen = false;
      render();
    });
  });

  document.querySelector("[data-action='toggleNotifications']")?.addEventListener("click", () => {
    notificationPanelOpen = !notificationPanelOpen;
    render();
  });

  document.querySelectorAll("[data-action='openCommandPalette']").forEach((button) => {
    button.addEventListener("click", () => {
      commandPaletteOpen = true;
      notificationPanelOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-action='closeCommandPalette']").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target !== button && button.classList.contains("modal-backdrop")) return;
      commandPaletteOpen = false;
      commandPaletteQuery = "";
      render();
    });
  });

  document.querySelector("#globalSearch")?.addEventListener("input", (event) => {
    globalSearchQuery = event.target.value;
    const box = document.querySelector("#globalSearchResults");
    if (box) {
      box.classList.toggle("open", Boolean(globalSearchQuery.trim()));
      box.innerHTML = renderGlobalSearchResults(globalSearchQuery);
      bindSearchResultEvents();
    } else {
      render();
    }
  });

  document.querySelector("#globalSearch")?.addEventListener("focus", () => {
    if (globalSearchQuery) render();
  });

  document.querySelector("#commandSearch")?.addEventListener("input", (event) => {
    commandPaletteQuery = event.target.value;
    const list = document.querySelector(".command-list");
    if (list) {
      list.innerHTML = commandItems(commandPaletteQuery).map(renderSearchResult).join("") || renderEmptyState("Ничего не найдено", "Попробуй имя клиента, услугу или команду.");
      bindSearchResultEvents();
    }
  });

  bindSearchResultEvents();

  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", () => {
      state.sessionUserId = null;
      saveState();
      render();
    });
  });
}

function bindSearchResultEvents() {
  document.querySelectorAll("[data-search-type]").forEach((button) => {
    button.addEventListener("click", () => {
      openSearchItem(button.dataset.searchType, button.dataset.searchId);
    });
  });
}

function bindViewEvents() {
  document.querySelector("[data-action='prevCalendarPeriod']")?.addEventListener("click", () => {
    calendarDate = addDays(calendarDate, calendarMode === "day" ? -1 : -7);
    calendarWeekStart = weekStart(calendarDate);
    saveCalendarSettings();
    render();
  });

  document.querySelector("[data-action='nextCalendarPeriod']")?.addEventListener("click", () => {
    calendarDate = addDays(calendarDate, calendarMode === "day" ? 1 : 7);
    calendarWeekStart = weekStart(calendarDate);
    saveCalendarSettings();
    render();
  });

  document.querySelector("[data-action='todayCalendar']")?.addEventListener("click", () => {
    calendarDate = todayKey();
    calendarWeekStart = weekStart(calendarDate);
    saveCalendarSettings();
    render();
  });

  document.querySelectorAll("[data-calendar-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      calendarMode = button.dataset.calendarMode === "day" ? "day" : "week";
      saveCalendarSettings();
      render();
    });
  });

  document.querySelector("#calendarEmployeeFilter")?.addEventListener("change", (event) => {
    calendarEmployeeFilter = event.target.value;
    saveCalendarSettings();
    render();
  });

  document.querySelector("#calendarStatusFilter")?.addEventListener("change", (event) => {
    calendarStatusFilter = event.target.value;
    saveCalendarSettings();
    render();
  });

  document.querySelector("#calendarServiceFilter")?.addEventListener("change", (event) => {
    calendarServiceFilter = event.target.value;
    saveCalendarSettings();
    render();
  });

  document.querySelector("[data-action='clearCalendarFilters']")?.addEventListener("click", () => {
    calendarEmployeeFilter = "";
    calendarStatusFilter = "";
    calendarServiceFilter = "";
    saveCalendarSettings();
    render();
  });

  document.querySelector("[data-action='openStudioBlockModal']")?.addEventListener("click", () => {
    editingStudioBlockId = null;
    studioBlockDraft = { date: calendarDate, time: "12:00", duration: "1 час", type: "Тех. блок" };
    studioBlockModalOpen = true;
    render();
  });

  document.querySelectorAll("[data-calendar-slot]").forEach((slot) => {
    slot.addEventListener("click", () => {
      const [date, time] = slot.dataset.calendarSlot.split("|");
      const employee = state.users.find((user) => user.id === calendarEmployeeFilter);
      editingBookingId = null;
      selectedStudioBlockId = null;
      calendarDate = date;
      bookingSlotDraft = { date, time, status: "подтверждено", employeeId: employee?.id || "", employee: employee?.name || "" };
      bookingModalOpen = true;
      saveCalendarSettings();
      render();
    });
  });

  document.querySelectorAll("[data-calendar-booking]").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedBookingId = card.dataset.calendarBooking;
      selectedStudioBlockId = null;
      editingBookingId = null;
      bookingSlotDraft = null;
      bookingModalOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-calendar-studio-block]").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedStudioBlockId = card.dataset.calendarStudioBlock;
      selectedBookingId = null;
      bookingModalOpen = false;
      studioBlockModalOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-edit-studio-block]").forEach((button) => {
    button.addEventListener("click", () => {
      editingStudioBlockId = button.dataset.editStudioBlock;
      studioBlockDraft = null;
      studioBlockModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-delete-studio-block]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("Удалить технический блок?")) return;
      state.studioBlocks = (state.studioBlocks || []).filter((block) => block.id !== button.dataset.deleteStudioBlock);
      selectedStudioBlockId = null;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='closeStudioBlockModal']").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target !== button && button.classList.contains("modal-backdrop")) return;
      studioBlockModalOpen = false;
      editingStudioBlockId = null;
      studioBlockDraft = null;
      render();
    });
  });

  document.querySelectorAll("#studioBlockForm [name='date'], #studioBlockForm [name='time'], #studioBlockForm [name='duration']").forEach((field) => {
    field.addEventListener("input", updateStudioBlockConflictWarning);
  });

  document.querySelector("#studioBlockForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const block = studioBlockFromForm(data);
    const conflicts = studioConflictsForBlock(block, block.id);
    if (conflicts.length && !confirm("В это время студия уже занята. Сохранить блок с конфликтом?")) return;
    if (data.id) state.studioBlocks = (state.studioBlocks || []).map((item) => item.id === data.id ? block : item);
    else state.studioBlocks = [...(state.studioBlocks || []), block];
    selectedStudioBlockId = block.id;
    selectedBookingId = null;
    studioBlockModalOpen = false;
    editingStudioBlockId = null;
    studioBlockDraft = null;
    saveState();
    render();
  });

  document.querySelectorAll("[data-side-edit-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      editingBookingId = button.dataset.sideEditBooking;
      bookingModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-side-status-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      updateBookingStatus(button.dataset.sideStatusBooking, button.dataset.status);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-side-delete-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!deleteBookingSafely(button.dataset.sideDeleteBooking)) return;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action='closeBookingModal']").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target !== button && button.classList.contains("modal-backdrop")) return;
      bookingModalOpen = false;
      editingBookingId = null;
      bookingSlotDraft = null;
      render();
    });
  });

  document.querySelector("#bookingServiceSelect")?.addEventListener("change", (event) => {
    const service = serviceById(event.target.value) || serviceByName(event.target.value);
    if (!service) return;
    applyBookingServiceFields(service);
    updateBookingConflictWarning();
  });

  document.querySelector("#bookingCategorySelect")?.addEventListener("change", (event) => {
    const select = document.querySelector("#bookingServiceSelect");
    if (!select) return;
    const services = catalogServices().filter((service) => service.categoryId === event.target.value && service.active !== false);
    select.innerHTML = services.map((service) => `<option value="${service.id}">${service.name}</option>`).join("");
    const first = services[0];
    if (!first) return;
    select.value = first.id;
    applyBookingServiceFields(first);
    updateBookingConflictWarning();
  });

  document.querySelectorAll("#bookingModalForm [name='date'], #bookingModalForm [name='time'], #bookingModalForm [name='duration'], #bookingModalForm [name='employeeId'], #bookingModalForm [name='status']").forEach((field) => {
    field.addEventListener(field.tagName === "INPUT" ? "input" : "change", updateBookingConflictWarning);
  });

  document.querySelector("#bookingModalForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const booking = bookingFromForm(data);
    const studioConflicts = studioConflictsForBooking(booking, booking.id);
    if (studioConflicts.length && !confirm("В это время студия уже занята. Сохранить запись с конфликтом?")) return;
    const previousStatus = state.bookings.find((item) => item.id === booking.id)?.status;
    if (!data.id) {
      appendStatusHistory(booking, booking.status, "создана запись");
    } else if (previousStatus && previousStatus !== booking.status && booking.status !== "завершено") {
      appendStatusHistory(booking, booking.status, "статус изменён");
    }
    if (data.id) {
      state.bookings = state.bookings.map((item) => (item.id === data.id ? booking : item));
    } else {
      state.bookings.push(booking);
    }
    upsertClientFromBooking(booking);
    if (booking.status === "завершено") completeBooking(booking.id);
    selectedBookingId = booking.id;
    bookingModalOpen = false;
    editingBookingId = null;
    bookingSlotDraft = null;
    saveState();
    render();
  });

  document.querySelector("[data-action='completeBookingFromModal']")?.addEventListener("click", () => {
    if (!editingBookingId) return;
    completeBooking(editingBookingId);
    bookingModalOpen = false;
    editingBookingId = null;
    saveState();
    render();
  });

  document.querySelector("[data-action='cancelBookingFromModal']")?.addEventListener("click", () => {
    if (!editingBookingId) return;
    updateBookingStatus(editingBookingId, "отменено");
    bookingModalOpen = false;
    editingBookingId = null;
    saveState();
    render();
  });

  document.querySelector("[data-action='deleteBookingFromModal']")?.addEventListener("click", () => {
    if (!editingBookingId || !deleteBookingSafely(editingBookingId)) return;
    bookingModalOpen = false;
    editingBookingId = null;
    saveState();
    render();
  });

  document.querySelector("#searchPayments")?.addEventListener("input", (event) => {
    clientFilter = event.target.value;
    selectedClientName = null;
    render();
  });

  document.querySelector("#clientSort")?.addEventListener("change", (event) => {
    clientSortMode = event.target.value;
    render();
  });

  document.querySelector("#bookingDateFilter")?.addEventListener("change", (event) => {
    bookingDateFilter = event.target.value;
    render();
  });

  document.querySelector("#bookingSearchFilter")?.addEventListener("input", (event) => {
    bookingSearchFilter = event.target.value;
    render();
  });

  document.querySelector("#bookingStatusFilter")?.addEventListener("change", (event) => {
    bookingStatusFilter = event.target.value;
    render();
  });

  document.querySelector("#bookingEmployeeFilter")?.addEventListener("change", (event) => {
    bookingEmployeeFilter = event.target.value;
    render();
  });

  document.querySelector("#bookingServiceFilter")?.addEventListener("change", (event) => {
    bookingServiceFilter = event.target.value;
    render();
  });

  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      settingsTab = button.dataset.settingsTab;
      render();
    });
  });

  document.querySelector("#serviceGroupForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.serviceGroups.push({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      order: Number(data.order || state.serviceGroups.length + 1)
    });
    saveState();
    render();
  });

  document.querySelectorAll("[data-save-service-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = document.querySelector(`[data-service-group-row="${button.dataset.saveServiceGroup}"]`);
      const data = Object.fromEntries(new FormData(row));
      state.serviceGroups = state.serviceGroups.map((group) =>
        group.id === button.dataset.saveServiceGroup ? { ...group, name: data.name.trim(), order: Number(data.order || group.order) } : group
      );
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete-service-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.deleteServiceGroup;
      if (state.serviceItems.some((service) => service.categoryId === id)) {
        alert("Сначала перенеси или удали услуги этой категории.");
        return;
      }
      if (!confirm("Удалить категорию?")) return;
      state.serviceGroups = state.serviceGroups.filter((group) => group.id !== id);
      saveState();
      render();
    });
  });

  document.querySelector("#serviceItemForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
      state.serviceItems.push({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      categoryId: data.categoryId,
      price: Number(data.price || 0),
      duration: data.duration.trim() || "1 час",
      order: Number(data.order || state.serviceItems.length + 1),
      mode: "fixed",
      active: true
    });
    syncServicesFromCatalog();
    saveState();
    render();
  });

  document.querySelectorAll("[data-save-service-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = document.querySelector(`[data-service-item-row="${button.dataset.saveServiceItem}"]`);
      const data = Object.fromEntries(new FormData(row));
      state.serviceItems = state.serviceItems.map((service) =>
        service.id === button.dataset.saveServiceItem
          ? { ...service, name: data.name.trim(), categoryId: data.categoryId, price: Number(data.price || 0), duration: data.duration.trim() || "1 час", order: Number(data.order || service.order), active: data.active === "on" }
          : service
      );
      syncServicesFromCatalog();
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete-service-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const service = state.serviceItems.find((item) => item.id === button.dataset.deleteServiceItem);
      if (!service) return;
      if (state.bookings.some((booking) => booking.serviceId === service.id || booking.service === service.name) || state.payments.some((payment) => payment.service === service.name)) {
        alert("Эта услуга уже используется в записях или платежах. Её можно отключить, но не удалить.");
        return;
      }
      if (!confirm("Удалить услугу?")) return;
      state.serviceItems = state.serviceItems.filter((service) => service.id !== button.dataset.deleteServiceItem);
      syncServicesFromCatalog();
      saveState();
      render();
    });
  });

  document.querySelector("#categorySelect")?.addEventListener("change", (event) => {
    applyServiceCategory(event.target.value);
  });

  document.querySelector("#serviceSelect")?.addEventListener("change", (event) => {
    const service = serviceById(event.target.value) || serviceByName(event.target.value);
    applyServicePrice(service?.name || event.target.value);
  });

  document.querySelector("#clientInput")?.addEventListener("input", (event) => {
    renderClientSuggestions(event.target.value);
  });

  document.querySelector("#clientInput")?.addEventListener("focus", (event) => {
    renderClientSuggestions(event.target.value);
  });

  document.querySelector("#clientInput")?.addEventListener("blur", () => {
    window.setTimeout(() => document.querySelector("#clientSuggestions")?.classList.remove("open"), 120);
  });

  document.querySelector("[data-action='openPayout']")?.addEventListener("click", () => {
    payoutEmployeeIdDraft = "";
    payoutModalOpen = true;
    render();
  });

  document.querySelectorAll("[data-open-employee-payout]").forEach((button) => {
    button.addEventListener("click", () => {
      payoutEmployeeIdDraft = button.dataset.openEmployeePayout;
      payoutModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-repeat-payout]").forEach((button) => {
    button.addEventListener("click", () => {
      const payout = (state.payouts || []).find((item) => item.id === button.dataset.repeatPayout);
      const stats = employeePayoutStats(payout?.employeeId || "");
      if (!payout || !stats.employee || stats.availableToPay <= 0 || stats.overpaid > 0) return;
      payoutEmployeeIdDraft = stats.employee.id;
      payoutModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-payout-filter-employee]").forEach((button) => {
    button.addEventListener("click", () => {
      payoutEmployeeFilter = button.dataset.payoutFilterEmployee;
      highlightedPayoutId = "";
      render();
      window.requestAnimationFrame(() => document.querySelector(".payout-filters")?.scrollIntoView({ block: "center", behavior: "smooth" }));
    });
  });

  document.querySelectorAll("[data-open-employee-bookings]").forEach((button) => {
    button.addEventListener("click", () => {
      bookingEmployeeFilter = button.dataset.openEmployeeBookings;
      view = "bookings";
      render();
    });
  });

  document.querySelectorAll("[data-open-employee-settings]").forEach((button) => {
    button.addEventListener("click", () => {
      settingsTab = "employees";
      view = "settings";
      render();
    });
  });

  document.querySelectorAll("[data-open-payout]").forEach((button) => {
    button.addEventListener("click", () => {
      const payout = (state.payouts || []).find((item) => item.id === button.dataset.openPayout);
      payoutEmployeeFilter = payout?.employeeId || "";
      payoutStatusFilter = "";
      payoutPeriodFilter = "all";
      payoutProblemsOnly = false;
      highlightedPayoutId = button.dataset.openPayout;
      render();
      window.requestAnimationFrame(() => document.querySelector(`[data-payout-row="${highlightedPayoutId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    });
  });

  document.querySelector("#payoutEmployeeFilter")?.addEventListener("change", (event) => {
    payoutEmployeeFilter = event.target.value;
    highlightedPayoutId = "";
    render();
  });

  document.querySelector("#payoutStatusFilter")?.addEventListener("change", (event) => {
    payoutStatusFilter = event.target.value;
    highlightedPayoutId = "";
    render();
  });

  document.querySelector("#payoutPeriodFilter")?.addEventListener("change", (event) => {
    payoutPeriodFilter = event.target.value;
    highlightedPayoutId = "";
    render();
  });

  document.querySelector("#payoutProblemsFilter")?.addEventListener("change", (event) => {
    payoutProblemsOnly = event.target.value === "problems";
    highlightedPayoutId = "";
    render();
  });

  document.querySelector("[data-action='resetPayoutFilters']")?.addEventListener("click", () => {
    payoutEmployeeFilter = "";
    payoutStatusFilter = "";
    payoutPeriodFilter = "all";
    payoutProblemsOnly = false;
    highlightedPayoutId = "";
    render();
  });

  document.querySelectorAll("[data-action='closePayout']").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target !== button && button.classList.contains("modal-backdrop")) return;
      payoutModalOpen = false;
      payoutEmployeeIdDraft = "";
      render();
    });
  });

  document.querySelector("#payoutEmployee")?.addEventListener("change", () => updatePayoutEmployeeSummary(true));
  document.querySelector("#payoutAmount")?.addEventListener("input", updatePayoutAmountFeedback);
  document.querySelector("[data-action='payoutAll']")?.addEventListener("click", () => updatePayoutEmployeeSummary(true));

  document.querySelectorAll("[data-confirm-payout]").forEach((button) => {
    button.addEventListener("click", () => {
      state.payouts = state.payouts.map((payout) =>
        payout.id === button.dataset.confirmPayout
          ? { ...payout, status: "Выплачено", paidAt: localDateTimeValue() }
          : payout
      );
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-cancel-payout]").forEach((button) => {
    button.addEventListener("click", () => {
      state.payouts = state.payouts.map((payout) => payout.id === button.dataset.cancelPayout ? { ...payout, status: "Отменено" } : payout);
      saveState();
      render();
    });
  });

  document.querySelector("#payoutForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const validation = validateEmployeePayout(data.employeeId, data.amount);
    if (!validation.ok) {
      alert(validation.error);
      return;
    }
    const { employee, amount, stats } = validation;
    const available = stats.availableToPay;
    state.payouts.push({
      id: crypto.randomUUID(),
      employeeId: employee.id,
      employeeName: employee.name,
      recipient: employee.name,
      payoutType: "Сотрудник",
      service: "Завершённые записи",
      amount,
      method: data.method,
      paidAt: data.paidAt,
      status: data.status,
      comment: data.comment.trim(),
      createdBy: currentUser()?.name || "",
      createdAt: new Date().toISOString(),
      remainingAfter: Math.max(0, available - amount)
    });
    payoutModalOpen = false;
    payoutEmployeeIdDraft = "";
    saveState();
    render();
  });

  document.querySelector("#expenseForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.expenses = state.expenses || [];
    state.expenses.push({
      id: crypto.randomUUID(),
      date: data.date,
      title: data.title.trim(),
      amount: Number(data.amount || 0),
      comment: data.comment.trim()
    });
    saveState();
    render();
  });

  document.querySelector("#paymentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const priceRule = servicePriceRule(data.service);
    let amount = Number(data.amount);
    if (priceRule.mode === "fixed") {
      amount = priceRule.price;
    }
    if (amount < priceRule.min) {
      alert(`Минимальная сумма для этой услуги: ${money(priceRule.min)}`);
      applyServicePrice(data.service);
      return;
    }
    const paymentCategoryKey = classifyService(data.service);
    const soundEngineer = ["recording", "studioProduction"].includes(paymentCategoryKey) ? data.soundEngineer : "";
    const performer = paymentCategoryKey === "online" ? data.performer : "";
    const previousPayment = state.payments.find((item) => item.id === data.id);
    const payment = {
      id: data.id || crypto.randomUUID(),
      date: data.date,
      client: data.client.trim(),
      service: data.service,
      amount,
      method: data.method,
      comment: data.comment.trim(),
      soundEngineer,
      performer,
      employee: soundEngineer || performer || "",
      bookingId: data.bookingId || previousPayment?.bookingId || ""
    };
    if (data.id) {
      state.payments = state.payments.map((item) => (item.id === data.id ? payment : item));
    } else {
      state.payments.push(payment);
    }
    if (payment.bookingId) {
      state.bookings = state.bookings.map((booking) => (booking.id === payment.bookingId ? { ...booking, paymentId: payment.id, paymentCreated: true, updatedAt: new Date().toISOString() } : booking));
    }
    upsertClientFromPayment(payment);
    editingPaymentId = null;
    saveState();
    render();
  });

  document.querySelector("#bookingForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const booking = bookingFromForm(data);
    const studioConflicts = studioConflictsForBooking(booking, booking.id);
    if (studioConflicts.length && !confirm("В это время студия уже занята. Сохранить запись с конфликтом?")) return;
    if (data.id) {
      state.bookings = state.bookings.map((item) => (item.id === data.id ? booking : item));
    } else {
      state.bookings.push(booking);
    }
    upsertClientFromBooking(booking);
    if (booking.status === "завершено") {
      completeBooking(booking.id);
    }
    editingBookingId = null;
    saveState();
    render();
  });

  document.querySelectorAll("[data-client]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedClientName = decodeURIComponent(button.dataset.client);
      render();
    });
  });

  document.querySelector("[data-action='backToClients']")?.addEventListener("click", () => {
    selectedClientName = null;
    render();
  });

  document.querySelector("[data-action='cancelEdit']")?.addEventListener("click", () => {
    editingPaymentId = null;
    render();
  });

  document.querySelector("[data-action='cancelBookingEdit']")?.addEventListener("click", () => {
    editingBookingId = null;
    render();
  });

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editingPaymentId = button.dataset.edit;
      view = "payments";
      render();
    });
  });

  document.querySelectorAll("[data-edit-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      editingBookingId = button.dataset.editBooking;
      bookingModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-open-booking]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (card.classList.contains("booking-card") && event.target.closest("button")) return;
      const booking = state.bookings.find((item) => item.id === card.dataset.openBooking);
      selectedBookingId = card.dataset.openBooking;
      selectedStudioBlockId = null;
      if (booking) {
        calendarDate = booking.date;
        calendarWeekStart = weekStart(calendarDate);
        if (!calendarBookingMatches(booking)) {
          calendarEmployeeFilter = "";
          calendarStatusFilter = "";
          calendarServiceFilter = "";
        }
        saveCalendarSettings();
      }
      editingBookingId = null;
      bookingModalOpen = false;
      view = "calendar";
      render();
    });
  });

  document.querySelectorAll("[data-open-payment]").forEach((button) => {
    button.addEventListener("click", () => {
      editingPaymentId = button.dataset.openPayment;
      view = "payments";
      render();
    });
  });

  document.querySelectorAll("[data-booking-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const bookingId = button.dataset.bookingStatus;
      const status = button.dataset.status;
      updateBookingStatus(bookingId, status);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!deleteBookingSafely(button.dataset.deleteBooking)) return;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("Удалить оплату?")) return;
      state.payments = state.payments.filter((item) => item.id !== button.dataset.delete);
      saveState();
      render();
    });
  });

  document.querySelector("#userForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (state.users.some((user) => user.login === data.login)) {
      alert("Такой логин уже есть");
      return;
    }
    state.users.push({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      login: data.login.trim(),
      password: data.password,
      role: data.role === "Администратор" || data.role === "Владелец" ? "admin" : "staff",
      position: data.position || data.role || "Другое",
      percent: Number(data.percent || 0),
      fixedRate: Number(data.fixedRate || 0),
      color: data.color || "#ff6633",
      phone: data.phone.trim(),
      telegram: data.telegram.trim(),
      active: true
    });
    saveState();
    render();
  });

  document.querySelectorAll("[data-save-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = document.querySelector(`[data-user-row="${button.dataset.saveUser}"]`);
      const data = Object.fromEntries(new FormData(row));
      state.users = state.users.map((user) =>
        user.id === button.dataset.saveUser
          ? {
              ...user,
              name: data.name.trim(),
              position: data.positionRole || data.position || user.position,
              percent: Number(data.percent || 0),
              fixedRate: Number(data.fixedRate || 0),
              color: data.color || user.color,
              phone: data.phone || "",
              telegram: data.telegram || "",
              role: data.role,
              active: data.active === "on"
            }
          : user
      );
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-remove-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const user = state.users.find((item) => item.id === button.dataset.removeUser);
      if (!user) return;
      if (state.bookings.some((booking) => booking.employeeId === user.id || booking.employee === user.name) || state.payments.some((payment) => [payment.employee, payment.soundEngineer, payment.performer].includes(user.name))) {
        alert("Сотрудник уже используется в записях или платежах. Его можно отключить, но не удалить.");
        return;
      }
      state.users = state.users.filter((user) => user.id !== button.dataset.removeUser);
      saveState();
      render();
    });
  });
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "n") {
    event.preventDefault();
    editingBookingId = null;
    bookingSlotDraft = null;
    bookingModalOpen = true;
    notificationPanelOpen = false;
    commandPaletteOpen = false;
    render();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "k") {
    event.preventDefault();
    commandPaletteOpen = true;
    notificationPanelOpen = false;
    render();
    return;
  }
  if (event.key === "Escape" && (bookingModalOpen || studioBlockModalOpen || payoutModalOpen || commandPaletteOpen || notificationPanelOpen)) {
    bookingModalOpen = false;
    studioBlockModalOpen = false;
    payoutModalOpen = false;
    commandPaletteOpen = false;
    notificationPanelOpen = false;
    editingBookingId = null;
    bookingSlotDraft = null;
    editingStudioBlockId = null;
    studioBlockDraft = null;
    render();
  }
});

render();
