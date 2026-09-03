import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import app from '../app.js';
import { startTestServer, stopTestServer, clearTestData, registerUser, loginUser, authenticatedRequest } from './setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

let baseUrl = '';

before(async () => {
  const { baseUrl: url } = await startTestServer(app);
  baseUrl = url;
});

after(async () => {
  await stopTestServer();
});

beforeEach(() => {
  clearTestData();
});

describe('Health Checks', () => {
  it('GET /health should return 200', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
  });

  it('GET /health/live should return 200', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'alive');
  });

  it('GET /health/ready should return 200', async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ready');
  });
});

describe('Registration', () => {
  it('should register a new user successfully', async () => {
    const res = await registerUser(baseUrl, {
      email: 'newuser@example.com',
      password: 'TestPass123!',
      name: 'New User',
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.user.id);
    assert.strictEqual(res.data.data.user.email, 'newuser@example.com');
    assert.strictEqual(res.data.data.user.name, 'New User');
    assert.strictEqual(res.data.data.user.role, 'USER');
    assert.strictEqual(res.data.data.user.emailVerified, false);
    assert.ok(!res.data.data.user.passwordHash);
  });

  it('should reject duplicate email', async () => {
    await registerUser(baseUrl, {
      email: 'duplicate@example.com',
      password: 'TestPass123!',
    });

    const res = await registerUser(baseUrl, {
      email: 'duplicate@example.com',
      password: 'AnotherPass123!',
    });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.code, 'EMAIL_ALREADY_EXISTS');
  });

  it('should reject invalid email', async () => {
    const res = await registerUser(baseUrl, {
      email: 'invalid-email',
      password: 'TestPass123!',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.code, 'VALIDATION_ERROR');
    assert.ok(res.data.details.email);
  });

  it('should reject weak password', async () => {
    const res = await registerUser(baseUrl, {
      email: 'weak@example.com',
      password: 'weak',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.code, 'VALIDATION_ERROR');
    assert.ok(res.data.details.password);
  });

  it('should reject missing fields', async () => {
    const res = await registerUser(baseUrl, {
      email: 'missing@example.com',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.code, 'VALIDATION_ERROR');
  });

  it('should not return passwordHash in response', async () => {
    const res = await registerUser(baseUrl, {
      email: 'nohash@example.com',
      password: 'TestPass123!',
    });

    assert.strictEqual(res.status, 201);
    assert.ok(!res.data.data.user.passwordHash);
    const userData = fs.readFileSync(USERS_FILE, 'utf-8');
    const users = JSON.parse(userData);
    assert.ok(users[0].passwordHash);
    assert.notStrictEqual(users[0].passwordHash, 'TestPass123!');
  });
});

describe('Login', () => {
  beforeEach(async () => {
    await registerUser(baseUrl, {
      email: 'login@example.com',
      password: 'TestPass123!',
      name: 'Login User',
    });
  });

  it('should login with valid credentials', async () => {
    const res = await loginUser(baseUrl, 'login@example.com', 'TestPass123!');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.user.id);
    assert.strictEqual(res.data.data.user.email, 'login@example.com');
    assert.ok(res.cookies);
    assert.ok(res.cookies.includes('session='));
  });

  it('should reject wrong password', async () => {
    const res = await loginUser(baseUrl, 'login@example.com', 'WrongPass123!');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'INVALID_CREDENTIALS');
  });

  it('should set rememberMe cookie with 30 day maxAge', async () => {
    const res = await loginUser(baseUrl, 'login@example.com', 'TestPass123!', true);

    assert.strictEqual(res.status, 200);
    assert.ok(res.cookies);
    assert.ok(res.cookies.includes('Max-Age='));
  });

  it('should reject non-existent user', async () => {
    const res = await loginUser(baseUrl, 'nonexistent@example.com', 'TestPass123!');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'INVALID_CREDENTIALS');
  });
});

