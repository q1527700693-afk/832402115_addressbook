import { DatabaseSync } from 'node:sqlite';

export const METHOD_TYPES = ['phone', 'email', 'wechat', 'qq', 'address', 'other'];
const METHOD_TYPE_SET = new Set(METHOD_TYPES);

export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message = '联系人不存在') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
    this.code = 'NOT_FOUND';
  }
}

const LIMITS = {
  name: 60,
  company: 80,
  title: 80,
  note: 1000,
  label: 20,
  methodValue: 300,
  methods: 30,
  tags: 8,
  tag: 20,
};

function text(value, max, field) {
  const result = String(value ?? '').trim();
  if (result.length > max) {
    throw new ValidationError(`${field}不能超过 ${max} 个字符`);
  }
  return result;
}

function normalizeTags(input) {
  if (input == null) return [];
  const raw = Array.isArray(input) ? input : String(input).split(/[,，;；]/);
  const tags = [];
  for (const item of raw) {
    const tag = String(item).trim().replace(/^#/, '');
    if (!tag) continue;
    if (tag.length > LIMITS.tag) {
      throw new ValidationError(`单个标签不能超过 ${LIMITS.tag} 个字符`);
    }
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > LIMITS.tags) {
    throw new ValidationError(`标签最多 ${LIMITS.tags} 个`);
  }
  return tags;
}

function normalizeBirthday(input) {
  const value = String(input ?? '').trim();
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError('生日格式应为 YYYY-MM-DD');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError('生日不是有效日期');
  }
  return value;
}

function normalizeMethods(input) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    throw new ValidationError('联系方式格式不正确');
  }
  if (input.length > LIMITS.methods) {
    throw new ValidationError(`联系方式最多 ${LIMITS.methods} 条`);
  }
  const methods = [];
  const seen = new Set();
  input.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const value = text(raw.value, LIMITS.methodValue, `第 ${index + 1} 条联系方式`);
    const type = String(raw.type ?? '').trim().toLowerCase();
    if (!METHOD_TYPE_SET.has(type)) {
      throw new ValidationError(`第 ${index + 1} 条联系方式类型无效`);
    }
    if (!value) return; // empty rows in the editor are ignored
    const label = text(raw.label, LIMITS.label, '联系方式标签');
    if (type === 'phone' && (value.replace(/\D/g, '').length < 3)) {
      throw new ValidationError(`电话号码「${value}」无效`);
    }
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      throw new ValidationError(`邮箱地址「${value}」无效`);
    }
    const key = `${type}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    methods.push({ type, label, value });
  });
  return methods;
}

export function validateContactInput(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('请求内容格式不正确');
  }
  const name = text(input.name, LIMITS.name, '姓名');
  if (!name) throw new ValidationError('姓名不能为空');

  const isFavorite = input.isFavorite === true
    || input.isFavorite === 1
    || input.isFavorite === '1'
    || input.isFavorite === 'true';

  return {
    name,
    company: text(input.company, LIMITS.company, '公司'),
    title: text(input.title, LIMITS.title, '职位'),
    birthday: normalizeBirthday(input.birthday),
    tags: normalizeTags(input.tags),
    note: text(input.note, LIMITS.note, '备注'),
    isFavorite,
    methods: normalizeMethods(input.methods),
  };
}

function toContact(row, methods = []) {
  return {
    id: Number(row.id),
    name: row.name,
    company: row.company,
    title: row.title,
    birthday: row.birthday,
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    note: row.note,
    isFavorite: Number(row.is_favorite) === 1,
    methods,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function methodsFor(db, contactIds) {
  if (contactIds.length === 0) return new Map();
  const placeholders = contactIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM contact_methods WHERE contact_id IN (${placeholders}) ORDER BY sort_order, id`)
    .all(...contactIds);
  const grouped = new Map();
  for (const row of rows) {
    const id = Number(row.contact_id);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push({
      id: Number(row.id),
      type: row.type,
      label: row.label,
      value: row.value,
    });
  }
  return grouped;
}

const compact = (value) => value.toLowerCase().replace(/[\s\-()]/g, '');

function matchesSearch(contact, term) {
  if (!term) return true;
  const haystack = [
    contact.name,
    contact.company,
    contact.title,
    contact.note,
    contact.tags.join(' '),
    ...contact.methods.map((m) => `${m.label} ${m.value}`),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term) || compact(haystack).includes(compact(term));
}

export function listContacts(db, userId, { search = '', favorite = false } = {}) {
  const rows = favorite
    ? db.prepare('SELECT * FROM contacts WHERE user_id IS ? AND is_favorite = 1 ORDER BY name COLLATE NOCASE').all(userId)
    : db.prepare('SELECT * FROM contacts WHERE user_id IS ? ORDER BY is_favorite DESC, name COLLATE NOCASE').all(userId);
  const grouped = methodsFor(db, rows.map((row) => Number(row.id)));
  const term = String(search).trim().toLowerCase();
  return rows
    .map((row) => toContact(row, grouped.get(Number(row.id)) ?? []))
    .filter((contact) => matchesSearch(contact, term));
}

