// API client for /api/miniapp/* endpoints
// Automatically attaches initData from Telegram SDK
const API = {
  baseUrl: '/api/miniapp',

  async _fetch(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const initData = window.Telegram?.WebApp?.initData || '';
    const headers = {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      ...options.headers,
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'unknown' }));
      throw new Error(error.detail || error.error || `HTTP ${response.status}`);
    }
    return response.json();
  },

  get(path) { return this._fetch(path); },
  post(path, body) { return this._fetch(path, { method: 'POST', body: JSON.stringify(body) }); },
  patch(path, body) { return this._fetch(path, { method: 'PATCH', body: JSON.stringify(body) }); },
  delete(path) { return this._fetch(path, { method: 'DELETE' }); },
};
