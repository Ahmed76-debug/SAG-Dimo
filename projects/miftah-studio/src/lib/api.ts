const TOKEN_KEY = 'miftah.token';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code = 'error', status = 500, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export async function api<T = unknown>(path: string, { method = 'GET', body, query }: Options = {}): Promise<T> {
  let url = `/api${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('تعذر الاتصال بالخادم. تأكد من تشغيل الخدمة.', 'network_error', 0);
  }

  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }

  if (!res.ok || payload?.ok === false) {
    if (res.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('miftah:unauthorized'));
    }
    throw new ApiError(
      payload?.error?.message || 'حدث خطأ غير متوقع',
      payload?.error?.code || 'error',
      res.status,
      payload?.error?.details
    );
  }
  return (payload?.data ?? payload) as T;
}

export async function downloadFile(path: string, filename?: string) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = 'تعذر تنزيل الملف';
    try {
      const payload = await res.json();
      message = payload?.error?.message || message;
    } catch { /* ignore */ }
    throw new ApiError(message, 'download_failed', res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const name = filename || (match ? decodeURIComponent(match[1]) : 'download');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
