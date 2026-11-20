# -*- coding: utf-8 -*-
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

doc = Document()

# Set default font
style = doc.styles['Normal']
font = style.font
font.name = 'Arial'
font.size = Pt(11)

# Cover
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('\n\n\n\n')
r = p.add_run('دليل المطور التقني')
r.bold = True
r.font.size = Pt(36)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('بنية ومسار تطوير منصة عدالة خطوة بخطوة\n')
r.font.size = Pt(22)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('مبني على كود المشروع الفعلي\n\n\n')
r.font.size = Pt(16)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('منصة عدالة لإدارة أعمال المحاماة\n\n')
r.font.size = Pt(18)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('الإصدار ١٫٠\n')
r.font.size = Pt(14)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('أكتوبر ٢٠٢٦')
r.font.size = Pt(14)

doc.add_page_break()

# 1. هدف الدليل
doc.add_heading('١. هدف الدليل', level=1)
doc.add_paragraph('يهدف هذا الدليل إلى شرح بنية منصة عدالة برمجياً، وتوزيع الملفات والمجلدات، ونظام التوجيه، والمصادقة والصلاحيات، وطبقة البيانات، وكيفية إضافة ميزات جديدة خطوة بخطوة مع الإشارة المباشرة للملفات الفعلية في المشروع.')
doc.add_paragraph('هذا الدليل موجه حصرياً للمطور التقني، وليس للمستخدم النهائي.')

# 2. نظرة عامة
doc.add_heading('٢. نظرة عامة على المشروع', level=1)
doc.add_paragraph('منصة عدالة هي نظام متكامل لإدارة أعمال المحاماة، يعمل بنمط Local-First. جميع البيانات تُخزن محلياً في IndexedDB باستخدام مكتبة Dexie. تم تصميم النظام لسهولة التحويل مستقبلاً إلى Backend عبر نمط Repository.')

doc.add_heading('٢.١. التقنيات المستخدمة', level=2)
for tech in ['Vite ٨ + React ١٩ + TypeScript ٥.٩', 'Tailwind CSS v٤', 'React Router DOM v٧', 'Dexie ٤ + dexie-react-hooks', 'lucide-react', 'html2canvas + jsPDF']:
    doc.add_paragraph(tech, style='List Bullet')

# 3. إعداد بيئة التطوير
doc.add_heading('٣. إعداد بيئة التطوير', level=1)
doc.add_heading('٣.١. المتطلبات', level=2)
for req in ['Node.js ١٨ أو أحدث', 'npm أو pnpm', 'Visual Studio Code']:
    doc.add_paragraph(req, style='List Bullet')

doc.add_heading('٣.٢. تثبيت وتشغيل المشروع', level=2)
p = doc.add_paragraph()
p.add_run('cd adala-platform\nnpm install\nnpm run dev').font.name = 'Courier New'

doc.add_heading('٣.٣. فحص وبناء المشروع', level=2)
p = doc.add_paragraph()
p.add_run('npx tsc --noEmit\nnpm run build\nnpm run preview').font.name = 'Courier New'

# 4. هيكل المشروع
doc.add_heading('٤. هيكل المشروع الفعلي', level=1)
doc.add_paragraph('المسار الرئيسي: adala-platform/src/')

doc.add_heading('٤.١. ملفات الجذر', level=2)
doc.add_paragraph('main.tsx: نقطة الدخول، استدعاء ensureSeed()، تسجيل Service Worker في الإنتاج', style='List Bullet')
doc.add_paragraph('App.tsx: تعريف Router، حمايات المسارات (RequireAuth / RequirePermission)، فصل المسارات العامة عن المحمية', style='List Bullet')
doc.add_paragraph('index.css: متغيرات الثيم والتنسيقات العامة', style='List Bullet')

