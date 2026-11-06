import { logIn, signUp } from "./auth.js";
import { clearSession, getPreferences, getSessionUserId, getUsers, savePreferences } from "./storage.js";
import { CATEGORIES, createTransaction, deleteTransaction, listTransactions, updateTransaction } from "./transactions.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const currencyNames = new Intl.DisplayNames([navigator.language], { type: "currency" });
const currencies = Intl.supportedValuesOf("currency")
  .map((code) => ({ code, name: currencyNames.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
const supportedCurrencies = new Set(currencies.map(({ code }) => code));

let currentUser = null;
let activeView = "dashboard";
let period = "day";
let currency = new Intl.NumberFormat(navigator.language, { style: "currency", currency: "USD" });
let transactionType = "expense";
let editingId = null;
let toastTimer;

function localDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function displayDate(dateString) {
  return dateFormatter.format(new Date(`${dateString}T12:00:00`));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function showAuthError(message = "") {
  const error = $("#auth-error");
  error.textContent = message;
  error.hidden = !message;
}

function setAuthMode(mode) {
  const login = mode === "login";
  $("#login-tab").classList.toggle("is-active", login);
  $("#signup-tab").classList.toggle("is-active", !login);
  $("#login-tab").setAttribute("aria-selected", String(login));
  $("#signup-tab").setAttribute("aria-selected", String(!login));
  $("#auth-title").textContent = login ? "A clearer view of every day." : "Start with a clearer picture.";
  $("#auth-password").autocomplete = login ? "current-password" : "new-password";
  $("#auth-submit").textContent = login ? "Log in" : "Create account";
  showAuthError();
}

function renderApp(user) {
  currentUser = user;
  const savedCurrency = getPreferences(user.id).currency ?? "USD";
  setCurrency(savedCurrency, false);
  $("#auth-screen").hidden = true;
  $("#app-screen").hidden = false;
  $("#user-email").textContent = user.email;
  $("#user-avatar").textContent = user.email.charAt(0).toUpperCase();
  $("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  $("#summary-day").value = localDateString();
  $("#summary-month").value = localDateString().slice(0, 7);
  populateCategoryFilter();
  renderCurrencyOptions();
  renderAll();
}

function setCurrency(code, save = true) {
  if (!supportedCurrencies.has(code)) {
    throw new Error(`The saved currency "${code}" is not supported by this browser. Choose another currency in Settings.`);
  }
  const formatter = new Intl.NumberFormat(navigator.language, { style: "currency", currency: code });
  if (save && currentUser) {
    savePreferences(currentUser.id, { ...getPreferences(currentUser.id), currency: code });
  }
  currency = formatter;
}

function renderCurrencyOptions(search = "") {
  const query = search.trim().toLocaleLowerCase();
  const selected = currency.resolvedOptions().currency;
  const matches = currencies.filter(({ code, name }) => (
    `${code} ${name}`.toLocaleLowerCase().includes(query)
  ));
  const options = matches.map(({ code, name }) => (
    `<option value="${code}">${escapeHtml(name)} (${code})</option>`
  ));
  if (selected && !matches.some(({ code }) => code === selected)) {
    const name = currencyNames.of(selected) || selected;
    options.unshift(`<option value="${selected}">${escapeHtml(name)} (${selected})</option>`);
  }
  if (matches.length === 0) options.push('<option value="" disabled>No matching currencies</option>');
  $("#currency-select").innerHTML = options.join("");
  $("#currency-select").value = selected;
}

function handleFatalError(error) {
  console.error(error);
  showToast(error.message || "Something went wrong. Please try again.");
}

function renderAll() {
  if (!currentUser) return;
  renderSummary();
  renderRecent();
  renderTransactions();
}

function selectedTransactions() {
  const selected = period === "day" ? $("#summary-day").value : $("#summary-month").value;
  if (!selected) return [];
  return listTransactions(currentUser.id).filter((transaction) => (
    period === "day" ? transaction.date === selected : transaction.date.startsWith(selected)
  ));
}

function renderSummary() {
  const transactions = selectedTransactions();
  const income = transactions.filter((item) => item.type === "income");
  const expenses = transactions.filter((item) => item.type === "expense");
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const periodLabel = period === "day" ? "selected day" : "selected month";
  $("#balance-total").textContent = currency.format(totalIncome - totalExpenses);
  $("#income-total").textContent = currency.format(totalIncome);
  $("#expense-total").textContent = currency.format(totalExpenses);
  $("#balance-caption").textContent = `For the ${periodLabel}`;
  $("#income-caption").textContent = `${income.length} ${income.length === 1 ? "entry" : "entries"} in this period`;
  $("#expense-caption").textContent = `${expenses.length} ${expenses.length === 1 ? "entry" : "entries"} in this period`;
}

function transactionMarkup(item, withActions = false) {
  const isIncome = item.type === "income";
  const title = item.note || item.category;
  return `<div class="transaction-row">
    <span class="transaction-symbol ${isIncome ? "symbol-income" : "symbol-expense"}" aria-hidden="true">${isIncome ? "↙" : "↗"}</span>
    <span class="transaction-main"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(item.category)} · ${displayDate(item.date)}</small></span>
    <span class="transaction-amount ${isIncome ? "amount-income" : "amount-expense"}">${isIncome ? "+" : "−"}${currency.format(item.amount)}</span>
    ${withActions ? `<span class="row-actions"><button type="button" class="row-action" data-edit="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(title)}">Edit</button><button type="button" class="row-action row-delete" data-delete="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(title)}">Delete</button></span>` : ""}
  </div>`;
}

function renderRecent() {
  const recent = listTransactions(currentUser.id).slice(0, 5);
  $("#recent-transactions").innerHTML = recent.length
    ? recent.map((item) => transactionMarkup(item)).join("")
    : `<div class="empty-state compact-empty"><span class="empty-icon" aria-hidden="true">↕</span><strong>No transactions yet</strong><p>Add income or an expense to get started.</p><button class="button button-secondary" type="button" data-open-transaction>Add transaction</button></div>`;
}

function populateCategoryFilter() {
  const categories = [...new Set(Object.values(CATEGORIES).flat())].sort();
  $("#category-filter").innerHTML = `<option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
}

function renderTransactions() {
  const search = $("#transaction-search").value.trim().toLowerCase();
  const type = $("#type-filter").value;
  const category = $("#category-filter").value;
  const items = listTransactions(currentUser.id).filter((item) => {
    const matchesSearch = `${item.note} ${item.category} ${item.date}`.toLowerCase().includes(search);
    return matchesSearch && (type === "all" || item.type === type) && (category === "all" || item.category === category);
  });
  $("#transactions-table").innerHTML = items.map((item) => `<tr>
    <td><div class="table-transaction"><span class="transaction-symbol ${item.type === "income" ? "symbol-income" : "symbol-expense"}" aria-hidden="true">${item.type === "income" ? "↙" : "↗"}</span><span><strong>${escapeHtml(item.note || item.category)}</strong><small>${escapeHtml(item.type === "income" ? "Income" : "Expense")}</small></span></div></td>
    <td><span class="category-pill">${escapeHtml(item.category)}</span></td><td class="date-cell">${displayDate(item.date)}</td>
    <td class="table-amount ${item.type === "income" ? "amount-income" : "amount-expense"}">${item.type === "income" ? "+" : "−"}${currency.format(item.amount)}</td>
    <td><div class="row-actions"><button type="button" class="row-action" data-edit="${escapeHtml(item.id)}">Edit</button><button type="button" class="row-action row-delete" data-delete="${escapeHtml(item.id)}">Delete</button></div></td>
  </tr>`).join("");
  $("#transactions-empty").hidden = items.length > 0;
  $("#transactions-table").parentElement.hidden = items.length === 0;
}

function navigate(view) {
  activeView = view;
  $("#dashboard-view").hidden = view !== "dashboard";
  $("#transactions-view").hidden = view !== "transactions";
  $("#settings-view").hidden = view !== "settings";
  $("#page-title").textContent = view === "dashboard" ? "Overview" : view === "transactions" ? "Transactions" : "Settings";
  $(".topbar .add-button").hidden = view === "settings";
  $$("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
}

function setTransactionType(type) {
  transactionType = type;
  $$(".type-option").forEach((button) => button.classList.toggle("is-selected", button.dataset.transactionType === type));
  $("#transaction-category").innerHTML = CATEGORIES[type].map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
}

function openTransaction(transaction = null) {
  editingId = transaction?.id ?? null;
  $("#transaction-form").reset();
  $("#transaction-dialog-title").textContent = transaction ? "Edit transaction" : "Add transaction";
  $("#save-transaction").textContent = transaction ? "Save changes" : "Save transaction";
  setTransactionType(transaction?.type ?? "expense");
  $("#transaction-amount").value = transaction?.amount ?? "";
  $("#transaction-category").value = transaction?.category ?? CATEGORIES[transactionType][0];
  $("#transaction-date").value = transaction?.date ?? localDateString();
  $("#transaction-note").value = transaction?.note ?? "";
  $("#transaction-error").hidden = true;
  $("#transaction-dialog").showModal();
  $("#transaction-amount").focus();
}

function closeTransaction() {
  $("#transaction-dialog").close();
  editingId = null;
}

$("#login-tab").addEventListener("click", () => setAuthMode("login"));
$("#signup-tab").addEventListener("click", () => setAuthMode("signup"));

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showAuthError();
  const mode = $("#signup-tab").classList.contains("is-active") ? "signup" : "login";
  const email = $("#auth-email").value;
  const password = $("#auth-password").value;
  $("#auth-submit").disabled = true;
  $("#auth-submit").textContent = mode === "login" ? "Logging in…" : "Creating account…";
  try {
    const user = mode === "login" ? await logIn(email, password) : await signUp(email, password);
    $("#auth-form").reset();
    renderApp(user);
  } catch (error) {
    showAuthError(error.message || "Unable to authenticate. Please try again.");
  } finally {
    $("#auth-submit").disabled = false;
    $("#auth-submit").textContent = mode === "login" ? "Log in" : "Create account";
  }
});

$$("[data-view]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-transaction]")) openTransaction();
});
$$(".segment").forEach((button) => button.addEventListener("click", () => {
  period = button.dataset.period;
  $$(".segment").forEach((segment) => segment.classList.toggle("is-selected", segment === button));
  $("#day-picker-wrap").hidden = period !== "day";
  $("#month-picker-wrap").hidden = period !== "month";
  renderSummary();
}));
$("#summary-day").addEventListener("change", renderSummary);
$("#summary-month").addEventListener("change", renderSummary);
$("#transaction-search").addEventListener("input", renderTransactions);
$("#type-filter").addEventListener("change", renderTransactions);
$("#category-filter").addEventListener("change", renderTransactions);
$("#currency-search").addEventListener("input", () => renderCurrencyOptions($("#currency-search").value));
$("#currency-select").addEventListener("change", () => {
  try {
    setCurrency($("#currency-select").value);
    renderAll();
    showToast(`Currency changed to ${currencyNames.of(currency.resolvedOptions().currency)}.`);
  } catch (error) {
    handleFatalError(error);
    renderCurrencyOptions($("#currency-search").value);
  }
});

$$(".type-option").forEach((button) => button.addEventListener("click", () => setTransactionType(button.dataset.transactionType)));
$("#transaction-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("#transaction-amount").value);
  const date = $("#transaction-date").value;
  if (!Number.isFinite(amount) || amount <= 0 || !date) {
    $("#transaction-error").textContent = "Enter a valid amount and date.";
    $("#transaction-error").hidden = false;
    return;
  }
  const details = {
    type: transactionType,
    amount,
    category: $("#transaction-category").value,
    date,
    note: $("#transaction-note").value,
  };
  const wasEditing = Boolean(editingId);
  try {
    if (editingId) updateTransaction(currentUser.id, editingId, details);
    else createTransaction(currentUser.id, details);
    closeTransaction();
    renderAll();
    showToast(wasEditing ? "Transaction updated." : "Transaction added.");
  } catch (error) {
    $("#transaction-error").textContent = error.message || "Unable to save this transaction.";
    $("#transaction-error").hidden = false;
  }
});

$("#close-dialog").addEventListener("click", closeTransaction);
$("#cancel-dialog").addEventListener("click", closeTransaction);
$("#transaction-dialog").addEventListener("click", (event) => {
  if (event.target === $("#transaction-dialog")) closeTransaction();
});

$("#transactions-table").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  try {
    if (editButton) {
      const item = listTransactions(currentUser.id).find((transaction) => transaction.id === editButton.dataset.edit);
      if (item) openTransaction(item);
    } else if (deleteButton) {
      if (confirm("Delete this transaction? This cannot be undone.")) {
        deleteTransaction(currentUser.id, deleteButton.dataset.delete);
        renderAll();
        showToast("Transaction deleted.");
      }
    }
  } catch (error) {
    handleFatalError(error);
  }
});

$("#logout-button").addEventListener("click", () => {
  clearSession();
  currentUser = null;
  $("#app-screen").hidden = true;
  $("#auth-screen").hidden = false;
  setAuthMode("login");
});

try {
  const userId = getSessionUserId();
  const user = userId ? getUsers().find((item) => item.id === userId) : null;
  if (user) renderApp({ id: user.id, email: user.email });
  else clearSession();
} catch (error) {
  handleFatalError(error);
}
