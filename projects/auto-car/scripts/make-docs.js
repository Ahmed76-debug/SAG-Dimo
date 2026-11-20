'use strict';
/* ============================================================
   Auto Car — إنشاء دليل المستخدم ودليل المطور (Word .docx)
   يُشغَّل: node scripts/make-docs.js
   ============================================================ */
const { writeDocx } = require('./docx.js');
const path = require('node:path');

const U = []; // دليل المستخدم
const D = []; // دليل المطور التقني

/* ---------- دليل المستخدم ---------- */
U.push({ t: 'title', text: 'دليل المستخدم', sub: 'نظام أوتو كار لإدارة معارض السيارات — الإصدار 1.0.0' });

U.push({ t: 'p', text: 'هذا الدليل موجّه للمستخدم المبتدئ. يشرح خطوة بخطوة كيف تدخل البيانات، كيف تستخدم كل صفحة، وماذا تفعل في كل حقل. اقرأه بالترتيب (الإعدادات أولاً، ثم المخزون، ثم المبيعات، …).' });

U.push({ t: 'h1', text: '1. بيانات الدخول (Credentials)' });
U.push({ t: 'p', text: 'النظام يوفّر 3 حسابات تجريبية. سجّل الدخول من شاشة الدخول (اسم المستخدم + كلمة المرور):' });
U.push({ t: 'table', head: ['اسم المستخدم', 'كلمة المرور', 'الدور', 'الصلاحيات'], rows: [
  ['admin', 'admin123', 'مدير النظام', 'كل الصلاحيات (*)'],
  ['accountant', 'account123', 'محاسب', 'المحاسبة، التقارير، العملاء، الموردون، عرض السيارات'],
  ['sales', 'sales123', 'مبيعات', 'المبيعات، السيارات، العملاء، الأقساط'],
] });
U.push({ t: 'note', text: 'مهم: غيّر كلمات المرور فوراً من "الملف الشخصي → تغيير كلمة المرور" قبل الاستخدام الفعلي. حساب مدير النظام (admin) يملك صلاحية "إدارة المستخدمين" لإنشاء/تعديل/حذف المستخدمين.' });

U.push({ t: 'h1', text: '2. نظرة عامة على الواجهة' });
U.push({ t: 'bullets', items: [
  'القائمة الجانبية (Sidebar): قوائم مجمّعة (لوحة التحكم، إدارة المعرض، المبيعات، المشتريات، العملاء والموردون، المالية، التقارير، الإشعارات، الإدارة). كل مجموعة تفتح بطاقات (Cards) لصفحات فرعية.',
  'الشريط العلوي (Topbar): عنوان الصفحة، زر الثيم (12 ثيم)، زر اللغة (عربي/English)، الإشعارات (جرس)، قائمة المستخدم (الملف الشخصي، تغيير كلمة المرور، تسجيل الخروج).',
  'منطقة المحتوى: جداول، بطاقات، نماذج (Modals).',
  'أزرار عامة في الجداول: بحث، فلاتر، تصدير Excel، طباعة، إضافة.',
  'اللغة: التبديل يغيّر كل التسميات والبيانات (الحقول name/name_en). الثيم: 6 فاتحة + 6 داكنة.',
] });

U.push({ t: 'h1', text: '3. ترتيب الإعداد (لأول مرة) — خطوات البداية' });
U.push({ t: 'p', text: 'أنجز هذه الخطوات بالترتيب قبل إدخال المخزون:' });
U.push({ t: 'numbers', items: [
  'سجّل الدخول بحساب admin (كلمة المرور: admin123).',
  'الإعدادات (Administration → الإعدادات): اسم المعرض (عربي/إنجليزي)، العملة والرمز، نسبة الضريبة، بيانات الاتصال، تذييل الفاتورة.',
  ' shooters شاشة الدخول (Settings → شاشة الدخول): ارفع شعار المعرض (PNG شفاف) وصورة سيارة (PNG/خلفية داكنة). اختياري.',
  'العملات (Administration → العملات): currencies already seeded (EGP base). أضف عملات أخرى (USD, EUR) وحدّد سعر الصرف.',
  'السنة المالية (Finance → Years): تم إنشاء سنة مفتوحة تلقائياً. أنشئ سنة جديدة إن لزم.',
  'الخزائن (Finance → Treasuries): توجد خزينة نقدية + بنك. أضف خزائن/بنوك (الاسم، النوع، العملة، الرصيد الافتتاحي، الحساب المرتبط).',
  'دليل الحسابات (Finance → Accounts): تم تهيئة دليل حسابات (شجرة) تلقائياً. أضف حسابات فرعية إن لزم.',
  'القيد الافتتاحي: Finance → Journal → "إضافة قيد" → source = opening، أدخل الأرصدة الافتتاحية (عملاء، موردون، مخزون، خزائن). أو استخدم "Opening balances" في المركبات.',
  'المستخدمون (Admin → Users): أنشئ مستخدمين (محاسب/مبيعات) وأعطِ صلاحيات.',
  'النسخ الاحتياطي (Admin → Backup): اختر مجلداً وفعّل النسخ التلقائي.',
] });

U.push({ t: 'h1', text: '4. إدارة المعرض (Showroom)' });

