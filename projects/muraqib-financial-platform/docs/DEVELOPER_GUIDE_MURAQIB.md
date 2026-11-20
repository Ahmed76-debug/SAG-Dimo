# دليل المطور التقني - منصة المراقب المالي المعتمد

**الإصدار:** 1.2.0  
**التاريخ:** 2026-11-03  
**الهدف:** توثيق معماري وتقني كامل للبناء والتطوير والنشر

## 1. نظرة عامة

المنصة تطبيق React/TypeScript يعمل بنهج **Local-First** على IndexedDB عبر Dexie، مع قابلية استبدال طبقة البيانات مستقبلاً بـ Supabase/PostgreSQL مع الحفاظ على واجهات الخدمات.

**النموذج المحاسبي:** البيانات الأصلية هي **ميزان مراجعة معتمد** وليست دفتر يومية يومي. قيود التسوية المراجعة فقط هي القيود اليدوية، والقيد الافتتاحي عند اعتماد الميزان يُنشأ آلياً `kind = 'opening'` ويُستبعد من احتساب القوائم.

## 2. التقنيات

| التقنية | الإصدار | الغرض |
|---|---|---|
| Vite | ^8.3.5 | البناء والتطوير |
| React | ^19.3.1 | واجهة المستخدم |
| TypeScript | ^5.9.3 | سلامة الأنواع |
| Tailwind CSS | ^4.3.3 | التصميم |
| React Router DOM | ^7.18.4 | التوجيه |
| Dexie.js | ^4.4.6 | IndexedDB |
| dexie-react-hooks | ^4.4.0 | استعلامات تفاعلية |
| Zustand | ^5.0.8 | الحالة العامة |
| i18next | ^25.x | التدويل |
| lucide-react | ^1.61.0 | الأيقونات |
| jsPDF + html2canvas | ^4.x / ^1.4.x | PDF |
| xlsx | ^0.18.5 | Excel |
| date-fns | ^4.1.0 | التواريخ |
| clsx + tailwind-merge | ^2.x | دمج الكلاسات |

> لا توجد مكتبة وهمية لدفتر يومية؛ واجهة المستخدم لا تعرض إلا **قيود التسوية والمراجعة**.

## 3. هيكل المجلدات

```text
muraqib-financial-platform/
├── docs/
├── public/
├── src/
│   ├── components/
│   │   ├── CompanySelector.tsx
│   │   ├── ReportView.tsx
│   │   └── ui.tsx
│   ├── data/
│   │   ├── seedData.ts
│   │   ├── trialBalanceTemplates.ts
│   │   └── defaultChartOfAccounts.ts
│   ├── i18n/
│   │   ├── config.ts
│   │   └── locales/ar.json, en.json
│   ├── layouts/AppLayout.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── finance.ts
│   │   └── exports.ts
│   ├── pages/
│   │   ├── dashboard/
│   │   ├── companies/
│   │   ├── accounts/
│   │   ├── trialbalance/
│   │   ├── adjustments/
│   │   ├── reports/
│   │   ├── analysis/
│   │   ├── budget/
│   │   ├── archive/
│   │   ├── reminders/
│   │   ├── settings/
│   │   ├── backup/
│   │   └── portal/
│   ├── routes/index.tsx
│   ├── services/
│   └── stores/
├── index.html
└── package.json
```

## 4. جداول Dexie

**اسم قاعدة البيانات:** `MuraqibFinancialDB`  
**الإصدار الحالي:** `version(6)`

### ترحيلات قاعدة البيانات

- **v5:** دمج سجلات `officeProfile` و`appSettings` المكررة في سجل واحد، مع الاحتفاظ بأحدث الحقول غير الفارغة.
- **v6:** بعد إعادة الربط بالشركات حسب `code`، يتم حذف النسخ المكررة من الشركات والحسابات وميزان المراجعة وسطوره والقيود والمستخدمين والمواعيد والأرشيف وأسعار الصرف والموازنات.
- صفوف `officeProfile` و`appSettings` جدولان مفردتان (Singleton) ويجب أن يحتوي كل منهما على سجل واحد فقط.