doc.add_heading('٤.٢. مجلد lib/', level=2)
doc.add_paragraph('types.ts: تعريفات جميع الكيانات (User, Client, Matter, Agreement, Payment, Task, LegalEvent, LegalDocument, LibraryItem, PortfolioContent, Settings...)', style='List Bullet')
doc.add_paragraph('db.ts: فئة AdalaDB، تعريف الجداول، دوال مساعدة (uid, nowISO, logActivity)، نمط repo، إدارة الملفات (saveFile/getFile/deleteFile)، النسخ الاحتياطي', style='List Bullet')
doc.add_paragraph('seed.ts: بيانات أولية ودالة ensureSeed() لتهيئة IndexedDB لأول مرة', style='List Bullet')
doc.add_paragraph('permissions.ts: تعريف الصلاحيات والأدوار', style='List Bullet')
doc.add_paragraph('auth.ts: منطق المصادقة', style='List Bullet')
doc.add_paragraph('pdf.ts: تصدير PDF باستخدام html2canvas + jsPDF', style='List Bullet')
doc.add_paragraph('print.ts: الطباعة المباشرة', style='List Bullet')
doc.add_paragraph('format.ts: تنسيق التواريخ والأرقام', style='List Bullet')
doc.add_paragraph('cn.ts: دمج classes', style='List Bullet')

doc.add_heading('٤.٣. مجلد state/', level=2)
doc.add_paragraph('AppProvider.tsx: سياق التطبيق، إدارة الجلسة، الثيم، الإعدادات، دوال login/logout/can/updateSettings', style='List Bullet')

doc.add_heading('٤.٤. مجلد components/', level=2)
doc.add_paragraph('layout/AppShell.tsx: القالب الرئيسي، القائمة الجانبية، رأس الصفحة، درج الجوال، فلترة عناصر القائمة حسب الصلاحيات', style='List Bullet')
doc.add_paragraph('ui/: مكونات واجهة موحدة (primitives.tsx, overlays.tsx, data-table.tsx)', style='List Bullet')
doc.add_paragraph('common/: مكونات مشتركة', style='List Bullet')
doc.add_paragraph('forms/: مكونات النماذج', style='List Bullet')

doc.add_heading('٤.٥. مجلد pages/', level=2)
doc.add_paragraph('يحتوي على جميع صفحات التطبيق: Dashboard, Clients, Matters, MatterDetail, Tasks, Calendar, Documents, Archive, Library, Reports, Users, Settings, Portfolio, PortfolioAdmin, PrintCenter, Login', style='List Bullet')

# 5. التوجيه والحمايات
doc.add_heading('٥. التوجيه، الحمايات، والمسارات', level=1)
doc.add_heading('٥.١. الحمايات في App.tsx', level=2)
doc.add_paragraph('RequireAuth: يتحقق من وجود جلسة صالحة، وإلا يحوّل إلى /login', style='List Bullet')
doc.add_paragraph('RequirePermission: يتحقق من الصلاحية المطلوبة، ويعرض صفحة "لا تملك صلاحية الوصول" عند عدم توفرها', style='List Bullet')
doc.add_paragraph('LoginRoute: إذا كان المستخدم مسجلاً يحوّل إلى /', style='List Bullet')
doc.add_paragraph('ScrollToTop: يعيد التمرير لأعلى عند تغيير المسار', style='List Bullet')

doc.add_heading('٥.٢. تقسيم المسارات', level=2)
doc.add_paragraph('المسارات العامة: /login و/portfolio - خارج RequireAuth', style='List Bullet')
doc.add_paragraph('المسارات المحمية: جميع المسارات الأخرى داخل RequireAuth + AppShell', style='List Bullet')
doc.add_paragraph('/portfolio/manage: محمي بـ RequirePermission ويحتاج صلاحية portfolio.edit', style='List Bullet')

# 6. طبقة البيانات
doc.add_heading('٦. طبقة البيانات (Dexie + IndexedDB)', level=1)
doc.add_heading('٦.١. db.ts', level=2)
doc.add_paragraph('يُعرّف class AdalaDB يمتد من Dexie مع اسم قاعدة البيانات "adala_legal_suite". الإصدار ١ يحدد مخطط الجداول والفهارس.')
doc.add_paragraph('يتم تصدير مثيل وحيد: export const db = new AdalaDB()')

