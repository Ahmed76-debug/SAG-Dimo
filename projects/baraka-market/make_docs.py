# -*- coding: utf-8 -*-
"""Generate User Guide and Developer Guide as .docx"""
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT_USER = r"C:\Users\CONNECT\Desktop\OPEN\baraka-market\docs\User_Guide.docx"
OUT_DEV  = r"C:\Users\CONNECT\Desktop\OPEN\baraka-market\docs\Developer_Guide.docx"

BRAND = (15, 159, 104)   # #0f9f68
DARK  = (13, 27, 21)
GREY  = (69, 87, 78)

def set_rtl(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    bidi = OxmlElement('w:bidi')
    bidi.set(qn('w:val'), '1')
    pPr.append(bidi)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT

def add_rtl_run(paragraph, text, bold=False, size=11, color=None, italic=False):
    run = paragraph.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    run.font.name = 'Tahoma'
    rPr = run._element.get_or_add_rPr()
    rtl = OxmlElement('w:rtl')
    rtl.set(qn('w:val'), '1')
    rPr.append(rtl)
    if color is not None:
        run.font.color.rgb = RGBColor(*color)
    return run

def base_style(doc):
    style = doc.styles['Normal']
    style.font.name = 'Tahoma'
    style.font.size = Pt(11)
    style.paragraph_format.space_after = Pt(6)
    style.paragraph_format.line_spacing = 1.15
    # rtl for normal
    pPr = style.element.get_or_add_pPr()
    bidi = OxmlElement('w:bidi')
    bidi.set(qn('w:val'), '1')
    pPr.append(bidi)
    # section rtl
    for s in doc.sections:
        sectPr = s._sectPr
        b = OxmlElement('w:bidi')
        b.set(qn('w:val'), '1')
        sectPr.append(b)
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)

def H1(doc, text):
    p = doc.add_paragraph()
    set_rtl(p)
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.keep_with_next = True
    r = add_rtl_run(p, text, bold=True, size=16, color=BRAND)
    # bottom border
    pPr = p._p.get_or_add_pPr()
    pbdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '8')
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), '0f9f68')
    pbdr.append(bottom)
    pPr.append(pbdr)
    return p

def H2(doc, text):
    p = doc.add_paragraph()
    set_rtl(p)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    add_rtl_run(p, text, bold=True, size=13, color=DARK)
    return p

def H3(doc, text):
    p = doc.add_paragraph()
    set_rtl(p)
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    add_rtl_run(p, text, bold=True, size=11.5, color=GREY)
    return p

def para(doc, text, bold=False, size=11, space_after=6, italic=False, color=None):
    p = doc.add_paragraph()
    set_rtl(p)
    p.paragraph_format.space_after = Pt(space_after)
    add_rtl_run(p, text, bold=bold, size=size, color=color, italic=italic)
    return p

def bullet(doc, text, level=0):
    p = doc.add_paragraph()
    set_rtl(p)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.right_indent = Inches(0.25 + 0.25*level)
    p.paragraph_format.first_line_indent = Inches(-0.18)
    add_rtl_run(p, '•  ', bold=True, size=11, color=BRAND)
    add_rtl_run(p, text, size=11)
    return p

def numbered(doc, n, text):
    p = doc.add_paragraph()
    set_rtl(p)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.right_indent = Inches(0.3)
    p.paragraph_format.first_line_indent = Inches(-0.3)
    add_rtl_run(p, f'{n}.  ', bold=True, size=11, color=BRAND)
    add_rtl_run(p, text, size=11)
    return p

def make_table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ''
        p = hdr[i].paragraphs[0]
        set_rtl(p)
        add_rtl_run(p, h, bold=True, size=10, color=(255,255,255))
        # shade
        tcPr = hdr[i]._tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), '0f9f68')
        tcPr.append(shd)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ''
            p = cells[i].paragraphs[0]
            set_rtl(p)
            add_rtl_run(p, str(val), size=10)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

