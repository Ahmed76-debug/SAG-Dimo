'use strict';
/**
 * PharmaPro – Demo data seeder (runs once on a fresh database)
 */
const db = require('./db');
const lib = require('./lib');
const { hashPassword } = require('./security');

/* deterministic pseudo random */
let seedState = 20260214;
function rnd() {
  seedState |= 0; seedState = (seedState + 0x6D2B79F5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const randInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;

function stamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function dayString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function addDaysTo(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function ean13(prefix12) {
  const digits = String(prefix12).split('').map(Number);
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  return prefix12 + String((10 - (sum % 10)) % 10);
}

function seed() {
  const roles = [
    { name: 'مدير النظام', key: 'admin', desc: 'صلاحيات كاملة على النظام', perms: ['*'] },
    { name: 'مدير الصيدلية', key: 'manager', desc: 'إدارة تشغيلية شاملة', perms: ['dashboard.view', 'pos.use', 'products.view', 'products.manage', 'inventory.manage', 'purchases.view', 'purchases.manage', 'suppliers.manage', 'customers.manage', 'prescriptions.manage', 'sales.view', 'sales.manage', 'returns.manage', 'reports.view', 'accounting.view', 'shifts.use', 'shifts.manage', 'audit.view'] },
    { name: 'صيدلي', key: 'pharmacist', desc: 'صرف وبيع وإدارة مخزون', perms: ['dashboard.view', 'pos.use', 'products.view', 'products.manage', 'inventory.manage', 'purchases.view', 'suppliers.manage', 'customers.manage', 'prescriptions.manage', 'sales.view', 'sales.manage', 'returns.manage', 'reports.view', 'shifts.use'] },
    { name: 'كاشير', key: 'cashier', desc: 'نقطة البيع والورديات', perms: ['dashboard.view', 'pos.use', 'products.view', 'customers.manage', 'sales.view', 'sales.manage', 'shifts.use'] },
    { name: 'محاسب', key: 'accountant', desc: 'الحسابات والتقارير المالية', perms: ['dashboard.view', 'reports.view', 'accounting.view', 'accounting.manage', 'purchases.view', 'sales.view', 'suppliers.manage', 'customers.manage'] }
  ];
  const roleIds = {};
  for (const r of roles) {
    const res = db.run('INSERT INTO roles(name,description,permissions,is_system) VALUES(?,?,?,1)',
      r.name, r.desc, JSON.stringify(r.perms));
    roleIds[r.key] = Number(res.lastInsertRowid);
  }

  const users = [
    ['admin', 'admin123', 'أحمد محمود', 'admin', '01001234567', 'admin@pharmapro.local', '#0ea5e9'],
    ['manager', 'manager123', 'خالد فؤاد', 'manager', '01007654321', 'manager@pharmapro.local', '#8b5cf6'],
    ['pharmacist', 'pharma123', 'د. مريم حسن', 'pharmacist', '01112223344', 'maryam@pharmapro.local', '#10b981'],
    ['cashier', 'cashier123', 'أحمد سيد', 'cashier', '01223334455', 'ahmed@pharmapro.local', '#f59e0b'],
    ['accountant', 'acc123', 'سارة علي', 'accountant', '01098887766', 'sara@pharmapro.local', '#ef4444']
  ];
  const userIds = {};
  for (const [username, pw, name, role, phone, email, color] of users) {
    const res = db.run('INSERT INTO users(username,password_hash,full_name,role_id,phone,email,color) VALUES(?,?,?,?,?,?,?)',
      username, hashPassword(pw), name, roleIds[role], phone, email, color);
    userIds[username] = Number(res.lastInsertRowid);
  }

  const categories = [
    ['مسكنات وخوافض حرارة', '#ef4444'], ['مضادات حيوية', '#f59e0b'], ['القلب والضغط', '#8b5cf6'],
    ['أدوية السكري', '#06b6d4'], ['فيتامينات ومكملات', '#10b981'], ['الجهاز التنفسي', '#3b82f6'],
    ['الجلدية والعناية', '#ec4899'], ['مستلزمات طبية', '#64748b'], ['الجهاز الهضمي', '#f97316'],
    ['مضادات الحساسية', '#14b8a6'], ['أدوية الأطفال', '#a855f7']
  ];
  const catIds = {};
  for (const [name, color] of categories) {
    const res = db.run('INSERT INTO categories(name,color,description) VALUES(?,?,?)', name, color, '');
    catIds[name] = Number(res.lastInsertRowid);
  }

  const suppliers = [
    ['شركة ابن سينا فارما', 'م. طارق عبد الله', '01000111222', 'sales@ibnsina.com', 'المنطقة الصناعية – العاشر من رمضان', '201-445-889'],
    ['المتحدة للأدوية', 'أ. هالة مصطفى', '01000222333', 'orders@united-pharma.com', 'مدينة نصر – القاهرة', '202-556-771'],
    ['فارما أوفرسيز', 'م. عمرو زكي', '01000333444', 'info@pharmaoverseas.com', 'الإسكندرية – سموحة', '203-667-882'],
    ['جمجوم فارما مصر', 'د. ليلى إبراهيم', '01000444555', 'care@jamjoom.com', '6 أكتوبر – الجيزة', '202-778-993'],
    ['النهدي للتوريدات الطبية', 'أ. ياسر فتحي', '01000555666', 'supply@nahdi.com', 'المعادي – القاهرة', '202-889-114']
  ];
  const supplierIds = suppliers.map((s) => Number(db.run(
    'INSERT INTO suppliers(name,contact_name,phone,email,address,tax_no) VALUES(?,?,?,?,?,?)',
    ...s
  ).lastInsertRowid));

  const customers = [
    ['محمد عبد الرحمن', '01011112222', 'القاهرة – مدينة نصر', 'تأمين مصر للتأمين'],
    ['فاطمة السيد', '01122223333', 'الجيزة – الدقي', null],
    ['مصطفى كامل', '01233334444', 'القاهرة – المعادي', 'شركة مصر للتأمين'],
    ['نهى إبراهيم', '01044445555', 'الجيزة – المهندسين', null],
    ['كريم عادل', '01155556666', 'القاهرة – مصر الجديدة', 'ميتلايف'],
    ['سلمى فؤاد', '01266667777', 'القاهرة – شبرا', null],
    ['عمر حسن', '01077778888', 'الجيزة – الهرم', null],
    ['ياسمين محمد', '01188889999', 'القاهرة – التجمع', 'أليانز'],
    ['حسام الدين', '01299990000', 'الجيزة – فيصل', null],
    ['دينا سمير', '01012341234', 'القاهرة – الزمالك', null]
  ];
  const customerIds = customers.map(([name, phone, address, insurance]) => Number(db.run(
    'INSERT INTO customers(name,phone,address,insurance) VALUES(?,?,?,?)', name, phone, address, insurance
  ).lastInsertRowid));

  const products = [
    ['بانادول إكسترا 24 قرص', 'Panadol Extra', 'مسكنات وخوافض حرارة', 'GSK', 'أقراص', '500mg / 65mg', 'علبة', 32, 48, 30, 0, 0],
    ['كتافلام 50 مجم 20 قرص', 'Cataflam', 'مسكنات وخوافض حرارة', 'Novartis', 'أقراص', '50mg', 'علبة', 42, 62, 25, 0, 0],
    ['بروفين 400 مجم 20 قرص', 'Brufen', 'مسكنات وخوافض حرارة', 'Abbott', 'أقراص', '400mg', 'علبة', 35, 52, 20, 0, 0],
    ['أوجمنتين 1 جم 14 قرص', 'Augmentin 1g', 'مضادات حيوية', 'GSK', 'أقراص', '1g', 'علبة', 155, 195, 15, 0, 1],
    ['أموكسيل 500 مجم 12 كبسولة', 'Amoxil', 'مضادات حيوية', 'GSK', 'كبسولات', '500mg', 'علبة', 52, 72, 20, 0, 1],
    ['زيثروماكس 500 مجم 3 أقراص', 'Zithromax', 'مضادات حيوية', 'Pfizer', 'أقراص', '500mg', 'علبة', 110, 145, 10, 0, 1],
    ['كونكور 5 مجم 30 قرص', 'Concor', 'القلب والضغط', 'Merck', 'أقراص', '5mg', 'علبة', 58, 78, 25, 0, 1],
    ['كابوتن 25 مجم 30 قرص', 'Capoten', 'القلب والضغط', 'Bristol Myers', 'أقراص', '25mg', 'علبة', 40, 58, 15, 0, 1],
    ['لازيكس 40 مجم 20 قرص', 'Lasix', 'القلب والضغط', 'Sanofi', 'أقراص', '40mg', 'علبة', 28, 42, 15, 0, 1],
    ['جلوكوفاج 850 مجم 30 قرص', 'Glucophage', 'أدوية السكري', 'Merck', 'أقراص', '850mg', 'علبة', 38, 55, 30, 0, 1],
    ['دياميكرون 60 مجم 30 قرص', 'Diamicron', 'أدوية السكري', 'Servier', 'أقراص', '60mg', 'علبة', 62, 85, 12, 0, 1],
    ['إنسولين ميكستارد 100 وحدة', 'Mixtard 30', 'أدوية السكري', 'Novo Nordisk', 'فيال', '100IU/ml', 'فيال', 145, 185, 8, 0, 1],
    ['أوميجا 3 بلس 60 كبسولة', 'Omega 3 Plus', 'فيتامينات ومكملات', 'Puritan Pride', 'كبسولات', '1000mg', 'علبة', 180, 240, 10, 0, 0],
    ['فيتامين د3 50000 وحدة 12 كبسولة', 'Vitamin D3', 'فيتامينات ومكملات', 'Eva Pharma', 'كبسولات', '50000IU', 'علبة', 55, 80, 15, 0, 0],
    ['سنتروم للبالغين 30 قرص', 'Centrum Adults', 'فيتامينات ومكملات', 'Wyeth', 'أقراص', 'متعدد', 'علبة', 260, 340, 8, 0, 0],
    ['زنك 50 مجم 30 قرص', 'Zinc 50', 'فيتامينات ومكملات', "Nature's Bounty", 'أقراص', '50mg', 'علبة', 65, 95, 12, 0, 0],
    ['فيتامين سي 1000 فوار 20 قرص', 'Vitamin C 1000', 'فيتامينات ومكملات', 'Roche', 'فوار', '1000mg', 'أنبوب', 85, 120, 15, 0, 0],
    ['فينتولين بخاخ 100 ميكروجرام', 'Ventolin Inhaler', 'الجهاز التنفسي', 'GSK', 'بخاخ', '100mcg', 'عبوة', 68, 95, 15, 0, 1],
    ['بيسلفون شراب 120 مل', 'Bisolvon Syrup', 'الجهاز التنفسي', 'Boehringer', 'شراب', '4mg/5ml', 'زجاجة', 38, 55, 10, 0, 0],
    ['زيرتك 10 مجم 20 قرص', 'Zyrtec', 'مضادات الحساسية', 'UCB', 'أقراص', '10mg', 'علبة', 70, 98, 20, 0, 0],
    ['كلاريتين 10 مجم 20 قرص', 'Claritin', 'مضادات الحساسية', 'Bayer', 'أقراص', '10mg', 'علبة', 65, 90, 12, 0, 0],
    ['فولتارين إيمولجيل 100 جم', 'Voltaren Emulgel', 'الجلدية والعناية', 'Novartis', 'جل', '1%', 'أنبوب', 95, 130, 12, 14, 0],
    ['بيتادين محلول 120 مل', 'Betadine Solution', 'الجلدية والعناية', 'Mundipharma', 'محلول', '10%', 'زجاجة', 52, 75, 15, 14, 0],
    ['كريم مرطب للبشرة الجافة 100 مل', 'Moisturizing Cream', 'الجلدية والعناية', 'Eucerin', 'كريم', 'يوريا 10%', 'أنبوب', 140, 195, 8, 14, 0],
    ['واقي شمس SPF50 50 مل', 'Sunblock SPF50', 'الجلدية والعناية', 'La Roche-Posay', 'كريم', 'SPF50', 'أنبوب', 320, 430, 5, 14, 0],
    ['أوميبرازول 20 مجم 14 كبسولة', 'Omeprazole', 'الجهاز الهضمي', 'AstraZeneca', 'كبسولات', '20mg', 'علبة', 40, 60, 20, 0, 0],
    ['موتيليوم 10 مجم 30 قرص', 'Motilium', 'الجهاز الهضمي', 'Janssen', 'أقراص', '10mg', 'علبة', 48, 70, 15, 0, 0],
    ['جافيسكون شراب 200 مل', 'Gaviscon', 'الجهاز الهضمي', 'Reckitt', 'شراب', 'صوديوم ألجينات', 'زجاجة', 65, 90, 12, 0, 0],
    ['لاكتيولوز شراب 200 مل', 'Lactulose', 'الجهاز الهضمي', 'Eva Pharma', 'شراب', '66.7%', 'زجاجة', 42, 62, 10, 0, 0],
    ['بروفين شراب للأطفال 100 مل', 'Brufen Syrup', 'أدوية الأطفال', 'Abbott', 'شراب', '100mg/5ml', 'زجاجة', 38, 55, 18, 0, 0],
    ['أوجمنتين شراب 457 مجم', 'Augmentin Syrup', 'أدوية الأطفال', 'GSK', 'شراب', '457mg/5ml', 'زجاجة', 95, 125, 12, 0, 1],
    ['فيتامين د للأطفال نقط 10 مل', 'Vitamin D Drops', 'أدوية الأطفال', 'Eva Pharma', 'نقط', '400IU', 'زجاجة', 45, 65, 15, 0, 0],
    ['حفاضات أطفال مقاس 3 × 50', 'Baby Diapers Size 3', 'أدوية الأطفال', 'Pampers', 'حفاضات', 'مقاس 3', 'باكيت', 210, 275, 6, 14, 0],
    ['كريم طفح الحفاض 50 جم', 'Diaper Rash Cream', 'أدوية الأطفال', 'Sebamed', 'كريم', 'بانثينول', 'أنبوب', 75, 105, 10, 14, 0],
    ['شاش طبي معقم 10×10 (5 قطع)', 'Sterile Gauze', 'مستلزمات طبية', 'Amoun', 'شاش', '10×10', 'باكيت', 12, 20, 40, 14, 0],
    ['كمامات طبية 3 طبقات (50 قطعة)', 'Surgical Masks', 'مستلزمات طبية', '3M', 'كمامات', '3 طبقات', 'علبة', 55, 80, 20, 14, 0],
    ['ترمومتر رقمي', 'Digital Thermometer', 'مستلزمات طبية', 'Omron', 'جهاز', 'قياس سريع', 'قطعة', 160, 225, 6, 14, 0],
    ['جهاز قياس ضغط الدم', 'Blood Pressure Monitor', 'مستلزمات طبية', 'Omron', 'جهاز', 'ذكي', 'قطعة', 1100, 1450, 3, 14, 0],
    ['شرائط قياس السكر (50 شريط)', 'Glucose Strips', 'مستلزمات طبية', 'Accu-Chek', 'شرائط', '50 شريط', 'علبة', 330, 420, 8, 14, 0],
    ['اختبار حمل منزلي', 'Pregnancy Test', 'مستلزمات طبية', 'Clearblue', 'اختبار', 'سريع', 'قطعة', 25, 40, 20, 14, 0],
    ['محلول ملحي للأنف 20 مل', 'Saline Nasal Spray', 'الجهاز التنفسي', 'Sterimar', 'بخاخ', '0.9%', 'عبوة', 30, 45, 18, 0, 0],
    ['ستربسلز عسل وليمون 24', 'Strepsils Honey & Lemon', 'الجهاز التنفسي', 'Reckitt', 'أقراص استحلاب', 'عسل وليمون', 'علبة', 40, 58, 15, 0, 0],
    ['شراب كحة للكبار 120 مل', 'Adult Cough Syrup', 'الجهاز التنفسي', 'Pfizer', 'شراب', 'ديكستروميثورفان', 'زجاجة', 42, 62, 12, 0, 0],
    ['أتورفاستاتين 20 مجم 30 قرص', 'Atorvastatin', 'القلب والضغط', 'Pfizer', 'أقراص', '20mg', 'علبة', 85, 120, 10, 0, 1]
  ];

  const productIds = [];
  products.forEach((p, i) => {
    const [name, nameEn, cat, mfr, form, strength, unit, cost, price, minStock, tax, rx] = p;
    const sku = `SKU-${String(i + 1).padStart(4, '0')}`;
    const barcode = ean13(`62210${String(i + 1).padStart(7, '0')}`);
    const res = db.run(
      `INSERT INTO products(sku,barcode,name,name_en,category_id,manufacturer,form,strength,unit,cost,price,tax_rate,min_stock,reorder_qty,shelf,requires_rx)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      sku, barcode, name, nameEn, catIds[cat], mfr, form, strength, unit, cost, price, tax, minStock,
      Math.max(30, minStock * 2), `رف ${String.fromCharCode(65 + Math.floor(i / 8))}-${(i % 8) + 1}`, rx
    );
    productIds.push(Number(res.lastInsertRowid));
  });

  /* ---------------- Chart of accounts + opening capital ---------------- */
  const accounts = [
    ['1000', 'الأصول', 'asset', null],
    ['1010', 'النقدية بالصندوق', 'asset', '1000'],
    ['1020', 'النقدية بالبنك / التحصيل الإلكتروني', 'asset', '1000'],
    ['1030', 'العملاء والمدينون', 'asset', '1000'],
    ['1040', 'المخزون', 'asset', '1000'],
    ['1050', 'الأصول الثابتة', 'asset', '1000'],
    ['2000', 'الالتزامات', 'liability', null],
    ['2010', 'الموردون والدائنون', 'liability', '2000'],
    ['2020', 'ضريبة القيمة المضافة', 'liability', '2000'],
    ['2030', 'رواتب مستحقة', 'liability', '2000'],
    ['3000', 'حقوق الملكية', 'equity', null],
    ['3010', 'رأس المال', 'equity', '3000'],
    ['3020', 'الأرباح المحتجزة', 'equity', '3000'],
    ['4000', 'الإيرادات', 'revenue', null],
    ['4010', 'إيرادات المبيعات', 'revenue', '4000'],
    ['4020', 'إيرادات أخرى', 'revenue', '4000'],
    ['4030', 'مردودات المبيعات', 'revenue', '4000'],
    ['5000', 'المصروفات', 'expense', null],
    ['5010', 'تكلفة المبيعات', 'expense', '5000'],
    ['5020', 'رواتب وأجور', 'expense', '5000'],
    ['5030', 'إيجار', 'expense', '5000'],
    ['5040', 'كهرباء ومياه', 'expense', '5000'],
    ['5050', 'إنترنت واتصالات', 'expense', '5000'],
    ['5060', 'نظافة وصيانة', 'expense', '5000'],
    ['5070', 'مصروفات أخرى', 'expense', '5000']
  ];
  const accIds = {};
  for (const [code, name, type, parent] of accounts) {
    const res = db.run('INSERT INTO accounts(code,name,type,parent_id,is_system) VALUES(?,?,?,?,1)',
      code, name, type, parent ? accIds[parent] : null);
    accIds[code] = Number(res.lastInsertRowid);
  }
  lib.postJournal({
    date: `${dayString(-95)} 09:00:00`,
    description: 'رصيد افتتاحي – رأس المال',
    refType: 'opening', refId: 1, userId: userIds.admin,
    lines: [
      { account: '1010', debit: 120000, description: 'نقدية افتتاحية' },
      { account: '3010', credit: 120000, description: 'رأس المال' }
    ]
  });

  /* ---------------- Purchases (creates batches) ---------------- */
  const batchCount = 7;
  const purchaseGroups = Array.from({ length: batchCount }, () => []);
  productIds.forEach((pid, i) => purchaseGroups[i % batchCount].push(pid));

  purchaseGroups.forEach((group, gi) => {
    const date = `${addDaysTo(dayString(-88 + gi * 9), 0)} 10:${String(randInt(5, 55)).padStart(2, '0')}:00`;
    const items = group.map((pid, idx) => {
      const p = db.get('SELECT * FROM products WHERE id = ?', pid);
      const lowStock = idx >= group.length - 1 && gi % 2 === 0;
      const qty = lowStock ? randInt(3, 9) : randInt(35, 140);
      const expiryOffset = [4, 18, 26, 33, 40].includes(pid) ? randInt(25, 80) : randInt(200, 900);
      return {
        product_id: pid,
        qty,
        cost: p.cost,
        batch_no: `B${String(24000 + pid * 7 + gi).padStart(5, '0')}`,
        expiry_date: addDaysTo(dayString(0), expiryOffset)
      };
    });
    const invoice = lib.createPurchase({
      supplier_id: supplierIds[gi % supplierIds.length],
      items,
      discount: gi === 2 ? 150 : 0,
      paid: gi % 3 === 0 ? 0 : Math.round(items.reduce((s, it) => s + it.qty * it.cost, 0) * 0.6),
      notes: 'توريد دوري',
      user_id: userIds.manager,
      date,
      invoice_ref: `S-${9000 + gi}`
    });
    if (gi === 2) {
      // an extra near-expiry / expired batch for the alerts screens
      lib.addStock({
        productId: productIds[42], qty: 12, cost: 35, batchNo: 'BEXP-OLD',
        expiryDate: addDaysTo(dayString(0), -12), supplierId: supplierIds[0],
        refType: 'purchase', refId: invoice.id, userId: userIds.manager, note: 'دفعة منتهية للعرض'
      });
    }
  });

  /* ---------------- Sales + shifts ---------------- */
  const saleProducts = productIds.map((id) => db.get('SELECT id,name,price,cost,tax_rate FROM products WHERE id = ?', id));
  const payMethods = ['cash', 'cash', 'cash', 'cash', 'card', 'card', 'wallet', 'credit'];

  for (let d = 0; d < 60; d++) {
    const day = dayString(-59 + d);
    const isWeekend = [5, 6].includes(new Date(day + 'T00:00:00').getDay());
    const userKey = d % 3 === 0 ? 'pharmacist' : 'cashier';
    const uid = userIds[userKey];
    const shiftRes = db.run(
      'INSERT INTO shifts(user_id,opened_at,opening_cash,status) VALUES(?,?,?,?)',
      uid, `${day} 09:00:00`, 500, 'open'
    );
    const shiftId = Number(shiftRes.lastInsertRowid);
    const salesCount = isWeekend ? randInt(4, 8) : randInt(2, 5);

    for (let s = 0; s < salesCount; s++) {
      const itemCount = randInt(1, 3);
      const chosen = new Set();
      const items = [];
      for (let k = 0; k < itemCount; k++) {
        const p = pick(saleProducts);
        if (chosen.has(p.id)) continue;
        chosen.add(p.id);
        items.push({ product_id: p.id, qty: randInt(1, 3), price: p.price });
      }
      if (!items.length) continue;
      const method = pick(payMethods);
      const totalGuess = items.reduce((sum, it) => sum + it.price * it.qty, 0);
      let discount = 0;
      if (rnd() > 0.85) discount = Math.min(round2(Math.round(totalGuess * 0.05)), 20);
      const customerId = rnd() > 0.55 ? pick(customerIds) : null;
      const hour = randInt(10, 21);
      const minute = randInt(0, 59);
      try {
        lib.createSale({
          items,
          customer_id: customerId,
          discount,
          payment_method: method,
          paid: method === 'credit' ? 0 : undefined,
          user_id: uid,
          shift_id: shiftId,
          date: `${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
          notes: method === 'credit' ? 'بيع آجل على الحساب' : ''
        });
      } catch (err) {
        /* stock ran out – skip this demo sale */
      }
    }
    try {
      const report = lib.shiftReport(shiftId);
      const counted = lib.round2(report.expected_cash + randInt(-8, 8));
      lib.closeShift(shiftId, counted, 'إغلاق تلقائي – وردية تجريبية', uid);
    } catch (err) { /* ignore */ }
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  /* ---------------- A few sale returns ---------------- */
  const completedSales = db.all("SELECT id FROM sales WHERE status='completed' ORDER BY id DESC LIMIT 12");
  for (const sale of completedSales.slice(0, 3)) {
    const item = db.get('SELECT * FROM sale_items WHERE sale_id = ? LIMIT 1', sale.id);
    if (!item) continue;
    try {
      lib.createSaleReturn({
        sale_id: sale.id,
        items: [{ product_id: item.product_id, qty: 1 }],
        refund_method: 'cash',
        reason: 'خطأ في الصرف',
        user_id: userIds.pharmacist
      });
    } catch (err) { /* ignore */ }
  }

  /* ---------------- Expenses ---------------- */
  const expenseRows = [
    [5030, 6500, 'إيجار المقر الشهري'],
    [5020, 14500, 'رواتب فريق العمل'],
    [5040, 1250, 'فاتورة الكهرباء والمياه'],
    [5050, 450, 'باقة الإنترنت والاتصالات'],
    [5060, 700, 'نظافة وصيانة دورية'],
    [5070, 380, 'مستلزمات مكتبية'],
    [5030, 6500, 'إيجار المقر الشهري'],
    [5020, 14500, 'رواتب فريق العمل'],
    [5040, 1180, 'فاتورة الكهرباء والمياه'],
    [5050, 450, 'باقة الإنترنت والاتصالات']
  ];
  expenseRows.forEach(([code, amount, desc], i) => {
    lib.createExpense({
      date: addDaysTo(dayString(0), -55 + i * 6),
      account_id: accIds[String(code)],
      amount,
      payment_method: i % 4 === 0 ? 'bank' : 'cash',
      description: desc,
      user_id: userIds.accountant
    });
  });

  /* ---------------- Prescriptions ---------------- */
  const rxSamples = [
    ['منى عبد الله', 'د. هشام فتحي', 'أوجمنتين 1 جم – قرص كل 12 ساعة', 'بانادول إكسترا – عند اللزوم'],
    ['عمرو خالد', 'د. سلمى رشاد', 'كونكور 5 مجم – قرص صباحاً', 'أوميجا 3 – كبسولة يومياً'],
    ['هدى مصطفى', 'د. كريم نبيل', 'جلوكوفاج 850 – قرص مرتين', 'فيتامين د3 – كبسولة أسبوعياً'],
    ['يوسف حسين', 'د. أمنية صابر', 'بروفين شراب للأطفال – 5 مل ثلاث مرات', 'فيتامين د نقط – 4 نقاط'],
    ['سعاد إبراهيم', 'د. طارق منصور', 'أتورفاستاتين 20 – قرص مساءً', 'أسبرين 81 – قرص يومياً'],
    ['نادر فؤاد', 'د. مروة عادل', 'زيرتك 10 – قرص يومياً', 'محلول ملحي للأنف – عند اللزوم']
  ];
  rxSamples.forEach(([patient, doctor, item1, item2], i) => {
    const status = i < 4 ? 'dispensed' : 'pending';
    const res = db.run(
      'INSERT INTO prescriptions(rx_no,customer_id,patient_name,doctor_name,date,status,notes,user_id) VALUES(?,?,?,?,?,?,?,?)',
      `RX-${dayString(-20 + i * 3).replace(/-/g, '')}-${100 + i}`,
      customerIds[i % customerIds.length], patient, doctor,
      `${dayString(-20 + i * 3)} 11:30:00`, status, 'روشتة تجريبية', userIds.pharmacist
    );
    const rxId = Number(res.lastInsertRowid);
    for (const line of [item1, item2]) {
      db.run('INSERT INTO prescription_items(prescription_id,name,dosage,qty,dispensed) VALUES(?,?,?,?,?)',
        rxId, line.split('–')[0].trim(), line, 1, status === 'dispensed' ? 1 : 0);
    }
  });

  db.run('INSERT INTO audit_log(user_id,action,entity,details) VALUES(?,?,?,?)',
    userIds.admin, 'seed', 'system', 'تهيئة قاعدة البيانات بالبيانات التجريبية');
}

module.exports = { seed };