U.push({ t: 'h2', text: '4.1 السيارات (Vehicles)' });
U.push({ t: 'p', text: 'المسار: إدارة المعرض → السيارات. تبويب بحث/فلاتر (الحالة، الحالة new/used، الملكية own/consignment، الماركة) + إضافة + تصدير Excel.' });
U.push({ t: 'h3', text: 'إضافة/تعديل سيارة (الحقول)' });
U.push({ t: 'bullets', items: [
  'البيانات: الكود (تلقائي إن تركته)، VIN، رقم الهيكل، رقم المحرك، رقم اللوحة، الماركة، الطراز، الفئة، اللون، السنة، الحالة (new/used)، الممشى (كم)، ناقل الحركة (أوتوماتيك/يدوي)، الوقود (بنزين/ديزل/هجين/كهرباء)، الأبواب، المقاعد، الأسطوانات، القدرة (hp)، المنشأ.',
  'الملكية/التكلفة: الملكية (ملك/عمولة)، المورد، سعر التكلفة، سعر التارجت، العملة، owner_name/phone (للعمولة)، نوع العمولة (نسبة/مبلغ ثابت)، قيمة العمولة، الحد الأدنى للسعر.',
  'التواريخ/الموقع: تاريخ الإدخال، تاريخ الشراء، انتهاء الترخيص، انتهاء التأمين، الموقع، ملاحظات.',
  'الصور: من "تفاصيل السيارة" → إضافة صورة (JPG/PNG/WEBP) — يمكن حذفها.',
  'المصروفات: إضافة مصروف (نوع، مبلغ، تاريخ، خزينة، وصف) — يسجّل قيداً.',
  'خيار "ترحيل قيد افتتاحي" (post_opening) عند الإضافة: ينشئ قيداً (Dr مخزون / Cr الموردون أو الصندوق).',
] });
U.push({ t: 'h3', text: 'تفاصيل السيارة' });
U.push({ t: 'bullets', items: [
  'عرض كل الحقول + الصور (معرض صور) + المصروفات.',
  'أزرار: تعديل، بيع (يأخذك لفاتورة بيع جديدة مع السيارة محددة)، إغلاق.',
  'الحالة: available / reserved / sold / returned.',
] });
U.push({ t: 'h3', text: 'فلاتر/بحث' });
U.push({ t: 'p', text: 'بحث (code/VIN/...), فلتر الحالة، الحالة (جديد/مستعمل)، الملكية، الماركة. تصدير Excel.' });

U.push({ t: 'h2', text: '4.2 البيانات المرجعية (Catalog)' });
U.push({ t: 'bullets', items: [
  'الماركات (Brands): name (عربي)، name_en، country (المنشأ)، active.',
  'الطرازات (Car Models): brand_id (FK)، name، name_en، type_id (FK to car_types)، active.',
  'الأنواع (Car Types): name، name_en، active.',
  'الألوان (Colors): name، name_en، hex (لون HEX)، active.',
  'البيانات مُهيّأة تلقائياً (24 ماركة + 25 طرازاً + 8 أنواع + 12 لوناً).',
] });

U.push({ t: 'h1', text: '5. المبيعات (Sales)' });
U.push({ t: 'h2', text: '5.1 فاتورة بيع جديدة (New Sale)' });
U.push({ t: 'p', text: 'المسار: المبيعات → فاتورة بيع جديدة. صلاحية sales.manage.' });
U.push({ t: 'bullets', items: [
  'العميل (اختياري — "عميل نقدي" إن تُرك): من قائمة العملاء.',
  'التاريخ، نوع البيع (كاش/تقسيط)، الخزينة.',
  'إضافة سيارات: اختر من "السيارات المتاحة" → "إضافة". لكل سيارة: سعر بيع (قابل للتعديل).',
  'الخصم، نسبة الضريبة (من الإعدادات)، المدفوع.',
  'ملاحظات.',
  'كاش: أدخل "المدفوع". تقسيط: أدخل "الدفعة الأولى (down_payment)"، "عدد الأقساط"، "الدورة" (شهري/أسبوعي/ربع سنوي)، "نسبة الفائدة"، "تاريخ أول قسط".',
  'للبيع بالعمولة (consignment): السيارة مُسجّلة بملكية "عمولة" → النظام يحسب عمولة المالك (نسبة/مبلغ ثابت) تلقائياً.',
  'الحفظ: "حفظ فاتورة بيع جديدة". تُنشأ فاتورة + قيد يومية (Dr العملاء/الصندوق، Cr إيرادات، Cr مخزون، Dr تكلفة).',
] });
U.push({ t: 'h2', text: '5.2 فواتير البيع (Sales Invoices)' });
U.push({ t: 'bullets', items: [
  'قائمة فواتير البيع (رقم، تاريخ، عميل، نوع، مجموع، مدفوع، حالة).',
  'عرض تفاصيل الفاتورة (طباعة).',
  'الفلاتر/البحث/التصدير.',
] });
U.push({ t: 'h2', text: '5.3 خطط التقسيط (Installment Plans)' });
U.push({ t: 'bullets', items: [
  'عرض خطط التقسيط (كل خطة: عميل، فاتورة، عدد الأقساط، المتبقي).',
  'تفاصيل الخطة: كل قسط (رقم، تاريخ استحقاق، مبلغ، مدفوع، حالة).',
  'تحصيل: "تحصيل" (pay) → مبلغ، تاريخ، طريقة (نقدي/تحويل)، خزينة، ملاحظات.',
] });
U.push({ t: 'h2', text: '5.4 الأقساط المستحقة (Installments Due)' });
U.push({ t: 'bullets', items: [
  'قائمة الأقساط: فلاتر (الحالة: pending/partial/overdue/paid)، تاريخ من/إلى.',
  'إحصاءات: المجموع، المدفوع، المتبقي.',
  'زر "تحديث" (refresh) لإعادة حساب الحالات (overdue).',
  'زر "تصدير Excel".',
  'تحصيل قسط (pay).',
] });