def add_footer(doc, text):
    for s in doc.sections:
        footer = s.footer
        p = footer.paragraphs[0]
        set_rtl(p)
        add_rtl_run(p, text, size=8, color=GREY)

def title_page(doc, title, subtitle, version="1.0"):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_rtl(p)
    p.paragraph_format.space_before = Pt(120)
    add_rtl_run(p, title, bold=True, size=26, color=BRAND)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_rtl(p)
    add_rtl_run(p, subtitle, size=13, color=GREY)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_rtl(p)
    p.paragraph_format.space_before = Pt(40)
    add_rtl_run(p, f'الإصدار {version}  •  {__import__("datetime").date.today().strftime("%Y-%m-%d")}', size=10, color=GREY)
    doc.add_page_break()

# ============================================================
# DOCUMENT 1 — USER GUIDE
# ============================================================
doc = Document()
base_style(doc)
title_page(doc, 'سوق البركة — نظام إدارة المتجر',
           'دليل المستخدم (تسجيل المدخلات)', '1.0')

H1(doc, '1. مقدمة')
para(doc, '«سوق البركة» هو نظام متكامل لإدارة المتجر (ERP + كاشير POS) يشمل: المبيعات، المشتريات، المخزون، العملاء والموردين، الخزينة، التقارير، الفروع، المستخدمين، النسخ الاحتياطي. هذا الدليل موجّه للمستخدم المبتدئ ويشرح بالتفصيل «ماذا» و«أين» و«كيف» نسجّل كل معلومة.')

H2(doc, '1.1 متطلبات التشغيل')
bullet(doc, 'متصفح حديث (Chrome/Edge/Firefox) — لا حاجة لتثبيت برامج.')
bullet(doc, 'اتصال بالشبكة (أو تشغيل محلي).')
bullet(doc, 'حساب مستخدم (اسم مستخدم + كلمة مرور).')

H2(doc, '1.2 تسجيل الدخول')
numbered(doc, 1, 'افتح الرابط (مثلاً http://localhost:4300).')
numbered(doc, 2, 'أدخل «اسم المستخدم» و«كلمة المرور».')
numbered(doc, 3, 'اضغط «تسجيل الدخول».')
numbered(doc, 4, 'للتجربة: مدير النظام dmin / admin123، وحسابات تجريبية: manager / Manager@2026، cashier / Cashier@2026، stock / Stock@2026.')
para(doc, 'بعد الدخول تظهر «لوحة التحكم» (Dashboard). القائمة الجانبية على اليمين (في Arabic RTL) تحتوي كل الصفحات.', italic=True, size=10)

H1(doc, '2. لوحة التحكم (Dashboard)')
para(doc, 'نظرة سريعة على أداء المتجر. لا توجد مدخلات هنا (عرض فقط).')
bullet(doc, 'KPIs: مبيعات اليوم، أرباح اليوم، عدد الفواتير، تنبيهات المخزون.')
bullet(doc, 'رسوم بيانية: مبيعات آخر 7/30 يوم، أفضل المنتجات.')
bullet(doc, 'تنبيهات: منتجات تحت الحد الأدنى، منتجات منتهية الصلاحية.')
bullet(doc, 'اختيار الفرع (أعلى الشاشة) لفلترة البيانات حسب الفرع.')

H1(doc, '3. الكاشير (POS)')
para(doc, 'صفحة البيع (الكاشير). المسار: #/pos. صلاحيّة pos.use.')

H2(doc, '3.1 إضافة منتج للسلة')
bullet(doc, 'مسح الباركود (USB/Bluetooth) — يُضاف المنتج تلقائياً.')
bullet(doc, 'أو البحث بالاسم/SKU في صندوق البحث، ثم النقر على المنتج.')
bullet(doc, 'أو اختيار من شبكة المنتجات (grid).')

H2(doc, '3.2 تعديل السلة')
bullet(doc, 'تغيير الكمية (+ / − أو كتابة مباشرة).')
bullet(doc, 'حذف صنف (أيقونة سلة المهملات).')
bullet(doc, 'خصم على الصنف أو على الفاتورة (نسبة/مبلغ).')

