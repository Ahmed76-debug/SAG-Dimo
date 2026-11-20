-- ============================================================
--  سوق البركة | Baraka Market ERP
--  مخطط قاعدة البيانات — SQLite
-- ============================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS branches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  code       TEXT    NOT NULL UNIQUE,
  phone      TEXT,
  address    TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(active);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'cashier',
  permissions   TEXT    NOT NULL DEFAULT '[]',
  phone         TEXT,
  branch_id     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL,
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

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT    NOT NULL,
  kind   TEXT    NOT NULL DEFAULT 'grocery',
  color  TEXT    NOT NULL DEFAULT '#10b981',
  icon   TEXT,
  sort   INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  sku             TEXT,
  barcode         TEXT,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit            TEXT    NOT NULL DEFAULT 'قطعة',
  cost            REAL    NOT NULL DEFAULT 0,
  price           REAL    NOT NULL DEFAULT 0,
  wholesale_price REAL    NOT NULL DEFAULT 0,
  stock           REAL    NOT NULL DEFAULT 0,
  min_stock       REAL    NOT NULL DEFAULT 0,
  expiry_date     TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_cat   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name  ON products(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode) WHERE barcode IS NOT NULL AND barcode <> '';

-- أرصدة المنتجات لكل فرع (products.stock يظل الإجمالي لكل الفروع)
CREATE TABLE IF NOT EXISTS product_stock (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id  INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  stock      REAL    NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_product_stock_branch ON product_stock(branch_id);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  phone      TEXT,
  address    TEXT,
  balance    REAL    NOT NULL DEFAULT 0,  -- مديونية على العميل
  notes      TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  phone      TEXT,
  address    TEXT,
  balance    REAL    NOT NULL DEFAULT 0,  -- مستحقات المورد
  notes      TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  branch_id     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  opened_at     TEXT    NOT NULL,
  closed_at     TEXT,
  opening_cash  REAL    NOT NULL DEFAULT 0,
  closing_cash  REAL,
  expected_cash REAL,
  cash_sales    REAL    NOT NULL DEFAULT 0,
  card_sales    REAL    NOT NULL DEFAULT 0,
  wallet_sales  REAL    NOT NULL DEFAULT 0,
  sales_total   REAL    NOT NULL DEFAULT 0,
  expenses      REAL    NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL DEFAULT 'open',
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id, status);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT    NOT NULL UNIQUE,
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  branch_id      INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  shift_id       INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  subtotal       REAL    NOT NULL DEFAULT 0,
  discount       REAL    NOT NULL DEFAULT 0,
  tax            REAL    NOT NULL DEFAULT 0,
  total          REAL    NOT NULL DEFAULT 0,
  paid           REAL    NOT NULL DEFAULT 0,
  change_due     REAL    NOT NULL DEFAULT 0,
  cost_total     REAL    NOT NULL DEFAULT 0,
  profit         REAL    NOT NULL DEFAULT 0,
  payment_method TEXT    NOT NULL DEFAULT 'cash',
  status         TEXT    NOT NULL DEFAULT 'completed',
  returned_total REAL    NOT NULL DEFAULT 0,
  note           TEXT,
  created_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_shift    ON sales(shift_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  unit        TEXT,
  qty         REAL    NOT NULL,
  unit_price  REAL    NOT NULL,
  unit_cost   REAL    NOT NULL DEFAULT 0,
  discount    REAL    NOT NULL DEFAULT 0,
  total       REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE TABLE IF NOT EXISTS holds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  label      TEXT,
  payload    TEXT    NOT NULL,
  total      REAL    NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no  TEXT    NOT NULL UNIQUE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  branch_id   INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  subtotal    REAL    NOT NULL DEFAULT 0,
  discount    REAL    NOT NULL DEFAULT 0,
  tax         REAL    NOT NULL DEFAULT 0,
  total       REAL    NOT NULL DEFAULT 0,
  paid        REAL    NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status      TEXT    NOT NULL DEFAULT 'completed',
  note        TEXT,
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(created_at);

CREATE TABLE IF NOT EXISTS purchase_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  qty         REAL    NOT NULL,
  unit_cost   REAL    NOT NULL,
  total       REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS returns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id    INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  amount     REAL    NOT NULL,
  restock    INTEGER NOT NULL DEFAULT 1,
  reason     TEXT,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_moves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  type       TEXT    NOT NULL,           -- sale | purchase | adjust | return | waste | open
  qty        REAL    NOT NULL,           -- موجب = إضافة، سالب = خصم
  balance    REAL    NOT NULL DEFAULT 0, -- الرصيد بعد الحركة
  ref_type   TEXT,
  ref_id     INTEGER,
  note       TEXT,
  user_id    INTEGER REFERENCES users(id),
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_moves_product ON stock_moves(product_id, created_at);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  category    TEXT    NOT NULL,
  description TEXT,
  amount      REAL    NOT NULL,
  method      TEXT    NOT NULL DEFAULT 'cash',
  user_id     INTEGER REFERENCES users(id),
  shift_id    INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id  INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  type       TEXT    NOT NULL,           -- sale | purchase | expense | customer_payment | supplier_payment | adjust | return
  direction  TEXT    NOT NULL,           -- in | out
  amount     REAL    NOT NULL,
  method     TEXT    NOT NULL DEFAULT 'cash',
  ref_type   TEXT,
  ref_id     INTEGER,
  party_type TEXT,
  party_id   INTEGER,
  note       TEXT,
  user_id    INTEGER REFERENCES users(id),
  shift_id   INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_shift ON payments(shift_id);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT    NOT NULL,
  details    TEXT,
  ip         TEXT,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity(created_at);

/* سجل تدقيق موحّد: من أنشأ/عدّل/حذف/استعاد وماذا */
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  user_name  TEXT,
  action     TEXT    NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  details    TEXT,
  ip         TEXT,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
