/* ============================================================
   طلباتك — Database layer
   - محليًا: SQLite عبر node:sqlite (بدون أي تثبيت)
   - على الاستضافة: MySQL/MariaDB عبر DATABASE_URL فقط
   ============================================================ */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/* ---------- قارئ .env بسيط بدون تبعيات ---------- */
function loadEnv() {
  const f = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(f)) return;
  let text = "";
  try { text = fs.readFileSync(f, "utf8"); } catch (e) { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined && process.env[m[1]] !== "") continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

const DATA_DIR = process.env.TALABATAK_DATA ? path.resolve(process.env.TALABATAK_DATA) : path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
/* مجلد النسخ الاحتياطي الافتراضي — ننشئه مسبقًا حتى يعمل متصفح المجلدات */
if (!fs.existsSync(path.join(DATA_DIR, "backups"))) fs.mkdirSync(path.join(DATA_DIR, "backups"), { recursive: true });
const DB_PATH = path.join(DATA_DIR, "app.db");

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const DB_KIND = /^(mysql|mariadb):/i.test(DATABASE_URL) ? "mysql" : "sqlite";

let db;
let driver;
if (DB_KIND === "mysql") {
  driver = require("./mysql-sync").connect(DATABASE_URL);
  db = { exec: (sql) => driver.exec(sql) };
} else {
  const { DatabaseSync } = require("node:sqlite");
  const raw = new DatabaseSync(DB_PATH);
  raw.exec("PRAGMA journal_mode=WAL;");
  db = raw;
  driver = {
    all: (sql, ...p) => raw.prepare(sql).all(...p),
    one: (sql, ...p) => raw.prepare(sql).get(...p),
    run: (sql, ...p) => raw.prepare(sql).run(...p),
    exec: (sql) => raw.exec(sql),
  };
}

/* ---------- tiny query helpers ---------- */
const all = (sql, ...p) => driver.all(sql, ...p);
const one = (sql, ...p) => driver.one(sql, ...p);
const run = (sql, ...p) => driver.run(sql, ...p);
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const money = n => Math.round((Number(n) || 0) * 100) / 100;
const hash = s => crypto.createHash("sha256").update(String(s)).digest("hex");