U.push({ t: 'h1', text: '6. المشتريات (Purchases)' });
U.push({ t: 'h2', text: '6.1 شراء جديد (New Purchase)' });
U.push({ t: 'bullets', items: [
  'المورد (اختياري)، التاريخ، طريقة الدفع (نقدي/تحويل/آجل)، الخزينة.',
  'إضافة سيارات للمخزون: "إضافة سيارة" → نموذج (ماركة، طراز، فئة، لون، سنة، حالة، VIN، هيكل، ممشى، سعر التكلفة*، سعر التارجت).',
  'لكل سيارة: سعر التكلفة (قابل للتعديل). الخصم، المدفوع.',
  'الحفظ: يُنشئ سيارات (status available) + فاتورة شراء + قيد يومية (Dr مخزون، Cr موردون/صندوق).',
] });
U.push({ t: 'h2', text: '6.2 قائمة المشتريات (Purchases List)' });
U.push({ t: 'bullets', items: [
  'قائمة فواتير الشراء (رقم، تاريخ، مورد، مجموع، مدفوع، حالة).',
  'عرض تفاصيل الفاتورة (طباعة).',
] });

U.push({ t: 'h1', text: '7. العملاء والموردون (Partners)' });
U.push({ t: 'bullets', items: [
  'العملاء (Customers): name (عربي)، name_en، phone، phone2، email، national_id، job، kind (individual/company/dealer)، opening_balance، credit_limit، address، notes، active.',
  'الموردون (Suppliers): name، name_en، phone، email، national_id، kind، opening_balance، address، notes، active.',
  'كشوف الحساب (Statement): من كل صف → "كشف حساب" → يعرض opening/debit/credit/running balance حسب فترة (from/to) + طباعة + إعادة حساب (recompute).',
  'تصدير Excel.',
] });

U.push({ t: 'h1', text: '8. المالية (Finance)' });

U.push({ t: 'h2', text: '8.1 دليل الحسابات (Chart of Accounts)' });
U.push({ t: 'bullets', items: [
  'عرض شجري (شجرة حسابات) مع أرصدة (مدين/دائن/رصيد) حسب فترة (from/to).',
  'إضافة/تعديل/حذف حساب: code، name، name_en، type (asset/liability/equity/revenue/expense)، parent_id، nature (debit/credit)، is_group، is_cash، is_bank، active، notes.',
  'حسابات "نقدية" (is_cash) و"بنك" (is_bank) تُربط بالخزائن.',
  'تصدير/طباعة.',
] });

U.push({ t: 'h2', text: '8.2 قيود اليومية (Journal)' });
U.push({ t: 'bullets', items: [
  'قائمة القيود (رقم، تاريخ، وصف، مرجع، مصدر، مجموع مدين/دائن، الحالة، المستخدم).',
  'فلاتر: البحث، المصدر (manual/opening/adjustment/closing)، تاريخ من/إلى.',
  'عرض تفاصيل قيد: الأسطر (حساب، وصف، مدين، دائن) + طباعة.',
  'إلغاء (void) قيد مرحّل (posted). حذف (delete) قيد (source من manual/opening/adjustment/closing).',
  'إضافة قيد (Add): تاريخ، مصدر، مرجع، وصف، + أسطر (حساب، وصف، مدين، دائن). يجب أن يكون متوازناً (مدين=دائن) و >0. "ترحيل" (post).',
  'تصدير Excel.',
] });

U.push({ t: 'h2', text: '8.3 الخزائن والبنوك (Treasuries)' });
U.push({ t: 'bullets', items: [
  'بطاقات إجمالية (نقد/بنك/عدد الخزائن) + جدول (الاسم، النوع، الحساب، البنك، رصيد افتتاحي، رصيد حالي).',
  'إضافة/تعديل: name، name_en، kind (cash/bank/wallet)، currency، opening_balance (فقط عند الإضافة)، bank_name، account_number، iban، account_id (حساب محاسبي)، active.',
  'تحويل بين خزائن (Transfer): من، إلى، مبلغ، تاريخ → ينشئ قيد يومية (Dr خزينة destination / Cr خزينة source).',
] });

U.push({ t: 'h2', text: '8.4 سندات القبض والصرف (Vouchers)' });
U.push({ t: 'bullets', items: [
  'تبويبان: قبض (receipt) / صرف (payment).',
  'قائمة (رقم، تاريخ، party، حساب، خزينة، طريقة، مبلغ، وصف).',
  'إضافة: نوع الطرف (عميل/مورد/أخرى)، الطرف، المبلغ*، الخزينة، طريقة (نقدي/تحويل/بطاقة)، تاريخ، وصف.',
  'حذف (delete) سند.',
] });

U.push({ t: 'h2', text: '8.5 Years المالية (Fiscal Years)' });
U.push({ t: 'bullets', items: [
  'قائمة (name، start_date، end_date، status).',
  'إضافة: name، start_date، end_date. (لا تعديل/حذف — حماية).',
] });

