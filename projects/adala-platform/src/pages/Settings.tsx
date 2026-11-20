import { useEffect, useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  Palette,
  BellRing,
  Archive,
  Printer,
  Database,
  Save,
  Download,
  Upload,
  Trash2,
  FolderDown,
  FolderOpen,
  FileJson,
  ShieldCheck,
  RotateCcw,
  Info,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { PageHeader, PageBody } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/common/Badges";
import LicenseWidget from "@/components/settings/LicenseWidget";
import {
  Button,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
  Tabs,
  Badge,
  Segmented,
} from "@/components/ui/primitives";
import { useToast, ConfirmDialog } from "@/components/ui/overlays";
import { db, exportBackup, importBackup, resetDemoData, logActivity } from "@/lib/db";
import { backupToSql } from "@/lib/sql";
import { FEE_TYPES } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { FeeType, Settings as SettingsModel, ThemeMode } from "@/lib/types";

type TabKey = "firm" | "appearance" | "reminders" | "archive" | "printing" | "license" | "data";

const CURRENCIES = [
  { code: "SAR", label: "ريال سعودي" },
  { code: "AED", label: "درهم إماراتي" },
  { code: "KWD", label: "دينار كويتي" },
  { code: "BHD", label: "دينار بحريني" },
  { code: "QAR", label: "ريال قطري" },
  { code: "OMR", label: "ريال عماني" },
  { code: "JOD", label: "دينار أردني" },
  { code: "EGP", label: "جنيه مصري" },
  { code: "USD", label: "دولار أمريكي" },
  { code: "EUR", label: "يورو" },
];

const FEE_TYPE_KEYS = Object.keys(FEE_TYPES) as FeeType[];

export default function Settings() {
  const { settings, updateSettings, theme, setTheme, notifyPermission, requestNotifyPermission, user } =
    useApp();
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>("firm");
  const [form, setForm] = useState<SettingsModel>(settings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [backupBusy, setBackupBusy] = useState<null | "export" | "folder" | "sql" | "restore" | "reset">(null);
  const [restoreCandidate, setRestoreCandidate] = useState<{ file: File; label: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const canPickFolder =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "showDirectoryPicker" in window;

  useEffect(() => {
    setForm(settings);
    setDirty(false);
  }, [settings]);

  const set = <K extends keyof SettingsModel>(key: K, value: SettingsModel[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const setProfile = (key: keyof SettingsModel["profile"], value: string) => {
    setForm((f) => ({ ...f, profile: { ...f.profile, [key]: value } }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({
        ...form,
        profile: { ...form.profile },
      });
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "—",
        action: "تعديل",
        entity: "إعدادات",
        meta: "تحديث إعدادات النظام",
      });
      setDirty(false);
      toast.success("تم حفظ الإعدادات", "طُبِّقت التغييرات على النظام فورًا.");
    } catch {
      toast.error("تعذّر حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm(settings);
    setDirty(false);
    toast.info("تم التراجع عن التغييرات غير المحفوظة");
  };

  /* ------------------------------ النسخ الاحتياطي ------------------------------ */

  const stamp = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  };

  const downloadText = (text: string, name: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const downloadJson = (payload: unknown, name: string) =>
    downloadText(JSON.stringify(payload, null, 2), name, "application/json;charset=utf-8");

  const doExport = async () => {
    if (backupBusy) return;
    setBackupBusy("export");
    try {
      const payload = await exportBackup(includeFiles);
      downloadJson(payload, `نسخة-احتياطية-عدالة-${stamp()}.json`);
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "—",
        action: "تصدير",
        entity: "نسخة احتياطية",
        meta: includeFiles ? "مع الملفات المرفقة" : "بدون الملفات",
      });
      toast.success("تم إنشاء النسخة الاحتياطية", "حُفظ الملف على جهازك.");
    } catch (e: any) {
      toast.error("تعذّر إنشاء النسخة الاحتياطية", e?.message || "تحقق من اتصال الخادم.");
    } finally {
      setBackupBusy(null);
    }
  };

  const doExportToFolder = async () => {
    if (backupBusy) return;
    setBackupBusy("folder");
    try {
      const payload = await exportBackup(includeFiles);
      const name = `نسخة-احتياطية-عدالة-${stamp()}.json`;
      const picker = (window as any).showDirectoryPicker;
      if (!canPickFolder || typeof picker !== "function") {
        downloadJson(payload, name);
        toast.info("المتصفح لا يدعم اختيار المجلد", "تم تنزيل النسخة الاحتياطية بدلًا من حفظها في مجلد.");
        return;
      }
      const dir = await picker.call(window, { mode: "readwrite", id: "adala-backup" });
      const handle = await dir.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "—",
        action: "تصدير",
        entity: "نسخة احتياطية",
        meta: `المجلد: ${dir.name} — ${name}`,
      });
      toast.success("تم حفظ النسخة الاحتياطية", `المجلد: ${dir.name} — الملف: ${name}`);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      toast.error("تعذّر حفظ النسخة الاحتياطية", e?.message || "تأكد من صلاحية المجلد.");
    } finally {
      setBackupBusy(null);
    }
  };

  const doExportSql = async () => {
    if (backupBusy) return;
    setBackupBusy("sql");
    try {
      const payload = await exportBackup(includeFiles);
      const sql = backupToSql(payload);
      downloadText(sql, `adala-${stamp()}.sql`, "application/sql;charset=utf-8");
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "—",
        action: "تصدير SQL",
        entity: "قاعدة البيانات",
        meta: "جداول SQL جاهزة للاستيراد",
      });
      toast.success("تم تصدير قاعدة البيانات بصيغة SQL", "الملف متوافق مع SQLite وPostgreSQL.");
    } catch (e: any) {
      toast.error("تعذّر تصدير SQL", e?.message || "");
    } finally {
      setBackupBusy(null);
    }
  };

  const doImport = async (file: File) => {
    if (backupBusy) return;
    setBackupBusy("restore");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload?.tables) throw new Error("الملف لا يحتوي على جداول نسخة احتياطية.");
      await importBackup(payload, "replace");
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "—",
        action: "استيراد",
        entity: "نسخة احتياطية",
        meta: file.name,
      });
      toast.success("تم استرجاع البيانات", "أُعيدت قاعدة البيانات من النسخة الاحتياطية.");
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      toast.error("تعذّر استعادة النسخة", e?.message || "تأكد من اختيار ملف نسخة احتياطية صالح.");
    } finally {
      setBackupBusy(null);
    }
  };

  const doImportFromFolder = async () => {
    if (backupBusy) return;
    const picker = (window as any).showDirectoryPicker;
    if (!canPickFolder || typeof picker !== "function") {
      folderInputRef.current?.click();
      return;
    }
    setBackupBusy("restore");
    try {
      const dir = await picker.call(window, { mode: "read", id: "adala-backup" });
      const files: File[] = [];
      for await (const handle of (dir as any).values()) {
        if (handle.kind === "file" && /\.json$/i.test(handle.name)) {
          files.push(await handle.getFile());
        }
      }
      if (!files.length) {
        toast.error("لا توجد نسخة احتياطية", "لم يُعثر على ملف JSON داخل المجلد المحدد.");
        return;
      }
      files.sort((a, b) => b.lastModified - a.lastModified);
      setRestoreCandidate({ file: files[0], label: files[0].name });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      toast.error("تعذّر قراءة المجلد", e?.message || "");
    } finally {
      setBackupBusy(null);
    }
  };

  const pickLatestBackupFromFiles = (list: FileList | null) => {
    const files = Array.from(list || []).filter((f) => /\.json$/i.test(f.name));
    if (!files.length) {
      toast.error("لا توجد نسخة احتياطية", "اختر مجلدًا يحتوي على ملف JSON.");
      return;
    }
    files.sort((a, b) => b.lastModified - a.lastModified);
    setRestoreCandidate({ file: files[0], label: files[0].name });
  };

  const doResetDemo = async () => {
    if (backupBusy) return;
    setBackupBusy("reset");
    try {
      await resetDemoData();
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "—",
        action: "إعادة تعيين",
        entity: "قاعدة البيانات",
        meta: "استعادة البيانات التجريبية",
      });
      toast.success("تمت إعادة تعيين البيانات", "أُعيدت البيانات التجريبية وسيُعاد تحميل النظام.");
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      toast.error("تعذّرت إعادة التعيين", e?.message || "");
    } finally {
      setBackupBusy(null);
    }
  };

  const counts = useLiveCounts();

  return (
    <>
      <PageHeader
        title="إعدادات النظام"
        subtitle="هوية المكتب · المظهر · التذكيرات · الأرشفة · الطباعة · الترخيص · النسخ الاحتياطي"
        icon={
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-2 to-accent text-accent-ink">
            <SettingsIcon className="size-6" />
          </span>
        }
        actions={
          <>
            {dirty && (
              <Button variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>
                تراجع
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={Save}
              loading={saving}
              disabled={!dirty}
              onClick={() => void save()}
            >
              حفظ التغييرات
            </Button>
          </>
        }
      />

      <PageBody>
        <div className="mb-4 overflow-x-auto">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "firm", label: "هوية المكتب", icon: Building2 },
              { value: "appearance", label: "المظهر", icon: Palette },
              { value: "reminders", label: "التذكيرات", icon: BellRing },
              { value: "archive", label: "الأرشفة", icon: Archive },
              { value: "printing", label: "الطباعة", icon: Printer },
              { value: "license", label: "الترخيص", icon: ShieldCheck },
              { value: "data", label: "البيانات", icon: Database },
            ]}
          />
        </div>

        {/* ------------------------------ هوية المكتب ------------------------------ */}
        {tab === "firm" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="بيانات المكتب" subtitle="تظهر في الترويسة والتذييل وتقارير المكتب">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم المكتب" required className="sm:col-span-2">
                  <Input
                    value={form.profile.firmName}
                    onChange={(e) => setProfile("firmName", e.target.value)}
                    placeholder="مثال: مكتب المنصور للمحاماة"
                  />
                </Field>
                <Field label="الشعار النصي" className="sm:col-span-2">
                  <Input
                    value={form.profile.tagline}
                    onChange={(e) => setProfile("tagline", e.target.value)}
                    placeholder="وصف مختصر يظهر تحت اسم المكتب"
                  />
                </Field>
                <Field label="اسم المحامي المسؤول">
                  <Input
                    value={form.profile.lawyerName}
                    onChange={(e) => setProfile("lawyerName", e.target.value)}
                    placeholder="المحامي خالد بن سعد المنصور"
                  />
                </Field>
                <Field label="رقم الترخيص">
                  <Input
                    value={form.profile.licenseNumber}
                    onChange={(e) => setProfile("licenseNumber", e.target.value)}
                    placeholder="ترخيص رقم ..."
                  />
                </Field>
                <Field label="البريد الإلكتروني">
                  <Input
                    type="email"
                    value={form.profile.email}
                    onChange={(e) => setProfile("email", e.target.value)}
                    placeholder="info@example.sa"
                    dir="ltr"
                  />
                </Field>
                <Field label="الهاتف">
                  <Input
                    value={form.profile.phone}
                    onChange={(e) => setProfile("phone", e.target.value)}
                    placeholder="+966 11 000 0000"
                    dir="ltr"
                  />
                </Field>
                <Field label="الموقع الإلكتروني">
                  <Input
                    value={form.profile.website}
                    onChange={(e) => setProfile("website", e.target.value)}
                    placeholder="example.sa"
                    dir="ltr"
                  />
                </Field>
                <Field label="العنوان" className="sm:col-span-2">
                  <Textarea
                    rows={3}
                    value={form.profile.address}
                    onChange={(e) => setProfile("address", e.target.value)}
                    placeholder="المدينة، الحي، المبنى، الدور"
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="العملة وأتعاب المكتب" subtitle="تُستخدم كقيم افتراضية في القضايا الجديدة">
              <div className="grid gap-4">
                <Field label="العملة الافتراضية" hint="تُطبَّق على القضايا والمدفوعات الجديدة">
                  <Select
                    value={form.currency}
                    onChange={(e) => set("currency", e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="نوع الأتعاب الافتراضي">
                  <Select
                    value={form.defaultFeeType}
                    onChange={(e) => set("defaultFeeType", e.target.value as FeeType)}
                  >
                    {FEE_TYPE_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {FEE_TYPES[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <ShieldCheck className="size-4 text-accent" />
                    مزامنة مع نظام القواعد
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                    يحتفظ النظام نسخة محلية من كل البيانات في متصفحك. عند التحويل لاحقًا إلى خادم أو
                    تطبيق سطح مكتب، تُنقل هذه الإعدادات نفسها دون تغيير في طريقة العمل.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ المظهر ------------------------------ */}
        {tab === "appearance" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="سمة الألوان" subtitle="اختر الثيم من معرض البطاقات — يُطبَّق فورًا على جميع الشاشات">
              <div className="space-y-4">
                {(() => {
                  const THEMES: { id: ThemeMode; name: string; mode: "light" | "dark" | "system"; colors: { bg: string; surface: string; brand: string; accent: string } }[] = [
                    { id: "light",          name: "فاتح (افتراضي)", mode: "light",  colors: { bg: "#f4f7fb", surface: "#ffffff", brand: "#1f4b99", accent: "#b8872f" } },
                    { id: "light-sand",     name: "فاتح رملي",      mode: "light",  colors: { bg: "#f6f1e8", surface: "#fffaf2", brand: "#8a5a12", accent: "#2d6a4f" } },
                    { id: "light-mist",     name: "فاتح ضبابي",     mode: "light",  colors: { bg: "#eef4f8", surface: "#ffffff", brand: "#155e75", accent: "#475569" } },
                    { id: "dark",           name: "داكن (افتراضي)", mode: "dark",   colors: { bg: "#0b1220", surface: "#121a2b", brand: "#8ab4f8", accent: "#d5ae63" } },
                    { id: "dark-midnight",  name: "داكن ليلي",      mode: "dark",   colors: { bg: "#060816", surface: "#0f1428", brand: "#7c83ff", accent: "#d946ef" } },
                    { id: "dark-emerald",   name: "داكن زمردي",     mode: "dark",   colors: { bg: "#071311", surface: "#102220", brand: "#34d399", accent: "#14b8a6" } },
                    { id: "system",         name: "حسب النظام",     mode: "system", colors: { bg: "#e5e7eb", surface: "#ffffff", brand: "#64748b", accent: "#94a3b8" } },
                  ];
                  const card = (t: typeof THEMES[number]) => {
                    const active = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void setTheme(t.id)}
                        title={t.name}
                        className={cn(
                          "relative text-start border-2 rounded-2xl p-2.5 bg-surface transition-all duration-150 w-full",
                          active ? "border-accent shadow-[0_0_0_3px_rgba(184,135,47,0.18),0_10px_24px_rgba(0,0,0,0.12)]" : "border-line hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg",
                        )}
                      >
                        <span className="grid grid-cols-[22px_1fr] h-[72px] rounded-[11px] overflow-hidden border border-line/60 relative" style={{ background: t.colors.bg } as any}>
                          <span className="relative" style={{ background: t.colors.brand } as any}><span className="absolute top-[10px] left-[5px] right-[5px] h-[6px] rounded bg-white/60" /></span>
                          <span className="p-[8px_7px] flex flex-col gap-[5px]">
                            <span className="h-[10px] rounded-[5px] border border-line/50" style={{ background: t.colors.surface } as any} />
                            <span className="h-[6px] w-[70%] rounded border border-line/40" style={{ background: t.colors.surface } as any} />
                            <span className="h-[6px] w-[45%] rounded border border-line/40" style={{ background: t.colors.surface } as any} />
                            <span className="flex gap-1 mt-auto"><i className="w-[14px] h-[14px] rounded block" style={{ background: t.colors.brand } as any} /><i className="w-[14px] h-[14px] rounded block" style={{ background: t.colors.accent } as any} /><i className="w-[14px] h-[14px] rounded block border border-line/40" style={{ background: t.colors.surface } as any} /></span>
                          </span>
                          <span className={cn("absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-accent text-accent-ink grid place-items-center text-[12px] font-bold transition-all", active ? "opacity-100 scale-100" : "opacity-0 scale-[0.6]")}>✓</span>
                        </span>
                        <span className="flex items-center gap-1.5 mt-2 font-extrabold text-[13px] text-ink">{t.name}<span className={cn("text-[10px] px-[7px] py-[1.5px] rounded-full font-extrabold", active ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted")}>{t.mode === "dark" ? "داكن" : t.mode === "light" ? "فاتح" : "تلقائي"}</span></span>
                      </button>
                    );
                  };
                  const lights = THEMES.filter(t => t.mode === "light");
                  const darks = THEMES.filter(t => t.mode === "dark");
                  const sys = THEMES.filter(t => t.mode === "system");
                  return (
                    <div className="grid gap-5">
                      <section><div className="flex items-center gap-2 mb-3"><span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-200 to-white border border-line" /><h4 className="m-0 text-[15px] font-extrabold text-ink">الثيمات الفاتحة</h4><span className="text-[11.5px] text-muted font-bold">{lights.length}</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{lights.map(card)}</div></section>
                      <section><div className="flex items-center gap-2 mb-3"><span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-slate-600 to-slate-950 border border-line" /><h4 className="m-0 text-[15px] font-extrabold text-ink">الثيمات الداكنة</h4><span className="text-[11.5px] text-muted font-bold">{darks.length}</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{darks.map(card)}</div></section>
                      <section><div className="flex items-center gap-2 mb-3"><span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-slate-300 to-white border border-line" /><h4 className="m-0 text-[15px] font-extrabold text-ink">تلقائي</h4><span className="text-[11.5px] text-muted font-bold">{sys.length}</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{sys.map(card)}</div></section>
                      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-3.5"><div><div className="text-[13px] font-semibold text-ink">الوضع الحالي</div><div className="text-[12px] text-muted">{theme === "system" ? "يتبع تفضيل نظام التشغيل" : theme.startsWith("dark") ? "وضع داكن" : "وضع فاتح"}</div></div><Badge tone="accent">{theme}</Badge></div>
                    </div>
                  );
                })()}
              </div>
            </SectionCard>

            <SectionCard title="كثافة العرض" subtitle="تباعد الصفوف والبطاقات">
              <div className="space-y-4">
                <Field label="كثافة الجداول">
                  <Segmented
                    value={form.density}
                    onChange={(v) => set("density", v)}
                    options={[
                      { value: "comfortable", label: "مريحة" },
                      { value: "compact", label: "مضغوطة" },
                    ]}
                  />
                </Field>
                <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <Info className="size-4 text-info" />
                    معاينة
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border border-line bg-surface",
                          form.density === "compact" ? "h-6" : "h-8",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ التذكيرات ------------------------------ */}
        {tab === "reminders" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="جدولة التذكيرات" subtitle="متى يتم تنبيهك قبل المواعيد والمهام">
              <div className="space-y-4">
                <Field
                  label="مدة التذكير المسبق (بالأيام)"
                  hint="عدد الأيام التي يسبق بها النظام تذكير الجلسات والمواعيد النظامية"
                >
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={form.reminderLeadDays}
                    onChange={(e) => set("reminderLeadDays", Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
                <Switch
                  checked={form.dailyDigest}
                  onChange={(v) => set("dailyDigest", v)}
                  label="ملخص يومي"
                  description="رسالة واحدة صباحًا تجمع مواعيد اليوم والمهام المستحقة"
                />
                <Switch
                  checked={form.soundEnabled}
                  onChange={(v) => set("soundEnabled", v)}
                  label="تنبيه صوتي"
                  description="تشغيل نغمة قصيرة عند ورود إشعار جديد"
                />
              </div>
            </SectionCard>

            <SectionCard title="إشعارات النظام" subtitle="صلاحية إشعارات المتصفح">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-3.5">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">حالة الإذن</div>
                    <div className="text-[12px] text-muted">
                      {notifyPermission === "granted"
                        ? "مسموح — تصلك إشعارات الجلسات"
                        : notifyPermission === "denied"
                          ? "مرفوض — فعّل الإذن من إعدادات المتصفح"
                          : "لم يُطلب بعد"}
                    </div>
                  </div>
                  <Badge
                    tone={
                      notifyPermission === "granted" ? "ok" : notifyPermission === "denied" ? "danger" : "muted"
                    }
                  >
                    {notifyPermission === "granted"
                      ? "مسموح"
                      : notifyPermission === "denied"
                        ? "مرفوض"
                        : "غير محدد"}
                  </Badge>
                </div>
                {notifyPermission !== "granted" && (
                  <Button
                    variant="outline"
                    icon={BellRing}
                    onClick={() => void requestNotifyPermission()}
                    disabled={notifyPermission === "denied"}
                  >
                    طلب إذن الإشعارات
                  </Button>
                )}
                <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12px] leading-relaxed text-muted">
                  يعمل مجدول التذكيرات داخل التطبيق كل ستين ثانية، ويعمل حتى مع إغلاق النافذة عند
                  تحويل النظام لاحقًا إلى تطبيق سطح مكتب أو هاتف.
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ الأرشفة ------------------------------ */}
        {tab === "archive" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="سياسة الاحتفاظ" subtitle="متى تُنقل القضايا المغلقة إلى الأرشيف">
              <div className="space-y-4">
                <Field label="مدة الاحتفاظ (بالأشهر)" hint="بعد هذه المدة تصبح القضايا المغلقة مؤرشفة تلقائيًا">
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={form.archiveAfterMonths}
                    onChange={(e) =>
                      set("archiveAfterMonths", Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </Field>
                <Switch
                  checked={form.autoArchiveClosed}
                  onChange={(v) => set("autoArchiveClosed", v)}
                  label="أرشفة تلقائية للقضايا المغلقة"
                  description="عند إتمام الإغلاق تُنقل القضية إلى الأرشيف مباشرة"
                />
              </div>
            </SectionCard>

            <SectionCard title="حالة الأرشيف" subtitle="ملخص حجم السجلات المؤرشفة">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {counts.map((c) => (
                  <div key={c.label} className="rounded-xl border border-line bg-surface-2 p-3">
                    <div className="text-[11.5px] text-muted">{c.label}</div>
                    <div className="num mt-1 text-[19px] font-bold text-ink">{c.value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                السجلات المؤرشفة تبقى قابلة للبحث والاسترجاع، ولا تُحذف نهائيًا إلا بإذن صريح من
                صفحة الأرشيف.
              </p>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ الطباعة ------------------------------ */}
        {tab === "printing" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="ترويسة وتذييل المستندات" subtitle="تُطبع في أعلى وأسفل كل صفحة">
              <div className="space-y-4">
                <Field label="نص الترويسة">
                  <Input
                    value={form.printHeader}
                    onChange={(e) => set("printHeader", e.target.value)}
                    placeholder="اسم المكتب"
                  />
                </Field>
                <Field label="نص التذييل">
                  <Input
                    value={form.printFooter}
                    onChange={(e) => set("printFooter", e.target.value)}
                    placeholder="جميع الحقوق محفوظة"
                  />
                </Field>
                <Field label="إشعار السرية" hint="يظهر أعلى المستندات السرية">
                  <Input
                    value={form.confidentialityNotice}
                    onChange={(e) => set("confidentialityNotice", e.target.value)}
                    placeholder="سري ومحدود التداول"
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="نماذج الطباعة" subtitle="استخدم مركز الطباعة لتوليد المستندات الجاهزة">
              <div className="space-y-3">
                {[
                  { title: "كشف حساب", desc: "بيان مستحقات ومدفوعات لكل قضية" },
                  { title: "توكيل خاص", desc: "نموذج توكيل معتمد للتوقيع" },
                  { title: "مذكرة قانونية", desc: "مذكرة داخلية أو مذكرة للخصم" },
                  { title: "تقرير مالي", desc: "ملخص الإيرادات والتكاليف" },
                ].map((t) => (
                  <div
                    key={t.title}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-ink">{t.title}</div>
                      <div className="truncate text-[11.5px] text-muted">{t.desc}</div>
                    </div>
                    <Badge tone="muted">مركز الطباعة</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ الترخيص ------------------------------ */}
        {tab === "license" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <LicenseWidget />
            <SectionCard title="أنماط الترخيص المتاحة" subtitle="حسب ما يشتريه العميل من المورد">
              <div className="space-y-3">
                {[
                  { icon: "🔒", title: "أوفلاين", desc: "ملف ترخيص موقّع مربوط بجهازك — يعمل بلا إنترنت نهائيًا." },
                  { icon: "🌐", title: "أونلاين", desc: "تفعيل من السيرفر + فحص دوري + إلغاء عن بُعد فوري." },
                  { icon: "⚖️", title: "هجين (الموصى به)", desc: "ملف موقّع مربوط بالجهاز يعمل أوفلاين + فحص أونلاين اختياري للإلغاء والتجديد." },
                  { icon: "👑", title: "دائم لكل جهاز", desc: "دفعة واحدة بلا تاريخ انتهاء — مرتبط ببصمة الجهاز." },
                  { icon: "📅", title: "اشتراك سنوي", desc: "365 يومًا مع تجديد سنوي وربط ببصمة الجهاز." },
                  { icon: "⏳", title: "نسخة تجريبية", desc: "15 يومًا كاملة من أول تشغيل ثم يلزم ترخيص." },
                ].map((m) => (
                  <div key={m.title} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
                    <span className="text-lg leading-none">{m.icon}</span>
                    <div>
                      <div className="text-[13px] font-bold text-ink">{m.title}</div>
                      <div className="text-[12px] leading-relaxed text-muted">{m.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ------------------------------ البيانات ------------------------------ */}
        {tab === "data" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="النسخ الاحتياطي والاستعادة" subtitle="احفظ نسخة كاملة على جهازك أو في مجلد تختاره، واستعدها عند الحاجة">
              <div className="space-y-4">
                <Switch
                  checked={includeFiles}
                  onChange={setIncludeFiles}
                  label="تضمين الملفات المرفقة"
                  description="يشمل الوثائق والملفات المخزّنة داخل النظام (قد يزيد حجم النسخة)"
                />

                <div className="rounded-xl border border-accent/25 bg-accent/5 p-3.5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <FolderDown className="size-4 text-accent" />
                    حفظ مباشر في مجلد
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                    اختر مجلدًا على جهازك (مثل OneDrive أو USB) لحفظ النسخة داخله مباشرة.
                  </p>
                  <Button
                    variant="primary"
                    icon={FolderDown}
                    className="mt-3"
                    disabled={!!backupBusy}
                    onClick={() => void doExportToFolder()}
                  >
                    {backupBusy === "folder" ? "جارٍ الحفظ..." : "حفظ في مجلد..."}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    icon={Download}
                    disabled={!!backupBusy}
                    onClick={() => void doExport()}
                  >
                    {backupBusy === "export" ? "جارٍ التنزيل..." : "تنزيل نسخة"}
                  </Button>
                  <Button
                    variant="outline"
                    icon={FolderOpen}
                    disabled={!!backupBusy}
                    onClick={() => void doImportFromFolder()}
                  >
                    {backupBusy === "restore" ? "جارٍ الفحص..." : "استعادة من مجلد..."}
                  </Button>
                  <Button
                    variant="outline"
                    icon={Upload}
                    disabled={!!backupBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    استعادة من ملف
                  </Button>
                  <Button
                    variant="ghost"
                    icon={Database}
                    disabled={!!backupBusy}
                    onClick={() => void doExportSql()}
                  >
                    {backupBusy === "sql" ? "جارٍ التصدير..." : "تصدير SQL"}
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void doImport(f);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  {...({ webkitdirectory: "true", directory: "true" } as any)}
                  onChange={(e) => {
                    pickLatestBackupFromFiles(e.target.files);
                    e.target.value = "";
                  }}
                />

                <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12px] leading-relaxed text-muted">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
                    <FileJson className="size-4 text-accent" />
                    نسخة كاملة وآمنة
                  </div>
                  تشمل النسخة الجديدة كل الجداول والحسابات والملفات المرفقة. عند الاستعادة يستبدل
                  النظام المحتوى الحالي بالكامل، لذا يُنصح بحفظ نسخة قبل الاستعادة.
                  {!canPickFolder && (
                    <span className="mt-1 block text-danger">
                      متصفحك لا يدعم اختيار المجلد مباشرة. استخدم «تنزيل نسخة» و«استعادة من ملف»،
                      أو افتح النظام في Chrome/Edge.
                    </span>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="قاعدة البيانات المُدارة" subtitle="بياناتك محفوظة في SQLite على الخادم المحلي">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  {counts.map((c) => (
                    <div key={c.label} className="rounded-xl border border-line bg-surface-2 p-3">
                      <div className="text-[11px] text-muted">{c.label}</div>
                      <div className="num mt-1 text-lg font-bold text-ink">{c.value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12px] leading-relaxed text-muted">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    <Database className="size-4 text-accent" />
                    ملف البيانات: <code className="text-[11px]">data/adala.db</code>
                  </div>
                  <p className="mt-1">
                    يُدار التخزين على الخادم، وليس داخل مساحة المتصفح. استخدم النسخ الاحتياطي
                    لنقل البيانات بين الأجهزة.
                  </p>
                </div>

                <div className="rounded-xl border border-danger/25 bg-danger-soft/50 p-3.5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-danger">
                    <Trash2 className="size-4" />
                    إعادة تعيين البيانات
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">
                    تحذف هذه الخطوة البيانات الحالية وتستعيد البيانات التجريبية الافتراضية.
                    لا يمكن التراجع، لذا احفظ نسخة أولًا.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    className="mt-3"
                    disabled={!!backupBusy}
                    onClick={() => setWipeOpen(true)}
                  >
                    {backupBusy === "reset" ? "جارٍ إعادة التعيين..." : "إعادة تعيين البيانات"}
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </PageBody>

      <ConfirmDialog
        open={!!restoreCandidate}
        onClose={() => setRestoreCandidate(null)}
        onConfirm={() => {
          const f = restoreCandidate?.file;
          setRestoreCandidate(null);
          if (f) void doImport(f);
        }}
        title="استعادة نسخة احتياطية"
        message={`سيتم استبدال كل البيانات الحالية بالنسخة: ${restoreCandidate?.label ?? ""}. هل تريد المتابعة؟`}
        confirmLabel="نعم، استعد النسخة"
        cancelLabel="إلغاء"
      />

      <ConfirmDialog
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        onConfirm={() => {
          setWipeOpen(false);
          void doResetDemo();
        }}
        title="إعادة تعيين البيانات"
        message="سيتم حذف البيانات الحالية واستعادة البيانات التجريبية الافتراضية. لا يمكن التراجع عن هذه الخطوة. هل أنت متأكد؟"
        confirmLabel="نعم، أعد التعيين"
        cancelLabel="إلغاء"
      />

    </>
  );
}

/* ------------------------------ عدّاد السجلات ------------------------------ */

function useLiveCounts() {
  const [counts, setCounts] = useState<{ label: string; value: number }[]>([]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const [matters, clients, docs, tasks] = await Promise.all([
        db.matters.toArray(),
        db.clients.toArray(),
        db.documents.toArray(),
        db.tasks.toArray(),
      ]);
      if (!alive) return;
      setCounts([
        { label: "قضايا مؤرشفة", value: matters.filter((m) => m.archived).length },
        { label: "موكلون مؤرشفون", value: clients.filter((c) => c.archived).length },
        { label: "وثائق مؤرشفة", value: docs.filter((d) => d.archived).length },
        { label: "مهام مؤرشفة", value: tasks.filter((t) => t.archived).length },
        { label: "إجمالي القضايا", value: matters.length },
        { label: "إجمالي الموكلين", value: clients.length },
      ]);
    };
    void run();
    const timer = window.setInterval(run, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return counts;
}
