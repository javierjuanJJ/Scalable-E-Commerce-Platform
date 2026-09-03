import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

let usersCache = null;
let sessionsCache = null;
let accountsCache = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function atomicWrite(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

function readJsonFile(filePath, defaultValue = []) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    atomicWrite(filePath, defaultValue);
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    atomicWrite(filePath, defaultValue);
    return defaultValue;
  }
}

function getUsers() {
  if (usersCache === null) {
    usersCache = readJsonFile(USERS_FILE);
  }
  return usersCache;
}

function getSessions() {
  if (sessionsCache === null) {
    sessionsCache = readJsonFile(SESSIONS_FILE);
  }
  return sessionsCache;
}

function getAccounts() {
  if (accountsCache === null) {
    accountsCache = readJsonFile(ACCOUNTS_FILE);
  }
  return accountsCache;
}

function invalidateUsersCache() {
  usersCache = null;
}

function invalidateSessionsCache() {
  sessionsCache = null;
}

function invalidateAccountsCache() {
  accountsCache = null;
}

export const jsonAdapter = {
  id: 'json',

  async createUser(user) {
    const users = getUsers();
    const newUser = {
      ...user,
      id: user.id || crypto.randomUUID(),
      createdAt: user.createdAt || new Date(),
      updatedAt: new Date(),
    };
    users.push(newUser);
    atomicWrite(USERS_FILE, users);
    invalidateUsersCache();
    return newUser;
  },

  async getUserById(id) {
    const users = getUsers();
    return users.find(u => u.id === id) || null;
  },

  async getUserByEmail(email) {
    const users = getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async updateUser(id, data) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    users[index] = {
      ...users[index],
      ...data,
      updatedAt: new Date(),
    };
    atomicWrite(USERS_FILE, users);
    invalidateUsersCache();
    return users[index];
  },

  async deleteUser(id) {
    const users = getUsers();
    const filtered = users.filter(u => u.id !== id);
    atomicWrite(USERS_FILE, filtered);
    invalidateUsersCache();
  },

  async createSession(session) {
    const sessions = getSessions();
    const newSession = {
      ...session,
      id: session.id || crypto.randomUUID(),
      createdAt: session.createdAt || new Date(),
      updatedAt: new Date(),
    };
    sessions.push(newSession);
    atomicWrite(SESSIONS_FILE, sessions);
    invalidateSessionsCache();
    return newSession;
  },

  async getSession(token) {
    const sessions = getSessions();
    return sessions.find(s => s.token === token) || null;
  },

  async getSessionsByUserId(userId) {
    const sessions = getSessions();
    return sessions.filter(s => s.userId === userId);
  },

  async updateSession(token, data) {
    const sessions = getSessions();
    const index = sessions.findIndex(s => s.token === token);
    if (index === -1) return null;
    sessions[index] = {
      ...sessions[index],
      ...data,
      updatedAt: new Date(),
    };
    atomicWrite(SESSIONS_FILE, sessions);
    invalidateSessionsCache();
    return sessions[index];
  },

  async deleteSession(token) {
    const sessions = getSessions();
    const filtered = sessions.filter(s => s.token !== token);
    atomicWrite(SESSIONS_FILE, filtered);
    invalidateSessionsCache();
  },

  async deleteUserSessions(userId) {
    const sessions = getSessions();
    const filtered = sessions.filter(s => s.userId !== userId);
    atomicWrite(SESSIONS_FILE, filtered);
    invalidateSessionsCache();
  },

  async createAccount(account) {
    const accounts = getAccounts();
    const newAccount = {
      ...account,
      id: account.id || crypto.randomUUID(),
      createdAt: account.createdAt || new Date(),
      updatedAt: new Date(),
    };
    accounts.push(newAccount);
    atomicWrite(ACCOUNTS_FILE, accounts);
    invalidateAccountsCache();
    return newAccount;
  },

  async getAccountByProviderId(providerId, providerAccountId) {
    const accounts = getAccounts();
    return accounts.find(a => a.providerId === providerId && a.providerAccountId === providerAccountId) || null;
  },

  async getUserAccounts(userId) {
    const accounts = getAccounts();
    return accounts.filter(a => a.userId === userId);
  },

  async updateAccount(id, data) {
    const accounts = getAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) return null;
    accounts[index] = {
      ...accounts[index],
      ...data,
      updatedAt: new Date(),
    };
    atomicWrite(ACCOUNTS_FILE, accounts);
    invalidateAccountsCache();
    return accounts[index];
  },

  async deleteAccount(id) {
    const accounts = getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    atomicWrite(ACCOUNTS_FILE, filtered);
    invalidateAccountsCache();
  },

  async verifyEmail(token) {
    const users = getUsers();
    const index = users.findIndex(u => u.emailVerificationToken === token);
    if (index === -1) return null;
    users[index] = {
      ...users[index],
      emailVerified: true,
      emailVerificationToken: null,
      updatedAt: new Date(),
    };
    atomicWrite(USERS_FILE, users);
    invalidateUsersCache();
    return users[index];
  },

  async getUserByEmailVerificationToken(token) {
    const users = getUsers();
    return users.find(u => u.emailVerificationToken === token) || null;
  },

  async setEmailVerificationToken(userId, token) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;
    users[index] = {
      ...users[index],
      emailVerificationToken: token,
      updatedAt: new Date(),
    };
    atomicWrite(USERS_FILE, users);
    invalidateUsersCache();
    return users[index];
  },

  async requestPasswordReset(email) {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return null;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    users[users.indexOf(user)] = {
      ...user,
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
      updatedAt: new Date(),
    };
    atomicWrite(USERS_FILE, users);
    invalidateUsersCache();
    return { user, token, expiresAt };
  },

  async resetPassword(token, password) {
    const users = getUsers();
    const index = users.findIndex(u => u.passwordResetToken === token && u.passwordResetExpires > new Date());
    if (index === -1) return null;
    users[index] = {
      ...users[index],
      passwordHash: password,
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    };
    atomicWrite(USERS_FILE, users);
    invalidateUsersCache();
    return users[index];
  },
};