U.push({ t: 'h1', text: '9. التقارير (Reports)' });
U.push({ t: 'p', text: 'المسار: التقارير. كل تقرير: فلتر (from/to أو as_of) + "تحديث" + "طباعة" + "تصدير Excel". أنواع التقارير:' });
U.push({ t: 'bullets', items: [
  'ميزان المراجعة (Trial Balance): code، name، debit، credit، balance. إجمالي مدين/دائن + "متوازن/غير متوازن".',
  'قائمة الدخل (Income Statement): إيرادات (revenue) + مصروفات (expenses) + صافي الدخل. (أيضاً "تقرير الربح".)',
  'الميزانية (Balance Sheet): الأصول / الخصوم / حقوق الملكية + صافي الدخل. "متوازن/غير متوازن".',
  'حقوق الملكية (Equity Statement): رأس المال، أرباح محتجزة، مسحوبات، صافي الدخل.',
  'دفتر الأستاذ (General Ledger): حسب حساب محدد (opening + أسطر + running balance).',
  'تقرير المبيعات (Sales Report): ملخص (فواتير، مجموع، مدفوع، ربح) + حسب النوع + حسب المستخدم + حسب اليوم.',
  'تقرير المشتريات (Purchases Report): ملخص + حسب المورد.',
  'تقرير المخزون (Inventory Report): حسب حالة/ملكية/…',
  'تقرير الذمم (Receivables/Payables): حسب عميل/مورد.',
  'تقرير الأقساط (Installments Report).',
  'تقرير الربح (Profit Report): ربح السيارات + عمولات.',
] });

U.push({ t: 'h1', text: '10. الإشعارات والتذكيرات (Notifications)' });
U.push({ t: 'bullets', items: [
  'قائمة إشعارات (title، body، priority، kind، due_date، created_at).',
  'فلتر الحالة (all/unread/read/done).',
  'أزرار: "توليد تنبيهات" (generate_alerts) → ينشئ تنبيهات للأقساط المستحقة (7 أيام) وانتهاء المستندات (30 يوماً).',
  'وضع علامة "مقروء" (read)، "تم" (done)، "حذف".',
  '"قراءة الكل" (read_all).',
  'التنبيهات تُولَّد أيضاً تلقائياً (auto-backup etc.) — جرس في Topbar shows count.',
] });

U.push({ t: 'h1', text: '11. الإدارة (Administration)' });

U.push({ t: 'h2', text: '11.1 المستخدمون (Users)' });
U.push({ t: 'bullets', items: [
  'قائمة (user، role، phone، permissions count، status).',
  'إضافة/تعديل: name، username، password (جديد)، role (admin/manager/accountant/sales/viewer)، phone، email، active، permissions (15 صلاحية — checkboxes).',
  'admin = "*" (كل الصلاحيات).',
  'حذف (soft delete) — لا يمكنك حذف نفسك.',
] });

U.push({ t: 'h2', text: '11.2 الإعدادات (Settings)' });
U.push({ t: 'bullets', items: [
  'بيانات المعرض: company_name (عربي)، company_name_en، phone، phone2، email، website، address، invoice_footer.',
  'العملة: currency، currency_symbol، tax_rate، default_commission_percent.',
  'التواريخ: fiscal_year_start (MM-DD)، installment_reminder_days، doc_expiry_reminder_days.',
  'النسخ التلقائي: auto_backup_enabled، auto_backup_interval_hours، backup_retention_days، backup_dir.',
  'اللغة: language (ar/en). الثيم: theme (light/dark/...).',
  'الشعار (logo): URL نصي (أو رفع صورة عبر "شاشة الدخول").',
  'بطاقة "شاشة الدخول": رفع شعار + صورة سيارة (مع معاينة وحذف).',
  'معرض الثيمات: 12 ثيم (6 فاتحة + 6 داكنة).',
  'النسخ الاحتياطي: إعدادات النسخ.',
] });

U.push({ t: 'h2', text: '11.3 العملات (Currencies)' });
U.push({ t: 'bullets', items: [
  'قائمة (code، name، symbol، rate، decimals، active).',
  'إضافة/تعديل: code (3-8 أحرف، فريد)، name، name_en، symbol، rate، decimals.',
  'العملة الأساسية (EGP) لا يمكن حذفها. أسعار الصرف (Exchange rates) تُسجّل تلقائياً.',
  'زر "أسعار الصرف" لعرض سجل التغييرات.',
] });

U.push({ t: 'h2', text: '11.4 النسخ الاحتياطي (Backup)' });
U.push({ t: 'bullets', items: [
  'إحصاءات قاعدة البيانات (الحجم، عدد السيارات/الفواتير/القيود).',
  'المجلد (dir): "اختيار مجلد" → متصفح مجلدات (Windows drives).',
  'إنشاء نسخة now ("إنشاء نسخة").',
  'رفع نسخة (upload) — مع خيار استعادة (restore) فوراً.',
  'استعادة (restore) — "سيتم استبدال البيانات... متابعة؟".',
  'حذف (delete) نسخة.',
  ' pruning (حذف النسخ الأقدم من N يوم).',
  'إعدادات: auto_backup_enabled، interval (ساعات)، retention (أيام).',
  'النسخ التلقائي: كل 30 دقيقة يفحص؛ إن مضى الفاصل ينشئ نسخة (auto).',
] });

U.push({ t: 'h2', text: '11.5 استيراد وتصدير Excel/CSV (Import/Export)' });
U.push({ t: 'bullets', items: [
  'كيانات قابلة للاستيراد: vehicles، customers، suppliers، sales، purchases، accounts (GET /api/import/entities).',
  'تحميل قالب (template) → ملء → رفع (import).',
  'نتيجة: success/failed + أخطاء (row + error).',
  'تصدير سريع: vehicles، customers، suppliers، sales، purchases، accounts (Excel/CSV).',
  'تصدير مخصص (exportCustom) من التقارير.',
] });

U.push({ t: 'h2', text: '11.6 سلة المحذوفات (Trash)' });
U.push({ t: 'bullets', items: [
  'عرض السجلات المحذوفة (soft delete) مجمّعة حسب الجدول.',
  'استرجاع (restore) أو حذف نهائي (purge).',
  'الجداول (SOFT_TABLES): vehicles، vehicle_expenses، purchases، purchase_items، sales، sale_items، installments، customers، suppliers، accounts، treasuries، vouchers، consignments، fiscal_years، notifications، users.',
] });

