import { getTransactions, saveTransactions } from "./storage.js";

export const CATEGORIES = {
  expense: ["Food", "Transport", "Housing", "Utilities", "Shopping", "Health", "Entertainment", "Other"],
  income: ["Salary", "Freelance", "Investment", "Gift", "Other"],
};

function persist(userId, transactions) {
  saveTransactions(userId, transactions);
  return transactions;
}

export function listTransactions(userId) {
  return getTransactions(userId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function createTransaction(userId, details) {
  const transaction = {
    id: crypto.randomUUID(),
    type: details.type,
    amount: Number(details.amount),
    category: details.category,
    date: details.date,
    note: details.note.trim(),
    createdAt: new Date().toISOString(),
  };
  persist(userId, [...getTransactions(userId), transaction]);
}

export function updateTransaction(userId, id, details) {
  const transactions = getTransactions(userId);
  const index = transactions.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("This transaction no longer exists.");
  transactions[index] = {
    ...transactions[index],
    type: details.type,
    amount: Number(details.amount),
    category: details.category,
    date: details.date,
    note: details.note.trim(),
  };
  persist(userId, transactions);
}

export function deleteTransaction(userId, id) {
  const transactions = getTransactions(userId);
  if (!transactions.some((item) => item.id === id)) throw new Error("This transaction no longer exists.");
  persist(userId, transactions.filter((item) => item.id !== id));
}
