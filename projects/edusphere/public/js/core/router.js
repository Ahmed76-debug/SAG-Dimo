/**
 * Hash router. Patterns support :params.
 *   #/e/students
 *   #/e/students/12/edit
 *   #/reports/trial-balance?from=2025-01-01
 */
const routes = [];
let renderer = null;
let currentRoute = null;
let started = false;
const changeListeners = new Set();

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/dashboard';
  const [pathPart, queryPart] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const query = {};
  if (queryPart) {
    for (const [k, v] of new URLSearchParams(queryPart).entries()) {
      if (k.includes('[') && k.endsWith(']')) {
        const key = k.slice(0, k.indexOf('['));
        const inner = k.slice(k.indexOf('[') + 1, -1);
        query.filter = query.filter || {};
        query.filter[inner] = v;
      } else if (k in query) {
        query[k] = [].concat(query[k], v);
      } else {
        query[k] = v;
      }
    }
  }
  return { path, query, raw };
}

function matchPath(pattern, path) {
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  if (ps.length !== xs.length) return null;
  const params = {};
  for (let i = 0; i < ps.length; i += 1) {
    if (ps[i].startsWith(':')) params[ps[i].slice(1)] = decodeURIComponent(xs[i]);
    else if (ps[i] !== xs[i]) return null;
  }
  return params;
}

export function route(pattern, handler, meta = {}) {
  routes.push({ pattern, handler, meta });
  return router;
}

export function setRenderer(fn) {
  renderer = fn;
}

export function current() {
  return currentRoute;
}

export function onChange(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export async function resolve() {
  const { path, query, raw } = parseHash();
  let matched = null;
  for (const r of routes) {
    const params = matchPath(r.pattern, path);
    if (params) {
      matched = { ...r, params, query, path, raw };
      break;
    }
  }
  if (!matched) {
    matched = {
      pattern: '*',
      handler: null,
      params: {},
      query,
      path,
      raw,
      notFound: true,
    };
  }
  currentRoute = matched;
  for (const fn of changeListeners) {
    try {
      fn(matched);
    } catch (err) {
      console.error(err);
    }
  }
  if (renderer) await renderer(matched);
  return matched;
}

export function navigate(path, { replace = false, keepScroll = false } = {}) {
  const hash = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === hash) {
    resolve();
    return;
  }
  if (replace) { window.history.replaceState(null, '', hash); resolve(); }
  else window.location.hash = hash;
  if (!keepScroll) {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }
}

export function buildQuery(query = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
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
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function href(path, query) {
  return `#${path}${buildQuery(query)}`;
}

export function start() {
  if (!started) {
    started = true;
    window.addEventListener('hashchange', () => resolve());
  }
  if (!window.location.hash) window.history.replaceState(null, '', '#/dashboard');
  return resolve();
}

export const router = { route, navigate, start, resolve, current, onChange, href, buildQuery, setRenderer };
