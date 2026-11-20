-- ============================================================
-- كافيه برو — مخطط MySQL/MariaDB (5.7+)
-- الاستيراد: phpMyAdmin → قاعدة البيانات → Import
-- أو: node scripts/schema-mysql.js
-- ============================================================

CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) UNIQUE,
  address TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(191) UNIQUE NOT NULL,
  pass VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  perms VARCHAR(4000) NOT NULL DEFAULT '{}',
  branch_id INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  active INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) UNIQUE,
  type VARCHAR(50),
  active INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer VARCHAR(255),
  item VARCHAR(255),
  qty INT,
  price DOUBLE,
  total DOUBLE,
  payment VARCHAR(50),
  user_id INT,
  shift_id INT,
  date VARCHAR(30),
  branch_id INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier VARCHAR(255),
  item VARCHAR(255),
  qty INT,
  `unitPrice` DOUBLE,
  total DOUBLE,
  date VARCHAR(30),
  branch_id INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50),
  `desc` TEXT,
  amount DOUBLE,
  date VARCHAR(30),
  branch_id INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS journal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date VARCHAR(30),
  ref VARCHAR(100),
  `desc` TEXT,
  account VARCHAR(255),
  debit DOUBLE DEFAULT 0,
  credit DOUBLE DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(255),
  opened_at VARCHAR(30),
  closed_at VARCHAR(30),
  opening_cash DOUBLE,
  closing_cash DOUBLE,
  status VARCHAR(20) DEFAULT 'open',
  branch_id INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(30) DEFAULT 'menu',
  cost_price DOUBLE DEFAULT 0,
  sell_price DOUBLE DEFAULT 0,
  barcode VARCHAR(191),
  active INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_item VARCHAR(255),
  ingredient VARCHAR(255),
  qty DOUBLE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(191) UNIQUE,
  status VARCHAR(20) DEFAULT 'free',
  active INT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_id INT,
  table_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'open',
  total DOUBLE DEFAULT 0,
  created_at VARCHAR(30),
  billed_at VARCHAR(30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT,
  item VARCHAR(255),
  qty INT,
  price DOUBLE,
  total DOUBLE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(255),
  action VARCHAR(50),
  entity VARCHAR(100),
  entity_id VARCHAR(100),
  details TEXT,
  created_at VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