| الجدول | المفتاح | الفهارس | الوصف |
|---|---|---|---|
| officeProfile | ++id | - | هوية المكتب والشعار |
| appSettings | ++id | - | اللغة/الثيم/النسخ/آخر نسخ واستعادة |
| companies | ++id | code, nameAr, nameEn, legalForm, size, activity, status | الشركات |
| accounts | ++id | companyId, code, type, parentCode, level, isActive | دليل الحسابات |
| trialBalanceImports | ++id | companyId, fiscalYear, status, source | رؤوس ميزان المراجعة |
| trialBalanceLines | ++id | importId, companyId, code, order | سطور الميزان |
| adjustments | ++id | companyId, fiscalYear, status, date | قيود التسوية وقيد الافتتاح |
| users | ++id | username, role, companyId, isActive | المستخدمون |
| reminders | ++id | companyId, dueDate, status, type | التذكيرات |
| archive | ++id | companyId, year, type, archivedAt | أرشيف معتمد |
| currencyRates | ++id | code, date | أسعار الصرف مقابل EGP |
| budgets | ++id | companyId, year | الموازنات |
| auditLogs | ++id | action, entity, createdAt | سجل التدقيق |

### قيد الافتتاح
- `Adjustment.kind = 'opening'` عند اعتماد ميزان مراجعة
- التوازن: إجمالي مدينة = إجمالي دائنة
- حقول: `no = OPEN-<year>`، `date = reviewedAt`
- يُستبعد من `loadApprovedDataset` ولا يظهر ضمن وحدة قيود التسوية

## 5. الخدمات

### tb.service.ts
- `getApprovedDataset(companyId, year)` / `loadApprovedDataset`
- `approveTrialBalance(importId, reviewerId, reviewerName, notes?)`
- إنشاء قيد افتتاح عند أول اعتماد
- `restoreArchive(itemId)` استعادة أرشيف كنسخة قيد المراجعة
- `archiveApprovedTrialBalance` حفظ نسخة JSON في `archive`
- تحويل العملات حسب `currencyRates`
- كل الاستعلامات تحترم `companyId`

### reports.service.ts
- `generateStatement(type, companyId, year)`
- `generateAnalysis(companyId, year, priorYear?)`
- لا يستخدم إلا `status === 'approved'`

### auth.service.ts
- `login(username, password)` مع تخزين الجلسة محلياً
- `can(role, permission)`
- `isPortalRole(role)`
- تسجيل الدخول والعمليات الحساسة في `auditLogs`

### account.service.ts
- `initializeChartOfAccounts(companyId?)`
- `getAccountsByCompany`
- CRUD وحفظ وتزامن الدليل

### هوية المكتب (`officeProfile`) واتصالها بالواجهة
- `officeProfile` جدول Singleton؛ يجب ألا يحتوي إلا سجلاً واحداً.
- صفحة الإعدادات تحمّل السجل عبر `useLiveQuery`، وللحفظ تزال `id` من الـ PATCH ثم يُحدَّث السجل الموجود أو يُنشأ واحد عند الحاجة.
- `AppLayout` و`PortfolioPage` و`ReportView` تقرأ نفس الجدول عبر `useOfficeProfile()`، لذلك يظهر أي تعديل فورياً في الواجهة والتقارير بعد الحفظ.
- عند الاستعادة من نسخة احتياطية أو عند الترقية إلى v6 يتم دمج السجلات المكررة تلقائياً بدل عرض هوية قديمة.

## 6. التدويل والاتجاه

- `i18n/config.ts` fallback `ar`، مدعوم `ar|en`
- `main.tsx` يضبط `lang` و`dir` قبل التشغيل ويقرأ `useI18nStore.getState().language`
- زر اللغة يبدّل `ar ↔ en` ويطبق `rtl/ltr` فوراً
- يجب أن يحتوي أي نص جديد على مفتاح في `ar.json` و`en.json`
- التقارير تطبع بنفس اتجاه اللغة الحالية

## 7. الثيم والتصميم

- `src/styles/index.css` هو المرجع للثيم العام
- متغيرات `--color-*` لـ light/dark
- مكونات مشتركة في `components/ui.tsx`
- `AppLayout` يحتوي sidebar/header/footer، مع حالات التحميل والانتقال
- `page-enter` للانتقالات، `card-hover` للبطاقات، `nav-active` للملاحة الفعالة
- `prefers-reduced-motion` يحترم تقليل الحركة

## 8. الطباعة وPDF وExcel

### PDF
- `exportElementToPdf(elementId, filename, lang)` في `lib/exports.ts`
- يستخدم `html2canvas` مع `scale: 2` ثم `jsPDF` A4 portrait
- يتحقق من وجود العنصر ويستخدم اسم ملف آمن

### الطباعة
- `printElement(elementId)` ينشئ `#print-root` ويستنسخ العنصر ويحذف `.no-print`
- CSS في `@media print` يخفي التطبيق ويطبع `.print-root` فقط
- `@page { size: A4; margin: 10mm; }`

### Excel
- `exportReportToExcel(model, meta, lang)`
- نماذج القوالب من `data/trialBalanceTemplates.ts`
- الموازنة والأرشيف والنسخ الاحتياطية تصدر JSON/Excel حسب السياق