export function getContact(db, userId, id) {
  const row = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id IS ?').get(Number(id), userId);
  if (!row) return null;
  return toContact(row, methodsFor(db, [Number(row.id)]).get(Number(row.id)) ?? []);
}

function writeMethods(db, contactId, methods) {
  const insert = db.prepare(
    'INSERT INTO contact_methods (contact_id, type, label, value, sort_order) VALUES (?, ?, ?, ?, ?)',
  );
  methods.forEach((method, index) => {
    insert.run(contactId, method.type, method.label, method.value, index);
  });
}

function insertContact(db, userId, data, now) {
  const info = db
    .prepare(
      `INSERT INTO contacts (user_id, name, company, title, birthday, tags, note, is_favorite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      data.name,
      data.company,
      data.title,
      data.birthday,
      data.tags.join(','),
      data.note,
      data.isFavorite ? 1 : 0,
      now,
      now,
    );
  const id = Number(info.lastInsertRowid);
  writeMethods(db, id, data.methods);
  return id;
}

function replaceContact(db, userId, id, data, now) {
  db.prepare(
    `UPDATE contacts
        SET name = ?, company = ?, title = ?, birthday = ?, tags = ?, note = ?, is_favorite = ?, updated_at = ?
      WHERE id = ? AND user_id IS ?`,
  ).run(
    data.name,
    data.company,
    data.title,
    data.birthday,
    data.tags.join(','),
    data.note,
    data.isFavorite ? 1 : 0,
    now,
    id,
    userId,
  );
  db.prepare('DELETE FROM contact_methods WHERE contact_id = ?').run(id);
  writeMethods(db, id, data.methods);
}

export function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createContact(db, userId, input) {
  const data = validateContactInput(input);
  const now = new Date().toISOString();
  const id = withTransaction(db, () => insertContact(db, userId, data, now));
  return getContact(db, userId, id);
}

export function updateContact(db, userId, id, input) {
  const numericId = Number(id);
  if (!getContact(db, userId, numericId)) throw new NotFoundError();
  const data = validateContactInput(input);
  const now = new Date().toISOString();
  withTransaction(db, () => replaceContact(db, userId, numericId, data, now));
  return getContact(db, userId, numericId);
}

export function setFavorite(db, userId, id, isFavorite) {
  const numericId = Number(id);
  const exists = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id IS ?').get(numericId, userId);
  if (!exists) throw new NotFoundError();
  db.prepare('UPDATE contacts SET is_favorite = ?, updated_at = ? WHERE id = ? AND user_id IS ?')
    .run(isFavorite ? 1 : 0, new Date().toISOString(), numericId, userId);
  return getContact(db, userId, numericId);
}

export function deleteContact(db, userId, id) {
  const numericId = Number(id);
  const exists = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id IS ?').get(numericId, userId);
  if (!exists) throw new NotFoundError();
  db.prepare('DELETE FROM contacts WHERE id = ? AND user_id IS ?').run(numericId, userId);
  return { id: numericId };
}

export function countStats(db, userId) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM contacts WHERE user_id IS ?').get(userId);
  const favorites = db.prepare('SELECT COUNT(*) AS n FROM contacts WHERE user_id IS ? AND is_favorite = 1').get(userId);
  return { total: Number(total.n), favorites: Number(favorites.n) };
}

function methodKey(method) {
  if (method.type === 'phone') return `phone:${method.value.replace(/\D/g, '')}`;
  if (method.type === 'email') return `email:${method.value.trim().toLowerCase()}`;
  return `${method.type}:${method.value.trim().toLowerCase()}`;
}

export function findDuplicate(db, userId, data) {
  const rows = db
    .prepare('SELECT * FROM contacts WHERE lower(name) = lower(?) AND user_id IS ?')
    .all(data.name, userId);
  if (rows.length === 0) return null;
  const incoming = new Set(data.methods.map(methodKey));
  const hasIdentity = data.methods.some((m) => m.type === 'phone' || m.type === 'email');
  for (const row of rows) {
    const id = Number(row.id);
    const methods = methodsFor(db, [id]).get(id) ?? [];
    if (!hasIdentity) return { id };
    if (methods.some((method) => incoming.has(methodKey(method)))) return { id };
  }
  return null;
}

/**
 * Apply parsed Excel rows inside one transaction.
 * A bad row is reported and skipped; a database failure rolls everything back.
 */
export function importContacts(db, userId, rows, mode = 'merge') {
  const summary = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };
  const now = new Date().toISOString();

  withTransaction(db, () => {
    for (const row of rows) {
      let data;
      try {
        data = validateContactInput(row.data);
      } catch (error) {
        summary.errors.push({
          row: row.rowNumber,
          name: row.data?.name || '',
          reason: error.message,
        });
        continue;
      }
      const duplicate = findDuplicate(db, userId, data);
      if (duplicate) {
        if (mode === 'skip') {
          summary.skipped += 1;
        } else {
          replaceContact(db, userId, duplicate.id, data, now);
          summary.updated += 1;
        }
      } else {
        insertContact(db, userId, data, now);
        summary.created += 1;
      }
    }
  });

  return summary;
}

export function isSqliteDatabase(db) {
  return db instanceof DatabaseSync;
}
