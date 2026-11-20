import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AuditAction,
  AuditEntry,
  CloudState,
  DB,
  DoctorProfile,
  Permission,
  Settings,
  ThemeId,
  User,
} from "../lib/types";
import { createSeed, defaultProfile, defaultSettings } from "../lib/seed";
import { ALL_PERMISSIONS, can } from "../lib/permissions";
import { todayISO } from "../lib/utils";
import {
  cloudEnabled,
  cloudError,
  createCloudUser,
  diffDB,
  fetchAllData,
  fetchPublicContent,
  getSupabase,
  isEmptyChange,
  profileToUser,
  pushAll,
  pushChange,
  pushSingletons,
  callDispatch,
  restoreCloudBackup,
  toRow,
} from "../lib/cloud";
import type { NewCloudUser } from "../lib/cloud";
import { api, apiErrorMessage, getToken, setToken } from "../lib/api";

const DB_KEY = "tabib.db.v1";
const SESSION_KEY = "tabib.session.v1";
const THEME_KEY = "tabib.theme.v1";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type CollectionKey =
  | "patients"
  | "appointments"
  | "bookings"
  | "visits"
  | "prescriptions"
  | "invoices"
  | "archive"
  | "users"
  | "reminders";

type ToastKind = "ok" | "err" | "info";
interface ToastItem {
  id: number;
  msg: string;
  kind: ToastKind;
}

interface AppCtx {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  updateSettings: (patch: Partial<Settings>) => void;
  save: (key: CollectionKey, item: any) => void;
  remove: (key: CollectionKey, id: string) => void;
  session: User | null;
  login: (email: string, password?: string) => Promise<{ ok: boolean; error?: string }>;
  loginAs: (userId: string) => void;
  logout: () => void;
  hasPerm: (p: Permission) => boolean;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  toggleTheme: () => void;
  toast: (msg: string, kind?: ToastKind) => void;
  toasts: ToastItem[];
  dismissToast: (id: number) => void;
  resetDemo: () => void;
  restoreBackup: (next: DB) => Promise<{ ok: boolean; error?: string }>;
  today: string;
  cloud: CloudState;
  syncNow: () => Promise<void>;
  pullCloud: () => Promise<void>;
  pushDemoToCloud: () => Promise<{ ok: boolean; error?: string }>;
  cloudCreateUser: (input: NewCloudUser) => Promise<{ ok: boolean; error?: string }>;
  runDispatch: () => Promise<{ ok: boolean; error?: string; summary?: any }>;
  resetPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  recoveryMode: boolean;
  clearRecovery: () => void;
  getBookedSlots: (from: string, to: string) => Promise<{ date: string; time: string }[]>;
  submitPublicBooking: (booking: any) => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

/* ------------------------------------------------------------------ local DB */

export function emptyDB(
  settings: Settings = defaultSettings,
  profile: DoctorProfile = defaultProfile
): DB {
  return {
    patients: [],
    appointments: [],
    bookings: [],
    visits: [],
    prescriptions: [],
    invoices: [],
    archive: [],
    users: [],
    reminders: [],
    audit: [],
    settings,
    profile,
  };
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && Array.isArray(parsed.patients)) {
        if (!Array.isArray(parsed.reminders)) parsed.reminders = [];
        if (!Array.isArray(parsed.audit)) parsed.audit = [];
        // ضمان وجود حساب الأدمن الموحّد admin / admin123 بصلاحيات كاملة
        if (!Array.isArray(parsed.users)) parsed.users = [];
        const adminPerms = ALL_PERMISSIONS.map((p) => p.key);
        const existing = parsed.users.find((u) => u.id === "usr_admin" || u.email === "admin");
        if (!existing) {
          parsed.users = [
            {
              id: "usr_admin",
              name: "مدير النظام",
              role: "manager",
              email: "admin",
              phone: "admin",
              active: true,
              specialty: "مدير النظام — صلاحيات كاملة",
              extraPermissions: adminPerms,
              createdAt: todayISO(),
            },
            ...parsed.users,
          ];
        } else {
          existing.email = "admin";
          existing.active = true;
          existing.extraPermissions = adminPerms;
          existing.role = "manager";
        }
        return parsed;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  const seed = createSeed();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
  } catch {
    /* ignore quota */
  }
  return seed;
}

