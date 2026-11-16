const base = new URL('.', window.location.href);

export function apiUrl(path) {
  return new URL(`api/${path}`, base);
}

async function request(path, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(apiUrl(path), options);
  } catch {
    throw new Error('无法连接服务器，请确认服务已启动');
  }

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = data?.error?.message || `请求失败（${response.status}）`;
    const error = new Error(message);
    error.details = data?.error?.details;
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  me() {
    return request('auth/me');
  },
  login(username, password) {
    return request('auth/login', { method: 'POST', body: { username, password } });
  },
  register(username, password) {
    return request('auth/register', { method: 'POST', body: { username, password } });
  },
  logout() {
    return request('auth/logout', { method: 'POST' });
  },
  list(query = '') {
    return request(`contacts${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  },
  create(payload) {
    return request('contacts', { method: 'POST', body: payload });
  },
  update(id, payload) {
    return request(`contacts/${id}`, { method: 'PUT', body: payload });
  },
  setFavorite(id, isFavorite) {
    return request(`contacts/${id}/favorite`, { method: 'PATCH', body: { isFavorite } });
  },
  remove(id) {
    return request(`contacts/${id}`, { method: 'DELETE' });
  },
  importFile(file, mode) {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    return request('import', { method: 'POST', body: form });
  },
  exportUrl() {
    return apiUrl('export');
  },
  templateUrl() {
    return apiUrl('import/template');
  },
};