U.push({ t: 'h2', text: '11.7 تفريغ الجداول (Truncate)' });
U.push({ t: 'bullets', items: [
  'اختيار جداول (checkboxes) + "تحديد الكل"/"مسح".',
  'يعرض عدد السجلات لكل جدول.',
  'تنفيذ (empty_tables) → حذف جميع البيانات (لا يمكن التراجع!).',
  'صلاحية truncate.manage (admin).',
] });

U.push({ t: 'h2', text: '11.8 سجل النشاط (Activity)' });
U.push({ t: 'bullets', items: [
  'سجل كل العمليات (create/update/delete/restore/login/backup/import/password) مع المستخدم، الكيان، التفاصيل، IP.',
  'فلتر حسب الإجراء، بحث. تصدير Excel.',
] });

U.push({ t: 'h1', text: '12. القيود الافتتاحية والتعديل (Opening/Adjustment)' });
U.push({ t: 'bullets', items: [
  'قيد افتتاحي (source=opening): يُنشأ تلقائياً عند إضافة سيارة/عميل/مورد/خزينة (post_opening).',
  'قيد تعديل (source=adjustment): من اليومية → "إضافة قيد" → source=adjustment.',
  'قيد إغلاق (source=closing): يُنشأ عند إقفال السنة.',
  'إلغاء/حذف: من قائمة القيود (void/delete) حسب الصلاحية.',
] });

U.push({ t: 'h1', text: '13. نصائح وأسئلة شائعة' });
U.push({ t: 'bullets', items: [
  'لا تُدخل بيانات بعملة غير مُعرّفة — الإعدادات/العملات.',
  'الأرصدة الافتتاحية: أدخلها قبل أي عمليات (قيد opening).',
  'النسخ الاحتياطي التلقائي: فعّله واختر مجلداً (محلي أو hosting).',
  'الصور: JPG/PNG/WEBP للسيارات؛ PNG شفاف للشعار.',
  'الExcel: استخدم "تحميل قالب" → ملء → رفع (import).',
  'الطباعة: كل صفحة تدعم "طباعة" → window.print().',
  'اللغة: التبديل (EN/ع) يغيّر UI + بيانات (name_en).',
  'الثيم: 12 ثيم (6 فاتحة + 6 داكنة) — يُحفظ تلقائياً.',
  'المحذوفات: كل حذف "soft delete" (قابل للاسترجاع من سلة المحذوفات).',
  'المستخدم: لا يمكنك حذف نفسك.',
] });

/* ---------- دليل المطور ---------- */
D.push({ t: 'title', text: 'دليل المطور التقني', sub: 'Auto Car — Architecture, Workflows, Maintenance & Future Development' });

D.push({ t: 'h1', text: '1. نظرة عامة على المعمارية' });
D.push({ t: 'bullets', items: [
  'Node.js خالص (node:http, node:sqlite, node:fs, node:zlib) — بدون أي تبعيات npm.',
  'قاعدة بيانات SQLite (node:sqlite DatabaseSync). ملف: data/autocar.db.',
  'الواجهة: Vanilla JS (ES Modules)، hash router، NO build step.',
  'الخادم: server.js (~310 سطر) — HTTP server، توجيه، مصادقة، CSRF، ملفات ثابتة، نسخ تلقائي.',
  'المسارات: routes/* (15 وحدة) — كلها export function(app) { add(...); }.',
  'الواجهة الأمامية: public/assets/js/{core,ui,app,i18n}.js + views/*.js (lazy import).',
  'المحاسبة: lib/accounting.js (محرك قيود + تقارير).',
  'Excel: lib/xlsx.js (قراءة/كتابة XLSX بدون مكتبات).',
  'الثيمات: 12 (6 فاتحة + 6 داكنة) عبر data-theme + data-mode.',
] });

D.push({ t: 'h1', text: '2. تشغيل المشروع' });
D.push({ t: 'code', text: 'cd auto-car\nnode server.js\n# → http://localhost:4500\n# admin / admin123' });
D.push({ t: 'bullets', items: [
  'Node.js v24+ (node:sqlite available).',
  'لا npm install (لا تبعيات).',
  'المنفذ: PORT env (default 4500). HOST env (default 0.0.0.0).',
  'البيانات: data/autocar.db. النسخ: data/backups. الرفع: public/uploads.',
  'التأهيل (migrate) تلقائي при open() (schema/001_init.sql + seed).',
] });