H2(doc, '3.3 إتمام البيع')
numbered(doc, 1, 'اختر العميل (اختياري) — بحث بالاسم/الهاتف.')
numbered(doc, 2, 'اختر طريقة الدفع: نقد/بطاقة/محفظة/آجل (credit).')
numbered(doc, 3, 'أدخل المبلغ المدفوع (للنقد — يحسب الباقي).')
numbered(doc, 4, 'اضغط «إتمام البيع» — تُحفظ الفاتورة ويُطبع الإيصال.')
numbered(doc, 5, 'لتعليق فاتورة: «تعليق» (Hold) — لاسترجاعها لاحقاً من قائمة «المعلّقة».')

H2(doc, '3.4 طباعة الإيصال')
bullet(doc, 'بعد البيع: نافذة طباعة تلقائية (أو زر «طباعة»).')
bullet(doc, 'حجم الورق: 80mm (thermal) — قابل للتعديل في الإعدادات.')

H1(doc, '4. المبيعات (Sales)')
para(doc, 'مسار #/sales. صلاحيّة sales.view.')
bullet(doc, 'قائمة الفواتير مع فلاتر: تاريخ، فرع، عميل، حالة.')
bullet(doc, 'عرض تفاصيل فاتورة (نقر على رقم الفاتورة).')
bullet(doc, 'مرتجع (sales.return): «إرجاع» — اختيار الأصناف والكميات — يُعاد للمخزون (إن restock).')
bullet(doc, 'تحصيل (treasury.manage): «تحصيل» — تسجيل دفعة على فاتورة آجلة.')

H1(doc, '5. المنتجات (Products)')
para(doc, 'مسار #/products. صلاحيّة products.view / products.manage.')
H2(doc, '5.1 إضافة منتج')
numbered(doc, 1, '«+ منتج جديد».')
numbered(doc, 2, 'اسم المنتج ( bắt buộc)، SKU، باركود (فريد).')
numbered(doc, 3, 'الفئة (اختياري)، الوحدة (قطعة/كغ/لتر...).')
numbered(doc, 4, 'التكلفة، سعر البيع، سعر الجملة.')
numbered(doc, 5, 'الحد الأدنى للمخزون، تاريخ الانتهاء (اختياري).')
numbered(doc, 6, 'ملاحظات → «حفظ».')

H2(doc, '5.2 فئات (Categories)')
bullet(doc, '«إدارة الفئات» — إضافة/تعديل/حذف/ترتيب (sort).')
bullet(doc, 'كل فئة: اسم، نوع (grocery/meat/produce)، لون، أيقونة.')

H2(doc, '5.3 باركود')
bullet(doc, 'أدخل باركود (EAN/Code128/QR) أو اتركه ليُولَّد تلقائياً.')
bullet(doc, 'طباعة باركود: من تفاصيل المنتج (زر «طباعة باركود»).')

H1(doc, '6. المخزون (Inventory)')
para(doc, 'مسار #/inventory. صلاحيّة inventory.view / inventory.manage.')
bullet(doc, 'عرض أرصدة كل منتج لكل فرع (products.stock = إجمالي).')
bullet(doc, 'حركات المخزون (stock_moves): بيع، شراء، تعديل، مرتجع، هدر.')
bullet(doc, 'تسوية (Adjust): إضافة/خصم كمية مع سبب (inventory.manage).')
bullet(doc, 'تنبيهات: تحت الحد الأدنى، منتهي الصلاحية.')

H1(doc, '7. المشتريات (Purchases)')
para(doc, 'مسار #/purchases. صلاحيّة purchases.view / purchases.manage.')
H2(doc, '7.1 فاتورة شراء جديدة')
numbered(doc, 1, '«+ فاتورة شراء».')
numbered(doc, 2, 'اختر المورد (أو «مورد جديد» سريعاً).')
numbered(doc, 3, 'أضف أصنافاً: بحث/باركود + كمية + تكلفة unit.')
numbered(doc, 4, 'خصم، ضريبة، المبلغ المدفوع، طريقة الدفع.')
numbered(doc, 5, '«حفظ» — يُضاف للمخزون ويُحدّث رصيد المورد.')

