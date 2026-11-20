/**
 * Minimal reactive store: state + subscribers.
 */
const state = {
  boot: null,
  user: null,
  settings: {},
  locale: 'ar',
  dir: 'rtl',
  theme: 'system',
  translations: {},
  entities: [],
  entityMap: new Map(),
  groups: [],
  branches: [],
  currencies: [],
  baseCurrency: 'USD',
  academicYears: [],
  terms: [],
  unread: 0,
  sidebarCollapsed: false,
  density: 'comfortable',
  online: navigator.onLine,
};

const listeners = new Set();
const keyListeners = new Map();

export const store = {
  get state() {
    return state;
  },
  get(key) {
    return state[key];
  },
  set(patch, meta = {}) {
    const changed = [];
    for (const [key, value] of Object.entries(patch)) {
      if (state[key] !== value) {
        state[key] = value;
        changed.push(key);
      }
    }
    if (!changed.length) return;
    for (const fn of listeners) fn(state, changed, meta);
    for (const key of changed) {
      const set_ = keyListeners.get(key);
      if (set_) for (const fn of set_) fn(state[key], state, meta);
    }
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  on(key, fn) {
    if (!keyListeners.has(key)) keyListeners.set(key, new Set());
    keyListeners.get(key).add(fn);
    return () => keyListeners.get(key)?.delete(fn);
  },
  entity(name) {
    return state.entityMap.get(name) || null;
  },
  hasPerm(code) {
    if (!state.user) return false;
    if (state.user.is_super) return true;
    return Array.isArray(state.user.permissions) && state.user.permissions.includes(code);
  },
  can(...codes) {
    return codes.some((c) => store.hasPerm(c));
  },
};

/* Persisted UI preferences (per browser, not per user) */
export function loadLocalPrefs() {
  try {
    const raw = localStorage.getItem('edusphere.ui');
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs.sidebarCollapsed !== undefined) state.sidebarCollapsed = Boolean(prefs.sidebarCollapsed);
    if (prefs.density) state.density = prefs.density;
  } catch {
    /* ignore */
  }
}

export function saveLocalPrefs() {
  try {
    localStorage.setItem(
      'edusphere.ui',
      JSON.stringify({ sidebarCollapsed: state.sidebarCollapsed, density: state.density }),
    );
  } catch {
    /* ignore */
  }
}
