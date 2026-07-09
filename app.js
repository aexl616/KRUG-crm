const STORAGE_KEY = "studio-income-app-v1";
const PAYOUT_RESET_VERSION = 2;
const CALENDAR_START_HOUR = 9;
const CALENDAR_END_HOUR = 23;

const defaultServiceGroups = [
  { id: "recording", name: "Запись", order: 1 },
  { id: "mixing", name: "Сведение", order: 2 },
  { id: "education", name: "Обучение", order: 3 },
  { id: "production", name: "Продакшн", order: 4 },
  { id: "consulting", name: "Консультации", order: 5 },
  { id: "design", name: "Дизайн", order: 6 },
  { id: "rent", name: "Аренда", order: 7 },
  { id: "extra", name: "Доп. услуги", order: 8 }
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
  payouts: [],
  payoutResetVersion: PAYOUT_RESET_VERSION
};

const bookingStatuses = ["заявка", "подтверждено", "в процессе", "завершено", "отменено"];

const budgetWallets = ["общак", "AE XL", "AURA 13", "Даня", "Даня в кепке"];
const serviceCatalog = [
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
const extraServices = serviceCatalog.map((service) => service.name);
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
let view = "calendar";
let editingPaymentId = null;
let editingBookingId = null;
let bookingModalOpen = false;
let bookingSlotDraft = null;
let calendarWeekStart = weekStart(new Date().toISOString().slice(0, 10));
let clientFilter = "";
let bookingDateFilter = "";
let bookingStatusFilter = "";
let bookingServiceFilter = "";
let selectedClientName = null;
let payoutModalOpen = false;
let settingsTab = "services";

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
  const catalogItem = serviceCatalog.find((item) => item.name === serviceName);
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
  const customServices = (nextState.services || []).filter((service) => !legacyServices.has(service) && !extraServices.includes(service));
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
    mode: service.mode || "fixed"
  }));
  [...extraServices, ...customServices].forEach((name) => {
    if (!serviceItems.some((service) => service.name === name)) {
      const categoryId = classifyService(name);
      serviceItems.push({
        id: crypto.randomUUID(),
        name,
        categoryId: groupIds.has(categoryId) ? categoryId : "extra",
        price: servicePriceRuleFromStatic(name).price || 0,
        duration: durationFromServiceName(name),
        order: serviceItems.length + 1,
        mode: servicePriceRuleFromStatic(name).mode || "manual"
      });
    }
  });
  const services = serviceItems.map((service) => service.name);
  const shouldResetPayouts = nextState.payoutResetVersion !== PAYOUT_RESET_VERSION;
  const users = (nextState.users || defaultState.users).map((user, index) => ({
    id: user.id || crypto.randomUUID(),
    name: user.name === "Я" ? "AE XL" : user.name || `Сотрудник ${index + 1}`,
    login: user.login || `staff${index + 1}`,
    password: user.password || "1234",
    role: user.role || "staff",
    position: user.position || (user.role === "admin" ? "Администратор" : "Звукорежиссёр"),
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
      soundEngineer,
      performer,
      employee: employeeName || soundEngineer || performer || ""
    };
  });
  const bookings = (nextState.bookings || []).map((booking) => ({
    id: booking.id || crypto.randomUUID(),
    date: booking.date || new Date().toISOString().slice(0, 10),
    time: booking.time || "12:00",
    duration: booking.duration || "1 час",
    client: booking.client || "",
    phone: booking.phone || "",
    telegram: booking.telegram || "",
    service: serviceAliases[booking.service] || booking.service || services[0] || "",
    amount: Number(booking.amount || booking.cost || 0),
    employee: booking.employee === "Я" ? "AE XL" : booking.employee || users[0]?.name || "",
    comment: booking.comment || "",
    status: bookingStatuses.includes(booking.status) ? booking.status : "заявка",
    paymentId: booking.paymentId || ""
  }));
  const clientMap = new Map((nextState.clients || []).map((client) => [client.name, client]));
  [...payments, ...bookings].forEach((item) => {
    const name = String(item.client || "").trim();
    if (!name) return;
    const previous = clientMap.get(name) || {};
    clientMap.set(name, {
      id: previous.id || crypto.randomUUID(),
      name,
      phone: item.phone || previous.phone || "",
      telegram: item.telegram || previous.telegram || "",
      comment: previous.comment || ""
    });
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
    payouts: shouldResetPayouts ? [] : nextState.payouts || [],
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

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU").format(new Date(`${value}T00:00:00`));
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStart(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
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
  return sortedEntries(groupSum(state.payments, (item) => item.client.trim()))
    .filter(([name]) => name)
    .map(([name, total]) => {
      const history = state.payments.filter((payment) => payment.client.trim() === name).sort((a, b) => b.date.localeCompare(a.date));
      return { name, total, last: history[0], visits: history.length };
    });
}

function clientSuggestions(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return knownClients().slice(0, 5);
  return knownClients()
    .filter((client) => client.name.toLowerCase().includes(normalized))
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
        ${view === "payments" ? renderPayments() : ""}
        ${view === "clients" ? renderClients() : ""}
        ${view === "budget" ? renderBudget() : ""}
        ${view === "reports" ? renderReports() : ""}
        ${view === "settings" ? renderSettings() : ""}
      </section>
      ${renderMobileTabs()}
      ${bookingModalOpen ? renderBookingModal() : ""}
      ${payoutModalOpen ? renderPayoutModal() : ""}
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
          <img class="brand-mark" src="krug-logo.svg" alt="КРУГ" />
          <div>
            <strong>КРУГ</strong>
            <span>учёт доходов студии</span>
          </div>
        </div>
        <h1>Вход</h1>
        <p class="muted">Локальная версия для первого запуска.</p>
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

function renderClientBooking() {
  const selectedService = firstServiceForCategory("recording");
  const priceRule = servicePriceRule(selectedService);
  app.innerHTML = `
    <section class="login-screen client-booking-screen">
      <form class="card login-card client-booking-card" id="clientBookingForm">
        <div class="brand">
          <img class="brand-mark" src="krug-logo.svg" alt="КРУГ" />
          <div>
            <strong>КРУГ</strong>
            <span>клиентская запись</span>
          </div>
        </div>
        <h1>Записаться в студию</h1>
        <div class="form-grid">
          <div class="field full">
            <label>Услуга</label>
            <select name="service" id="clientBookingService" required>
              ${state.services.map((service) => `<option ${service === selectedService ? "selected" : ""}>${service}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Дата</label>
            <input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}" />
          </div>
          <div class="field">
            <label>Время</label>
            <input name="time" type="time" required value="12:00" />
          </div>
          <div class="field">
            <label>Имя</label>
            <input name="client" required />
          </div>
          <div class="field">
            <label>Телефон</label>
            <input name="phone" />
          </div>
          <div class="field">
            <label>Telegram</label>
            <input name="telegram" />
          </div>
          <div class="field">
            <label>Длительность</label>
            <input name="duration" value="1 час" />
          </div>
          <div class="field full">
            <label>Комментарий</label>
            <textarea name="comment"></textarea>
          </div>
          <button class="btn" type="submit">Отправить заявку</button>
          <button class="btn secondary" type="button" data-action="backFromClientBooking">${currentUser() ? "Вернуться в CRM" : "Войти в CRM"}</button>
        </div>
        <p class="muted client-booking-note">После отправки заявка появится у студии в разделе “Записи”.</p>
      </form>
    </section>
  `;

  document.querySelector("#clientBookingService")?.addEventListener("change", (event) => {
    const rule = servicePriceRule(event.target.value);
    document.querySelector("#clientBookingForm").dataset.amount = String(rule.price || 0);
  });
  document.querySelector("#clientBookingForm").dataset.amount = String(priceRule.price || 0);
  document.querySelector("#clientBookingForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (!data.phone.trim() && !data.telegram.trim()) {
      alert("Укажи телефон или telegram, чтобы студия могла связаться.");
      return;
    }
    state.bookings.push({
      id: crypto.randomUUID(),
      date: data.date,
      time: data.time,
      duration: data.duration.trim() || "1 час",
      client: data.client.trim(),
      phone: data.phone.trim(),
      telegram: data.telegram.trim(),
      service: data.service,
      amount: Number(event.target.dataset.amount || 0),
      employee: "",
      comment: data.comment.trim(),
      status: "заявка",
      paymentId: ""
    });
    saveState();
    alert("Заявка отправлена. Студия увидит её в разделе “Записи”.");
    event.target.reset();
    renderClientBooking();
  });
  document.querySelector("[data-action='backFromClientBooking']")?.addEventListener("click", () => {
    view = currentUser() ? "bookings" : "dashboard";
    render();
  });
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <img class="brand-mark" src="krug-logo.svg" alt="КРУГ" />
        <div>
          <strong>КРУГ</strong>
          <span>студия звукозаписи</span>
        </div>
      </div>
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
    ["calendar", "Календарь"],
    ["dashboard", "Главная"],
    ["bookings", "Записи"],
    ["payments", "Платежи"],
    ["clients", "Клиенты"],
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
  return `
    <header class="topbar">
      <div>
        <h1>${pageTitle()}</h1>
        <p class="muted">${pageSubtitle()}</p>
      </div>
      <div class="actions">
        <button class="btn" data-action="openBookingModal">Добавить запись</button>
        <button class="btn" data-view="payments">+ Доход</button>
        ${isAdmin() ? '<button class="btn secondary" data-view="settings">Настройки</button>' : ""}
      </div>
    </header>
  `;
}

function pageTitle() {
  return {
    calendar: "Календарь",
    dashboard: "Дашборд",
    bookings: "Записи",
    payments: "Платежи",
    clients: "Клиенты",
    budget: "Бюджет",
    reports: "Отчёты",
    settings: "Настройки"
  }[view];
}

function pageSubtitle() {
  return {
    calendar: "Недельное расписание студии и статусы записей.",
    dashboard: "Ключевые цифры по доходу студии.",
    bookings: "Заявки, расписание и статусы студийных записей.",
    payments: "Добавление, поиск и редактирование оплат.",
    clients: "База клиентов, история оплат и посещений.",
    budget: "Пять копилок студии и распределение дохода по правилам.",
    reports: "Разбивка по дням, неделям, месяцам, клиентам и сотрудникам.",
    settings: "Услуги, сотрудники и доступы."
  }[view];
}

function classifyService(service) {
  const catalogItem = serviceCatalog.find((item) => item.name === service);
  if (catalogItem) return catalogItem.category;
  const value = String(service || "").toLowerCase();
  if (value.includes("аренд")) return "rent";
  if (value.includes("онлайн") || value.includes("online")) return "online";
  if (value.includes("бит") || value.includes("сведен")) return "studioProduction";
  if (value.includes("запис")) return "recording";
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
  return catalogServices().filter((service) => service.categoryId === category).map((service) => service.name);
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

  const catalogItem = serviceCatalog.find((item) => item.name === serviceName);
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
  if (!amountInput) return;

  amountInput.min = String(priceRule.min);
  amountInput.readOnly = priceRule.mode === "fixed";
  if (priceRule.mode === "fixed" || Number(amountInput.value || 0) < priceRule.min) {
    amountInput.value = priceRule.price || "";
  }
  if (priceHint) priceHint.textContent = priceRule.hint;
}

function applyServiceCategory(category) {
  const serviceSelect = document.querySelector("#serviceSelect");
  if (!serviceSelect) return;

  const services = servicesForCategory(category);
  serviceSelect.innerHTML = services.map((service) => `<option>${service}</option>`).join("");
  serviceSelect.value = services[0] || "";
  applyServicePrice(serviceSelect.value);
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
    button.querySelector("small").textContent = `Последний визит: ${formatDate(client.last.date)} · ${client.visits} посещ.`;
    button.querySelector("em").textContent = money(client.total);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      input.value = client.name;
      box.classList.remove("open");
    });
    box.appendChild(button);
  });
}

function updatePayoutAmount() {
  const service = document.querySelector("#payoutService")?.value;
  const type = document.querySelector("#payoutType")?.value;
  const amount = document.querySelector("#payoutAmount");
  const hint = document.querySelector("#payoutAvailableHint");
  if (!service || !type || !amount) return;
  const available = availableOutsideBudget();
  amount.max = String(available);
  amount.value = Math.min(payoutAmountForService(service, type), available);
  if (hint) hint.textContent = `Доступно к выплате: ${money(available)}`;
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
  if (!total) return '<p class="muted">Данных пока нет</p>';
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
        .join("") || '<p class="muted">Платежей пока нет</p>'}
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
        .join("") || '<p class="muted">Данных пока нет</p>'}
    </div>
  `;
}

function renderDashboard() {
  const total = state.payments.reduce((sum, item) => sum + Number(item.amount), 0);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const clients = new Set(state.payments.map((item) => item.client.trim()).filter(Boolean));
  const monthTotal = state.payments.filter((item) => item.date.startsWith(month)).reduce((sum, item) => sum + Number(item.amount), 0);
  const todayTotal = state.payments.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount), 0);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdayTotal = state.payments.filter((item) => item.date === yesterday).reduce((sum, item) => sum + Number(item.amount), 0);
  const previousMonth = previousMonthKey(today);
  const previousMonthTotal = state.payments.filter((item) => item.date.startsWith(previousMonth)).reduce((sum, item) => sum + Number(item.amount), 0);
  const topClients = sortedEntries(groupSum(state.payments, (item) => item.client)).slice(0, 5);
  const employeeIncome = sortedEntries(groupSum(state.payments, (item) => paymentTeamLabel(item) || "не указан"));
  const dayEntries = lastDays(7).map((date) => [
    date,
    state.payments.filter((item) => item.date === date).reduce((sum, item) => sum + Number(item.amount), 0)
  ]);
  const sourceEntries = sortedEntries(groupSum(state.payments, (item) => categoryLabel(paymentCategory(item))));
  const recentPayments = [...state.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const newClientsThisMonth = new Set(state.payments.filter((item) => item.date.startsWith(month)).map((item) => item.client)).size;

  return `
    <div class="grid stats dashboard-stats">
      ${renderMetricCard("Сегодня", todayTotal, "Доход", percentChange(todayTotal, yesterdayTotal), "от вчера")}
      ${renderMetricCard("Этот месяц", monthTotal, "Доход", percentChange(monthTotal, previousMonthTotal), "от прошлого")}
      ${renderMetricCard("Всего", total, "Общий доход", 0, "за всё время")}
      ${renderMetricCard("Клиенты", clients.size, "Активных", newClientsThisMonth, "за месяц", false)}
    </div>
    <div class="dashboard-layout" style="margin-top:16px">
      <section class="card section chart-card wide-card">
        <div class="section-head">
          <h2>Доход за 7 дней</h2>
          <span class="select-chip">По дням</span>
        </div>
        ${renderColumnChart(dayEntries)}
      </section>
      <section class="card section chart-card">
        <h2>Доход по категориям</h2>
        ${renderDonutChart(sourceEntries)}
      </section>
      <section class="card section">
        <div class="section-head">
          <h2>Последние платежи</h2>
          <button class="link-button" data-view="payments">Все платежи</button>
        </div>
        ${renderRecentPayments(recentPayments)}
      </section>
      <section class="card section">
        <div class="section-head">
          <h2>Топ клиентов</h2>
          <button class="link-button" data-view="clients">Все клиенты</button>
        </div>
        ${renderRankedList(topClients)}
      </section>
      <section class="card section">
        <h2>Доход по исполнителям / звукорежам</h2>
        ${renderBars(employeeIncome)}
      </section>
      <section class="card section wide-card">
        <h2>Быстрые действия</h2>
        <div class="quick-actions">
          <button class="quick-action" data-view="bookings"><span>○</span>Записи</button>
          <button class="quick-action" data-view="payments"><span>+</span>Новый платёж</button>
          <button class="quick-action" data-view="clients"><span>◎</span>Клиенты</button>
          <button class="quick-action" data-view="budget"><span>₽</span>Бюджет</button>
          <button class="quick-action" data-view="reports"><span>↗</span>Отчёт</button>
        </div>
      </section>
    </div>
  `;
}

function activeEmployees() {
  return state.users.filter((user) => user.active !== false);
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

function employeeByName(name) {
  return state.users.find((user) => user.name === name);
}

function renderCalendar() {
  const days = weekDays();
  const today = new Date().toISOString().slice(0, 10);
  const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 }, (_, index) => CALENDAR_START_HOUR + index);
  const weekEnd = addDays(calendarWeekStart, 6);

  return `
    <section class="calendar-page">
      <div class="card section calendar-toolbar">
        <div>
          <h2>${formatDate(calendarWeekStart)} — ${formatDate(weekEnd)}</h2>
          <p class="muted">Нажми на свободный слот, чтобы добавить запись. Нажми на запись, чтобы открыть редактирование.</p>
        </div>
        <div class="actions">
          <button class="btn secondary" data-action="prevWeek">← Неделя</button>
          <button class="btn secondary" data-action="todayWeek">Сегодня</button>
          <button class="btn secondary" data-action="nextWeek">Неделя →</button>
        </div>
      </div>
      <section class="card calendar-grid">
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
    </section>
  `;
}

