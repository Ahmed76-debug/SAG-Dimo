/* ==========================================================================
   API client — منصة طبيب (managed SQL backend)
   - نفس أصل الواجهة (Vite proxy في التطوير، Express في الإنتاج)
   - التوكن يُحفظ في localStorage ويُرسل مع كل طلب محمي
   ========================================================================== */

const TOKEN_KEY = "tabib.api.token.v1";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status = 500, code?: string, details?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function resolveUrl(path: string) {
  if (/^https?:\/\//i.test(path) || path.startsWith("/api/")) return path;
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; headers?: Record<string, string> } = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(resolveUrl(path), {
    method: opts.method || "GET",
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? opts.body
          : JSON.stringify(opts.body),
  });

  let payload: any = null;
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload === "string" ? payload : res.statusText) ||
      "تعذر الاتصال بالخادم.";
    if (res.status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent("tabib:unauthorized"));
    }
    throw new ApiError(message, res.status, payload?.error?.code, payload?.error?.details);
  }

  return payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
}

export async function apiDownload(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(resolveUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    let message = "تعذر تنزيل الملف.";
    try {
      const payload = await res.json();
      message = payload?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "حدث خطأ غير متوقع.";
}
