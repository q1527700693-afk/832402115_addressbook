import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import ExcelJS from 'exceljs';
import { createApp } from '../server/app.js';
import { HEADERS } from '../server/excel.js';

const { app, db } = createApp({ dbPath: ':memory:' });
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

const signup = await fetch(`${base}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'test_user', password: 'secret123' }),
});
if (signup.status !== 201) throw new Error(`test signup failed: ${signup.status}`);
const cookie = (signup.headers.get('set-cookie') || '').split(';')[0];

test.after(() => {
  server.close();
  db.close();
});

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Cookie: cookie, ...(options.headers || {}) },
  });
  const body = await response.json();
  return { response, body };
}

const jsonPost = (path, payload, method = 'POST') => jsonRequest(path, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const sampleContact = {
  name: '罗峰',
  company: '极限武馆',
  title: '战神',
  birthday: '1995-08-15',
  tags: ['战神', '兄弟'],
  note: '从极限武馆学员一路走到战神。',
  isFavorite: true,
  methods: [
    { type: 'phone', label: '手机', value: '138 0000 1301' },
    { type: 'phone', label: '公司', value: '0514-8888 1301' },
    { type: 'email', label: '邮箱', value: 'luofeng@example.com' },
    { type: 'wechat', label: '微信', value: 'luofeng_jx' },
    { type: 'address', label: '地址', value: '江南基地市扬州城明月小区 8 栋' },
  ],
};

let contactId;

test('health endpoint reports the service', async () => {
  const { response, body } = await jsonRequest('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test('an empty address book starts with zero stats', async () => {
  const { response, body } = await jsonRequest('/api/contacts');
  assert.equal(response.status, 200);
  assert.deepEqual(body.contacts, []);
  assert.equal(body.total, 0);
  assert.equal(body.favorites, 0);
});

test('creates a contact with multiple contact methods', async () => {
  const { response, body } = await postContact(sampleContact);
  assert.equal(response.status, 201);
  assert.equal(body.name, '罗峰');
  assert.equal(body.methods.length, 5);
  assert.equal(body.isFavorite, true);
  assert.deepEqual(body.tags, ['战神', '兄弟']);
  contactId = body.id;
});

async function postContact(payload) {
  const { response, body } = await jsonPost('/api/contacts', payload);
  return { response, body };
}

test('lists, searches and reads contacts', async () => {
  const list = await jsonRequest('/api/contacts');
  assert.equal(list.body.total, 1);
  assert.equal(list.body.favorites, 1);
  assert.equal(list.body.contacts[0].methods.length, 5);

  const byPhone = await jsonRequest('/api/contacts?q=1380000');
  assert.equal(byPhone.body.contacts.length, 1);

  const byName = await jsonRequest(`/api/contacts?q=${encodeURIComponent('极限武馆')}`);
  assert.equal(byName.body.contacts[0].name, '罗峰');

  const missing = await jsonRequest('/api/contacts?q=nobody');
  assert.equal(missing.body.contacts.length, 0);

  const detail = await jsonRequest(`/api/contacts/${contactId}`);
  assert.equal(detail.body.name, '罗峰');
});

test('toggles the favorite flag', async () => {
  const off = await jsonPost(`/api/contacts/${contactId}/favorite`, { isFavorite: false }, 'PATCH');
  assert.equal(off.response.status, 200);
  assert.equal(off.body.isFavorite, false);

  const favoriteOnly = await jsonRequest('/api/contacts?favorite=1');
  assert.equal(favoriteOnly.body.contacts.length, 0);

  const on = await jsonPost(`/api/contacts/${contactId}/favorite`, { isFavorite: true }, 'PATCH');
  assert.equal(on.body.isFavorite, true);

  const favorites = await jsonRequest('/api/contacts?favorite=1');
  assert.equal(favorites.body.contacts.length, 1);
});

test('updates a contact and replaces its methods', async () => {
  const { response, body } = await jsonPost(`/api/contacts/${contactId}`, {
    ...sampleContact,
    title: '高级战神',
    methods: [
      { type: 'phone', label: '手机', value: '138 0000 9999' },
      { type: 'email', label: '邮箱', value: 'new@example.com' },
    ],
  }, 'PUT');
  assert.equal(response.status, 200);
  assert.equal(body.title, '高级战神');
  assert.equal(body.methods.length, 2);
  assert.equal(body.methods[0].value, '138 0000 9999');
});

test('rejects invalid input', async () => {
  const noName = await postContact({ name: '  ', methods: [] });
  assert.equal(noName.response.status, 400);
  assert.match(noName.body.error.message, /姓名/);

  const badEmail = await postContact({
    name: '测试',
    methods: [{ type: 'email', value: 'not-an-email' }],
  });
  assert.equal(badEmail.response.status, 400);
  assert.match(badEmail.body.error.message, /邮箱/);

  const badType = await postContact({
    name: '测试',
    methods: [{ type: 'pager', value: '123' }],
  });
  assert.equal(badType.response.status, 400);
});

test('exports a workbook with one row per contact', async () => {
  const response = await fetch(`${base}/api/export`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /spreadsheetml/);
  assert.match(response.headers.get('content-disposition'), /attachment/);

  const buffer = Buffer.from(await response.arrayBuffer());
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getRow(1).getCell(1).text, '姓名');
  assert.equal(sheet.getRow(1).getCell(7).text, '手机1');
  assert.equal(sheet.getRow(1).getCell(16).text, '备注');
  assert.equal(sheet.getRow(2).getCell(1).text, '罗峰');
  assert.equal(sheet.getRow(2).getCell(6).text, '是');
  assert.equal(sheet.getRow(2).getCell(7).text, '138 0000 9999');
  assert.equal(sheet.getRow(2).getCell(10).text, 'new@example.com');
  assert.equal(sheet.actualRowCount >= 2, true);
});

test('downloads an import template', async () => {
  const response = await fetch(`${base}/api/import/template`);
  assert.equal(response.status, 200);
  const buffer = Buffer.from(await response.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const headers = workbook.worksheets[0].getRow(1).values.slice(1);
  assert.deepEqual(headers, HEADERS);
});

async function importWorkbook(rows, mode = 'merge') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('通讯录');
  sheet.addRow(HEADERS);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const form = new FormData();
  form.append('file', new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), 'contacts.xlsx');
  form.append('mode', mode);
  const response = await fetch(`${base}/api/import`, {
    method: 'POST',
    body: form,
    headers: { Cookie: cookie },
  });
  return { response, body: await response.json() };
}

test('imports Excel rows, updates duplicates and reports bad rows', async () => {
  const rows = [
    ['罗峰', '极限武馆', '战神', '1995-08-15', '设计、朋友', '是', '138 0000 9999', '', '', 'new@example.com', '', '', '', '', '', '合并更新这一行'],
    ['贾谊', '极限武馆', '江南基地市会长', '1990-10-10', '朋友', '是', '13800004567', '', '', 'jiayi@example.com', '', 'jiayi_jx', '', '江南基地市极限武馆', '', '新联系人'],
    ['错误示例', '', '', '', '', '否', '13600001111', '', '', 'not-an-email', '', '', '', '', '', '邮箱错误'],
  ];
  const { response, body } = await importWorkbook(rows);
  assert.equal(response.status, 200);
  assert.equal(body.created, 1);
  assert.equal(body.updated, 1);
  assert.equal(body.errors.length, 1);
  assert.equal(body.errors[0].row, 4);
  assert.match(body.errors[0].reason, /邮箱/);

  const list = await jsonRequest('/api/contacts');
  assert.equal(list.body.total, 2);
  const lu = list.body.contacts.find((contact) => contact.name === '贾谊');
  assert.equal(lu.methods.length, 4);
  assert.equal(lu.isFavorite, true);
});

test('skip mode leaves existing contacts untouched', async () => {
  const rows = [
    ['贾谊', '极限武馆', '江南基地市会长', '', '朋友', '否', '13800004567', '', '', '', '', '', '', '', '', ''],
  ];
  const { body } = await importWorkbook(rows, 'skip');
  assert.equal(body.skipped, 1);
  assert.equal(body.created, 0);
  assert.equal(body.updated, 0);
});

test('rejects non-Excel uploads and missing files', async () => {
  const form = new FormData();
  form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
  const badType = await fetch(`${base}/api/import`, {
    method: 'POST',
    body: form,
    headers: { Cookie: cookie },
  });
  assert.equal(badType.status, 400);

  const empty = await fetch(`${base}/api/import`, {
    method: 'POST',
    body: new FormData(),
    headers: { Cookie: cookie },
  });
  assert.equal(empty.status, 400);
});

test('deletes a contact and returns 404 afterwards', async () => {
  const deleted = await jsonRequest(`/api/contacts/${contactId}`, { method: 'DELETE' });
  assert.equal(deleted.response.status, 200);

  const missing = await jsonRequest(`/api/contacts/${contactId}`);
  assert.equal(missing.response.status, 404);

  const list = await jsonRequest('/api/contacts');
  assert.equal(list.body.total, 1);
});