/* ---------- image helper (inline SVG data-uri, offline) ---------- */
function svgImg(emoji, c1, c2, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="400" height="400" fill="url(#g)"/>` +
    `<circle cx="200" cy="185" r="110" fill="rgba(255,255,255,.25)"/>` +
    `<text x="200" y="238" font-size="130" text-anchor="middle">${emoji}</text>` +
    (label ? `<text x="200" y="360" font-size="30" font-family="Tahoma" font-weight="bold" text-anchor="middle" fill="rgba(255,255,255,.9)">${label}</text>` : "") +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
function logoSvg() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B35"/><stop offset="1" stop-color="#E8560F"/></linearGradient></defs>` +
    `<rect width="240" height="240" rx="56" fill="url(#g)"/>` +
    `<path d="M55 150 h130 l-14 -34 h-40 l-10 -18 h-42 z" fill="#fff" opacity=".95"/>` +
    `<circle cx="92" cy="172" r="15" fill="#fff"/><circle cx="160" cy="172" r="15" fill="#fff"/>` +
    `<path d="M120 40 l14 26 h-28 z" fill="#fff"/>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/* ============================================================ SCHEMA */
function createSchema() {
  db.exec(`
CREATE TABLE IF NOT EXISTS company(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT, logo TEXT, phone TEXT, email TEXT, address TEXT, currency TEXT DEFAULT 'ج.م', tax_percent REAL DEFAULT 0, tax_enabled INTEGER DEFAULT 0, delivery_fee REAL DEFAULT 0, about TEXT, working_hours TEXT, facebook TEXT, instagram TEXT);
CREATE TABLE IF NOT EXISTS branches(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, address TEXT, phone TEXT, manager TEXT, active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, phone TEXT, password TEXT, role TEXT DEFAULT 'staff', permissions TEXT DEFAULT '{}', active INTEGER DEFAULT 1, branch_id INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS pilots(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, vehicle TEXT, plate TEXT, branch_id INTEGER, active INTEGER DEFAULT 1, rating REAL DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, address TEXT, balance REAL DEFAULT 0, notes TEXT, active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT UNIQUE, address TEXT, points INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, orders_count INTEGER DEFAULT 0, rating REAL DEFAULT 0, notes TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, image TEXT, active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER, name TEXT, description TEXT, image TEXT, price REAL DEFAULT 0, cost REAL DEFAULT 0, unit TEXT DEFAULT 'قطعة', barcode TEXT, stock REAL DEFAULT 0, min_stock REAL DEFAULT 5, active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS inventory_moves(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, branch_id INTEGER, type TEXT, qty REAL, balance_after REAL, ref TEXT, note TEXT, date TEXT, user_id INTEGER);
CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, date TEXT, status TEXT DEFAULT 'draft', total REAL DEFAULT 0, paid REAL DEFAULT 0, payment_method_id INTEGER, warehouse TEXT, note TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS purchase_items(id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER, product_id INTEGER, qty REAL, cost REAL, total REAL);
CREATE TABLE IF NOT EXISTS payment_methods(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, kind TEXT DEFAULT 'cash', active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, customer_id INTEGER, branch_id INTEGER, pilot_id INTEGER, payment_method_id INTEGER, promo_id INTEGER, promo_code TEXT, status TEXT DEFAULT 'new', subtotal REAL DEFAULT 0, discount REAL DEFAULT 0, delivery_fee REAL DEFAULT 0, tax REAL DEFAULT 0, total REAL DEFAULT 0, paid TEXT DEFAULT 'unpaid', note TEXT, address TEXT, phone TEXT, rating REAL, rating_comment TEXT, created_at TEXT, updated_at TEXT, delivered_at TEXT, cancel_reason TEXT);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, name TEXT, price REAL, qty REAL, total REAL);
CREATE TABLE IF NOT EXISTS order_events(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, status TEXT, note TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS promotions(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, kind TEXT DEFAULT 'percent', value REAL DEFAULT 0, code TEXT UNIQUE, start_at TEXT, end_at TEXT, min_order REAL DEFAULT 0, active INTEGER DEFAULT 1, category_id INTEGER, used_count INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS rewards(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, kind TEXT DEFAULT 'discount', value REAL DEFAULT 0, note TEXT, active INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS ads(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, image TEXT, link TEXT, position TEXT DEFAULT 'home', start_at TEXT, end_at TEXT, active INTEGER DEFAULT 1, clicks INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT, type TEXT, parent_id INTEGER, kind TEXT DEFAULT 'normal', is_system INTEGER DEFAULT 0, balance REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS journals(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, ref_type TEXT, ref_id INTEGER, memo TEXT, created_by INTEGER, approved INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS journal_lines(id INTEGER PRIMARY KEY AUTOINCREMENT, journal_id INTEGER, account_id INTEGER, debit REAL DEFAULT 0, credit REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS cash_accounts(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT DEFAULT 'treasury', name TEXT, holder TEXT, branch_id INTEGER, account_no TEXT, balance REAL DEFAULT 0, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS vouchers(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT DEFAULT 'payment', source TEXT DEFAULT 'cash', cash_account_id INTEGER, party_type TEXT, party_id INTEGER, amount REAL DEFAULT 0, date TEXT, memo TEXT, ref TEXT, journal_id INTEGER, created_by INTEGER, approved INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS stock_counts(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, branch_id INTEGER, status TEXT DEFAULT 'draft', memo TEXT, created_by INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS stock_count_items(id INTEGER PRIMARY KEY AUTOINCREMENT, count_id INTEGER, product_id INTEGER, unit_cost REAL, system_qty REAL, actual_qty REAL, diff REAL, memo TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, kind TEXT, user_id INTEGER, customer_id INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS counters(name TEXT PRIMARY KEY, value INTEGER);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT, action TEXT, entity TEXT, entity_id INTEGER, detail TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS password_history(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, password TEXT, changed_at TEXT);
CREATE TABLE IF NOT EXISTS zones(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, fee REAL DEFAULT 0, eta TEXT, active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, notes TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS units(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, symbol TEXT, allow_fraction INTEGER DEFAULT 1, active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS backup_dirs(id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE, note TEXT, is_default INTEGER DEFAULT 0, created_at TEXT);
/* ---- إثبات الدفع: كل محاولة تحويل يرفعها العميل مع صورة الإشعار ---- */
CREATE TABLE IF NOT EXISTS payment_proofs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER, method_id INTEGER, method_name TEXT,
  amount REAL DEFAULT 0, txn_ref TEXT, paid_at TEXT, note TEXT,
  image TEXT, image_name TEXT, image_mime TEXT,
  status TEXT DEFAULT 'pending',        -- pending | approved | rejected
  reject_reason TEXT,
  reviewed_by INTEGER, reviewed_at TEXT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pp_order ON payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_pp_status ON payment_proofs(status);

/* ---- إشعارات العميل: رسائل تلقائية تُنشأ عند تغيّر حالة الطلب أو اعتماد/رفض الدفع ---- */
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER, order_id INTEGER,
  kind TEXT DEFAULT 'info',              -- proof_approved | proof_rejected | order_status | info
  title TEXT, body TEXT, icon TEXT DEFAULT '🔔',
  is_read INTEGER DEFAULT 0,             -- 0 غير مقروء | 1 مقروء
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_cust ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(customer_id, is_read);
`);
}

/* ============================================================ HELPERS */

/** add inventory movement + update product stock, returns the move */
function addMove({ product_id, branch_id = null, type, qty, ref = "", note = "", date, user_id = null }) {
  const p = one("SELECT stock,cost FROM products WHERE id=?", product_id);
  if (!p) throw new Error("منتج غير موجود");
  const newQty = Number(p.stock) + Number(qty);
  const d = date || today();
  const r = run(
    "INSERT INTO inventory_moves(product_id,branch_id,type,qty,balance_after,ref,note,date,user_id) VALUES(?,?,?,?,?,?,?,?,?)",
    product_id, branch_id, type, qty, newQty, ref, note, d, user_id
  );
  run("UPDATE products SET stock=? WHERE id=?", newQty, product_id);
  return one("SELECT * FROM inventory_moves WHERE id=?", r.lastInsertRowid);
}

/** post a journal entry (قيد محاسبي) and update account balances */
function postJournal({ date, ref_type = "", ref_id = null, memo = "", lines = [], created_by = null, approved = 1 }) {
  const deb = money(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const cre = money(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  if (Math.abs(deb - cre) > 0.01) throw new Error(`القيد غير متوازن (مدين ${deb} / دائن ${cre})`);
  const r = run("INSERT INTO journals(date,ref_type,ref_id,memo,created_by,approved,created_at) VALUES(?,?,?,?,?,?,?)",
    date || today(), ref_type, ref_id, memo, created_by, approved, nowISO());
  const jid = r.lastInsertRowid;
  for (const l of lines) {
    if (!Number(l.debit) && !Number(l.credit)) continue;
    run("INSERT INTO journal_lines(journal_id,account_id,debit,credit) VALUES(?,?,?,?)",
      jid, l.account_id, money(l.debit) || 0, money(l.credit) || 0);
    run("UPDATE accounts SET balance = balance + ? WHERE id=?", money((Number(l.debit) || 0)) - money((Number(l.credit) || 0)), l.account_id);
  }
  return one("SELECT * FROM journals WHERE id=?", jid);
}
const accByCode = code => one("SELECT * FROM accounts WHERE code=?", code);
const accId = code => (accByCode(code) || {}).id;

function ensureDefaultAdmin() {
  try {
    const u = one("SELECT * FROM users WHERE role='admin' ORDER BY id LIMIT 1");
    if (!u) {
      run("INSERT INTO users(name,email,phone,password,role,permissions,active,created_at) VALUES(?,?,?,?,?,?,?,?)",
        "مدير النظام", "admin", "01000000001", hash("admin123"), "admin", "{}", 1, nowISO());
      return;
    }
    /* ترحيل بيانات الدخول القديمة فقط — لا نلمس كلمة مرور غيّرها المستخدم */
    const legacy = (u.email === "admin" && u.password === hash("admin123")) ||
                   (u.email === "admin@talabatak.com" && u.password === hash("123456"));
    if (legacy) {
      run("UPDATE users SET name=?, email=?, password=?, role='admin', permissions='{}', active=1 WHERE id=?",
        "مدير النظام", "admin", hash("admin123"), u.id);
    }
  } catch (e) { /* ignore */ }
}

/* ============================================================ SEED */
function seed() {
  const now = nowISO();
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
  const dayAgo = n => daysAgo(n).slice(0, 10);

  /* --- 1. Company --- */
  run(`INSERT INTO company(id,name,logo,phone,email,address,currency,tax_percent,tax_enabled,delivery_fee,about,working_hours,facebook,instagram) VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    "طلباتك", logoSvg(), "01001234567", "info@talabatak.com", "١٥ شارع النصر، المعادي، القاهرة", "ج.م", 14, 0, 25,
    "طلباتك — أول تطبيق توصيل يجمع السوبر ماركت والخضراوات والفواكه حتى باب بيتك، بسرعة وأمان وجودة عالية.",
    "يومياً من ٨ ص حتى ١٢ م", "talabatak", "@talabatak");

  /* --- 2. Branches --- */
  const branchCairo = run("INSERT INTO branches(name,address,phone,manager,active,created_at) VALUES(?,?,?,?,?,?)",
    "فرع القاهرة – المعادي", "٢٧ شارع ٩، المعادي، القاهرة", "01001112233", "أحمد سالم", 1, now).lastInsertRowid;
  const branchGiza = run("INSERT INTO branches(name,address,phone,manager,active,created_at) VALUES(?,?,?,?,?,?)",
    "فرع الجيزة – الهرم", "٨ شارع الهرم، الجيزة", "01004445566", "محمود حسن", 1, now).lastInsertRowid;
  run("INSERT INTO branches(name,address,phone,manager,active,created_at) VALUES(?,?,?,?,?,?)",
    "فرع الإسكندرية – سموحة", "٣ شارع فؤاد، سموحة، الإسكندرية", "01007778899", "سارة عادل", 1, now);

  /* --- 3. Users --- */
  run("INSERT INTO users(name,email,phone,password,role,permissions,active,created_at) VALUES(?,?,?,?,?,?,?,?)",
    "مدير النظام", "admin", "01000000001", hash("admin123"), "admin", "{}", 1, now);
  run("INSERT INTO users(name,email,phone,password,role,permissions,active,branch_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    "مدير الفرع", "manager@talabatak.com", "01000000002", hash("123456"), "staff",
    JSON.stringify({ dashboard: ["view"], orders: ["view", "create", "update"], products: ["view", "create", "update"], categories: ["view"], inventory: ["view"], customers: ["view"], pilots: ["view"], reports: ["view"] }), 1, branchCairo, now);
  run("INSERT INTO users(name,email,phone,password,role,permissions,active,branch_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    "موظف بيع", "seller@talabatak.com", "01000000003", hash("123456"), "staff",
    JSON.stringify({ orders: ["view", "create"], customers: ["view", "create", "update"], products: ["view"], categories: ["view"] }), 1, branchCairo, now);

  /* --- 4. Pilots --- */
  const pilotIds = [];
  for (const [name, phone, vehicle, plate] of [
    ["خالد إبراهيم", "01011112233", "دراجة نارية Honda CG", "ط ن ب ١٢٣٤"],
    ["يوسف عادل", "01022223344", "موتوسيكل ياماها", "ط ن ب ٥٦٧٨"],
    ["سيد عبد الله", "01033334455", "فان توصيل Renault", "س ي ج ٩٠١٢"],
    ["عمرو فؤاد", "01044445566", "دراجة نارية Suzuki", "ط ن ب ٣٤٥٦"],
  ]) {
    pilotIds.push(run("INSERT INTO pilots(name,phone,vehicle,plate,branch_id,active,rating,created_at) VALUES(?,?,?,?,?,?,?,?)",
      name, phone, vehicle, plate, branchCairo, 1, 4.5 + Math.random() * 0.5, now).lastInsertRowid);
  }

  /* --- 5. Suppliers --- */
  const supplierIds = [];
  for (const [name, phone, address, notes] of [
    ["شركة النيل للتموين", "01055556677", "١٢ شارع الترعة، القاهرة", "مورد مواد غذائية رئيسية"],
    ["مزارع الوادي الأخضر", "01066667788", "المنيا – مركز بني مزار", "خضراوات وفواكه طازجة"],
    ["مصنع البركة للألبان", "01077778899", "العاشر من رمضان", "ألبان وأجبان"],
    ["شركة الشرق للمخبوزات", "01088889900", "٤ شارع البساتين، القاهرة", "خبز وحلويات"],
    ["مؤسسة الرياض للمشروبات", "01099990011", "القاهرة الجديدة", "مشروبات وعصائر"],
  ]) {
    supplierIds.push(run("INSERT INTO suppliers(name,phone,address,balance,notes,active,created_at) VALUES(?,?,?,?,?,?,?)",
      name, phone, address, 0, notes, 1, now).lastInsertRowid);
  }

  /* --- 6. Payment methods (مع بيانات استلام المبلغ لكل طريقة) --- */
  const pmCash = run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_number,pay_holder,pay_bank,pay_link,pay_instructions) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    "كاش عند الاستلام", "cash", 1, 1, 0, "", "", "", "",
    "لا تحتاج تحويل — ادفع نقدًا للمندوب عند استلام الطلب.").lastInsertRowid;
  const pmWallet = run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_number,pay_holder,pay_bank,pay_link,pay_instructions) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    "فودافون كاش", "wallet", 1, 2, 1, "01001234567", "طلباتك", "فودافون كاش", "",
    "حوّل المبلغ إلى رقم المحفظة أعلاه، ثم ارفع صورة إشعار التحويل.").lastInsertRowid;
  run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_number,pay_holder,pay_bank,pay_link,pay_instructions) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    "إنستاباي", "wallet", 1, 3, 1, "01001234567", "طلباتك", "إنستاباي (InstaPay)", "",
    "حوّل على حساب إنستاباي أعلاه ثم ارفع صورة الإشعار مع رقم العملية.");
  run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_number,pay_holder,pay_bank,pay_link,pay_instructions) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    "تحويل بنكي — البنك الأهلي", "online", 1, 4, 1, "1234 5678 9012 3456", "طلباتك",
    "البنك الأهلي المصري", "", "حوّل على رقم الحساب أعلاه، واستخدم رقم الطلب كمرجع للتحويل.");
  const pmCard = run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_number,pay_holder,pay_bank,pay_link,pay_instructions) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    "فيزا / ماستركارد (أونلاين)", "card", 1, 5, 1, "", "", "", "https://pay.example.com/talabatak",
    "ادفع بأمان عبر بوابة الدفع، ثم ارفع صورة إشعار العملية.").lastInsertRowid;

  /* --- 7. Categories --- */
  const CATS = [
    ["منتجات سوبر ماركت", "كل احتياجات البيت اليومية", "🛒", "#FF6B35", "#E8560F"],
    ["خضراوات وفواكه", "طازجة يومياً من المزارع", "🥬", "#16A34A", "#0EA5A4"],
    ["مخبوزات وحلويات", "خبز بلدي وحلويات شرقية", "🥖", "#F59E0B", "#EF4444"],
    ["مشروبات وعصائر", "مشروبات باردة وساخنة", "🥤", "#2563EB", "#7C3AED"],
    ["لحوم ودواجن", "لحوم طازجة ومجمدة", "🍗", "#DC2626", "#F97316"],
    ["منتجات ألبان", "ألبان وأجبان طازجة", "🧀", "#0EA5A4", "#2563EB"],
  ];
  const catIds = [];
  CATS.forEach((c, i) => {
    catIds.push(run("INSERT INTO categories(name,description,image,active,sort_order) VALUES(?,?,?,?,?)",
      c[0], c[1], svgImg(c[2], c[3], c[4], c[0]), 1, i + 1).lastInsertRowid);
  });

  /* --- 8. Products --- */
  const PRODUCTS = [
    // cat0: سوبر ماركت
    ["أرز مصري فاخر ٥ كجم", 145, 120, "كيس", "🍚", "#FF6B35", "#F59E0B", 60],
    ["سكر أبيض ١ كجم", 32, 26, "كيس", "🧂", "#F59E0B", "#EF4444", 120],
    ["زيت عباد الشمس ١ لتر", 78, 65, "زجاجة", "🫒", "#16A34A", "#84CC16", 80],
    ["مكرونة إيطالية ٤٠٠ جم", 18, 14, "كيس", "🍝", "#F97316", "#FBBF24", 200],
    ["شاي أسود ١٠٠ فتلة", 55, 45, "علبة", "🍵", "#166534", "#0EA5A4", 90],
    ["مسحوق غسيل ٣ كجم", 210, 175, "كيس", "🧼", "#2563EB", "#7C3AED", 40],
    // cat1: خضراوات وفواكه
    ["طماطم بلدي ١ كجم", 14, 9, "كجم", "🍅", "#DC2626", "#F97316", 150],
    ["خيار بلدي ١ كجم", 12, 8, "كجم", "🥒", "#16A34A", "#84CC16", 140],
    ["بطاطس بلدي ١ كجم", 11, 7, "كجم", "🥔", "#A16207", "#F59E0B", 180],
    ["بصل أحمر ١ كجم", 10, 6, "كجم", "🧅", "#B45309", "#EF4444", 160],
    ["موز استوائي ١ كجم", 30, 22, "كجم", "🍌", "#FBBF24", "#16A34A", 90],
    ["تفاح أحمر ١ كجم", 42, 33, "كجم", "🍎", "#DC2626", "#F59E0B", 70],
    ["برتقال بلدي ١ كجم", 18, 12, "كجم", "🍊", "#F97316", "#FBBF24", 110],
    ["خس بلدي", 8, 5, "حبة", "🥬", "#16A34A", "#22C55E", 100],
    // cat2: مخبوزات
    ["عيش بلدي أبيض", 6, 4, "رغيف", "🥖", "#F59E0B", "#FBBF24", 300],
    ["خبز توست مقرمش", 22, 16, "كيس", "🍞", "#D97706", "#EF4444", 80],
    ["بقسماط بالسمسم", 35, 27, "كيلو", "🍘", "#B45309", "#F59E0B", 60],
    ["بسبوسة بالقشطة", 45, 34, "صينية", "🍰", "#EC4899", "#F59E0B", 25],
    ["كنافة بالمانجو", 120, 90, "صحن", "🥭", "#F97316", "#EC4899", 15],
    // cat3: مشروبات
    ["مياه معدنية ١.٥ لتر", 6, 4, "زجاجة", "💧", "#2563EB", "#38BDF8", 400],
    ["عصير برتقال طبيعي ١ لتر", 38, 28, "عبوة", "🧃", "#F97316", "#FBBF24", 90],
    ["مشروب غازي ٢ لتر", 25, 19, "زجاجة", "🥤", "#DC2626", "#7C3AED", 120],
    ["شاي مثلج ٥٠٠ مل", 20, 14, "عبوة", "🧊", "#0EA5A4", "#2563EB", 100],
    ["قهوة عربية ٢٥٠ جم", 95, 72, "علبة", "☕", "#78350F", "#F59E0B", 45],
    // cat4: لحوم ودواجن
    ["دجاج بلدي مجمد ١ كجم", 130, 105, "كجم", "🍗", "#DC2626", "#F97316", 60],
    ["لحم بقري مفروم ٥٠٠ جم", 195, 160, "كجم", "🥩", "#B91C1C", "#EF4444", 40],
    ["ريش ضاني ١ كجم", 420, 350, "كجم", "🍖", "#991B1B", "#DC2626", 20],
    ["سجق بلدي ٥٠٠ جم", 110, 88, "كجم", "🌭", "#B45309", "#DC2626", 35],
    ["موزة ضاني ١ كجم", 380, 310, "كجم", "🍖", "#7F1D1D", "#B91C1C", 15],
    // cat5: ألبان
    ["لبن كامل الدسم ١ لتر", 32, 25, "كرتونة", "🥛", "#2563EB", "#38BDF8", 150],
    ["جبن رومي ٤٠٠ جم", 95, 75, "قطعة", "🧀", "#FBBF24", "#F59E0B", 50],
    ["زبدة ٢٠٠ جم", 68, 55, "علبة", "🧈", "#FDE68A", "#F59E0B", 45],
    ["قشطة طازجة ٢٥٠ جم", 45, 34, "علبة", "🍦", "#F8FAFC", "#93C5FD", 60],
    ["بيض بلدي ٣٠ حبة", 92, 74, "طبق", "🥚", "#FEF3C7", "#F59E0B", 70],
    ["لبن رائب ١ لتر", 28, 22, "كرتونة", "🍶", "#DBEAFE", "#2563EB", 110],
    // extra سوبر ماركت
    ["عسل نحل جبلي ٥٠٠ جم", 260, 210, "برطمان", "🍯", "#F59E0B", "#D97706", 25],
    ["مكسرات مشكلة ٥٠٠ جم", 240, 195, "كيس", "🥜", "#A16207", "#854D0E", 30],
  ];
  const productIds = [];
  PRODUCTS.forEach((p, i) => {
    const cat = i <= 5 ? 0 : i <= 13 ? 1 : i <= 18 ? 2 : i <= 23 ? 3 : i <= 28 ? 4 : 5;
    productIds.push(run(`INSERT INTO products(category_id,name,description,image,price,cost,unit,barcode,stock,min_stock,active,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      catIds[cat], p[0], "", svgImg(p[5], p[5], p[6], p[0].slice(0, 14)), p[1], p[2], p[3],
      "P" + String(i + 1).padStart(4, "0"), 0, 5, 1, now).lastInsertRowid);
  });
  // حدود طلب منخفضة لبعض الأصناف (لحالة المخزون المنخفض في لوحة التحكم)
  [[9, 20], [14, 25], [18, 20], [24, 25], [27, 20]].forEach(([idx, min]) =>
    run("UPDATE products SET min_stock=? WHERE id=?", min, productIds[idx]));

  /* --- 9. Cash accounts (خزائن وبنوك) + chart of accounts --- */
  const treMain = run("INSERT INTO cash_accounts(kind,name,holder,branch_id,account_no,balance,active) VALUES('treasury','الخزينة الرئيسية','الشركة',?,?,?,1)", branchCairo, "-", 35000).lastInsertRowid;
  const treBranch = run("INSERT INTO cash_accounts(kind,name,holder,branch_id,account_no,balance,active) VALUES('treasury','خزينة فرع المعادي','فرع القاهرة – المعادي',?,?,?,1)", branchCairo, "-", 8000).lastInsertRowid;
  const bankNbe = run("INSERT INTO cash_accounts(kind,name,holder,account_no,balance,active) VALUES('bank','البنك الأهلي المصري','طلباتك','EG12 0001 2345 6789 0123',120000,1)").lastInsertRowid;
  const bankCib = run("INSERT INTO cash_accounts(kind,name,holder,account_no,balance,active) VALUES('bank','بنك التجاري الدولي CIB','طلباتك','EG45 0009 8765 4321 0987',45000,1)").lastInsertRowid;

  const ACCOUNTS = [
    ["1000", "الأصول", "asset", null, "normal"],
    ["1010", "الخزينة", "asset", 1, "cash"],
    ["1020", "البنوك", "asset", 1, "bank"],
    ["1100", "العملاء (مدينة)", "asset", 1, "customer"],
    ["1200", "المخزون", "asset", 1, "inventory"],
    ["2000", "الخصوم", "liability", null, "normal"],
    ["2010", "الموردون (دائنون)", "liability", 6, "supplier"],
    ["2100", "ضريبة القيمة المضافة", "liability", 6, "normal"],
    ["3000", "حقوق الملكية", "equity", null, "normal"],
    ["4000", "إيرادات المبيعات", "revenue", null, "normal"],
    ["4100", "إيرادات التوصيل", "revenue", null, "normal"],
    ["5000", "تكلفة البضاعة المباعة", "expense", null, "normal"],
    ["5100", "مصروفات تشغيلية", "expense", null, "normal"],
    ["5200", "رواتب وأجور", "expense", null, "normal"],
    ["5300", "مصروف إيجار", "expense", null, "normal"],
  ];
  const accMap = {};
  ACCOUNTS.forEach(a => {
    accMap[a[0]] = run("INSERT INTO accounts(code,name,type,parent_id,kind,is_system,balance) VALUES(?,?,?,?,?,?,0)",
      a[0], a[1], a[2], a[3], a[4], 1).lastInsertRowid;
  });
  // opening balances (رصيد افتتاحي متوازن)
  const OPENING = { cash: 43000, bank: 165000, inventory: 0 };
  let invOpening = 0;
  PRODUCTS.forEach((p, i) => { invOpening += p[7] * p[4]; }); // stock * price (قيمة المخزون)
  invOpening = money(invOpening * 0.8);
  const equity = money(OPENING.cash + OPENING.bank + invOpening - 0);
  postJournal({
    date: dayAgo(30), ref_type: "opening", memo: "قيد الرصيد الافتتاحي",
    lines: [
      { account_id: accMap["1010"], debit: OPENING.cash },
      { account_id: accMap["1020"], debit: OPENING.bank },
      { account_id: accMap["1200"], debit: invOpening },
      { account_id: accMap["3000"], credit: equity },
    ]
  });
  run("UPDATE cash_accounts SET balance=35000 WHERE id=?", treMain);
  run("UPDATE cash_accounts SET balance=8000 WHERE id=?", treBranch);

  /* --- opening inventory moves (رصيد افتتاحي لكل صنف) --- */
  const openingExtra = {}; // product_id -> extra qty (from seeded sales/purchases)
  const addOpening = (pid, q) => { openingExtra[pid] = (openingExtra[pid] || 0) + q; };

  /* --- 10. Customers --- */
  const CUSTOMERS = [
    ["محمود الشامي", "01012345678", "٤ شارع ٩، المعادي، القاهرة", 5],
    ["فاطمة عبد الرحمن", "01098765432", "١٢ شارع النيل، الهرم، الجيزة", 5],
    ["أحمد مصطفى", "01122334455", "٧ شارع فؤاد، سموحة، الإسكندرية", 4],
    ["نورهان سعيد", "01233445566", "٣ شارع حجازي، المعادي", 5],
    ["كريم الديب", "01555667788", "٩ شارع الملك، الهرم", 4],
    ["سارة منصور", "01066778899", "٢٢ شارع ٢٧، المعادي", 5],
    ["مصطفى كامل", "01177889900", "٥ شارع النزهة، مصر الجديدة", 4],
    ["هبة الله حسن", "01288990011", "١١ شارع الترعة، الهرم", 5],
    ["عمر جمال", "01033445566", "٦ شارع ٩، المعادي", 3],
    ["دينا صلاح", "01599001122", "١٤ شارع سموحة، الإسكندرية", 5],
  ];
  const custIds = [];
  CUSTOMERS.forEach(c => {
    custIds.push(run("INSERT INTO customers(name,phone,address,points,total_spent,orders_count,rating,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      c[0], c[1], c[2], 0, 0, 0, c[3], "", now).lastInsertRowid);
  });

  /* --- 11. Promotions / rewards / ads --- */
  const promoEid = run("INSERT INTO promotions(name,kind,value,code,start_at,end_at,min_order,active,used_count) VALUES('خصم العيد المبارك','percent',15,'EID15',?,?,0,1,0)", dayAgo(10), dayAgo(-20)).lastInsertRowid;
  run("INSERT INTO promotions(name,kind,value,code,start_at,end_at,min_order,active,used_count) VALUES('خصم ٢٠ ج.م على الطلبات فوق ٢٠٠','fixed',20,'SAVE20',?,?,200,1,0)", dayAgo(30), dayAgo(-30));
  run("INSERT INTO rewards(customer_id,kind,value,note,active,created_at) VALUES(?, 'discount', ?, 'خصم ١٠٪ لأكثر عميل تفاعلاً', 1, ?)", custIds[0], 10, now);
  run("INSERT INTO rewards(customer_id,kind,value,note,active,created_at) VALUES(?, 'gift', ?, 'كيلو موز هدية لمناسبة الطلب ٥٠', 1, ?)", custIds[3], 1, now);
  run("INSERT INTO rewards(customer_id,kind,value,note,active,created_at) VALUES(?, 'discount', ?, 'خصم ٢٥ ج.م لعميل دائمة', 1, ?)", custIds[5], 25, now);
  run("INSERT INTO ads(title,image,link,position,start_at,end_at,active,clicks) VALUES(?,?,?,?,?,?,?,?)",
    "افتتاح فرع سموحة الجديد 🎉", svgImg("🎉", "#0EA5A4", "#2563EB", "خصم ٢٠٪"), "#/cat/" + catIds[1], "home", dayAgo(5), dayAgo(-15), 1, 0);
  run("INSERT INTO ads(title,image,link,position,start_at,end_at,active,clicks) VALUES(?,?,?,?,?,?,?,?)",
    "خصومات العيد على كل الأقسام", svgImg("🎁", "#FF6B35", "#DC2626", "EID15"), "#/promo", "home", dayAgo(3), dayAgo(-10), 1, 0);
  run("INSERT INTO ads(title,image,link,position,start_at,end_at,active,clicks) VALUES(?,?,?,?,?,?,?,?)",
    "توصيل مجاني فوق ٣٠٠ ج.م", svgImg("🚚", "#F59E0B", "#EF4444", "توصيل مجاني"), "#/promo", "strip", dayAgo(1), dayAgo(-7), 1, 0);

  /* --- 12. Seeded orders (last 14 days) --- */
  const ORDER_PLAN = [
    // [daysAgo, customerIdx, pilotIdx, pm, status, items:[prodIdx,qty], promo, rating]
    [13, 0, 0, pmCash, "delivered", [[6, 2], [7, 1], [14, 3]], null, 5],
    [12, 1, 1, pmCard, "delivered", [[0, 1], [2, 1], [3, 2]], null, 4],
    [11, 2, 2, pmCash, "delivered", [[10, 2], [11, 1], [12, 2]], null, 5],
    [10, 3, 3, pmWallet, "delivered", [[19, 4], [20, 2], [24, 1]], null, 5],
    [9, 4, 0, pmCash, "cancelled", [[0, 1], [4, 1]], null, null],
    [8, 5, 1, pmCard, "delivered", [[29, 2], [30, 1], [31, 1], [34, 2]], null, 5],
    [7, 6, 2, pmCash, "delivered", [[3, 3], [4, 2], [5, 1]], promoEid, 4],
    [6, 7, 3, pmCash, "delivered", [[8, 3], [9, 2], [6, 4]], null, 5],
    [5, 8, 0, pmCard, "delivered", [[15, 5], [16, 1], [17, 2]], null, 4],
    [4, 9, 1, pmWallet, "delivered", [[25, 1], [26, 1], [27, 1]], null, 5],
    [3, 0, 2, pmCash, "delivered", [[1, 2], [2, 1], [33, 1]], promoEid, 5],
    [2, 3, 3, pmCash, "delivering", [[20, 3], [22, 2]], null, null],
    [1, 5, 0, pmCard, "preparing", [[11, 2], [12, 3], [13, 1]], null, null],
    [0, 1, null, pmCash, "new", [[21, 1], [30, 2], [35, 2]], null, null],
  ];
  const company = one("SELECT * FROM company WHERE id=1");
  let orderNo = 1000;
  ORDER_PLAN.forEach((op, idx) => {
    const [dAgo, cIdx, pIdx, pm, status, items, promoId, rating] = op;
    const created = daysAgo(dAgo);
    const createdDate = created.slice(0, 10);
    let subtotal = 0;
    const lines = items.map(([pi, qty]) => {
      const pr = PRODUCTS[pi];
      const price = pr[1];
      subtotal += price * qty;
      return { product_id: productIds[pi], name: pr[0], price, qty, total: price * qty, cost: pr[3 + 1] };
    });
    subtotal = money(subtotal);
    let discount = 0;
    if (promoId) discount = money(subtotal * 0.15);
    const delivery = idx % 5 === 0 ? 0 : company.delivery_fee;
    const total = money(subtotal - discount + delivery);
    const oid = run(`INSERT INTO orders(code,customer_id,branch_id,pilot_id,payment_method_id,promo_id,promo_code,status,subtotal,discount,delivery_fee,tax,total,paid,note,address,phone,created_at,updated_at,delivered_at,rating,rating_comment)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      "T" + (++orderNo), custIds[cIdx], idx % 2 ? branchCairo : branchGiza, pIdx === null ? null : pilotIds[pIdx], pm,
      promoId, promoId ? "EID15" : "", status, subtotal, discount, delivery, 0, total,
      status === "delivered" ? "paid" : "unpaid", "", one("SELECT address,phone FROM customers WHERE id=?", custIds[cIdx]).address,
      one("SELECT phone FROM customers WHERE id=?", custIds[cIdx]).phone,
      created, created, status === "delivered" ? created : null, rating, rating ? "خدمة ممتازة وسرعة في التوصيل" : null).lastInsertRowid;
    for (const l of lines) {
      run("INSERT INTO order_items(order_id,product_id,name,price,qty,total) VALUES(?,?,?,?,?,?)", oid, l.product_id, l.name, l.price, l.qty, l.total);
      if (status === "delivered" || status === "preparing" || status === "delivering") addMove({ product_id: l.product_id, branch_id: branchCairo, type: "sale", qty: -l.qty, ref: "طلب #" + (orderNo), date: createdDate, note: "" });
      else addOpening(l.product_id, l.qty);
    }
    if (status === "delivered") {
      run("UPDATE promotions SET used_count = used_count + 1 WHERE id=?", promoId || 0);
      const cogs = money(lines.reduce((s, l) => s + l.cost * l.qty, 0));
      const cashAcc = pm === pmCard ? accMap["1020"] : accMap["1010"];
      const cashBox = pm === pmCard ? bankCib : treMain;
      postJournal({
        date: createdDate, ref_type: "order", ref_id: oid, memo: "مبيعات طلب #" + orderNo, lines: [
          { account_id: cashAcc, debit: total },
          { account_id: accMap["4000"], credit: subtotal - discount },
          { account_id: accMap["4100"], credit: delivery },
          { account_id: accMap["5000"], debit: cogs },
          { account_id: accMap["1200"], credit: cogs },
        ]
      });
      if (pm === pmCard || pm === pmWallet) run("UPDATE cash_accounts SET balance = balance + ? WHERE id=?", total, cashBox);
      else run("UPDATE cash_accounts SET balance = balance + ? WHERE id=?", total, treMain);
      if (pm === pmCard) run("UPDATE cash_accounts SET balance = balance + ? WHERE id=?", total, bankCib);
      run("UPDATE customers SET total_spent = total_spent + ?, orders_count = orders_count + 1, points = points + ? WHERE id=?", total, Math.floor(total / 10), custIds[cIdx]);
    } else if (status !== "cancelled") {
      run("UPDATE customers SET orders_count = orders_count + 1 WHERE id=?", custIds[cIdx]);
    }
    const events = ["new"];
    if (["confirmed", "preparing", "delivering", "delivered"].includes(status)) events.push("confirmed");
    if (["preparing", "delivering", "delivered"].includes(status)) events.push("preparing");
    if (["delivering", "delivered"].includes(status)) events.push("delivering");
    if (status === "delivered") events.push("delivered");
    if (status === "cancelled") events.push("cancelled");
    events.forEach(e => run("INSERT INTO order_events(order_id,status,at) VALUES(?,?,?)", oid, e, created));
    if (pIdx !== null) run("UPDATE pilots SET rating = ROUND(?, 1) WHERE id=?", 4.4 + (idx % 6) * 0.1, pilotIds[pIdx]);
  });

  /* --- 13. opening inventory moves (now that sales are known) --- */
  PRODUCTS.forEach((p, i) => {
    const qty = p[7] + (openingExtra[productIds[i]] || 0);
    addMove({ product_id: productIds[i], branch_id: branchCairo, type: "in", qty, ref: "رصيد افتتاحي", date: dayAgo(30) });
  });

  /* --- 14. Purchases (مشتريات — موافق عليها ومسودات) --- */
  const PUR = [
    [supplierIds[0], dayAgo(25), "approved", [[0, 10], [1, 20], [2, 15], [3, 40]], pmCash, 3000],
    [supplierIds[1], dayAgo(18), "approved", [[6, 50], [7, 40], [8, 60], [10, 30]], pmCash, 1000],
    [supplierIds[2], dayAgo(6), "draft", [[29, 60], [30, 20], [31, 15]], null, 0],
  ];
  PUR.forEach(([supId, date, status, items, pm, paid]) => {
    let total = 0;
    const lines = items.map(([pi, qty]) => {
      const cost = PRODUCTS[pi][2];
      total += cost * qty;
      return { product_id: productIds[pi], qty, cost, total: cost * qty };
    });
    total = money(total);
    const pid = run("INSERT INTO purchases(supplier_id,date,status,total,paid,payment_method_id,warehouse,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      supId, date, status, total, paid || 0, pm, "المستودع الرئيسي", "", now).lastInsertRowid;
    lines.forEach(l => run("INSERT INTO purchase_items(purchase_id,product_id,qty,cost,total) VALUES(?,?,?,?,?)", pid, l.product_id, l.qty, l.cost, l.total));
    if (status === "approved") {
      lines.forEach(l => addMove({ product_id: l.product_id, branch_id: branchCairo, type: "purchase", qty: l.qty, ref: "مشتريات #" + pid, date }));
      const unpaid = money(total - (paid || 0));
      if (unpaid > 0) {
        run("UPDATE suppliers SET balance = balance + ? WHERE id=?", unpaid, supId);
        postJournal({ date, ref_type: "purchase", ref_id: pid, memo: "مشتريات من " + one("SELECT name FROM suppliers WHERE id=?", supId).name, lines: [
          { account_id: accMap["1200"], debit: total },
          { account_id: accMap["1010"], credit: paid || 0 },
          { account_id: accMap["2010"], credit: unpaid },
        ]});
      } else {
        postJournal({ date, ref_type: "purchase", ref_id: pid, memo: "مشتريات نقدية", lines: [
          { account_id: accMap["1200"], debit: total },
          { account_id: accMap["1010"], credit: total },
        ]});
        run("UPDATE cash_accounts SET balance = balance - ? WHERE id=?", total, treMain);
      }
    }
  });

  /* --- 15. Vouchers (أذون صرف/قبض) --- */
  const VOUCH = [
    ["payment", "cash", treMain, "other", null, 3500, dayAgo(20), "مصروف إيجار المستودع", "EXP-1"],
    ["payment", "cash", treMain, "other", null, 8500, dayAgo(15), "رواتب موظفين الشهر", "EXP-2"],
    ["payment", "bank", bankNbe, "other", null, 12000, dayAgo(12), "فاتورة كهرباء ومياه", "EXP-3"],
    ["payment", "cash", treMain, "supplier", supplierIds[0], 255, dayAgo(10), "سداد باقي مشتريات شركة النيل", "EXP-7"],
    ["payment", "cash", treBranch, "other", null, 1200, dayAgo(8), "مصروف توصيل ذياد", "EXP-4"],
    ["receipt", "bank", bankCib, "customer", custIds[0], 1500, dayAgo(4), "تحصيل دفعة من العميل", "REC-2"],
    ["payment", "cash", treMain, "other", null, 2200, dayAgo(2), "صيانة وسائل توصيل", "EXP-6"],
  ];
  VOUCH.forEach(([kind, source, caId, pType, pId, amount, date, memo, ref]) => {
    const isRec = kind === "receipt";
    const cashAccCode = caId === bankNbe || caId === bankCib ? "1020" : "1010";
    const otherCode = pType === "supplier" ? "2010" : pType === "customer" ? "1100" : "5100";
    const j = postJournal({ date, ref_type: "voucher", memo, lines: isRec
      ? [{ account_id: accMap[cashAccCode], debit: amount }, { account_id: accMap[otherCode], credit: amount }]
      : [{ account_id: accMap[otherCode], debit: amount }, { account_id: accMap[cashAccCode], credit: amount }] });
    run("INSERT INTO vouchers(kind,source,cash_account_id,party_type,party_id,amount,date,memo,ref,journal_id,created_by,approved,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      kind, source, caId, pType, pId, amount, date, memo, ref, j.id, 1, 1, now);
    run("UPDATE cash_accounts SET balance = balance + ? WHERE id=?", isRec ? amount : -amount, caId);
    if (pType === "supplier") run("UPDATE suppliers SET balance = balance + ? WHERE id=?", isRec ? amount : -amount, pId);
  });

  /* --- 16. Stock count (جرد معتمد بالتسويات) --- */
  const countId = run("INSERT INTO stock_counts(date,branch_id,status,memo,created_by,created_at) VALUES(?,?, 'approved', ?, 1, ?)",
    dayAgo(7), branchCairo, "جرد دوري للمستودع الرئيسي", now).lastInsertRowid;
  [6, 7, 8, 14, 19, 29].forEach((pi, k) => {
    const prod = one("SELECT id,stock,cost FROM products WHERE id=?", productIds[pi]);
    const actual = prod.stock - (k % 2); // slight differences
    const diff = actual - prod.stock;
    run("INSERT INTO stock_count_items(count_id,product_id,unit_cost,system_qty,actual_qty,diff,memo) VALUES(?,?,?,?,?,?,?)",
      countId, prod.id, prod.cost, prod.stock, actual, diff, diff ? "عجز جرد" : "مطابق");
    if (diff !== 0) {
      addMove({ product_id: prod.id, branch_id: branchCairo, type: "count", qty: diff, ref: "جرد #" + countId, date: dayAgo(7) });
      postJournal({ date: dayAgo(7), ref_type: "stock_count", ref_id: countId, memo: "تسوية جرد", lines: [
        { account_id: accMap["5100"], debit: diff < 0 ? Math.abs(diff) * prod.cost : 0 },
        { account_id: accMap["1200"], debit: diff > 0 ? diff * prod.cost : 0, credit: diff < 0 ? Math.abs(diff) * prod.cost : 0 },
      ]});
    }
  });

  /* --- 17. expenses account balances tidy --- */
  postJournal({ date: dayAgo(20), ref_type: "expense", memo: "مصروف رواتب", lines: [{ account_id: accMap["5200"], debit: 15000 }, { account_id: accMap["1010"], credit: 15000 }] });
  run("UPDATE cash_accounts SET balance = balance - 15000 WHERE id=?", treMain);
}

/* ============================================================ INIT */
function splitSql(sql) {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      cur += ch;
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch; cur += ch;
    } else if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      cur += "\n";
    } else if (ch === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function ensureMySqlSchema() {
  try {
    driver.one("SELECT id FROM `company` LIMIT 1");
    return; // القاعدة مهيأة بالفعل
  } catch (e) { /* الجدول غير موجود */ }
  const file = path.join(__dirname, "..", "schema", "001_init.sql");
  if (!fs.existsSync(file)) throw new Error("ملف schema/001_init.sql غير موجود");
  for (const stmt of splitSql(fs.readFileSync(file, "utf8"))) driver.exec(stmt);
  console.log("✓ تم إنشاء جداول MySQL.");
}

/** زرع بيانات seed.json (المصدّرة من نسخة SQLite نظيفة) داخل MySQL */
function importSeed() {
  const file = path.join(__dirname, "..", "seed.json");
  if (!fs.existsSync(file)) throw new Error("ملف seed.json غير موجود — لا يمكن تهيئة قاعدة MySQL");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const tables = Object.keys(data.tables || {});
  driver.exec("START TRANSACTION");
  try {
    for (const t of tables) driver.exec(`DELETE FROM \`${t}\``);
    for (const t of tables) {
      const rows = data.tables[t] || [];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]).map(c => (t === "notifications" && c === "read" ? "is_read" : c));
      const sql = `INSERT INTO \`${t}\` (${cols.map(c => `\`${c}\``).join(",")}) VALUES (${cols.map(() => "?").join(",")})`;
      for (const row of rows) {
        driver.run(sql, ...cols.map(c => {
          const key = (t === "notifications" && c === "is_read" && row.is_read === undefined) ? "read" : c;
          return row[key] === undefined ? null : row[key];
        }));
      }
    }
    driver.exec("COMMIT");
  } catch (e) {
    try { driver.exec("ROLLBACK"); } catch (e2) { /* تجاهل */ }
    throw e;
  }
  /* مجلد النسخ الاحتياطي الصحيح لهذا الجهاز/الاستضافة */
  try { driver.exec("DELETE FROM `backup_dirs`"); } catch (e) { /* تجاهل */ }
  run("INSERT INTO backup_dirs(path,note,is_default,created_at) VALUES(?,?,1,?)",
    path.join(DATA_DIR, "backups"), "المجلد الافتراضي داخل مجلد بيانات المشروع", nowISO());
  console.log("✓ تم زرع بيانات طلباتك في MySQL.");
}

if (DB_KIND === "mysql") ensureMySqlSchema();
else createSchema();

/* ---- ترحيل آمن للأعمدة الجديدة على قواعد بيانات قائمة (لا يُرمي أبدًا) ---- */
function addColumnIfMissing(table, col, decl) {
  try {
    let has;
    if (DB_KIND === "mysql") {
      has = !!one("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?", table, col);
    } else {
      has = all(`PRAGMA table_info(${table})`).some(c => c.name === col);
    }
    if (has) return;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
    console.log(`✓ ترحيل: تم إضافة العمود ${table}.${col}`);
  } catch (e) { /* تجاهل — العمود موجود أو الجدول غير مدعوم */ }
}
addColumnIfMissing("orders", "zone_id", "INTEGER");
addColumnIfMissing("customers", "zone_id", "INTEGER");
addColumnIfMissing("products", "unit_id", "INTEGER");
/* ---- حقول منظومة الدفع: بيانات الاستلام + حالة إثبات الدفع على الطلب ---- */
addColumnIfMissing("payment_methods", "pay_number", "TEXT");        // رقم المحفظة / الحساب البنكي
addColumnIfMissing("payment_methods", "pay_holder", "TEXT");        // اسم صاحب الحساب
addColumnIfMissing("payment_methods", "pay_bank", "TEXT");          // اسم البنك / مزوّد المحفظة
addColumnIfMissing("payment_methods", "pay_link", "TEXT");          // لينك دفع اختياري
addColumnIfMissing("payment_methods", "pay_instructions", "TEXT");  // تعليمات تُعرض للعميل
addColumnIfMissing("payment_methods", "requires_proof", "INTEGER DEFAULT 1"); // يحتاج إثبات تحويل؟
addColumnIfMissing("orders", "proof_status", "TEXT");               // none | pending | approved | rejected
addColumnIfMissing("orders", "proof_id", "INTEGER");

/* ---- توحيد اسم عمود الإشعارات (read محجوز في MySQL) ---- */
if (DB_KIND === "sqlite") {
  try {
    const cols = all("PRAGMA table_info(notifications)");
    if (cols.some(c => c.name === "read") && !cols.some(c => c.name === "is_read")) {
      db.exec("ALTER TABLE notifications RENAME COLUMN read TO is_read");
      console.log("✓ ترحيل: notifications.read → is_read");
    }
  } catch (e) { /* تجاهل */ }
}

/* ---- وحدات القياس ومناطق التوصيل: تُزرع في القاعدة الجديدة والقائمة معاً ---- */
const UNIT_SEED = [
  ["قطعة", "قطعة"], ["كيلو", "كجم"], ["جرام", "جم"], ["لتر", "لتر"],
  ["علبة", "علبة"], ["كرتون", "كرتون"], ["باكو", "باكو"],
];
if (!one("SELECT id FROM units LIMIT 1")) {
  UNIT_SEED.forEach(([n, s], i) => run("INSERT INTO units(name,symbol,sort_order,active,created_at) VALUES(?,?,?,1,?)", n, s, i, nowISO()));
  console.log("✓ تمت إضافة وحدات القياس الأساسية.");
}
const ZONE_SEED = [
  ["المعادي", 25, "٣٠–٤٥ دقيقة"], ["الدقي والمهندسين", 30, "٣٠–٤٥ دقيقة"],
  ["مدينة نصر", 35, "٤٥–٦٠ دقيقة"], ["مصر الجديدة", 32, "٤٥–٦٠ دقيقة"],
  ["شبرا الخيمة", 28, "٣٥–٥٠ دقيقة"], ["حلوان", 45, "٦٠–٧٥ دقيقة"],
  ["الهرم", 40, "٥٠–٧٠ دقيقة"], ["السادس من أكتوبر", 55, "٧٠–٩٠ دقيقة"],
];
if (!one("SELECT id FROM zones LIMIT 1")) {
  ZONE_SEED.forEach(([n, f, eta], i) => run("INSERT INTO zones(name,fee,eta,sort_order,active,created_at) VALUES(?,?,?,?,1,?)", n, f, eta, i, nowISO()));
  console.log("✓ تمت إضافة مناطق التوصيل الأساسية.");
}
/* ربط الأصناف بوحداتها تلقائيًا من الاسم النصي القديم (ترحيل البيانات) */
try {
  run("UPDATE products SET unit_id=(SELECT u.id FROM units u WHERE u.name=products.unit) WHERE unit_id IS NULL AND EXISTS(SELECT 1 FROM units u WHERE u.name=products.unit)");
} catch (e) { /* تجاهل */ }
/* ربط العملاء بمناطقهم من نص العنوان (مطابقة أول ذكر لاسم المنطقة) */
try {
  const zones = all("SELECT id,name FROM zones");
  const pending = all("SELECT id,address FROM customers WHERE zone_id IS NULL AND address IS NOT NULL AND address<>''");
  for (const c of pending) {
    const z = zones.find(z => String(c.address).includes(String(z.name)));
    if (z) run("UPDATE customers SET zone_id=? WHERE id=?", z.id, c.id);
  }
} catch (e) { /* تجاهل */ }
/* مجلد النسخ الاحتياطي الافتراضي */
try {
  const expectedBackupDir = path.join(DATA_DIR, "backups");
  const def = one("SELECT * FROM backup_dirs WHERE is_default=1 ORDER BY id LIMIT 1");
  if (!def) {
    run("INSERT INTO backup_dirs(path,note,is_default,created_at) VALUES(?,?,1,?)",
      expectedBackupDir, "المجلد الافتراضي داخل مجلد بيانات المشروع", nowISO());
  } else if (String(def.note || "").includes("الافتراضي") && path.resolve(def.path) !== path.resolve(expectedBackupDir)) {
    /* قاعدة بيانات منقولة من مجلد آخر: نُعيد الوجهة الافتراضية إلى مجلد بيانات المشروع الحالي */
    run("UPDATE backup_dirs SET path=? WHERE id=?", expectedBackupDir, def.id);
  }
} catch (e) { /* تجاهل */ }
const hasCompany = one("SELECT id FROM company WHERE id=1");
if (!hasCompany) {
  console.log("▸ جاري إنشاء قاعدة البيانات وزرع البيانات الافتراضية...");
  if (DB_KIND === "mysql") importSeed();
  else seed();
  console.log("✓ تم تجهيز قاعدة البيانات بنجاح.");
}
ensureDefaultAdmin();

/* ---- بيانات استلام المبلغ لوسائل الدفع (تُطبَّق على القواعد الجديدة والقائمة) ---- */
try {
  /* 1) استكمال بيانات الاستلام لأي طريقة موجودة بلا بيانات */
  const PM_SETUP = [
    ["cash", 0, "", "", "", "", "لا تحتاج تحويل — ادفع نقدًا للمندوب عند استلام الطلب."],
    ["wallet", 1, "01001234567", "طلباتك", "فودافون كاش", "", "حوّل المبلغ إلى رقم المحفظة أعلاه، ثم ارفع صورة إشعار التحويل."],
    ["online", 1, "1234 5678 9012 3456", "طلباتك", "البنك الأهلي المصري", "", "حوّل على رقم الحساب أعلاه، واستخدم رقم الطلب كمرجع للتحويل."],
    ["card", 1, "", "", "", "https://pay.example.com/talabatak", "ادفع بأمان عبر بوابة الدفع، ثم ارفع صورة إشعار العملية."],
  ];
  for (const [kind, req, num, holder, bank, link, ins] of PM_SETUP) {
    for (const p of all("SELECT * FROM payment_methods WHERE kind=?", kind)) {
      run(`UPDATE payment_methods SET requires_proof=?,
             pay_number=COALESCE(NULLIF(pay_number,''),?), pay_holder=COALESCE(NULLIF(pay_holder,''),?),
             pay_bank=COALESCE(NULLIF(pay_bank,''),?), pay_link=COALESCE(NULLIF(pay_link,''),?),
             pay_instructions=COALESCE(NULLIF(pay_instructions,''),?) WHERE id=?`,
        req, num, holder, bank, link, ins, p.id);
    }
  }
  /* 2) ضمان وجود طريقة كاش مفعّلة (المسار الافتراضي للطلبات) */
  if (!one("SELECT id FROM payment_methods WHERE kind='cash' AND active=1 LIMIT 1")) {
    const cash = one("SELECT id FROM payment_methods WHERE kind='cash' LIMIT 1");
    if (cash) run("UPDATE payment_methods SET active=1, requires_proof=0 WHERE id=?", cash.id);
    else run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_instructions) VALUES('كاش عند الاستلام','cash',1,1,0,'ادفع نقدًا للمندوب عند الاستلام.')`);
  }
  /* 3) ضمان توفّر طريقتين إلكترونيتين على الأقل (محفظة + تحويل/بنكي) */
  if (!one("SELECT id FROM payment_methods WHERE kind IN ('wallet','online','card') AND active=1 LIMIT 1")) {
    const n = one("SELECT COUNT(*) c FROM payment_methods").c;
    run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_number,pay_holder,pay_bank,pay_instructions) VALUES(?,?,?,?,?,?,?,?,?)`,
      "فودافون كاش", "wallet", 1, n + 1, 1, "01001234567", "طلباتك", "فودافون كاش",
      "حوّل المبلغ إلى رقم المحفظة أعلاه، ثم ارفع صورة إشعار التحويل.");
    run(`INSERT INTO payment_methods(name,kind,active,sort_order,requires_proof,pay_number,pay_holder,pay_bank,pay_instructions) VALUES(?,?,?,?,?,?,?,?,?)`,
      "إنستاباي", "wallet", 1, n + 2, 1, "01001234567", "طلباتك", "إنستاباي (InstaPay)",
      "حوّل على حساب إنستاباي أعلاه ثم ارفع صورة الإشعار مع رقم العملية.");
  }
  /* 4) الكاش لا يحتاج إثبات أبدًا */
  run("UPDATE payment_methods SET requires_proof=0 WHERE kind='cash'");
} catch (e) { /* تجاهل */ }

/* ---- مزامنة الحقول المجمّعة للعملاء مع الطلبات الفعلية ----   يضمن أن شارة التميّز في شاشة العملاء مطابقة تمامًا لشاشة العملاء المميزين (VIP) */
try {
  run(`UPDATE customers SET
    orders_count = (SELECT COUNT(*) FROM orders o WHERE o.customer_id=customers.id AND o.status<>'cancelled'),
    total_spent  = (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.customer_id=customers.id AND o.status<>'cancelled')`);
} catch (e) { /* تجاهل */ }

/** تسجيل عملية في سجل النشاط (Audit Log) — لا يرمي أبدًا حتى لا يعطّل العملية الأساسية */
function audit(user, action, entity, entityId, detail) {
  try {
    const u = user || {};
    run(
      "INSERT INTO audit_log(user_id,user_name,action,entity,entity_id,detail,at) VALUES(?,?,?,?,?,?,?)",
      u.id || null, u.name || u.email || "—", action || "?", entity || "?",
      entityId == null ? null : entityId, detail ? String(detail).slice(0, 500) : "", nowISO()
    );
  } catch (e) { /* تجاهل — سجل النشاط لا يوقف النظام */ }
}

/** توليد كود تصاعدي فريد لا يتكرر أبدًا (حتى بعد الحذف) عبر جدول عدّادات دائم */
function nextCode(prefix, table, start = 1000) {
  const key = prefix + ":" + table;
  const cur = one("SELECT value FROM counters WHERE name=?", key);
  const castType = DB_KIND === "mysql" ? "SIGNED" : "INTEGER";
  const mx = one(`SELECT MAX(CAST(SUBSTR(code,2) AS ${castType})) mx FROM ${table} WHERE code LIKE ?`, prefix + "%").mx;
  const next = Math.max(Number(cur ? cur.value : start) || start, Number(mx) || start, start) + 1;
  if (DB_KIND === "mysql") {
    run("INSERT INTO counters(name,value) VALUES(?,?) ON DUPLICATE KEY UPDATE value=?", key, next, next);
  } else {
    run("INSERT INTO counters(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value", key, next);
  }
  return prefix + next;
}

module.exports = { db, DATA_DIR, DB_PATH, DB_KIND, all, one, run, nowISO, today, money, hash, addMove, postJournal, accByCode, accId, svgImg, logoSvg, audit, nextCode };