H1(doc, '8. العملاء والموردون (Contacts)')
para(doc, 'مسار #/contacts. صلاحيّة contacts.view / contacts.manage.')
H2(doc, '8.1 عملاء')
bullet(doc, 'إضافة: اسم، هاتف، عنوان، ملاحظات.')
bullet(doc, 'كشف حساب (Statement): حركات (مبيعات، دفعات، رصيد).')
bullet(doc, 'دفعة (Pay): تسجيل تحصيل (treasury.manage).')
H2(doc, '8.2 موردون')
bullet(doc, 'نفس الحقول + دفعة (Pay) للمورد.')

H1(doc, '9. الخزينة والورديات (Treasury)')
para(doc, 'مسار #/treasury. صلاحيّة treasury.view / treasury.manage.')
H2(doc, '9.1 ورديات (Shifts)')
bullet(doc, 'فتح وردية: نقدية افتتاحية.')
bullet(doc, 'إغلاق وردية: نقدية فعلية → النظام يحسب المتوقع والفرق.')
bullet(doc, 'عرض ورديات سابقة (فلتر بالمستخدم/التاريخ/الفرع).')
H2(doc, '9.2 مصروفات (Expenses)')
bullet(doc, 'إضافة: فئة، وصف، مبلغ، طريقة دفع، وردية (اختياري).')
bullet(doc, 'حذف (treasury.manage).')
H2(doc, '9.3 طرق الدفع')
bullet(doc, 'نقد، بطاقة، محفظة، آجل (credit).')

H1(doc, '10. التقارير (Reports)')
para(doc, 'مسار #/reports. صلاحيّة reports.view.')
bullet(doc, 'تقرير المبيعات (يومي/أسبوعي/شهري/مخصص).')
bullet(doc, 'تقرير الأرباح، أفضل المنتجات، المخزون.')
bullet(doc, 'فلاتر: تاريخ، فرع، مستخدم، فئة.')
bullet(doc, 'تصدير: Excel (.xls) و PDF (طباعة).')

H1(doc, '11. الفروع (Branches)')
para(doc, 'مسار #/branches. صلاحيّة branches.manage.')
bullet(doc, 'إضافة فرع: اسم، كود (فريد)، هاتف، عنوان.')
bullet(doc, 'تعيين فرع افتراضي (Default).')
bullet(doc, 'تفعيل/تعطيل (active).')
bullet(doc, 'حذف: soft (تعطيل) إن وُجدت بيانات؛ hard (حذف) إن لم توجد.')
bullet(doc, 'تبديل الفرع (أعلى الشاشة) لفلترة كل البيانات.')

H1(doc, '12. المستخدمون والصلاحيات (Users)')
para(doc, 'مسار #/users. صلاحيّة users.manage.')
bullet(doc, 'إضافة مستخدم: اسم، username (فريد)، كلمة مرور، دور، فرع، صلاحيات.')
bullet(doc, 'الأدوار: admin, manager, cashier, accountant, stock.')
bullet(doc, 'صلاحيات granular (18 صلاحية) — يمكن تخصيصها per user.')
bullet(doc, 'تعطيل (active=0) بدلاً من حذف.')
bullet(doc, 'إعادة تعيين كلمة مرور.')

H1(doc, '13. الإعدادات (Settings)')
para(doc, 'مسار #/settings. صلاحيّة settings.manage.')
bullet(doc, 'اسم المتجر، شعار، عنوان، هاتف، عملة، ضريبة.')
bullet(doc, 'مظهر (فاتح/داكن).')
bullet(doc, 'سياق الفرع (default branch).')
bullet(doc, 'سجل النشاط (Activity log).')

