-- ============================================================
--  Auto Car | معرض سيارات متكامل
--  مخطط قاعدة البيانات — SQLite
--  يغطي: المخزون (السيارات)، العملاء والموردين، المبيعات والمشتريات،
--  التقسيط، البيع بالعمولة، وERP محاسبي شامل + العملات + التنبيهات.
-- ============================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

/* ===================== النظام والإعدادات ===================== */
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS currencies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT    NOT NULL UNIQUE,      -- EGP, USD ...
  name       TEXT    NOT NULL,             -- الاسم بالعربية
  name_en    TEXT,
  symbol     TEXT,
  rate       REAL    NOT NULL DEFAULT 1,   -- سعر الصرف مقابل العملة الأساسية
  is_base    INTEGER NOT NULL DEFAULT 0,
  decimals   INTEGER NOT NULL DEFAULT 2,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  currency_id INTEGER NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
  rate        REAL    NOT NULL,
  date        TEXT    NOT NULL,
  note        TEXT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rates_currency ON exchange_rates(currency_id, date);

/* ===================== المستخدمون والصلاحيات ===================== */
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'sales',
  permissions   TEXT    NOT NULL DEFAULT '[]',
  phone         TEXT,
  email         TEXT,
  avatar        TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT,
  deleted_at    TEXT,
  last_login    TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- سجل النشاط: من أنشأ/عدّل/حذف/استرجع كل شيء
CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name  TEXT,
  action     TEXT NOT NULL,     -- create | update | delete | restore | purge | login | logout | backup | restore_db | truncate | import | export
  entity     TEXT,
  entity_id  INTEGER,
  details    TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_date   ON activity(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity(entity, entity_id);

CREATE TABLE IF NOT EXISTS backups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  filename   TEXT NOT NULL,
  path       TEXT NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  kind       TEXT NOT NULL DEFAULT 'manual',  -- manual | auto | pre_restore
  note       TEXT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

/* ===================== البيانات المرجعية للسيارات ===================== */
CREATE TABLE IF NOT EXISTS brands (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  name_en    TEXT,
  logo       TEXT,
  country    TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS car_types (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,        -- سيدان، SUV، هاتشباك...
  name_en    TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS car_models (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id   INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  name_en    TEXT,
  type_id    INTEGER REFERENCES car_types(id) ON DELETE SET NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_models_brand ON car_models(brand_id);

CREATE TABLE IF NOT EXISTS colors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  name_en    TEXT,
  hex        TEXT DEFAULT '#888888',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

/* ===================== العملاء والموردون ===================== */
CREATE TABLE IF NOT EXISTS customers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  name_en         TEXT,
  phone           TEXT,
  phone2          TEXT,
  email           TEXT,
  address         TEXT,
  national_id     TEXT,
  job             TEXT,
  kind            TEXT NOT NULL DEFAULT 'individual',  -- individual | company
  opening_balance REAL NOT NULL DEFAULT 0,
  balance         REAL NOT NULL DEFAULT 0,             -- مديونية العميل (له علينا سالب)
  credit_limit    REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT,
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS suppliers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  name_en         TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  national_id     TEXT,
  kind            TEXT NOT NULL DEFAULT 'individual',  -- individual | company | dealer
  opening_balance REAL NOT NULL DEFAULT 0,
  balance         REAL NOT NULL DEFAULT 0,             -- مستحقات المورد
  notes           TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT,
  deleted_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

/* ===================== السيارات (المخزون المتكامل) ===================== */
CREATE TABLE IF NOT EXISTS vehicles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,       -- كود داخلي
  vin              TEXT,                        -- رقم الهيكل
  chassis_no       TEXT,
  engine_no        TEXT,
  plate_no         TEXT,
  brand_id         INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  model_id         INTEGER REFERENCES car_models(id) ON DELETE SET NULL,
  type_id          INTEGER REFERENCES car_types(id) ON DELETE SET NULL,
  color_id         INTEGER REFERENCES colors(id) ON DELETE SET NULL,
  year             INTEGER,
  condition        TEXT NOT NULL DEFAULT 'used',   -- new | used
  mileage          INTEGER NOT NULL DEFAULT 0,
  transmission     TEXT,                        -- automatic | manual
  fuel             TEXT,                        -- petrol | diesel | hybrid | electric
  doors            INTEGER,
  seats            INTEGER,
  cylinders        INTEGER,
  horsepower       INTEGER,
  origin           TEXT,                        -- بلد المنشأ
  ownership        TEXT NOT NULL DEFAULT 'own', -- own | consignment (بالعمولة)
  -- بيانات العمولة (عند البيع بالعمولة)
  owner_name       TEXT,
  owner_phone      TEXT,
  owner_id         INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  commission_type  TEXT,                        -- percent | fixed
  commission_value REAL NOT NULL DEFAULT 0,
  min_price        REAL NOT NULL DEFAULT 0,     -- أقل سعر بيع مقبول
  -- التسعير
  cost_price       REAL NOT NULL DEFAULT 0,     -- تكلفة الشراء
  extra_cost       REAL NOT NULL DEFAULT 0,     -- مصاريف تجهيز
  target_price     REAL NOT NULL DEFAULT 0,     -- سعر البيع المستهدف
  sale_price       REAL NOT NULL DEFAULT 0,     -- سعر البيع الفعلي
  currency_id      INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  -- الحالة والتواريخ
  status           TEXT NOT NULL DEFAULT 'available', -- available | reserved | sold | returned
  supplier_id      INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_id      INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
  purchase_date    TEXT,
  entry_date       TEXT,                        -- تاريخ الإدخال للمعرض
  license_expiry   TEXT,
  insurance_expiry TEXT,
  location         TEXT,
  images           TEXT NOT NULL DEFAULT '[]',  -- مصفوفة JSON لمسارات الصور
  notes            TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT,
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_brand  ON vehicles(brand_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_model  ON vehicles(model_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_vin    ON vehicles(vin);

CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,               -- تجهيز، سمكرة، دهان، ترخيص، نقل، أخرى
  description TEXT,
  amount      REAL NOT NULL DEFAULT 0,
  date        TEXT,
  treasury_id INTEGER REFERENCES treasuries(id) ON DELETE SET NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_veh_exp_vehicle ON vehicle_expenses(vehicle_id);

/* ===================== المشتريات ===================== */
CREATE TABLE IF NOT EXISTS purchases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT NOT NULL UNIQUE,
  supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  date           TEXT NOT NULL,
  subtotal       REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  tax            REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  paid           REAL NOT NULL DEFAULT 0,
  remaining      REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',   -- cash | card | transfer | credit | installment | mixed
  treasury_id    INTEGER REFERENCES treasuries(id) ON DELETE SET NULL,
  currency_id    INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate  REAL NOT NULL DEFAULT 1,
  note           TEXT,
  status         TEXT NOT NULL DEFAULT 'completed',
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  deleted_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);

CREATE TABLE IF NOT EXISTS purchase_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  vehicle_id  INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  description TEXT,
  price       REAL NOT NULL DEFAULT 0,
  total       REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

/* ===================== المبيعات ===================== */
CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT NOT NULL UNIQUE,
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  date           TEXT NOT NULL,
  sale_type      TEXT NOT NULL DEFAULT 'cash',   -- cash | installment | commission
  subtotal       REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  tax            REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  paid           REAL NOT NULL DEFAULT 0,
  remaining      REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  treasury_id    INTEGER REFERENCES treasuries(id) ON DELETE SET NULL,
  currency_id    INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate  REAL NOT NULL DEFAULT 1,
  cost_total     REAL NOT NULL DEFAULT 0,
  profit         REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,     -- عمولة المعرض في البيع بالعمولة
  note           TEXT,
  status         TEXT NOT NULL DEFAULT 'completed',  -- completed | reserved | returned
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  deleted_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_type     ON sales(sale_type);

CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  vehicle_id  INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  description TEXT,
  price       REAL NOT NULL DEFAULT 0,
  cost        REAL NOT NULL DEFAULT 0,
  total       REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

/* ===================== التقسيط ===================== */
CREATE TABLE IF NOT EXISTS installment_plans (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id           INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  customer_id       INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  total_amount      REAL NOT NULL DEFAULT 0,
  down_payment      REAL NOT NULL DEFAULT 0,
  financed_amount   REAL NOT NULL DEFAULT 0,
  installments_count INTEGER NOT NULL DEFAULT 1,
  installment_amount REAL NOT NULL DEFAULT 0,
  start_date        TEXT NOT NULL,
  frequency         TEXT NOT NULL DEFAULT 'monthly', -- monthly | weekly | quarterly
  interest_rate     REAL NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active',  -- active | closed | defaulted
  notes             TEXT,
  created_at        TEXT NOT NULL,
  deleted_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_plans_customer ON installment_plans(customer_id);

CREATE TABLE IF NOT EXISTS installments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id       INTEGER NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
  sale_id       INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  customer_id   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  seq           INTEGER NOT NULL,
  due_date      TEXT NOT NULL,
  amount        REAL NOT NULL DEFAULT 0,
  paid_amount   REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | partial | paid | overdue
  paid_date     TEXT,
  note          TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_installments_plan ON installments(plan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due  ON installments(due_date, status);

CREATE TABLE IF NOT EXISTS installment_payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  installment_id INTEGER REFERENCES installments(id) ON DELETE SET NULL,
  plan_id        INTEGER REFERENCES installment_plans(id) ON DELETE CASCADE,
  sale_id        INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  amount         REAL NOT NULL DEFAULT 0,
  date           TEXT NOT NULL,
  method         TEXT NOT NULL DEFAULT 'cash',
  treasury_id    INTEGER REFERENCES treasuries(id) ON DELETE SET NULL,
  note           TEXT,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inst_pay_plan ON installment_payments(plan_id);

/* ===================== تسوية العمولة (بيع بالعمولة) ===================== */
CREATE TABLE IF NOT EXISTS consignment_settlements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id       INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  sale_id          INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  owner_name       TEXT,
  sale_amount      REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,
  owner_amount     REAL NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | settled
  settled_date     TEXT,
  treasury_id      INTEGER REFERENCES treasuries(id) ON DELETE SET NULL,
  note             TEXT,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL,
  deleted_at       TEXT
);

/* ===================== المحاسبة (ERP) ===================== */
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  name_en     TEXT,
  type        TEXT NOT NULL,        -- asset | liability | equity | revenue | expense
  parent_id   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_group    INTEGER NOT NULL DEFAULT 0,
  nature      TEXT NOT NULL DEFAULT 'debit',  -- debit | credit
  currency_id INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  is_cash     INTEGER NOT NULL DEFAULT 0,
  is_bank     INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type   ON accounts(type);

CREATE TABLE IF NOT EXISTS fiscal_years (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',  -- open | closed
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_no       TEXT NOT NULL,
  date           TEXT NOT NULL,
  description    TEXT,
  reference      TEXT,
  source         TEXT NOT NULL DEFAULT 'manual', -- manual | opening | sale | purchase | receipt | payment | installment | expense | commission | adjustment | closing
  source_id      INTEGER,
  fiscal_year_id INTEGER REFERENCES fiscal_years(id) ON DELETE SET NULL,
  currency_id    INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate  REAL NOT NULL DEFAULT 1,
  total_debit    REAL NOT NULL DEFAULT 0,
  total_credit   REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'posted', -- draft | posted | void
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  deleted_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_entries_date   ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_source ON journal_entries(source, source_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id      INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  description   TEXT,
  debit         REAL NOT NULL DEFAULT 0,
  credit        REAL NOT NULL DEFAULT 0,
  currency_id   INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate REAL NOT NULL DEFAULT 1,
  party_type    TEXT,           -- customer | supplier | vehicle | treasury
  party_id      INTEGER,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lines_entry   ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_lines_account ON journal_lines(account_id);

CREATE TABLE IF NOT EXISTS treasuries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  name_en         TEXT,
  kind            TEXT NOT NULL DEFAULT 'cash',   -- cash | bank | wallet
  account_id      INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  currency_id     INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  balance         REAL NOT NULL DEFAULT 0,
  bank_name       TEXT,
  account_number  TEXT,
  iban            TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT,
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS vouchers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_no       TEXT NOT NULL,
  kind             TEXT NOT NULL,               -- receipt | payment
  date             TEXT NOT NULL,
  treasury_id      INTEGER REFERENCES treasuries(id) ON DELETE SET NULL,
  account_id       INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  party_type       TEXT,                        -- customer | supplier | other
  party_id         INTEGER,
  amount           REAL NOT NULL DEFAULT 0,
  currency_id      INTEGER REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate    REAL NOT NULL DEFAULT 1,
  method           TEXT NOT NULL DEFAULT 'cash',
  description      TEXT,
  journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT,
  deleted_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);

/* ===================== التنبيهات والتذكيرات ===================== */
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL DEFAULT 'reminder',  -- reminder | alert | system
  title      TEXT NOT NULL,
  body       TEXT,
  ref_type   TEXT,          -- installment | vehicle | customer | supplier | account
  ref_id     INTEGER,
  due_date   TEXT,
  priority   TEXT NOT NULL DEFAULT 'normal',    -- low | normal | high
  status     TEXT NOT NULL DEFAULT 'unread',    -- unread | read | done
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status);

/* ===================== سجل الاستيراد ===================== */
CREATE TABLE IF NOT EXISTS import_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT NOT NULL,
  filename   TEXT,
  total      INTEGER NOT NULL DEFAULT 0,
  success    INTEGER NOT NULL DEFAULT 0,
  failed     INTEGER NOT NULL DEFAULT 0,
  errors     TEXT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
