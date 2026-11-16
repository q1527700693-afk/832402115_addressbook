import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { createContact } from '../server/store.js';

const { app, db } = createApp({ dbPath: ':memory:' });
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
  db.close();
});

/* One contact without an owner plays the role of the preview data. */
createContact(db, null, {
  name: '预览联系人',
  methods: [{ type: 'phone', value: '138 0000 0001' }],
});

async function json(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? await response.json()
    : await response.text();
  return { response, body: payload, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}

async function register(username, password = 'secret123') {
  return json('/api/auth/register', { method: 'POST', body: { username, password } });
}

test('anonymous visitors only see the preview address book', async () => {
  const list = await json('/api/contacts');
  assert.equal(list.response.status, 200);
  assert.equal(list.body.preview, true);
  assert.equal(list.body.authenticated, false);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.contacts[0].name, '预览联系人');
});

test('anonymous visitors cannot mutate any contact', async () => {
  const created = await json('/api/contacts', {
    method: 'POST',
    body: { name: '匿名新增', methods: [] },
  });
  assert.equal(created.response.status, 401);
  assert.equal(created.body.error.code, 'AUTH_REQUIRED');

  const exported = await fetch(`${base}/api/export`);
  assert.equal(exported.status, 401);
});

test('registration validates username and password', async () => {
  const shortPassword = await register('alice', '123');
  assert.equal(shortPassword.response.status, 400);
  assert.match(shortPassword.body.error.message, /密码/);

  const badName = await register('a b', 'secret123');
  assert.equal(badName.response.status, 400);
  assert.match(badName.body.error.message, /用户名/);

  const ok = await register('alice_01');
  assert.equal(ok.response.status, 201);
  assert.equal(ok.body.user.username, 'alice_01');
  assert.equal(ok.body.user.password, undefined);

  const duplicate = await register('alice_01');
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error.code, 'USERNAME_TAKEN');
});

test('passwords are stored as salted scrypt hashes and the cookie is hardened', async () => {
  const { cookie } = await register('bob_01', 'secret123');
  assert.match(cookie, /^sid=/);
  const row = db.prepare('SELECT password_hash FROM users WHERE username = ?').get('bob_01');
  assert.match(row.password_hash, /^scrypt\$/);
  assert.ok(!row.password_hash.includes('secret123'));

  const login = await json('/api/auth/login', {
    method: 'POST',
    body: { username: 'bob_01', password: 'secret123' },
  });
  assert.equal(login.response.status, 200);
  const setCookie = (await json('/api/auth/login', {
    method: 'POST',
    body: { username: 'bob_01', password: 'secret123' },
  })).response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);

  const wrong = await json('/api/auth/login', {
    method: 'POST',
    body: { username: 'bob_01', password: 'wrong-password' },
  });
  assert.equal(wrong.response.status, 401);
  assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
});

test('each account owns an isolated address book', async () => {
  const alice = await register('alice_iso');
  const bob = await register('bob_iso');

  const created = await json('/api/contacts', {
    method: 'POST',
    cookie: alice.cookie,
    body: { name: '爱丽丝的联系人', methods: [{ type: 'phone', value: '138 0000 0002' }] },
  });
  assert.equal(created.response.status, 201);

  const aliceList = await json('/api/contacts', { cookie: alice.cookie });
  assert.equal(aliceList.body.total, 1);
  assert.equal(aliceList.body.preview, false);
  assert.equal(aliceList.body.contacts[0].name, '爱丽丝的联系人');

  const bobList = await json('/api/contacts', { cookie: bob.cookie });
  assert.equal(bobList.body.total, 0);
  assert.deepEqual(bobList.body.contacts, []);

  const bobPeek = await json(`/api/contacts/${created.body.id}`, { cookie: bob.cookie });
  assert.equal(bobPeek.response.status, 404);

  const me = await json('/api/auth/me', { cookie: alice.cookie });
  assert.equal(me.body.user.username, 'alice_iso');

  const loggedOut = await json('/api/auth/logout', { method: 'POST', cookie: alice.cookie });
  assert.equal(loggedOut.response.status, 200);
  const afterLogout = await json('/api/contacts', { cookie: alice.cookie });
  assert.equal(afterLogout.body.preview, true);
  assert.equal(afterLogout.body.total, 1);
});
