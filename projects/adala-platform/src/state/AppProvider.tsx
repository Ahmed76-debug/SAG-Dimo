import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLiveQuery } from "@/lib/liveQuery";
import { db, nowISO, uid } from "@/lib/db";
import { clearSession, login as doLogin, fetchMe, logoutApi, getToken } from "@/lib/auth";
import { can as canDo, type Permission } from "@/lib/permissions";
import type { AppNotification, Settings, ThemeId, ThemeMode, User } from "@/lib/types";

/* =============================================================
   حالة التطبيق العامة: الجلسة · الإعدادات · المظهر · التذكيرات
   ============================================================= */

interface AppCtx {
  user: User | null;
  settings: Settings;
  ready: boolean;
  theme: ThemeMode;
  effectiveTheme: "light" | "dark";
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  can: (p: Permission) => boolean;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setTheme: (t: ThemeMode) => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  pushNotification: (n: Omit<AppNotification, "id" | "at" | "read">) => Promise<void>;
  notifyPermission: NotificationPermission;
  requestNotifyPermission: () => Promise<void>;
  refreshKey: number;
  refresh: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp خارج AppProvider");
  return c;
}

export function usePermission(perm: Permission): boolean {
  const { can } = useApp();
  return can(perm);
}

const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  profile: {
    firmName: "مكتب المحاماة",
    tagline: "",
    lawyerName: "",
    licenseNumber: "",
    email: "",
    phone: "",
    address: "",
    website: "",
  },
  theme: "dark",
  density: "comfortable",
  reminderLeadDays: 3,
  dailyDigest: true,
  soundEnabled: true,
  currency: "SAR",
  defaultFeeType: "fixed",
  archiveAfterMonths: 12,
  autoArchiveClosed: false,
  printHeader: "",
  printFooter: "",
  confidentialityNotice: "",
  sidebarCollapsed: false,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true,
  );
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  // استعادة الجلسة من الخادم (قاعدة بيانات SQLite مُدارة)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!getToken()) {
        if (mounted) { setSessionUserId(null); setSessionReady(true); }
        return;
      }
      const me = await fetchMe();
      if (!mounted) return;
      if (me?.id) setSessionUserId(me.id);
      else { clearSession(); setSessionUserId(null); }
      setSessionReady(true);
    })();
    const onUnauth = () => { clearSession(); setSessionUserId(null); setSessionReady(true); };
    window.addEventListener("adala:unauthorized", onUnauth);
    return () => { mounted = false; window.removeEventListener("adala:unauthorized", onUnauth); };
  }, []);

  const user = useLiveQuery(
    async () => (sessionUserId ? ((await db.users.get(sessionUserId)) ?? null) : null),
    [sessionUserId, refreshKey],
    undefined,
  );

  /** يصبح true بعد التحقق من الجلسة مع الخادم */
  const ready = sessionReady && (!sessionUserId || user !== undefined);

  const settings = useLiveQuery(async () => ((await db.settings.get("settings")) ?? DEFAULT_SETTINGS), [], DEFAULT_SETTINGS);

  const notifications = useLiveQuery(
    () => db.notifications.orderBy("at").reverse().limit(50).toArray(),
    [],
    [],
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq?.addEventListener("change", handler);
    return () => mq?.removeEventListener("change", handler);
  }, []);

  const theme = (settings?.theme ?? "dark") as ThemeMode;
  const isDarkId = (id: string) => id.startsWith("dark");
  const resolved: ThemeId | "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const effectiveTheme: "light" | "dark" = isDarkId(String(resolved)) ? "dark" : "light";

  useEffect(() => {
    const root = document.documentElement;
    const id = String(resolved);
    const all = ["light", "light-sand", "light-mist", "dark", "dark-midnight", "dark-emerald"];
    root.classList.remove("light", "dark", ...all);
    root.classList.add(effectiveTheme, id);
    root.dataset.theme = id;
    root.style.colorScheme = effectiveTheme;
  }, [resolved, effectiveTheme]);

  const login = useCallback(async (username: string, password: string) => {
    const u = await doLogin(username, password);
    if (!u) return false;
    setSessionUserId(u.id);
    setRefreshKey((k) => k + 1);
    return true;
  }, []);

  const logout = useCallback(() => {
    void logoutApi();
    clearSession();
    setSessionUserId(null);
  }, []);

  const can = useCallback(
    (p: Permission) => canDo(user, p),
    [user],
  );

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const current = (await db.settings.get("settings")) ?? DEFAULT_SETTINGS;
    await db.settings.put({ ...current, ...patch, id: "settings" });
  }, []);

  const setTheme = useCallback(
    async (t: ThemeMode) => {
      await updateSettings({ theme: t });
    },
    [updateSettings],
  );

  const pushNotification = useCallback(
    async (n: Omit<AppNotification, "id" | "at" | "read">) => {
      await db.notifications.add({ ...n, id: uid("nf_"), at: nowISO(), read: false });
    },
    [],
  );

  const markNotificationRead = useCallback(async (id: string) => {
    await db.notifications.update(id, { read: true });
  }, []);

  const markAllRead = useCallback(async () => {
    const all = await db.notifications.toArray();
    for (const n of all.filter((x) => !x.read)) {
      await db.notifications.update(n.id, { read: true });
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    await db.notifications.clear();
  }, []);

  const requestNotifyPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifyPermission(p);
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  /* ------------------------- مجدول التذكيرات ------------------------- */
  const notifiedRef = useRef<Set<string>>(new Set());
  const tickRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      const lead = settings?.reminderLeadDays ?? 3;
      const now = Date.now();
      const [events, tasks] = await Promise.all([
        db.events.filter((e) => !e.archived && e.status === "scheduled").toArray(),
        db.tasks.filter((t) => !t.archived && t.status !== "done" && t.status !== "cancelled").toArray(),
      ]);
      const existing = await db.notifications.toArray();
      const has = (kind: string, refId: string) =>
        existing.some((n) => n.kind === kind && n.refId === refId);

      for (const e of events) {
        const diff = new Date(e.date).getTime() - now;
        const days = diff / 86_400_000;
        if (days < -1 || days > Math.max(lead, e.remindBeforeDays || 0)) continue;
        const key = `event:${e.id}`;
        if (notifiedRef.current.has(key) || has("deadline", e.id)) {
          notifiedRef.current.add(key);
          continue;
        }
        notifiedRef.current.add(key);
        await db.notifications.add({
          id: uid("nf_"),
          title: e.type === "hearing" ? "جلسة قضائية قريبة" : "ميعاد قادم",
          body: `${e.title} — ${new Date(e.date).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}`,
          kind: "deadline",
          refType: "event",
          refId: e.id,
          read: false,
          at: nowISO(),
          link: "/calendar",
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(e.title, { body: `${e.title} — ${e.location ?? ""}`, tag: key });
        }
      }

      for (const t of tasks) {
        if (!t.dueDate) continue;
        const diff = new Date(t.dueDate).getTime() - now;
        const days = diff / 86_400_000;
        if (days < -1 || days > 2) continue;
        const key = `task:${t.id}`;
        if (notifiedRef.current.has(key) || has("task", t.id)) {
          notifiedRef.current.add(key);
          continue;
        }
        notifiedRef.current.add(key);
        await db.notifications.add({
          id: uid("nf_"),
          title: "مهمة مستحقة",
          body: t.title,
          kind: "task",
          refType: "task",
          refId: t.id,
          read: false,
          at: nowISO(),
          link: "/tasks",
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("مهمة مستحقة", { body: t.title, tag: key });
        }
      }
    };

    run();
    const interval = window.setInterval(() => {
      tickRef.current += 1;
      run();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user, settings?.reminderLeadDays]);

  const value = useMemo<AppCtx>(
    () => ({
      user: user ?? null,
      settings: settings ?? DEFAULT_SETTINGS,
      ready,
      theme,
      effectiveTheme,
      login,
      logout,
      can,
      updateSettings,
      setTheme,
      notifications: notifications ?? [],
      unreadCount: (notifications ?? []).filter((n) => !n.read).length,
      markNotificationRead,
      markAllRead,
      clearNotifications,
      pushNotification,
      notifyPermission,
      requestNotifyPermission,
      refreshKey,
      refresh,
    }),
    [
      user,
      settings,
      ready,
      theme,
      effectiveTheme,
      login,
      logout,
      can,
      updateSettings,
      setTheme,
      notifications,
      markNotificationRead,
      markAllRead,
      clearNotifications,
      pushNotification,
      notifyPermission,
      requestNotifyPermission,
      refreshKey,
      refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