function renderCalendarSlot(day, hour, today) {
  const hourText = `${String(hour).padStart(2, "0")}:`;
  const bookings = state.bookings.filter((booking) => booking.date === day && String(booking.time || "").startsWith(hourText));
  return `
    <button class="calendar-slot ${day === today ? "today" : ""}" data-calendar-slot="${day}|${String(hour).padStart(2, "0")}:00">
      ${bookings.map(renderCalendarBooking).join("")}
    </button>
  `;
}

function renderCalendarBooking(booking) {
  const employee = employeeByName(booking.employee);
  const color = employee?.color || "#ff6633";
  return `
    <article class="calendar-booking status-${booking.status.replaceAll(" ", "-")}" data-calendar-booking="${booking.id}" style="--employee-color:${color}">
      <strong>${booking.time} · ${booking.client || "Без имени"}</strong>
      <span>${booking.service}</span>
      <em>${statusTitle(booking.status)}</em>
    </article>
  `;
}

function renderBookingModal() {
  const booking = state.bookings.find((item) => item.id === editingBookingId) || bookingSlotDraft || {};
  const service = serviceByName(booking.service) || catalogServices()[0] || {};
  const defaultEmployee = currentUser()?.name || activeEmployees()[0]?.name || "";
  const status = booking.status || "подтверждено";

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
            <label>Услуга</label>
            <select name="service" id="bookingServiceSelect" required>
              ${catalogGroups()
                .map((group) => {
                  const options = catalogServices()
                    .filter((item) => item.categoryId === group.id)
                    .map((item) => `<option value="${item.name}" ${((booking.service || service.name) === item.name) ? "selected" : ""}>${item.name}</option>`)
                    .join("");
                  return options ? `<optgroup label="${group.name}">${options}</optgroup>` : "";
                })
                .join("")}
            </select>
          </div>
          <div class="field">
            <label>Дата</label>
            <input name="date" type="date" required value="${booking.date || new Date().toISOString().slice(0, 10)}" />
          </div>
          <div class="field">
            <label>Время</label>
            <input name="time" type="time" required value="${booking.time || "12:00"}" />
          </div>
          <div class="field">
            <label>Длительность</label>
            <input name="duration" id="bookingDurationInput" value="${booking.duration || service.duration || "1 час"}" />
          </div>
          <div class="field">
            <label>Стоимость</label>
            <input name="amount" id="bookingAmountInput" type="number" min="0" step="1" required value="${booking.amount || service.price || 0}" />
          </div>
          <div class="field">
            <label>Сотрудник</label>
            <select name="employee">${activeEmployees().map((user) => `<option value="${user.name}" ${((booking.employee || defaultEmployee) === user.name) ? "selected" : ""}>${user.name}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Статус</label>
            <select name="status">${bookingStatuses.map((item) => `<option value="${item}" ${status === item ? "selected" : ""}>${statusTitle(item)}</option>`).join("")}</select>
          </div>
          <div class="field full">
            <label>Комментарий</label>
            <textarea name="comment">${booking.comment || ""}</textarea>
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

function filteredBookings() {
  return [...state.bookings]
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .filter((booking) => !bookingDateFilter || booking.date === bookingDateFilter)
    .filter((booking) => !bookingStatusFilter || booking.status === bookingStatusFilter)
    .filter((booking) => !bookingServiceFilter || booking.service === bookingServiceFilter);
}

function renderBookings() {
  const bookings = filteredBookings();
  const services = [...new Set([...state.services, ...state.bookings.map((booking) => booking.service).filter(Boolean)])];

  return `
    <div class="grid two-col bookings-page">
      <section class="card section">
        <div class="toolbar booking-filters">
          <input id="bookingDateFilter" type="date" value="${bookingDateFilter}" />
          <select id="bookingStatusFilter">
            <option value="">Все статусы</option>
            ${bookingStatuses.map((status) => `<option value="${status}" ${bookingStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <select id="bookingServiceFilter">
            <option value="">Все услуги</option>
            ${services.map((service) => `<option value="${service}" ${bookingServiceFilter === service ? "selected" : ""}>${service}</option>`).join("")}
          </select>
        </div>
        <div class="booking-list">
          ${bookings.map(renderBookingCard).join("") || '<p class="muted">Записей пока нет</p>'}
        </div>
      </section>
      ${renderBookingForm()}
    </div>
  `;
}

function renderBookingCard(booking) {
  const canConfirm = booking.status === "заявка";
  const canStart = ["заявка", "подтверждено"].includes(booking.status);
  const canComplete = booking.status !== "завершено" && booking.status !== "отменено";
  const canCancel = booking.status !== "завершено" && booking.status !== "отменено";
  return `
    <article class="booking-card" data-open-booking="${booking.id}">
      <div class="booking-card-head">
        <div>
          <h3>${booking.client || "Без имени"}</h3>
          <span class="muted">${formatDate(booking.date)} в ${booking.time} · ${booking.duration}</span>
        </div>
        <span class="status-pill status-${booking.status.replaceAll(" ", "-")}">${booking.status}</span>
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
  const selectedService = booking.service || catalogServices()[0]?.name || "";
  const priceRule = servicePriceRule(selectedService);
  const amountValue = booking.amount || priceRule.price || "";
  const defaultUser = currentUser()?.name || state.users[0]?.name || "";

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
        <div class="field full">
          <label>Услуга</label>
          <select name="service" id="serviceSelect" required>
            ${catalogGroups()
              .map((group) => {
                const options = catalogServices()
                  .filter((service) => service.categoryId === group.id)
                  .map((service) => `<option value="${service.name}" ${selectedService === service.name ? "selected" : ""}>${service.name}</option>`)
                  .join("");
                return options ? `<optgroup label="${group.name}">${options}</optgroup>` : "";
              })
              .join("")}
          </select>
        </div>
        <div class="field">
          <label>Дата</label>
          <input name="date" type="date" required value="${booking.date || new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="field">
          <label>Время</label>
          <input name="time" type="time" required value="${booking.time || "12:00"}" />
        </div>
        <div class="field">
          <label>Длительность</label>
          <input name="duration" value="${booking.duration || "1 час"}" />
        </div>
        <div class="field">
          <label>Стоимость</label>
          <input name="amount" id="amountInput" type="number" min="${priceRule.min}" step="1" required value="${amountValue}" ${priceRule.mode === "fixed" ? "readonly" : ""} />
          <span class="field-note" id="priceHint">${priceRule.hint}</span>
        </div>
        <div class="field">
          <label>Сотрудник</label>
          <select name="employee">${state.users.map((user) => `<option ${((booking.employee || defaultUser) === user.name) ? "selected" : ""}>${user.name}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Статус</label>
          <select name="status">${bookingStatuses.map((status) => `<option ${((booking.status || "подтверждено") === status) ? "selected" : ""}>${status}</option>`).join("")}</select>
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
  const priceRule = servicePriceRule(selectedService);
  const amountValue = payment.amount || priceRule.price || "";
  const defaultUser = currentUser()?.name || state.users[0]?.name || "";
  const selectedSoundEngineer = payment.soundEngineer || payment.employee || defaultUser;
  const selectedPerformer = payment.performer || payment.employee || defaultUser;

  return `
    <div class="grid two-col">
      <section class="card section">
        <div class="toolbar">
          <input id="searchPayments" placeholder="Поиск по клиенту, услуге, исполнителю или звукорежу" value="${clientFilter}" />
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th><th>Клиент</th><th>Услуга</th><th>Сумма</th><th>Оплата</th><th>Исполнитель / звукореж</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(renderPaymentRow).join("") || '<tr><td colspan="7">Платежей пока нет</td></tr>'}
            </tbody>
          </table>
        </div>
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
            <label>Услуга</label>
            <select name="service" id="serviceSelect" required>
              ${catalogGroups()
                .map((group) => {
                  const options = catalogServices()
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
  return `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td><strong>${item.client}</strong><br><span class="muted">${item.comment || ""}</span></td>
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
    .sort((a, b) => b[1] - a[1])
    .filter(([name]) => !clientFilter || name.toLowerCase().includes(clientFilter.toLowerCase()));
  if (selectedClientName) return renderClientDetail(selectedClientName);

  return `
    <section class="card section">
      <div class="toolbar">
        <input id="searchPayments" placeholder="Найти клиента" value="${clientFilter}" />
      </div>
      <div class="list">
        ${clients
          .map(([name, total]) => renderClientCard(name, total))
          .join("") || "Клиентов пока нет"}
      </div>
    </section>
  `;
}

function renderClientCard(name, total) {
  const stats = clientStats(name);
  const lastLabel = stats.lastDate ? formatDate(stats.lastDate) : "пока нет";
  return `
    <button class="list-item client-item" data-client="${encodeURIComponent(name)}">
      <div>
        <h3>${name}</h3>
        <span class="muted">Посещений: ${stats.visits}. Последний визит: ${lastLabel}</span>
        <div class="muted">Записей в истории: ${stats.bookings.length}</div>
      </div>
      <strong>${money(total)}</strong>
    </button>
  `;
}

function renderClientDetail(name) {
  const stats = clientStats(name);
  const history = stats.payments.sort((a, b) => b.date.localeCompare(a.date));
  const bookingHistory = stats.bookings.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const total = stats.total;

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
        <div class="table-wrap">
          <table class="budget-table">
            <thead>
              <tr>
                <th>Дата</th><th>Клиент</th><th>Услуга</th><th>Сумма</th><th>Распределение</th><th>Вне копилок</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${budget.rows.map(renderBudgetRow).join("") || '<tr><td colspan="7">Платежей пока нет</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
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
  const payouts = [...state.payouts].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 4);
  if (!payouts.length) return '<p class="muted payout-empty">Журнал выплат пока пуст</p>';
  return `
    <div class="payout-history">
      <h3>Последние выплаты</h3>
      ${payouts
        .map(
          (payout) => `
            <div class="payout-history-row">
              <span>${formatDate(payout.paidAt.slice(0, 10))}</span>
              <strong>${payout.recipient}<small>${payout.service}</small></strong>
              <div class="payout-history-amount">
                <em>${money(payout.amount)}</em>
                <b class="payout-status">${payout.status}</b>
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
  const catalogItem = serviceCatalog.find((item) => item.name === serviceName);
  const rule = budgetRules[catalogItem?.category || classifyService(serviceName)];
  const amount = catalogItem?.price || rule?.base || 0;
  if (payoutType === "Исполнитель") return Math.round(amount * 0.4);
  if (rule?.soundRate) return serviceHours({ service: serviceName, amount }, rule) * rule.soundRate;
  return 0;
}

function renderPayoutModal() {
  const defaultService = serviceCatalog.find((service) => service.category === "recording")?.name || state.services[0] || "";
  const available = availableOutsideBudget();
  const defaultAmount = Math.min(payoutAmountForService(defaultService, "Звукореж"), available);
  return `
    <div class="modal-backdrop" data-action="closePayout">
      <section class="card modal" role="dialog" aria-modal="true" aria-label="Новая выплата">
        <div class="modal-head">
          <div>
            <h2>Новая выплата</h2>
            <p class="muted">Фиксируем выплату звукорежу или исполнителю для отчёта.</p>
          </div>
          <button class="icon-btn" type="button" data-action="closePayout">×</button>
        </div>
        <form id="payoutForm" class="form-grid">
          <div class="field">
            <label>Кому выплатили</label>
            <input name="recipient" list="payoutRecipients" required placeholder="Имя звукаря или исполнителя" />
            <datalist id="payoutRecipients">
              ${state.users.map((user) => `<option value="${user.name}"></option>`).join("")}
            </datalist>
          </div>
          <div class="field">
            <label>Тип выплаты</label>
            <select name="payoutType" id="payoutType">
              <option>Звукореж</option>
              <option>Исполнитель</option>
            </select>
          </div>
          <div class="field full">
            <label>Услуга</label>
            <select name="service" id="payoutService">
              ${state.services.map((service) => `<option ${service === defaultService ? "selected" : ""}>${service}</option>`).join("")}
            </select>
            <span class="field-note">Сумма подставляется по ставке, но её можно изменить вручную.</span>
          </div>
          <div class="field">
            <label>Сумма</label>
            <input name="amount" id="payoutAmount" type="number" min="1" max="${available}" step="1" required value="${defaultAmount}" />
            <span class="field-note" id="payoutAvailableHint">Доступно к выплате: ${money(available)}</span>
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
            <textarea name="comment" placeholder="Например: закрыли смену за вчера"></textarea>
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
          ["profile", "Профиль"]
        ].map(([key, label]) => `<button class="${settingsTab === key ? "active" : ""}" data-settings-tab="${key}">${label}</button>`).join("")}
      </div>
      ${settingsTab === "services" ? renderServiceSettings() : ""}
      ${settingsTab === "employees" ? renderEmployeeSettings() : ""}
      ${settingsTab === "profile" ? renderProfileSettings() : ""}
    </section>
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
            <button class="icon-btn" title="Сохранить" data-save-service-item="${service.id}" type="button">✓</button>
            <button class="icon-btn" title="Удалить" data-delete-service-item="${service.id}" type="button">×</button>
          </form>
        `).join("") || '<p class="muted">Услуг пока нет</p>'}
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
          ${state.users.map(renderEmployeeCard).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderEmployeeCard(user) {
  return `
    <form class="employee-card" data-user-row="${user.id}" style="--employee-color:${user.color || "#ff6633"}">
      <div class="employee-card-head">
        <strong>${user.name}</strong>
        <span>${user.active === false ? "неактивен" : "активен"}</span>
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
  return `<div class="list">${entries.map(([label, total]) => `<div class="list-item"><span>${label}</span><strong>${money(total)}</strong></div>`).join("") || "Данных пока нет"}</div>`;
}

function renderBars(entries) {
  const max = Math.max(...entries.map(([, total]) => total), 1);
  return `<div class="bars">${entries.map(([label, total]) => `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (total / max) * 100)}%"></div></div><strong>${money(total)}</strong></div>`).join("") || "Данных пока нет"}</div>`;
}

function bookingFromForm(data) {
  return {
    id: data.id || crypto.randomUUID(),
    date: data.date,
    time: data.time,
    duration: data.duration.trim() || "1 час",
    client: data.client.trim(),
    phone: data.phone.trim(),
    telegram: data.telegram.trim(),
    service: data.service,
    amount: Number(data.amount || 0),
    employee: data.employee || "",
    comment: data.comment.trim(),
    status: bookingStatuses.includes(data.status) ? data.status : "подтверждено",
    paymentId: state.bookings.find((booking) => booking.id === data.id)?.paymentId || ""
  };
}

function upsertClientFromBooking(booking) {
  const name = String(booking.client || "").trim();
  if (!name) return;
  const existing = state.clients.find((client) => client.name === name);
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name,
    phone: booking.phone || existing?.phone || "",
    telegram: booking.telegram || existing?.telegram || "",
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
  const category = classifyService(booking.service);
  const soundEngineer = ["recording", "studioProduction"].includes(category) ? booking.employee : "";
  const performer = category === "online" ? booking.employee : "";
  return {
    id: crypto.randomUUID(),
    date: booking.date,
    client: booking.client,
    service: booking.service,
    amount: Number(booking.amount || 0),
    method: "По записи",
    comment: booking.comment ? `Запись: ${booking.comment}` : "Запись завершена",
    soundEngineer,
    performer,
    employee: soundEngineer || performer || booking.employee || "",
    bookingId: booking.id
  };
}

function completeBooking(bookingId) {
  const booking = state.bookings.find((item) => item.id === bookingId);
  if (!booking) return;

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
      if (view !== "clients") selectedClientName = null;
      render();
    });
  });

  document.querySelectorAll("[data-action='openBookingModal']").forEach((button) => {
    button.addEventListener("click", () => {
      editingBookingId = null;
      bookingSlotDraft = null;
      bookingModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", () => {
      state.sessionUserId = null;
      saveState();
      render();
    });
  });
}

function bindViewEvents() {
  document.querySelector("[data-action='prevWeek']")?.addEventListener("click", () => {
    calendarWeekStart = addDays(calendarWeekStart, -7);
    render();
  });

  document.querySelector("[data-action='nextWeek']")?.addEventListener("click", () => {
    calendarWeekStart = addDays(calendarWeekStart, 7);
    render();
  });

  document.querySelector("[data-action='todayWeek']")?.addEventListener("click", () => {
    calendarWeekStart = weekStart(new Date().toISOString().slice(0, 10));
    render();
  });

  document.querySelectorAll("[data-calendar-slot]").forEach((slot) => {
    slot.addEventListener("click", () => {
      const [date, time] = slot.dataset.calendarSlot.split("|");
      editingBookingId = null;
      bookingSlotDraft = { date, time, status: "подтверждено" };
      bookingModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-calendar-booking]").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      editingBookingId = card.dataset.calendarBooking;
      bookingSlotDraft = null;
      bookingModalOpen = true;
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
    const service = serviceByName(event.target.value);
    if (!service) return;
    const amount = document.querySelector("#bookingAmountInput");
    const duration = document.querySelector("#bookingDurationInput");
    if (amount) amount.value = service.price || 0;
    if (duration) duration.value = service.duration || "1 час";
  });

  document.querySelector("#bookingModalForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const booking = bookingFromForm(data);
    if (data.id) {
      state.bookings = state.bookings.map((item) => (item.id === data.id ? booking : item));
    } else {
      state.bookings.push(booking);
    }
    upsertClientFromBooking(booking);
    if (booking.status === "завершено") completeBooking(booking.id);
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
    state.bookings = state.bookings.map((booking) => (booking.id === editingBookingId ? { ...booking, status: "отменено" } : booking));
    bookingModalOpen = false;
    editingBookingId = null;
    saveState();
    render();
  });

  document.querySelector("[data-action='deleteBookingFromModal']")?.addEventListener("click", () => {
    if (!editingBookingId || !confirm("Удалить запись?")) return;
    state.bookings = state.bookings.filter((booking) => booking.id !== editingBookingId);
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

  document.querySelector("#bookingDateFilter")?.addEventListener("change", (event) => {
    bookingDateFilter = event.target.value;
    render();
  });

  document.querySelector("#bookingStatusFilter")?.addEventListener("change", (event) => {
    bookingStatusFilter = event.target.value;
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
      mode: "fixed"
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
          ? { ...service, name: data.name.trim(), categoryId: data.categoryId, price: Number(data.price || 0), duration: data.duration.trim() || "1 час", order: Number(data.order || service.order) }
          : service
      );
      syncServicesFromCatalog();
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete-service-item]").forEach((button) => {
    button.addEventListener("click", () => {
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
    applyServicePrice(event.target.value);
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
    payoutModalOpen = true;
    render();
  });

  document.querySelectorAll("[data-action='closePayout']").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target !== button && button.classList.contains("modal-backdrop")) return;
      payoutModalOpen = false;
      render();
    });
  });

  document.querySelector("#payoutService")?.addEventListener("change", updatePayoutAmount);
  document.querySelector("#payoutType")?.addEventListener("change", updatePayoutAmount);

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
      state.payouts = state.payouts.filter((payout) => payout.id !== button.dataset.cancelPayout);
      saveState();
      render();
    });
  });

  document.querySelector("#payoutForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const amount = Number(data.amount);
    const available = availableOutsideBudget();
    if (!amount || amount <= 0) {
      alert("Укажи сумму выплаты больше нуля.");
      return;
    }
    if (amount > available) {
      alert(`Сейчас доступно к выплате только ${money(available)}. Запланированные выплаты тоже резервируют деньги.`);
      return;
    }
    state.payouts.push({
      id: crypto.randomUUID(),
      recipient: data.recipient.trim(),
      payoutType: data.payoutType,
      service: data.service,
      amount,
      method: data.method,
      paidAt: data.paidAt,
      status: data.status,
      comment: data.comment.trim(),
      createdBy: currentUser()?.name || ""
    });
    payoutModalOpen = false;
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
      bookingId: previousPayment?.bookingId || ""
    };
    if (data.id) {
      state.payments = state.payments.map((item) => (item.id === data.id ? payment : item));
    } else {
      state.payments.push(payment);
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
      if (event.target.closest("button")) return;
      editingBookingId = card.dataset.openBooking;
      bookingModalOpen = true;
      render();
    });
  });

  document.querySelectorAll("[data-booking-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const bookingId = button.dataset.bookingStatus;
      const status = button.dataset.status;
      if (status === "завершено") {
        completeBooking(bookingId);
      } else {
        state.bookings = state.bookings.map((booking) => (booking.id === bookingId ? { ...booking, status } : booking));
      }
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete-booking]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("Удалить запись?")) return;
      state.bookings = state.bookings.filter((item) => item.id !== button.dataset.deleteBooking);
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

  document.querySelector("#serviceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const service = new FormData(event.target).get("service").trim();
    if (service && !state.services.includes(service)) {
      state.services.push(service);
      saveState();
      render();
    }
  });

  document.querySelectorAll("[data-remove-service]").forEach((button) => {
    button.addEventListener("click", () => {
      state.services = state.services.filter((service) => service !== button.dataset.removeService);
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
      state.users = state.users.filter((user) => user.id !== button.dataset.removeUser);
      saveState();
      render();
    });
  });
}

render();