H1(doc, '14. النسخ الاحتياطي (Backup)')
para(doc, 'مسار #/backup. صلاحيّة backup.manage.')
bullet(doc, 'إنشاء نسخة: «إنشاء الآن» → يُحفظ في data/backups.')
bullet(doc, 'مجلد خارجي: تعيين مسار مطلق (D:\\Backups).')
bullet(doc, 'استعادة: اختيار نسخة → «استعادة» (يُغلق النظام ويُستبدل DB).')
bullet(doc, 'رفع نسخة (Upload): .db / .sqlite.')
bullet(doc, 'تنزيل (Download) وحذف.')
bullet(doc, 'جدولة (Auto-backup) + الاحتفاظ (Retention).')

H1(doc, '15. نصائح وFaq')
bullet(doc, 'استخدم Ctrl+K لفتح «لوحة الأوامر» (Command Palette).')
bullet(doc, 'الشريط الجانبي قابل للطي (زر ←).')
bullet(doc, 'الباركود: تأكد من focus على حقل البحث (الكاشير يستقبل الإدخال تلقائياً).')
bullet(doc, 'للطباعة: استخدم Chrome (أفضل دعم RTL).')
bullet(doc, 'نسخ احتياطي قبل أي تحديث major.')

H1(doc, 'ملحق A — اختصارات')
make_table(doc, ['اختصار', 'الوظيفة'], [
    ['Ctrl+K', 'لوحة الأوامر'],
    ['Esc', 'إغلاق نافذة'],
    ['Enter', 'تأكيد في النماذج'],
])

add_footer(doc, 'سوق البركة — دليل المستخدم v1.0')
doc.save(OUT_USER)
print('saved user guide')

# ============================================================
# DOCUMENT 2 — DEVELOPER GUIDE
# ============================================================
doc = Document()
base_style(doc)
title_page(doc, 'سوق البركة — نظام إدارة المتجر',
           'دليل المطور التقني (Architecture & Development)', '1.0')

H1(doc, '1. نظرة عامة')
para(doc, '«سوق البركة» ERP+POS built with Node.js (built-in node:sqlite) + vanilla JS SPA. Zero npm dependencies. Runs with `node server.js`. Supports branches, backup/restore, users/permissions, barcode, Excel/PDF export.')

H2(doc, '1.1 المبادئ')
bullet(doc, 'Zero dependencies: uses only Node.js built-ins (http, sqlite, crypto, fs).')
bullet(doc, 'No build step: ES modules loaded directly by browser.')
bullet(doc, 'SQLite WAL mode for concurrency.')
bullet(doc, 'Scrypt password hashing, HttpOnly session cookie + CSRF header.')

H1(doc, '2. Stack التقني')
make_table(doc, ['طبقة', 'تقنية'], [
    ['Runtime', 'Node.js 24.16+'],
    ['Database', 'node:sqlite (built-in), SQLite WAL'],
    ['HTTP', 'node:http (custom router)'],
    ['Auth', 'scrypt + session cookie (baraka_sid) + CSRF (x-csrf)'],
    ['Frontend', 'Vanilla ES modules, hash router, no bundler'],
    ['Styling', 'CSS (Cairo font, RTL, dark/light)'],
    ['Export', 'Excel (.xls HTML table + BOM), PDF (print-ready HTML)'],
    ['Barcode', 'USB/Bluetooth HID keyboard emulation'],
])

