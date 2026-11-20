# عدالة — منصة احترافية لإدارة أعمال المحاماة

نظام ويب كامل (SPA + خادم SQL مُدار) لإدارة قضايا المكتب: بورتفوليو، قضايا، موكلون، مواعيد، مهام،
مستندات، أرشيف، مكتبة قانونية، مستخدمون وصلاحيات، تقارير، ومركز طباعة.

> **نسخة سطح المكتب المتاحة الآن** — انظر القسم في نهاية الملف، والدليل الكامل في
> `دليل التوزيع والترخيص - منصة عدالة.docx`.

---

## التشغيل السريع

من جذر المشروع أو من داخل مجلد المشروع:

```bat
start-web.bat
```

يفتح الخادم على `http://127.0.0.1:5181` ويشغّل المتصفح الافتراضي تلقائيًا.

### التشغيل اليدوي

```bash
npm install

# تطوير: API على 5181 + Vite على 5180
npm run dev

# إنتاج: بناء الواجهة ثم تشغيل الخادم على 5181
npm run build
npm run server
```

> بيئة Windows: `npm.ps1` محجوب — استخدم **دائمًا** `npm.cmd` و `npx.cmd`.

**بيانات الدخول الافتراضية**: `admin` / `admin123` — غيّرها فور أول دخول من صفحة المستخدمين.
(المستخدمون الجدد الذين تنشئهم من البرنامج تبدأ كلمة مرورهم `Admin@2025`.)

### البيانات

تُحفظ كل البيانات في قاعدة SQLite مُدارة على الخادم:

```
adala-platform/data/adala.db
```

الخادم: Node.js + Express 5 + `node:sqlite`، والواجهة تقرأ وتكتب عبر REST API.
لإعادة ضبط البيانات التجريبية: أوقف الخادم، احذف `data/adala.db*`، ثم شغّله من جديد.

---

## البنية

```
src/
  App.tsx                    التوجيه + حرّاس الصلاحيات
  main.tsx                   الإقلاع + تهيئة الجلسة + تسجيل Service Worker
  index.css                  رموز التصميم (Light/Dark) + قواعد @media print
  lib/
    db.ts                    طبقة توافق API فوق REST + نمط Repository
    print.ts                 الطباعة المباشرة + تجهيز مناطق الالتقاط
    pdf.ts                   تصدير PDF (jsPDF + html2canvas) + CSV
    permissions.ts           RBAC (7 أدوار) + تخصيص فردي
    auth.ts  format.ts  types.ts  cn.ts
  components/                layout/ · ui/ · forms/ · charts/
  pages/                     15 صفحة (Dashboard … PrintCenter)
  state/AppProvider.tsx      سياق المصادقة والإعدادات والثيم
server/                      Express 5 + node:sqlite (API + مصادقة + بذر)
```

**المسارات:** `/dashboard` `/matters` `/matters/:id` `/clients` `/tasks` `/calendar` `/documents`
`/archive` `/library` `/reports` `/users` `/settings` `/portfolio` `/portfolio/manage` `/print`

---

## نسخة سطح المكتب + نظام الترخيص

المشروع يحتوي الآن على منظومة توزيع كاملة:

| المجلد | الوظيفة |
|---|---|
| `adala-desktop/` | نسخة سطح المكتب (Electron) — تجربة 15 يومًا + تراخيص أوفلاين/أونلاين/هجينة |
| `adala-license-server/` | خادم التراخيص (تفعيل، فحص دوري، إلغاء عن بُعد، لوحة إدارة عربية) |
| `license-keys/` | مفاتيح توقيع التراخيص (**لا توزَّع أبدًا**) |
| `license-output/` | ملفات التراخيص المولدة للعملاء (.adlic) |
| `docs-tools/` + `make-distribution-guide.cjs` | مولّد دليل الوورد |

```bash
# بناء نسخة التوزيع (Setup + Portable):
cd adala-desktop && npm.cmd install && build-exe.bat

# تشغيل خادم التراخيص محليًا:
cd adala-license-server && start-server.bat

# توليد ترخيص لعميل (أوفلاين/هجين):
cd adala-desktop && node tools/license-gen.js --machine XXXX-XXXX-XXXX-XXXX --customer "العميل" --plan annual --mode hybrid
```