doc.add_heading('٦.٢. الجداول الرئيسية', level=2)
for table in ['users', 'clients', 'matters', 'matterTypes', 'agreements', 'payments', 'tasks', 'events', 'documents', 'files', 'notes', 'library', 'templates', 'activity', 'notifications', 'settings', 'portfolio']:
    doc.add_paragraph(table, style='List Bullet')

doc.add_heading('٦.٣. دوال مساعدة', level=2)
doc.add_paragraph('uid(prefix): توليد معرف فريد', style='List Bullet')
doc.add_paragraph('nowISO(): الحصول على التاريخ والوقت بصيغة ISO', style='List Bullet')
doc.add_paragraph('logActivity(): تسجيل النشاط مع تقليص السجل تلقائياً عند تجاوزه ٦٠٠ عنصر', style='List Bullet')
doc.add_paragraph('repo<T>(): نمط Repository موحد للعمليات CRUD', style='List Bullet')
doc.add_paragraph('saveFile/getFile/deleteFile: إدارة الملفات كـ Blob داخل IndexedDB', style='List Bullet')
doc.add_paragraph('exportBackup/importBackup: نسخ احتياطي واستعادة', style='List Bullet')
doc.add_paragraph('wipeLocalData(): مسح كامل قاعدة البيانات', style='List Bullet')

# 7. البورتفوليو
doc.add_heading('٧. نظام البورتفوليو العام والتحكم فيه', level=1)
doc.add_heading('٧.١. صفحة البورتفوليو العام (Portfolio.tsx)', level=2)
doc.add_paragraph('المسار: /portfolio - مفتوح للجميع بدون تسجيل دخول', style='List Bullet')
doc.add_paragraph('يقرأ المحتوى من db.portfolio وبيانات المكتب من settings.profile', style='List Bullet')
doc.add_paragraph('يدعم عرض صورة المحامي بجوار الاسم في الترويسة، أو ككرت جانبي ثابت على الشاشات الكبيرة (lg+)', style='List Bullet')
doc.add_paragraph('يحتوي على أزرار مستقلة للطباعة وPDF', style='List Bullet')
doc.add_paragraph('لا تظهر أي أزرار تعديل للجمهور', style='List Bullet')

doc.add_heading('٧.٢. محرر البورتفوليو (PortfolioAdmin.tsx)', level=2)
doc.add_paragraph('المسار: /portfolio/manage داخل لوحة التحكم', style='List Bullet')
doc.add_paragraph('يحتاج صلاحية portfolio.edit محمي بـ RequirePermission', style='List Bullet')
doc.add_paragraph('يمكن رفع صورة المحامي، استبدالها، أو حذفها من تبويب "الواجهة"', style='List Bullet')
doc.add_paragraph('يمكن تعديل اسم المحامي واسم المكتب الظاهرين في البورتفوليو العام', style='List Bullet')
doc.add_paragraph('يُحفظ التعديل في db.portfolio مع تحديث updatedAt', style='List Bullet')

# 8. إضافة ميزة جديدة
doc.add_heading('٨. إضافة ميزة جديدة خطوة بخطوة', level=1)
doc.add_paragraph('اتبع هذا التسلسل بالترتيب لضمان عدم كسر البنية الحالية:')

