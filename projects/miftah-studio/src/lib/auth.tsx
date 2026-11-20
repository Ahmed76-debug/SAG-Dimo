import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
  can: (...permissions: string[]) => boolean;
  has: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUserState(null); setLoading(false); return; }
    try {
      const data = await api<{ user: User }>('/auth/me');
      setUserState(data.user);
    } catch {
      setUserState(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => setUserState(null);
    window.addEventListener('miftah:unauthorized', onUnauthorized);
    return () => window.removeEventListener('miftah:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { username, password } });
    setToken(data.token);
    setUserState(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setToken(null);
    setUserState(null);
  }, []);

  const can = useCallback((...permissions: string[]) => {
    if (!user) return false;
    return permissions.some((p) => user.permissions.includes(p));
  }, [user]);

  const has = useCallback((permission: string) => !!user?.permissions.includes(permission), [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user, loading, login, logout, refresh,
    setUser: (next) => setUserState(next),
    can, has,
  }), [user, loading, login, logout, refresh, can, has]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
