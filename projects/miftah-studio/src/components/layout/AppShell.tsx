import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleDot } from 'lucide-react';
import { Sidebar, MobileSidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useInterval, useLocalStorage } from '@/lib/hooks';
import type { License, Paginated } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

export function AppShell() {
  const { can } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useLocalStorage('miftah.sidebar.collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [alerts, setAlerts] = useState({ pending: 0, expiring: 0 });

  const loadAlerts = useCallback(async () => {
    const [requests, licenses] = await Promise.allSettled([
      can('requests.view')
        ? api<{ total: number; pending: number }>('/requests', { query: { status: 'pending', limit: 1 } })
        : Promise.resolve(null),
      can('licenses.view')
        ? api<Paginated<License>>('/licenses', { query: { expiringDays: 45, limit: 1 } })
        : Promise.resolve(null),
    ]);
    setAlerts({
      pending: requests.status === 'fulfilled' && requests.value ? (requests.value.pending ?? requests.value.total ?? 0) : 0,
      expiring: licenses.status === 'fulfilled' && licenses.value ? licenses.value.total ?? 0 : 0,
    });
  }, [can]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts, location.pathname]);

  useInterval(loadAlerts, 60000);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-dvh bg-transparent">
      <Sidebar collapsed={collapsed} pending={alerts.pending} onToggle={() => setCollapsed((v) => !v)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMobile={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          alerts={alerts}
        />

        <main className="mx-auto w-full max-w-[1560px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>

        <footer className="mx-auto flex w-full max-w-[1560px] flex-wrap items-center justify-between gap-2 px-4 pb-5 text-[10.5px] text-muted sm:px-6 lg:px-8 no-print">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><CircleDot size={11} className="text-success" /> الخادم متصل</span>
            <span className="hidden sm:inline">تشفير Ed25519 · قاعدة بيانات SQLite</span>
          </div>
          <div className="flex items-center gap-3">
            {alerts.pending > 0 && <span className="text-warning">{formatNumber(alerts.pending)} طلب معلّق</span>}
            <span>مفتاح ستوديو · الإصدار 2.0</span>
          </div>
        </footer>
      </div>

      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} pending={alerts.pending} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
