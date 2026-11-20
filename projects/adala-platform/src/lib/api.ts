const TOKEN_KEY = 'adala.api.token.v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
  constructor(message: string, status = 500, code?: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; headers?: Record<string,string> } = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string,string> = { ...(opts.headers || {}) };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : (opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body)),
  });
  let payload: any = null;
  const text = await res.text();
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!res.ok) {
    const msg = payload?.error?.message || payload?.message || (typeof payload === 'string' ? payload : res.statusText) || 'خطأ في الاتصال';
    if (res.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('adala:unauthorized'));
    }
    throw new ApiError(msg, res.status, payload?.error?.code, payload?.error?.details);
  }
  return (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload;
}

export async function apiRaw(path: string, opts: { method?: string; body?: any } = {}) {
  const token = getToken();
  const headers: Record<string,string> = {};
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : (opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body)),
  });
  if (!res.ok) throw new ApiError(await res.text(), res.status);
  return res;
}