function loadTheme(): ThemeId {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t && THEME_IDS.includes(t as ThemeId)) return t as ThemeId;
  } catch {
    /* ignore */
  }
  return "light";
}

const THEME_IDS: ThemeId[] = ["light", "light-sand", "light-mist", "dark", "dark-midnight", "dark-emerald", "system"];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Supabase يضع type=recovery في الهاش (أو الاستعلام) عند فتح رابط استعادة الحساب. */
function detectRecoveryUrl(): boolean {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("type") === "recovery" || query.get("type") === "recovery";
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- provider */

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDbState] = useState<DB>(() => (cloudEnabled ? emptyDB() : loadDB()));
  const [theme, setThemeState] = useState<ThemeId>(() => loadTheme());
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (cloudEnabled) return null;
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  });
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [apiUser, setApiUser] = useState<User | null>(null);
  const [cloud, setCloud] = useState<CloudState>({
    enabled: cloudEnabled,
    ready: false,
    status: "connecting",
    lastSync: null,
    error: null,
    pending: false,
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [recoveryMode, setRecoveryMode] = useState(() => cloudEnabled && detectRecoveryUrl());

  const toastId = useRef(1);
  const saveTimer = useRef<number | null>(null);
  const dbRef = useRef<DB>(db);
  const cloudUserRef = useRef<User | null>(null);
  const apiUserRef = useRef<User | null>(null);
  const persistErrorRef = useRef("");
  const hydratedRef = useRef(false);
  const skipPersistRef = useRef(false);
  const syncedRef = useRef<DB | null>(null);
  const syncingRef = useRef(false);
  const pullingRef = useRef(false);
  const restoreInFlightRef = useRef(false);
  const hydrateLockRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const retryRef = useRef<number | null>(null);
  const errorToastRef = useRef("");
  const flushRef = useRef<() => Promise<boolean>>(async () => false);
  const pullRef = useRef<() => Promise<void>>(async () => {});
  const cloudUserRefSync = useRef(false);

  dbRef.current = db;
  cloudUserRef.current = cloudUser;
  apiUserRef.current = apiUser;

  const toast = useCallback((msg: string, kind: ToastKind = "ok") => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { id, msg, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearRecovery = useCallback(() => {
    setRecoveryMode(false);
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      url.searchParams.delete("type");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    } catch {
      /* ignore */
    }
  }, []);

  /** Saves the full clinic state to the managed SQL backend (debounced below). */
  const persistNow = useCallback(
    async (snapshot: DB): Promise<boolean> => {
      if (cloudEnabled || !hydratedRef.current || !getToken()) return false;
      try {
        await api("/state", { method: "PUT", body: snapshot });
        persistErrorRef.current = "";
        return true;
      } catch (error) {
        const message = apiErrorMessage(error);
        if (message !== persistErrorRef.current) {
          persistErrorRef.current = message;
          toast(`تعذر حفظ البيانات على الخادم: ${message}`, "err");
        }
        return false;
      }
    },
    [toast]
  );

  /* persist to the managed SQLite backend — localStorage stays as an offline cache */
  useEffect(() => {
    if (cloudEnabled) return;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* ignore quota */
    }
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (!hydratedRef.current || !getToken()) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistNow(db);
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [db, persistNow]);

  /* flush pending changes when the tab is hidden or the app is closing */
  useEffect(() => {
    if (cloudEnabled) return;
    const flush = () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void persistNow(dbRef.current);
    };
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", flushOnHide);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHide);
      window.removeEventListener("beforeunload", flush);
    };
  }, [persistNow]);

  /* theme */
  useEffect(() => {
    const root = document.documentElement;
    const allThemes = ["light", "light-sand", "light-mist", "dark", "dark-midnight", "dark-emerald"];
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
    const isDark = resolved.startsWith("dark");
    root.classList.remove("light", "dark", ...allThemes);
    root.classList.add(isDark ? "dark" : "light", resolved);
    root.setAttribute("data-theme", resolved);
    root.style.colorScheme = isDark ? "dark" : "light";
    root.setAttribute("lang", "ar");
    root.setAttribute("dir", "rtl");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const session = useMemo<User | null>(() => {
    if (cloudEnabled) return cloudUser;
    if (!apiUser) return null;
    return db.users.find((u) => u.id === apiUser.id) ?? apiUser;
  }, [cloudEnabled, cloudUser, apiUser, db.users]);

  /* keep the active profile fresh after the admin edits it */
  useEffect(() => {
    if (!cloudEnabled || !cloudUser || cloudUserRefSync.current) return;
    const fresh = db.users.find((u) => u.id === cloudUser.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(cloudUser)) {
      cloudUserRefSync.current = true;
      setCloudUser(fresh);
      window.setTimeout(() => {
        cloudUserRefSync.current = false;
      }, 0);
    }
  }, [db.users, cloudUser]);

  const setDb: React.Dispatch<React.SetStateAction<DB>> = useCallback((next) => {
    setDbState((prev) => (typeof next === "function" ? (next as (p: DB) => DB)(prev) : next));
  }, []);

  /* --------------------------------------------------------------- hydrate */

  const hydrateCloud = useCallback(
    async (supabase: any, userId: string) => {
      if (hydrateLockRef.current) return;
      hydrateLockRef.current = true;
      setCloud((c) => ({ ...c, status: "connecting", error: null }));
      try {
        let profileRes = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (profileRes.error) throw profileRes.error;

        let profile = profileRes.data;
        if (!profile) {
          // أول مستخدم في مشروع جديد يصبح طبيبًا/مديرًا تلقائيًا (مرة واحدة فقط)
          const boot = await supabase.rpc("bootstrap_first_admin");
          if (!boot.error) {
            profile = Array.isArray(boot.data) ? boot.data[0] : boot.data;
          } else {
            const again = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
            if (again.data) profile = again.data;
          }
        }

        if (!profile) {
          await supabase.auth.signOut();
          throw new Error("لا يوجد ملف مستخدم لهذا الحساب. اطلب من مدير العيادة إضافتك.");
        }

        const user = profileToUser(profile);
        if (!user.active) {
          await supabase.auth.signOut();
          throw new Error("هذا الحساب موقوف. تواصل مع مدير العيادة.");
        }

        const canSeeUsers = can(user.role, user.extraPermissions, "users.view");
        const snap = await fetchAllData(
          supabase,
          canSeeUsers,
          userId,
          dbRef.current.settings,
          dbRef.current.profile
        );

        // إنشاء صفوف الإعدادات والملف العام عند أول دخول (بصلاحية)
        try {
          if (!snap.settingsExists && can(user.role, user.extraPermissions, "settings.edit")) {
            await pushSingletons(supabase, snap.db.settings, null);
          }
          if (!snap.profileExists && can(user.role, user.extraPermissions, "profile.edit")) {
            await pushSingletons(supabase, null, snap.db.profile);
          }
        } catch {
          /* الصلاحيات قد تمنع الإنشاء — لا نعطّل الدخول */
        }

        hydratedRef.current = true;
        syncedRef.current = clone(snap.db);
        setDbState((prev) => ({ ...snap.db, audit: prev.audit ?? [] }));
        setCloudUser(user);
        setCloud((c) => ({
          ...c,
          ready: true,
          status: "online",
          error: null,
          pending: false,
          lastSync: new Date().toISOString(),
        }));

        // لا نُبقي نسخة محلية من بيانات المرضى بعد نجاح الاتصال السحابي
        try {
          localStorage.removeItem(DB_KEY);
          localStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
      } catch (err) {
        setCloud((c) => ({
          ...c,
          ready: true,
          status: "error",
          error: cloudError(err),
        }));
        throw err;
      } finally {
        hydrateLockRef.current = false;
      }
    },
    []
  );

  const clearCloudSession = useCallback(() => {
    hydratedRef.current = false;
    syncedRef.current = null;
    cloudUserRef.current = null;
    setCloudUser(null);
    if (retryRef.current) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    setDbState((prev) => emptyDB(prev.settings, prev.profile));
    setCloud((c) => ({
      ...c,
      ready: true,
      status: "online",
      pending: false,
      error: null,
      lastSync: null,
    }));
  }, []);

  /* -------------------------------------------------------------- boot cloud */

  useEffect(() => {
    if (!cloudEnabled) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      let supabase: any = null;
      try {
        supabase = await getSupabase();

        try {
          const pub = await fetchPublicContent(supabase);
          if (!cancelled) {
            setDbState((prev) => ({
              ...prev,
              settings: pub.settings ?? prev.settings,
              profile: pub.profile ?? prev.profile,
            }));
          }
        } catch {
          /* الصفحة العامة تعمل بالبيانات الافتراضية عند تعذر الاتصال */
        }

        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session?.user) {
          try {
            await hydrateCloud(supabase, data.session.user.id);
          } catch {
            /* الخطأ ظاهر في cloud.error */
          }
        }

        const sub = supabase.auth.onAuthStateChange((event: string, s: any) => {
          if (event === "PASSWORD_RECOVERY") {
            setRecoveryMode(true);
          } else if (event === "SIGNED_OUT") {
            clearCloudSession();
          } else if (event === "SIGNED_IN" && s?.user && !cloudUserRef.current) {
            void hydrateCloud(supabase, s.user.id).catch(() => undefined);
          }
        });
        unsubscribe = () => sub.data.subscription.unsubscribe();

        if (!cancelled) {
          setCloud((c) => ({
            ...c,
            ready: true,
            status: c.status === "error" ? "error" : cloudUserRef.current ? c.status : "online",
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setCloud((c) => ({
            ...c,
            ready: true,
            status: "error",
            error: cloudError(err),
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [clearCloudSession, hydrateCloud]);

  /* ------------------------------------------- boot managed SQLite (local) */

  useEffect(() => {
    if (cloudEnabled) return;
    let cancelled = false;

    (async () => {
      // Public content is available before login (/doctor and /book).
      try {
        const content = await api<{ settings: Settings | null; profile: DoctorProfile | null }>(
          "/public/content"
        );
        if (!cancelled && (content.settings || content.profile)) {
          setDbState((prev) => ({
            ...prev,
            settings: content.settings ?? prev.settings,
            profile: content.profile ?? prev.profile,
          }));
        }
      } catch {
        /* keep the cached/default public content when the server is unreachable */
      }

      if (getToken()) {
        try {
          const me = await api<{ user: User }>("/auth/me");
          if (cancelled) return;
          setApiUser(me.user);
          setSessionId(me.user.id);
          const state = await api<DB>("/state");
          if (cancelled) return;
          setDbState((prev) => ({
            ...state,
            settings: state.settings ?? prev.settings,
            profile: state.profile ?? prev.profile,
            audit: Array.isArray(state.audit) ? state.audit : prev.audit,
          }));
          skipPersistRef.current = true;
          hydratedRef.current = true;
        } catch {
          if (!cancelled) setToken(null);
        }
      }

      if (!cancelled) {
        setCloud((c) => ({
          ...c,
          ready: true,
          status: "online",
          error: null,
          lastSync: new Date().toISOString(),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ----------------------------------------------------------------- auth */

  const login = useCallback(
    async (email: string, password?: string): Promise<{ ok: boolean; error?: string }> => {
      if (!cloudEnabled) {
        try {
          const result = await api<{ token: string; user: User }>("/auth/login", {
            method: "POST",
            body: { username: email.trim(), password: password ?? "" },
          });
          setToken(result.token);
          setApiUser(result.user);
          setSessionId(result.user.id);
          try {
            localStorage.setItem(SESSION_KEY, result.user.id);
          } catch {
            /* ignore */
          }
          const state = await api<DB>("/state");
          setDbState((prev) => ({
            ...state,
            settings: state.settings ?? prev.settings,
            profile: state.profile ?? prev.profile,
            audit: Array.isArray(state.audit) ? state.audit : prev.audit,
          }));
          skipPersistRef.current = true;
          hydratedRef.current = true;
          setCloud((c) => ({
            ...c,
            ready: true,
            status: "online",
            error: null,
            lastSync: new Date().toISOString(),
          }));
          return { ok: true };
        } catch (err) {
          const message = apiErrorMessage(err);
          setCloud((c) => ({ ...c, ready: true, status: "error", error: message }));
          return { ok: false, error: message };
        }
      }

      try {
        setCloud((c) => ({ ...c, status: "connecting", error: null }));
        const supabase = await getSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password ?? "",
        });
        if (error) {
          const msg = cloudError(error);
          setCloud((c) => ({ ...c, status: "error", error: msg }));
          return { ok: false, error: msg };
        }
        if (!data.user) return { ok: false, error: "تعذر إنشاء الجلسة." };
        await hydrateCloud(supabase, data.user.id);
        return { ok: true };
      } catch (err) {
        const msg = cloudError(err);
        setCloud((c) => ({ ...c, status: "error", error: msg }));
        return { ok: false, error: msg };
      }
    },
    [hydrateCloud]
  );

  const loginAs = useCallback(
    (userId: string) => {
      if (cloudEnabled) return;
      const user = dbRef.current.users.find((u) => u.id === userId);
      if (!user) return;
      void login(user.email || user.phone, userId === "usr_admin" ? "admin123" : "1234");
    },
    [login]
  );

  const logout = useCallback(() => {
    if (cloudEnabled) {
      getSupabase()
        .then((supabase) => supabase.auth.signOut())
        .catch(() => undefined);
      clearCloudSession();
      return;
    }
    setToken(null);
    setApiUser(null);
    setSessionId(null);
    hydratedRef.current = false;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setCloud((c) => ({
      ...c,
      ready: true,
      status: "online",
      pending: false,
      error: null,
      lastSync: null,
    }));
  }, [clearCloudSession]);

  const resetPassword = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      if (!cloudEnabled) return { ok: false, error: "متاح في الوضع السحابي فقط." };
      try {
        const supabase = await getSupabase();
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${location.origin}/login`,
        });
        if (error) return { ok: false, error: cloudError(error) };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: cloudError(err) };
      }
    },
    []
  );

  const changePassword = useCallback(
    async (password: string): Promise<{ ok: boolean; error?: string }> => {
      if (!cloudEnabled) {
        if (password.length < 4) {
          return { ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل." };
        }
        try {
          await api("/auth/change-password", {
            method: "POST",
            body: { newPassword: password },
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: apiErrorMessage(err) };
        }
      }
      if (password.length < 8) return { ok: false, error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." };
      try {
        const supabase = await getSupabase();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { ok: false, error: cloudError(error) };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: cloudError(err) };
      }
    },
    []
  );

  /* ------------------------------------------------------------- permissions */

  const hasPerm = useCallback(
    (p: Permission) => {
      if (!session) return false;
      return can(session.role, session.extraPermissions, p);
    },
    [session]
  );

  /* ------------------------------------------------------------ local writes */

  const makeAuditEntry = useCallback(
    (
      action: AuditAction,
      entity: string,
      entityId: string,
      before?: unknown,
      after?: unknown,
      bundle?: unknown
    ): AuditEntry => {
      const item = (after ?? before) as Record<string, unknown> | undefined;
      const label = item
        ? String(item.name || item.title || item.code || item.number || item.label || entityId)
        : entityId;
      return {
        id: uid(),
        at: new Date().toISOString(),
        userId: session?.id,
        userName: session?.name,
        action,
        entity,
        entityId,
        label,
        before,
        after,
        bundle,
      };
    },
    [session]
  );

  const logAudit = useCallback(
    (
      action: AuditAction,
      entity: string,
      entityId: string,
      before?: unknown,
      after?: unknown,
      bundle?: unknown
    ) => {
      const entry = makeAuditEntry(action, entity, entityId, before, after, bundle);
      setDbState((prev) => ({
        ...prev,
        audit: [entry, ...(Array.isArray(prev.audit) ? prev.audit : [])].slice(0, 1000),
      }));
    },
    [makeAuditEntry]
  );

  const save = useCallback(
    (key: CollectionKey, item: any) => {
      setDbState((prev) => {
        const list = prev[key] as any[];
        const idx = list.findIndex((x) => x.id === item.id);
        const existing = idx >= 0 ? list[idx] : undefined;
        const nextList = idx >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
        const entry = makeAuditEntry(
          existing ? "update" : "create",
          key,
          String(item.id),
          existing,
          item
        );
        return {
          ...prev,
          [key]: nextList,
          audit: [entry, ...(Array.isArray(prev.audit) ? prev.audit : [])].slice(0, 1000),
        };
      });
    },
    [makeAuditEntry]
  );

  const remove = useCallback((key: CollectionKey, id: string) => {
    const existing = (dbRef.current[key] as any[]).find((x) => x.id === id);
    setDbState((prev) => {
      if (key === "patients") {
        const appointmentIds = new Set(
          prev.appointments.filter((a) => a.patientId === id).map((a) => a.id)
        );
        return {
          ...prev,
          patients: prev.patients.filter((x) => x.id !== id),
          appointments: prev.appointments.filter((x) => x.patientId !== id),
          visits: prev.visits.filter((x) => x.patientId !== id),
          prescriptions: prev.prescriptions.filter((x) => x.patientId !== id),
          invoices: prev.invoices.filter((x) => x.patientId !== id),
          bookings: prev.bookings.map((b) =>
            b.patientId === id || (b.appointmentId && appointmentIds.has(b.appointmentId))
              ? {
                  ...b,
                  patientId: undefined,
                  appointmentId:
                    b.appointmentId && appointmentIds.has(b.appointmentId)
                      ? undefined
                      : b.appointmentId,
                }
              : b
          ),
          archive: prev.archive.map((a) =>
            a.patientId === id ? { ...a, patientId: undefined } : a
          ),
        };
      }
      if (key === "appointments") {
        return {
          ...prev,
          appointments: prev.appointments.filter((x) => x.id !== id),
          bookings: prev.bookings.map((b) =>
            b.appointmentId === id ? { ...b, appointmentId: undefined } : b
          ),
          invoices: prev.invoices.map((i) =>
            i.appointmentId === id ? { ...i, appointmentId: undefined } : i
          ),
        };
      }
      if (key === "visits") {
        return {
          ...prev,
          visits: prev.visits.filter((x) => x.id !== id),
          prescriptions: prev.prescriptions.map((p) =>
            p.visitId === id ? { ...p, visitId: undefined } : p
          ),
        };
      }
      const list = prev[key] as any[];
      return { ...prev, [key]: list.filter((x) => x.id !== id) };
    });
    if (existing) {
      let bundle: unknown;
      if (key === "patients") {
        const current = dbRef.current;
        bundle = {
          appointments: current.appointments.filter((a) => a.patientId === id),
          visits: current.visits.filter((v) => v.patientId === id),
          prescriptions: current.prescriptions.filter((p) => p.patientId === id),
          invoices: current.invoices.filter((i) => i.patientId === id),
        };
      }
      logAudit("delete", key, id, existing, undefined, bundle);
    }
  }, [logAudit]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const before = dbRef.current.settings;
    setDbState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    logAudit("update", "settings", "settings", before, { ...before, ...patch });
  }, [logAudit]);

  /* --------------------------------------------------------------- syncing */

  const flush = useCallback(async (): Promise<boolean> => {
    if (!cloudEnabled || !hydratedRef.current || !cloudUserRef.current) return false;
    if (restoreInFlightRef.current) return false;
    if (syncingRef.current) {
      syncQueuedRef.current = true;
      return false;
    }
    const base = syncedRef.current;
    if (!base) return false;

    const snapshot = clone(dbRef.current);
    const change = diffDB(base, snapshot);
    if (isEmptyChange(change)) {
      setCloud((c) => (c.pending ? { ...c, pending: false, status: "online" } : c));
      return true;
    }

    syncingRef.current = true;
    setCloud((c) => ({ ...c, status: "syncing", pending: true }));
    try {
      const supabase = await getSupabase();
      await pushChange(supabase, change);
      if (change.settings) await pushSingletons(supabase, snapshot.settings, null);
      if (change.profile) await pushSingletons(supabase, null, snapshot.profile);

      syncedRef.current = snapshot;
      errorToastRef.current = "";

      const remaining = diffDB(snapshot, dbRef.current);
      const stillDirty = !isEmptyChange(remaining);
      if (stillDirty) syncQueuedRef.current = true;

      setCloud((c) => ({
        ...c,
        status: "online",
        pending: stillDirty,
        error: null,
        lastSync: new Date().toISOString(),
      }));
      return true;
    } catch (err) {
      const msg = cloudError(err);
      setCloud((c) => ({ ...c, status: "error", error: msg, pending: true }));
      if (errorToastRef.current !== msg) {
        errorToastRef.current = msg;
        toast(`تعذرت المزامنة: ${msg}`, "err");
      }
      if (retryRef.current) window.clearTimeout(retryRef.current);
      retryRef.current = window.setTimeout(() => {
        void flushRef.current?.();
      }, 8000);
      return false;
    } finally {
      syncingRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        window.setTimeout(() => {
          void flushRef.current?.();
        }, 60);
      }
    }
  }, [toast]);

  const pull = useCallback(async (): Promise<void> => {
    if (!cloudEnabled || !hydratedRef.current || !cloudUserRef.current || pullingRef.current) return;
    if (restoreInFlightRef.current) return;
    const base = syncedRef.current;
    if (base && !isEmptyChange(diffDB(base, dbRef.current))) return;
    pullingRef.current = true;
    try {
      const supabase = await getSupabase();
      const user = cloudUserRef.current;
      const canSeeUsers = can(user.role, user.extraPermissions, "users.view");
      const snap = await fetchAllData(
        supabase,
        canSeeUsers,
        user.id,
        dbRef.current.settings,
        dbRef.current.profile
      );
      syncedRef.current = clone(snap.db);
      setDbState((prev) => ({ ...snap.db, audit: prev.audit ?? [] }));
      setCloud((c) => ({
        ...c,
        status: "online",
        pending: false,
        error: null,
        lastSync: new Date().toISOString(),
      }));
    } catch (err) {
      const msg = cloudError(err);
      setCloud((c) => ({ ...c, status: "error", error: msg }));
      toast(`تعذر تحديث البيانات من السحابة: ${msg}`, "err");
    } finally {
      pullingRef.current = false;
    }
  }, [toast]);

  flushRef.current = flush;
  pullRef.current = pull;

  /* debounced write-through whenever the in-memory DB changes */
  useEffect(() => {
    if (!cloudEnabled || !cloudUser || !hydratedRef.current) return;
    const base = syncedRef.current;
    if (!base) return;
    const change = diffDB(base, db);
    if (isEmptyChange(change)) {
      setCloud((c) => (c.pending ? { ...c, pending: false, status: "online" } : c));
      return;
    }
    setCloud((c) => (c.pending ? c : { ...c, pending: true }));
    const timer = window.setTimeout(() => {
      void flushRef.current?.();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [db, cloudUser]);

  /* pull fresh data when the window regains focus (multi-device support) */
  useEffect(() => {
    if (!cloudEnabled) return;
    const onFocus = () => {
      if (!hydratedRef.current || syncingRef.current) return;
      const base = syncedRef.current;
      if (!base || !isEmptyChange(diffDB(base, dbRef.current))) return;
      void pullRef.current?.();
    };
    const onOnline = () => {
      void flushRef.current?.();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(
    () => () => {
      if (retryRef.current) window.clearTimeout(retryRef.current);
    },
    []
  );

  /* ----------------------------------------------------------- cloud actions */

  const syncNow = useCallback(async () => {
    const ok = await flushRef.current?.();
    if (ok) await pullRef.current?.();
  }, []);

  const pushDemoToCloud = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!cloudEnabled) return { ok: false, error: "السحابة غير مفعّلة." };
    if (!session || !hasPerm("users.edit")) {
      return { ok: false, error: "تحتاج صلاحية إدارة المستخدمين لرفع بيانات العرض." };
    }
    try {
      const supabase = await getSupabase();
      const existing = await supabase.from("patients").select("id", { head: true, count: "exact" });
      if (existing.error) throw existing.error;
      if ((existing.count ?? 0) > 0) {
        return {
          ok: false,
          error: "السحابة تحتوي بيانات بالفعل. بيانات العرض تُرفع فقط إلى مشروع فارغ لحماية بياناتك.",
        };
      }
      await pushAll(supabase, createSeed());
      await pullRef.current?.();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: cloudError(err) };
    }
  }, [hasPerm, session]);

  const cloudCreateUser = useCallback(
    async (input: NewCloudUser): Promise<{ ok: boolean; error?: string }> => {
      if (!cloudEnabled) return { ok: false, error: "السحابة غير مفعّلة." };
      try {
        const supabase = await getSupabase();
        await createCloudUser(supabase, input);
        await flushRef.current?.();
        await pullRef.current?.();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: cloudError(err) };
      }
    },
    []
  );

  const runDispatch = useCallback(async (): Promise<{ ok: boolean; error?: string; summary?: any }> => {
    if (!cloudEnabled) return { ok: false, error: "محرك الإرسال التلقائي متاح في الوضع السحابي." };
    try {
      const supabase = await getSupabase();
      const summary = await callDispatch(supabase);
      await flushRef.current?.();
      await pullRef.current?.();
      return { ok: true, summary };
    } catch (err) {
      return { ok: false, error: cloudError(err) };
    }
  }, []);

  const getBookedSlots = useCallback(
    async (from: string, to: string): Promise<{ date: string; time: string }[]> => {
      if (!cloudEnabled) {
        return api<{ date: string; time: string }[]>(
          `/public/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
      }
      const supabase = await getSupabase();
      const { data, error } = await supabase.rpc("booked_slots_range", { from_day: from, to_day: to });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ date: r.day, time: r.slot }));
    },
    []
  );

  const submitPublicBooking = useCallback(
    async (booking: any): Promise<void> => {
      if (!cloudEnabled) {
        const created = await api<any>("/public/bookings", { method: "POST", body: booking });
        if (getToken()) save("bookings", created);
        return;
      }
      const supabase = await getSupabase();
      const { error } = await supabase.from("bookings").insert(toRow("bookings", booking));
      if (error) throw new Error(cloudError(error));
    },
    [save]
  );

  const resetDemo = useCallback(() => {
    if (cloudEnabled) {
      toast("إعادة الضبط غير متاحة في الوضع السحابي لحماية البيانات.", "err");
      return;
    }
    const seed = createSeed();
    setDbState(seed);
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(seed));
    } catch {
      /* ignore */
    }
  }, [toast]);

  const restoreBackup = useCallback(
    async (next: DB): Promise<{ ok: boolean; error?: string }> => {
      if (!hasPerm("settings.edit")) {
        return { ok: false, error: "تحتاج صلاحية إدارة الإعدادات لاستعادة نسخة احتياطية." };
      }

      const restoreEntry: AuditEntry = {
        id: uid(),
        at: new Date().toISOString(),
        userId: session?.id,
        userName: session?.name,
        action: "restore",
        entity: "backup",
        entityId: "backup",
        label: "استعادة نسخة احتياطية",
      };

      if (!cloudEnabled) {
        const restored = clone(next);
        if (session && !restored.users.some((user) => user.id === session.id)) {
          restored.users = [clone(session), ...restored.users];
        }
        restored.audit = [restoreEntry, ...(Array.isArray(restored.audit) ? restored.audit : [])].slice(0, 1000);
        setDbState(restored);
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        try {
          localStorage.setItem(DB_KEY, JSON.stringify(restored));
        } catch {
          /* ignore quota */
        }
        return { ok: true };
      }

      if (!hydratedRef.current || !cloudUserRef.current) {
        return { ok: false, error: "انتظر اكتمال الاتصال السحابي ثم أعد المحاولة." };
      }
      if (syncingRef.current || pullingRef.current) {
        return { ok: false, error: "المزامنة جارية الآن. انتظر انتهاءها ثم أعد المحاولة." };
      }

      restoreInFlightRef.current = true;
      syncQueuedRef.current = false;
      setCloud((c) => ({ ...c, status: "syncing", pending: false, error: null }));
      try {
        const supabase = await getSupabase();
        await restoreCloudBackup(supabase, next);

        // الحسابات مرتبطة بـ Auth وتبقى كما هي؛ بقية البيانات تأتي من النسخة.
        const restored = clone(next);
        restored.users = clone(dbRef.current.users);
        restored.audit = [
          restoreEntry,
          ...(Array.isArray(restored.audit) ? restored.audit : []),
        ].slice(0, 1000);
        setDbState(restored);
        syncedRef.current = clone(restored);
        syncQueuedRef.current = false;
        setCloud((c) => ({
          ...c,
          status: "online",
          pending: false,
          error: null,
          lastSync: new Date().toISOString(),
        }));
        return { ok: true };
      } catch (err) {
        const message = cloudError(err);
        setCloud((c) => ({ ...c, status: "error", error: message }));
        return { ok: false, error: message };
      } finally {
        restoreInFlightRef.current = false;
      }
    },
    [hasPerm, session]
  );

  const setTheme = useCallback((t: ThemeId) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () =>
      setThemeState((t) => {
        const idx = THEME_IDS.indexOf(t);
        return THEME_IDS[(idx + 1) % THEME_IDS.length];
      }),
    [],
  );

  const value: AppCtx = {
    db,
    setDb,
    updateSettings,
    save,
    remove,
    session,
    login,
    loginAs,
    logout,
    hasPerm,
    theme,
    setTheme,
    toggleTheme,
    toast,
    toasts,
    dismissToast,
    resetDemo,
    restoreBackup,
    today: todayISO(),
    cloud,
    syncNow,
    pullCloud: pull,
    pushDemoToCloud,
    cloudCreateUser,
    runDispatch,
    resetPassword,
    changePassword,
    recoveryMode,
    clearRecovery,
    getBookedSlots,
    submitPublicBooking,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
