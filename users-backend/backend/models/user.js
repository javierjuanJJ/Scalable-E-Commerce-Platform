import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

let usersCache = null;

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

function invalidateCache() {
  usersCache = null;
}

function omitPasswordHash(user) {
  const { passwordHash, passwordResetToken, passwordResetExpires, emailVerificationToken, ...safeUser } = user;
  return safeUser;
}

export const userModel = {
  async create(userData) {
    const users = getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existingUser) {
      const error = new Error('Email already exists');
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }

    const newUser = {
      id: crypto.randomUUID(),
      email: userData.email.toLowerCase(),
      passwordHash: userData.passwordHash,
      name: userData.name || null,
      avatarUrl: null,
      role: 'USER',
      emailVerified: false,
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
      passwordResetToken: null,
      passwordResetExpires: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    users.push(newUser);
    atomicWrite(USERS_FILE, users);
    invalidateCache();
    return omitPasswordHash(newUser);
  },

  async findByEmail(email) {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && !u.deletedAt);
    return user ? omitPasswordHash(user) : null;
  },

  async findById(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id && !u.deletedAt);
    return user ? omitPasswordHash(user) : null;
  },

  async findByIdWithPassword(id) {
    const users = getUsers();
    const user = users.find(u => u.id === id && !u.deletedAt);
    return user || null;
  },

  async update(id, data) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id && !u.deletedAt);
    if (index === -1) return null;

    const allowedFields = ['name', 'avatarUrl', 'role', 'emailVerified', 'passwordHash', 'passwordResetToken', 'passwordResetExpires'];
    const updates = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        updates[key] = data[key];
      }
    }

    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    atomicWrite(USERS_FILE, users);
    invalidateCache();
    return omitPasswordHash(users[index]);
  },

  async delete(id) {
    const users = getUsers();
    const index = users.findIndex(u => u.id === id && !u.deletedAt);
    if (index === -1) return false;

    users[index] = {
      ...users[index],
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    atomicWrite(USERS_FILE, users);
    invalidateCache();
    return true;
  },

  async findAll({ page = 1, limit = 20, search, role, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const users = getUsers();
    let filtered = users.filter(u => !u.deletedAt);

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(searchLower) ||
        (u.name && u.name.toLowerCase().includes(searchLower))
      );
    }

    if (role) {
      filtered = filtered.filter(u => u.role === role);
    }

    const sortFields = ['createdAt', 'updatedAt', 'email', 'name', 'role'];
    const validSortBy = sortFields.includes(sortBy) ? sortBy : 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    filtered.sort((a, b) => {
      const aVal = a[validSortBy];
      const bVal = b[validSortBy];
      if (aVal < bVal) return validSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return validSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return {
      data: paginated.map(omitPasswordHash),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async count({ search, role }) {
    const users = getUsers();
    let filtered = users.filter(u => !u.deletedAt);

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(searchLower) ||
        (u.name && u.name.toLowerCase().includes(searchLower))
      );
    }

    if (role) {
      filtered = filtered.filter(u => u.role === role);
    }

    return filtered.length;
  },
};