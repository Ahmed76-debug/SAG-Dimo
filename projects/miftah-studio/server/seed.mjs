import { getDb, getSetting, setSetting, setSettings } from './db.mjs';
import { generateLicenseKey, hashKey, keyHint, encryptSecret, hashPassword, uid, hashApiKey } from './crypto.mjs';
import { ROLE_TEMPLATES } from './permissions.mjs';

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const days = (n) => n * 86400000;
const minus = (d) => iso(now - days(d));
const plus = (d) => iso(now + days(d));

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS = [
  {
    code: 'CAFE', name: 'Cafe Manager Pro', name_en: 'Cafe Manager Pro', category: 'نقاط بيع', platform: 'Windows',
    version: '4.2.0', color: '#f59e0b', icon: 'coffee', activation_mode: 'hybrid', default_plan: 'subscription',
    default_days: 365, default_seats: 3, description: 'نظام إدارة الكافيهات والمطاعم: نقاط بيع، مخزون، ورديات وتقارير.',
    features: ['نقاط بيع سريعة', 'إدارة المخزون', 'تقارير الورديات', 'شاشة مطبخ', 'دعم عدة فروع'],
  },
  {
    code: 'CLINIC', name: 'Clinic Plus', name_en: 'Clinic Plus', category: 'صحي', platform: 'Windows',
    version: '3.1.2', color: '#06b6d4', icon: 'stethoscope', activation_mode: 'online', default_plan: 'subscription',
    default_days: 365, default_seats: 2, description: 'إدارة العيادات والملفات الطبية والمواعيد والفواتير.',
    features: ['ملفات المرضى', 'حجز المواعيد', 'الوصفات الطبية', 'الفواتير والتأمين'],
  },
  {
    code: 'PHARMA', name: 'Pharmacy POS', name_en: 'Pharmacy POS', category: 'تجزئة', platform: 'Windows',
    version: '2.8.0', color: '#10b981', icon: 'pill', activation_mode: 'hybrid', default_plan: 'perpetual',
    default_days: 0, default_seats: 2, description: 'نظام صيدليات متكامل مع إدارة الصلاحية والبدائل الدوائية.',
    features: ['باركود سريع', 'إدارة الصلاحية', 'البدائل الدوائية', 'ربط التأمين'],
  },
  {
    code: 'GYM', name: 'Gym Trainer', name_en: 'Gym Trainer', category: 'لياقة', platform: 'Windows',
    version: '1.9.4', color: '#f43f5e', icon: 'dumbbell', activation_mode: 'offline', default_plan: 'subscription',
    default_days: 180, default_seats: 1, description: 'إدارة النوادي الرياضية والاشتراكات والمدربين.',
    features: ['اشتراكات الأعضاء', 'جدول المدربين', 'قياسات الجسم', 'تنبيهات التجديد'],
  },
  {
    code: 'ACCT', name: 'دفتر المحاسبة', name_en: 'Daftar Accounting', category: 'مالية', platform: 'Windows',
    version: '5.0.1', color: '#8b5cf6', icon: 'calculator', activation_mode: 'hybrid', default_plan: 'subscription',
    default_days: 365, default_seats: 2, description: 'محاسبة متكاملة للشركات الصغيرة والمتوسطة مع تقارير ضريبية.',
    features: ['قيود يومية', 'شجرة الحسابات', 'التقارير الضريبية', 'إدارة الفواتير'],
  },
  {
    code: 'SCHOOL', name: 'مدارس ERP', name_en: 'School ERP', category: 'تعليم', platform: 'Cross-platform',
    version: '2.3.0', color: '#3b82f6', icon: 'graduation-cap', activation_mode: 'online', default_plan: 'subscription',
    default_days: 365, default_seats: 5, description: 'منصة إدارة المدارس: الطلاب، الحضور، النتائج والرسوم.',
    features: ['سجل الطلاب', 'الحضور والغياب', 'كشوف النتائج', 'الرسوم الدراسية', 'بوابة أولياء الأمور'],
  },
];

