const PATHS = {
  star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
  download: '<path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
  edit: '<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"/><path d="M10 11v6M14 11v6"/>',
  phone: '<path d="M6.2 3.5h3l1.4 4-2 1.4a12 12 0 0 0 6.5 6.5l1.4-2 4 1.4v3a2.4 2.4 0 0 1-2.6 2.4A16.5 16.5 0 0 1 3.8 6.1 2.4 2.4 0 0 1 6.2 3.5Z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/>',
  message: '<path d="M20 11.5a7.5 7.5 0 0 1-11 6.7L4 20l1.5-4.8A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
  qq: '<path d="M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2.2-1.4 2.6-1.4 4.3 0 1.7 1.4 2.6 1.4 3.9S14 20 12 20s-3.5-.9-3.5-2.3 1.4-2.2 1.4-3.9S8.5 11.7 8.5 9.5Z"/><path d="M7.5 4.5c1.2.2 2.1 1 2.6 2M16.5 4.5c-1.2.2-2.1 1-2.6 2"/>',
  pin: '<path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
  note: '<path d="M6 3.5h9L19 8v12.5H6Z"/><path d="M14 3.5V8h4M9 12h6M9 16h4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16.2v.1"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.5-3.6 2.7-5.5 5.5-5.5s5 1.9 5.5 5.5"/><path d="M15.5 5.2a3 3 0 0 1 0 5.7M17 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
  link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 6.3"/><path d="M14 10.5a4 4 0 0 0-5.7 0L5.5 13.3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  file: '<path d="M7 3.5h7L18 7.5v13H7Z"/><path d="M14 3.5v4h4"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  user: '<circle cx="12" cy="8.5" r="3.4"/><path d="M5.5 20c.6-3.8 3-5.8 6.5-5.8s5.9 2 6.5 5.8"/>',
  logout: '<path d="M14.5 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h8"/><path d="M17 8.5 20.5 12 17 15.5M10.5 12h10"/>',
};

export function icon(name, className = '') {
  const path = PATHS[name] || '';
  const classes = className ? `icon ${className}` : 'icon';
  return `<svg class="${classes}" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

export const METHOD_META = {
  phone: { label: '手机', icon: 'phone', placeholder: '138 0000 0000' },
  email: { label: '邮箱', icon: 'mail', placeholder: 'name@example.com' },
  wechat: { label: '微信', icon: 'message', placeholder: '微信号' },
  qq: { label: 'QQ', icon: 'qq', placeholder: 'QQ 号' },
  address: { label: '地址', icon: 'pin', placeholder: '详细地址' },
  other: { label: '其他', icon: 'link', placeholder: '其他联系方式' },
};

export const METHOD_ORDER = ['phone', 'email', 'wechat', 'qq', 'address', 'other'];