D.push({ t: 'h1', text: '3. بنية المجلدات' });
D.push({ t: 'table', head: ['المسار', 'الوظيفة'], rows: [
  ['server.js', 'HTTP server، توجيه، auth، CSRF، static، auto-backup'],
  ['lib/db.js', 'طبقة DB: open/migrate/seed, CRUD helpers, soft-delete, audit, settings, backup/restore'],
  ['lib/accounting.js', 'محرك القيود (postEntry/voidEntry) + التقارير (trial-balance, income-statement, balance-sheet, equity, general-ledger, sales, purchases, inventory, receivables, payables, installments, profit)'],
  ['lib/crud.js', 'مساعدات CRUD (إن وُجدت)'],
  ['lib/xlsx.js', 'قراءة/كتابة XLSX (ZIP + XML)'],
  ['routes/*.js', '15 وحدة مسارات (auth, system, dashboard, catalog, partners, vehicles, purchases, sales, installments, consignment, accounting, reports, notifications, systemtools, importexport)'],
  ['schema/001_init.sql', 'DDL (الجداول)'],
  ['public/index.html', 'Shell + SVG sprite (68 icons) + pre-paint theme'],
  ['public/assets/css/app.css', 'Design system + 12 themes + theme gallery'],
  ['public/assets/js/core.js', 'state, api, fmt, theme, lang, export/print'],
  ['public/assets/js/ui.js', 'modal, dropdown, confirm, table, form, crudView, charts, theme gallery'],
  ['public/assets/js/app.js', 'shell, login, nav groups, hash router'],
  ['public/assets/js/i18n.js', 'AR/EN dictionary'],
  ['public/assets/js/views/*.js', '16+ view (lazy loaded)'],
  ['scripts/*', 'check-icons.js, make-docs.js, docx.js, backup-cli.js, smoke.js'],
  ['data/', 'autocar.db + backups'],
  ['public/uploads/', 'الصور المرفوعة'],
] });

D.push({ t: 'h1', text: '4. الخادم (server.js)' });
D.push({ t: 'bullets', items: [
  'add(method, pattern, perm, handler, raw): يسجّل مساراً (regex). raw=true → لا يُقرأ JSON (للرفع).',
  'المصادقة: cookie autocar_sid (HttpOnly, SameSite=Lax). authFromRequest يبحث في sessions JOIN users.',
  'CSRF: header x-csrf يجب أن يطابق session.csrf (للـ non-GET).',
  'الصلاحيات: requirePerm(ctx.user, match.perm). admin = *.',
  'المسارات العامة: /api/auth/login, /api/health, /api/branding.',
  'الملفات الثابتة: serveStatic (cache: html/js/css/json = no-cache; أخرى = max-age=600 + ETag).',
  'النسخ التلقائي: setTimeout(5s) + setInterval(30m).',
  'الرفع: UPLOAD_DIR = public/uploads; MIME types.',
] });

D.push({ t: 'h1', text: '5. قاعدة البيانات (lib/db.js)' });
D.push({ t: 'bullets', items: [
  'open(): يفتح DB (WAL mode)، migrate() (schema + seed).',
  'migrate(): exec schema، seedSettings/Currencies/Users/Accounts/Treasuries/FiscalYear/CarReference/Notifications.',
  'softDelete(table, id, audit): يضبط deleted_at. restore/purge/listDeleted/deletedCounts.',
  'SOFT_TABLES: vehicles, vehicle_expenses, purchases, purchase_items, sales, sale_items, installments, customers, suppliers, accounts, treasuries, vouchers, consignments, fiscal_years, notifications, users.',
  'audit({user_id,user_name,action,entity,entity_id,details,ip}): يُسجّل في activity_log.',
  'settingsAll/settingGet/settingSet: جدول settings (key/value).',
  'backupTo(dir,{kind,note}), listBackups, pruneBackups, restoreFrom, dbStats, safeCheckpoint.',
  'nextNumber(prefix): ترقيم (JV-, SI-, PI-, V-, ...).',
  'hashPassword/verifyPassword: scrypt (salted).',
  'round2, now, todayStr, addDays, addMonths.',
] });

D.push({ t: 'h1', text: '6. محرك المحاسبة (lib/accounting.js)' });
D.push({ t: 'bullets', items: [
  'postEntry({date, description, reference, source, source_id, currency_id, exchange_rate, user_id, lines}): يُرحّل قيداً (Dr/Cr) — يتحقق من التوازن (|Dr-Cr|<=0.01). يُحدّث الأرصدة (accounts.balance).',
  'voidEntry(id): يُلغي قيداً (status=void) ويعكس الأرصدة.',
  'reports: trialBalance, incomeStatement, balanceSheet, equity, generalLedger, salesReport, purchasesReport, inventoryReport, receivables, payables, installmentsReport, profitReport.',
  'CODES: CASH 1101, BANK 1102, AR 1103, INVENTORY 1104, AP 2101, VAT 2103, CAPITAL 3101, RETAINED 3102, DRAWINGS 3103, SALES_REV 4101, COMMISSION_REV 4102, OTHER_REV 4103, SALES_RET 4104, COGS 5101, PREP_EXP 5205, DISC_EXP 5207.',
  'القيد الافتتاحي: source=opening. قيد تعديل: source=adjustment. قيد إغلاق: source=closing.',
] });

D.push({ t: 'h1', text: '7. الواجهة الأمامية (Frontend)' });
D.push({ t: 'h2', text: 'core.js' });
D.push({ t: 'bullets', items: [
  'state: {user, csrf, settings, currencies, lang, theme, meta, alerts, branding}.',
  't(key, fb): ترجمة. pick(row, field): اختيار name/name_en حسب اللغة.',
  'api(path, {method, body, raw, headers, filename}): fetch /api + path. يضيف x-csrf. 401 → unauthorized event.',
  'fmtNum/fmtInt/money/fmtDate/fmtDateTime/todayStr/monthStart.',
  'applyTheme/toggleTheme/isDark/themeById/themeLabel (12 themes). applyLang/toggleLang.',
  'can(perm), initials, debounce, downloadBlob, exportEntity, exportCustom, printHtml.',
  'loadBranding/brandLogo/loginCar (هوية عامة).',
] });
D.push({ t: 'h2', text: 'ui.js' });
D.push({ t: 'bullets', items: [
  'modal({title,body,footer,size}) → {node, close}.',
  'dropdown(anchor, items), confirmDialog(msg, opts).',
  'formHtml/readForm, renderTable, emptyState, statusBadge, barChart/donutChart/kpiCard.',
  'crudView(config): CRUD كامل (list + search + filters + pagination + add/edit modal + delete/restore + export).',
  'themeGallery/bindThemeGallery/openThemeGallery.',
  'toast (re-exported from ui.js; defined in core).',
] });
D.push({ t: 'h2', text: 'app.js' });
D.push({ t: 'bullets', items: [
  'NAV: مصفوفة مجموعات (direct أو items). findItem(key).',
  'renderLogin(app): شاشة الدخول (showroom-bg + cars-default + car photo + logo + password toggle).',
  'shellHtml()/bindShell(app): الهيكل (sidebar + topbar + content).',
  'route(): hash router → #/v/<key> أو #/g/<group> → lazy import(./views/<view>.js).',
  'boot(): /auth/me → /bootstrap → /meta. عند فشل → loadBranding + renderLogin.',
  'doLogout, openProfile, openChangePassword.',
] });

