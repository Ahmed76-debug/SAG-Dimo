/* ============================================================
   طلباتك — Admin: NAV + MODULES declarative configs
   ============================================================ */
(function () {
  "use strict";
  const STATUS = {
    new: ["جديد", "badge-primary"], confirmed: ["تم التأكيد", "badge-info"], preparing: ["قيد التجهيز", "badge-warning"],
    delivering: ["في التوصيل", "badge-primary"], delivered: ["تم التسليم", "badge-success"], cancelled: ["ملغي", "badge-danger"],
  };
  const MSTATUS = { draft: ["مسودة", "badge-muted"], approved: ["معتمد", "badge-success"], cancelled: ["ملغي", "badge-danger"] };
  window.STATUS = STATUS;

  /* ---------------- طبقات العملاء المميزين (متطابقة مع الخادم) ---------------- */
  const VIP_TIERS = [
    { key: "gold", name: "ذهبي", icon: "🥇", cls: "vip-gold", min_spent: 1000, min_orders: 4 },
    { key: "silver", name: "فضي", icon: "🥈", cls: "vip-silver", min_spent: 500, min_orders: 3 },
    { key: "bronze", name: "برونزي", icon: "🥉", cls: "vip-bronze", min_spent: 250, min_orders: 2 },
  ];
  window.VIP_TIERS = VIP_TIERS;
  window.vipTier = (spent, cnt) => VIP_TIERS.find(t => Number(spent) >= t.min_spent || Number(cnt) >= t.min_orders) || null;
  window.vipBadge = (spent, cnt) => {
    const t = window.vipTier(spent, cnt);
    return t ? `<span class="badge vip-badge ${t.cls}">${t.icon} ${t.name}</span>` : `<span class="badge badge-muted">عادي</span>`;
  };
  /** شارة من مفتاح الطبقة الجاهز (gold/silver/bronze) القادم من الخادم */
  window.vipBadgeKey = key => {
    const t = VIP_TIERS.find(x => x.key === key);
    return t ? `<span class="badge vip-badge ${t.cls}">${t.icon} ${t.name}</span>` : `<span class="badge badge-muted">عادي</span>`;
  };

  /* ---------------- NAV ---------------- */
  window.NAV = [
    { title: "الرئيسية", items: [
      { key: "dashboard", label: "لوحة التحكم", icon: "📊", href: "#/dashboard", perm: "dashboard" },
      { key: "orders", label: "الأوردرات", icon: "🧾", href: "#/orders", perm: "orders", badge: "pending_orders" },
      { key: "inventory", label: "المخزون", icon: "📦", href: "#/inventory", perm: "inventory", badge: "low_stock" },
    ]},
    { title: "المتجر", items: [
      { label: "الأقسام", icon: "🗂️", href: "#/module/categories", perm: "categories" },
      { label: "الأصناف", icon: "🍎", href: "#/module/products", perm: "products" },
      { label: "وحدات القياس", icon: "⚖️", href: "#/module/units", perm: "units" },
      { label: "العروض والخصومات", icon: "🏷️", href: "#/module/promotions", perm: "promotions" },
      { label: "جوائز العملاء", icon: "🎁", href: "#/module/rewards", perm: "rewards" },
      { label: "الإعلانات", icon: "📣", href: "#/module/ads", perm: "ads" },
      { label: "وسائل الدفع", icon: "💳", href: "#/module/payment_methods", perm: "payment_methods" },
      { key: "payment_proofs", label: "إثباتات الدفع", icon: "🧾", href: "#/proofs", perm: "payment_proofs", badge: "proofs_pending" },
    ]},
    { title: "العملاء والطيارون", items: [
      { label: "العملاء", icon: "👥", href: "#/module/customers", perm: "customers" },
      { label: "العملاء المميزون", icon: "🏆", href: "#/vip", perm: "customers" },
      { label: "مناطق التوصيل", icon: "🗺️", href: "#/module/zones", perm: "zones" },
      { label: "الطيارون / التوصيل", icon: "🛵", href: "#/module/pilots", perm: "pilots" },
      { label: "الموردون", icon: "🚚", href: "#/module/suppliers", perm: "suppliers" },
    ]},
    { title: "المالية والـ ERP", items: [
      { key: "erp", label: "مركز ERP للتوصيل", icon: "🧭", href: "#/erp", perm: "reports" },
      { label: "المشتريات", icon: "🛒", href: "#/purchases", perm: "purchases" },
      { label: "الجرد والتسويات", icon: "🧮", href: "#/stock-counts", perm: "stock_counts" },
      { label: "دليل الحسابات واليومية", icon: "📚", href: "#/accounting", perm: "accounting" },
      { label: "الخزائن والبنوك", icon: "🏦", href: "#/cash", perm: "cash" },
      { label: "أذون القبض والصرف", icon: "📄", href: "#/vouchers", perm: "vouchers" },
      { label: "التقارير", icon: "📈", href: "#/reports", perm: "reports" },
    ]},
    { title: "النظام", items: [
      { label: "الفروع", icon: "🏢", href: "#/module/branches", perm: "branches" },
      { label: "المستخدمون والصلاحيات", icon: "🔐", href: "#/module/users", perm: "users" },
      { label: "سجل النشاط", icon: "🕓", href: "#/audit", perm: "users" },
      { key: "backup", label: "النسخ الاحتياطي والاستعادة", icon: "🛡️", href: "#/backup", perm: "settings" },
      { label: "أدوات البيانات", icon: "🗄️", href: "#/data-tools", perm: "settings" },
      { label: "بيانات الشركة", icon: "⚙️", href: "#/settings", perm: "settings" },
    ]},
  ];

  const badge = v => (STATUS[v] || ["", "badge-muted"])[1];
  const slabel = v => (STATUS[v] || ["", ""])[0];
  const mbadge = v => (MSTATUS[v] || ["", "badge-muted"])[1];
  const mlabel = v => (MSTATUS[v] || ["", ""])[0];

  /* ---------------- MODULES ---------------- */
  window.MODULES = {
    categories: {
      title: "الأقسام الرئيسية", perm: "categories",
      columns: [
        { key: "image", label: "الصورة", type: "img" },
        { key: "name", label: "اسم القسم" },
        { key: "description", label: "الوصف", render: r => `<span class="muted">${TB.esc(r.description || "")}</span>` },
        { key: "products", label: "عدد الأصناف", render: r => TB.num(r._pc ?? "—") },
        { key: "sort_order", label: "الترتيب" },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      fields: TB.MODULES_FIELDS ? [] : undefined,
      deleteMsg: r => `حذف القسم «${r.name}»؟ لن يُحذف إلا إذا كان خالياً من الأصناف.`,
    },
    units: {
      title: "وحدات القياس", perm: "units",
      columns: [
        { key: "name", label: "الوحدة", render: r => `<b>${TB.esc(r.name)}</b> <span class="badge badge-muted mono">${TB.esc(r.symbol || "")}</span>` },
        { key: "allow_fraction", label: "تقبل كسورًا", render: r => r.allow_fraction ? '<span class="badge badge-success">نعم</span>' : '<span class="badge badge-muted">لا</span>' },
        { key: "products", label: "عدد الأصناف", render: r => `<span class="badge badge-info">${TB.num(r._pc ?? 0)}</span>` },
        { key: "sort_order", label: "الترتيب" },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      deleteMsg: r => `حذف الوحدة «${r.name}»؟ لن تُحذف إذا كانت مستخدمة في أصناف.`,
    },
    zones: {
      title: "مناطق التوصيل وأسعارها", perm: "zones",
      columns: [
        { key: "name", label: "المنطقة / الحي", render: r => `<b>${TB.esc(r.name)}</b>${r.notes ? `<div class="muted small">${TB.esc(r.notes)}</div>` : ""}` },
        { key: "fee", label: "رسوم التوصيل", type: "money" },
        { key: "eta", label: "مدة التوصيل", render: r => r.eta ? `<span class="badge badge-muted">⏱️ ${TB.esc(r.eta)}</span>` : "—" },
        { key: "customers", label: "عملاء المنطقة", render: r => `<span class="badge badge-info">${TB.num(r._cc ?? 0)}</span>` },
        { key: "orders", label: "أوردراتها", render: r => `<span class="badge badge-info">${TB.num(r._oc ?? 0)}</span>` },
        { key: "sort_order", label: "الترتيب" },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      deleteMsg: r => `حذف منطقة «${r.name}»؟ لن تُحذف إذا كانت مرتبطة بأوردرات.`,
    },
    products: {
      title: "الأصناف", perm: "products",
      filters: [{ name: "category_id", label: "كل الأقسام", resource: "categories" }, { name: "unit_id", label: "كل الوحدات", resource: "units" }],
      columns: [
        { key: "image", label: "الصورة", type: "img" },
        { key: "name", label: "الصنف" },
        { key: "price", label: "السعر", type: "money" },
        { key: "cost", label: "التكلفة", type: "money" },
        { key: "stock", label: "الرصيد", render: r => `<b class="${r.stock <= r.min_stock ? "text-danger" : ""}">${TB.num(r.stock)}</b> <small class="muted">${TB.esc(r.unit)}</small>` },
        { key: "barcode", label: "الباركود", render: r => `<span class="mono">${TB.esc(r.barcode || "")}</span>` },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      extraButtons: () => [TB.el("button", { class: "btn", onclick: () => window.openBarcodeLabels() }, "🏷️ ملصقات الباركود")],
      rowActions: [
        { icon: "🏷️", label: "باركود", perm: "products", run: r => window.printBarcodes([r]) },
      ],
      deleteMsg: r => `حذف الصنف «${r.name}»؟`,
    },
    customers: {
      title: "العملاء", perm: "customers",
      extraButtons: () => [TB.el("a", { class: "btn btn-sm btn-soft", href: "#/vip" }, "🏆 العملاء المميزون")],
      columns: [
        { key: "name", label: "العميل", render: r => `<div class="flex"><span class="avatar">${TB.esc((r.name || "?").charAt(0))}</span><b>${TB.esc(r.name)}</b></div>` },
        { key: "phone", label: "الهاتف", render: r => `<span class="mono">${TB.esc(r.phone || "")}</span>` },
        { key: "address", label: "العنوان" },
        { key: "zone", label: "منطقة التوصيل", csv: r => r._zone || "—", render: r => r._zone ? `<span class="badge badge-muted">🗺️ ${TB.esc(r._zone)}</span>` : "—" },
        { key: "orders_count", label: "الطلبات", csv: r => r.live_orders ?? r.orders_count, render: r => `<span class="badge badge-info">${TB.num(r.live_orders ?? r.orders_count)}</span>` },
        { key: "total_spent", label: "إجمالي المشتريات", type: "money", csv: r => r.live_spent ?? r.total_spent },
        { key: "tier", label: "التميّز", csv: r => ({ gold: "ذهبي", silver: "فضي", bronze: "برونزي" }[r._tier] || "عادي"), render: r => window.vipBadgeKey(r._tier) },
        { key: "points", label: "النقاط", render: r => `<span class="badge badge-warning">⭐ ${TB.num(r.points)}</span>` },
        { key: "rating", label: "التقييم", render: r => `⭐ ${TB.num(r.rating)}` },
      ],
      rowActions: [
        { icon: "🎁", label: "جائزة", perm: "rewards", run: r => TB.recordModal("rewards", window.MODULES.rewards, { customer_id: r.id }).then(() => {}) },
        { icon: "🧾", label: "طلباته", perm: "orders", run: r => TB.go("#/orders?customer=" + r.id) },
      ],
      deleteMsg: r => `حذف العميل «${r.name}» مع كل طلباته؟`,
    },
    pilots: {
      title: "الطيارون / مندوبو التوصيل", perm: "pilots",
      columns: [
        { key: "name", label: "الطيار", render: r => `<div class="flex"><span class="avatar">🛵</span><b>${TB.esc(r.name)}</b></div>` },
        { key: "phone", label: "الهاتف", render: r => `<span class="mono">${TB.esc(r.phone || "")}</span>` },
        { key: "vehicle", label: "وسيلة التوصيل" },
        { key: "orders", label: "الأوردرات المنفذة", render: r => `<span class="badge badge-info">${TB.num(r.orders ?? 0)}</span>` },
        { key: "rating", label: "التقييم", render: r => `⭐ ${TB.num(r.rating)}` },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      rowActions: [
        { icon: "📦", label: "أوردراته", perm: "orders", run: async r => window.showPilotOrders(r) },
      ],
    },
    suppliers: {
      title: "الموردون", perm: "suppliers",
      columns: [
        { key: "name", label: "المورد", render: r => `<b>${TB.esc(r.name)}</b>` },
        { key: "phone", label: "الهاتف", render: r => `<span class="mono">${TB.esc(r.phone || "")}</span>` },
        { key: "address", label: "العنوان" },
        { key: "balance", label: "الرصيد الدائن", render: r => `<b class="${r.balance > 0 ? "text-danger" : "text-success"}">${TB.money(r.balance)}</b>` },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      deleteMsg: r => `حذف المورد «${r.name}»؟`,
    },
    users: {
      title: "المستخدمون", perm: "users", wideForm: true,
      columns: [
        { key: "name", label: "الاسم", render: r => `<div class="flex"><span class="avatar">${TB.esc((r.name || "?").charAt(0))}</span><b>${TB.esc(r.name)}</b></div>` },
        { key: "email", label: "البريد", render: r => `<span class="mono">${TB.esc(r.email || "")}</span>` },
        { key: "role", label: "الدور", render: r => r.role === "admin" ? '<span class="badge badge-primary">مدير عام</span>' : '<span class="badge badge-info">موظف</span>' },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      deleteMsg: r => `حذف المستخدم «${r.name}»؟`,
    },
    payment_methods: {
      title: "وسائل الدفع", perm: "payment_methods",
      columns: [
        { key: "name", label: "الاسم" },
        { key: "kind", label: "النوع", render: r => ({ cash: "💵 كاش عند الاستلام", card: "💳 بطاقة / بوابة", online: "🏦 تحويل بنكي", wallet: "📱 محفظة إلكترونية" }[r.kind] || r.kind) },
        { key: "pay_number", label: "رقم الاستلام", render: r => r.pay_number ? `<span class="mono ltr">${TB.esc(r.pay_number)}</span>` : '<span class="muted">—</span>' },
        { key: "pay_bank", label: "البنك / المزوّد", render: r => TB.esc(r.pay_bank || "—") },
        { key: "requires_proof", label: "إثبات تحويل", render: r => Number(r.requires_proof) === 1 && r.kind !== "cash" ? '<span class="badge badge-warning">مطلوب</span>' : '<span class="badge badge-muted">لا</span>' },
        { key: "pending", label: "إثباتات معلّقة", render: r => Number(r._pending) ? `<span class="badge badge-danger">${TB.num(r._pending)}</span>` : '<span class="muted">—</span>' },
        { key: "sort_order", label: "الترتيب" },
        { key: "active", label: "مفعل", type: "bool" },
      ],
      deleteMsg: r => `حذف وسيلة الدفع «${r.name}»؟ لن تُحذف إذا كانت مستخدمة في طلبات.`,
    },
    promotions: {
      title: "العروض والخصومات", perm: "promotions",
      columns: [
        { key: "name", label: "العرض" },
        { key: "code", label: "الكود", render: r => r.code ? `<span class="badge badge-primary mono">${TB.esc(r.code)}</span>` : "—" },
        { key: "value", label: "القيمة", render: r => r.kind === "percent" ? TB.num(r.value) + "٪" : TB.money(r.value) },
        { key: "min_order", label: "من طلب", type: "money" },
        { key: "end_at", label: "ينتهي في", type: "date" },
        { key: "used_count", label: "الاستخدام", render: r => `<span class="badge badge-info">${TB.num(r.used_count)} مرة</span>` },
        { key: "active", label: "مفعل", type: "bool" },
      ],
    },
    rewards: {
      title: "جوائز وهدايا العملاء", perm: "rewards",
      columns: [
        { key: "customer_id", label: "العميل", render: r => r._cname || TB.num(r.customer_id) },
        { key: "kind", label: "النوع", render: r => r.kind === "gift" ? "🎁 هدية" : "🏷️ خصم" },
        { key: "value", label: "القيمة", render: r => r.kind === "gift" ? TB.num(r.value) : TB.num(r.value) + (r.kind === "discount" && r.value <= 100 ? " ٪" : "") },
        { key: "note", label: "الوصف" },
        { key: "active", label: "مفعل", type: "bool" },
      ],
    },
    ads: {
      title: "الإعلانات المدفوعة", perm: "ads",
      columns: [
        { key: "image", label: "الصورة", type: "img" },
        { key: "title", label: "العنوان" },
        { key: "position", label: "الموضع", render: r => ({ home: "الرئيسية", strip: "شريط", popup: "منبثقة" }[r.position] || r.position) },
        { key: "start_at", label: "من", type: "date" },
        { key: "end_at", label: "إلى", type: "date" },
        { key: "clicks", label: "النقرات", render: r => `<span class="badge badge-info">${TB.num(r.clicks)}</span>` },
        { key: "active", label: "مفعل", type: "bool" },
      ],
    },
    branches: {
      title: "الفروع", perm: "branches",
      columns: [
        { key: "name", label: "الفرع", render: r => `<b>${TB.esc(r.name)}</b>` },
        { key: "address", label: "العنوان" },
        { key: "phone", label: "الهاتف", render: r => `<span class="mono">${TB.esc(r.phone || "")}</span>` },
        { key: "manager", label: "المدير" },
        { key: "active", label: "مفعل", type: "bool" },
      ],
    },
    inventory_moves: {
      title: "حركات المخزون", perm: "inventory",
      filters: [{ name: "type", label: "كل الحركات", options: [["purchase", "شراء"], ["sale", "بيع"], ["adjust", "تسوية"], ["in", "إضافة"], ["out", "صرف"], ["count", "جرد"]] }],
      columns: [
        { key: "date", label: "التاريخ", type: "date" },
        { key: "product_id", label: "الصنف", render: r => r._pname || TB.num(r.product_id) },
        { key: "type", label: "النوع", render: r => ({ purchase: "📥 شراء", sale: "📤 بيع", adjust: "⚖️ تسوية", in: "➕ إضافة", out: "➖ صرف", count: "🧮 جرد" }[r.type] || r.type) },
        { key: "qty", label: "الكمية", render: r => `<b class="${r.qty < 0 ? "text-danger" : "text-success"}">${r.qty > 0 ? "+" : ""}${TB.num(r.qty)}</b>` },
        { key: "balance_after", label: "الرصيد بعد" },
        { key: "ref", label: "المرجع" },
      ],
    },
  };

  /* fill field configs from server registry + per-module tweaks */
  window.MODULES.categories.fields = [
    { name: "name", label: "اسم القسم", type: "text", required: true },
    { name: "description", label: "الوصف", type: "textarea" },
    { name: "image", label: "صورة القسم", type: "image" },
    { name: "sort_order", label: "الترتيب", type: "number", default: 0 },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.products.fields = [
    { name: "category_id", label: "القسم", type: "select", resource: "categories", required: true },
    { name: "name", label: "اسم الصنف", type: "text", required: true },
    { name: "image", label: "صورة الصنف", type: "image" },
    { name: "price", label: "سعر البيع", type: "number", required: true },
    { name: "cost", label: "سعر التكلفة", type: "number" },
    { name: "unit_id", label: "وحدة القياس", type: "select", resource: "units", label_field: "name", default: 1 },
    { name: "barcode", label: "الباركود", type: "text" },
    { name: "min_stock", label: "حد الطلب", type: "number", default: 5 },
    { name: "description", label: "الوصف", type: "textarea" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.customers.fields = [
    { name: "name", label: "اسم العميل", type: "text", required: true },
    { name: "phone", label: "رقم الهاتف", type: "text", required: true },
    { name: "address", label: "العنوان", type: "textarea" },
    { name: "rating", label: "التقييم", type: "number" },
    { name: "notes", label: "ملاحظات", type: "textarea" },
  ];
  window.MODULES.pilots.fields = [
    { name: "name", label: "اسم الطيار", type: "text", required: true },
    { name: "phone", label: "الهاتف", type: "text", required: true },
    { name: "vehicle", label: "وسيلة التوصيل", type: "text" },
    { name: "plate", label: "رقم اللوحة", type: "text" },
    { name: "branch_id", label: "الفرع", type: "select", resource: "branches" },
    { name: "rating", label: "التقييم", type: "number" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.suppliers.fields = [
    { name: "name", label: "اسم المورد", type: "text", required: true },
    { name: "phone", label: "الهاتف", type: "text" },
    { name: "address", label: "العنوان", type: "textarea" },
    { name: "notes", label: "ملاحظات", type: "textarea" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.users.fields = [
    { name: "name", label: "الاسم", type: "text", required: true },
    { name: "email", label: "البريد الإلكتروني", type: "text", required: true },
    { name: "phone", label: "الهاتف", type: "text" },
    { name: "password", label: "كلمة المرور", type: "password" },
    { name: "role", label: "الدور", type: "select", options: [["admin", "مدير عام (كل الصلاحيات)"], ["staff", "موظف (صلاحيات محددة)"]], default: "staff" },
    { name: "branch_id", label: "الفرع", type: "select", resource: "branches" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
    { name: "permissions", label: "مصفوفة الصلاحيات", type: "permissions" },
  ];
  window.MODULES.payment_methods.fields = [
    { name: "name", label: "الاسم الظاهر للعميل", type: "text", required: true },
    { name: "kind", label: "النوع", type: "select", options: [["cash", "💵 كاش عند الاستلام"], ["wallet", "📱 محفظة إلكترونية"], ["online", "🏦 تحويل بنكي / أونلاين"], ["card", "💳 بطاقة / بوابة دفع"]], default: "cash" },
    { name: "pay_number", label: "رقم المحفظة / رقم الحساب", type: "text", hint: "الرقم الذي يحوّل عليه العميل — يظهر له بوضوح في صفحة الدفع" },
    { name: "pay_holder", label: "اسم صاحب الحساب", type: "text" },
    { name: "pay_bank", label: "البنك / مزوّد المحفظة", type: "text" },
    { name: "pay_link", label: "لينك الدفع (اختياري)", type: "text" },
    { name: "pay_instructions", label: "تعليمات للعميل", type: "textarea", hint: "تظهر للعميل أسفل بيانات التحويل، مثل: استخدم رقم الطلب كمرجع" },
    { name: "requires_proof", label: "يطلب إثبات تحويل من العميل", type: "switch", default: 1 },
    { name: "sort_order", label: "الترتيب", type: "number", default: 0 },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.promotions.fields = [
    { name: "name", label: "اسم العرض", type: "text", required: true },
    { name: "kind", label: "نوع الخصم", type: "select", options: [["percent", "نسبة ٪"], ["fixed", "قيمة ثابتة"]], default: "percent" },
    { name: "value", label: "قيمة الخصم", type: "number", required: true },
    { name: "code", label: "كود الخصم", type: "text" },
    { name: "start_at", label: "من تاريخ", type: "date" },
    { name: "end_at", label: "إلى تاريخ", type: "date" },
    { name: "min_order", label: "الحد الأدنى للاستخدام", type: "number", default: 0 },
    { name: "category_id", label: "قسم محدد (اختياري)", type: "select", resource: "categories" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.rewards.fields = [
    { name: "customer_id", label: "العميل", type: "select", resource: "customers", required: true },
    { name: "kind", label: "النوع", type: "select", options: [["discount", "خصم"], ["gift", "هدية"]], default: "discount" },
    { name: "value", label: "القيمة (٪ للخصم أو عدد للهدية)", type: "number", required: true },
    { name: "note", label: "الوصف", type: "textarea" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.ads.fields = [
    { name: "title", label: "عنوان الإعلان", type: "text", required: true },
    { name: "image", label: "صورة الإعلان", type: "image" },
    { name: "link", label: "الرابط", type: "text" },
    { name: "position", label: "الموضع", type: "select", options: [["home", "الرئيسية"], ["strip", "شريط جانبي"], ["popup", "نافذة منبثقة"]], default: "home" },
    { name: "start_at", label: "من تاريخ", type: "date" },
    { name: "end_at", label: "إلى تاريخ", type: "date" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.branches.fields = [
    { name: "name", label: "اسم الفرع", type: "text", required: true },
    { name: "address", label: "العنوان", type: "textarea", required: true },
    { name: "phone", label: "الهاتف", type: "text" },
    { name: "manager", label: "مدير الفرع", type: "text" },
    { name: "active", label: "مفعل", type: "switch", default: 1 },
  ];
  window.MODULES.inventory_moves.fields = [
    { name: "product_id", label: "الصنف", type: "select", resource: "products", required: true },
    { name: "type", label: "نوع الحركة", type: "select", options: [["in", "إضافة"], ["out", "صرف"], ["adjust", "تسوية"]], default: "adjust", required: true },
    { name: "qty", label: "الكمية (سالب للصرف)", type: "number", required: true },
    { name: "date", label: "التاريخ", type: "date", default: () => TB.today() },
    { name: "ref", label: "المرجع", type: "text" },
    { name: "note", label: "ملاحظات", type: "textarea" },
  ];
})();