const CUSTOMERS = [
  ['محمد العتيبي', 'مؤسسة الريان للتجارة', 'm.otaibi@alrayan.sa', '+966 50 112 3344', 'السعودية'],
  ['نورة القحطاني', 'كافيه سُكر', 'noura@sukr.cafe', '+966 55 908 7712', 'السعودية'],
  ['عبدالله الحربي', 'عيادة الشفاء', 'a.harbi@alshifa.com', '+966 53 441 9087', 'السعودية'],
  ['سلمى بن يوسف', 'صيدلية الحياة', 'salma@alhayat.dz', '+213 661 22 44 88', 'الجزائر'],
  ['خالد المنصوري', 'نادي القمة', 'khaled@qimmah.ae', '+971 50 330 8899', 'الإمارات'],
  ['هند الزهراني', 'مدارس الأفق', 'hind@ufuq.edu.sa', '+966 56 774 1122', 'السعودية'],
  ['يوسف الشامي', 'شركة النخبة للمقاولات', 'yousef@elnokhba.com', '+20 100 445 7788', 'مصر'],
  ['ريم الدوسري', 'مطعم بيت الذوق', 'reem@dawq.sa', '+966 54 221 6633', 'السعودية'],
  ['طارق بن صالح', 'مركز الأمل الطبي', 'tarek@alamal.ma', '+212 662 88 99 11', 'المغرب'],
  ['أمل الحسن', 'مكتب المحاسبة الحديث', 'amal@modern-acc.jo', '+962 79 550 2299', 'الأردن'],
  ['سعد الغامدي', 'مخبز الحصاد', 'saad@hasad.sa', '+966 50 987 4411', 'السعودية'],
  ['لمياء العبيدي', 'مركز لمسة جمال', 'lamia@lamsa.qa', '+974 330 77 555', 'قطر'],
  ['فهد العنزي', 'شركة أفق التقنية', 'fahd@ufuqtech.com', '+965 955 88 770', 'الكويت'],
  ['منى إبراهيم', 'حضانة براعم', 'mona@baraem.bh', '+973 330 44 221', 'البحرين'],
];

const MACHINES = [
  ['CAFE-PC-01', 'Windows 11 Pro'], ['DESKTOP-ALFA', 'Windows 11 Pro'], ['RECEPTION-02', 'Windows 10 Pro'],
  ['MANAGER-PC', 'Windows 11 Home'], ['POS-TERM-3', 'Windows 10 IoT'], ['OFFICE-LAPTOP', 'Windows 11 Pro'],
  ['BRANCH-RYD-01', 'Windows 11 Pro'], ['PHARMACY-PC', 'Windows 11 Pro'], ['GYM-FRONT', 'Windows 10 Pro'],
  ['SCHOOL-ADMIN', 'Windows 11 Pro'],
];

export function ensureDefaultAdmin() {
  const db = getDb();
  const role = db.prepare("SELECT id FROM roles WHERE slug='owner' OR slug='super_admin' OR slug='admin' ORDER BY id LIMIT 1").get();
  if (!role) return false;
  const row = db.prepare("SELECT id FROM users WHERE LOWER(username)=LOWER('admin') OR LOWER(email)=LOWER('admin@miftah.app')").get();
  const hp = hashPassword('admin123');
  if (!row) {
    db.prepare("INSERT INTO users(username, name, email, password_hash, role_id, is_active, avatar_color, last_login_at, created_at) VALUES (?,?,?,?,?,1,?,?,?)")
      .run('admin', 'مدير النظام', 'admin@miftah.app', hp, role.id, '#6366f1', new Date().toISOString(), new Date().toISOString());
  } else {
    db.prepare('UPDATE users SET username=?, email=?, password_hash=?, role_id=?, is_active=1 WHERE id=?')
      .run('admin', 'admin@miftah.app', hp, role.id, row.id);
  }
  return true;
}