D.push({ t: 'h1', text: '8. إضافة صفحة جديدة (Step-by-step)' });
D.push({ t: 'numbers', items: [
  'أنشئ view: public/assets/js/views/my-page.js → export async function render(container, item) { ... }.',
  'سجّل في NAV (app.js): { key, label, desc, icon, view: "my-page", color, perm }.',
  'أضف endpoint في routes/*.js: add("GET", "/api/my-page", perm, handler).',
  'أضف i18n keys (ar + en) في i18n.js.',
  'أضف أيقونة (إن لزم) في SVG sprite (index.html) + verify via scripts/check-icons.js.',
  'أضف صلاحية في PERMS (users.js) و SETTING_KEYS (إن لزم).',
  'أضف migration (إن لزم) في schema/001_init.sql (CREATE TABLE IF NOT EXISTS).',
  'أضف تهيئة (seed) إن لزم في lib/db.js.',
  'أضف مسار في routes loader (server.js) إن أنشأت route module جديد.',
  'اختبر: node --check, check-icons, smoke.',
] });

D.push({ t: 'h1', text: '9. نظام الثيمات (12 themes)' });
D.push({ t: 'bullets', items: [
  'data-theme="<id>" + data-mode="light|dark" على <html>.',
  'الثيمات الفاتحة: light, light-emerald, light-royal, light-rose, light-ocean, light-sand.',
  'الثيمات الداكنة: dark, dark-emerald, dark-violet, dark-rose, dark-ocean, dark-amber.',
  'الـ vars الهيكلية (--bg, --surface, ...) في [data-mode="dark"]; ألوان الـ brand (--brand, --brand-2, --brand-rgb, --hero-from/via/to, --shadow-brand) في [data-theme="<id>"].',
  'applyTheme(id): يضبط attrs + localStorage (ac_theme, ac_theme_light/dark).',
  'toggleTheme(): يبدّل بين آخر light وأخر dark.',
  'theme gallery: ui.js themeGallery() + bindThemeGallery(container).',
  'Pre-paint script في index.html يمنع الوميض (FOUC).',
] });

D.push({ t: 'h1', text: '10. نظام الترجمة (i18n)' });
D.push({ t: 'bullets', items: [
  'dict = { ar: {...}, en: {...} } في i18n.js (~300+ keys).',
  't(key, fb) يبحث في dict[state.lang] ثم dict.ar ثم fb ثم key.',
  'pick(row, field): يختار name_en إن lang=en.',
  'applyLang(lang): يضبط lang/dir attributes + localStorage.',
  'البيانات (DB) تدعم name/name_en — bilingual.',
  'الـ RTL/LTR: document.documentElement.dir.',
] });

D.push({ t: 'h1', text: '11. التصدير/الاستيراد' });
D.push({ t: 'bullets', items: [
  'lib/xlsx.js: read/write XLSX (ZIP + XML) بدون مكتبات.',
  'تصدير: GET /api/export/:entity?format=xlsx|csv (vehicles, customers, suppliers, sales, purchases, accounts) + POST /api/export/custom.',
  'استيراد: GET /api/import/template/:entity, POST /api/import/:entity (raw body + x-filename).',
  'Excel import: صفحات (sheets) bilingual (name/name_en).',
] });

D.push({ t: 'h1', text: '12. الأمان (Security)' });
D.push({ t: 'bullets', items: [
  'الجلسات: token (cookie) + csrf. 7 أيام. ip/user_agent.',
  'CSRF: x-csrf header (non-GET).',
  'الصلاحيات: RBAC (admin/manager/accountant/sales/viewer + permissions[]).',
  'الرفع: ext whitelist (jpg/jpeg/png/webp/gif/svg)، حد 12MB.',
  'X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff.',
  'النسخ: soft-delete (deleted_at) + audit log (user_id, ip).',
] });

D.push({ t: 'h1', text: '13. النسخ الاحتياطي (Backup)' });
D.push({ t: 'bullets', items: [
  'backupTo(dir,{kind,note}): VACUUM INTO (SQLite).',
  'pruneBackups(dir, days): حذف الأقدم من N يوم.',
  'restoreFrom(file): استبدال DB.',
  'autoBackup(): كل 30m، إن مضى الفاصل (auto_backup_interval_hours).',
  'المجلد: backup_dir setting (default data/backups).',
  'رفع/استعادة عبر /api/backup/upload.',
] });

