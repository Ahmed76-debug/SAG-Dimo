/* ============================================================
   تسوق - Database Layer
   يدعم SQLite (للتطوير المحلي) و MySQL (للإستضافة)
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "..", "data");
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");
const BACKUP_DIR = path.join(__dirname, "..", "backups");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const DB_DRIVER = process.env.DB_DRIVER || "sqlite";
const DB_PATH = path.join(DATA_DIR, "tasawuq.db");

let db = null;
let isSQLite = DB_DRIVER === "sqlite";

function hash(pw) {
  return crypto.createHash("sha256").update(String(pw || "")).digest("hex");
}

function nowISO() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"); }
function money(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// SQLite using node:sqlite if available
if (isSQLite) {
  try {
    const { DatabaseSync } = require("node:sqlite");
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  } catch(e) {
    // fallback minimal in-memory style via JSON not needed; will use basic file
    console.error("SQLite not available via node:sqlite, trying better-sqlite3 style not present");
  }
}

function initSchema() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      password TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin','moderator','user')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active','pending','blocked')),
      city TEXT,
      address TEXT,
      bio TEXT,
      permissions TEXT DEFAULT '{}',
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      icon TEXT,
      type TEXT CHECK(type IN ('cars','real_estate','lands','other')) DEFAULT 'other',
      parent_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER,
      title TEXT NOT NULL,
      slug TEXT UNIQUE,
      type TEXT CHECK(type IN ('cars','real_estate','lands')) NOT NULL,
      price REAL DEFAULT 0,
      currency TEXT DEFAULT 'EGP',
      negotiable INTEGER DEFAULT 1,
      description TEXT,
      city TEXT,
      area TEXT,
      address TEXT,
      lat REAL,
      lng REAL,
      phone TEXT,
      whatsapp TEXT,
      views INTEGER DEFAULT 0,
      featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','sold','expired')),
      rejection_reason TEXT,
      commission_paid INTEGER DEFAULT 0,
      commission_amount REAL DEFAULT 0,
      expires_at TEXT,
      sold_at TEXT,
      approved_at TEXT,
      approved_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS listing_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('image','video')) DEFAULT 'image',
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS listing_attrs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      attr_key TEXT NOT NULL,
      attr_value TEXT,
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      listing_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, listing_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user INTEGER NOT NULL,
      to_user INTEGER NOT NULL,
      listing_id INTEGER,
      subject TEXT,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(from_user) REFERENCES users(id),
      FOREIGN KEY(to_user) REFERENCES users(id),
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reviewer_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      listing_id INTEGER,
      rating INTEGER CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(reviewer_id) REFERENCES users(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER,
      seller_id INTEGER,
      buyer_id INTEGER,
      amount REAL DEFAULT 0,
      commission REAL DEFAULT 0,
      commission_percent REAL DEFAULT 2,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled')),
      note TEXT,
      processed_by INTEGER,
      processed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(listing_id) REFERENCES listings(id),
      FOREIGN KEY(seller_id) REFERENCES users(id),
      FOREIGN KEY(buyer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE,
      content TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      ip TEXT,
      user_agent TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER,
      ip TEXT,
      user_agent TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedPermissions() {
  const defaults = [
    ['dashboard.view', 'عرض لوحة التحكم', 'الوصول للوحة التحكم (dashboard)'],
    ['listings.view_all', 'عرض جميع الإعلانات (إدارة)', 'عرض قائمة إعلانات في لوحة الإدارة'],
    ['listings.approve', 'موافقة/رفض الإعلانات', 'الموافقة أو رفض الإعلانات المعلقة'],
    ['listings.feature', 'تمييز الإعلانات', 'تعيين/إلغاء featured'],
    ['listings.delete_any', 'حذف أي إعلان', 'حذف إعلانات مستخدمين آخرين'],
    ['listings.manage_own', 'إدارة إعلاناته', 'إضافة/تعديل/حذف إعلاناته'],
    ['users.view', 'عرض المستخدمين', 'عرض قائمة المستخدمين'],
    ['users.change_role', 'تغيير دور مستخدم', 'تعيين admin/moderator/user'],
    ['users.block', 'حظر/تنشيط مستخدم', 'block/unblock'],
    ['users.delete', 'حذف مستخدم', 'حذف حساب'],
    ['categories.manage', 'إدارة الفئات', 'إضافة/تعديل/حذف فئات'],
    ['transactions.manage', 'إدارة المعاملات', 'تسجيل/إتمام/إلغاء'],
    ['backup.manage', 'النسخ الاحتياطي', 'إنشاء/تنزيل نسخ'],
    ['settings.manage', 'الإعدادات', 'تعديل إعدادات الموقع'],
    ['pages.manage', 'صفحات CMS', 'تعديل صفحات (من نحن، ...)'],
    ['activity.view', 'سجل النشاط', 'عرض activity log'],
    ['favorites.manage', 'المفضلة', 'إضافة/إزالة مفضلة'],
    ['messages.manage', 'الرسائل', 'إرسال/قراءة رسائل'],
  ];
  const c = db.prepare("SELECT COUNT(*) as cnt FROM permissions").get();
  if (c.cnt === 0) {
    const ins = db.prepare("INSERT INTO permissions (key,label,description) VALUES (?,?,?)");
    for (const d of defaults) ins.run(d[0], d[1], d[2]);
  }
}
function seed() {
  seedPermissions();
  if (!db) return;
  const c = db.prepare("SELECT COUNT(*) as cnt FROM users").get();
  if (c && c.cnt > 0) return;

  // Admin user
  db.prepare("INSERT INTO users (name,email,phone,password,role,status) VALUES (?,?,?,?,?,?)")
    .run("مدير الموقع", "admin", "01000000000", hash("admin123"), "admin", "active");

  // Moderator
  db.prepare("INSERT INTO users (name,email,phone,password,role,status) VALUES (?,?,?,?,?,?)")
    .run("مشرف الموقع", "moderator", "01000000001", hash("admin123"), "moderator", "active");

  // Categories
  const cats = [
    ["سيارات", "cars", "🚗", "cars", 1],
    ["عقارات - شقق وفلل", "real-estate", "🏠", "real_estate", 2],
    ["أراضي", "lands", "🌍", "lands", 3],
  ];
  const insCat = db.prepare("INSERT INTO categories (name,slug,icon,type,sort_order) VALUES (?,?,?,?,?)");
  for (const x of cats) insCat.run(x[0],x[1],x[2],x[3],x[4]);

  // Settings
  const insSet = db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)");
  insSet.run("site_name", "تسوق");
  insSet.run("site_desc", "موقع مبوبات لبيع وشراء السيارات والمنازل والأراضي");
  insSet.run("commission_percent", "2");
  insSet.run("currency", "ج.م");
  insSet.run("theme_default", "light");
  insSet.run("allow_registration", "1");
  insSet.run("require_approval", "1");
  insSet.run("enable_backup", "1");
  insSet.run("contact_phone", "01000762462");
  insSet.run("contact_email", "info@tasawuq.example");
  insSet.run("whatsapp", "01000762462");
  insSet.run("address", "القاهرة، جمهورية مصر العربية");
  insSet.run("hero_title", "السوق الموثوق للسيارات والعقارات والأراضي");
  insSet.run("hero_subtitle", "بيع واشتري بكل ثقة وسهولة — إعلانات موثقة وتواصل مباشر مع المعلن.");
  insSet.run("contact_phone", "01000762462");
  insSet.run("contact_email", "info@tasawuq.example");
  insSet.run("whatsapp", "01000762462");
  insSet.run("address", "القاهرة، جمهورية مصر العربية");
  insSet.run("hero_title", "السوق الموثوق للسيارات والعقارات والأراضي");
  insSet.run("hero_subtitle", "بيع واشتري بكل ثقة وسهولة — إعلانات موثقة وتواصل مباشر مع المعلن.");

  // Pages
  db.prepare("INSERT INTO pages (title,slug,content,active) VALUES (?,?,?,1)").run("من نحن", "about", "<h1>من نحن</h1><p>تسوق هو سوقك الموثوق للسيارات والعقارات والأراضي في مصر. هدفنا أن نجعل البيع والشراء عملية بسيطة وآمنة: إعلانات واضحة، صور حقيقية، تواصل مباشر مع المعلن، وإشراف إداري على كل إعلان قبل ظهوره.</p><h3>لماذا تسوق؟</h3><ul><li>إعلانات مُراجعة ومعتمدة يومياً.</li><li>أقسام منظمة للسيارات والشقق والفلل والأراضي.</li><li>بحث سريع حسب المدينة والسعر والمواصفات.</li><li>نظام عمولة شفاف ومتابعة كاملة للمعاملات.</li></ul>");
  db.prepare("INSERT INTO pages (title,slug,content,active) VALUES (?,?,?,1)").run("شروط الاستخدام", "terms", "<h1>شروط الاستخدام</h1><p>يُستخدم الموقع لأغراض البيع والشراء المشروعة فقط. يجب أن تكون الإعلانات دقيقة وصورها حقيقية، ويُمنع نشر بيانات مضللة أو مكررة. يحتفظ الموقع بحق مراجعة أو رفض أي إعلان لا يستوفي المعايير.</p>");
  db.prepare("INSERT INTO pages (title,slug,content,active) VALUES (?,?,?,1)").run("سياسة الخصوصية", "privacy", "<h1>سياسة الخصوصية</h1><p>تُستخدم بياناتك لتفعيل حسابك وعرض إعلاناتك وتسهيل التواصل مع المعلنين. لا نشارك بياناتك مع أطراف ثالثة إلا بعد موافقتك أو عند الالتزام القانوني. يمكنك طلب تعديل أو حذف بياناتك من الإدارة.</p>");

  console.log("✓ تم تهيئة قاعدة البيانات وإضافة البيانات الأولية");
  console.log("  • المدير: admin / admin123");
  console.log("  • المشرف: moderator / admin123");

  seedDemo();
}

/* ------------------------------------------------------------
   بيانات تجريبية واقعية (مستخدمون + إعلانات + صور)
   ------------------------------------------------------------ */
