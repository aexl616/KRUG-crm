const STORAGE_KEY = "studio-income-app-v1";
const PAYOUT_RESET_VERSION = 2;

const defaultState = {
  sessionUserId: null,
  users: [
    { id: "u1", name: "Я", login: "admin", password: "admin123", role: "admin" },
    { id: "u2", name: "Сотрудник", login: "staff", password: "staff123", role: "staff" }
  ],
  services: ["Запись", "Сведение", "Мастеринг", "Аренда студии"],
  payments: [
    {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      client: "Иван Петров",
      service: "Запись",
      amount: 12000,
      method: "Наличные",
      comment: "Демо-запись",
      employee: "Я"
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
  payouts: [],
  payoutResetVersion: PAYOUT_RESET_VERSION
};

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
let view = "dashboard";
let editingPaymentId = null;
let clientFilter = "";
let selectedClientName = null;
let payoutModalOpen = false;

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

function normalizeState(nextState) {
  const legacyServices = new Set(["Запись", "Сведение", "Мастеринг", "Аренда студии", "Аренда", "Услуги онлайн", "Сведение на студии", "Бит на студии", "Написание бита на студии"]);
  legacyCatalogServices.forEach((service) => legacyServices.add(service));
  const customServices = (nextState.services || []).filter((service) => !legacyServices.has(service) && !extraServices.includes(service));
  const services = new Set([...extraServices, ...customServices]);
  const shouldResetPayouts = nextState.payoutResetVersion !== PAYOUT_RESET_VERSION;
  const payments = (nextState.payments || []).map((payment) => {
    const service = serviceAliases[payment.service] || payment.service;
    const category = classifyService(service);
    const soundEngineer = payment.soundEngineer || (["recording", "studioProduction"].includes(category) ? payment.employee : "") || "";
    const performer = payment.performer || (category === "online" ? payment.employee : "") || "";
    return {
      ...payment,
      service,
      soundEngineer,
      performer,
      employee: payment.employee || soundEngineer || performer || ""
    };
  });
  return {
    ...nextState,
    services: [...services],
    payments,
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
        ${view === "dashboard" ? renderDashboard() : ""}
        ${view === "payments" ? renderPayments() : ""}
        ${view === "clients" ? renderClients() : ""}
        ${view === "budget" ? renderBudget() : ""}
        ${view === "reports" ? renderReports() : ""}
        ${view === "settings" ? renderSettings() : ""}
      </section>
      ${renderMobileTabs()}
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
    ["dashboard", "Главная"],
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
        <button class="btn" data-view="payments">+ Доход</button>
        ${isAdmin() ? '<button class="btn secondary" data-view="settings">Настройки</button>' : ""}
      </div>
    </header>
  `;
}

function pageTitle() {
  return {
    dashboard: "Дашборд",
    payments: "Платежи",
    clients: "Клиенты",
    budget: "Бюджет",
    reports: "Отчёты",
    settings: "Настройки"
  }[view];
}

function pageSubtitle() {
  return {
    dashboard: "Ключевые цифры по доходу студии.",
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
  if (category === "custom") {
    return state.services.filter((service) => !serviceCatalog.some((item) => item.name === service));
  }
  return serviceCatalog.filter((service) => service.category === category).map((service) => service.name);
}

function firstServiceForCategory(category) {
  return servicesForCategory(category)[0] || "";
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
          <button class="quick-action" data-view="payments"><span>+</span>Новый платёж</button>
          <button class="quick-action" data-view="clients"><span>◎</span>Клиенты</button>
          <button class="quick-action" data-view="budget"><span>₽</span>Бюджет</button>
          <button class="quick-action" data-view="reports"><span>↗</span>Отчёт</button>
        </div>
      </section>
    </div>
  `;
}

function renderPayments() {
  const payments = filteredPayments();
  const formTitle = editingPaymentId ? "Редактировать оплату" : "Новая оплата";
  const payment = state.payments.find((item) => item.id === editingPaymentId) || {};
  const selectedCategory = payment.service ? paymentCategory(payment) : "recording";
  const categoryServices = servicesForCategory(selectedCategory);
  if (payment.service && !categoryServices.includes(payment.service)) categoryServices.push(payment.service);
  const selectedService = categoryServices.includes(payment.service) ? payment.service : firstServiceForCategory(selectedCategory);
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
          <div class="field">
            <label>Категория</label>
            <select name="category" id="categorySelect">${serviceCategories.map((category) => `<option value="${category.key}" ${selectedCategory === category.key ? "selected" : ""}>${category.label}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Услуга</label>
            <select name="service" id="serviceSelect" required>${categoryServices.map((service) => `<option ${selectedService === service ? "selected" : ""}>${service}</option>`).join("")}</select>
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
  const clients = sortedEntries(groupSum(state.payments, (item) => item.client)).filter(([name]) => !clientFilter || name.toLowerCase().includes(clientFilter.toLowerCase()));
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
  const history = state.payments.filter((item) => item.client === name).sort((a, b) => b.date.localeCompare(a.date));
  const last = history[0];
  return `
    <button class="list-item client-item" data-client="${encodeURIComponent(name)}">
      <div>
        <h3>${name}</h3>
        <span class="muted">Посещений: ${history.length}. Последний визит: ${formatDate(last.date)}</span>
        <div class="muted">Последний платёж: ${money(last.amount)} · ${last.service}</div>
      </div>
      <strong>${money(total)}</strong>
    </button>
  `;
}

function renderClientDetail(name) {
  const history = state.payments.filter((item) => item.client === name).sort((a, b) => b.date.localeCompare(a.date));
  const total = history.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const last = history[0];

  if (!history.length) {
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
          <p class="muted">Последний визит: ${formatDate(last.date)}. Последний платёж: ${money(last.amount)}.</p>
        </div>
        <div class="client-profile-stats">
          <article><span>Всего</span><strong>${money(total)}</strong></article>
          <article><span>Посещений</span><strong>${history.length}</strong></article>
        </div>
      </div>
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
    <div class="grid two-col">
      <section class="card section">
        <h2>Услуги</h2>
        <form id="serviceForm" class="toolbar">
          <input name="service" placeholder="Новая услуга" required />
          <button class="btn" type="submit">Добавить</button>
        </form>
        <div class="list">
          ${state.services.map((service) => `<div class="list-item"><strong>${service}</strong><button class="icon-btn" data-remove-service="${service}">×</button></div>`).join("")}
        </div>
      </section>
      <section class="card section">
        <h2>Сотрудники</h2>
        <form id="userForm" class="form-grid">
          <div class="field"><label>Имя</label><input name="name" required /></div>
          <div class="field"><label>Логин</label><input name="login" required /></div>
          <div class="field"><label>Пароль</label><input name="password" required /></div>
          <div class="field"><label>Роль</label><select name="role"><option value="staff">Сотрудник</option><option value="admin">Админ</option></select></div>
          <button class="btn full" type="submit">Добавить сотрудника</button>
        </form>
        <div class="list" style="margin-top:14px">
          ${state.users.map((user) => `<div class="list-item"><div><strong>${user.name}</strong><br><span class="muted">${user.login} · ${user.role === "admin" ? "админ" : "сотрудник"}</span></div>${user.id !== currentUser().id ? `<button class="icon-btn" data-remove-user="${user.id}">×</button>` : ""}</div>`).join("")}
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

function bindCommonEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.view;
      editingPaymentId = null;
      if (view !== "clients") selectedClientName = null;
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
  document.querySelector("#searchPayments")?.addEventListener("input", (event) => {
    clientFilter = event.target.value;
    selectedClientName = null;
    render();
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
      employee: soundEngineer || performer || ""
    };
    if (data.id) {
      state.payments = state.payments.map((item) => (item.id === data.id ? payment : item));
    } else {
      state.payments.push(payment);
    }
    editingPaymentId = null;
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

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editingPaymentId = button.dataset.edit;
      view = "payments";
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
    state.users.push({ id: crypto.randomUUID(), ...data });
    saveState();
    render();
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
