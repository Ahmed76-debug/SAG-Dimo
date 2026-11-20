import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BadgeCheck, CheckCircle2, Eye, EyeOff, KeyRound, Layers, Loader2,
  LockKeyhole, ShieldCheck, Sparkles, UserRound, Wifi, Zap,
} from 'lucide-react';
import { Brand, BrandMark } from '@/components/Brand';
import { ThemePicker } from '@/components/layout/ThemePicker';
import { Badge, Button, Field, Input, ProductIcon } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', label: 'مدير النظام', color: '#6366f1' },
  { username: 'sara', password: 'Sara@123', label: 'مدير', color: '#ec4899' },
  { username: 'omar', password: 'Omar@123', label: 'دعم فني', color: '#10b981' },
  { username: 'lina', password: 'Lina@123', label: 'مراقب', color: '#f59e0b' },
];

const FEATURES = [
  { icon: Zap, title: 'تفعيل فوري', text: 'أونلاين وأوفلاين مع توقيع رقمي' },
  { icon: ShieldCheck, title: 'تحكم كامل', text: 'صلاحيات، إيقاف، وتجديد لحظي' },
  { icon: Layers, title: 'متعدد المنتجات', text: 'كتالوج مرن لكل تطبيقاتك' },
];

export function Login() {
  const { login } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      success(`أهلاً بك، ${user.name}`, 'تم تسجيل الدخول إلى مفتاح ستوديو');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const fill = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -end-32 -top-32 h-[480px] w-[480px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute -start-24 top-1/3 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[130px]" />
        <div className="absolute bottom-0 start-1/3 h-[360px] w-[360px] rounded-full bg-[var(--danger)]/8 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <Badge tone="success" dot className="hidden sm:inline-flex">الخادم يعمل</Badge>
            <ThemePicker compact />
          </div>
        </header>

        <main className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
          {/* Login form */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="order-1 mx-auto w-full max-w-[420px] lg:mx-0"
          >
            <div className="card relative overflow-hidden p-6 sm:p-7">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-primary/60 to-transparent" />
              <div className="mb-5 flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <LockKeyhole size={19} />
                </span>
                <div>
                  <h1 className="text-[19px] font-bold text-ink">مرحباً بعودتك</h1>
                  <p className="text-[11.5px] text-muted">سجّل الدخول لإدارة تراخيصك وتفعيلاتك</p>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-3.5">
                <Field label="اسم المستخدم أو البريد" required>
                  <div className="relative">
                    <UserRound size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      autoComplete="username"
                      aria-label="اسم المستخدم أو البريد"
                      className="ps-9"
                      dir="ltr"
                      required
                    />
                  </div>
                </Field>

                <Field label="كلمة المرور" required>
                  <div className="relative">
                    <KeyRound size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      aria-label="كلمة المرور"
                      className="ps-9 pe-10"
                      dir="ltr"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted transition hover:bg-surface-3 hover:text-ink"
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger"
                  >
                    {error}
                  </motion.div>
                )}

                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                  {!loading && <ArrowLeft size={16} />}
                  دخول إلى الاستوديو
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10px] text-muted">حسابات تجريبية جاهزة</span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => fill(account)}
                    className={cn(
                      'group flex items-center gap-2 rounded-xl border px-2.5 py-2 text-start transition',
                      username === account.username ? 'border-primary/40 bg-primary-soft' : 'border-line hover:border-line-strong hover:bg-surface-2'
                    )}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: `${account.color}22`, color: account.color }}>
                      {account.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium text-ink" dir="ltr">{account.username}</span>
                      <span className="block text-[9.5px] text-muted">{account.label}</span>
                    </span>
                    <ArrowLeft size={11} className="ms-auto shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[10.5px] text-muted">
                <ShieldCheck size={13} className="shrink-0 text-success" />
                <p>اتصال مشفر · جلسة آمنة لمدة ١٢ ساعة · تسجيل كامل للنشاط</p>
              </div>
            </div>

            <p className="mt-4 text-center text-[10.5px] text-muted">
              مفتاح ستوديو v2.0 · Node.js + SQLite + Ed25519
            </p>
          </motion.div>

          {/* Showcase */}
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="order-2 hidden lg:block"
          >
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1 text-[10.5px] text-soft backdrop-blur">
                <Sparkles size={12} className="text-primary" />
                منصة تراخيص مصممة للمطورين العرب
              </div>
              <h2 className="max-w-lg text-[34px] font-black leading-[1.25] tracking-tight text-ink">
                أدر تراخيص برامجك <span className="text-gradient">بكل احترافية</span>
              </h2>
              <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted">
                من توليد المفتاح إلى التفعيل على جهاز العميل — لوحة واحدة تجمع المنتجات،
                الاشتراكات، الأجهزة، والفريق مع حماية تشفير من الطراز الأول.
              </p>

              <div className="relative mt-8">
                <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-primary/10 blur-2xl" />
                <div className="glass animate-floaty relative overflow-hidden rounded-3xl p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ProductIcon icon="coffee" color="#f59e0b" />
                      <div>
                        <p className="text-[12.5px] font-semibold text-ink">Cafe Manager Pro</p>
                        <p className="numeric text-[10px] text-muted">MFT-CAFE-2F91-88C4-B730</p>
                      </div>
                    </div>
                    <Badge tone="success" dot>نشط</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'الخطة', value: 'اشتراك سنوي' },
                      { label: 'المقاعد', value: '2 / 3' },
                      { label: 'الانتهاء', value: '12 نوفمبر 2027' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-line bg-surface/60 px-2.5 py-2">
                        <p className="text-[9px] text-muted">{item.label}</p>
                        <p className="mt-0.5 text-[10.5px] font-medium text-soft">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-3 py-2">
                    <Wifi size={13} className="text-success" />
                    <p className="text-[10.5px] text-soft">آخر نبضة من <span className="font-mono text-[10px]" dir="ltr">CAFE-PC-01</span></p>
                    <span className="ms-auto text-[9.5px] text-muted">قبل دقيقتين</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary-soft px-3 py-2">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={14} className="text-primary" />
                      <p className="text-[10.5px] font-medium text-primary">ملف ترخيص موقّع رقمياً</p>
                    </div>
                    <span className="rounded-md border border-primary/25 px-1.5 py-0.5 font-mono text-[9px] text-primary">Ed25519</span>
                  </div>
                </div>

                <div className="absolute -end-5 -top-6 hidden animate-floaty rounded-2xl border border-line bg-surface/90 p-2.5 shadow-pop backdrop-blur xl:block" style={{ animationDelay: '1.2s' }}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-success/10 text-success"><CheckCircle2 size={16} /></span>
                    <div>
                      <p className="text-[10.5px] font-semibold text-ink">تم تفعيل جهاز</p>
                      <p className="text-[9px] text-muted">POS-TERM-3 · الآن</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {FEATURES.map((feature) => (
                  <div key={feature.title} className="rounded-2xl border border-line bg-surface/40 p-3 backdrop-blur">
                    <feature.icon size={16} className="text-primary" />
                    <p className="mt-2 text-[11.5px] font-semibold text-ink">{feature.title}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{feature.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-4 text-[10px] text-muted">
                <span className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-success" /> +٤٨ ترخيص مُدار</span>
                <span className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-success" /> ٦ منتجات</span>
                <span className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-success" /> ١٤ عميل</span>
              </div>
            </div>
          </motion.div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-4 text-[10px] text-muted">
          <span className="flex items-center gap-1.5"><BrandMark size={16} /> مفتاح ستوديو — استوديو التراخيص الاحترافي</span>
          <span className="flex items-center gap-2">
            {loading && <Loader2 size={11} className="animate-spin" />}
            <span>© {new Date().getFullYear()} Miftah Labs</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