الشرح الكامل خطوة بخطوة: افتح **`دليل التوزيع والترخيص - منصة عدالة.docx`**.

---


## نظام الطباعة والتصدير (الجزء الأكثر حساسية)

### طباعة مباشرة — `lib/print.ts` → `printElement(element, { header, footer, title })`
- تُنشئ نسخة داخل `#print-root` (مخفي على الشاشة، ظاهر في `@media print`).
- تفرض رموز النهار على النسخة ⇒ **نص داكن على ورق أبيض حتى في الوضع الليلي**.
- `@page { size: A4; margin: 16mm 14mm 18mm }` ⇒ عرض المحتوى ≈ **688px**.

### تصدير PDF — `lib/pdf.ts` → `exportElementToPdf(el, opts)` / `exportPrintArea(id, name, opts)`
- **html2canvas لا يقبل HTMLElement!** (يستخدم `parseDocumentSize` لحجم المستند لا حدود العنصر).
  الحل المعتمد: كل شيء داخل `onclone` مع تمرير `x/y/width/height` صريحة من قياس النسخة.
- `PRINT_CONTENT_WIDTH = 688` (A4 عمودي) · `PRINT_CONTENT_WIDTH_LANDSCAPE = 1016` (A4 أفقي).
- **Tailwind v4** يولّد `color-mix(in oklab, …)` و`linear-gradient(… in oklab, …)` →
  html2canvas يفشل بـ `unsupported color function "oklab"`.
  الحل: `normalizeElementColors()` في `print.ts` يحوّلها إلى `rgba()` عبر canvas 1×1 + `getImageData`
  (لأن `ctx.fillStyle` يُعيد oklab كما هو).
- التقاط متعدد الصفحات: ي slicing أفقي على ارتفاع الصفحة ثم `pdf.addImage` لكل شريحة.

### التحقّق من التصدير (برمجيًا — النموذج لا يقرأ صورًا)
```js
// داخل المتصفح: ترقيع toDataURL لحساب نسبة البكسلات غير البيضاء
const d = ctx.getImageData(0,0,w,h).data; // dark = r,g,b < 120
```
المعيار: **نتائج الوضع الليلي = النهاري تمامًا**، و`nonWhite` بين 4% و 31%.
> إن ظهر كانفس 300×150 فهو اختبار `testSVG` الداخلي في html2canvas — وليس الالتقاط الحقيقي.

---

## مصائد معروفة (لا تُعِد اكتشافها)

| المصيدة | القاعدة |
|---|---|
| `hidden` لا يعمل مع `inline-flex` | Tailwind v4: `.flex → .grid → .hidden → .inline-flex` — لفّ الزر في `<span className="hidden sm:inline-flex">` |
| `cn()` بلا tailwind-merge | تعارضات `display` تُحسم بترتيب CSS لا بترتيب الكلاسات |
| `useLiveQuery` بقيمة `[]` | يعرض بيانات فارغة لحظيًا قبل تحميل IndexedDB — انتظر أو استخدم fallback |
| `import type` | `isolatedModules` + `noUnusedLocals` مفعّلة — استيرادات الأنواع تحتاج `import type` |
| PowerShell + العربية | يعرض mojibake — اقرأ بـ `node` بملفات `.cjs` بترميز UTF-8 |
| توليد نص عربي طويل | قد يتشوّه — افحص المحارف بعد كل كتابة صفحة (لا محارف صينية/لاتينية/هولندية/كورية داخل النص العربي) |
| HMR أثناء القياس | يُفسد قياسات canvas — أعد تحميل الصفحة قبل القياس |

---

## المرحلة القادمة (جاهزة للتوسّع)

- **PWA / Local-first**: `public/sw.js` مسجّل في `main.tsx` + Dexie ⇒ العمل دون إنترنت.
- **ديسك توب / موبايل**: طبقة Repository في `db.ts` تفصل التخزين عن الواجهة — يكفي استبدالها بـ REST/Capacitor.
- **توسّع الصلاحيات**: `permissions.ts`RBAC جاهز لدورين إضافيين.
- **قوالب إضافية**: `PrintCenter.tsx` (5 قوالب) — يُضاف قالب كـ component مع `orientation` المناسب.