doc.add_heading('٨.١. الخطوات العملية', level=2)
for i, step in enumerate(['١. types.ts: أضف تعريف النوع/Interface للكيان الجديد', '٢. db.ts: أضف الجدول في AdalaDB إن لزم الأمر، وأضف repo جاهز', '٣. permissions.ts: أضف الصلاحيات المطلوبة (view/create/edit/delete) وربطها بالأدوار', '٤. pages/: أنشئ صفحة جديدة باتباع نمط الصفحات الموجودة (PageHeader, PageBody, جداول, نماذج)', '٥. App.tsx: أضف import وRoute داخل المسارات المحمية مع RequireAuth وRequirePermission', '٦. components/layout/AppShell.tsx: أضف عنصر للقائمة الجانبية مع الأيقونة والمسار والصلاحية', '٧. اختبار: شغّل npx tsc --noEmit ثم npm run dev واختبر الوظيفة والصلاحيات'], 1):
    doc.add_paragraph(step, style='List Number')

doc.add_heading('٨.٢. نصائح مهمة', level=2)
doc.add_paragraph('انسخ صفحة مشابهة للميزة المراد إضافتها وعدّلها', style='List Bullet')
doc.add_paragraph('استخدم useLiveQuery لربط البيانات مع الواجهة', style='List Bullet')
doc.add_paragraph('استخدم مكونات UI الموحدة من components/ui/', style='List Bullet')
doc.add_paragraph('سجّل الأحداث الحساسة بـ logActivity', style='List Bullet')
doc.add_paragraph('احترم نظام الصلاحيات في كل إجراء', style='List Bullet')

# 9. البناء والنشر
doc.add_heading('٩. البناء، الفحص، والنشر', level=1)
doc.add_heading('٩.١. فحص وبناء', level=2)
p = doc.add_paragraph()
p.add_run('npx tsc --noEmit\nnpm run build\nnpm run preview').font.name = 'Courier New'

doc.add_heading('٩.٢. إعداد SPA Fallback للنشر', level=2)
doc.add_paragraph('نظرًا لاستخدام React Router، يجب إعادة توجيه جميع الطلبات إلى index.html عند رفع مجلد dist/')

doc.add_heading('٩.٢.١. Apache (.htaccess)', level=3)
p = doc.add_paragraph()
p.add_run('RewriteEngine On\nRewriteBase /\nRewriteRule ^index\\.html$ - [L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.html [L]').font.name = 'Courier New'

doc.add_heading('٩.٢.٢. Nginx', level=3)
p = doc.add_paragraph()
p.add_run('try_files $uri $uri/ /index.html;').font.name = 'Courier New'

doc.add_heading('٩.٢.٣. Netlify/Vercel', level=3)
p = doc.add_paragraph()
p.add_run('/* /index.html 200').font.name = 'Courier New'

# 10. ملحق
doc.add_heading('١٠. ملحق', level=1)
doc.add_heading('١٠.١. ملفات حرجة لا يجب تعديلها بدون فهم كامل', level=2)
for f in ['src/App.tsx', 'src/main.tsx', 'src/state/AppProvider.tsx', 'src/components/layout/AppShell.tsx', 'src/lib/db.ts', 'src/lib/seed.ts', 'src/lib/permissions.ts', 'src/lib/types.ts']:
    doc.add_paragraph(f, style='List Bullet')

doc.add_heading('١٠.٢. بيانات الدخول الافتراضية', level=2)
p = doc.add_paragraph()
p.add_run('اسم المستخدم: admin\nكلمة المرور: admin123').font.name = 'Courier New'

doc.add_heading('١٠.٣. قائمة تحقق قبل النشر', level=2)
for item in ['[ ] يمر npx tsc --noEmit بدون أخطاء', '[ ] ينجح npm run build', '[ ] اختبار المسارات العامة /portfolio و/login', '[ ] اختبار المسارات المحمية مع الصلاحيات', '[ ] فحص البورتفوليو العام ومحرره', '[ ] فحص تصدير PDF والطباعة', '[ ] إعداد SPA Fallback جاهز']:
    doc.add_paragraph(item, style='List Bullet')

doc.add_paragraph('\n\nنهاية الدليل')

doc.save(r'C:\Users\CONNECT\Documents\Default Project\adala-platform\دليل المطور التقني - بنية ومسار تطوير منصة عدالة خطوة بخطوة.docx')
print('done')
