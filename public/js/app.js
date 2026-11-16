import { api } from './api.js';
import { icon, METHOD_META, METHOD_ORDER } from './icons.js';

const appEl = document.querySelector('#app');
const listEl = document.querySelector('#contact-list');
const detailEl = document.querySelector('#detail');
const searchEl = document.querySelector('#search');
const overlayEl = document.querySelector('#overlay-root');
const toastRoot = document.querySelector('#toast-root');

const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });

const state = {
  contacts: [],
  total: 0,
  favorites: 0,
  user: null,
  preview: false,
  filter: 'all',
  search: '',
  selectedId: null,
  loading: true,
  error: null,
};

let pendingFile = null;
let lastFocused = null;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function contactById(id) {
  return state.contacts.find((contact) => contact.id === Number(id));
}

function avatarText(name) {
  const value = String(name || '').trim();
  if (!value) return '?';
  if (/[\u3400-\u9fff]/.test(value[0])) return value[0];
  return value
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function avatarTone(name) {
  let hash = 0;
  for (const char of String(name || '')) hash = (hash * 31 + char.codePointAt(0)) % 997;
  return `av-${hash % 6}`;
}

function formatFullDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ageOf(birthday) {
  if (!birthday) return null;
  const born = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function methodHref(method) {
  if (method.type === 'phone') return `tel:${method.value.replace(/[^\d+]/g, '')}`;
  if (method.type === 'email') return `mailto:${method.value}`;
  return null;
}

function firstOf(contact, type) {
  return contact.methods.find((method) => method.type === type) || null;
}

function visibleContacts() {
  const term = state.search.trim().toLowerCase();
  return state.contacts
    .filter((contact) => state.filter === 'all' || contact.isFavorite)
    .filter((contact) => {
      if (!term) return true;
      const haystack = [
        contact.name,
        contact.company,
        contact.title,
        contact.note,
        contact.tags.join(' '),
        ...contact.methods.map((method) => `${method.label} ${method.value}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term) || haystack.replace(/[\s\-()]/g, '').includes(term.replace(/[\s\-()]/g, ''));
    })
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || collator.compare(a.name, b.name));
}

function toast(message, type = 'success') {
  const element = document.createElement('div');
  element.className = `toast ${type === 'error' ? 'error' : ''}`;
  element.innerHTML = `${icon(type === 'error' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
  toastRoot.append(element);
  requestAnimationFrame(() => element.classList.add('show'));
  setTimeout(() => {
    element.classList.remove('show');
    setTimeout(() => element.remove(), 280);
  }, type === 'error' ? 4200 : 3000);
}

function setButtonLoading(button, label) {
  if (!button) return () => {};
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${icon('refresh', 'spin')} ${esc(label)}`;
  return () => {
    button.disabled = false;
    button.innerHTML = original;
  };
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

function skeletonList() {
  return Array.from({ length: 5 }, () => `
    <div class="skeleton" aria-hidden="true">
      <div class="sk-avatar"></div>
      <div class="sk-lines"><div class="sk-line"></div><div class="sk-line short"></div></div>
    </div>`).join('');
}

function contactCard(contact, index) {
  const subtitle = [contact.company, contact.title].filter(Boolean).join(' · ')
    || contact.methods[0]?.value
    || '暂无联系方式';
  return `
    <button class="contact-card ${contact.id === state.selectedId ? 'active' : ''}" type="button"
      style="--i:${index}" data-action="select" data-id="${contact.id}">
      <span class="avatar ${avatarTone(contact.name)}">${esc(avatarText(contact.name))}</span>
      <span class="card-main">
        <span class="card-name">
          <strong>${esc(contact.name)}</strong>
          ${contact.isFavorite ? icon('star') : ''}
        </span>
        <span class="card-sub">${esc(subtitle)}</span>
      </span>
      ${contact.methods.length ? `<span class="card-meta" title="${contact.methods.length} 条联系方式">${icon('link')}${contact.methods.length}</span>` : ''}
    </button>`;
}

function emptyList() {
  if (state.error) {
    return `
      <div class="list-empty">
        ${icon('alert')}
        <strong>加载失败</strong>
        <p>${esc(state.error)}</p>
        <button class="link-btn" type="button" data-action="retry">重新加载</button>
      </div>`;
  }
  if (state.search.trim()) {
    return `
      <div class="list-empty">
        ${icon('search')}
        <strong>没有找到匹配的联系人</strong>
        <p>换个关键词，或清空搜索试一试</p>
        <button class="link-btn" type="button" data-action="clear-search">清空搜索</button>
      </div>`;
  }
  if (state.filter === 'favorite') {
    return `
      <div class="list-empty">
        ${icon('star')}
        <strong>还没有收藏的联系人</strong>
        <p>打开联系人档案，点击星标即可收藏</p>
        <button class="link-btn" type="button" data-action="filter-all">查看全部联系人</button>
      </div>`;
  }
  return `
    <div class="list-empty">
      ${icon('users')}
      <strong>通讯录还是空的</strong>
      <p>新建第一位联系人，或从 Excel 导入</p>
      <button class="link-btn" type="button" data-action="new">新建联系人</button>
    </div>`;
}

function renderCounts() {
  document.querySelector('#brand-total').textContent = state.total;
  document.querySelector('#count-all').textContent = state.total;
  document.querySelector('#count-favorite').textContent = state.favorites;
}

function renderList() {
  renderCounts();
  if (state.loading) {
    listEl.innerHTML = skeletonList();
    return;
  }
  const contacts = visibleContacts();
  listEl.innerHTML = contacts.length
    ? contacts.map((contact, index) => contactCard(contact, index)).join('')
    : emptyList();
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('[data-filter]').forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const visible = visibleContacts();
  if (!visible.some((contact) => contact.id === state.selectedId)) {
    state.selectedId = visible[0]?.id ?? null;
  }
  appEl.classList.remove('show-detail');
  renderAll();
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

function emptyDetail() {
  return `
    <div class="detail-empty">
      <div class="empty-art" aria-hidden="true">
        <svg width="66" height="66" viewBox="0 0 120 120" fill="none">
          <rect x="20" y="27" width="80" height="66" rx="11" fill="#fbfcff" stroke="#c9d3e2" stroke-width="2"/>
          <circle cx="43" cy="52" r="10" fill="#e7eef9" stroke="#4a6da8" stroke-width="2"/>
          <path d="M32 75c2.2-7 6-10.5 11-10.5s8.8 3.5 11 10.5" stroke="#4a6da8" stroke-width="2" stroke-linecap="round"/>
          <path d="M65 47h21M65 56h14M65 65h21" stroke="#c9d3e2" stroke-width="3" stroke-linecap="round"/>
          <path d="m92 76 2.6 5.2 5.8.9-4.2 4 1 5.7-5.2-2.7-5.1 2.7 1-5.7-4.2-4 5.7-.9z" fill="#6b8cc7"/>
        </svg>
      </div>
      <h2>通讯录，从一个人开始</h2>
      <p>选择左侧的联系人查看完整档案，或新建一位联系人，把重要的人和联系方式留在这里。</p>
      <button class="btn btn-ghost" type="button" data-action="new">${icon('plus')}新建联系人</button>
    </div>`;
}

function methodRow(method) {
  const meta = METHOD_META[method.type] || METHOD_META.other;
  const href = methodHref(method);
  const value = href
    ? `<a class="method-value" href="${esc(href)}">${esc(method.value)}</a>`
    : `<span class="method-value">${esc(method.value)}</span>`;
  return `
    <div class="method">
      <span class="method-icon ${esc(method.type)}">${icon(meta.icon)}</span>
      <div class="method-body">
        <span class="method-label">${esc(method.label || meta.label)}</span>
        ${value}
      </div>
      <button class="copy-btn" type="button" data-action="copy" data-value="${esc(method.value)}" title="复制" aria-label="复制${esc(method.label || meta.label)}">
        ${icon('copy')}
      </button>
    </div>`;
}

function detailTemplate(contact) {
  const phone = firstOf(contact, 'phone');
  const email = firstOf(contact, 'email');
  const tags = contact.tags.length
    ? `<div class="tag-row">${contact.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>`
    : '';
  const age = ageOf(contact.birthday);
  const birthday = contact.birthday
    ? `${formatFullDate(contact.birthday)}${age !== null ? ` · ${age} 岁` : ''}`
    : '未填写';
  const quick = `
    <div class="quick-row">
      ${phone
        ? `<a class="quick" href="${esc(methodHref(phone))}">${icon('phone')}拨打电话</a>`
        : `<span class="quick is-disabled">${icon('phone')}暂无电话</span>`}
      ${email
        ? `<a class="quick" href="${esc(methodHref(email))}">${icon('mail')}发送邮件</a>`
        : `<span class="quick is-disabled">${icon('mail')}暂无邮箱</span>`}
      <button class="quick" type="button" data-action="copy" data-value="${esc(phone?.value || '')}" ${phone ? '' : 'disabled'}>
        ${icon('copy')}复制号码
      </button>
    </div>`;

  return `
    <div class="profile">
      <div class="mobile-topbar">
        <button class="btn btn-ghost" type="button" data-action="back">${icon('back')}返回</button>
        <span>CONTACT FILE</span>
      </div>
      <header class="profile-top">
        <p class="eyebrow">Contact file <span class="sep">/</span> No. ${String(contact.id).padStart(2, '0')}</p>
        <div class="profile-tools">
          <button class="btn btn-star ${contact.isFavorite ? 'is-on' : ''}" type="button"
            data-action="favorite" data-id="${contact.id}" aria-pressed="${contact.isFavorite}">
            ${icon('star')}<span>${contact.isFavorite ? '已收藏' : '收藏'}</span>
          </button>
          <button class="icon-btn" type="button" data-action="edit" data-id="${contact.id}" title="编辑" aria-label="编辑联系人">
            ${icon('edit')}
          </button>
          <button class="icon-btn danger" type="button" data-action="delete" data-id="${contact.id}" title="删除" aria-label="删除联系人">
            ${icon('trash')}
          </button>
        </div>
      </header>

      <section class="profile-head">
        <div class="avatar avatar-xl ${avatarTone(contact.name)}">${esc(avatarText(contact.name))}</div>
        <div class="profile-title">
          <h2>${esc(contact.name)}</h2>
          <p>${esc([contact.title, contact.company].filter(Boolean).join(' · ') || '尚未填写公司与职位')}</p>
          ${tags}
        </div>
      </section>

      ${quick}

      <div class="profile-grid">
        <section class="panel">
          <header class="panel-head">
            <h3>联系方式</h3>
            <span class="pill">${contact.methods.length} 条</span>
          </header>
          ${contact.methods.length
            ? contact.methods.map(methodRow).join('')
            : '<p class="method-empty">还没有联系方式，点击右上角编辑添加手机、邮箱、微信或地址。</p>'}
        </section>

        <div class="side-stack">
          <section class="panel">
            <header class="panel-head"><h3>备注</h3></header>
            <p class="note-text ${contact.note ? '' : 'is-empty'}">${contact.note ? esc(contact.note) : '还没有备注，点击编辑补充一些细节。'}</p>
          </section>
          <section class="panel">
            <header class="panel-head"><h3>档案信息</h3></header>
            <dl class="facts">
              <div class="fact"><dt>生日</dt><dd>${esc(birthday)}</dd></div>
              <div class="fact"><dt>联系方式</dt><dd>${contact.methods.length} 条</dd></div>
              <div class="fact"><dt>创建时间</dt><dd>${esc(formatFullDate(contact.createdAt))}</dd></div>
              <div class="fact"><dt>最近更新</dt><dd>${esc(formatFullDate(contact.updatedAt))}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>`;
}

function renderDetail() {
  const contact = contactById(state.selectedId);
  detailEl.innerHTML = contact ? detailTemplate(contact) : emptyDetail();
}

function renderAll() {
  renderList();
  renderDetail();
}

/* -------------------------------------------------------------------------- */
/* Data loading                                                               */
/* -------------------------------------------------------------------------- */

async function load({ silent = false } = {}) {
  if (!silent) {
    state.loading = true;
    state.error = null;
    renderList();
  }
  try {
    const data = await api.list();
    state.contacts = data.contacts;
    state.total = data.total;
    state.favorites = data.favorites;
    state.preview = Boolean(data.preview);
    state.error = null;
    state.loading = false;
    if (!state.contacts.some((contact) => contact.id === state.selectedId)) {
      state.selectedId = visibleContacts()[0]?.id ?? null;
    }
  } catch (error) {
    state.loading = false;
    state.error = error.message;
    if (!silent) toast(error.message, 'error');
  }
  renderAccount();
  renderAll();
}

function selectContact(id) {
  state.selectedId = Number(id);
  renderList();
  renderDetail();
  detailEl.scrollTop = 0;
  if (window.matchMedia('(max-width: 900px)').matches) {
    appEl.classList.add('show-detail');
  }
}

async function toggleFavorite(id) {
  const contact = contactById(id);
  if (!contact) return;
  const next = !contact.isFavorite;
  contact.isFavorite = next;
  state.favorites = state.contacts.filter((item) => item.isFavorite).length;
  renderAll();
  requestAnimationFrame(() => {
    document.querySelector('.btn-star')?.classList.add('pop');
  });
  try {
    const updated = await api.setFavorite(id, next);
    Object.assign(contact, updated);
    state.favorites = state.contacts.filter((item) => item.isFavorite).length;
    renderAll();
    toast(next ? `已收藏 ${contact.name}` : `已取消收藏 ${contact.name}`);
  } catch (error) {
    contact.isFavorite = !next;
    state.favorites = state.contacts.filter((item) => item.isFavorite).length;
    renderAll();
    toast(error.message, 'error');
  }
}

/* -------------------------------------------------------------------------- */
/* Overlay                                                                    */
/* -------------------------------------------------------------------------- */

function openOverlay(html) {
  lastFocused = document.activeElement;
  overlayEl.innerHTML = html;
  document.body.classList.add('modal-open');
}

function closeOverlay() {
  if (!overlayEl.innerHTML) return;
  overlayEl.innerHTML = '';
  document.body.classList.remove('modal-open');
  pendingFile = null;
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
  lastFocused = null;
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

function methodRowEditor(method) {
  const type = METHOD_META[method.type] ? method.type : 'phone';
  const meta = METHOD_META[type];
  return `
    <div class="method-row">
      <select class="select" data-method-type aria-label="联系方式类型">
        ${METHOD_ORDER.map((key) => `<option value="${key}" ${key === type ? 'selected' : ''}>${METHOD_META[key].label}</option>`).join('')}
      </select>
      <input class="input" data-method-label maxlength="20" placeholder="标签（选填）" value="${esc(method.label || '')}">
      <input class="input value-input" data-method-value maxlength="300" placeholder="${esc(meta.placeholder)}" value="${esc(method.value || '')}">
      <button class="remove-method" type="button" data-action="remove-method" aria-label="删除这条联系方式">${icon('close')}</button>
    </div>`;
}

function openEditor(contact = null) {
  const isEdit = Boolean(contact);
  const methods = contact?.methods?.length ? contact.methods : [{ type: 'phone', label: '', value: '' }];
  openOverlay(`
    <div class="overlay" data-overlay>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header class="modal-head">
          <div>
            <p class="eyebrow">${isEdit ? 'Edit contact' : 'New contact'}</p>
            <h2 id="editor-title">${isEdit ? '编辑联系人' : '新建联系人'}</h2>
          </div>
          <button class="icon-btn" type="button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
        </header>
        <form id="contact-form" data-id="${contact?.id || ''}" novalidate>
          <div class="modal-body">
            <p class="modal-note">姓名必填，其余信息可以稍后补充。一位联系人可以保存多条联系方式。</p>
            <div class="field-grid">
              <div class="field full">
                <label for="f-name">姓名<span class="req">*</span></label>
                <input class="input" id="f-name" name="name" maxlength="60" autocomplete="off" placeholder="例如：林知夏" value="${esc(contact?.name || '')}">
              </div>
              <div class="field">
                <label for="f-company">公司 / 组织</label>
                <input class="input" id="f-company" name="company" maxlength="80" placeholder="例如：云栖设计" value="${esc(contact?.company || '')}">
              </div>
              <div class="field">
                <label for="f-title">职位</label>
                <input class="input" id="f-title" name="title" maxlength="80" placeholder="例如：产品设计师" value="${esc(contact?.title || '')}">
              </div>
              <div class="field">
                <label for="f-birthday">生日</label>
                <input class="input" id="f-birthday" name="birthday" type="date" value="${esc(contact?.birthday || '')}">
              </div>
              <div class="field">
                <label for="f-tags">标签</label>
                <input class="input" id="f-tags" name="tags" maxlength="180" placeholder="用逗号分隔，如：朋友, 设计" value="${esc(contact?.tags?.join(', ') || '')}">
                <span class="field-hint">最多 8 个标签</span>
              </div>
            </div>

            <fieldset class="methods-fieldset">
              <legend>联系方式</legend>
              <div class="methods-head">
                <span>支持手机、邮箱、微信、QQ、地址和其他</span>
                <button class="add-method" type="button" data-action="add-method">${icon('plus')}添加一条</button>
              </div>
              <div id="method-rows">${methods.map(methodRowEditor).join('')}</div>
            </fieldset>

            <div class="field" style="margin-top:18px">
              <label for="f-note">备注</label>
              <textarea class="textarea" id="f-note" name="note" maxlength="1000" placeholder="记录沟通偏好、共同经历或需要提醒的事情…">${esc(contact?.note || '')}</textarea>
            </div>
            <label class="switch" style="margin-top:14px">
              <input type="checkbox" name="favorite" ${contact?.isFavorite ? 'checked' : ''}>
              <span class="switch-track"></span>
              收藏这位联系人
            </label>
          </div>
          <footer class="modal-foot">
            <span class="spacer">带 * 为必填项</span>
            <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
            <button class="btn btn-primary" type="submit">保存联系人</button>
          </footer>
        </form>
      </div>
    </div>`);

  const form = overlayEl.querySelector('#contact-form');
  form.addEventListener('submit', submitEditor);
  form.addEventListener('change', (event) => {
    if (!event.target.matches('[data-method-type]')) return;
    const row = event.target.closest('.method-row');
    const meta = METHOD_META[event.target.value] || METHOD_META.other;
    row.querySelector('.value-input').placeholder = meta.placeholder;
  });
  requestAnimationFrame(() => overlayEl.querySelector('#f-name')?.focus());
}

function addMethodRow() {
  const rows = overlayEl.querySelector('#method-rows');
  if (!rows) return;
  rows.insertAdjacentHTML('beforeend', methodRowEditor({ type: 'phone', label: '', value: '' }));
  const last = rows.lastElementChild;
  last?.querySelector('.value-input')?.focus();
}

function removeMethodRow(button) {
  button.closest('.method-row')?.remove();
}

async function submitEditor(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  if (!name) {
    const field = form.querySelector('#f-name').closest('.field');
    field.classList.add('field-error');
    form.querySelector('#f-name').focus();
    toast('请填写联系人姓名', 'error');
    return;
  }
  const methods = [...form.querySelectorAll('.method-row')]
    .map((row) => ({
      type: row.querySelector('[data-method-type]').value,
      label: row.querySelector('[data-method-label]').value.trim(),
      value: row.querySelector('[data-method-value]').value.trim(),
    }))
    .filter((method) => method.value);
  const invalidEmail = methods.find(
    (method) => method.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(method.value),
  );
  if (invalidEmail) {
    toast(`邮箱格式不正确：${invalidEmail.value}`, 'error');
    return;
  }
  const payload = {
    name,
    company: String(formData.get('company') || '').trim(),
    title: String(formData.get('title') || '').trim(),
    birthday: String(formData.get('birthday') || '').trim(),
    tags: String(formData.get('tags') || '').trim(),
    note: String(formData.get('note') || '').trim(),
    isFavorite: form.querySelector('[name="favorite"]').checked,
    methods,
  };
  const id = Number(form.dataset.id);
  const submit = form.querySelector('button[type="submit"]');
  const restore = setButtonLoading(submit, '保存中…');
  try {
    const saved = id ? await api.update(id, payload) : await api.create(payload);
    state.selectedId = saved.id;
    closeOverlay();
    await load({ silent: true });
    toast(id ? '联系人已更新' : `已添加 ${saved.name}`);
    if (window.matchMedia('(max-width: 900px)').matches) appEl.classList.add('show-detail');
  } catch (error) {
    restore();
    toast(error.message, 'error');
  }
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

function openDelete(contact) {
  openOverlay(`
    <div class="overlay" data-overlay>
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <header class="modal-head">
          <div>
            <p class="eyebrow">Delete contact</p>
            <h2 id="delete-title">删除「${esc(contact.name)}」？</h2>
          </div>
          <button class="icon-btn" type="button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
        </header>
        <div class="modal-body">
          <p class="modal-note">这次操作会同时删除 ${contact.methods.length} 条联系方式，且无法撤销。如果只是想少看到对方，可以先取消收藏。</p>
        </div>
        <footer class="modal-foot">
          <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
          <button class="btn btn-danger" type="button" data-action="confirm-delete" data-id="${contact.id}">确认删除</button>
        </footer>
      </div>
    </div>`);
}

async function confirmDelete(button) {
  const id = Number(button.dataset.id);
  const contact = contactById(id);
  const restore = setButtonLoading(button, '删除中…');
  try {
    await api.remove(id);
    closeOverlay();
    state.selectedId = null;
    await load({ silent: true });
    toast(`已删除 ${contact?.name || '联系人'}`);
    appEl.classList.remove('show-detail');
  } catch (error) {
    restore();
    toast(error.message, 'error');
  }
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

function importModalTemplate() {
  return `
    <div class="overlay" data-overlay>
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header class="modal-head">
          <div>
            <p class="eyebrow">Import contacts</p>
            <h2 id="import-title">从 Excel 导入</h2>
          </div>
          <button class="icon-btn" type="button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
        </header>
        <form id="import-form" novalidate>
          <div class="modal-body">
            <p class="modal-note">选择符合模板格式的 .xlsx 文件。每行一位联系人，姓名必填；手机、邮箱、微信等列会自动识别为多条联系方式。</p>
            <div class="dropzone" id="dropzone">
              <span class="drop-icon">${icon('upload')}</span>
              <strong>拖拽 Excel 文件到这里</strong>
              <span class="dz-hint">支持 .xlsx / .xlsm，单个文件不超过 8MB</span>
              <button class="btn btn-ghost" type="button" data-action="pick-file">选择文件</button>
              <input id="file-input" type="file" accept=".xlsx,.xlsm" hidden>
            </div>
            <div class="file-chip" id="file-chip" hidden>
              ${icon('file')}
              <strong id="file-name"></strong>
              <span class="size" id="file-size"></span>
              <button class="clear-file" type="button" data-action="clear-file" aria-label="移除文件">${icon('close')}</button>
            </div>
            <div class="import-mode">
              <label class="radio-card">
                <input type="radio" name="mode" value="merge" checked>
                <span><strong>合并更新</strong><span>同名且已有相同号码时更新，否则新增</span></span>
              </label>
              <label class="radio-card">
                <input type="radio" name="mode" value="skip">
                <span><strong>跳过重复</strong><span>遇到通讯录已有的人时直接跳过</span></span>
              </label>
            </div>
            <div class="import-actions">
              <a class="link" href="${api.templateUrl()}" download>下载导入模板</a>
              <div class="buttons">
                <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
                <button class="btn btn-primary" id="import-submit" type="submit" disabled>开始导入</button>
              </div>
            </div>
          </div>
        </form>
        <div class="import-result" id="import-result" hidden></div>
      </div>
    </div>`;
}

function openImport() {
  pendingFile = null;
  openOverlay(importModalTemplate());
  const form = overlayEl.querySelector('#import-form');
  const input = overlayEl.querySelector('#file-input');
  const dropzone = overlayEl.querySelector('#dropzone');

  input.addEventListener('change', () => {
    if (input.files?.[0]) setPendingFile(input.files[0]);
  });
  ['dragenter', 'dragover'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('drag');
    });
  });
  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) setPendingFile(file);
  });
  form.addEventListener('submit', submitImport);
}

function setPendingFile(file) {
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    toast('请选择 .xlsx 格式的 Excel 文件', 'error');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast('文件不能超过 8MB', 'error');
    return;
  }
  pendingFile = file;
  overlayEl.querySelector('#dropzone').hidden = true;
  const chip = overlayEl.querySelector('#file-chip');
  chip.hidden = false;
  overlayEl.querySelector('#file-name').textContent = file.name;
  overlayEl.querySelector('#file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
  overlayEl.querySelector('#import-submit').disabled = false;
}

function clearPendingFile() {
  pendingFile = null;
  const input = overlayEl.querySelector('#file-input');
  if (input) input.value = '';
  const chip = overlayEl.querySelector('#file-chip');
  if (chip) chip.hidden = true;
  const dropzone = overlayEl.querySelector('#dropzone');
  if (dropzone) dropzone.hidden = false;
  const submit = overlayEl.querySelector('#import-submit');
  if (submit) submit.disabled = true;
}

async function submitImport(event) {
  event.preventDefault();
  if (!pendingFile) return;
  const form = event.currentTarget;
  const mode = form.querySelector('input[name="mode"]:checked').value;
  const submit = form.querySelector('#import-submit');
  const restore = setButtonLoading(submit, '正在导入…');
  try {
    const result = await api.importFile(pendingFile, mode);
    await load({ silent: true });
    showImportResult(result);
  } catch (error) {
    restore();
    toast(error.message, 'error');
  }
}

function showImportResult(result) {
  const modal = overlayEl.querySelector('.modal');
  overlayEl.querySelector('#import-form').hidden = true;
  const resultEl = overlayEl.querySelector('#import-result');
  resultEl.hidden = false;
  const errors = result.errors || [];
  const written = result.created + result.updated;
  const errorItems = errors.slice(0, 6).map((error) => `
    <li><span class="row-no">第 ${error.row} 行</span><span>${esc(error.name ? `${error.name}：` : '')}${esc(error.reason)}</span></li>`).join('');
  resultEl.innerHTML = `
    <div class="result-hero">
      <strong>${written}</strong>
      <span>位联系人已写入通讯录</span>
    </div>
    <div class="result-stats">
      <div class="result-stat created"><strong>${result.created}</strong><span>新增</span></div>
      <div class="result-stat updated"><strong>${result.updated}</strong><span>更新</span></div>
      <div class="result-stat skipped"><strong>${result.skipped}</strong><span>跳过重复</span></div>
      <div class="result-stat failed"><strong>${errors.length}</strong><span>未导入</span></div>
    </div>
    ${errors.length
      ? `<p class="modal-note" style="margin-bottom:8px">以下数据行没有导入，修正后可以重新导入：</p>
         <ul class="error-list">${errorItems}${errors.length > 6 ? `<li><span>还有 ${errors.length - 6} 条错误未显示</span></li>` : ''}</ul>`
      : '<p class="modal-note" style="margin-bottom:0">所有数据行都已处理完成，可以返回通讯录查看。</p>'}
    <div class="result-foot">
      <button class="btn btn-ghost" type="button" data-action="import-again">继续导入</button>
      <button class="btn btn-primary" type="button" data-action="close-modal">完成</button>
    </div>`;
}

/* -------------------------------------------------------------------------- */
/* Export & clipboard                                                         */
/* -------------------------------------------------------------------------- */

function exportContacts() {
  const anchor = document.createElement('a');
  anchor.href = api.exportUrl();
  anchor.download = '';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  toast('正在导出 Excel，请稍候…');
}

async function copyText(text) {
  const value = String(text || '');
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(`已复制：${value.length > 32 ? `${value.slice(0, 32)}…` : value}`);
}

/* -------------------------------------------------------------------------- */
/* Account & preview                                                          */
/* -------------------------------------------------------------------------- */

const AUTH_COPY = {
  login: {
    eyebrow: 'Sign in',
    title: '登录',
    hint: '使用用户名和密码登录，继续管理你自己的通讯录。',
    submit: '登录',
  },
  register: {
    eyebrow: 'Create account',
    title: '注册账号',
    hint: '用户名 3–32 位字母、数字、下划线、点或短横线；密码至少 6 位。注册后即为你的独立通讯录。',
    submit: '创建账号',
  },
};

function accountTemplate() {
  if (state.user) {
    return `
      <div class="account-chip">
        <span class="account-avatar">${esc(avatarText(state.user.username))}</span>
        <span class="account-meta">
          <strong>${esc(state.user.username)}</strong>
          <span>已登录</span>
        </span>
        <button class="account-exit" type="button" data-action="logout" title="退出登录" aria-label="退出登录">${icon('logout')}</button>
      </div>`;
  }
  return `
    <div class="account-guest">
      <span class="account-label">${icon('user')}未登录</span>
      <span class="account-actions">
        <button class="btn btn-ghost btn-xs" type="button" data-action="open-login">登录</button>
        <button class="btn btn-primary btn-xs" type="button" data-action="open-register">注册</button>
      </span>
    </div>`;
}

function renderAccount() {
  const accountEl = document.querySelector('#account');
  if (accountEl) accountEl.innerHTML = accountTemplate();
  const banner = document.querySelector('#preview-banner');
  if (!banner) return;
  banner.hidden = Boolean(state.user);
  if (!state.user) {
    banner.innerHTML = `${icon('alert')}<span>预览模式：这是示例通讯录，注册或登录后即可建立属于你自己的联系人。</span><button class="link-btn" type="button" data-action="open-register">立即注册</button>`;
  }
}

function authModalTemplate(mode) {
  const copy = AUTH_COPY[mode] ?? AUTH_COPY.login;
  return `
    <div class="overlay" data-overlay>
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <header class="modal-head">
          <div>
            <p class="eyebrow">${copy.eyebrow}</p>
            <h2 id="auth-title">${copy.title}</h2>
          </div>
          <button class="icon-btn" type="button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>
        </header>
        <div class="auth-tabs" role="tablist" aria-label="登录或注册">
          <button class="auth-tab ${mode === 'login' ? 'active' : ''}" type="button" role="tab" aria-selected="${mode === 'login'}" data-action="auth-tab" data-mode="login">登录</button>
          <button class="auth-tab ${mode === 'register' ? 'active' : ''}" type="button" role="tab" aria-selected="${mode === 'register'}" data-action="auth-tab" data-mode="register">注册</button>
        </div>
        <form id="auth-form" data-mode="${mode}" novalidate>
          <div class="modal-body">
            <p class="modal-note" style="margin-bottom:16px">${copy.hint}</p>
            <div class="field">
              <label for="auth-username">用户名</label>
              <input class="input" id="auth-username" name="username" autocomplete="username" maxlength="32" placeholder="例如：linzhixia" required>
            </div>
            <div class="field" style="margin-top:14px">
              <label for="auth-password">密码</label>
              <input class="input" id="auth-password" name="password" type="password" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" maxlength="72" placeholder="至少 6 位" required>
            </div>
            <p class="auth-error" id="auth-error" role="alert" hidden></p>
          </div>
          <footer class="modal-foot">
            <button class="btn btn-ghost" type="button" data-action="close-modal">取消</button>
            <button class="btn btn-primary" type="submit" id="auth-submit">${copy.submit}</button>
          </footer>
        </form>
      </div>
    </div>`;
}

function openAuth(mode = 'login') {
  openOverlay(authModalTemplate(mode));
  const form = overlayEl.querySelector('#auth-form');
  form.addEventListener('submit', submitAuth);
  requestAnimationFrame(() => overlayEl.querySelector('#auth-username')?.focus());
}

async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const mode = form.dataset.mode;
  const username = form.querySelector('#auth-username').value.trim();
  const password = form.querySelector('#auth-password').value;
  const errorEl = form.querySelector('#auth-error');
  errorEl.hidden = true;
  if (!username || !password) {
    errorEl.textContent = '请填写用户名和密码';
    errorEl.hidden = false;
    return;
  }
  const submit = form.querySelector('#auth-submit');
  const restore = setButtonLoading(submit, mode === 'register' ? '创建中…' : '登录中…');
  try {
    const data = mode === 'register'
      ? await api.register(username, password)
      : await api.login(username, password);
    state.user = data.user;
    closeOverlay();
    await load();
    toast(mode === 'register' ? `账号已创建，欢迎 ${data.user.username}` : `欢迎回来，${data.user.username}`);
  } catch (error) {
    restore();
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  }
}

async function logout() {
  try {
    await api.logout();
  } catch {
    // A stale session still clears locally; the server expires it on its own.
  }
  state.user = null;
  state.selectedId = null;
  await load();
  toast('已退出登录');
}

async function boot() {
  try {
    const data = await api.me();
    state.user = data?.user ?? null;
  } catch {
    state.user = null;
  }
  renderAccount();
  await load();
}

/* -------------------------------------------------------------------------- */
/* Global events                                                              */
/* -------------------------------------------------------------------------- */

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || trigger.disabled) return;
  const action = trigger.dataset.action;
  const needsAccount = ['new', 'import', 'export', 'favorite', 'edit', 'delete', 'confirm-delete'].includes(action);
  if (needsAccount && !state.user) {
    openAuth('register');
    toast('注册或登录后即可使用完整功能');
    return;
  }
  switch (action) {
    case 'new':
      openEditor();
      break;
    case 'import':
      openImport();
      break;
    case 'export':
      exportContacts();
      break;
    case 'select':
      selectContact(trigger.dataset.id);
      break;
    case 'favorite':
      toggleFavorite(Number(trigger.dataset.id));
      break;
    case 'edit': {
      const contact = contactById(trigger.dataset.id);
      if (contact) openEditor(contact);
      break;
    }
    case 'delete': {
      const contact = contactById(trigger.dataset.id);
      if (contact) openDelete(contact);
      break;
    }
    case 'confirm-delete':
      confirmDelete(trigger);
      break;
    case 'copy':
      copyText(trigger.dataset.value);
      break;
    case 'close-modal':
      closeOverlay();
      break;
    case 'add-method':
      addMethodRow();
      break;
    case 'remove-method':
      removeMethodRow(trigger);
      break;
    case 'back':
      appEl.classList.remove('show-detail');
      break;
    case 'clear-search':
      searchEl.value = '';
      state.search = '';
      renderList();
      searchEl.focus();
      break;
    case 'filter-all':
      setFilter('all');
      break;
    case 'retry':
      load();
      break;
    case 'pick-file':
      overlayEl.querySelector('#file-input')?.click();
      break;
    case 'clear-file':
      clearPendingFile();
      break;
    case 'import-again':
      openImport();
      break;
    case 'open-login':
      openAuth('login');
      break;
    case 'open-register':
      openAuth('register');
      break;
    case 'auth-tab':
      openAuth(trigger.dataset.mode);
      break;
    case 'logout':
      logout();
      break;
    default:
      break;
  }
});

overlayEl.addEventListener('click', (event) => {
  if (event.target.matches('.overlay')) closeOverlay();
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

searchEl.addEventListener('input', () => {
  state.search = searchEl.value;
  renderList();
});

searchEl.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchEl.value) {
    searchEl.value = '';
    state.search = '';
    renderList();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (overlayEl.innerHTML) {
      closeOverlay();
      return;
    }
    if (appEl.classList.contains('show-detail')) appEl.classList.remove('show-detail');
    return;
  }
  if (overlayEl.innerHTML) return;
  if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === '/') {
    event.preventDefault();
    searchEl.focus();
    searchEl.select();
  } else if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    if (state.user) openEditor();
    else openAuth('register');
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'f-name') event.target.closest('.field')?.classList.remove('field-error');
});

boot();
