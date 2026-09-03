import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

let server = null;
let baseUrl = '';

export async function startTestServer(app) {
  return new Promise((resolve) => {
    server = createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve({ server, baseUrl });
    });
  });
}

export async function stopTestServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  clearTestData();
}

export function clearTestData() {
  if (fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]');
  }
  if (fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, '[]');
  }
  if (fs.existsSync(ACCOUNTS_FILE)) {
    fs.writeFileSync(ACCOUNTS_FILE, '[]');
  }
}

export async function fetchWithCookies(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.cookies) {
    headers.Cookie = options.cookies;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual',
  });

  const setCookie = response.headers.get('set-cookie');
  const data = await response.json().catch(() => ({}));

  return {
    status: response.status,
    headers: response.headers,
    data,
    cookies: setCookie,
  };
}

export async function registerUser(baseUrl, userData) {
  return fetchWithCookies(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function loginUser(baseUrl, email, password, rememberMe = false) {
  return fetchWithCookies(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
  });
}

export async function authenticatedRequest(baseUrl, cookies, path, options = {}) {
  return fetchWithCookies(`${baseUrl}${path}`, {
    ...options,
    cookies,
  });
}

export async function createTestUser(baseUrl, overrides = {}) {
  const userData = {
    email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`,
    password: 'TestPass123!',
    name: 'Test User',
    ...overrides,
  };
  const result = await registerUser(baseUrl, userData);
  return { ...userData, ...result.data?.user };
}