const USERS_KEY = "daybook.users.v1";
const SESSION_KEY = "daybook.session.v1";
const TRANSACTIONS_PREFIX = "daybook.transactions.v1.";
const PREFERENCES_PREFIX = "daybook.preferences.v1.";

function readJson(key, fallback) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Saved data for "${key}" is unreadable. Clear this app's browser storage to continue.`, { cause: error });
  }
}

export function getUsers() {
  const users = readJson(USERS_KEY, []);
  if (!Array.isArray(users)) throw new Error("Saved account data is invalid.");
  return users;
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSessionUserId() {
  return localStorage.getItem(SESSION_KEY);
}

export function saveSessionUserId(userId) {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getTransactions(userId) {
  const transactions = readJson(`${TRANSACTIONS_PREFIX}${userId}`, []);
  if (!Array.isArray(transactions)) throw new Error("Saved transaction data is invalid.");
  return transactions;
}

export function saveTransactions(userId, transactions) {
  localStorage.setItem(`${TRANSACTIONS_PREFIX}${userId}`, JSON.stringify(transactions));
}

export function getPreferences(userId) {
  const preferences = readJson(`${PREFERENCES_PREFIX}${userId}`, {});
  if (typeof preferences !== "object" || preferences === null || Array.isArray(preferences)) {
    throw new Error("Saved account preferences are invalid.");
  }
  return preferences;
}

export function savePreferences(userId, preferences) {
  localStorage.setItem(`${PREFERENCES_PREFIX}${userId}`, JSON.stringify(preferences));
}