D.push({ t: 'h1', text: '14. سبل التطوير المستقبلية' });
D.push({ t: 'bullets', items: [
  'تطبيق سطح مكتب: Electron/Tauri يغلّف نفس Node server (offline-first).',
  'تطبيق جوال: React Native/Flutter يستهلك /api (REST).',
  'وضع عدم الاتصال: service worker + IndexedDB cache + sync queue.',
  'الترخيص: trial/lifetime/subscription — middleware يتحقق من license key + device fingerprint.',
  'منع النسخ: obfuscation + anti-tamper + device binding.',
  'Multi-tenant: إضافة company_id إلى الجداول + tenant middleware.',
  'Real-time: WebSocket/SSE للإشعارات.',
  'Reports PDF: puppeteer/playwright (server-side) أو print window (client).',
] });

D.push({ t: 'h1', text: '15. قائمة الملفات المهمة' });
D.push({ t: 'table', head: ['الملف', 'الأهمية'], rows: [
  ['server.js', 'الخادم + التوجيه + Auth + CSRF + Static + Auto-backup'],
  ['lib/db.js', 'DB layer + seed + backup/restore + audit + soft-delete'],
  ['lib/accounting.js', 'محرك القيود + التقارير'],
  ['lib/xlsx.js', 'Excel read/write'],
  ['routes/system.js', 'health, bootstrap, settings, currencies, users, meta, branding, image upload'],
  ['routes/vehicles.js', 'CRUD + images + expenses'],
  ['routes/sales.js', 'sales invoices + installments generation'],
  ['routes/purchases.js', 'purchases + vehicle creation'],
  ['routes/accounting.js', 'accounts, journal, treasuries, vouchers, fiscal-years'],
  ['routes/reports.js', 'all reports'],
  ['routes/consignment.js', 'consignment vehicles + settlements'],
  ['routes/importexport.js', 'import/export'],
  ['routes/systemtools.js', 'backup, truncate, db stats, trash'],
  ['routes/notifications.js', 'notifications'],
  ['public/assets/js/core.js', 'state, api, theme, lang, fmt'],
  ['public/assets/js/ui.js', 'modal, dropdown, crudView, charts, theme gallery'],
  ['public/assets/js/app.js', 'shell, login, nav, router'],
  ['public/assets/js/i18n.js', 'AR/EN dictionary'],
  ['public/index.html', 'shell + SVG sprite (68 icons)'],
  ['public/assets/css/app.css', 'design system + 12 themes'],
  ['schema/001_init.sql', 'DDL'],
] });

D.push({ t: 'h1', text: '16. استكشاف الأخطاء (Troubleshooting)' });
D.push({ t: 'bullets', items: [
  'port 4500 مشغول: taskkill /PID <pid> /F (netstat -ano | findstr :4500).',
  'node:sqlite غير متاح: Node < v22.16.0 — upgrade Node.',
  'npm.ps1 blocked: استخدم npm.cmd أو node مباشرة.',
  'الصور لا تظهر: تحقق من public/uploads + MIME + ETag cache (max-age=600).',
  'الخط (Cairo) لا يُحمَّل: offline — fallback to system fonts (مقبول).',
  '401 على /api/auth/me عند شاشة الدخول: طبيعي (public branding يُستخدم).',
  'CSRF invalid: أعد تحميل الصفحة (session mismatch).',
  'النسخ التلقائي لا يعمل: تحقق auto_backup_enabled=1 + backup_dir exists.',
] });

D.push({ t: 'h1', text: '17. الصلاحيات (Permissions Catalog)' });
D.push({ t: 'table', head: ['الصلاحية', 'الوصف'], rows: [
  ['vehicles.manage', 'إدارة السيارات والمخزون'],
  ['catalog.manage', 'البيانات المرجعية (ماركات/طرازات/ألوان)'],
  ['partners.manage', 'العملاء والموردون'],
  ['sales.manage', 'المبيعات والفواتير'],
  ['purchases.manage', 'المشتريات'],
  ['installments.manage', 'الأقساط والتحصيل'],
  ['consignment.manage', 'البيع بالعمولة والتسويات'],
  ['accounting.manage', 'المحاسبة والقيود والخزائن'],
  ['settings.manage', 'الإعدادات والعملات'],
  ['users.manage', 'إدارة المستخدمين'],
  ['backup.manage', 'النسخ الاحتياطي والاستعادة'],
  ['import.manage', 'استيراد وتصدير Excel'],
  ['trash.manage', 'سلة المحذوفات'],
  ['truncate.manage', 'تفريغ الجداول'],
  ['activity.view', 'سجل النشاط'],
] });

D.push({ t: 'h1', text: '18. بيانات الدخول (للتطوير/الاختبار)' });
D.push({ t: 'table', head: ['اسم المستخدم', 'كلمة المرور', 'الدور', 'الصلاحيات'], rows: [
  ['admin', 'admin123', 'admin', '["*"]'],
  ['accountant', 'account123', 'accountant', '["accounting","reports","customers","suppliers","vehicles.view"]'],
  ['sales', 'sales123', 'sales', '["sales","vehicles","customers","installments"]'],
] });

/* ---------- إنشاء الملفات ---------- */
const outDir = path.join(__dirname, '..', 'docs');
const uPath = path.join(outDir, 'دليل-المستخدم-AutoCar.docx');
const dPath = path.join(outDir, 'دليل-المطور-AutoCar.docx');

const r1 = writeDocx(uPath, U, { title: 'دليل المستخدم — Auto Car', author: 'Auto Car' });
const r2 = writeDocx(dPath, D, { title: 'دليل المطور التقني — Auto Car', author: 'Auto Car' });

console.log('created:', r1.path, r1.bytes, 'bytes');
console.log('created:', r2.path, r2.bytes, 'bytes');
console.log('blocks: user=', U.length, 'dev=', D.length);