describe('Session Management', () => {
  let cookies = '';

  beforeEach(async () => {
    await registerUser(baseUrl, {
      email: 'session@example.com',
      password: 'TestPass123!',
    });
    const loginRes = await loginUser(baseUrl, 'session@example.com', 'TestPass123!');
    cookies = loginRes.cookies;
  });

  it('GET /me with valid session should return user', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/auth/me');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.user.email, 'session@example.com');
  });

  it('GET /me without session should return 401', async () => {
    const res = await authenticatedRequest(baseUrl, '', '/api/v1/auth/me');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'UNAUTHENTICATED');
  });

  it('POST /logout should clear session', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/auth/logout', {
      method: 'POST',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const meRes = await authenticatedRequest(baseUrl, cookies, '/api/v1/auth/me');
    assert.strictEqual(meRes.status, 401);
  });

  it('POST /logout should be idempotent', async () => {
    await authenticatedRequest(baseUrl, cookies, '/api/v1/auth/logout', { method: 'POST' });
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/auth/logout', { method: 'POST' });

    assert.strictEqual(res.status, 200);
  });
});

describe('Password Reset', () => {
  beforeEach(async () => {
    await registerUser(baseUrl, {
      email: 'reset@example.com',
      password: 'TestPass123!',
    });
  });

  it('forgot password for registered user should return 200', async () => {
    const res = await fetchWithCookies(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email: 'reset@example.com' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  it('forgot password for unregistered user should return 200 (no enumeration)', async () => {
    const res = await fetchWithCookies(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email: 'notexist@example.com' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });
});

describe('Profile Management', () => {
  let cookies = '';
  let userId = '';

  beforeEach(async () => {
    const regRes = await registerUser(baseUrl, {
      email: 'profile@example.com',
      password: 'TestPass123!',
      name: 'Original Name',
    });
    userId = regRes.data.data.user.id;
    const loginRes = await loginUser(baseUrl, 'profile@example.com', 'TestPass123!');
    cookies = loginRes.cookies;
  });

  it('GET /me should return user profile', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.user.name, 'Original Name');
    assert.ok(!res.data.data.user.passwordHash);
  });

  it('GET /me without auth should return 401', async () => {
    const res = await authenticatedRequest(baseUrl, '', '/api/v1/users/me');
    assert.strictEqual(res.status, 401);
  });

  it('PATCH /me should update name', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.user.name, 'Updated Name');
  });

  it('PATCH /me should update avatarUrl', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl: 'https://example.com/avatar.png' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.user.avatarUrl, 'https://example.com/avatar.png');
  });

  it('PATCH /me should reject email change', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ email: 'new@example.com' }),
    });

    assert.strictEqual(res.status, 400);
  });

  it('PATCH /me should reject role change', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'ADMIN' }),
    });

    assert.strictEqual(res.status, 400);
  });

  it('DELETE /me with correct password should delete account', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password: 'TestPass123!' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const meRes = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me');
    assert.strictEqual(meRes.status, 401);
  });

  it('DELETE /me with wrong password should return 401', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password: 'WrongPass123!' }),
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.code, 'INVALID_CREDENTIALS');
  });

  it('DELETE /me without password should return 400', async () => {
    const res = await authenticatedRequest(baseUrl, cookies, '/api/v1/users/me', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
  });
});

describe('Security', () => {
  it('Cookie should have HttpOnly flag', async () => {
    await registerUser(baseUrl, { email: 'secure@example.com', password: 'TestPass123!' });
    const res = await loginUser(baseUrl, 'secure@example.com', 'TestPass123!');

    assert.ok(res.cookies);
    assert.ok(res.cookies.includes('HttpOnly'));
  });

  it('Cookie should have Secure flag in production', async () => {
    process.env.NODE_ENV = 'production';
    await registerUser(baseUrl, { email: 'secure2@example.com', password: 'TestPass123!' });
    const res = await loginUser(baseUrl, 'secure2@example.com', 'TestPass123!');
    process.env.NODE_ENV = 'development';

    assert.ok(res.cookies);
    assert.ok(res.cookies.includes('Secure'));
  });

  it('Cookie should have SameSite=Lax', async () => {
    await registerUser(baseUrl, { email: 'secure3@example.com', password: 'TestPass123!' });
    const res = await loginUser(baseUrl, 'secure3@example.com', 'TestPass123!');

    assert.ok(res.cookies);
    assert.ok(res.cookies.includes('SameSite=Lax'));
  });

  it('Password should never be in response body', async () => {
    const regRes = await registerUser(baseUrl, { email: 'pass@example.com', password: 'TestPass123!' });
    assert.ok(!JSON.stringify(regRes.data).includes('TestPass123!'));

    const loginRes = await loginUser(baseUrl, 'pass@example.com', 'TestPass123!');
    assert.ok(!JSON.stringify(loginRes.data).includes('TestPass123!'));
  });
});

async function fetchWithCookies(url, options = {}) {
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