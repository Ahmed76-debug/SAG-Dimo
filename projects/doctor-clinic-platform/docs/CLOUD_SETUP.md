# تجهيز السحابة والواتساب

هذا الدليل ينقل «منصة طبيب» من الوضع التجريبي المحلي إلى عيادة حقيقية متعددة الأجهزة، ثم يربط محرك التذكيرات بـ WhatsApp Cloud API. كل خطوة مستقلة: يمكنك تشغيل السحابة أولًا والاحتفاظ بالواتساب اليدوي، ثم تفعيل الإرسال التلقائي لاحقًا.

> **مهم:** لا تضع `SUPABASE_SERVICE_ROLE_KEY` أو أي مفتاح واتساب في متغير يبدأ بـ `VITE_`. متغيرات `VITE_` تُحزَّم مع المتصفح ويمكن لأي زائر قراءتها.

---

## 1) البنية

| الطبقة | التقنية | المسؤولية |
|---|---|---|
| الواجهة | React + Vite | عرض البيانات، RBAC في الواجهة، تجربة الاستخدام |
| الهوية | Supabase Auth | كلمات مرور مشفّرة، جلسات، استعادة كلمة المرور |
| البيانات | PostgreSQL + RLS | تخزين دائم، سياسات وصول على مستوى الصف |
| الملفات | Supabase Storage (خاص) | مرفقات طبية وإثباتات دفع |
| التذكيرات | Edge Function + pg_cron | قراءة المستحقات، إرسال القوالب، تسجيل النتيجة |
| الواتساب | WhatsApp Cloud API | تسليم الرسائل + Webhook لحالة التسليم |
| الواجهة العامة | سياسة anon محدودة | طلب حجز + معرفة الأوقات المحجوزة فقط |

**قاعدة المزامنة:** الواجهة تُرسل فروقًا (diff) إلى PostgreSQL بعد كل تعديل، وتسحب أحدث نسخة عند العودة إلى التبويب. لا توجد Realtime حتى الآن؛ التحديث خلال ثوانٍ وليس لحظيًا. في حال تعديل نفس السجل من جهازين، يفوز آخر حفظ (last write wins).

---

## 2) إنشاء المشروع وتشغيل قاعدة البيانات

