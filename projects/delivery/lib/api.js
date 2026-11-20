/* ============================================================
   طلباتك — API layer: generic CRUD registry + store + reports
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { all, one, run, nowISO, today, money, hash, addMove, postJournal, audit, nextCode, DATA_DIR, DB_PATH, DB_KIND, db } = require("./db");
const { barcodeSVG } = require("./barcode");

/* ---------------------------------------------------------- registry */
const RESOURCES = {
  company: {
    table: "company", single: true, perm: "settings", title: "بيانات الشركة",
    fields: [
      { name: "name", label: "اسم الشركة", type: "text", required: true },
      { name: "logo", label: "شعار الشركة", type: "image" },
      { name: "phone", label: "الهاتف", type: "text" },
      { name: "email", label: "البريد الإلكتروني", type: "text" },
      { name: "address", label: "العنوان", type: "textarea" },
      { name: "currency", label: "العملة", type: "text" },
      { name: "delivery_fee", label: "قيمة التوصيل", type: "number" },
      { name: "tax_percent", label: "نسبة الضريبة ٪", type: "number" },
      { name: "tax_enabled", label: "تفعيل الضريبة", type: "switch" },
      { name: "working_hours", label: "ساعات العمل", type: "text" },
      { name: "about", label: "نبذة عن الشركة", type: "textarea" },
      { name: "facebook", label: "فيسبوك", type: "text" },
      { name: "instagram", label: "إنستجرام", type: "text" },
    ],
  },
  zones: {
    table: "zones", perm: "zones", title: "مناطق التوصيل", orderBy: "sort_order",
    search: ["name", "notes"],
    extra: { _oc: "(SELECT COUNT(*) FROM orders o WHERE o.zone_id=zones.id)", _cc: "(SELECT COUNT(*) FROM customers c WHERE c.zone_id=zones.id)" },
    fields: [
      { name: "name", label: "المنطقة / الحي", type: "text", required: true },
      { name: "fee", label: "رسوم التوصيل (ج.م)", type: "number", required: true, default: 25 },
      { name: "eta", label: "مدة التوصيل التقريبية", type: "text" },
      { name: "sort_order", label: "الترتيب", type: "number", default: 0 },
      { name: "notes", label: "ملاحظات للمندوب", type: "textarea" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  units: {
    table: "units", perm: "units", title: "وحدات القياس", orderBy: "sort_order",
    search: ["name", "symbol"],
    extra: { _pc: "(SELECT COUNT(*) FROM products p WHERE p.unit_id=units.id)" },
    fields: [
      { name: "name", label: "اسم الوحدة", type: "text", required: true },
      { name: "symbol", label: "الرمز المختصر", type: "text" },
      { name: "allow_fraction", label: "تقبل كسورًا (مثل ١.٥ كجم)", type: "switch", default: 1 },
      { name: "sort_order", label: "الترتيب", type: "number", default: 0 },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  branches: {
    table: "branches", perm: "branches", title: "الفروع", orderBy: "id",
    search: ["name", "address", "phone"],
    fields: [
      { name: "name", label: "اسم الفرع", type: "text", required: true },
      { name: "address", label: "العنوان", type: "textarea", required: true },
      { name: "phone", label: "الهاتف", type: "text" },
      { name: "manager", label: "مدير الفرع", type: "text" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  users: {
    table: "users", perm: "users", title: "المستخدمون", orderBy: "id",
    search: ["name", "email", "phone"],
    fields: [
      { name: "name", label: "الاسم", type: "text", required: true },
      { name: "email", label: "البريد الإلكتروني", type: "text", required: true },
      { name: "phone", label: "الهاتف", type: "text" },
      { name: "password", label: "كلمة المرور", type: "password" },
      { name: "role", label: "الدور", type: "select", options: [["admin", "مدير عام (كل الصلاحيات)"], ["staff", "موظف (صلاحيات محددة)"]], default: "staff" },
      { name: "branch_id", label: "الفرع", type: "select", resource: "branches", label_field: "name" },
      { name: "permissions", label: "الصلاحيات", type: "permissions" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  pilots: {
    table: "pilots", perm: "pilots", title: "الطيارون / مندوبو التوصيل", orderBy: "id",
    search: ["name", "phone", "vehicle"],
    fields: [
      { name: "name", label: "الاسم", type: "text", required: true },
      { name: "phone", label: "الهاتف", type: "text", required: true },
      { name: "vehicle", label: "وسيلة التوصيل", type: "text" },
      { name: "plate", label: "رقم اللوحة", type: "text" },
      { name: "branch_id", label: "الفرع", type: "select", resource: "branches", label_field: "name" },
      { name: "rating", label: "التقييم", type: "number" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
    columns: ["name", "phone", "vehicle", "rating", "orders", "active"],
  },
  suppliers: {
    table: "suppliers", perm: "suppliers", title: "الموردون", orderBy: "id",
    search: ["name", "phone", "address"],
    fields: [
      { name: "name", label: "اسم المورد", type: "text", required: true },
      { name: "phone", label: "الهاتف", type: "text" },
      { name: "address", label: "العنوان", type: "textarea" },
      { name: "notes", label: "ملاحظات", type: "textarea" },
      { name: "balance", label: "الرصيد (دائن)", type: "readonly" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  customers: {
    table: "customers", perm: "customers", title: "العملاء", orderBy: "id",
    search: ["name", "phone", "address"],
    fields: [
      { name: "name", label: "الاسم", type: "text", required: true },
      { name: "phone", label: "رقم الهاتف", type: "text", required: true },
      { name: "address", label: "العنوان", type: "textarea" },
      { name: "zone_id", label: "منطقة التوصيل", type: "select", resource: "zones", label_field: "name" },
      { name: "points", label: "النقاط", type: "readonly" },
      { name: "total_spent", label: "إجمالي المشتريات", type: "readonly" },
      { name: "orders_count", label: "عدد الطلبات", type: "readonly" },
      { name: "rating", label: "التقييم", type: "number" },
      { name: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  categories: {
    table: "categories", perm: "categories", title: "الأقسام الرئيسية", orderBy: "sort_order",
    search: ["name"],
    fields: [
      { name: "name", label: "اسم القسم", type: "text", required: true },
      { name: "description", label: "الوصف", type: "textarea" },
      { name: "image", label: "صورة القسم", type: "image" },
      { name: "sort_order", label: "الترتيب", type: "number", default: 0 },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  products: {
    table: "products", perm: "products", title: "الأصناف", orderBy: "id",
    search: ["name", "barcode"],
    fields: [
      { name: "category_id", label: "القسم", type: "select", resource: "categories", label_field: "name", required: true },
      { name: "name", label: "اسم الصنف", type: "text", required: true },
      { name: "image", label: "صورة الصنف", type: "image" },
      { name: "description", label: "الوصف", type: "textarea" },
      { name: "price", label: "سعر البيع", type: "number", required: true },
      { name: "cost", label: "سعر التكلفة", type: "number" },
      { name: "unit_id", label: "وحدة القياس", type: "select", resource: "units", label_field: "name" },
      { name: "barcode", label: "الباركود", type: "text" },
      { name: "stock", label: "الرصيد", type: "readonly" },
      { name: "min_stock", label: "حد الطلب", type: "number", default: 5 },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  inventory_moves: {
    table: "inventory_moves", perm: "inventory", title: "حركات المخزون", orderBy: "id",
    search: ["ref", "note"], label: "name",
    fields: [
      { name: "product_id", label: "الصنف", type: "select", resource: "products", label_field: "name", required: true },
      { name: "branch_id", label: "الفرع", type: "select", resource: "branches", label_field: "name" },
      { name: "type", label: "نوع الحركة", type: "select", options: [["purchase", "شراء"], ["sale", "بيع"], ["adjust", "تسوية"], ["in", "إضافة"], ["out", "صرف"], ["count", "جرد"]], required: true },
      { name: "qty", label: "الكمية (بالسالب للصرف)", type: "number", required: true },
      { name: "date", label: "التاريخ", type: "date", default: () => today() },
      { name: "ref", label: "المرجع", type: "text" },
      { name: "note", label: "ملاحظات", type: "textarea" },
    ],
  },
  purchases: {
    table: "purchases", perm: "purchases", title: "المشتريات", orderBy: "id", special: "purchases",
    search: ["note", "warehouse"],
    fields: [
      { name: "supplier_id", label: "المورد", type: "select", resource: "suppliers", label_field: "name", required: true },
      { name: "date", label: "التاريخ", type: "date", required: true },
      { name: "payment_method_id", label: "وسيلة الدفع", type: "select", resource: "payment_methods", label_field: "name" },
      { name: "warehouse", label: "المستودع", type: "text" },
      { name: "total", label: "الإجمالي", type: "readonly" },
      { name: "paid", label: "المدفوع", type: "number", default: 0 },
      { name: "status", label: "الحالة", type: "select", options: [["draft", "مسودة"], ["approved", "معتمد"], ["cancelled", "ملغي"]], default: "draft" },
      { name: "note", label: "ملاحظات", type: "textarea" },
    ],
  },
  payment_methods: {
    table: "payment_methods", perm: "payment_methods", title: "وسائل الدفع", orderBy: "sort_order",
    search: ["name", "pay_number", "pay_bank"],
    extra: {
      _proofs: "(SELECT COUNT(*) FROM payment_proofs pp WHERE pp.method_id=payment_methods.id)",
      _pending: "(SELECT COUNT(*) FROM payment_proofs pp WHERE pp.method_id=payment_methods.id AND pp.status='pending')",
    },
    fields: [
      { name: "name", label: "الاسم الظاهر للعميل", type: "text", required: true },
      { name: "kind", label: "النوع", type: "select", options: [["cash", "كاش عند الاستلام"], ["wallet", "محفظة إلكترونية"], ["online", "تحويل بنكي / أونلاين"], ["card", "بطاقة / بوابة دفع"]], default: "cash" },
      { name: "pay_number", label: "رقم المحفظة / رقم الحساب", type: "text", hint: "الرقم الذي يحوّل عليه العميل — يظهر له بوضوح في صفحة الدفع" },
      { name: "pay_holder", label: "اسم صاحب الحساب", type: "text" },
      { name: "pay_bank", label: "البنك / مزوّد المحفظة", type: "text" },
      { name: "pay_link", label: "لينك الدفع (اختياري)", type: "text" },
      { name: "pay_instructions", label: "تعليمات للعميل", type: "textarea" },
      { name: "requires_proof", label: "يطلب إثبات تحويل من العميل", type: "switch", default: 1 },
      { name: "sort_order", label: "الترتيب", type: "number", default: 0 },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
    beforeCreate: data => { if (data.kind === "cash") data.requires_proof = 0; },
    beforeUpdate: (data, body, row) => { if (row.kind === "cash" || data.kind === "cash") data.requires_proof = 0; },
    beforeDelete: row => {
      const oc = one("SELECT COUNT(*) c FROM orders WHERE payment_method_id=?", row.id).c;
      if (oc) throw new Error(`لا يمكن حذف «${row.name}» — مستخدمة في ${oc} طلب. أوقفها بدل ذلك.`);
      run("DELETE FROM payment_proofs WHERE method_id=?", row.id);
    },
  },
  payment_proofs: {
    table: "payment_proofs", perm: "payment_proofs", title: "إثباتات الدفع", orderBy: "id",
    search: ["txn_ref", "note", "method_name"],
    extra: {
      _order: "(SELECT o.code FROM orders o WHERE o.id=payment_proofs.order_id)",
      _customer: "(SELECT c.name FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=payment_proofs.order_id)",
    },
    fields: [
      { name: "order_id", label: "الطلب", type: "select", resource: "orders", label_field: "code", required: true },
      { name: "method_name", label: "وسيلة الدفع", type: "text" },
      { name: "amount", label: "المبلغ المحوَّل", type: "number" },
      { name: "txn_ref", label: "رقم العملية / المرجع", type: "text" },
      { name: "paid_at", label: "تاريخ التحويل", type: "date" },
      { name: "note", label: "ملاحظات العميل", type: "textarea" },
      { name: "image", label: "صورة إشعار التحويل", type: "image" },
      { name: "status", label: "الحالة", type: "select", options: [["pending", "قيد المراجعة"], ["approved", "مقبول"], ["rejected", "مرفوض"]], default: "pending" },
      { name: "reject_reason", label: "سبب الرفض", type: "textarea" },
    ],
  },
  orders: {
    table: "orders", perm: "orders", title: "الأوردرات", orderBy: "id", special: "orders",
    search: ["code", "address", "phone"],
    fields: [
      { name: "code", label: "رقم الطلب", type: "text" },
      { name: "customer_id", label: "العميل", type: "select", resource: "customers", label_field: "name", required: true },
      { name: "branch_id", label: "الفرع", type: "select", resource: "branches", label_field: "name" },
      { name: "pilot_id", label: "الطيار", type: "select", resource: "pilots", label_field: "name" },
      { name: "payment_method_id", label: "وسيلة الدفع", type: "select", resource: "payment_methods", label_field: "name" },
      { name: "status", label: "الحالة", type: "select", options: [["new", "جديد"], ["confirmed", "تم التأكيد"], ["preparing", "قيد التجهيز"], ["delivering", "في التوصيل"], ["delivered", "تم التسليم"], ["cancelled", "ملغي"]], default: "new" },
      { name: "subtotal", label: "الإجمالي قبل الخصم", type: "number" },
      { name: "discount", label: "الخصم", type: "number" },
      { name: "delivery_fee", label: "التوصيل", type: "number" },
      { name: "zone_id", label: "منطقة التوصيل", type: "select", resource: "zones", label_field: "name" },
      { name: "tax", label: "الضريبة", type: "number" },
      { name: "total", label: "الإجمالي", type: "number" },
      { name: "paid", label: "السداد", type: "select", options: [["unpaid", "غير مدفوع"], ["paid", "مدفوع"]], default: "unpaid" },
      { name: "address", label: "عنوان التوصيل", type: "textarea" },
      { name: "phone", label: "الهاتف", type: "text" },
      { name: "note", label: "ملاحظات", type: "textarea" },
      { name: "rating", label: "تقييم العميل", type: "number" },
    ],
  },
  promotions: {
    table: "promotions", perm: "promotions", title: "العروض والخصومات", orderBy: "id",
    search: ["name", "code"],
    fields: [
      { name: "name", label: "اسم العرض", type: "text", required: true },
      { name: "kind", label: "نوع الخصم", type: "select", options: [["percent", "نسبة مئوية ٪"], ["fixed", "قيمة ثابتة"]], default: "percent" },
      { name: "value", label: "قيمة الخصم", type: "number", required: true },
      { name: "code", label: "كود الخصم", type: "text" },
      { name: "start_at", label: "من تاريخ", type: "date" },
      { name: "end_at", label: "إلى تاريخ", type: "date" },
      { name: "min_order", label: "الحد الأدنى للاستخدام", type: "number", default: 0 },
      { name: "category_id", label: "قسم محدد (اختياري)", type: "select", resource: "categories", label_field: "name" },
      { name: "used_count", label: "مرات الاستخدام", type: "readonly" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  rewards: {
    table: "rewards", perm: "rewards", title: "الهدايا والجوائز للعملاء", orderBy: "id",
    search: ["note"],
    fields: [
      { name: "customer_id", label: "العميل", type: "select", resource: "customers", label_field: "name", required: true },
      { name: "kind", label: "النوع", type: "select", options: [["discount", "خصم"], ["gift", "هدية"]], default: "discount" },
      { name: "value", label: "القيمة", type: "number", required: true },
      { name: "note", label: "الوصف", type: "textarea" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  ads: {
    table: "ads", perm: "ads", title: "الإعلانات المدفوعة", orderBy: "id",
    search: ["title", "link"],
    fields: [
      { name: "title", label: "عنوان الإعلان", type: "text", required: true },
      { name: "image", label: "صورة الإعلان", type: "image" },
      { name: "link", label: "الرابط", type: "text" },
      { name: "position", label: "الموضع", type: "select", options: [["home", "الرئيسية"], ["strip", "شريط جانبي"], ["popup", "نافذة منبثقة"]], default: "home" },
      { name: "start_at", label: "من تاريخ", type: "date" },
      { name: "end_at", label: "إلى تاريخ", type: "date" },
      { name: "clicks", label: "النقرات", type: "readonly" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  accounts: {
    table: "accounts", perm: "accounting", title: "دليل الحسابات", orderBy: "code",
    search: ["code", "name"],
    fields: [
      { name: "code", label: "كود الحساب", type: "text", required: true },
      { name: "name", label: "اسم الحساب", type: "text", required: true },
      { name: "type", label: "النوع", type: "select", options: [["asset", "أصول"], ["liability", "خصوم"], ["equity", "حقوق ملكية"], ["revenue", "إيرادات"], ["expense", "مصروفات"]], required: true },
      { name: "parent_id", label: "الحساب الأب", type: "select", resource: "accounts", label_field: "name" },
      { name: "kind", label: "تصنيف خاص", type: "select", options: [["normal", "عادي"], ["cash", "خزينة"], ["bank", "بنك"], ["customer", "عملاء"], ["supplier", "موردون"], ["inventory", "مخزون"]], default: "normal" },
      { name: "balance", label: "الرصيد", type: "readonly" },
      { name: "is_system", label: "حساب نظام", type: "switch", default: 0 },
    ],
  },
  journals: {
    table: "journals", perm: "accounting", title: "دفتر اليومية", orderBy: "id", special: "journals",
    search: ["memo"],
    fields: [
      { name: "date", label: "التاريخ", type: "date", required: true },
      { name: "memo", label: "البيان", type: "text", required: true },
      { name: "ref_type", label: "نوع المستند", type: "select", options: [["", "يدوي"], ["order", "طلب"], ["purchase", "مشتريات"], ["voucher", "سند"], ["stock_count", "جرد"], ["expense", "مصروف"], ["opening", "رصيد افتتاحي"]], default: "" },
      { name: "approved", label: "معتمد", type: "switch", default: 1 },
    ],
  },
  cash_accounts: {
    table: "cash_accounts", perm: "cash", title: "الخزائن والبنوك", orderBy: "id",
    search: ["name", "holder", "account_no"],
    fields: [
      { name: "kind", label: "النوع", type: "select", options: [["treasury", "خزينة"], ["bank", "بنك"]], default: "treasury", required: true },
      { name: "name", label: "الاسم", type: "text", required: true },
      { name: "holder", label: "الجهة / الحساب باسم", type: "text" },
      { name: "branch_id", label: "الفرع", type: "select", resource: "branches", label_field: "name" },
      { name: "account_no", label: "رقم الحساب / الآيبان", type: "text" },
      { name: "balance", label: "الرصيد", type: "readonly" },
      { name: "active", label: "مفعل", type: "switch", default: 1 },
    ],
  },
  vouchers: {
    table: "vouchers", perm: "vouchers", title: "أذون القبض والصرف", orderBy: "id", special: "vouchers",
    search: ["memo", "ref"],
    fields: [
      { name: "kind", label: "النوع", type: "select", options: [["receipt", "سند قبض"], ["payment", "سند صرف"]], default: "payment", required: true },
      { name: "source", label: "المصدر", type: "select", options: [["cash", "خزينة"], ["bank", "بنك"]], default: "cash" },
      { name: "cash_account_id", label: "الخزينة / البنك", type: "select", resource: "cash_accounts", label_field: "name", required: true },
      { name: "party_type", label: "الطرف", type: "select", options: [["customer", "عميل"], ["supplier", "مورد"], ["pilot", "طيار"], ["other", "أخرى"]], default: "other" },
      { name: "party_id", label: "تحديد الطرف", type: "dynamic_select", required: false },
      { name: "amount", label: "المبلغ", type: "number", required: true },
      { name: "date", label: "التاريخ", type: "date", required: true },
      { name: "memo", label: "البيان", type: "textarea" },
      { name: "ref", label: "رقم السند", type: "text" },
      { name: "approved", label: "معتمد", type: "switch", default: 0 },
    ],
  },
  stock_counts: {
    table: "stock_counts", perm: "stock_counts", title: "الجرد والتسويات", orderBy: "id", special: "stock_counts",
    search: ["memo"],
    fields: [
      { name: "date", label: "التاريخ", type: "date", required: true },
      { name: "branch_id", label: "الفرع", type: "select", resource: "branches", label_field: "name" },
      { name: "status", label: "الحالة", type: "select", options: [["draft", "مسودة"], ["approved", "معتمد"], ["cancelled", "ملغي"]], default: "draft" },
      { name: "memo", label: "ملاحظات", type: "textarea" },
    ],
  },
};

const PERM_KEYS = [
  ["dashboard", "لوحة التحكم"], ["orders", "الأوردرات"], ["products", "الأصناف"], ["categories", "الأقسام"],
  ["inventory", "المخزون"], ["purchases", "المشتريات"], ["customers", "العملاء"], ["pilots", "الطيارون"],
  ["suppliers", "الموردون"], ["branches", "الفروع"], ["users", "المستخدمون"], ["payment_methods", "وسائل الدفع"],
  ["promotions", "العروض والخصومات"], ["rewards", "جوائز العملاء"], ["ads", "الإعلانات"], ["accounting", "الحسابات واليومية"],
  ["cash", "الخزائن والبنوك"], ["vouchers", "أذون القبض والصرف"], ["stock_counts", "الجرد والتسويات"],
  ["reports", "التقارير"], ["settings", "إعدادات الشركة"],
  ["zones", "مناطق التوصيل"], ["units", "وحدات القياس"],
  ["payment_proofs", "إثباتات الدفع"],
];

/* ---------------------------------------------------------- role templates */
/* قوالب أدوار جاهزة — كل قالب يُعيد مصفوفة صلاحيات {key: [actions]} */
const ROLE_TEMPLATES = [
  {
    key: "viewer", icon: "👁️", name: "اطّلاع فقط", desc: "مشاهدة كل الشاشات دون أي تعديل أو حذف",
    perms: () => Object.fromEntries(PERM_KEYS.map(([k]) => [k, ["view"]])),
  },
  {
    key: "manager", icon: "👑", name: "مدير عام مساعد", desc: "كل شيء عدا إدارة المستخدمين وإعدادات الشركة",
    perms: () => Object.fromEntries(PERM_KEYS.filter(([k]) => k !== "users" && k !== "settings").map(([k]) => [k, ["view", "create", "update", "delete"]])),
  },
  {
    key: "sales", icon: "🧾", name: "موظف مبيعات / طلبات", desc: "إدارة الأوردرات والعملاء والعروض والطيارين",
    perms: () => permSet(["orders", "customers", "pilots", "promotions", "rewards", "payment_methods", "payment_proofs", "products", "categories", "zones"], ["view", "create", "update"], ["dashboard", "reports"]),
  },
  {
    key: "warehouse", icon: "📦", name: "أمين مخزن", desc: "المخزون والمشتريات والجرد والأصناف",
    perms: () => permSet(["inventory", "purchases", "stock_counts", "products", "categories", "suppliers", "units"], ["view", "create", "update"], ["dashboard"]),
  },
  {
    key: "accountant", icon: "📚", name: "محاسب", desc: "الحسابات واليومية والخزائن والأذون والتقارير",
    perms: () => permSet(["accounting", "cash", "vouchers", "reports", "purchases", "stock_counts", "payment_proofs"], ["view", "create", "update"], ["dashboard", "orders"]),
  },
  {
    key: "support", icon: "🎧", name: "خدمة عملاء", desc: "متابعة الطلبات والعملاء فقط — بلا مالية",
    perms: () => permSet(["orders", "customers"], ["view", "create", "update"], ["dashboard", "products", "categories", "pilots"]),
  },
  {
    key: "branch", icon: "🏢", name: "مسؤول فرع", desc: "كل شاشات التشغيل لفرعه دون إعدادات النظام",
    perms: () => permSet(["dashboard", "orders", "inventory", "products", "categories", "customers", "pilots", "purchases", "stock_counts", "reports", "zones", "units"], ["view", "create", "update", "delete"], ["cash", "vouchers", "accounting"]),
  },
];
function permSet(full, actions, viewOnly) {
  const out = {};
  for (const k of full) out[k] = actions.slice();
  for (const k of viewOnly || []) out[k] = ["view"];
  return out;
}

/* ---------------------------------------------------------- auth utils */
function can(user, perm, action) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "pilot") return perm === "orders" && action === "view";
  const p = user._perms || {};
  return (p[perm] || []).includes(action);
}
function loadUser(row) {
  if (!row) return null;
  const u = { ...row };
  delete u.password;
  try { u._perms = JSON.parse(u.permissions || "{}"); } catch { u._perms = {}; }
  return u;
}
/** إزالة الحقول السرية قبل إرسال أي صف للمتصفح (لا يُعاد هاش كلمة المرور أبدًا) */
function stripSecret(res, row) {
  if (res === "users" && row) delete row.password;
  return row;
}
function findSession(token) {
  if (!token) return null;
  const s = one("SELECT * FROM sessions WHERE token=?", token);
  if (!s) return null;
  if (s.kind === "staff") return { kind: "staff", user: loadUser(one("SELECT * FROM users WHERE id=? AND active=1", s.user_id)) };
  if (s.kind === "customer") return { kind: "customer", customer: one("SELECT * FROM customers WHERE id=?", s.customer_id) };
  return null;
}

/* ---------------------------------------------------------- generic CRUD */
function validate(body, fields) {
  for (const f of fields) {
    if (f.required && (body[f.name] === undefined || body[f.name] === "" || body[f.name] === null))
      throw new Error(`حقل «${f.label}» مطلوب`);
  }
}
function pickFields(body, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === "readonly" || f.type === "permissions") continue;
    if (body[f.name] === undefined) continue;
    let v = body[f.name];
    if (f.type === "number") v = Number(v) || 0;
    if (f.type === "switch") v = v ? 1 : 0;
    if ((f.type === "select" || f.type === "dynamic_select") && (v === "" || v === undefined || v === null)) v = null;
    if (f.type === "password") { if (!v) continue; v = hash(v); }
    out[f.name] = v;
  }
  return out;
}
const UNIQUE = {
  users: { email: "هذا البريد الإلكتروني مستخدم بالفعل" },
  customers: { phone: "رقم الهاتف مسجل بالفعل لعميل آخر" },
  promotions: { code: "كود الخصم مستخدم بالفعل" },
  accounts: { code: "كود الحساب مستخدم بالفعل" },
  zones: { name: "هذه المنطقة مسجّلة بالفعل — عدّل رسومها بدلاً من التكرار" },
  units: { name: "هذه الوحدة موجودة بالفعل" },
};
function checkUnique(res, data, id) {
  const rules = UNIQUE[res];
  if (!rules) return;
  for (const col of Object.keys(rules)) {
    if (data[col] === undefined || data[col] === "") continue;
    const row = one(`SELECT id FROM ${RESOURCES[res].table} WHERE ${col}=? AND id!=?`, data[col], id || -1);
    if (row) throw new Error(rules[col]);
  }
}

function listRows(res, query) {
  const R = RESOURCES[res];
  const where = [], params = [];
  /* السجلات المحذوفة (soft delete) لا تظهر افتراضيًا — يمكن طلبها بـ include_inactive=1 */
  if (query.include_inactive !== "1" && tableHasCol(R.table, "active")) where.push("active=1");
  if (R.search && query.search) {
    where.push("(" + R.search.map(c => `${c} LIKE ?`).join(" OR ") + ")");
    R.search.forEach(() => params.push("%" + query.search + "%"));
  }
  Object.keys(query).forEach(k => {
    if (k.startsWith("fv_")) { where.push(`${k.slice(3)}=?`); params.push(query[k]); }
  });
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit) || 50));
  const orderBy = query.sort || R.orderBy || "id";
  const dir = query.dir === "asc" ? "ASC" : "DESC";
  const w = where.length ? " WHERE " + where.join(" AND ") : "";
  /* أعمدة محسوبة اختيارية (مثل عدد الأصناف في القسم) */
  const extra = R.extra ? ", " + Object.entries(R.extra).map(([alias, expr]) => `${expr} AS ${alias}`).join(", ") : "";
  const total = one(`SELECT COUNT(*) c FROM ${R.table}${w}`, ...params).c;
  const rows = all(`SELECT *${extra} FROM ${R.table}${w} ORDER BY ${orderBy} ${dir} LIMIT ? OFFSET ?`, ...params, limit, (page - 1) * limit);
  return { rows, total, page, pages: Math.ceil(total / limit) || 1 };
}
/* ---------------------------------------------------------- audit trail */
/** وجود عمود في جدول — مع كاش (PRAGMA لكل جدول مرة واحدة) */
const _colCache = new Map();
function tableHasCol(table, col) {
  const k = table + "." + col;
  if (_colCache.has(k)) return _colCache.get(k);
  let has = false;
  try { all(`SELECT \`${col}\` FROM \`${table}\` LIMIT 1`); has = true; } catch (e) { has = false; }
  _colCache.set(k, has);
  return has;
}
/** وصف مختصر للسجل — يتجاهل الحقول الثقيلة (صور/كلمات مرور/صلاحيات) */
function auditDetail(res, data) {
  const skip = { image: 1, logo: 1, password: 1, permissions: 1, barcode: 1 };
  const parts = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (skip[k] || v === undefined || v === null || v === "") continue;
    const s = String(v);
    parts.push(`${k}=${s.length > 40 ? s.slice(0, 40) + "…" : s}`);
    if (parts.length >= 6) break;
  }
  return parts.join(" · ");
}
function auditRow(res, action, id, user, detail) {
  const R = RESOURCES[res];
  audit(user, action, R && R.title ? R.title : res, id, detail || "");
}

function insertRow(res, body, user) {
  const R = RESOURCES[res];
  validate(body, R.fields);
  if (res === "users" && !body.password) throw new Error("حقل «كلمة المرور» مطلوب");
  const data = pickFields(body, R.fields);
  if (res === "users" && data.password === undefined) delete data.password;
  if (res === "journals" && data.approved === undefined) data.approved = 1;
  checkUnique(res, data);
  if (R.beforeCreate) R.beforeCreate(data, body, user);
  /* created_at تلقائي فقط إن كان الجدول يملك هذا العمود (كثير من الجداول لا تملكه) */
  if (!data.created_at && tableHasCol(R.table, "created_at")) data.created_at = nowISO();
  const cols = Object.keys(data);
  const r = run(`INSERT INTO ${R.table}(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`, ...cols.map(c => data[c]));
  if (R.afterCreate) R.afterCreate(r.lastInsertRowid, body, user);
  auditRow(res, "إنشاء", r.lastInsertRowid, user, auditDetail(res, data));
  return one(`SELECT * FROM ${R.table} WHERE id=?`, r.lastInsertRowid);
}
function updateRow(res, id, body, user) {
  const R = RESOURCES[res];
  const row = one(`SELECT * FROM ${R.table} WHERE id=?`, id);
  if (!row) throw new Error("غير موجود");
  if (R.special === "vouchers" && row.approved) throw new Error("لا يمكن تعديل سند معتمد — ألغِ الاعتماد أولاً");
  const data = pickFields(body, R.fields);
  if (res === "users" && body.password === "") delete data.password;
  if (res === "orders") delete data.code; // code auto
  checkUnique(res, data, id);
  if (R.beforeUpdate) R.beforeUpdate(data, body, row, user);
  const cols = Object.keys(data);
  if (!cols.length) return row;
  run(`UPDATE ${R.table} SET ${cols.map(c => `${c}=?`).join(",")} WHERE id=?`, ...cols.map(c => data[c]), id);
  if (R.afterUpdate) R.afterUpdate(id, body, row, user);
  auditRow(res, "تعديل", id, user, auditDetail(res, data));
  return one(`SELECT * FROM ${R.table} WHERE id=?`, id);
}
function deleteRow(res, id, user) {
  const R = RESOURCES[res];
  const row = one(`SELECT * FROM ${R.table} WHERE id=?`, id);
  if (!row) throw new Error("غير موجود");
  /* beforeDelete = تحقق فقط (يرمي خطأ عند الرفض) — لا يستدعي deleteRow أبدًا */
  if (R.beforeDelete) R.beforeDelete(row, user);
  /* الجداول التي تملك active: حذف ناعم ينقل العنصر لسلة المهملات ويمكن استعادته */
  if (tableHasCol(R.table, "active")) {
    run(`UPDATE ${R.table} SET active=0 WHERE id=?`, id);
    if (res === "users") run("DELETE FROM sessions WHERE kind='staff' AND user_id=?", id);
    auditRow(res, "حذف (سلة المهملات)", id, user, row.name || row.title || row.memo || row.ref || row.email || "");
    return { ok: true, soft: true };
  }
  run(`DELETE FROM ${R.table} WHERE id=?`, id);
  if (R.afterDelete) R.afterDelete(row, user);
  auditRow(res, "حذف", id, user, row.name || row.title || row.memo || row.ref || row.email || "");
  return { ok: true };
}

/* ---------- resource hooks (business logic) ---------- */
RESOURCES.orders.beforeCreate = (data, body, user) => {
  if (!data.code) data.code = nextCode("T", "orders"); // كود تصاعدي فريد لا يتكرر حتى بعد الحذف
  data.created_at = nowISO(); data.updated_at = nowISO();
};
RESOURCES.orders.afterCreate = (id, body, user) => {
  if (Array.isArray(body.items) && body.items.length) setOrderItems(id, body.items);
};
RESOURCES.orders.afterUpdate = (id, body, row, user) => {
  if (body.items) setOrderItems(id, body.items);
  if (body.status && body.status !== row.status) applyOrderStatus(id, body.status, user, body.paid || row.paid, row.status);
  if (body.pilot_id !== undefined && body.pilot_id !== row.pilot_id && body.status === undefined)
    run("UPDATE orders SET updated_at=? WHERE id=?", nowISO(), id);
};
RESOURCES.orders.beforeDelete = row => {
  if (row.status === "delivered") throw new Error("لا يمكن حذف طلب مُسلّم — استخدم الإلغاء في التقارير");
};
RESOURCES.orders.afterDelete = row => {
  cancelOrderStock(row.id, row.code);
  run("DELETE FROM order_items WHERE order_id=?", row.id);
  run("DELETE FROM order_events WHERE order_id=?", row.id);
};
RESOURCES.products.beforeDelete = row => {
  const m = one("SELECT COUNT(*) c FROM inventory_moves WHERE product_id=?", row.id).c;
  const oi = one("SELECT COUNT(*) c FROM order_items WHERE product_id=?", row.id).c;
  if (m || oi) throw new Error("لا يمكن حذف صنف له حركات أو أوردرات — أخفِه بدلاً من ذلك");
};
/* وحدة القياس: نخزّن الاسم أيضًا بجانب المعرّف حتى تعمل كل الشاشات والطباعة كما هي */
function syncProductUnit(data, row) {
  if (data.unit_id === undefined) return;
  const u = data.unit_id ? one("SELECT name FROM units WHERE id=?", data.unit_id) : null;
  if (u) data.unit = u.name;
  else data.unit = (row && row.unit) || "قطعة";
}
RESOURCES.products.beforeCreate = data => syncProductUnit(data, null);
RESOURCES.products.beforeUpdate = (data, body, row) => syncProductUnit(data, row);
RESOURCES.units.beforeDelete = row => {
  const n = one("SELECT COUNT(*) c FROM products WHERE unit_id=?", row.id).c;
  if (n) throw new Error(`الوحدة «${row.name}» مستخدمة في ${n} صنف — غيّر وحدة هذه الأصناف أو أوقف تفعيل الوحدة بدلاً من حذفها`);
};
RESOURCES.units.afterUpdate = (id, body, row) => {
  if (body.name && body.name !== row.name) run("UPDATE products SET unit=? WHERE unit_id=?", body.name, id);
};
RESOURCES.zones.beforeDelete = row => {
  const n = one("SELECT COUNT(*) c FROM orders WHERE zone_id=?", row.id).c;
  if (n) throw new Error(`المنطقة «${row.name}» مرتبطة بـ ${n} أوردر — أوقف تفعيلها بدلاً من حذفها للحفاظ على سجل الأوردرات`);
};
RESOURCES.zones.afterDelete = row => {
  run("UPDATE customers SET zone_id=NULL WHERE zone_id=?", row.id);
};
RESOURCES.categories.beforeDelete = row => {
  const c = one("SELECT COUNT(*) c FROM products WHERE category_id=?", row.id).c;
  if (c) throw new Error("لا يمكن حذف قسم يحتوي أصنافاً — احذف أصنافه أولاً");
};
RESOURCES.users.beforeDelete = row => {
  if (row.email === "admin") throw new Error("لا يمكن حذف حساب مدير النظام الرئيسي");
};
RESOURCES.inventory_moves.afterCreate = (id, body, user) => {
  // manual movement updates the stock too
  const mv = one("SELECT * FROM inventory_moves WHERE id=?", id);
  const current = one("SELECT stock FROM products WHERE id=?", mv.product_id);
  run("UPDATE products SET stock=? WHERE id=?", money(mv.qty) + money(current.stock - mv.qty), mv.product_id);
};
RESOURCES.journals.beforeCreate = (data, body, user) => {
  data.created_by = user ? user.id : null; data.approved = data.approved ?? 1;
};
RESOURCES.journals.afterCreate = (id, body, user) => {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const deb = money(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const cre = money(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  if (!lines.length || Math.abs(deb - cre) > 0.01) { run("DELETE FROM journals WHERE id=?", id); throw new Error("يجب إدخال بنود متوازنة (مجموع المدين = مجموع الدائن)"); }
  for (const l of lines) {
    if (!Number(l.debit) && !Number(l.credit)) continue;
    run("INSERT INTO journal_lines(journal_id,account_id,debit,credit) VALUES(?,?,?,?)", id, l.account_id, money(l.debit) || 0, money(l.credit) || 0);
    run("UPDATE accounts SET balance = balance + ? WHERE id=?", money(l.debit) - money(l.credit), l.account_id);
  }
};
RESOURCES.vouchers.afterCreate = (id, body, user) => { if (body.approved) approveVoucher(id, user); };
RESOURCES.vouchers.afterUpdate = (id, body, row, user) => { if (body.approved && !row.approved) approveVoucher(id, user); };
function saveCountItems(countId, items) {
  run("DELETE FROM stock_count_items WHERE count_id=?", countId);
  for (const it of items || []) {
    const p = one("SELECT id,stock,cost FROM products WHERE id=?", it.product_id);
    if (!p) continue;
    const actual = Number(it.actual_qty) || 0;
    run("INSERT INTO stock_count_items(count_id,product_id,unit_cost,system_qty,actual_qty,diff,memo) VALUES(?,?,?,?,?,?,?)",
      countId, p.id, p.cost, p.stock, actual, money(actual - p.stock), it.memo || "");
  }
}
RESOURCES.stock_counts.afterCreate = (id, body) => { if (body.items) saveCountItems(id, body.items); };
RESOURCES.stock_counts.beforeUpdate = (data, body, row) => { if (body.items) saveCountItems(row.id, body.items); };
RESOURCES.cash_accounts.beforeDelete = row => {
  if (Math.abs(row.balance) > 0.01) throw new Error("لا يمكن حذف خزينة/بنك عليه رصيد — صفّ الرصيد أولاً");
};
RESOURCES.purchases.afterCreate = (id, body, user) => {
  const items = Array.isArray(body.items) ? body.items : [];
  savePurchaseItems(id, items);
};
RESOURCES.purchases.afterUpdate = (id, body, row, user) => {
  if (body.items) savePurchaseItems(id, body.items);
  if (body.status === "approved" && row.status !== "approved") approvePurchase(id, user);
  if (body.status === "draft" && row.status === "approved") throw new Error("لا يمكن إرجاع مشتريات معتمدة إلى مسودة — استخدم التعويض من شاشة المخزون");
};

/* ---------- order helpers ---------- */
function setOrderItems(orderId, items) {
  run("DELETE FROM order_items WHERE order_id=?", orderId);
  let subtotal = 0;
  for (const it of items) {
    const p = one("SELECT id,name,price FROM products WHERE id=?", it.product_id);
    if (!p) continue;
    const price = it.price != null ? Number(it.price) : p.price;
    const qty = Number(it.qty) || 1;
    const total = money(price * qty);
    subtotal += total;
    run("INSERT INTO order_items(order_id,product_id,name,price,qty,total) VALUES(?,?,?,?,?,?)", orderId, p.id, p.name, price, qty, total);
  }
  const o = one("SELECT * FROM orders WHERE id=?", orderId);
  const total = money(money(subtotal) - money(o.discount) + money(o.delivery_fee) + money(o.tax));
  run("UPDATE orders SET subtotal=?, total=?, updated_at=? WHERE id=?", money(subtotal), total, nowISO(), orderId);
}
function cancelOrderStock(orderId, code) {
  const c = String(code || "");
  const saleRef = ["طلب #" + c, "طلب #" + c.replace(/^T/i, "")];
  const backRef = ["إلغاء طلب #" + c, "إلغاء طلب #" + orderId];
  /* لا نُرجع المخزون إلا إذا كان قد خُصم فعلًا لهذا الطلب */
  const deducted = one("SELECT COUNT(*) c FROM inventory_moves WHERE ref IN (?,?) AND type='sale' AND qty<0", saleRef[0], saleRef[1]).c;
  if (!deducted) return;
  /* ولا نُرجعه مرّتين (لو سبق إلغاء الطلب) */
  const restored = one("SELECT COUNT(*) c FROM inventory_moves WHERE ref IN (?,?)", backRef[0], backRef[1]).c;
  if (restored) return;
  const items = all("SELECT * FROM order_items WHERE order_id=?", orderId);
  for (const it of items) addMove({ product_id: it.product_id, type: "sale", qty: it.qty, ref: "إلغاء طلب #" + c, note: "إلغاء — إرجاع للمخزون" });
}
function applyOrderStatus(orderId, status, user, paid, fromStatus) {
  const o = one("SELECT * FROM orders WHERE id=?", orderId);
  if (!o) return;
  /* prev = الحالة السابقة الحقيقية. عند التعديل العام (PUT) نمرّرها صراحةً لأن الصف
     يكون قد حُدِّث بالفعل؛ وفي المسار المخصّص (/:id/status) نأخذها من الصف نفسه. */
  const prev = fromStatus === undefined ? o.status : fromStatus;
  run("UPDATE orders SET status=?, updated_at=?, delivered_at=?, paid=? WHERE id=?", status, nowISO(), status === "delivered" ? (prev === "delivered" ? o.delivered_at : nowISO()) : o.delivered_at, paid || o.paid, orderId);
  run("INSERT INTO order_events(order_id,status,note,at) VALUES(?,?,?,?)", orderId, status, "", nowISO());
  /* 🔔 إشعار تلقائي للعميل عند أي تغيّر في حالة الطلب (ما عدا الحالة الابتدائية «جديد») */
  if (prev !== status && status !== "new") {
    const STATUS_NOTIF = {
      confirmed:  ["تم تأكيد طلبك ✅", "استلمنا طلبك وبدأنا تجهيزه. سنوافيك بكل تحديث أولًا بأول.", "✅"],
      preparing:  ["طلبك قيد التجهيز 👨‍🍳", "نحضّر طلبك الآن في الفرع، وسيخرج للتوصيل قريبًا.", "👨‍🍳"],
      delivering: ["طلبك في الطريق إليك 🛵", "المندوب في طريقه إليك الآن. تابع الطلب من صفحة التتبع.", "🛵"],
      delivered:  ["تم تسليم طلبك 🎉", "نتمنى أن تكون التجربة رائعة! يسعدنا تقييمك للطلب.", "📦"],
      cancelled:  ["تم إلغاء طلبك ❌", "تم إلغاء الطلب. إن كان ذلك بالخطأ تواصل معنا لإعادة إنشائه.", "❌"],
    };
    const n = STATUS_NOTIF[status];
    if (n) notify(o.customer_id, orderId, "order_status", n[0], `${n[1]} (طلب ${o.code || "#" + orderId})`, n[2]);
  }
  if (status === "cancelled" && prev !== "cancelled") {
    cancelOrderStock(orderId, o.code);
    run("UPDATE orders SET paid='unpaid' WHERE id=?", orderId);
  }
  if (status === "delivered" && prev !== "delivered") {
    const items = all("SELECT * FROM order_items WHERE order_id=?", orderId);
    let cogs = 0;
    for (const it of items) {
      const p = one("SELECT cost FROM products WHERE id=?", it.product_id);
      cogs += (p ? p.cost : 0) * it.qty;
      if (prev === "new" || prev === "cancelled") addMove({ product_id: it.product_id, type: "sale", qty: -it.qty, ref: "طلب #" + o.code });
    }
    cogs = money(cogs);
    const acc = k => one("SELECT id FROM accounts WHERE code=?", k).id;
    const pm = o.payment_method_id ? one("SELECT kind FROM payment_methods WHERE id=?", o.payment_method_id) : { kind: "cash" };
    const cashAcc = pm.kind === "card" || pm.kind === "online" ? acc("1020") : acc("1010");
    postJournal({
      date: today(), ref_type: "order", ref_id: orderId, memo: "مبيعات طلب #" + o.code,
      lines: [
        { account_id: cashAcc, debit: o.total },
        { account_id: acc("4000"), credit: money(o.subtotal - o.discount) },
        { account_id: acc("4100"), credit: money(o.delivery_fee) },
        { account_id: acc("5000"), debit: cogs },
        { account_id: acc("1200"), credit: cogs },
      ]
    });
    const ca = pm.kind === "card" || pm.kind === "online"
      ? one("SELECT id FROM cash_accounts WHERE kind='bank' AND active=1 ORDER BY id LIMIT 1")
      : one("SELECT id FROM cash_accounts WHERE kind='treasury' AND active=1 ORDER BY id LIMIT 1");
    if (ca) run("UPDATE cash_accounts SET balance = balance + ? WHERE id=?", o.total, ca.id);
    run("UPDATE customers SET total_spent = total_spent + ?, orders_count = orders_count + 1, points = points + ? WHERE id=?",
      o.total, Math.floor(o.total / 10), o.customer_id);
    if (o.promo_id) run("UPDATE promotions SET used_count = used_count + 1 WHERE id=?", o.promo_id);
  }
}

/* ---------- purchase helpers ---------- */
function savePurchaseItems(purchaseId, items) {
  run("DELETE FROM purchase_items WHERE purchase_id=?", purchaseId);
  let total = 0;
  for (const it of items) {
    const cost = Number(it.cost) || 0, qty = Number(it.qty) || 0;
    total += cost * qty;
    run("INSERT INTO purchase_items(purchase_id,product_id,qty,cost,total) VALUES(?,?,?,?,?)", purchaseId, it.product_id, qty, cost, money(cost * qty));
  }
  run("UPDATE purchases SET total=? WHERE id=?", money(total), purchaseId);
}
function approvePurchase(id, user) {
  const p = one("SELECT * FROM purchases WHERE id=?", id);
  if (!p) return;
  if (p.approved_applied) return;
  const items = all("SELECT * FROM purchase_items WHERE purchase_id=?", id);
  for (const it of items) addMove({ product_id: it.product_id, type: "purchase", qty: it.qty, ref: "مشتريات #" + id, date: p.date, user_id: user ? user.id : null });
  const unpaid = money(p.total - (p.paid || 0));
  const acc = k => one("SELECT id FROM accounts WHERE code=?", k).id;
  const lines = [{ account_id: acc("1200"), debit: p.total }];
  if ((p.paid || 0) > 0) lines.push({ account_id: acc("1010"), credit: p.paid });
  if (unpaid > 0) {
    lines.push({ account_id: acc("2010"), credit: unpaid });
    run("UPDATE suppliers SET balance = balance + ? WHERE id=?", unpaid, p.supplier_id);
  } else {
    const ca = one("SELECT id FROM cash_accounts WHERE kind='treasury' AND active=1 ORDER BY id LIMIT 1");
    if (ca) run("UPDATE cash_accounts SET balance = balance - ? WHERE id=?", p.total, ca.id);
  }
  postJournal({ date: p.date, ref_type: "purchase", ref_id: id, memo: "مشتريات #" + id, lines, created_by: user ? user.id : null });
  run("UPDATE purchases SET status='approved' WHERE id=?", id);
}

/* ---------- voucher approval ---------- */
function approveVoucher(id, user) {
  const v = one("SELECT * FROM vouchers WHERE id=?", id);
  if (!v || v.approved) return;
  const ca = one("SELECT * FROM cash_accounts WHERE id=?", v.cash_account_id);
  if (!ca) throw new Error("الخزينة/البنك غير موجود");
  if (v.kind === "payment" && ca.balance < v.amount) throw new Error("رصيد الخزينة/البنك غير كافٍ لإتمام السند");
  const cashAccCode = ca.kind === "bank" ? "1020" : "1010";
  const acc = k => one("SELECT id FROM accounts WHERE code=?", k).id;
  let otherAcc;
  if (v.party_type === "supplier") otherAcc = acc("2010");
  else if (v.party_type === "customer") otherAcc = acc("1100");
  else otherAcc = acc("5100");
  const lines = v.kind === "receipt"
    ? [{ account_id: acc(cashAccCode), debit: v.amount }, { account_id: otherAcc, credit: v.amount }]
    : [{ account_id: otherAcc, debit: v.amount }, { account_id: acc(cashAccCode), credit: v.amount }];
  const j = postJournal({ date: v.date, ref_type: "voucher", ref_id: id, memo: v.memo || (v.kind === "receipt" ? "سند قبض" : "سند صرف"), lines, created_by: user ? user.id : null });
  run("UPDATE cash_accounts SET balance = balance + ? WHERE id=?", v.kind === "receipt" ? v.amount : -v.amount, v.cash_account_id);
  if (v.party_type === "supplier") run("UPDATE suppliers SET balance = balance + ? WHERE id=?", v.kind === "receipt" ? v.amount : -v.amount, v.party_id);
  if (v.party_type === "customer" && v.kind === "receipt") run("UPDATE customers SET total_spent = total_spent WHERE id=?", v.party_id);
  run("UPDATE vouchers SET approved=1, journal_id=? WHERE id=?", j.id, id);
}

/* ---------- stock count approval ---------- */
function approveStockCount(id, user, items) {
  const c = one("SELECT * FROM stock_counts WHERE id=?", id);
  if (!c) throw new Error("غير موجود");
  if (c.status === "approved") throw new Error("الجرد معتمد بالفعل");
  const list = items && items.length ? items : all("SELECT * FROM stock_count_items WHERE count_id=?", id);
  if (!items || !items.length) for (const it of all("SELECT * FROM stock_count_items WHERE count_id=?", id)) list.push(it);
  run("DELETE FROM stock_count_items WHERE count_id=?", id);
  const acc = k => one("SELECT id FROM accounts WHERE code=?", k).id;
  const lines = [];
  for (const raw of list) {
    const p = one("SELECT * FROM products WHERE id=?", raw.product_id);
    if (!p) continue;
    const system = p.stock;
    const actual = Number(raw.actual_qty);
    const diff = money(actual - system);
    run("INSERT INTO stock_count_items(count_id,product_id,unit_cost,system_qty,actual_qty,diff,memo) VALUES(?,?,?,?,?,?,?)",
      id, p.id, p.cost, system, actual, diff, raw.memo || "");
    if (diff !== 0) {
      addMove({ product_id: p.id, branch_id: c.branch_id, type: "count", qty: diff, ref: "جرد #" + id, date: c.date, user_id: user ? user.id : null });
      const val = money(Math.abs(diff) * p.cost);
      if (diff > 0) lines.push({ account_id: acc("1200"), debit: val }, { account_id: acc("5100"), credit: val });
      else lines.push({ account_id: acc("5100"), debit: val }, { account_id: acc("1200"), credit: val });
    }
  }
  if (lines.length) postJournal({ date: c.date, ref_type: "stock_count", ref_id: id, memo: "تسويات جرد #" + id, lines, created_by: user ? user.id : null });
  run("UPDATE stock_counts SET status='approved' WHERE id=?", id);
}

/* ============================================================ reports */
function range(q, defDays = 30) {
  const to = q.to || today();
  const from = q.from || (() => { const d = new Date(); d.setDate(d.getDate() - defDays); return d.toISOString().slice(0, 10); })();
  return { from, to };
}
function rpt(req, res, q) {
  res({ rows: [], columns: [], title: "" });
}
const REPORTS = {
  dashboard(q) {
    const t = today();
    const mStart = t.slice(0, 7) + "-01";
    const kpis = {
      orders_today: one("SELECT COUNT(*) c FROM orders WHERE SUBSTR(created_at,1,10)=?", t).c,
      revenue_today: money(one("SELECT COALESCE(SUM(total),0) s FROM orders WHERE SUBSTR(created_at,1,10)=? AND status='delivered'", t).s),
      revenue_month: money(one("SELECT COALESCE(SUM(total),0) s FROM orders WHERE SUBSTR(created_at,1,10)>=? AND status='delivered'", mStart).s),
      orders_month: one("SELECT COUNT(*) c FROM orders WHERE SUBSTR(created_at,1,10)>=?", mStart).c,
      new_orders: one("SELECT COUNT(*) c FROM orders WHERE status='new'").c,
      pending_orders: one("SELECT COUNT(*) c FROM orders WHERE status IN ('new','confirmed','preparing','delivering')").c,
      customers: one("SELECT COUNT(*) c FROM customers").c,
      products: one("SELECT COUNT(*) c FROM products WHERE active=1").c,
      low_stock: one("SELECT COUNT(*) c FROM products WHERE active=1 AND stock<=min_stock").c,
      pilots_active: one("SELECT COUNT(*) c FROM pilots WHERE active=1").c,
      avg_rating: Math.round((one("SELECT COALESCE(AVG(rating),0) s FROM orders WHERE rating IS NOT NULL").s || 0) * 10) / 10,
      cash_balance: money(all("SELECT balance FROM cash_accounts WHERE kind='treasury'").reduce((s, r) => s + r.balance, 0)),
      bank_balance: money(all("SELECT balance FROM cash_accounts WHERE kind='bank'").reduce((s, r) => s + r.balance, 0)),
      receivables: money(one("SELECT COALESCE(SUM(balance),0) s FROM suppliers").s),
      proofs_pending: one("SELECT COUNT(*) c FROM payment_proofs WHERE status='pending'").c,
      proofs_amount: money(one("SELECT COALESCE(SUM(amount),0) s FROM payment_proofs WHERE status='pending'").s),
      unpaid_orders: one("SELECT COUNT(*) c FROM orders WHERE paid='unpaid' AND status<>'cancelled'").c,
    };
    const from13 = (() => { const d = new Date(); d.setDate(d.getDate() - 13); return d.toISOString().slice(0, 10); })();
    const days = all(`SELECT SUBSTR(created_at,1,10) d, COUNT(*) orders, COALESCE(SUM(CASE WHEN status='delivered' THEN total END),0) revenue
      FROM orders WHERE SUBSTR(created_at,1,10)>=? GROUP BY SUBSTR(created_at,1,10) ORDER BY SUBSTR(created_at,1,10)`, from13);
    const statuses = all("SELECT status, COUNT(*) count FROM orders GROUP BY status");
    const recent = all(`SELECT o.*, c.name customer, p.name pilot FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN pilots p ON p.id=o.pilot_id ORDER BY o.id DESC LIMIT 8`);
    const low_stock = all("SELECT id,name,stock,min_stock,unit FROM products WHERE active=1 AND stock<=min_stock ORDER BY stock ASC LIMIT 10");
    const top_products = all(`SELECT oi.name, SUM(oi.qty) qty, SUM(oi.total) revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='delivered' GROUP BY oi.name ORDER BY revenue DESC LIMIT 8`);
    const top_customers = all("SELECT id,name,phone,total_spent,orders_count,points FROM customers ORDER BY total_spent DESC LIMIT 5");
    return { kpis, chart: { days, statuses }, recent_orders: recent, low_stock, top_products, top_customers };
  },
  sales(q) {
    const { from, to } = range(q);
    const group = q.group || "day";
    let sql, columns;
    if (group === "product") {
      sql = `SELECT oi.name الصنف, SUM(oi.qty) الكمية, SUM(oi.total) الإجمالي FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='delivered' AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ? GROUP BY oi.name ORDER BY الإجمالي DESC`;
      columns = ["الصنف", "الكمية", "الإجمالي"];
    } else if (group === "category") {
      sql = `SELECT COALESCE(ct.name,'غير مصنف') القسم, SUM(oi.qty) الكمية, SUM(oi.total) الإجمالي FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id LEFT JOIN categories ct ON ct.id=p.category_id WHERE o.status='delivered' AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ? GROUP BY ct.name ORDER BY الإجمالي DESC`;
      columns = ["القسم", "الكمية", "الإجمالي"];
    } else if (group === "pilot") {
      sql = `SELECT COALESCE(pl.name,'بدون طيار') الطيار, COUNT(DISTINCT o.id) الطلبات, COALESCE(SUM(o.total),0) الإجمالي FROM orders o LEFT JOIN pilots pl ON pl.id=o.pilot_id WHERE o.status='delivered' AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ? GROUP BY pl.name ORDER BY الإجمالي DESC`;
      columns = ["الطيار", "الطلبات", "الإجمالي"];
    } else if (group === "branch") {
      sql = `SELECT COALESCE(b.name,'بدون فرع') الفرع, COUNT(o.id) الطلبات, COALESCE(SUM(o.total),0) الإجمالي FROM orders o LEFT JOIN branches b ON b.id=o.branch_id WHERE o.status='delivered' AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ? GROUP BY b.name ORDER BY الإجمالي DESC`;
      columns = ["الفرع", "الطلبات", "الإجمالي"];
    } else if (group === "payment") {
      sql = `SELECT COALESCE(pm.name,'غير محدد') \`وسيلة الدفع\`, COUNT(o.id) الطلبات, COALESCE(SUM(o.total),0) الإجمالي FROM orders o LEFT JOIN payment_methods pm ON pm.id=o.payment_method_id WHERE o.status='delivered' AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ? GROUP BY pm.name ORDER BY الإجمالي DESC`;
      columns = ["وسيلة الدفع", "الطلبات", "الإجمالي"];
    } else if (group === "status") {
      sql = `SELECT status الحالة, COUNT(*) الطلبات, COALESCE(SUM(total),0) الإجمالي FROM orders WHERE SUBSTR(created_at,1,10) BETWEEN ? AND ? GROUP BY status`;
      columns = ["الحالة", "الطلبات", "الإجمالي"];
    } else {
      sql = `SELECT SUBSTR(created_at,1,10) اليوم, COUNT(*) الطلبات, COALESCE(SUM(CASE WHEN status='delivered' THEN total END),0) المبيعات FROM orders WHERE SUBSTR(created_at,1,10) BETWEEN ? AND ? GROUP BY SUBSTR(created_at,1,10) ORDER BY اليوم DESC`;
      columns = ["اليوم", "الطلبات", "المبيعات"];
    }
    const rows = all(sql, from, to);
    const totals = one(`SELECT COUNT(*) c, COALESCE(SUM(total),0) s, COALESCE(AVG(total),0) a FROM orders WHERE status='delivered' AND SUBSTR(created_at,1,10) BETWEEN ? AND ?`, from, to);
    return { title: "تقرير المبيعات", columns, rows, summary: { "عدد الطلبات": totals.c, "إجمالي المبيعات": money(totals.s), "متوسط الطلب": money(totals.a) } };
  },
  profit(q) {
    const { from, to } = range(q);
    const rows = all(`SELECT oi.name الصنف, SUM(oi.qty) الكمية, SUM(oi.total) الإيراد,
        SUM(oi.qty * COALESCE(p.cost,0)) التكلفة, SUM(oi.total - oi.qty * COALESCE(p.cost,0)) الربح
      FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id
      WHERE o.status='delivered' AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ? GROUP BY oi.name ORDER BY الربح ASC`, from, to);
    const rev = rows.reduce((s, r) => s + r.الإيراد, 0), cost = rows.reduce((s, r) => s + r.التكلفة, 0);
    return { title: "تقرير الأرباح", columns: ["الصنف", "الكمية", "الإيراد", "التكلفة", "الربح"], rows, summary: { "إجمالي الإيراد": money(rev), "إجمالي التكلفة": money(cost), "إجمالي الربح": money(rev - cost), "هامش الربح ٪": rev ? Math.round(((rev - cost) / rev) * 100) : 0 } };
  },
  inventory(q) {
    const rows = all(`SELECT p.id الصنف_id, p.name الصنف, c.name القسم, p.unit الوحدة, p.price سعر_البيع, p.cost التكلفة, p.stock الرصيد, p.min_stock حد_الطلب,
        ROUND(p.stock * COALESCE(p.cost,0), 2) القيمة_الدفترية FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.name`);
    const value = money(rows.reduce((s, r) => s + r.القيمة_الدفترية, 0));
    const low = rows.filter(r => r.الرصيد <= r.حد_الطلب).length;
    return { title: "تقرير المخزون", columns: ["الصنف", "القسم", "الوحدة", "سعر البيع", "التكلفة", "الرصيد", "القيمة الدفترية"], rows, summary: { "عدد الأصناف": rows.length, "قيمة المخزون": value, "أصناف تحت الحد": low } };
  },
  moves(q) {
    const { from, to } = range(q, 60);
    let sql = `SELECT m.id م, p.name الصنف, m.type نوع_الحركة, m.qty الكمية, m.balance_after الرصيد_بعد, m.ref المرجع, m.date التاريخ, m.note ملاحظات
      FROM inventory_moves m LEFT JOIN products p ON p.id=m.product_id WHERE SUBSTR(m.date,1,10) BETWEEN ? AND ?`;
    if (q.product_id) { sql += " AND m.product_id=?"; }
    sql += " ORDER BY m.id DESC LIMIT 500";
    const params = q.product_id ? [from, to, q.product_id] : [from, to];
    return { title: "تقرير حركات المخزون", columns: ["الصنف", "نوع الحركة", "الكمية", "الرصيد بعد", "المرجع", "التاريخ", "ملاحظات"], rows: all(sql, ...params).map(r => ({ الصنف: r.الصنف, "نوع الحركة": r.نوع_الحركة, الكمية: r.الكمية, "الرصيد بعد": r.الرصيد_بعد, المرجع: r.المرجع, التاريخ: r.التاريخ, ملاحظات: r.ملاحظات })), summary: {} };
  },
  customers(q) {
    const { from, to } = range(q, 365);
    const rows = all(`SELECT c.name العميل, c.phone الهاتف, c.orders_count الطلبات, c.total_spent إجمالي_المشتريات, c.points النقاط, c.rating التقييم,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ?) طلبات_الفترة
      FROM customers c ORDER BY c.total_spent DESC`, from, to);
    const total = rows.reduce((s, r) => s + r.إجمالي_المشتريات, 0);
    return { title: "تقرير العملاء", columns: ["العميل", "الهاتف", "الطلبات", "طلبات الفترة", "إجمالي المشتريات", "النقاط", "التقييم"], rows, summary: { "عدد العملاء": rows.length, "إجمالي مشتريات العملاء": money(total) } };
  },
  suppliers(q) {
    const rows = all(`SELECT s.name المورد, s.phone الهاتف, s.balance الرصيد_الدائن,
        (SELECT COALESCE(SUM(total),0) FROM purchases p WHERE p.supplier_id=s.id AND p.status='approved') إجمالي_المشتريات,
        (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id=s.id) فواتير_المشتريات FROM suppliers s ORDER BY s.balance DESC`);
    const total = rows.reduce((s, r) => s + r.الرصيد_الدائن, 0);
    return { title: "أرصدة الموردين", columns: ["المورد", "الهاتف", "إجمالي المشتريات", "فواتير المشتريات", "الرصيد الدائن"], rows, summary: { "عدد الموردين": rows.length, "إجمالي المستحق للموردين": money(total) } };
  },
  purchases(q) {
    const { from, to } = range(q, 90);
    const rows = all(`SELECT p.id رقم, s.name المورد, p.date التاريخ, p.status الحالة, p.total الإجمالي, p.paid المدفوع, (p.total-p.paid) المتبقي
      FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE SUBSTR(p.date,1,10) BETWEEN ? AND ? ORDER BY p.id DESC`, from, to);
    const st = { draft: "مسودة", approved: "معتمد", cancelled: "ملغي" };
    rows.forEach(r => r.الحالة = st[r.الحالة] || r.الحالة);
    return { title: "تقرير المشتريات", columns: ["رقم", "المورد", "التاريخ", "الحالة", "الإجمالي", "المدفوع", "المتبقي"], rows, summary: { "عدد الفواتير": rows.length, "الإجمالي": money(rows.reduce((s, r) => s + r.الإجمالي, 0)), "المتبقي": money(rows.reduce((s, r) => s + r.المتبقي, 0)) } };
  },
  cashflow(q) {
    const { from, to } = range(q, 60);
    const rows = all(`SELECT v.date التاريخ, v.ref رقم_السند, v.memo البيان, ca.name الخزينة_أو_البنك,
        CASE WHEN v.kind='receipt' THEN v.amount ELSE 0 END مقبوضات,
        CASE WHEN v.kind='payment' THEN v.amount ELSE 0 END مدفوعات
      FROM vouchers v LEFT JOIN cash_accounts ca ON ca.id=v.cash_account_id WHERE v.approved=1 AND SUBSTR(v.date,1,10) BETWEEN ? AND ? ORDER BY v.date DESC`, from, to);
    const inn = rows.reduce((s, r) => s + r.مقبوضات, 0), out = rows.reduce((s, r) => s + r.مدفوعات, 0);
    return { title: "حركة الخزائن والبنوك", columns: ["التاريخ", "رقم السند", "البيان", "الخزينة/البنك", "مقبوضات", "مدفوعات"], rows, summary: { "إجمالي المقبوضات": money(inn), "إجمالي المدفوعات": money(out), "الصافي": money(inn - out) } };
  },
  orders(q) {
    const { from, to } = range(q, 30);
    const rows = all(`SELECT o.code رقم_الطلب, c.name العميل, b.name الفرع, pl.name الطيار, pm.name وسيلة_الدفع, o.status الحالة, o.total الإجمالي, o.created_at تاريخ_الإنشاء, o.rating التقييم
      FROM orders o LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN branches b ON b.id=o.branch_id LEFT JOIN pilots pl ON pl.id=o.pilot_id LEFT JOIN payment_methods pm ON pm.id=o.payment_method_id
      WHERE SUBSTR(o.created_at,1,10) BETWEEN ? AND ? ORDER BY o.id DESC LIMIT 500`, from, to);
    const st = { new: "جديد", confirmed: "تم التأكيد", preparing: "قيد التجهيز", delivering: "في التوصيل", delivered: "تم التسليم", cancelled: "ملغي" };
    rows.forEach(r => r.الحالة = st[r.الحالة] || r.الحالة);
    return { title: "سجل الأوردرات", columns: ["رقم الطلب", "العميل", "الفرع", "الطيار", "وسيلة الدفع", "الحالة", "الإجمالي", "تاريخ الإنشاء", "التقييم"], rows, summary: { "عدد الطلبات": rows.length, "الإجمالي": money(rows.reduce((s, r) => s + r.الإجمالي, 0)) } };
  },
  payments(q) {
    const { from, to } = range(q, 30);
    const rows = all(`SELECT o.code رقم_الطلب, c.name العميل, c.phone الهاتف, pm.name وسيلة_الدفع,
        o.total إجمالي_الطلب, o.paid السداد, COALESCE(o.proof_status,'none') حالة_الإثبات,
        pp.txn_ref رقم_العملية, pp.amount المبلغ_المحوّل, pp.paid_at تاريخ_التحويل,
        pp.status حالة_المراجعة, pp.reject_reason سبب_الرفض, o.created_at تاريخ_الطلب
      FROM orders o
      LEFT JOIN customers c ON c.id=o.customer_id
      LEFT JOIN payment_methods pm ON pm.id=o.payment_method_id
      LEFT JOIN payment_proofs pp ON pp.id=o.proof_id
      WHERE SUBSTR(o.created_at,1,10) BETWEEN ? AND ?
      ORDER BY CASE COALESCE(o.proof_status,'none') WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END, o.id DESC LIMIT 500`, from, to);
    const proofs = { none: "بدون إثبات", pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض" };
    const rev = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
    rows.forEach(r => { r.حالة_الإثبات = proofs[r.حالة_الإثبات] || r.حالة_الإثبات; if (r.حالة_المراجعة) r.حالة_المراجعة = rev[r.حالة_المراجعة] || r.حالة_المراجعة; r.السداد = r.السداد === "paid" ? "مدفوع" : "غير مدفوع"; });
    const pending = rows.filter(r => r.حالة_الإثبات === "قيد المراجعة");
    return { title: "تقرير المدفوعات وإثباتات التحويل", columns: ["رقم الطلب", "العميل", "الهاتف", "وسيلة الدفع", "إجمالي الطلب", "السداد", "حالة الإثبات", "رقم العملية", "المبلغ المحوّل", "تاريخ التحويل", "حالة المراجعة", "سبب الرفض", "تاريخ الطلب"], rows,
      summary: { "عدد الطلبات": rows.length, "قيد المراجعة": pending.length, "مبلغ قيد المراجعة": money(pending.reduce((s, r) => s + Number(r.المبلغ_المحوّل || r.إجمالي_الطلب || 0), 0)), "إجمالي المدفوع": money(rows.filter(r => r.السداد === "مدفوع").reduce((s, r) => s + Number(r.إجمالي_الطلب || 0), 0)) } };
  },
  staff(q) {
    const pilots = all(`SELECT p.name الطيار, p.rating التقييم, COUNT(o.id) الطلبات, COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.total END),0) إجمالي_الموصّل
      FROM pilots p LEFT JOIN orders o ON o.pilot_id=p.id GROUP BY p.id ORDER BY الطلبات DESC`);
    return { title: "أداء الطيارين", columns: ["الطيار", "التقييم", "الطلبات", "إجمالي الموصّل"], rows: pilots, summary: { "عدد الطيارين": pilots.length } };
  },
  /* ------- financial statements ------- */
  "trial-balance"(q) {
    const { from, to } = range(q, 365);
    const accs = all("SELECT * FROM accounts ORDER BY code");
    const lines = all(`SELECT account_id, SUM(debit) d, SUM(debit) dd, SUM(credit) c FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id GROUP BY account_id`);
    const map = {}; lines.forEach(l => map[l.account_id] = l);
    const rows = accs.map(a => ({
      code: a.code, name: a.name,
      debit: money(map[a.id] ? map[a.id].d : 0),
      credit: money(map[a.id] ? map[a.id].c : 0),
      balance: money(a.balance),
    }));
    const td = money(rows.reduce((s, r) => s + r.debit, 0)), tc = money(rows.reduce((s, r) => s + r.credit, 0));
    return { title: "ميزان المراجعة", columns: ["code", "name", "debit", "credit", "balance"], rows, summary: { "إجمالي المدين": td, "إجمالي الدائن": tc, "الفرق": money(td - tc) } };
  },
  "income-statement"(q) {
    const { from, to } = range(q, 30);
    const rev = one(`SELECT COALESCE(SUM(jl.credit-jl.debit),0) s FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id JOIN accounts a ON a.id=jl.account_id WHERE a.type='revenue' AND j.date BETWEEN ? AND ?`, from, to).s;
    const exp = one(`SELECT COALESCE(SUM(jl.debit-jl.credit),0) s FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id JOIN accounts a ON a.id=jl.account_id WHERE a.type='expense' AND j.date BETWEEN ? AND ?`, from, to).s;
    const rows = [
      { code: "", name: "الإيرادات", debit: "", credit: "", balance: "" },
      ...all(`SELECT a.code code, a.name name, SUM(jl.credit-jl.debit) balance FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id JOIN accounts a ON a.id=jl.account_id WHERE a.type='revenue' AND j.date BETWEEN ? AND ? GROUP BY a.id HAVING balance!=0`, from, to),
      { code: "", name: "المصروفات", debit: "", credit: "", balance: "" },
      ...all(`SELECT a.code code, a.name name, SUM(jl.debit-jl.credit) balance FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id JOIN accounts a ON a.id=jl.account_id WHERE a.type='expense' AND j.date BETWEEN ? AND ? GROUP BY a.id HAVING balance!=0`, from, to),
    ];
    return { title: "قائمة الدخل", columns: ["code", "name", "debit", "credit", "balance"], rows, summary: { "إجمالي الإيرادات": money(rev), "إجمالي المصروفات": money(exp), "صافي الدخل": money(rev - exp) } };
  },
  "balance-sheet"(q) {
    const side = t => all(`SELECT code, name, balance FROM accounts WHERE type=? AND ABS(balance)>0.001 ORDER BY code`, t);
    const assets = side("asset"), liab = side("liability"), eq = side("equity");
    const ta = money(assets.reduce((s, r) => s + r.balance, 0)), tl = money(liab.reduce((s, r) => s + r.balance, 0)), te = money(eq.reduce((s, r) => s + r.balance, 0));
    const profit = money(one(`SELECT COALESCE(SUM(CASE WHEN a.type='revenue' THEN jl.credit-jl.debit ELSE jl.debit-jl.credit END),0) s FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id JOIN accounts a ON a.id=jl.account_id WHERE a.type IN ('revenue','expense')`).s);
    const rows = [
      { code: "", name: "الأصول", balance: "" }, ...assets,
      { code: "", name: "الخصوم", balance: "" }, ...liab,
      { code: "", name: "حقوق الملكية", balance: "" }, ...eq,
      { code: "", name: "صافي الدخل للسنة الحالية", balance: profit },
    ];
    return { title: "الميزانية العمومية", columns: ["code", "name", "balance"], rows, summary: { "إجمالي الأصول": ta, "إجمالي الخصوم": tl, "حقوق الملكية": te, "صافي الدخل": profit, "المجموع (خصوم + حقوق + دخل)": money(tl + te + profit), "الفرق": money(ta - tl - te - profit) } };
  },
  "erp-overview"(q) {
    const { from, to } = range(q, 90);
    const orders = one(`SELECT COUNT(*) c, COALESCE(SUM(total),0) total, COALESCE(SUM(subtotal),0) subtotal,
        COALESCE(SUM(discount),0) discount, COALESCE(SUM(delivery_fee),0) delivery, COALESCE(SUM(tax),0) tax,
        COALESCE(AVG(total),0) avg
      FROM orders WHERE status='delivered' AND SUBSTR(created_at,1,10) BETWEEN ? AND ?`, from, to);
    const cogs = one(`SELECT COALESCE(SUM(oi.qty * COALESCE(p.cost,0)),0) s FROM order_items oi
      JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id
      WHERE o.status='delivered' AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ?`, from, to).s;
    const expenses = one(`SELECT COALESCE(SUM(jl.debit-jl.credit),0) s FROM journal_lines jl
      JOIN journals j ON j.id=jl.journal_id JOIN accounts a ON a.id=jl.account_id
      WHERE a.type='expense' AND j.date BETWEEN ? AND ?`, from, to).s;
    const ledgerRevenue = one(`SELECT COALESCE(SUM(jl.credit-jl.debit),0) s FROM journal_lines jl
      JOIN journals j ON j.id=jl.journal_id JOIN accounts a ON a.id=jl.account_id
      WHERE a.type='revenue' AND j.date BETWEEN ? AND ?`, from, to).s;
    const cash = all("SELECT balance FROM cash_accounts WHERE kind='treasury'").reduce((s, r) => s + Number(r.balance || 0), 0);
    const bank = all("SELECT balance FROM cash_accounts WHERE kind='bank'").reduce((s, r) => s + Number(r.balance || 0), 0);
    const receivables = one("SELECT COALESCE(SUM(total),0) s FROM orders WHERE paid='unpaid' AND status<>'cancelled'").s;
    const payables = one("SELECT COALESCE(SUM(balance),0) s FROM suppliers").s;
    const inventory = one("SELECT COALESCE(SUM(stock * COALESCE(cost,0)),0) s FROM products WHERE active=1").s;
    const cancelled = one("SELECT COUNT(*) c FROM orders WHERE status='cancelled' AND SUBSTR(created_at,1,10) BETWEEN ? AND ?", from, to).c;
    const pending = one("SELECT COUNT(*) c FROM orders WHERE status IN ('new','confirmed','preparing','delivering')").c;
    const gross = money(Number(orders.total) - Number(cogs));
    const net = money(Number(ledgerRevenue) - Number(expenses));
    const daily = all(`SELECT SUBSTR(created_at,1,10) d, COUNT(*) orders,
        COALESCE(SUM(CASE WHEN status='delivered' THEN total END),0) revenue,
        COALESCE(SUM(CASE WHEN status='delivered' THEN delivery_fee END),0) delivery
      FROM orders WHERE SUBSTR(created_at,1,10) BETWEEN ? AND ?
      GROUP BY SUBSTR(created_at,1,10) ORDER BY d`, from, to);
    const pilots = all(`SELECT p.id, p.name, p.phone,
        COUNT(o.id) orders,
        COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.total END),0) collected,
        COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.delivery_fee END),0) delivery,
        COALESCE(AVG(CASE WHEN o.rating IS NOT NULL THEN o.rating END),0) rating
      FROM pilots p LEFT JOIN orders o ON o.pilot_id=p.id AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ?
      GROUP BY p.id ORDER BY orders DESC, p.name`, from, to);
    pilots.forEach(r => {
      r.orders = Number(r.orders) || 0;
      r.collected = money(r.collected);
      r.delivery = money(r.delivery);
      r.commission = money(Number(r.delivery) * 0.15);
      r.rating = Math.round((Number(r.rating) || 0) * 10) / 10;
    });
    const branches = all(`SELECT b.name, COUNT(o.id) orders,
        COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.total END),0) revenue,
        COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.delivery_fee END),0) delivery
      FROM branches b LEFT JOIN orders o ON o.branch_id=b.id AND SUBSTR(o.created_at,1,10) BETWEEN ? AND ?
      GROUP BY b.id ORDER BY revenue DESC`, from, to);
    branches.forEach(r => { r.orders = Number(r.orders) || 0; r.revenue = money(r.revenue); r.delivery = money(r.delivery); });
    const payments = all(`SELECT COALESCE(pm.name,'غير محدد') name, COUNT(o.id) orders,
        COALESCE(SUM(CASE WHEN o.status='delivered' THEN o.total END),0) total
      FROM orders o LEFT JOIN payment_methods pm ON pm.id=o.payment_method_id
      WHERE SUBSTR(o.created_at,1,10) BETWEEN ? AND ?
      GROUP BY pm.name ORDER BY total DESC`, from, to);
    payments.forEach(r => { r.orders = Number(r.orders) || 0; r.total = money(r.total); });
    const pilotCommissions = pilots.reduce((s, r) => s + Number(String(r.commission).replace(/[^\d.-]/g, "") || 0), 0);
    return {
      title: "مركز ERP للتوصيل",
      period: { from, to },
      kpis: {
        orders: Number(orders.c) || 0, delivered: Number(orders.c) || 0, cancelled: Number(cancelled) || 0, pending: Number(pending) || 0,
        revenue: money(orders.total), subtotal: money(orders.subtotal), discount: money(orders.discount),
        delivery: money(orders.delivery), tax: money(orders.tax), avg_order: money(orders.avg),
        cogs: money(cogs), gross_profit: gross, expenses: money(expenses), net_profit: net,
        cash: money(cash), bank: money(bank), liquidity: money(cash + bank),
        receivables: money(receivables), payables: money(payables), inventory_value: money(inventory),
        pilot_commissions: money(pilotCommissions),
        delivery_share: Number(orders.total) ? Math.round((Number(orders.delivery) / Number(orders.total)) * 100) : 0,
        gross_margin: Number(orders.total) ? Math.round((Number(gross) / Number(orders.total)) * 100) : 0,
      },
      daily, pilots, branches, payments,
    };
  },
  ledger(q) {
    const acc = q.account_id ? one("SELECT * FROM accounts WHERE id=?", q.account_id) : null;
    if (!acc) return { title: "دفتر الأستاذ", columns: ["date", "memo", "debit", "credit"], rows: [], summary: {} };
    const rows = all(`SELECT j.date AS date, j.memo AS memo, jl.debit AS debit, jl.credit AS credit FROM journal_lines jl JOIN journals j ON j.id=jl.journal_id WHERE jl.account_id=? ORDER BY j.date DESC, jl.id DESC LIMIT 300`, acc.id);
    return { title: "دفتر الأستاذ — " + acc.name, columns: ["date", "memo", "debit", "credit"], rows, summary: { "رصيد الحساب": money(acc.balance) } };
  },
};

/* ============================================================ store API */
function storeHome() {
  const company = one("SELECT * FROM company WHERE id=1");
  const categories = all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.active=1) products_count
    FROM categories c WHERE c.active=1 ORDER BY c.sort_order`);
  const now = today();
  const ads = all("SELECT * FROM ads WHERE active=1 AND (start_at IS NULL OR start_at<=?) AND (end_at IS NULL OR end_at>=?) ORDER BY id DESC", now, now);
  return { company, categories, ads };
}
function quoteCart(items, promoCode, zoneId) {
  const company = one("SELECT * FROM company WHERE id=1");
  const lines = [];
  let subtotal = 0;
  for (const it of items || []) {
    const p = one("SELECT * FROM products WHERE id=? AND active=1", it.product_id);
    if (!p) continue;
    const qty = Math.max(1, Number(it.qty) || 1);
    const total = money(p.price * qty);
    subtotal += total;
    lines.push({ product_id: p.id, name: p.name, image: p.image, unit: p.unit, price: p.price, qty, total, stock: p.stock });
  }
  subtotal = money(subtotal);
  let discount = 0, promo = null;
  if (promoCode) {
    const pr = one("SELECT * FROM promotions WHERE UPPER(code)=UPPER(?) AND active=1", promoCode);
    if (!pr) throw new Error("كود الخصم غير صحيح");
    const now = today();
    if (pr.start_at && pr.start_at > now) throw new Error("عرض الخصم لم يبدأ بعد");
    if (pr.end_at && pr.end_at < now) throw new Error("انتهت صلاحية عرض الخصم");
    if (pr.min_order && subtotal < pr.min_order) throw new Error(`هذا العرض يبدأ من ${pr.min_order} ج.م`);
    discount = pr.kind === "percent" ? money(subtotal * (pr.value / 100)) : money(pr.value);
    promo = { id: pr.id, code: pr.code, name: pr.name, value: pr.value, kind: pr.kind };
  }
  /* رسوم التوصيل تُحدَّد حسب منطقة العميل — وإن لم تُحدَّد نستخدم القيمة العامة للشركة */
  const zone = zoneId ? one("SELECT * FROM zones WHERE id=? AND active=1", zoneId) : null;
  const feeValue = zone ? money(zone.fee) : money(company.delivery_fee);
  const delivery = lines.length ? feeValue : 0;
  const taxable = money(subtotal - discount);
  const tax = company.tax_enabled ? money(taxable * (company.tax_percent / 100)) : 0;
  return {
    lines, subtotal, discount, delivery_fee: delivery, tax, total: money(taxable + delivery + tax), promo,
    zone: zone ? { id: zone.id, name: zone.name, fee: money(zone.fee), eta: zone.eta || "" } : null,
    company: { delivery_fee: company.delivery_fee, currency: company.currency },
  };
}
function createStoreOrder(session, body) {
  if (!session || session.kind !== "customer") throw new Error("يجب تسجيل الدخول أولاً");
  const cust = session.customer;
  const zoneId = body.zone_id || cust.zone_id || null;
  const q = quoteCart(body.items, body.promo_code, zoneId);
  if (!q.lines.length) throw new Error("الطلب فارغ — أضف أصنافاً أولاً");
  for (const l of q.lines) {
    const p = one("SELECT stock FROM products WHERE id=?", l.product_id);
    if (p.stock < l.qty) throw new Error(`الكمية المتاحة من «${l.name}» هي ${p.stock} فقط`);
  }
  const code = nextCode("T", "orders"); // كود تصاعدي فريد لا يتكرر
  const pmId = body.payment_method_id || (one("SELECT id FROM payment_methods WHERE kind='cash' AND active=1") || {}).id;
  const pmRow = pmId ? one("SELECT * FROM payment_methods WHERE id=?", pmId) : null;
  if (body.payment_method_id && !pmRow) throw new Error("وسيلة الدفع المختارة غير متاحة");
  /* هل تحتاج هذه الطريقة إثبات تحويل؟ (كل ما ليس كاش) */
  const needsProof = !!(pmRow && pmRow.kind !== "cash" && Number(pmRow.requires_proof) === 1);
  if (needsProof && !body.proof) throw new Error("هذه الطريقة تحتاج إثبات تحويل — ارفع صورة إشعار الدفع أولاً");
  const r = run(`INSERT INTO orders(code,customer_id,branch_id,payment_method_id,zone_id,promo_id,promo_code,status,subtotal,discount,delivery_fee,tax,total,paid,note,address,phone,proof_status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    code, cust.id, 1, pmId, q.zone ? q.zone.id : null, q.promo ? q.promo.id : null, q.promo ? q.promo.code : "", "new",
    q.subtotal, q.discount, q.delivery_fee, q.tax, q.total, "unpaid",
    body.note || "", body.address || cust.address, body.phone || cust.phone,
    needsProof ? "pending" : "none", nowISO(), nowISO());
  const oid = r.lastInsertRowid;
  for (const l of q.lines) run("INSERT INTO order_items(order_id,product_id,name,price,qty,total) VALUES(?,?,?,?,?,?)", oid, l.product_id, l.name, l.price, l.qty, l.total);
  run("INSERT INTO order_events(order_id,status,note,at) VALUES(?,?,?,?)", oid, "new",
    needsProof ? `📤 العميل أرسل إثبات تحويل بمبلغ ${money(body.proof.amount || q.total)}` : "", nowISO());
  if (needsProof) {
    try {
      const pid = saveProof(oid, { method_id: pmId, method_name: pmRow.name, amount: body.proof.amount || q.total,
        txn_ref: body.proof.txn_ref, paid_at: body.proof.paid_at, note: body.proof.note,
        image: body.proof.image, image_name: body.proof.image_name, image_mime: body.proof.image_mime });
      run("UPDATE orders SET proof_id=? WHERE id=?", pid, oid);
    } catch (e) {
      /* فشل حفظ الإثبات ⇒ لا نُبقي طلبًا معلّقًا بلا إثبات */
      run("DELETE FROM order_items WHERE order_id=?", oid);
      run("DELETE FROM order_events WHERE order_id=?", oid);
      run("DELETE FROM orders WHERE id=?", oid);
      throw e;
    }
  }
  if (!cust.zone_id && zoneId) run("UPDATE customers SET zone_id=? WHERE id=?", zoneId, cust.id);
  return one("SELECT * FROM orders WHERE id=?", oid);
}

/* ---------------------------------------------------------- إثباتات الدفع (Payment proofs) */
/** أقصى حجم لصورة إشعار التحويل بعد الضغط في المتصفح — ٣ ميجابايت من نص base64 */
const PROOF_IMG_MAX = 3 * 1024 * 1024;
/** مفتاح التحقق من نوع الملف المرفق */
const PROOF_OK = /^data:(image\/(png|jpe?g|webp|gif|bmp)|application\/pdf)[;,]?/i;

/** يحفظ إثبات دفع جديد للطلب ويُعيد معرّفه. يتحقق من كل الحقول الإلزامية. */
function saveProof(orderId, d) {
  const img = String(d.image || "");
  if (!img) throw new Error("صورة إشعار التحويل مطلوبة كدليل على الدفع");
  if (!PROOF_OK.test(img)) throw new Error("الملف المرفق ليس صورة صحيحة — ارفع صورة إشعار التحويل (JPG/PNG/WEBP)");
  if (img.length > PROOF_IMG_MAX) throw new Error("حجم صورة الإثبات كبير جدًا — اختر صورة أصغر أو التقط شاشة بجودة أقل");
  const txn = String(d.txn_ref || "").trim();
  if (!txn) throw new Error("رقم العملية / المرجع مطلوب للتأكد من التحويل");
  const amount = money(Number(d.amount) || 0);
  if (!(amount > 0)) throw new Error("أدخل المبلغ الذي حوّلته فعلاً");
  const r = run(`INSERT INTO payment_proofs(order_id,method_id,method_name,amount,txn_ref,paid_at,note,image,image_name,image_mime,status,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,'pending',?)`,
    orderId, d.method_id || null, String(d.method_name || "").slice(0, 120), amount, txn.slice(0, 120),
    String(d.paid_at || today()).slice(0, 30), String(d.note || "").slice(0, 500),
    img, String(d.image_name || "").slice(0, 200), String(d.image_mime || "").slice(0, 80), nowISO());
  return r.lastInsertRowid;
}

/** قائمة الإثباتات مع بيانات الطلب والعميل — للاستخدام في لوحة الإدارة */
function listProofs(filters = {}) {
  const where = [], args = [];
  if (filters.status) { where.push("pp.status=?"); args.push(filters.status); }
  if (filters.order_id) { where.push("pp.order_id=?"); args.push(Number(filters.order_id)); }
  if (filters.method_id) { where.push("pp.method_id=?"); args.push(Number(filters.method_id)); }
  if (filters.q) {
    where.push("(pp.txn_ref LIKE ? OR pp.method_name LIKE ? OR o.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)");
    const w = "%" + filters.q + "%"; args.push(w, w, w, w, w);
  }
  return all(`SELECT pp.*, o.code _order, o.total _order_total, o.status _order_status, o.paid _order_paid,
      c.name _customer, c.phone _customer_phone
    FROM payment_proofs pp
    LEFT JOIN orders o ON o.id=pp.order_id
    LEFT JOIN customers c ON c.id=o.customer_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY CASE pp.status WHEN 'pending' THEN 0 ELSE 1 END, pp.id DESC LIMIT 500`, ...args);
}

/** ملخص أعداد ومبالغ الإثباتات حسب الحالة */
function proofStats() {
  const g = k => Number((one("SELECT COUNT(*) c FROM payment_proofs WHERE status=?", k) || {}).c || 0);
  const s = k => money((one("SELECT COALESCE(SUM(amount),0) s FROM payment_proofs WHERE status=?", k) || {}).s || 0);
  return { pending: g("pending"), approved: g("approved"), rejected: g("rejected"),
    pending_amount: s("pending"), approved_amount: s("approved") };
}

/** إنشاء إشعار للعميل — يُستخدم تلقائيًا عند تغيّر حالة الطلب أو مراجعة الدفع */
function notify(customerId, orderId, kind, title, body, icon) {
  if (!customerId) return null;
  const r = run("INSERT INTO notifications(customer_id,order_id,kind,title,body,icon,is_read,created_at) VALUES(?,?,?,?,?,?,0,?)",
    customerId, orderId || null, kind || "info", String(title || "").slice(0, 200), String(body || "").slice(0, 600),
    icon || "🔔", nowISO());
  return r.lastInsertRowid;
}

/** اعتماد إثبات دفع → يُعلَّم الطلب «مدفوعًا» ويُسجَّل في الخط الزمني */
function approveProof(id, user) {
  const p = one("SELECT * FROM payment_proofs WHERE id=?", id);
  if (!p) throw new Error("إثبات الدفع غير موجود");
  if (p.status === "approved") return p;
  run("UPDATE payment_proofs SET status='approved', reject_reason='', reviewed_by=?, reviewed_at=? WHERE id=?",
    user ? user.id : null, nowISO(), id);
  const o = one("SELECT * FROM orders WHERE id=?", p.order_id);
  if (o) {
    run("UPDATE orders SET paid='paid', proof_status='approved', proof_id=?, updated_at=? WHERE id=?", id, nowISO(), o.id);
    run("INSERT INTO order_events(order_id,status,note,at) VALUES(?,?,?,?)", o.id, o.status,
      `✅ تم اعتماد إثبات الدفع (${p.method_name || "تحويل"}) — مرجع ${p.txn_ref || "—"} بمبلغ ${money(p.amount)}`, nowISO());
    /* 🔔 إشعار تلقائي للعميل بأن دفعه تم التحقق منه */
    notify(o.customer_id, o.id, "proof_approved", "تم تأكيد استلام دفعتك ✅",
      `راجعنا إثبات التحويل بمبلغ ${money(p.amount)} (مرجع ${p.txn_ref || "—"}) للطلب ${o.code || "#" + o.id} وتم اعتماده. طلبك الآن مؤكد الدفع.`, "✅");
  }
  audit(user, "approve", "payment_proofs", id, `اعتماد إثبات دفع للطلب ${o ? o.code : ""}`);
  return one("SELECT * FROM payment_proofs WHERE id=?", id);
}

/** رفض إثبات دفع → يبقى الطلب قائمًا ويُطلب من العميل إرسال إثبات جديد */
function rejectProof(id, reason, user) {
  const p = one("SELECT * FROM payment_proofs WHERE id=?", id);
  if (!p) throw new Error("إثبات الدفع غير موجود");
  if (p.status === "approved") throw new Error("لا يمكن رفض إثبات معتمد مسبقًا");
  run("UPDATE payment_proofs SET status='rejected', reject_reason=?, reviewed_by=?, reviewed_at=? WHERE id=?",
    String(reason || "").slice(0, 500), user ? user.id : null, nowISO(), id);
  const o = one("SELECT * FROM orders WHERE id=?", p.order_id);
  if (o) {
    run("UPDATE orders SET proof_status='rejected' WHERE id=?", o.id);
    run("INSERT INTO order_events(order_id,status,note,at) VALUES(?,?,?,?)", o.id, o.status,
      `❌ تم رفض إثبات الدفع${reason ? " — " + reason : ""}. مطلوب إعادة إرسال إثبات صحيح.`, nowISO());
    /* 🔔 إشعار تلقائي للعميل بأن الإثبات مرفوض مع سبب الرفض وطلب إعادة الإرسال */
    notify(o.customer_id, o.id, "proof_rejected", "لم نقبل إثبات الدفع — أعد الإرسال ❌",
      `إثبات التحويل للطلب ${o.code || "#" + o.id} مرفوض${reason ? ": " + reason : ""}. طلبك ما زال قائمًا، من فضلك افتح الطلب وارفع إثباتًا صحيحًا.`, "❌");
  }
  audit(user, "reject", "payment_proofs", id, `رفض إثبات دفع للطلب ${o ? o.code : ""}`);
  return one("SELECT * FROM payment_proofs WHERE id=?", id);
}
function orderDetail(id, mineId) {
  const o = one("SELECT * FROM orders WHERE id=?", id);
  if (!o) throw new Error("الطلب غير موجود");
  if (mineId && o.customer_id !== mineId) throw new Error("غير مصرح");
  const items = all("SELECT * FROM order_items WHERE order_id=?", id);
  const events = all("SELECT * FROM order_events WHERE order_id=? ORDER BY at", id);
  const pilotRow = o.pilot_id ? one("SELECT name,phone,vehicle FROM pilots WHERE id=?", o.pilot_id) : null;
  const customer = o.customer_id ? one("SELECT name,phone,address FROM customers WHERE id=?", o.customer_id) : null;
  const pm = o.payment_method_id ? one("SELECT name FROM payment_methods WHERE id=?", o.payment_method_id) : null;
  const branch = o.branch_id ? one("SELECT name FROM branches WHERE id=?", o.branch_id) : null;
  const zoneRow = o.zone_id ? one("SELECT name,fee,eta FROM zones WHERE id=?", o.zone_id) : null;
  const pmRow = o.payment_method_id ? one("SELECT * FROM payment_methods WHERE id=?", o.payment_method_id) : null;
  /* إثباتات الدفع الخاصة بالطلب — الأحدث أولاً، بدون بيانات مصدرها العميل غير لازمة */
  const proofs = all("SELECT id,order_id,method_id,method_name,amount,txn_ref,paid_at,note,image,image_name,status,reject_reason,reviewed_at,created_at FROM payment_proofs WHERE order_id=? ORDER BY id DESC", id);
  return { ...o, items, events, customer, branch, zone: zoneRow ? zoneRow.name : "",
    _zone: zoneRow ? zoneRow.name : "",
    payment: pm ? pm.name : "",
    payment_method: pmRow ? { id: pmRow.id, name: pmRow.name, kind: pmRow.kind, pay_number: pmRow.pay_number,
      pay_holder: pmRow.pay_holder, pay_bank: pmRow.pay_bank, pay_link: pmRow.pay_link,
      pay_instructions: pmRow.pay_instructions, requires_proof: pmRow.requires_proof } : null,
    proofs,
    _pilot: pilotRow ? `${pilotRow.name} — ${pilotRow.vehicle || ""}` : "",
    _payment: pm ? pm.name : "",
    _customer: customer ? customer.name : "",
    _branch: branch ? branch.name : "" };
}

/* ============================================================ special: VIP customers + backup */
/* طبقات العملاء المميزين — تُحدَّد حسب قيمة المشتريات أو عدد المعاملات */
const VIP_TIERS = [
  { key: "gold", name: "ذهبي", icon: "🥇", cls: "vip-gold", min_spent: 1000, min_orders: 4 },
  { key: "silver", name: "فضي", icon: "🥈", cls: "vip-silver", min_spent: 500, min_orders: 3 },
  { key: "bronze", name: "برونزي", icon: "🥉", cls: "vip-bronze", min_spent: 250, min_orders: 2 },
];
function vipTier(spent, cnt) {
  for (const t of VIP_TIERS) if (Number(spent) >= t.min_spent || Number(cnt) >= t.min_orders) return t.key;
  return "normal";
}

/* ---------------------------------------------------------- backup (نسخ احتياطي متعدد المجلدات) */
const BACKUP_DIR = path.join(DATA_DIR, "backups");
/** مجلدات النسخ الاحتياطي المسجّلة — يختارها المستخدم، ويُضاف الافتراضي تلقائيًا */
function backupDirs() {
  try {
    const rows = all("SELECT * FROM backup_dirs ORDER BY is_default DESC, id");
    if (rows.length) return rows;
  } catch (e) { /* تجاهل */ }
  return [{ id: 0, path: BACKUP_DIR, is_default: 1, note: "المجلد الافتراضي" }];
}
const backupDir = () => (backupDirs()[0] || { path: BACKUP_DIR }).path;
function dirById(id) {
  if (id === undefined || id === null || id === "") return backupDirs()[0];
  return backupDirs().find(d => String(d.id) === String(id)) || null;
}
function fileSize(p) { try { return fs.statSync(p).size; } catch (e) { return 0; } }
/** قوائم نسخ كل المجلدات المسجّلة (الأحدث أولاً) */
function listBackups() {
  const re = DB_KIND === "mysql" ? /\.json$/i : /\.db$/i;
  const out = [];
  for (const d of backupDirs()) {
    try {
      if (!fs.existsSync(d.path)) continue;
      for (const f of fs.readdirSync(d.path)) {
        if (!re.test(f)) continue;
        const full = path.join(d.path, f);
        let st; try { st = fs.statSync(full); } catch (e) { continue; }
        if (!st.isFile()) continue;
        out.push({ name: f, dir_id: d.id, dir: d.path, size: st.size, mtime: st.mtime.toISOString() });
      }
    } catch (e) { /* تجاهل مجلدًا غير مقروء */ }
  }
  return out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}
/** يمنع الخروج عن المجلدات المسجّلة (حماية من Path Traversal) */
function locateBackup(dirId, name) {
  const d = dirById(dirId);
  if (!d) return null;
  const raw = String(name || "");
  if (!raw || raw !== path.basename(raw)) return null;          // يمنع أي فاصل مسار
  if (/[\\/:*?"<>|]/.test(raw)) return null;
  if (!(DB_KIND === "mysql" ? /\.json$/i : /\.db$/i).test(raw)) return null;
  return path.join(d.path, raw);
}
/** هل المجلد صالح للكتابة؟ (يكتب ملفًا مؤقتًا ثم يحذفه) */
function dirWritable(p) {
  try {
    if (!fs.statSync(p).isDirectory()) return false;
    const probe = path.join(p, ".talabatak-write-probe");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch (e) { return false; }
}
/** إنشاء نسخة متّسقة: SQLite عبر VACUUM INTO، وMySQL عبر تصدير JSON */
function createBackup(user, note, dirId) {
  const d = dirById(dirId);
  const targetDir = d ? d.path : backupDir();
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const tag = note ? "-" + String(note).replace(/[^\w\u0600-\u06FF]+/g, "").slice(0, 14) : "";
  const ext = DB_KIND === "mysql" ? ".json" : ".db";
  let target = path.join(targetDir, `app-${stamp}${tag}${ext}`);
  let i = 1;
  while (fs.existsSync(target)) target = path.join(targetDir, `app-${stamp}${tag}-${i++}${ext}`);
  if (DB_KIND === "mysql") {
    const data = { meta: { app: "talabatak", kind: "mysql", exportedAt: nowISO(), version: 1 }, tables: {} };
    const skip = new Set(["backup_dirs", "sessions"]);
    const tables = all("SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
      .map(r => r.t).filter(t => !skip.has(t));
    for (const t of tables) data.tables[t] = all(`SELECT * FROM \`${t}\``);
    fs.writeFileSync(target, JSON.stringify(data));
  } else {
    db.exec(`VACUUM INTO '${target.replace(/\\/g, "/").replace(/'/g, "''")}'`);
  }
  const size = fileSize(target);
  audit(user, "إنشاء نسخة احتياطية", "النظام", null, `${path.basename(target)} — ${Math.round(size / 1024)} ك.ب — ${targetDir}`);
  return { ok: true, name: path.basename(target), size, at: nowISO(), dir: targetDir, dir_id: d ? d.id : 0 };
}

/** استعادة ملف نسخة احتياطية (SQLite أو JSON) مع أخذ نسخة أمان تلقائية أولاً */
function restoreBackupFile(user, filePath, label) {
  createBackup(user, "قبل-الاستعادة");
  const safeTable = t => /^[A-Za-z0-9_]+$/.test(String(t || ""));
  if (DB_KIND === "mysql") {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const tables = Object.keys(data.tables || {}).filter(safeTable);
    if (!tables.length) throw new Error("ملف النسخة لا يحتوي على جداول صالحة");
    db.exec("SET FOREIGN_KEY_CHECKS=0");
    db.exec("START TRANSACTION");
    try {
      for (const t of tables) db.exec(`DELETE FROM \`${t}\``);
      let count = 0;
      for (const t of tables) {
        const rows = data.tables[t] || [];
        if (!rows.length) continue;
        const cols = Object.keys(rows[0]).map(c => (t === "notifications" && c === "read" ? "is_read" : c)).filter(c => /^[A-Za-z0-9_]+$/.test(c));
        if (!cols.length) continue;
        const sql = `INSERT INTO \`${t}\` (${cols.map(c => `\`${c}\``).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
        for (const row of rows) {
          run(sql, ...cols.map(c => {
            const key = (t === "notifications" && c === "is_read" && row.is_read === undefined) ? "read" : c;
            return row[key] === undefined ? null : row[key];
          }));
          count++;
        }
      }
      db.exec("COMMIT");
      audit(user, "استعادة نسخة احتياطية", "النظام", null, `${label} — من ${filePath}`);
      return { ok: true, tables: tables.length, rows: count };
    } catch (e2) {
      try { db.exec("ROLLBACK"); } catch (e3) { /* تجاهل */ }
      throw e2;
    } finally {
      try { db.exec("SET FOREIGN_KEY_CHECKS=1"); } catch (e4) { /* تجاهل */ }
    }
  }
  const src = `'${filePath.replace(/\\/g, "/").replace(/'/g, "''")}'`;
  const tables = all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map(r => r.name).filter(safeTable);
  db.exec(`ATTACH DATABASE ${src} AS bak`);
  try {
    try {
      const bakCols = all("PRAGMA bak.table_info(notifications)");
      if (bakCols.some(c => c.name === "read") && !bakCols.some(c => c.name === "is_read")) {
        db.exec("ALTER TABLE bak.notifications RENAME COLUMN read TO is_read");
      }
    } catch (e0) { /* تجاهل */ }
    const bakTables = new Set(all("SELECT name FROM bak.sqlite_master WHERE type='table'").map(r => r.name).filter(safeTable));
    db.exec("BEGIN IMMEDIATE");
    for (const t of tables) {
      if (t === "sqlite_sequence") continue;
      if (t === "sessions" || t === "backup_dirs") continue;
      if (!bakTables.has(t)) continue;
      const mainCols = all(`PRAGMA main.table_info("${t}")`).map(c => c.name).filter(safeTable);
      const bakCols = new Set(all(`PRAGMA bak.table_info("${t}")`).map(c => c.name).filter(safeTable));
      const common = mainCols.filter(c => bakCols.has(c));
      if (!common.length) continue;
      const colList = common.map(c => `"${c}"`).join(",");
      db.exec(`DELETE FROM main."${t}"`);
      db.exec(`INSERT INTO main."${t}"(${colList}) SELECT ${colList} FROM bak."${t}"`);
    }
    db.exec("COMMIT");
  } catch (e2) { try { db.exec("ROLLBACK"); } catch (e3) { /* تجاهل */ } throw e2; }
  finally { try { db.exec("DETACH DATABASE bak"); } catch (e4) { /* تجاهل */ } }
  audit(user, "استعادة نسخة احتياطية", "النظام", null, `${label} — من ${filePath}`);
  return { ok: true, tables: tables.length };
}

/* ============================================================ router */
function json(res, data, status = 200) { res(status, data); }

async function handleApi(req, res, url, body, session, send) {
  const p = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean)
    .map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  const [a, b, c, d] = p;
  const q = url.searchParams;
  const method = req.method;
  const staff = session && session.kind === "staff" ? session.user : null;
  const cust = session && session.kind === "customer" ? session.customer : null;

  /* ---- auth ---- */
  if (a === "auth") {
    if (b === "login" && method === "POST") {
      const u = one("SELECT * FROM users WHERE email=? AND active=1", body.email);
      if (!u || u.password !== hash(body.password)) {
        audit({ id: null, name: body.email || "?" }, "محاولة دخول فاشلة", "المستخدمون", null, "بريد أو كلمة مرور غير صحيحة");
        return send(400, { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }
      const token = "tk" + require("crypto").randomBytes(24).toString("hex");
      run("INSERT INTO sessions(token,kind,user_id,created_at) VALUES(?,?,?,?)", token, "staff", u.id, nowISO());
      audit(u, "تسجيل دخول", "المستخدمون", u.id, "من لوحة التحكم");
      return send(200, { token, user: loadUser(u) });
    }
    if (b === "me") {
      if (staff) return send(200, { user: staff });
      if (cust) return send(200, { customer: cust });
      return send(401, { error: "غير مسجل الدخول" });
    }
    if (b === "logout" && method === "POST") {
      const t = req.headers.authorization?.replace("Bearer ", "");
      run("DELETE FROM sessions WHERE token=?", t || "");
      return send(200, { ok: true });
    }
    if (b === "change-password" && method === "POST") {
      if (!staff) return send(401, { error: "غير مسجل الدخول" });
      const cur = String(body.current || "");
      const nu = String(body.next || "");
      const u = one("SELECT * FROM users WHERE id=?", staff.id);
      if (!u) return send(404, { error: "المستخدم غير موجود" });
      if (!cur || u.password !== hash(cur)) return send(400, { error: "كلمة المرور الحالية غير صحيحة" });
      if (nu.length < 6) return send(400, { error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
      if (nu === cur) return send(400, { error: "كلمة المرور الجديدة مطابقة للحالية" });
      run("UPDATE users SET password=? WHERE id=?", hash(nu), u.id);
      run("INSERT INTO password_history(user_id,password,changed_at) VALUES(?,?,?)", u.id, u.password, nowISO());
      audit(u, "تغيير كلمة المرور", "المستخدمون", u.id, `المستخدم: ${u.name || u.email}`);
      return send(200, { ok: true });
    }
    if (b === "sessions" && method === "GET") {
      if (!staff) return send(401, { error: "غير مسجل الدخول" });
      const keep = req.headers.authorization?.replace("Bearer ", "") || "";
      /* لا نُعيد رموز الجلسات كاملة — نحدّد الجهاز الحالي فقط بأمان */
      const rows = all("SELECT token, created_at FROM sessions WHERE kind='staff' AND user_id=? ORDER BY created_at DESC", staff.id);
      return send(200, rows.map(s => ({
        is_current: s.token === keep,
        masked: s.token === keep ? "" : (String(s.token).slice(0, 8) + "…"),
        created_at: s.created_at,
      })));
    }
    if (b === "sessions" && c === "revoke-all" && method === "POST") {
      if (!staff) return send(401, { error: "غير مسجل الدخول" });
      const keep = req.headers.authorization?.replace("Bearer ", "") || "";
      run("DELETE FROM sessions WHERE kind='staff' AND user_id=? AND token!=?", staff.id, keep);
      audit(staff, "تسجيل خروج من كل الأجهزة", "المستخدمون", staff.id, "");
      return send(200, { ok: true });
    }
    if (b === "permissions") return send(200, { keys: PERM_KEYS });
  }

  /* ---- product barcode ---- */
  if (a === "products" && b && c === "barcode.svg") {
    const pr = one("SELECT * FROM products WHERE id=?", b);
    if (!pr) return send(404, "not found");
    const svg = barcodeSVG(pr.barcode || "P" + pr.id);
    return send(200, svg, "image/svg+xml");
  }

  /* ---- store (customers only) ---- */
  if (a === "store") {
    if (b === "home" && method === "GET") return send(200, storeHome());
    if (b === "categories" && method === "GET")
      return send(200, all("SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.active=1) products_count FROM categories c WHERE c.active=1 ORDER BY c.sort_order"));
    if (b === "products" && method === "GET") {
      const cid = q.get("category_id");
      const rows = cid
        ? all("SELECT id,category_id,name,image,price,unit,barcode,stock,description FROM products WHERE active=1 AND category_id=? ORDER BY name", cid)
        : all("SELECT id,category_id,name,image,price,unit,barcode,stock,description FROM products WHERE active=1 ORDER BY name");
      return send(200, rows);
    }
    if (b === "payment-methods" && method === "GET")
      return send(200, all(`SELECT id,name,kind,pay_number,pay_holder,pay_bank,pay_link,pay_instructions,requires_proof
        FROM payment_methods WHERE active=1 ORDER BY sort_order, name`));
    if (b === "zones" && method === "GET")
      return send(200, all("SELECT id,name,fee,eta,notes FROM zones WHERE active=1 ORDER BY sort_order, name"));
    if (b === "promotions" && method === "GET") {
      const now = today();
      return send(200, all("SELECT id,name,kind,value,code,start_at,end_at,min_order FROM promotions WHERE active=1 AND (start_at IS NULL OR start_at<=?) AND (end_at IS NULL OR end_at>=?)", now, now));
    }
    if (b === "register" && method === "POST") {
      if (!body.phone || !body.name) return send(400, { error: "الاسم ورقم الهاتف مطلوبان" });
      let custRow = one("SELECT * FROM customers WHERE phone=?", body.phone);
      if (custRow) {
        if (body.address) run("UPDATE customers SET address=?, name=COALESCE(?,name) WHERE id=?", body.address, body.name || null, custRow.id);
      } else {
        const r = run("INSERT INTO customers(name,phone,address,created_at) VALUES(?,?,?,?)", body.name, body.phone, body.address || "", nowISO());
        custRow = one("SELECT * FROM customers WHERE id=?", r.lastInsertRowid);
      }
      const token = "ck" + require("crypto").randomBytes(24).toString("hex");
      run("INSERT INTO sessions(token,kind,customer_id,created_at) VALUES(?,?,?,?)", token, "customer", custRow.id, nowISO());
      return send(200, { token, customer: custRow });
    }
    if (b === "login" && method === "POST") {
      const custRow = one("SELECT * FROM customers WHERE phone=?", body.phone);
      if (!custRow) return send(400, { error: "رقم الهاتف غير مسجل — سجّل من فضلك" });
      const token = "ck" + require("crypto").randomBytes(24).toString("hex");
      run("INSERT INTO sessions(token,kind,customer_id,created_at) VALUES(?,?,?,?)", token, "customer", custRow.id, nowISO());
      return send(200, { token, customer: custRow });
    }
    if (b === "me" && method === "GET") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      const rewards = all("SELECT * FROM rewards WHERE customer_id=? AND active=1", cust.id);
      return send(200, { ...cust, rewards });
    }
    if (b === "quote" && method === "POST") {
      try { return send(200, quoteCart(body.items, body.promo_code, body.zone_id)); }
      catch (e) { return send(400, { error: e.message }); }
    }
    if (b === "orders" && !c && method === "POST") {
      try { return send(200, createStoreOrder(session, body)); }
      catch (e) { return send(400, { error: e.message }); }
    }
    if (b === "orders" && !c && method === "GET") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      const rows = all("SELECT * FROM orders WHERE customer_id=? ORDER BY id DESC", cust.id).map(o => ({ ...o, items: all("SELECT * FROM order_items WHERE order_id=?", o.id) }));
      return send(200, rows);
    }
    if (b === "orders" && c && method === "GET") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      try { return send(200, orderDetail(Number(c), cust.id)); } catch (e) { return send(400, { error: e.message }); }
    }
    if (b === "orders" && c && d === "rate" && method === "POST") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      const o = one("SELECT * FROM orders WHERE id=? AND customer_id=?", c, cust.id);
      if (!o) return send(404, { error: "الطلب غير موجود" });
      if (o.status !== "delivered") return send(400, { error: "لا يمكن التقييم قبل استلام الطلب" });
      const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
      run("UPDATE orders SET rating=?, rating_comment=? WHERE id=?", rating, body.comment || "", o.id);
      const avg = one("SELECT AVG(rating) a FROM orders WHERE customer_id=? AND rating IS NOT NULL", cust.id).a;
      run("UPDATE customers SET rating=? WHERE id=?", Math.round((avg || rating) * 10) / 10, cust.id);
      return send(200, { ok: true });
    }
    if (b === "orders" && c && d === "proof" && method === "POST") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      const o = one("SELECT * FROM orders WHERE id=? AND customer_id=?", c, cust.id);
      if (!o) return send(404, { error: "الطلب غير موجود" });
      if (o.status === "cancelled" || o.status === "delivered") return send(400, { error: "لا يمكن إضافة إثبات دفع لهذا الطلب" });
      const pmRow = o.payment_method_id ? one("SELECT * FROM payment_methods WHERE id=?", o.payment_method_id) : null;
      if (!pmRow || pmRow.kind === "cash") return send(400, { error: "هذا الطلب بالدفع عند الاستلام — لا يحتاج إثبات تحويل" });
      if (o.proof_status === "approved") return send(400, { error: "تم اعتماد إثبات هذا الطلب بالفعل" });
      try {
        const pid = saveProof(o.id, { method_id: pmRow.id, method_name: pmRow.name,
          amount: body.amount || o.total, txn_ref: body.txn_ref, paid_at: body.paid_at, note: body.note,
          image: body.image, image_name: body.image_name, image_mime: body.image_mime });
        run("UPDATE orders SET proof_status='pending', proof_id=?, updated_at=? WHERE id=?", pid, nowISO(), o.id);
        run("INSERT INTO order_events(order_id,status,note,at) VALUES(?,?,?,?)", o.id, o.status,
          `📤 العميل أرسل إثبات دفع جديد بمبلغ ${money(body.amount || o.total)}`, nowISO());
        return send(200, orderDetail(o.id, cust.id));
      } catch (e) { return send(400, { error: e.message }); }
    }
    if (b === "rewards" && method === "GET") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      return send(200, all("SELECT * FROM rewards WHERE customer_id=? AND active=1", cust.id));
    }
    /* ---- إشعارات العميل ---- */
    if (b === "notifications" && !c && method === "GET") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      const rows = all(`SELECT n.*, n.is_read AS \`read\`, o.code _order_code, o.status _order_status
        FROM notifications n LEFT JOIN orders o ON o.id=n.order_id
        WHERE n.customer_id=? ORDER BY n.id DESC LIMIT 100`, cust.id);
      const unread = Number((one("SELECT COUNT(*) c FROM notifications WHERE customer_id=? AND is_read=0", cust.id) || {}).c || 0);
      return send(200, { rows, unread });
    }
    if (b === "notifications" && c === "read-all" && method === "POST") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      run("UPDATE notifications SET is_read=1 WHERE customer_id=? AND is_read=0", cust.id);
      return send(200, { ok: true, unread: 0 });
    }
    if (b === "notifications" && c && d === "read" && method === "POST") {
      if (!cust) return send(401, { error: "غير مسجل الدخول" });
      run("UPDATE notifications SET is_read=1 WHERE id=? AND customer_id=?", Number(c), cust.id);
      const unread = Number((one("SELECT COUNT(*) c FROM notifications WHERE customer_id=? AND is_read=0", cust.id) || {}).c || 0);
      return send(200, { ok: true, unread });
    }
  }

  /* ---- reports ---- */
  if (a === "reports") {
    if (!staff) return send(401, { error: "غير مصرح" });
    if (!can(staff, "reports", "view") && !can(staff, "dashboard", "view") && b === "dashboard")
      return send(403, { error: "لا تملك صلاحية" });
    if (!can(staff, "reports", "view") && b !== "dashboard") return send(403, { error: "لا تملك صلاحية التقارير" });
    const fn = REPORTS[b];
    if (!fn) return send(404, { error: "تقرير غير موجود" });
    try {
      const out = fn(Object.fromEntries(q));
      out.report = b;
      return send(200, out);
    } catch (e) { return send(500, { error: e.message }); }
  }

  /* ---- meta ---- */
  if (a === "meta") {
    if (b === "permissions") return send(200, { keys: PERM_KEYS });
    if (b === "role-templates") {
      // حساب الصلاحيات على الخادم — لأن الدوال لا تنتقل عبر JSON
      const tpls = ROLE_TEMPLATES.map(tp => ({ key: tp.key, icon: tp.icon, name: tp.name, desc: tp.desc, perms: tp.perms() }));
      return send(200, { templates: tpls });
    }
    if (b === "enums") {
      return send(200, {
        order_status: [["new", "جديد"], ["confirmed", "تم التأكيد"], ["preparing", "قيد التجهيز"], ["delivering", "في التوصيل"], ["delivered", "تم التسليم"], ["cancelled", "ملغي"]],
        move_types: [["purchase", "شراء"], ["sale", "بيع"], ["adjust", "تسوية"], ["in", "إضافة"], ["out", "صرف"], ["count", "جرد"]],
      });
    }
    if (b === "company") return send(200, one("SELECT * FROM company WHERE id=1"));
  }

  /* ---- special actions ---- */
  if (a === "orders" && b && c === "status" && method === "POST") {
    if (!staff || !can(staff, "orders", "update")) return send(403, { error: "لا تملك صلاحية" });
    try {
      applyOrderStatus(Number(b), body.status, staff, body.paid);
      if (body.pilot_id !== undefined) run("UPDATE orders SET pilot_id=? WHERE id=?", body.pilot_id || null, b);
      return send(200, one("SELECT * FROM orders WHERE id=?", b));
    } catch (e) { return send(400, { error: e.message }); }
  }
  if (a === "purchases" && b && c === "approve" && method === "POST") {
    if (!staff || !can(staff, "purchases", "update")) return send(403, { error: "لا تملك صلاحية" });
    try { approvePurchase(Number(b), staff); return send(200, one("SELECT * FROM purchases WHERE id=?", b)); }
    catch (e) { return send(400, { error: e.message }); }
  }
  if (a === "stock_counts" && b && c === "approve" && method === "POST") {
    if (!staff || !can(staff, "stock_counts", "update")) return send(403, { error: "لا تملك صلاحية" });
    try { approveStockCount(Number(b), staff, body.items); return send(200, { ok: true }); }
    catch (e) { return send(400, { error: e.message }); }
  }
  if (a === "vouchers" && b && c === "approve" && method === "POST") {
    if (!staff || !can(staff, "vouchers", "update")) return send(403, { error: "لا تملك صلاحية" });
    try { approveVoucher(Number(b), staff); return send(200, one("SELECT * FROM vouchers WHERE id=?", b)); }
    catch (e) { return send(400, { error: e.message }); }
  }
  if (a === "inventory" && b === "adjust" && method === "POST") {
    if (!staff || !can(staff, "inventory", "create")) return send(403, { error: "لا تملك صلاحية" });
    try {
      const mv = addMove({ product_id: body.product_id, branch_id: body.branch_id || null, type: body.type || "adjust", qty: Number(body.qty) || 0, ref: body.ref || "تسوية يدوية", note: body.note || "", user_id: staff.id });
      const p = one("SELECT cost FROM products WHERE id=?", body.product_id);
      const val = money(Math.abs(Number(body.qty) || 0) * (p ? p.cost : 0));
      const acc = k => one("SELECT id FROM accounts WHERE code=?", k).id;
      if (val > 0 && (body.type || "adjust") !== "sale" && (body.type || "adjust") !== "purchase") {
        const up = Number(body.qty) > 0;
        postJournal({ date: today(), ref_type: "adjust", memo: "تسوية مخزون — " + (body.note || ""), lines: up
          ? [{ account_id: acc("1200"), debit: val }, { account_id: acc("5100"), credit: val }]
          : [{ account_id: acc("5100"), debit: val }, { account_id: acc("1200"), credit: val }] });
      }
      return send(200, mv);
    } catch (e) { return send(400, { error: e.message }); }
  }
  if (a === "stock_counts" && b && c === "preview" && method === "GET") {
    if (!staff) return send(401, { error: "غير مصرح" });
    const count = one("SELECT * FROM stock_counts WHERE id=?", b);
    const items = all("SELECT sc.*, p.name, p.unit, p.cost FROM stock_count_items sc LEFT JOIN products p ON p.id=sc.product_id WHERE sc.count_id=?", b);
    const products = all("SELECT id,name,unit,stock,cost FROM products WHERE active=1 ORDER BY name");
    return send(200, { count, items, products });
  }
  if (a === "pilots" && b && c === "orders" && method === "GET") {
    if (!staff || !can(staff, "pilots", "view")) return send(403, { error: "لا تملك صلاحية" });
    return send(200, all(`SELECT o.*, cu.name customer FROM orders o LEFT JOIN customers cu ON cu.id=o.customer_id WHERE o.pilot_id=? ORDER BY o.id DESC`, b));
  }
  if (a === "orders" && b && !c && method === "GET") {
    if (!staff || !can(staff, "orders", "view")) return send(403, { error: "لا تملك صلاحية" });
    try { return send(200, orderDetail(Number(b))); } catch (e) { return send(400, { error: e.message }); }
  }

  /* ---- إثباتات الدفع (مراجعة الإدارة) ---- */
  if (a === "payment_proofs" && !b && method === "GET") {
    if (!staff || !can(staff, "payment_proofs", "view")) return send(403, { error: "لا تملك صلاحية" });
    return send(200, { rows: listProofs(Object.fromEntries(q)), summary: proofStats() });
  }
  if (a === "payment_proofs" && b === "stats" && method === "GET") {
    if (!staff || !can(staff, "payment_proofs", "view")) return send(403, { error: "لا تملك صلاحية" });
    return send(200, proofStats());
  }
  if (a === "payment_proofs" && b && c === "approve" && method === "POST") {
    if (!staff || !can(staff, "payment_proofs", "update")) return send(403, { error: "لا تملك صلاحية" });
    try { return send(200, approveProof(Number(b), staff)); } catch (e) { return send(400, { error: e.message }); }
  }
  if (a === "payment_proofs" && b && c === "reject" && method === "POST") {
    if (!staff || !can(staff, "payment_proofs", "update")) return send(403, { error: "لا تملك صلاحية" });
    try { return send(200, rejectProof(Number(b), body.reason, staff)); } catch (e) { return send(400, { error: e.message }); }
  }

  /* ---- العملاء المميزون (VIP) — ترتيب حسب المعاملات أو قيمة المشتريات ---- */
  if (a === "customers" && b === "vip" && method === "GET") {
    if (!staff || !can(staff, "customers", "view")) return send(403, { error: "لا تملك صلاحية" });
    const rows = all(`
      SELECT c.id, c.name, c.phone, c.address, c.points, c.rating, c.zone_id,
             z.name zone_name,
             (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND o.status<>'cancelled') cnt,
             (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.customer_id=c.id AND o.status<>'cancelled') spent,
             (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND o.status='cancelled') cancelled,
             (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id=c.id) last_order,
             (SELECT COUNT(*) FROM rewards r WHERE r.customer_id=c.id AND r.active=1) gifts
      FROM customers c LEFT JOIN zones z ON z.id=c.zone_id`);
    for (const r of rows) {
      r.cnt = Number(r.cnt) || 0;
      r.spent = money(r.spent);
      r.avg = r.cnt ? money(r.spent / r.cnt) : 0;
      r.tier = vipTier(r.spent, r.cnt);
    }
    const sort = q.get("sort") || "spent";
    const dir = q.get("dir") === "asc" ? 1 : -1;
    const key = { spent: "spent", count: "cnt", avg: "avg", last: "last_order", gifts: "gifts" }[sort] || "spent";
    const minTier = q.get("tier") || "";
    const rank = { gold: 3, silver: 2, bronze: 1, normal: 0 };
    let list = rows.filter(r => !minTier || rank[r.tier] >= rank[minTier]);
    list.sort((a, b2) => {
      const x = a[key], y = b2[key];
      if (x === y) return b2.spent - a.spent;
      return (x > y ? 1 : -1) * dir;
    });
    list.forEach((r, i) => { r.rank = i + 1; });
    const bySpent = [...rows].sort((a, b2) => b2.spent - a.spent).slice(0, 10);
    return send(200, {
      rows: list,
      summary: {
        total: rows.length,
        gold: rows.filter(r => r.tier === "gold").length,
        silver: rows.filter(r => r.tier === "silver").length,
        bronze: rows.filter(r => r.tier === "bronze").length,
        revenue: money(rows.reduce((s, r) => s + r.spent, 0)),
        orders: rows.reduce((s, r) => s + r.cnt, 0),
      },
      top: bySpent.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, spent: r.spent, cnt: r.cnt, tier: r.tier })),
      tiers: VIP_TIERS,
    });
  }

  /* ---- النسخ الاحتياطي لقاعدة البيانات ---- */
  if (a === "system" && b === "backup" && (!c || c === "list") && method === "GET") {
    if (!staff || !can(staff, "settings", "view")) return send(403, { error: "لا تملك صلاحية" });
    const dirs = backupDirs();
    let dbSize = fileSize(DB_PATH);
    if (DB_KIND === "mysql") {
      try {
        const r = one("SELECT ROUND(SUM(data_length + index_length)) size FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
        dbSize = Number(r && r.size) || 0;
      } catch (e) { dbSize = 0; }
    }
    return send(200, {
      backups: listBackups(),
      dirs: dirs.map(x => ({ id: x.id, path: x.path, note: x.note || "", is_default: x.is_default ? 1 : 0, writable: dirWritable(x.path) })),
      dir: (dirs[0] || {}).path,
      db_size: dbSize,
    });
  }
  /* تصفح مجلدات الجهاز لاختيار وجهة النسخ الاحتياطي */
  if (a === "system" && b === "backup" && c === "browse" && method === "GET") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    let p = String(q.get("path") || "").trim();
    if (!p) p = backupDir();
    try {
      const st = fs.statSync(p);
      if (!st.isDirectory()) return send(400, { error: "هذا ليس مجلدًا" });
      const dirs = [];
      for (const f of fs.readdirSync(p)) {
        if (f.startsWith(".")) continue;
        let isDir = false;
        try { isDir = fs.statSync(path.join(p, f)).isDirectory(); } catch (e) { isDir = false; }
        if (isDir) dirs.push(f);
      }
      dirs.sort();
      return send(200, {
        path: p,
        parent: path.dirname(p) === p ? "" : path.dirname(p),
        dirs,
        writable: dirWritable(p),
        registered: backupDirs().map(x => x.path),
      });
    } catch (e) { return send(400, { error: "تعذّر فتح المجلد: " + e.message }); }
  }
  /* تسجيل وجهة نسخ احتياطي جديدة (يختارها المستخدم) */
  if (a === "system" && b === "backup" && c === "location" && (!d || d === "add") && method === "POST") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    let p = String((body && body.path) || "").trim();
    if (!p) return send(400, { error: "حدّد مسار مجلد" });
    try { p = path.resolve(p); } catch (e) { return send(400, { error: "مسار غير صالح" }); }
    if (!fs.existsSync(p)) { try { fs.mkdirSync(p, { recursive: true }); } catch (e) { return send(400, { error: "تعذّر إنشاء المجلد: " + e.message }); } }
    if (!fs.statSync(p).isDirectory()) return send(400, { error: "هذا ليس مجلدًا" });
    if (!dirWritable(p)) return send(400, { error: "المجلد غير صالح للكتابة" });
    if (one("SELECT id FROM backup_dirs WHERE path=?", p)) return send(400, { error: "هذا المجلد مسجّل بالفعل" });
    const r = run("INSERT INTO backup_dirs(path,note,created_at) VALUES(?,?,?)", p, body && body.note || "", nowISO());
    audit(staff, "إضافة مجلد نسخ احتياطي", "النظام", r.lastInsertRowid, p);
    return send(200, { ok: true, id: r.lastInsertRowid, dirs: backupDirs() });
  }
  if (a === "system" && b === "backup" && c === "location" && d && method === "DELETE") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    const row = one("SELECT * FROM backup_dirs WHERE id=?", d);
    if (!row) return send(404, { error: "المجلد غير مسجّل" });
    if (row.is_default) return send(400, { error: "لا يمكن حذف المجلد الافتراضي" });
    run("DELETE FROM backup_dirs WHERE id=?", row.id);
    audit(staff, "إزالة مجلد نسخ احتياطي", "النظام", row.id, row.path);
    return send(200, { ok: true, dirs: backupDirs() });
  }
  if (a === "system" && b === "backup" && c === "create" && method === "POST") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية إنشاء نسخة احتياطية" });
    try { return send(200, createBackup(staff, body && body.note, body && body.dir_id)); }
    catch (e) { return send(500, { error: "فشل إنشاء النسخة الاحتياطية: " + e.message }); }
  }
  if (a === "system" && b === "backup" && c === "restore" && method === "POST") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    const f = locateBackup(body && body.d, body && body.name);
    if (!f || !fs.existsSync(f)) return send(404, { error: "النسخة غير موجودة" });
    try { return send(200, restoreBackupFile(staff, f, body && body.name)); }
    catch (e) { return send(500, { error: "فشل الاسترجاع: " + e.message }); }
  }
  /* استعادة من ملف يرفعه المستخدم مباشرةً (نسخة خارجية) */
  if (a === "system" && b === "backup" && c === "restore-upload" && method === "POST") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    const raw = String((body && body.data) || "").replace(/^data:[^;]+;base64,/, "");
    if (!raw) return send(400, { error: "لم يتم إرسال ملف النسخة" });
    let buf;
    try { buf = Buffer.from(raw, "base64"); } catch (e) { return send(400, { error: "تعذر قراءة الملف" }); }
    if (!buf.length) return send(400, { error: "ملف النسخة فارغ" });
    const original = String((body && body.name) || "uploaded").replace(/[\\/:*?"<>|]+/g, "-").slice(-90) || "uploaded";
    const ext = DB_KIND === "mysql" ? ".json" : ".db";
    const dir = backupDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const target = path.join(dir, `uploaded-${stamp}${ext}`);
    fs.writeFileSync(target, buf);
    if (DB_KIND === "mysql") {
      try {
        const data = JSON.parse(buf.toString("utf8"));
        if (!data || typeof data.tables !== "object" || !Object.keys(data.tables).length) throw new Error("الملف لا يحتوي على جداول");
      } catch (e) {
        try { fs.unlinkSync(target); } catch (e2) { /* تجاهل */ }
        return send(400, { error: "ملف JSON غير صالح: " + e.message });
      }
    } else if (buf.slice(0, 16).toString("utf8") !== "SQLite format 3\u0000") {
      try { fs.unlinkSync(target); } catch (e) { /* تجاهل */ }
      return send(400, { error: "الملف ليس قاعدة بيانات SQLite صالحة" });
    }
    try {
      const out = restoreBackupFile(staff, target, original);
      return send(200, { ...out, saved: path.basename(target) });
    } catch (e) { return send(500, { error: "فشل الاستعادة: " + e.message }); }
  }
  if (a === "system" && b === "backup" && c && d === "download" && method === "GET") {
    if (!staff || !can(staff, "settings", "view")) return send(403, { error: "لا تملك صلاحية" });
    const f = locateBackup(q.get("d"), c);
    if (!f || !fs.existsSync(f)) return send(404, { error: "الملف غير موجود" });
    /* اسم الملف قد يحتوي حروفًا عربية → نستخدم صيغة RFC 5987 مع بديل ASCII */
    const ascii = c.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
    const cd = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(c)}`;
    return send(200, fs.readFileSync(f), "application/octet-stream", { "Content-Disposition": cd });
  }
  if (a === "system" && b === "backup" && c && method === "DELETE") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    const f = locateBackup(q.get("d"), c);
    if (!f || !fs.existsSync(f)) return send(404, { error: "الملف غير موجود" });
    fs.unlinkSync(f);
    audit(staff, "حذف نسخة احتياطية", "النظام", null, c);
    return send(200, { ok: true });
  }
  /* ---- data tools: truncate + trash/restore ---- */
  if (a === "data-tools") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    const PROTECTED = new Set(["users", "sessions", "counters", "company", "audit_log"]);
    const LABELS = {
      branches: "الفروع", users: "المستخدمون", pilots: "الطيارون", suppliers: "الموردون",
      customers: "العملاء", categories: "الأقسام", products: "الأصناف", inventory_moves: "حركات المخزون",
      purchases: "المشتريات", purchase_items: "بنود المشتريات", payment_methods: "وسائل الدفع",
      orders: "الطلبات", order_items: "بنود الطلبات", order_events: "أحداث الطلبات",
      promotions: "العروض", rewards: "المكافآت", ads: "الإعلانات", accounts: "الحسابات",
      journals: "القيود", journal_lines: "بنود القيود", cash_accounts: "الخزائن",
      vouchers: "السندات", stock_counts: "الجرد", stock_count_items: "بنود الجرد",
      audit_log: "سجل التدقيق", password_history: "سجل كلمات المرور", zones: "المناطق",
      units: "الوحدات", backup_dirs: "مجلدات النسخ", payment_proofs: "إثباتات الدفع",
    };
    if (method === "GET" && !b) {
      const tables = all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .map((t) => {
          let rows = 0;
          try { rows = one(`SELECT COUNT(*) c FROM "${t.name}"`).c; } catch (e) {}
          return { name: t.name, label: LABELS[t.name] || t.name, rows, protected: PROTECTED.has(t.name) };
        });
      return send(200, { tables });
    }
    if (b === "truncate" && method === "POST") {
      const known = new Set(all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map((t) => t.name));
      const selected = (Array.isArray(body.tables) ? body.tables.map(String) : []).filter((t) => known.has(t) && !PROTECTED.has(t));
      if (!selected.length) return send(400, { error: "اختر جدولًا واحدًا على الأقل (الجداول المحمية لا يمكن تفريغها)" });
      const children = new Map();
      for (const t of known) {
        let fks = [];
        try { fks = all(`PRAGMA foreign_key_list("${t}")`); } catch (e) {}
        for (const fk of fks) {
          if (!children.has(fk.table)) children.set(fk.table, new Set());
          children.get(fk.table).add(t);
        }
      }
      const allSel = new Set(selected);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of [...allSel]) {
          for (const c2 of children.get(t) || []) {
            if (!allSel.has(c2) && !PROTECTED.has(c2)) { allSel.add(c2); grew = true; }
          }
        }
      }
      const ordered = [], seen = new Set();
      const visit = (t) => {
        if (seen.has(t)) return;
        seen.add(t);
        for (const c2 of children.get(t) || []) if (allSel.has(c2)) visit(c2);
        ordered.push(t);
      };
      [...allSel].forEach(visit);
      const cleared = [];
      for (const t of ordered) {
        try { run(`DELETE FROM "${t}"`); cleared.push(t); } catch (e) {}
      }
      audit(staff, "تفريغ جداول", "النظام", null, cleared.join(", "));
      return send(200, { message: "تم تفريغ الجداول المحددة", cleared });
    }
  }

  if (a === "trash") {
    if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
    const TRASHABLE = {};
    for (const [key, R2] of Object.entries(RESOURCES)) {
      if (!R2.single && tableHasCol(R2.table, "active")) {
        TRASHABLE[key] = { table: R2.table, label: R2.title || key, col: R2.fields?.find((f) => f.name === "name") ? "name" : (tableHasCol(R2.table, "name") ? "name" : "id") };
      }
    }
    if (method === "GET" && !b) {
      const groups = [];
      for (const [key, cfg] of Object.entries(TRASHABLE)) {
        let rows = [];
        try { rows = all(`SELECT id, ${cfg.col} AS name, created_at FROM "${cfg.table}" WHERE active = 0 ORDER BY id DESC LIMIT 300`); } catch (e) {}
        groups.push({ entity: key, label: cfg.label, rows });
      }
      return send(200, { groups, total: groups.reduce((n, g) => n + g.rows.length, 0) });
    }
    const cfg = TRASHABLE[b];
    if (!cfg) return send(404, { error: "نوع غير معروف" });
    const itemId = Number(c);
    if (!itemId) return send(400, { error: "معرّف غير صالح" });
    const row = one(`SELECT * FROM "${cfg.table}" WHERE id = ?`, itemId);
    if (!row) return send(404, { error: "العنصر غير موجود" });
    if (method === "POST" && d === "restore") {
      run(`UPDATE "${cfg.table}" SET active = 1 WHERE id = ?`, itemId);
      audit(staff, "استعادة", cfg.label, itemId, row[cfg.col] || "");
      return send(200, { message: "تمت الاستعادة" });
    }
    if (method === "DELETE") {
      try { run(`DELETE FROM "${cfg.table}" WHERE id = ?`, itemId); }
      catch (e) { return send(409, { error: "لا يمكن الحذف النهائي لوجود بيانات مرتبطة" }); }
      audit(staff, "حذف نهائي", cfg.label, itemId, row[cfg.col] || "");
      return send(200, { message: "تم الحذف النهائي" });
    }
  }

  /* ---- generic CRUD ---- */
  const R = RESOURCES[a];
  if (R) {
    if (!staff) return send(401, { error: "غير مصرح — هذه شاشة المستخدمين" });
    const perm = R.perm || a;
    /* ---- مورد مفرد (مثل بيانات الشركة): صف واحد فقط ---- */
    if (R.single) {
      const row = one(`SELECT * FROM ${R.table} LIMIT 1`);
      if (method === "GET") {
        /* بيانات الشركة العامة — أي موظف مسجّل يقرأها (كاسم المتجر/الشعار في الشريط الجانبي) */
        return send(200, row || {});
      }
      if ((method === "PUT" || method === "POST") && row) {
        if (!can(staff, perm, "update")) return send(403, { error: "لا تملك صلاحية التعديل" });
        try {
          const data = pickFields(body, R.fields);
          const cols = Object.keys(data);
          if (cols.length) run(`UPDATE ${R.table} SET ${cols.map(c => `${c}=?`).join(",")} WHERE id=?`, ...cols.map(c => data[c]), row.id);
          auditRow(a, "تعديل", row.id, staff, auditDetail(a, data));
          return send(200, one(`SELECT * FROM ${R.table} WHERE id=?`, row.id));
        } catch (e) { return send(400, { error: e.message }); }
      }
    }
    if (method === "GET" && !b) {
      if (!can(staff, perm, "view")) return send(403, { error: "لا تملك صلاحية العرض" });
      const out = listRows(a, Object.fromEntries(q));
      if (a === "pilots") out.rows.forEach(rw => { rw.orders = one("SELECT COUNT(*) c FROM orders WHERE pilot_id=?", rw.id).c; });
      if (a === "orders") {
        const custs = all("SELECT id,name FROM customers"), pilots = all("SELECT id,name FROM pilots"), pms = all("SELECT id,name FROM payment_methods"), zns = all("SELECT id,name FROM zones");
        out.rows.forEach(rw => {
          rw.customer = (custs.find(x => x.id === rw.customer_id) || {}).name || "";
          rw.pilot = (pilots.find(x => x.id === rw.pilot_id) || {}).name || "";
          rw.payment = (pms.find(x => x.id === rw.payment_method_id) || {}).name || "";
          rw._zone = (zns.find(x => x.id === rw.zone_id) || {}).name || "";
          rw.zone = rw._zone;
        });
      }
      if (a === "customers") {
        const zns = all("SELECT id,name FROM zones");
        const agg = all(`SELECT customer_id, COUNT(*) cnt, COALESCE(SUM(total),0) spent FROM orders WHERE customer_id IS NOT NULL AND status<>'cancelled' GROUP BY customer_id`);
        const amap = new Map(agg.map(x => [x.customer_id, x]));
        out.rows.forEach(rw => {
          rw._pname = rw.name;
          rw._zone = (zns.find(x => x.id === rw.zone_id) || {}).name || "";
          const g = amap.get(rw.id) || { cnt: 0, spent: 0 };
          rw.live_orders = Number(g.cnt) || 0;
          rw.live_spent = money(g.spent);
          rw._tier = vipTier(rw.live_spent, rw.live_orders);
        });
      }
      if (a === "users") out.rows.forEach(rw => { delete rw.password; });
      if (a === "rewards") {
        const cs = all("SELECT id,name FROM customers");
        out.rows.forEach(rw => { rw._cname = (cs.find(x => x.id === rw.customer_id) || {}).name || ""; });
      }
      return send(200, out);
    }
    if (method === "GET" && b) {
      if (!can(staff, perm, "view")) return send(403, { error: "لا تملك صلاحية العرض" });
      if (R.special === "purchases") {
        const row = one(`SELECT * FROM ${R.table} WHERE id=?`, b);
        if (!row) return send(404, { error: "غير موجود" });
        row.items = all("SELECT * FROM purchase_items WHERE purchase_id=?", b);
        return send(200, row);
      }
      const row = one(`SELECT * FROM ${R.table} WHERE id=?`, b);
      if (!row) return send(404, { error: "غير موجود" });
      if (R.special === "journals") row.lines = all("SELECT * FROM journal_lines WHERE journal_id=?", b);
      if (R.special === "vouchers") row.journal = row.journal_id ? all("SELECT * FROM journal_lines WHERE journal_id=?", row.journal_id) : [];
      if (R.special === "stock_counts") row.items = all("SELECT sc.*, p.name, p.unit FROM stock_count_items sc LEFT JOIN products p ON p.id=sc.product_id WHERE sc.count_id=?", b);
      return send(200, stripSecret(a, row));
    }
    if (method === "POST" && !b) {
      if (!can(staff, perm, "create")) return send(403, { error: "لا تملك صلاحية الإضافة" });
      try { return send(200, stripSecret(a, insertRow(a, body, staff))); } catch (e) { return send(400, { error: e.message }); }
    }
    if (method === "PUT" && b) {
      if (!can(staff, perm, "update")) return send(403, { error: "لا تملك صلاحية التعديل" });
      try { return send(200, stripSecret(a, updateRow(a, b, body, staff))); } catch (e) { return send(400, { error: e.message }); }
    }
    if (method === "DELETE" && b) {
      if (!can(staff, perm, "delete")) return send(403, { error: "لا تملك صلاحية الحذف" });
      try { return send(200, deleteRow(a, b, staff)); } catch (e) { return send(400, { error: e.message }); }
    }
  }

  /* ---- company singleton ---- */
  if (a === "company") {
    if (method === "GET") return send(200, one("SELECT * FROM company WHERE id=1"));
    if (method === "PUT") {
      if (!staff || !can(staff, "settings", "update")) return send(403, { error: "لا تملك صلاحية" });
      const fields = RESOURCES.company.fields;
      const data = pickFields(body, fields);
      const cols = Object.keys(data);
      if (cols.length) run(`UPDATE company SET ${cols.map(c => `${c}=?`).join(",")} WHERE id=1`, ...cols.map(c => data[c]));
      return send(200, one("SELECT * FROM company WHERE id=1"));
    }
  }

  /* ---- extra relations for dynamic selects ---- */
  if (a === "options" && method === "GET") {
    if (!staff) return send(401, { error: "غير مصرح" });
    const what = q.get("of");
    let rows = [];
    if (what === "customers") rows = all("SELECT id,name,phone FROM customers ORDER BY name");
    else if (what === "suppliers") rows = all("SELECT id,name FROM suppliers ORDER BY name");
    else if (what === "pilots") rows = all("SELECT id,name FROM pilots ORDER BY name");
    else if (what === "accounts") rows = all("SELECT id,code,name,type,balance FROM accounts ORDER BY code");
    else if (what === "cash_accounts") rows = all("SELECT id,kind,name,balance FROM cash_accounts ORDER BY name");
    else if (what === "products") rows = all("SELECT id,name,price,stock FROM products ORDER BY name");
    else if (what === "branches") rows = all("SELECT id,name FROM branches ORDER BY name");
    else if (what === "categories") rows = all("SELECT id,name FROM categories ORDER BY name");
    else if (what === "payment_methods") rows = all("SELECT id,name FROM payment_methods ORDER BY sort_order");
    else if (what === "zones") rows = all("SELECT id,name,fee FROM zones WHERE active=1 ORDER BY sort_order, name");
    else if (what === "units") rows = all("SELECT id,name,symbol FROM units WHERE active=1 ORDER BY sort_order, name");
    return send(200, rows);
  }

  /* ---- audit log (سجل النشاط) ---- */
  if (a === "audit" && method === "GET") {
    if (!staff || !can(staff, "users", "view")) return send(403, { error: "لا تملك صلاحية" });
    const limit = Math.min(500, parseInt(q.get("limit")) || 200);
    const search = (q.get("search") || "").trim();
    const fa = (q.get("fv_action") || "").trim();
    let w = "", ps = [];
    if (search) { w = " WHERE (user_name LIKE ? OR entity LIKE ? OR detail LIKE ?)"; ps = ["%"+search+"%", "%"+search+"%", "%"+search+"%"]; if (fa) { w += " AND action=?"; ps.push(fa); } }
    else if (fa) { w = " WHERE action=?"; ps.push(fa); }
    const total = one(`SELECT COUNT(*) c FROM audit_log${w}`, ...ps).c;
    const rows = all(`SELECT * FROM audit_log${w} ORDER BY id DESC LIMIT ?`, ...ps, limit);
    return send(200, { rows, total, page: 1, pages: 1 });
  }

  return false; // not handled
}


module.exports = { RESOURCES, PERM_KEYS, findSession, can, handleApi, approvePurchase, approveVoucher, approveStockCount, applyOrderStatus, listRows, approveProof, rejectProof, listProofs, proofStats };