## 9. التوجيه والصلاحيات

مسارات عامة:
- `/` بورتفوليو
- `/login` دخول

مسارات محمية:
- `/dashboard`
- `/companies`
- `/accounts`
- `/trialbalance/generator|import|review`
- `/portal`
- `/adjustments`
- `/reports/:type`
- `/analysis`
- `/budget`
- `/archive`
- `/reminders`
- `/users`
- `/settings`
- `/backup`

إعادة توجيه قديمة:
- `/entries` → `/adjustments`
- `/external` → `/portal`
- `/review` → `/trialbalance/review`

الصلاحيات تطبق في `AppLayout` حسب `can(role, permission)`، والمسارات الحساسة تظهر فقط لمن يملك الصلاحية.

## 10. بيانات العرض

`src/data/seedData.ts` ينشئ:
- 6 شركات متنوعة: مقاولات، صناعات غذائية، طبي، محاماة، سوبر ماركت، تجارة
- ميزانات معتمدة ومعلقة للسنوات 2025 و2026
- قيود تسوية معتمدة ومعلقة
- قيود افتتاح تلقائية عند الميزانات المعتمدة
- أرشيف ونسخ سابقة
- مواعيد ومستخدمين وست شركات
- أسعار صرف وموازنات

`seedDemoData()` تستخدم قفل Promise داخل وحدة `seedData.ts` لمنع التعبئة المزدوجة في React StrictMode، و`runSeedDemoData()` لا تضيف هوية المكتب أو الإعدادات إلا إذا كانت غير موجودة.

التهيئة تتم من `App.tsx` مع `localStorage` بمفتاح:
- `muraqib-bootstrapped` للتعبئة الأولى
- إعادة التعبئة اليدوية من الإعدادات لا تكرر البيانات دون تأكيد
- أي نسخة احتياطية تُستعاد يتم فيها دمج جداول `officeProfile` و`appSettings` وحذف تكرارات بيانات العرض تلقائياً.

## 11. البناء والتشغيل

```bash
npm run dev -- --host 127.0.0.1 --port 5173
npm run build
npm run preview
```

في Windows PowerShell استخدم:

```bash
cmd /c "cd /d \"C:\\Users\\CONNECT\\Documents\\Default Project\\muraqib-financial-platform\" && npm run build"
```

## 12. اختبار الجودة

اختبارات يدوية موصى بها:
1. الدخول بكل دور والتأكد من عزل الصلاحيات
2. اعتماد ميزان معلق والتأكد من إنشاء قيد افتتاح `OPEN-2026`
3. محاولة تعديل ميزان معتمد (ممنوع)
4. عرض القوائم والتأكد أن الفرق = 0
5. PDF/طباعة/Excel من كل قائمة
6. تصدير نسخة احتياطية ثم استعادتها
7. تبديل العربية/الإنجليزية في RTL/LTR
8. تبديل الثيم والتأكد من التباين

لا توجد اختبارات unit آلية بعد؛ أضف Vitest ثم اختبر:
- توازن الميزان
- استبعاد غير المعتمد
- إنشاء قيد الافتتاح مرة واحدة فقط
- تطابق ميزان المراجعة مع المدين/الدائن

## 13. النشر السحابي

عند النشر:
- استبدل Dexie بـ Supabase/PostgreSQL
- احتفظ بنفس الخدمات والواجهات
- اجعل `/login` يستخدم مزود هوية
- انقل النسخ الاحتياطية إلى object storage
- فعّل CSP وHTTPS وHSTS
- اجعل صلاحيات DB على مستوى الصفوف
- انقل `auditLogs` إلى مخزن غير قابل للتعديل

## 14. قواعد تطوير مهمة

- لا تستخدم دفتر يومية يدوي كمدخل للتقارير
- لا تستخدم إلا البيانات المعتمدة
- لا تكسر عزل الشركات أو بوابة المدير المالي
- لا تعرض قيود الافتتاح ضمن وحدة التسويات
- لا تطبع `.no-print`
- لا تخزن أسرار في الكود
- أضف توطين كل نص جديد
- حافظ على RTL/LTR
- حافظ على توازن الميزان عند أي تعديل

## 15. ملاحظات الأداء

- حالياً الإنتاج ملف JS واحد ~1.9MB؛ أضف code splitting لاحقاً حسب الصفحة
- تحميل IndexedDB مع 1268 سطر ميزان مقبول محلياً
- للقوائم الكبيرة استخدم ترقيم الصفوف وفهرسة `importId` لاحقاً