1. أنشئ مشروعًا على [supabase.com](https://supabase.com) واحفظ:
   - `Project URL`
   - `anon public key` (أو `publishable key`)
   - `service_role key` (للخادم فقط)
2. من **SQL Editor** نفّذ الملفات بالترتيب:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_storage.sql`
   - `supabase/migrations/0003_restore_backup.sql`
3. تحقق أن الجداول أُنشئت: `profiles, patients, appointments, bookings, visits, prescriptions, invoices, archive, reminders, settings, doctor_profile, audit_log, whatsapp_events`.
4. تحقق أن البكتين `medical-files` و`payment-proofs` ظهرا في Storage وأنهما **Private**.

> السكربت `0001_init.sql` ينشئ صفوف `settings` و`doctor_profile` الافتراضية وصلاحيات الأدوار. إن أعدت تنفيذه بعد تعديل البيانات، راجع السياسات قبل الاعتماد عليه في الإنتاج.

### أول حساب إداري

لا توجد صفحة تسجيل عامة. أنشئ أول حساب من سطر الأوامر:

1. انسخ `.env.example` إلى `.env.local` واملأ:
   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   BOOTSTRAP_EMAIL=doctor@example.com
   BOOTSTRAP_PASSWORD=كلمة-مرور-قوية
   BOOTSTRAP_NAME=د. اسم الطبيب
   BOOTSTRAP_ROLE=doctor
   ```
2. شغّل:
   ```bash
   npm install
   npm run cloud:bootstrap
   npm run cloud:check
   npm run dev
   ```
3. سجّل الدخول. أضف بقية الفريق من صفحة **المستخدمون** — كلمات المرور تُنشأ عبر دالة `admin-users` ولا تُخزَّن في الواجهة.

> `cloud:bootstrap` آمن للتشغيل المتكرر: إن كان البريد موجودًا يحدّث ملف الصلاحيات فقط ولا يغيّر كلمة المرور.

---

## 3) متغيرات النشر

### Vercel / Netlify
أضف فقط:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```
ثم أعد النشر. لا تضف `SUPABASE_SERVICE_ROLE_KEY` إلى استضافة الواجهة.

### Supabase Edge Functions
الأسرار التالية تُضبط على المشروع وليست في الواجهة:
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

npx supabase secrets set \
  CRON_SECRET="قيمة-عشوائية-طويلة" \
  WHATSAPP_VERIFY_TOKEN="رمز-تحقق-خاص" \
  WHATSAPP_APP_SECRET="..." \
  WHATSAPP_TOKEN="..." \
  WHATSAPP_PHONE_NUMBER_ID="..." \
  WHATSAPP_DRY_RUN=true \
  CLINIC_TIMEZONE=Africa/Cairo \
  DEFAULT_COUNTRY_CODE=20
```
لا تحدد `SUPABASE_URL` أو `SUPABASE_SERVICE_ROLE_KEY` يدويًا؛ Supabase يضيفهما تلقائيًا داخل الدوال.

انشر الدوال:
```bash
npx supabase functions deploy admin-users --no-verify-jwt
npx supabase functions deploy reminders-dispatch --no-verify-jwt
npx supabase functions deploy whatsapp-webhook --no-verify-jwt
npx supabase functions deploy restore-backup --no-verify-jwt
```
سبب `--no-verify-jwt`: كل دالة تتحقق بنفسها. `admin-users` و`reminders-dispatch` يقبلان JWT مستخدم بصلاحية محددة، أو `x-cron-secret` للمجدول. `whatsapp-webhook` يتحقق من توقيع Meta. أما `restore-backup` فيتطلب جلسة إدارية بصلاحية `settings.edit` ويرفض `x-cron-secret`.

---

## 4) قوالب واتساب العربية

أنشئ القوالب في **WhatsApp Manager → Message templates**، اللغة `Arabic (ar)`، الفئة `UTILITY`. يجب أن تطابق أسماء القوالب في `.env` تمامًا، وأن يكون عدد المتغيرات مطابقًا لما يرسله المحرك.

### 1. `appointment_reminder_ar` — 5 متغيرات
```
مرحبًا {{1}}،
نذكّركم بموعدكم غدًا {{2}} الساعة {{3}} في {{4}}.
يرجى تأكيد الموعد بالرد على هذه الرسالة، أو الاتصال على {{5}}.
```
ترتيب القيم: الاسم، التاريخ، الوقت، اسم العيادة، هاتف العيادة.

### 2. `booking_payment_reminder_ar` — 4 متغيرات
```
مرحبًا {{1}}،
استلمنا طلب حجزكم رقم {{2}} بقيمة {{3}}.
يرجى إكمال الدفع لتأكيد الموعد في {{4}}.
```
ترتيب القيم: الاسم، رقم الحجز، المبلغ والعملة، اسم العيادة.

### 3. `invoice_due_reminder_ar` — 4 متغيرات
```
مرحبًا {{1}}،
لديكم فاتورة رقم {{2}} بمبلغ متبقٍ {{3}} في {{4}}.
يسعدنا استلام الدفع عبر إنستاباي أو فودافون كاش.
```
ترتيب القيم: الاسم، رقم الفاتورة، المبلغ المتبقي والعملة، اسم العيادة.

### 4. `followup_reminder_ar` — 3 متغيرات
```
مرحبًا {{1}}،
حان موعد متابعتكم في {{2}}.
يسعدنا استقبالكم في {{3}}.
```
ترتيب القيم: الاسم، تاريخ المتابعة، اسم العيادة.

> استخدم أرقامًا تجريبية عند إنشاء القالب. Meta قد ترفض القالب إذا احتوى على متغيرات بلا أمثلة. لا تضع روابط أو وعودًا طبية في القوالب.

### تغيير أسماء القوالب
يمكن تغيير الأسماء دون تعديل الكود:
```bash
npx supabase secrets set \
  WHATSAPP_TEMPLATE_APPOINTMENT=appointment_reminder_ar \
  WHATSAPP_TEMPLATE_BOOKING=booking_payment_reminder_ar \
  WHATSAPP_TEMPLATE_INVOICE=invoice_due_reminder_ar \
  WHATSAPP_TEMPLATE_FOLLOWUP=followup_reminder_ar \
  WHATSAPP_TEMPLATE_LANG=ar
```

---

## 5) ربط Webhook

1. انشر الدالة `whatsapp-webhook`.
2. في **Meta for Developers → WhatsApp → Configuration**:
   - Callback URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`
   - Verify Token: نفس `WHATSAPP_VERIFY_TOKEN`.
3. اضغط **Verify and save**.
4. اشترك في حقل `messages`.
5. أضف `WHATSAPP_APP_SECRET` من إعدادات التطبيق. الدالة ترفض أي طلب بلا توقيع صحيح.

تُحدَّث حالة كل رسالة تلقائيًا (`sent → delivered → read` أو `failed`) داخل جدول `reminders`، وتُحفظ أحداث Webhook الخام في `whatsapp_events` لمراجعة المدير.

---

## 6) تشغيل الإرسال التلقائي

الوضع الافتراضي هو **معاينة آمنة**: يقرأ المحرك المستحقات ويعرضها لكنه لا يرسل ولا يكتب سجل إرسال. جرّبه من صفحة **التذكيرات → فحص وتشغيل الآن**، أو:

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/reminders-dispatch" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"source":"test"}'
```

بعد اعتماد القوالب:
```bash
npx supabase secrets set WHATSAPP_DRY_RUN=false
```

### ما الذي يفحصه؟

| النوع | الشرط | التكرار |
|---|---|---|
| تأكيد موعد | مواعيد الغد بحالة مجدول/مؤكد/منتظر | رسالة واحدة يوميًا لكل موعد |
| حجز بانتظار الدفع | كل الحجوزات `pending` | رسالة واحدة يوميًا لكل حجز |
| فاتورة متأخرة | `unpaid` أو `partial` مع مبلغ متبقٍ | رسالة واحدة يوميًا لكل فاتورة |
| متابعة | آخر زيارة لكل مريض بتاريخ متابعة مستحق خلال 30 يومًا | رسالة واحدة يوميًا لكل زيارة |

المفتاح `kind:ref_id:YYYY-MM-DD` يمنع التكرار حتى لو شغّلت الدالة أكثر من مرة. إذا أرسل الموظف تذكيرًا يدويًا في نفس اليوم، يتخطاه المحرك تلقائيًا. لتجربة إعادة الإرسال، احذف سجل اليوم من `reminders` أو غيّر حالته.

### الجدولة كل ساعة

بعد تخزين السر في Vault:
```sql
select vault.create_secret('نفس-قيمة-CRON_SECRET', 'tabib_cron_secret');
```
ثم عدّل `<PROJECT_REF>` في `supabase/cron.sql` ونفّذه من SQL Editor. الملف يستخدم `pg_cron` و`pg_net`. تحقق من:
```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
```

> لا تفعّل الجدولة قبل نجاح الإرسال اليدوي في وضع المعاينة ثم في وضع حقيقي برقم اختبار.

---

## 7) الأمان والخصوصية

- **RLS مفعّل على كل الجداول السريرية.** لا يمكن قراءة مريض بلا جلسة وصلاحية `patients.view`.
- **الملفات خاصة.** الروابط تُوقَّع مؤقتًا، والسياسات تتحقق من الصلاحية.
- **كلمات المرور** تُدار بواسطة Supabase Auth (bcrypt) ولا تُخزَّن في جداول التطبيق.
- **لا تُحفظ بيانات المرضى في localStorage** بعد نجاح الدخول السحابي؛ تُحذف النسخة المحلية القديمة عند أول دخول.
- **سجل تدقيق** لكل إضافة/تعديل/حذف في الجداول الحساسة.
- **service_role** يظهر فقط في الدوال/السكربت، وليس في حزمة المتصفح.
- فعّل **Point-in-Time Recovery** ونسخًا احتياطية دورية في خطة Supabase before الإنتاج.
- راجع صلاحيات الفريق دوريًا، وأوقف حساب أي موظف غادر فورًا.
- الواجهة العامة لا تعرض أسماء المرضى أو أرقامهم، فقط الأوقات المحجوزة.

### النسخ الاحتياطي والاستعادة

- من **الإعدادات → البيانات** يمكن حفظ نسخة JSON كاملة، أو استعادتها من ملف بعد معاينة عدد السجلات وتأكيد صريح.
- في Chrome/Edge الحديثة (وعلى HTTPS أو localhost) يُطلب منك اختيار **مجلد الحفظ** مباشرة، ويمكن اختيار **مجلد للاستعادة** فيعرض التطبيق أحدث نسخة `tabib-backup-*.json` بداخله (مع إمكانية اختيار ملف محدد). في المتصفحات التي لا تدعم File System Access API يُستخدم منتقي الملفات أو التنزيل العادي تلقائيًا.
- الاستعادة المحلية تستبدل البيانات المحلية بالكامل مع الاحتفاظ بحساب الدخول الحالي.
- الاستعادة السحابية تستدعي الدالة `restore-backup` ثم الدالة المعاملاتية `restore_clinic_backup`، فلا تُحذف البيانات الحالية إذا فشل أي سجل. **حسابات Auth/الصلاحيات لا تُستعاد** من الملف؛ فقط بيانات العيادة والإعدادات والملف التعريفي.
- طبّق `0003_restore_backup.sql` وانشر `restore-backup` قبل استخدام الاستعادة السحابية. الاستعادة تحتاج صلاحية `settings.edit`.
- لا تعتمد على نسخة المتصفح وحدها: فعّل نسخ Supabase الدورية وPoint-in-Time Recovery للإنتاج.

### حدود يجب معرفتها

- هذا النظام لعيادة واحدة (single-tenant)، وليس SaaS متعدد العيادات.
- المزامنة ليست لحظية، ولا توجد حماية من تعارض تعديل نفس السجل من جهازين في نفس اللحظة.
- الرسائل التي تبدأها العيادة تحتاج قالبًا معتمدًا وسياسة opt-in من المريض. نافذة الرد الحر 24 ساعة فقط.
- أسعار محادثات Meta وفئاتها تُدار من حساب WhatsApp Business وليست ضمن هذا المشروع.
- لا يمكن اختبار SQL أو الدوال دون مشروع Supabase حقيقي؛ ملفات الترحيل مرفقة لكنها غير منفذة في هذه البيئة.

---

## 8) استكشاف الأخطاء

| المشكلة | السبب المرجح | الحل |
|---|---|---|
| `Invalid login credentials` | بريد/كلمة مرور أو المستخدم غير موجود | `npm run cloud:bootstrap` ثم أعد المحاولة |
| `new row violates row-level security` | لا يوجد ملف `profiles` أو الحساب موقوف أو الصلاحية ناقصة | تحقق من `profiles.active` و`role` |
| `relation "profiles" does not exist` | لم يُنفّذ `0001_init.sql` | نفّذه من SQL Editor |
| الحجز العام يفشل | رابط/مفتاح anon خاطئ أو سياسة anon غير موجودة | نفّذ `0001_init.sql` كاملًا وتحقق من `booked_slots_range` |
| `Function not found` | الدالة لم تُنشر أو الاسم مختلف | `npx supabase functions list` |
| فشل الاستعادة السحابية | `0003_restore_backup.sql` غير مطبّق أو `restore-backup` غير منشورة | طبّق الترحيل وانشر الدالة |
| `401` من دالة | JWT منتهٍ أو الصلاحية غير كافية | أعد تسجيل الدخول؛ راجع صلاحيات الدور |
| `132000` من Meta | عدد متغيرات القالب لا يطابق الكود | راجع القسم 4 وطابق `{{n}}` |
| `131030` | رقم المستلم غير مسموح في وضع الاختبار | أضفه كرقم اختبار أو فعّل الإنتاج |
| `190` | توكن Meta منتهٍ | أنشئ System User Token دائمًا وحدّث السر |
| لا تُرسل رسائل | `WHATSAPP_DRY_RUN=true` أو القوالب غير معتمدة | راجع استجابة الدالة في سجلات Supabase |

### اختبار سريع بعد التهيئة

```bash
npm run cloud:check
```

يفحص المتغيرات، وجود الجداول، صف الإعدادات، دالة الأوقات المحجوزة، والبكتين. لا يطبع أي مفتاح.

---

## 9) خطة تشغيل مقترحة

1. أسبوع تجريبي محلي بلا بيانات مرضى حقيقية.
2. مشروع Supabase منفصل للتجربة + مستخدمون وهميون.
3. استيراد بيانات العرض واختبار الحجز العام من هاتفين.
4. نقل بيانات حقيقية محدودة، ومراجعة RLS بصلاحيات كل دور.
5. تفعيل الواتساب برقم اختبار وقوالب معتمدة.
6. تشغيل الجدولة بعد أسبوع من المراقبة اليدوية.
7. نسخ احتياطي أسبوعي + مراجعة سجل التدقيق شهريًا.
