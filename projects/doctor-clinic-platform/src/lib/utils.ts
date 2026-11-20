/* ==========================================================================
   Helpers
   ========================================================================== */

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function shiftDate(iso: string, days: number) {
  return addDays(iso, days);
}

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = fromISO(iso);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateShort(iso?: string): string {
  if (!iso) return "—";
  const d = fromISO(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function fmtDateNumeric(iso?: string): string {
  return fmtDateShort(iso);
}

export function dayName(iso: string): string {
  return AR_DAYS[fromISO(iso).getDay()];
}

export function dayNameShort(iso: string): string {
  return dayName(iso).replace("ال", "").slice(0, 4);
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function relDay(iso: string): string {
  const t = todayISO();
  if (iso === t) return "اليوم";
  if (iso === addDays(t, 1)) return "غدًا";
  if (iso === addDays(t, -1)) return "أمس";
  const diff = Math.round((fromISO(iso).getTime() - fromISO(t).getTime()) / 86400000);
  if (diff > 1 && diff < 7) return `بعد ${diff} أيام`;
  if (diff < -1 && diff > -7) return `منذ ${Math.abs(diff)} أيام`;
  return fmtDate(iso);
}

export function ageFrom(birthDate?: string): number | null {
  if (!birthDate) return null;
  const b = fromISO(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

export function to12h(time: string): string {
  const [hRaw, m] = time.split(":");
  let h = Number(hRaw);
  const suffix = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

export function fmtMoney(n: number, currency = "ج.م"): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;
}

export function fmtNum(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("ar-EG");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(145deg,#12a79a,#0a5f5a)",
  "linear-gradient(145deg,#5b8def,#3457b2)",
  "linear-gradient(145deg,#e0975a,#b46a25)",
  "linear-gradient(145deg,#9b7bf0,#6244c9)",
  "linear-gradient(145deg,#e26d8a,#b23d5c)",
  "linear-gradient(145deg,#4fb477,#2c7d4d)",
  "linear-gradient(145deg,#3fb0c9,#1d7288)",
  "linear-gradient(145deg,#c9a227,#8f6f12)",
];

export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export function genCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export function genNumber(prefix: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${stamp}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

export function sum<T>(arr: T[], fn: (t: T) => number): number {
  return arr.reduce((a, b) => a + (fn(b) || 0), 0);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function invoiceTotals(items: { qty: number; price: number }[], discount = 0, taxRate = 0) {
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = (afterDiscount * taxRate) / 100;
  const total = afterDiscount + tax;
  return { subtotal, afterDiscount, tax, total };
}

/* ---------- printable / pdf ---------- */

export function printDocument() {
  window.print();
}

export async function exportPdf(element: HTMLElement | null, filename: string, title?: string) {
  if (!element) return;
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
  const img = canvas.toDataURL("image/jpeg", 0.96);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const maxW = pageW - margin * 2;
  const ratio = canvas.height / canvas.width;
  let imgW = maxW;
  let imgH = imgW * ratio;
  if (imgH > pageH - margin * 2) {
    imgH = pageH - margin * 2;
    imgW = imgH / ratio;
  }
  const x = (pageW - imgW) / 2;
  pdf.addImage(img, "JPEG", x, margin, imgW, imgH, undefined, "FAST");
  pdf.setProperties({ title: title || filename });
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء الخير";
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function timeDiffMinutes(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

export function bmi(weight?: number, height?: number): string | null {
  if (!weight || !height) return null;
  const m = height / 100;
  const v = weight / (m * m);
  if (!Number.isFinite(v)) return null;
  return v.toFixed(1);
}

export function bmiLabel(v: string | null): string {
  if (!v) return "—";
  const n = Number(v);
  if (n < 18.5) return "نقص وزن";
  if (n < 25) return "وزن مثالي";
  if (n < 30) return "زيادة وزن";
  return "سمنة";
}