function seedDemo() {
  const demoUsers = [
    ["أحمد محمود", "01011112222", "ahmed@demo.com", "القاهرة"],
    ["سارة عبد الله", "01022223333", "sara@demo.com", "الجيزة"],
    ["محمد الشريف", "01033334444", "mohamed@demo.com", "الإسكندرية"],
    ["نور الهدى", "01044445555", "nour@demo.com", "المنصورة"],
    ["ليلى حسن", "01055556666", "layla@demo.com", "الجيزة"],
    ["كريم فتحي", "01066667777", "karim@demo.com", "القاهرة"],
  ];
  const userIds = [];
  for (const [name, phone, email, city] of demoUsers) {
    const r = db.prepare("INSERT INTO users (name,email,phone,password,role,status,city) VALUES (?,?,?,?,?,?,?)")
      .run(name, email, phone, hash("admin123"), "user", "active", city);
    userIds.push(r.lastInsertRowid);
  }

  const IMG = {
    car1: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&q=80",
    car2: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80",
    car3: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&q=80",
    car4: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&q=80",
    car5: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200&q=80",
    car6: "https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200&q=80",
    re1: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80",
    re2: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
    re3: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    re4: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
    re5: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
    re6: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
    land1: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80",
    land2: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80",
    land3: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=80",
    land4: "https://images.unsplash.com/photo-1444858291040-58f756a3bdd6?w=1200&q=80",
  };

  const listings = [
    // سيارات
    { u:0, type:"cars", cat:1, title:"تويوتا كورولا 2022 فل أوبشن - حالة ممتازة", price: 850000, city:"القاهرة", area:"مدينة نصر", desc:"تويوتا كورولا 2022، ماشية 25 ألف كيلو فقط، فابريكة بالكامل، صيانة دورية في التوكيل، رخصة سنة، تكييف ممتاز، بدون أي حوادث.", img:[IMG.car1,IMG.car5], attrs:{brand:"تويوتا",model:"كورولا",year:"2022",km:"25000",fuel:"بنزين",transmission:"أوتوماتيك",color:"أبيض",condition:"مستعمل"}, featured:1, views:342 },
    { u:1, type:"cars", cat:1, title:"مرسيدس C200 موديل 2021 - فتحة سقف", price: 2450000, city:"الجيزة", area:"الشيخ زايد", desc:"مرسيدس C200 AMG كاملة، ماشية 40 ألف كيلو، فتحة سقف بانوراما، جنوط رياضية، حالة الوكالة، صيانة منتظمة.", img:[IMG.car2,IMG.car4], attrs:{brand:"مرسيدس",model:"C200",year:"2021",km:"40000",fuel:"بنزين",transmission:"أوتوماتيك",color:"أسود",condition:"مستعمل"}, featured:1, views:891 },
    { u:2, type:"cars", cat:1, title:"هيونداي إلنترا 2023 - زيرو كيلومتر", price: 1120000, city:"الإسكندرية", area:"سموحة", desc:"هيونداي إلنترا 2023 زيرو كيلومتر، ضمان الوكيل 5 سنوات، جميع الكماليات، لون أبيض لؤلؤي.", img:[IMG.car3,IMG.car6], attrs:{brand:"هيونداي",model:"إلنترا",year:"2023",km:"0",fuel:"بنزين",transmission:"أوتوماتيك",color:"أبيض",condition:"جديد"}, views:456 },
    { u:3, type:"cars", cat:1, title:"بي إم دبليو 320i - موديل 2019", price: 1850000, city:"المنصورة", area:"شارع الجمهورية", desc:"بي إم دبليو 320i، ماشية 65 ألف كيلو، حالة ممتازة، صيانة دورية، جنوط أصلية، رخصة سارية.", img:[IMG.car4,IMG.car1], attrs:{brand:"بي إم دبليو",model:"320i",year:"2019",km:"65000",fuel:"بنزين",transmission:"أوتوماتيك",color:"رمادي",condition:"مستعمل"}, views:223 },
    { u:0, type:"cars", cat:1, title:"كيا سبورتاج 2021 - فول أوبشن", price: 1350000, city:"القاهرة", area:"المعادي", desc:"كيا سبورتاج 2021، ماشية 38 ألف كيلو، جميع الكماليات، فتحة سقف، كاميرا خلفية، رادار.", img:[IMG.car5,IMG.car2], attrs:{brand:"كيا",model:"سبورتاج",year:"2021",km:"38000",fuel:"بنزين",transmission:"أوتوماتيك",color:"أزرق",condition:"مستعمل"}, views:167 },
    { u:1, type:"cars", cat:1, title:"شيفروليه أوبترا 2020 - اقتصادية جداً", price: 620000, city:"الجيزة", area:"فيصل", desc:"شيفروليه أوبترا 2020، ماشية 55 ألف كيلو، حالة جيدة، اقتصادية في البنزين، مناسبة للأسر.", img:[IMG.car6,IMG.car3], attrs:{brand:"شيفروليه",model:"أوبترا",year:"2020",km:"55000",fuel:"بنزين",transmission:"أوتوماتيك",color:"فضي",condition:"مستعمل"}, views:98 },

    // عقارات
    { u:1, type:"real_estate", cat:2, title:"شقة 3 غرف للبيع - مدينة نصر - تشطيب سوبر لوكس", price: 3200000, city:"القاهرة", area:"مدينة نصر", desc:"شقة 145 متر، 3 غرف، 2 حمام، الدور الثالث، تشطيب سوبر لوكس، مصعد، جراج، قريبة من المترو والخدمات.", img:[IMG.re1,IMG.re3], attrs:{rooms:"3",bathrooms:"2",area_m2:"145",floor:"الثالث",furnished:"لا"}, featured:1, views:674 },
    { u:2, type:"real_estate", cat:2, title:"فيلا مستقلة 5 غرف - كمبوند الشيخ زايد", price: 12500000, city:"الجيزة", area:"الشيخ زايد", desc:"فيلا مستقلة 400 متر، 5 غرف نوم، 4 حمام، حديقة خاصة، مسبح، كمبوند محروس 24 ساعة.", img:[IMG.re2,IMG.re4], attrs:{rooms:"5",bathrooms:"4",area_m2:"400",floor:"أرضي",furnished:"لا"}, featured:1, views:1204 },
    { u:3, type:"real_estate", cat:2, title:"شقة مفروشة للإيجار - سموحة - 2 غرفة", price: 18000, city:"الإسكندرية", area:"سموحة", desc:"شقة مفروشة بالكامل للإيجار الشهري، 2 غرفة، 1 حمام، مساحة 90 متر، قريبة من البحر.", img:[IMG.re3,IMG.re1], attrs:{rooms:"2",bathrooms:"1",area_m2:"90",floor:"الخامس",furnished:"نعم"}, views:345 },
    { u:0, type:"real_estate", cat:2, title:"مكتب إداري 120 متر - وسط البلد", price: 45000, city:"القاهرة", area:"وسط البلد", desc:"مكتب إداري 120 متر، الدور السادس، مصعد، تكييف مركزي، مناسب للشركات، إيجار شهري.", img:[IMG.re4,IMG.re6], attrs:{rooms:"3",bathrooms:"2",area_m2:"120",floor:"السادس",furnished:"جزئي"}, views:189 },
    { u:1, type:"real_estate", cat:2, title:"شقة 2 غرفة - الهرم - للبيع بالتقسيط", price: 1750000, city:"الجيزة", area:"الهرم", desc:"شقة 95 متر، 2 غرفة، 1 حمام، متاح تقسيط على 5 سنوات، مقدم 30%، تشطيب جيد.", img:[IMG.re5,IMG.re2], attrs:{rooms:"2",bathrooms:"1",area_m2:"95",floor:"الثاني",furnished:"لا"}, views:512 },
    { u:2, type:"real_estate", cat:2, title:"دوبلكس 4 غرف - التجمع الخامس", price: 6800000, city:"القاهرة", area:"التجمع الخامس", desc:"دوبلكس 250 متر، 4 غرف، 3 حمام، روف خاص، كمبوند سكني هادئ، خدمات متكاملة.", img:[IMG.re6,IMG.re5], attrs:{rooms:"4",bathrooms:"3",area_m2:"250",floor:"الأول",furnished:"لا"}, views:723 },

    // أراضي
    { u:2, type:"lands", cat:3, title:"أرض زراعية 5 أفدنة - طريق الإسكندرية الصحراوي", price: 4500000, city:"الإسكندرية", area:"طريق الصحراوي", desc:"أرض زراعية 5 أفدنة، تربة خصبة، مياه جوفية، كهرباء، أوراق كاملة، واجهة 200 متر على الطريق.", img:[IMG.land1,IMG.land2], attrs:{area_m2:"21000",land_type:"زراعية",purpose:"للبيع"}, featured:1, views:445 },
    { u:0, type:"lands", cat:3, title:"أرض بناء 600 متر - مدينة العبور", price: 2800000, city:"القاهرة", area:"مدينة العبور", desc:"أرض بناء 600 متر، موقع مميز، مرخصة، واجهة 20 متر، جميع المرافق متوفرة، استلام فوري.", img:[IMG.land2,IMG.land3], attrs:{area_m2:"600",land_type:"بناء",purpose:"للبيع"}, views:678 },
    { u:3, type:"lands", cat:3, title:"مزرعة 10 أفدنة - النوبارية", price: 8000000, city:"البحيرة", area:"النوبارية", desc:"مزرعة 10 أفدنة، مثمرة، بئر مياه، منزل إداري، معدات زراعية، فرصة استثمارية ممتازة.", img:[IMG.land3,IMG.land1], attrs:{area_m2:"42000",land_type:"زراعية",purpose:"للبيع"}, views:334 },
    { u:1, type:"lands", cat:3, title:"أرض سكنية 400 متر - الشيخ زايد", price: 5600000, city:"الجيزة", area:"الشيخ زايد", desc:"أرض سكنية 400 متر، في كمبوند راقي، جميع المرافق، تصميم معماري جاهز، ملكية كاملة.", img:[IMG.land4,IMG.land2], attrs:{area_m2:"400",land_type:"سكنية",purpose:"للبيع"}, views:889 },
     { u:4, type:"cars", cat:1, title:"نيسان باترول 2020 - حالة ممتازة", price: 1750000, city:"الجيزة", area:"الشيخ زايد", desc:"نيسان باترول 2020، ماشية 48 ألف كيلو، صيانة منتظمة، كاميرا 360، مقاعد جلد، حالة ممتازة وجاهزة للمعاينة.", img:[IMG.car6,IMG.car1], attrs:{brand:"نيسان",model:"باترول",year:"2020",km:"48000",fuel:"بنزين",transmission:"أوتوماتيك",color:"أبيض",condition:"مستعمل"}, status:"pending", views:42 },
     { u:5, type:"real_estate", cat:2, title:"شقة 2 غرفة - مدينة العبور - للبيع", price: 950000, city:"القاهرة", area:"مدينة العبور", desc:"شقة 85 متر، غرفتين وصالة وحمام، الدور الرابع، تشطيب جيد، قريبة من الخدمات والمواصلات، عقد نهائي.", img:[IMG.re5,IMG.re4], attrs:{rooms:"2",bathrooms:"1",area_m2:"85",floor:"الرابع",furnished:"لا"}, status:"pending", views:31 },
     { u:4, type:"lands", cat:3, title:"أرض بناء 350 متر - التجمع الأول", price: 1200000, city:"القاهرة", area:"التجمع الأول", desc:"أرض بناء 350 متر، واجهة 17 متر، مرافق كاملة، موقع مميز قريب من الخدمات، ملكية خالصة.", img:[IMG.land2,IMG.land3], attrs:{area_m2:"350",land_type:"بناء",purpose:"للبيع"}, status:"pending", views:18 },
  ];

  const insL = db.prepare(`INSERT INTO listings
    (user_id,category_id,title,slug,type,price,currency,negotiable,description,city,area,address,phone,whatsapp,views,featured,status,approved_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insM = db.prepare("INSERT INTO listing_media (listing_id,type,url,sort_order) VALUES (?,?,?,?)");
  const insA = db.prepare("INSERT INTO listing_attrs (listing_id,attr_key,attr_value) VALUES (?,?,?)");

  let i = 0;
  for (const l of listings) {
    const created = new Date(Date.now() - (i+1) * 36e5 * 7).toISOString();
    const slug = l.title.replace(/[^\p{L}\p{N}]+/gu,'-').toLowerCase().slice(0,60) + '-' + (Date.now()+i);
    const approvedAt = l.status === "pending" ? null : created;
    const r = insL.run(userIds[l.u], l.cat, l.title, slug, l.type, l.price, 'ج.م', 1, l.desc, l.city, l.area||'', l.area?l.area+' - '+l.city:'', demoUsers[l.u][1], demoUsers[l.u][1], l.views||0, l.featured||0, l.status||'approved', approvedAt, created);
    let sort = 0;
    for (const url of l.img) insM.run(r.lastInsertRowid, 'image', url, sort++);
    for (const [k,v] of Object.entries(l.attrs||{})) insA.run(r.lastInsertRowid, k, v);
    i++;
  }

  // معاملة تجريبية للعمولة
  db.prepare(`INSERT INTO transactions (listing_id,seller_id,buyer_id,amount,commission,commission_percent,status,note,processed_at)
              VALUES (?,?,?,?,?,?,?,?,?)`).run(2, userIds[1], userIds[3], 2450000, 49000, 2, 'completed', 'بيع سيارة مرسيدس C200', new Date().toISOString());

  // رسائل تجريلية بين المستخدمين والإدارة
  const insMsg = db.prepare("INSERT INTO messages (from_user,to_user,listing_id,subject,message,read,created_at) VALUES (?,?,?,?,?,?,?)");
  const ago = (h) => new Date(Date.now() - h * 36e5).toISOString();
  [
    [3,1,1,'استفسار عن تويوتا كورولا','السلام عليكم، هل السيارة متاحة للمعاينة هذا الأسبوع؟',0,ago(3)],
    [4,1,7,'تفاوض على شقة مدينة نصر','أهلاً، هل السعر قابل للتفاوض؟ ومتى يمكن زيارة الشقة؟',0,ago(8)],
    [1,3,1,'رد على استفسار السيارة','وعليكم السلام، السيارة متاحة للمعاينة غداً بعد العصر في مدينة نصر.',1,ago(2)],
    [5,1,13,'استفسار عن الأرض الزراعية','هل الأرض مرخصة للبناء؟ وما هي إجراءات نقل الملكية؟',0,ago(20)],
    [6,1,8,'طلب معاينة فيلا','أود معاينة الفيلا يوم السبت، هل يناسبكم الموعد؟',1,ago(30)],
  ].forEach((m) => insMsg.run(...m));

  const insFav = db.prepare("INSERT INTO favorites (user_id,listing_id,created_at) VALUES (?,?,?)");
  [[3,2],[4,7],[5,13],[6,8],[7,3]].forEach(([uid,lid]) => insFav.run(uid, lid, ago(12)));

  const insRev = db.prepare("INSERT INTO reviews (reviewer_id,user_id,listing_id,rating,comment,created_at) VALUES (?,?,?,?,?,?)");
  [
    [4,3,1,5,'تعامل ممتاز والسيارة كما الوصف تماماً.'],
    [5,4,7,4,'شقة جيدة ومالك متعاون، أنصح بالتعامل.'],
    [3,5,13,5,'مصداقية عالية في الإعلان وسرعة في الرد.'],
  ].forEach((r) => insRev.run(...r, ago(24)));

  const insAct = db.prepare("INSERT INTO activity_log (user_id,action,ip,user_agent,details,created_at) VALUES (?,?,?,?,?,?)");
  [
    [1,'login','127.0.0.1','Demo Browser','تسجيل دخول المدير'],
    [3,'listing_create','127.0.0.1','Demo Browser','إضافة إعلان تويوتا كورولا'],
    [1,'listing_approve','127.0.0.1','Demo Browser','اعتماد إعلان تويوتا كورولا'],
    [4,'favorite_add','127.0.0.1','Demo Browser','إضافة شقة مدينة نصر للمفضلة'],
    [2,'message_read','127.0.0.1','Demo Browser','قراءة رسالة استفسار'],
  ].forEach((a) => insAct.run(...a, ago(6)));

  console.log(`✓ تم إضافة ${listings.length} إعلان تجريبي و ${demoUsers.length} مستخدمين`);
}

function q(sql, params=[]) {
  if (!db) throw new Error("DB not initialized");
  if (sql.trim().toLowerCase().startsWith("select")) {
    const stmt = db.prepare(sql);
    if (params && params.length) return stmt.all(...params);
    return stmt.all();
  }
  const stmt = db.prepare(sql);
  if (params && params.length) return stmt.run(...params);
  return stmt.run();
}
function one(sql, params=[]) {
  if (!db) throw new Error("DB not initialized");
  const stmt = db.prepare(sql);
  if (params && params.length) return stmt.get(...params);
  return stmt.get();
}

module.exports = { db, initSchema, seed, q, one, hash, nowISO, today, uid, money, DATA_DIR, UPLOAD_DIR, BACKUP_DIR, DB_PATH, isSQLite };