H1(doc, '3. هيكل المشروع')
para(doc, 'C:\\Users\\CONNECT\\Desktop\\OPEN\\baraka-market\\', size=10, italic=True)
make_table(doc, ['مسار', 'الوصف'], [
    ['server.js', 'Entry point — all API routes + static file serving'],
    ['lib/db.js', 'Schema, migrations, seed, helpers'],
    ['lib/auth.js', 'scrypt, sessions, permission checks'],
    ['lib/http.js', 'router helpers (add, parse, json)'],
    ['schema/001_init.sql', 'DDL (branches, product_stock, branch_id columns)'],
    ['public/index.html', 'Shell HTML, SVG sprite, RTL'],
    ['public/assets/css/app.css', 'Design system + RTL + responsive'],
    ['public/assets/js/core.js', 'State, api(), can(), helpers'],
    ['public/assets/js/app.js', 'Shell, routing, login, nav'],
    ['public/assets/js/ui.js', 'toast, modal, openForm, confirmDialog'],
    ['public/assets/js/views/*.js', 'One module per page (dashboard, pos, ...)'],
    ['data/baraka.db', 'SQLite database (created on first run)'],
    ['data/backups/', 'Local backups'],
])

H1(doc, '4. التشغيل (Development)')
numbered(doc, 1, 'تثبيت Node.js 24+.')
numbered(doc, 2, 'cd baraka-market && node server.js')
numbered(doc, 3, 'افتح http://localhost:4300')
numbered(doc, 4, 'تسجيل دخول: dmin / admin123')
para(doc, 'لإعادة DB نظيفة: أوقف الخادم، احذف مجلد data/، أعد التشغيل (seed تلقائي).', italic=True, size=10)

H1(doc, '5. قاعدة البيانات')
H2(doc, '5.1 الجداول (28 جدول)')
para(doc, 'branches, users, sessions, settings, counters, categories, products, product_stock, customers, suppliers, shifts, sales, sale_items, holds, purchases, purchase_items, returns, stock_moves, expenses, payments, activity.')
H2(doc, '5.2 فروع (Branch model)')
bullet(doc, 'products.stock = إجمالي كل الفروع.')
bullet(doc, 'product_stock(product_id, branch_id, stock) = رصيد لكل فرع.')
bullet(doc, 'branch_id في users/shifts/sales/holds/purchases/returns/stock_moves/expenses/payments.')
H2(doc, '5.3 Seed')
bullet(doc, '3 فروع: MAIN, MAADI, NASR مع توزيع المخزون.')
bullet(doc, 'مستخدمون تجريبيون: admin, manager, cashier, stock.')
bullet(doc, 'تصنيفات + منتجات تجريبية.')

