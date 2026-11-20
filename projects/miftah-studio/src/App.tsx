import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BrandMark } from '@/components/Brand';
import { useAuth } from '@/lib/auth';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Products } from '@/pages/Products';
import { Licenses } from '@/pages/Licenses';
import { Customers } from '@/pages/Customers';
import { Activations } from '@/pages/Activations';
import { Requests } from '@/pages/Requests';
import { Team } from '@/pages/Team';
import { Backups } from '@/pages/Backups';
import { Audit } from '@/pages/Audit';
import { Settings } from '@/pages/Settings';
import { Tutorials } from '@/pages/Tutorials';
import { DataTools } from '@/pages/DataTools';
import { AccessDenied } from '@/components/ui/page';
import { NotFound } from '@/pages/NotFound';

function Splash() {
  return (
    <div className="mesh flex min-h-dvh flex-col items-center justify-center gap-5">
      <div className="animate-floaty"><BrandMark size={58} glow /></div>
      <div className="text-center">
        <p className="text-lg font-bold text-ink">مفتاح ستوديو</p>
        <p className="mt-1 text-[11px] tracking-[0.2em] text-muted">MIFTAH STUDIO</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full w-1/2 animate-[shimmer_1.4s_linear_infinite] rounded-full bg-primary" />
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function Gate({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) return <AccessDenied />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Gate permission="dashboard.view"><Dashboard /></Gate>} />
          <Route path="licenses" element={<Gate permission="licenses.view"><Licenses /></Gate>} />
          <Route path="products" element={<Gate permission="products.view"><Products /></Gate>} />
          <Route path="customers" element={<Gate permission="customers.view"><Customers /></Gate>} />
          <Route path="activations" element={<Gate permission="activations.view"><Activations /></Gate>} />
          <Route path="requests" element={<Gate permission="requests.view"><Requests /></Gate>} />
          <Route path="team" element={<Gate permission="users.view"><Team /></Gate>} />
          <Route path="backups" element={<Gate permission="backups.view"><Backups /></Gate>} />
          <Route path="audit" element={<Gate permission="audit.view"><Audit /></Gate>} />
          <Route path="settings" element={<Gate permission="settings.view"><Settings /></Gate>} />
          <Route path="data-tools" element={<Gate permission="settings.manage"><DataTools /></Gate>} />
          <Route path="tutorials" element={<Tutorials />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
