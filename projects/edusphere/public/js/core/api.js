/**
 * API client — same-origin JSON requests with cookie sessions.
 */
export class ApiError extends Error {
  constructor(status, data, path) {
    const code = data?.error || `http_${status}`;
    super(data?.message || code);
    this.status = status;
    this.code = code;
    this.data = data;
    this.path = path;
  }
}

function buildQuery(params) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'filter' && typeof value === 'object') {
      for (const [fk, fv] of Object.entries(value)) {
        if (fv === undefined || fv === null || fv === '') continue;
        sp.append(`filter[${fk}]`, String(fv));
      }
    } else if (Array.isArray(value)) {
      for (const v of value) sp.append(key, String(v));
    } else {
      sp.append(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

async function request(method, path, { body, params, headers, raw = false, signal } = {}) {
  const url = path + buildQuery(params);
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, { error: 'network', message: 'Network error' }, path);
  }

  if (res.status === 401 && !path.includes('/auth/login')) {
    window.dispatchEvent(new CustomEvent('edusphere:unauthorized'));
  }

  if (raw) {
    if (!res.ok) throw new ApiError(res.status, { error: 'http_error' }, path);
    return res;
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) throw new ApiError(res.status, data, path);
  return data;
}

export const api = {
  request,
  get: (path, params, opts = {}) => request('GET', path, { ...opts, params }),
  post: (path, body, opts = {}) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts = {}) => request('PATCH', path, { ...opts, body }),
  put: (path, body, opts = {}) => request('PUT', path, { ...opts, body }),
  del: (path, params, opts = {}) => request('DELETE', path, { ...opts, params }),

  /* ---------------- file helpers ---------------- */
  upload(file, { category = 'general', entity = 'general', entityId = null, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload?name=${encodeURIComponent(file.name)}&category=${encodeURIComponent(category)}&entity=${encodeURIComponent(entity)}${entityId ? `&entity_id=${encodeURIComponent(entityId)}` : ''}`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new ApiError(xhr.status, data, '/api/upload'));
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => reject(new ApiError(0, { error: 'network' }, '/api/upload'));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  },

  async download(path, filename, params) {
    const res = await request('GET', path, { params, raw: true });
    const blob = await res.blob();
    const { downloadBlob } = await import('./dom.js');
    downloadBlob(blob, filename || 'download');
  },

  async getBlob(path, params) {
    const res = await request('GET', path, { params, raw: true });
    return res.blob();
  },
};

export { buildQuery };