H1(doc, '6. API Routes')
para(doc, 'جميع المسارات تُرجع {ok:true,...} أو {ok:false,error}. Mutations تتطلب x-csrf header + baraka_sid cookie.')
H2(doc, '6.1 Auth')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['POST', '/api/auth/login', '—', 'تسجيل دخول'],
    ['POST', '/api/auth/logout', '—', 'تسجيل خروج'],
    ['GET', '/api/auth/me', '—', 'المستخدم الحالي'],
    ['POST', '/api/auth/password', '—', 'تغيير كلمة مرور'],
])
H2(doc, '6.2 Core')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET', '/api/bootstrap', '—', 'بيانات الإقلاع (settings, user, branch)'],
    ['GET', '/api/dashboard', 'dashboard.view', 'KPIs + charts'],
    ['GET', '/api/health', '—', 'Health check'],
])
H2(doc, '6.3 Products/Categories')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET', '/api/products', 'products.view', 'قائمة (فلاتر: branch, category, search)'],
    ['GET', '/api/products/all', 'products.view', 'كل المنتجات (للكاشير)'],
    ['GET', '/api/products/lookup', 'products.view', 'بحث باركود/SKU'],
    ['POST', '/api/products', 'products.manage', 'إضافة'],
    ['PUT', '/api/products/:id', 'products.manage', 'تعديل'],
    ['DELETE', '/api/products/:id', 'products.manage', 'حذف'],
    ['POST', '/api/products/:id/adjust', 'inventory.manage', 'تسوية مخزون'],
    ['GET', '/api/categories', '—', 'قائمة فئات'],
    ['POST/PUT/DELETE', '/api/categories', 'products.manage', 'CRUD فئات'],
])
H2(doc, '6.4 Sales/POS')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET', '/api/sales', 'sales.view', 'قائمة فواتير'],
    ['GET', '/api/sales/:id', 'sales.view', 'تفاصيل فاتورة'],
    ['POST', '/api/sales', 'pos.use', 'إتمام بيع'],
    ['POST', '/api/sales/:id/return', 'sales.return', 'مرتجع'],
    ['POST', '/api/sales/:id/collect', 'treasury.manage', 'تحصيل'],
    ['GET/POST/DELETE', '/api/holds', 'pos.use', 'تعليق/استرجاع فواتير'],
])
H2(doc, '6.5 Purchases')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET', '/api/purchases', 'purchases.view', 'قائمة'],
    ['GET', '/api/purchases/:id', 'purchases.view', 'تفاصيل'],
    ['POST', '/api/purchases', 'purchases.manage', 'فاتورة شراء'],
])
H2(doc, '6.6 Contacts')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET/POST/PUT/DELETE', '/api/customers', 'contacts.*', 'CRUD عملاء'],
    ['GET', '/api/customers/:id/statement', 'contacts.view', 'كشف حساب'],
    ['POST', '/api/customers/:id/pay', 'treasury.manage', 'دفعة'],
    ['GET/POST/PUT/DELETE', '/api/suppliers', 'contacts.*', 'CRUD موردون'],
    ['POST', '/api/suppliers/:id/pay', 'treasury.manage', 'دفعة'],
])
H2(doc, '6.7 Treasury/Shifts')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET', '/api/treasury', 'treasury.view', 'ملخص'],
    ['POST', '/api/expenses', 'treasury.manage', 'مصروف'],
    ['DELETE', '/api/expenses/:id', 'treasury.manage', 'حذف مصروف'],
    ['GET', '/api/shifts', 'treasury.view', 'قائمة ورديات'],
    ['GET', '/api/shifts/current', '—', 'الوردية الحالية'],
    ['POST', '/api/shifts/open', '—', 'فتح وردية'],
    ['POST', '/api/shifts/:id/close', '—', 'إغلاق وردية'],
])
H2(doc, '6.8 Reports')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET', '/api/reports', 'reports.view', 'تقرير (params: type, from, to, branch, ...)'],
])
H2(doc, '6.9 Branches')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET', '/api/branches', '—', 'قائمة + stats'],
    ['POST', '/api/branches', 'branches.manage', 'إضافة'],
    ['PUT', '/api/branches/:id', 'branches.manage', 'تعديل'],
    ['POST', '/api/branches/:id/default', 'branches.manage', 'تعيين افتراضي'],
    ['DELETE', '/api/branches/:id', 'branches.manage', 'حذف (soft/hard)'],
])
H2(doc, '6.10 Users/Settings/Backup')
make_table(doc, ['Method', 'Path', 'Perm', 'الوصف'], [
    ['GET/POST/PUT/DELETE', '/api/users', 'users.manage', 'CRUD users'],
    ['POST', '/api/users/:id/password', 'users.manage', 'إعادة تعيين كلمة مرور'],
    ['GET/PUT', '/api/settings', 'settings.manage', 'الإعدادات'],
    ['GET', '/api/activity', 'settings.manage', 'سجل النشاط'],
    ['GET/POST', '/api/backup', 'backup.manage', 'قائمة/إنشاء'],
    ['POST', '/api/backup/folder', 'backup.manage', 'تعيين مجلد خارجي'],
    ['GET', '/api/backup/download/:name', 'backup.manage', 'تنزيل'],
    ['POST', '/api/backup/upload', 'backup.manage', 'رفع'],
    ['POST', '/api/backup/restore', 'backup.manage', 'استعادة'],
    ['DELETE', '/api/backup/:name', 'backup.manage', 'حذف'],
    ['PUT', '/api/backup/settings', 'backup.manage', 'جدولة/احتفاظ'],
])

