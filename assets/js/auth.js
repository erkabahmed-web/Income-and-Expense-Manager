import { getUsers, saveSessionUserId, saveUsers } from "./storage.js";

const HASH_ITERATIONS = 150_000;

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure password hashing is unavailable. Open this app using localhost or HTTPS.");
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: HASH_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toBase64(bits);
}

function userForSession(user) {
  return { id: user.id, email: user.email };
}

export async function signUp(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = getUsers();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("An account with this email already exists.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    salt: toBase64(salt),
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, user]);
  saveSessionUserId(user.id);
  return userForSession(user);
}

export async function logIn(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getUsers().find((item) => item.email === normalizedEmail);
  if (!user) throw new Error("Email or password is incorrect.");
  const actualHash = await hashPassword(password, Uint8Array.from(atob(user.salt), (char) => char.charCodeAt(0)));
  if (actualHash !== user.passwordHash) throw new Error("Email or password is incorrect.");
  saveSessionUserId(user.id);
  return userForSession(user);
}