export function seedIfNeeded() {
  const db = getDb();
  if (getSetting('seeded') === '1') { try { ensureDefaultAdmin(); } catch {} return { seeded: false }; }
  const rand = mulberry32(20261115);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  db.exec('BEGIN');
  try {
    const at = iso(now);

    // Roles
    const roleIds = {};
    const insertRole = db.prepare(
      'INSERT INTO roles(slug, name, name_en, description, permissions, is_system, created_at) VALUES (?,?,?,?,?,1,?)'
    );
    for (const [slug, tpl] of Object.entries(ROLE_TEMPLATES)) {
      const info = insertRole.run(slug, tpl.name, tpl.name_en, tpl.description, JSON.stringify(tpl.permissions), at);
      roleIds[slug] = Number(info.lastInsertRowid);
    }

    // Users
    const insertUser = db.prepare(
      `INSERT INTO users(username, name, email, password_hash, role_id, is_active, avatar_color, last_login_at, created_at)
       VALUES (?,?,?,?,?,1,?,?,?)`
    );
    const users = [
      ['admin', 'مدير النظام', 'admin@miftah.app', 'admin123', 'owner', '#6366f1', minus(0.2)],
      ['sara', 'سارة العتيبي', 'sara@miftah.app', 'Sara@123', 'manager', '#ec4899', minus(1.1)],
      ['omar', 'عمر حسن', 'omar@miftah.app', 'Omar@123', 'support', '#10b981', minus(2.4)],
      ['lina', 'لينا خالد', 'lina@miftah.app', 'Lina@123', 'viewer', '#f59e0b', minus(6)],
    ];
    for (const [username, name, email, pass, role, color, lastLogin] of users) {
      insertUser.run(username, name, email, hashPassword(pass), roleIds[role], color, lastLogin, at);
    }

    // Products
    const insertProduct = db.prepare(
      `INSERT INTO products(code, name, name_en, description, category, platform, version, vendor, website, color, icon,
        activation_mode, default_plan, default_days, default_seats, features, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active', ?)`
    );
    const productIds = {};
    for (const p of PRODUCTS) {
      const info = insertProduct.run(
        p.code, p.name, p.name_en, p.description, p.category, p.platform, p.version, 'Miftah Labs',
        'https://miftah.app', p.color, p.icon, p.activation_mode, p.default_plan, p.default_days,
        p.default_seats, JSON.stringify(p.features), minus(300)
      );
      productIds[p.code] = Number(info.lastInsertRowid);
    }

    // Customers
    const insertCustomer = db.prepare(
      'INSERT INTO customers(name, company, email, phone, country, notes, created_at) VALUES (?,?,?,?,?,?,?)'
    );
    const customerIds = [];
    for (const [name, company, email, phone, country] of CUSTOMERS) {
      const info = insertCustomer.run(name, company, email, phone, country, null, minus(200 + rand() * 120));
      customerIds.push(Number(info.lastInsertRowid));
    }

    // Licenses
    const insertLicense = db.prepare(
      `INSERT INTO licenses(uid, key_hash, key_cipher, key_hint, product_id, customer_id, plan, status, activation_mode,
        issued_at, starts_at, expires_at, max_seats, features, price, currency, notes, created_by, last_seen_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'USD',?,1,?,?)`
    );
    const licenseRows = [];
    for (let i = 0; i < 48; i++) {
      const p = PRODUCTS[i % PRODUCTS.length];
      const plan = i % 10 < 6 ? 'subscription' : i % 10 < 9 ? 'perpetual' : 'trial';
      const issuedDays = 8 + Math.floor(rand() * 340);
      const issuedAt = minus(issuedDays);
      let expiresAt = null;
      if (plan === 'subscription') expiresAt = plus(-issuedDays + [180, 365, 730][i % 3]);
      if (plan === 'trial') expiresAt = plus(-issuedDays + 14);
      // guarantee a few licenses approaching expiry for a useful demo
      if (i < 4) expiresAt = plus([5, 12, 22, 38][i]);
      // ensure a healthy mix of active / expired / suspended / revoked
      let status = 'active';
      if (i % 13 === 4) status = 'suspended';
      if (i % 17 === 6) status = 'revoked';
      if (plan !== 'perpetual' && expiresAt && expiresAt < at) status = status === 'active' ? 'active' : status;
      const key = generateLicenseKey(p.code);
      const seats = 1 + Math.floor(rand() * 3);
      const price = plan === 'trial' ? 0 : plan === 'perpetual' ? 899 + Math.floor(rand() * 12) * 100 : 299 + Math.floor(rand() * 9) * 100;
      const customerId = customerIds[i % customerIds.length];
      const lastSeen = formatActive(rand) ? minus(rand() * 5) : null;
      insertLicense.run(
        uid('LIC'), hashKey(key), encryptSecret(key), keyHint(key), productIds[p.code], customerId, plan, status,
        p.activation_mode, issuedAt, issuedAt, expiresAt, seats, JSON.stringify(p.features.slice(0, 2 + (i % 3))),
        price, i % 4 === 0 ? 'تم البيع عبر شريك إقليمي.' : null, lastSeen, issuedAt
      );
      const row = db.prepare('SELECT * FROM licenses WHERE key_hash = ?').get(hashKey(key));
      if (row) licenseRows.push(row);
    }

    // Activations
    const insertActivation = db.prepare(
      `INSERT INTO activations(license_id, machine_id, machine_name, os, app_version, ip, mode, status, activated_at, last_seen_at)
       VALUES (?,?,?,?,?,?,?, 'active', ?, ?)`
    );
    for (const lic of licenseRows) {
      if (lic.status !== 'active') continue;
      if (rand() < 0.28) continue;
      const seats = Math.min(lic.max_seats, rand() < 0.2 ? 2 : 1);
      for (let s = 0; s < seats; s++) {
        const [machineName, os] = pick(MACHINES);
        const machineId = machineName + '-' + Math.floor(rand() * 9000 + 1000);
        insertActivation.run(
          lic.id, machineId, machineName, os, '4.2.0', `10.0.${Math.floor(rand() * 20)}.${Math.floor(rand() * 250)}`,
          lic.activation_mode === 'offline' ? 'offline' : 'online',
          lic.issued_at, rand() < 0.8 ? minus(rand() * 3) : lic.issued_at
        );
      }
    }

    // Offline activation requests
    const gym = licenseRows.find((l) => l.activation_mode === 'offline' || l.activation_mode === 'hybrid');
    const cafe = licenseRows.find((l) => l.product_id === productIds.CAFE);
    const insertRequest = db.prepare(
      `INSERT INTO activation_requests(uid, license_id, product_id, license_key_hash, machine_id, machine_name, os, app_version, message, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    );
    if (gym) {
      insertRequest.run(
        uid('REQ'), gym.id, gym.product_id, gym.key_hash, 'GYM-FRONT-2077', 'GYM-FRONT', 'Windows 10 Pro', '1.9.4',
        'الجهاز غير متصل بالإنترنت، نرجو إصدار ملف تفعيل يدوي.', 'pending', minus(1.3)
      );
    }
    if (cafe) {
      insertRequest.run(
        uid('REQ'), cafe.id, cafe.product_id, cafe.key_hash, 'CAFE-BRANCH-02-8842', 'CAFE-BRANCH-02', 'Windows 11 Pro', '4.2.0',
        'فرع جديد في الرياض يحتاج تفعيلاً أوفلاين.', 'pending', minus(0.4)
      );
    }

    // Demo API key (documented in the integration page)
    const demoKey = 'mft_live_demo_7f3a9c2e5b1d4a6f8c0e2b4d6a8f0c2e';
    db.prepare(
      'INSERT INTO api_keys(name, prefix, key_hash, scopes, last_used_at, created_at) VALUES (?,?,?,?,?,?)'
    ).run('مفتاح تجريبي — Online Activation', demoKey.slice(0, 18), hashApiKey(demoKey), JSON.stringify(['activate', 'validate']), minus(2), minus(90));

    // Audit log
    const insertAudit = db.prepare(
      'INSERT INTO audit_logs(at, user_id, actor, action, entity, entity_id, ip, detail) VALUES (?,?,?,?,?,?,?,?)'
    );
    const actorNames = ['أحمد الشمري', 'سارة العتيبي', 'عمر حسن', 'النظام'];
    const actions = [
      ['license.create', 'license', 'توليد ترخيص جديد'],
      ['license.renew', 'license', 'تجديد اشتراك'],
      ['activation.create', 'activation', 'تفعيل جهاز جديد'],
      ['product.update', 'product', 'تحديث بيانات منتج'],
      ['customer.create', 'customer', 'إضافة عميل'],
      ['backup.create', 'backup', 'إنشاء نسخة احتياطية'],
      ['license.reveal', 'license', 'كشف مفتاح ترخيص'],
      ['auth.login', 'user', 'تسجيل دخول'],
    ];
    for (let i = 0; i < 26; i++) {
      const [action, entity, label] = actions[i % actions.length];
      const lic = pick(licenseRows);
      insertAudit.run(
        minus(rand() * 9), 1 + (i % 3), actorNames[i % actorNames.length], action, entity,
        entity === 'license' ? String(lic.id) : String(1 + (i % 6)), `192.168.1.${10 + (i % 40)}`,
        JSON.stringify({ label })
      );
    }

    setSettings({
      'studio.name': 'مفتاح',
      'studio.tagline': 'استوديو التراخيص الاحترافي',
      'seeded': '1',
      'demo.apiKey': demoKey,
    });

    db.exec('COMMIT');
    return { seeded: true };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw error;
  }
}

function formatActive(rand) {
  return rand() < 0.7;
}

export function seedSummary() {
  const db = getDb();
  const count = (table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  return {
    roles: count('roles'),
    users: count('users'),
    products: count('products'),
    customers: count('customers'),
    licenses: count('licenses'),
    activations: count('activations'),
    requests: count('activation_requests'),
    apiKeys: count('api_keys'),
  };
}