H1(doc, '7. Frontend Architecture')
H2(doc, '7.1 State & API')
bullet(doc, 'core.js: state (user, branchId, settings, alerts), api(path, opts), can(perm), setBranch(id).')
bullet(doc, 'api() يحقن branch_id تلقائياً (query/body) حسب الفرع المختار.')
bullet(doc, 'hash router: #/dashboard, #/pos, ...')
H2(doc, '7.2 Views')
bullet(doc, 'كل view يصدّر render(viewEl, {params, route}) → cleanup fn.')
bullet(doc, 'app.js: shellHtml(), handleRoute(), startApp().')
H2(doc, '7.3 Theming')
bullet(doc, 'data-theme="light|dark" on <html>. CSS variables.')
bullet(doc, 'RTL: dir="rtl" on <html>; CSS logical properties (inline-start/end).')

H1(doc, '8. Auth & Permissions')
bullet(doc, 'Session: HttpOnly cookie baraka_sid (token). CSRF token in cookie + x-csrf header.')
bullet(doc, 'Passwords: scrypt (N=16384, r=8, p=1).')
bullet(doc, 'Permissions: 18 keys. Roles: admin (*), manager, cashier, accountant, stock (seeded).')
bullet(doc, 'can(perm) checks user.permissions array or role wildcard.')

H1(doc, '9. Branch System Design')
bullet(doc, 'Global products.stock = total across branches.')
bullet(doc, 'product_stock = per-branch quantities.')
bullet(doc, 'branch_id scoping in all queries via queryBranch(ctx).')
bullet(doc, 'Frontend auto-injects branch_id in api() calls.')
bullet(doc, 'Branch switcher in topbar; default branch on login.')

H1(doc, '10. Backup System')
bullet(doc, 'Server-side copy to data/backups (timestamped .db).')
bullet(doc, 'Configurable absolute folder (backup/folder).')
bullet(doc, 'Upload (.db/.sqlite), download, delete, restore.')
bullet(doc, 'Auto-backup (interval) + retention (N copies).')
bullet(doc, 'Restore: replaces DB file, restarts connection.')

H1(doc, '11. Development Roadmap (خطوات)')
numbered(doc, 1, 'إعداد البيئة: Node 24+, clone, node server.js.')
numbered(doc, 2, 'استكشاف DB: schema/001_init.sql, seed in lib/db.js.')
numbered(doc, 3, 'إضافة endpoint: add() in server.js + permission.')
numbered(doc, 4, 'إضافة view: create views/x.js exporting render(); register in app.js NAV + ROUTES.')
numbered(doc, 5, 'State: extend core.js state + api injection.')
numbered(doc, 6, 'Styling: add CSS in app.css (use variables).')
numbered(doc, 7, 'Branch awareness: filter by branch_id in queries + frontend.')
numbered(doc, 8, 'Permissions: add to PERMISSIONS + seedRolePermissions().')
numbered(doc, 9, 'Backup compatibility: ensure new tables included in backup (auto).')
numbered(doc, 10, 'Testing: manual E2E + browser automation.')
numbered(doc, 11, 'Deployment: see DEPLOY.md (Node host / local PC).')

H1(doc, '12. Conventions & Best Practices')
bullet(doc, 'No external deps — keep zero-dependency.')
bullet(doc, 'Use parameterized SQL (no string concat).')
bullet(doc, 'Validate input server-side; return {ok:false,error}.')
bullet(doc, 'Mutations: require CSRF header.')
bullet(doc, 'Activity log for sensitive actions.')
bullet(doc, 'Soft delete (active=0) where data exists.')
bullet(doc, 'Use logical CSS properties (inline-start/end) for RTL.')

H1(doc, '13. Deployment')
bullet(doc, 'Local PC: node server.js (port 4300).')
bullet(doc, 'Host: Node.js hosting with persistent filesystem (for SQLite).')
bullet(doc, 'Env: PORT (optional), DATA_DIR (optional).')
bullet(doc, 'Backup before upgrade: /backup → create + download.')

add_footer(doc, 'سوق البركة — دليل المطور v1.0')
doc.save(OUT_DEV)
print('saved dev guide')
print('DONE')
