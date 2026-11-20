import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Timer, RefreshCw, KeyRound, Copy, Info } from "lucide-react";
import { SectionCard } from "@/components/common/Badges";
import { Button, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/* =============================================================
   ويدجت حالة الترخيص (نسخة سطح المكتب فقط)
   يقرأ حالة الترخيص من جسر Electron عند توفره،
   وإلا يعرض تلميحًا بأن هذه النسخة تعمل من المتصفح.
   ============================================================= */

type LicenseState = {
  machine: string;
  status: "unknown" | "licensed" | "trial" | "blocked";
  reason: string;
  message: string;
  warning: string;
  trial: { active: boolean; expired: boolean; daysLeft: number; endsAt: string | null } | null;
  license: {
    licenseId: string;
    customer: string;
    type: string;
    plan: "perpetual" | "annual" | "trial" | string;
    mode: "offline" | "online" | "hybrid" | string;
    issuedAt: string | null;
    expiresAt: string | null;
    daysLeft: number | null;
  } | null;
  lease: {
    status: string;
    checkedAt: string | null;
    nextCheckAt: string | null;
    graceUntil: string | null;
  } | null;
  appVersion: string;
};

const PLAN_LABELS: Record<string, string> = {
  perpetual: "ترخيص دائم",
  annual: "اشتراك سنوي",
  trial: "نسخة تجريبية",
};

const MODE_LABELS: Record<string, string> = {
  offline: "أوفلاين — ملف ترخيص موقّع",
  online: "أونلاين — خادم تراخيص",
  hybrid: "هجين — ملف + فحص اختياري",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function LicenseWidget() {
  const [state, setState] = useState<LicenseState | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const desktop = typeof window !== "undefined" && !!(window as any).adalaDesktop;
    setIsDesktop(desktop);
    if (desktop) {
      (window as any).adalaDesktop
        .getLicenseState()
        .then((s: LicenseState) => setState(s))
        .catch(() => setState(null));
    }
  }, []);

  const checkNow = async () => {
    const desktop = (window as any).adalaDesktop;
    if (!desktop) return;
    setChecking(true);
    try {
      const result = await desktop.checkNow();
      if (result?.state) setState(result.state);
    } catch {
      /* ignore */
    } finally {
      setChecking(false);
    }
  };

  const copyMachine = async () => {
    if (!state?.machine) return;
    try {
      await navigator.clipboard.writeText(state.machine);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  if (!isDesktop) {
    return (
      <SectionCard title="الترخيص والتفعيل" subtitle="متاح في نسخة سطح المكتب فقط">
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-muted" />
          <div className="text-[13px] leading-relaxed text-ink-soft">
            أنت تستخدم النسخة المتصفحية من المنصة. حالة الترخيص ورمز الجهاز والتفعيل
            تظهر هنا في <strong>نسخة سطح المكتب</strong> بعد تثبيتها على جهازك.
          </div>
        </div>
      </SectionCard>
    );
  }

  const licensed = state?.status === "licensed";
  const trial = state?.status === "trial";

  return (
    <SectionCard title="الترخيص والتفعيل" subtitle="حالة الترخيص على هذا الجهاز">
      <div className="space-y-4">
        {/* حالة */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            licensed
              ? "border-ok/30 bg-ok/10"
              : trial
                ? "border-warn/30 bg-warn/10"
                : "border-danger/30 bg-danger/10",
          )}
        >
          {licensed ? (
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" />
          ) : (
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" />
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-ink">
                {licensed ? "الترخيص ساري المفعول" : trial ? "نسخة تجريبية" : "النسخة تحتاج تفعيلًا"}
              </span>
              {state?.license && (
                <Badge tone={licensed ? "ok" : trial ? "warn" : "danger"}>
                  {PLAN_LABELS[state.license.plan] ?? state.license.plan}
                </Badge>
              )}
              {state?.license && (
                <Badge tone="muted">{MODE_LABELS[state.license.mode] ?? state.license.mode}</Badge>
              )}
            </div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
              {state?.message || "جارٍ قراءة الحالة…"}
              {state?.warning ? <span className="mt-1 block text-warn">{state.warning}</span> : null}
            </div>
          </div>
        </div>

        {/* رمز الجهاز */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line bg-surface-2 p-4">
          <span className="text-[12px] text-muted">رمز الجهاز (أرسله للمورد للتفعيل):</span>
          <code dir="ltr" className="select-all font-mono text-[15px] font-bold tracking-wider text-accent-2">
            {state?.machine || "…"}
          </code>
          <Button variant="outline" size="sm" icon={copied ? ShieldCheck : Copy} onClick={() => void copyMachine()} className="ms-auto">
            {copied ? "تم النسخ" : "نسخ الرمز"}
          </Button>
        </div>

        {/* التفاصيل */}
        <div className="grid gap-2 text-[12.5px]">
          {state?.license ? (
            <>
              <div className="flex justify-between gap-3 rounded-lg border border-line-soft bg-surface px-3.5 py-2.5">
                <span className="text-muted">العميل</span>
                <span className="font-semibold text-ink">{state.license.customer || "—"}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-lg border border-line-soft bg-surface px-3.5 py-2.5">
                <span className="text-muted">رقم الترخيص</span>
                <span dir="ltr" className="font-mono text-ink">{state.license.licenseId}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-lg border border-line-soft bg-surface px-3.5 py-2.5">
                <span className="text-muted">تاريخ الانتهاء</span>
                <span className="font-semibold text-ink">
                  {state.license.expiresAt
                    ? `${fmtDate(state.license.expiresAt)} (متبقي ${state.license.daysLeft ?? "?"} يوم)`
                    : "ترخيص دائم بلا تاريخ انتهاء"}
                </span>
              </div>
            </>
          ) : trial && state?.trial ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-warn">
              <Timer className="size-4" />
              <span>
                متبقي <strong>{state.trial.daysLeft}</strong> يوم — تنتهي التجربة{" "}
                {fmtDate(state.trial.endsAt)}
              </span>
            </div>
          ) : null}
          {state?.lease && (
            <div className="flex justify-between gap-3 rounded-lg border border-line-soft bg-surface px-3.5 py-2.5">
              <span className="text-muted">آخر فحص أونلاين</span>
              <span className="text-ink">
                {state.lease.status === "active"
                  ? `ناجح ✔ (${fmtDate(state.lease.checkedAt)})`
                  : state.lease.status === "revoked"
                    ? "ملغى عن بُعد ⛔"
                    : "منتهي ⛔"}
              </span>
            </div>
          )}
        </div>

        {/* الإجراءات */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={RefreshCw}
            loading={checking}
            onClick={() => void checkNow()}
          >
            فحص الترخيص الآن
          </Button>
          {(state?.status === "blocked" || trial) && (
            <Button
              variant="outline"
              size="sm"
              icon={KeyRound}
              onClick={() => {
                const desktop = (window as any).adalaDesktop;
                if (desktop?.openActivation) void desktop.openActivation();
              }}
            >
              فتح شاشة التفعيل
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12px] leading-relaxed text-muted">
          للتفعيل أو التجديد، أرسل رمز الجهاز أعلاه إلى المورد ثم استلم ملف الترخيص
          <span dir="ltr" className="font-mono"> (.adlic)</span> أو مفتاح تفعيل أونلاين.
          يمكنك أيضًا فتح شاشة التفعيل من قائمة «مساعدة».
        </div>
      </div>
    </SectionCard>
  );
}
