-- ============================================================
-- Talabatak — MySQL 5.7+ / MariaDB 10.2+ schema
-- Import via phpMyAdmin, or let the app create it automatically.
-- ============================================================

CREATE TABLE IF NOT EXISTS `company` (
  `id` BIGINT PRIMARY KEY,
  `name` VARCHAR(190),
  `logo` LONGTEXT,
  `phone` VARCHAR(64),
  `email` VARCHAR(190),
  `address` TEXT,
  `currency` VARCHAR(20) DEFAULT 'ج.م',
  `tax_percent` DOUBLE DEFAULT 0,
  `tax_enabled` BIGINT DEFAULT 0,
  `delivery_fee` DOUBLE DEFAULT 0,
  `about` TEXT,
  `working_hours` TEXT,
  `facebook` VARCHAR(500),
  `instagram` VARCHAR(500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `branches` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `address` TEXT,
  `phone` VARCHAR(64),
  `manager` VARCHAR(190),
  `active` BIGINT DEFAULT 1,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `email` VARCHAR(190),
  `phone` VARCHAR(64),
  `password` VARCHAR(190),
  `role` VARCHAR(32) DEFAULT 'staff',
  `permissions` VARCHAR(1000) DEFAULT '{}',
  `active` BIGINT DEFAULT 1,
  `branch_id` BIGINT,
  `created_at` VARCHAR(40),
  UNIQUE (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pilots` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `phone` VARCHAR(64),
  `vehicle` VARCHAR(500),
  `plate` VARCHAR(500),
  `branch_id` BIGINT,
  `active` BIGINT DEFAULT 1,
  `rating` DOUBLE DEFAULT 0,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `phone` VARCHAR(64),
  `address` TEXT,
  `balance` DOUBLE DEFAULT 0,
  `notes` TEXT,
  `active` BIGINT DEFAULT 1,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `phone` VARCHAR(64),
  `address` TEXT,
  `points` BIGINT DEFAULT 0,
  `total_spent` DOUBLE DEFAULT 0,
  `orders_count` BIGINT DEFAULT 0,
  `rating` DOUBLE DEFAULT 0,
  `notes` TEXT,
  `created_at` VARCHAR(40),
  `zone_id` BIGINT,
  UNIQUE (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `description` TEXT,
  `image` LONGTEXT,
  `active` BIGINT DEFAULT 1,
  `sort_order` BIGINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `category_id` BIGINT,
  `name` VARCHAR(190),
  `description` TEXT,
  `image` LONGTEXT,
  `price` DOUBLE DEFAULT 0,
  `cost` DOUBLE DEFAULT 0,
  `unit` VARCHAR(64) DEFAULT 'قطعة',
  `barcode` VARCHAR(190),
  `stock` DOUBLE DEFAULT 0,
  `min_stock` DOUBLE DEFAULT 5,
  `active` BIGINT DEFAULT 1,
  `created_at` VARCHAR(40),
  `unit_id` BIGINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_moves` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `product_id` BIGINT,
  `branch_id` BIGINT,
  `type` VARCHAR(500),
  `qty` DOUBLE,
  `balance_after` DOUBLE,
  `ref` VARCHAR(500),
  `note` TEXT,
  `date` VARCHAR(40),
  `user_id` BIGINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchases` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `supplier_id` BIGINT,
  `date` VARCHAR(40),
  `status` VARCHAR(40) DEFAULT 'draft',
  `total` DOUBLE DEFAULT 0,
  `paid` DOUBLE DEFAULT 0,
  `payment_method_id` BIGINT,
  `warehouse` VARCHAR(500),
  `note` TEXT,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` BIGINT,
  `product_id` BIGINT,
  `qty` DOUBLE,
  `cost` DOUBLE,
  `total` DOUBLE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `kind` VARCHAR(32) DEFAULT 'cash',
  `active` BIGINT DEFAULT 1,
  `sort_order` BIGINT DEFAULT 0,
  `pay_number` VARCHAR(500),
  `pay_holder` VARCHAR(500),
  `pay_bank` VARCHAR(500),
  `pay_link` VARCHAR(500),
  `pay_instructions` TEXT,
  `requires_proof` BIGINT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(64),
  `customer_id` BIGINT,
  `branch_id` BIGINT,
  `pilot_id` BIGINT,
  `payment_method_id` BIGINT,
  `promo_id` BIGINT,
  `promo_code` VARCHAR(500),
  `status` VARCHAR(40) DEFAULT 'new',
  `subtotal` DOUBLE DEFAULT 0,
  `discount` DOUBLE DEFAULT 0,
  `delivery_fee` DOUBLE DEFAULT 0,
  `tax` DOUBLE DEFAULT 0,
  `total` DOUBLE DEFAULT 0,
  `paid` VARCHAR(40) DEFAULT 'unpaid',
  `note` TEXT,
  `address` TEXT,
  `phone` VARCHAR(64),
  `rating` DOUBLE,
  `rating_comment` TEXT,
  `created_at` VARCHAR(40),
  `updated_at` VARCHAR(40),
  `delivered_at` VARCHAR(40),
  `cancel_reason` TEXT,
  `zone_id` BIGINT,
  `proof_status` VARCHAR(40),
  `proof_id` BIGINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT,
  `product_id` BIGINT,
  `name` VARCHAR(190),
  `price` DOUBLE,
  `qty` DOUBLE,
  `total` DOUBLE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_events` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT,
  `status` VARCHAR(40),
  `note` TEXT,
  `at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `promotions` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `kind` VARCHAR(32) DEFAULT 'percent',
  `value` DOUBLE DEFAULT 0,
  `code` VARCHAR(64),
  `start_at` VARCHAR(40),
  `end_at` VARCHAR(40),
  `min_order` DOUBLE DEFAULT 0,
  `active` BIGINT DEFAULT 1,
  `category_id` BIGINT,
  `used_count` BIGINT DEFAULT 0,
  UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rewards` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` BIGINT,
  `kind` VARCHAR(32) DEFAULT 'discount',
  `value` DOUBLE DEFAULT 0,
  `note` TEXT,
  `active` BIGINT DEFAULT 1,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ads` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(190),
  `image` LONGTEXT,
  `link` VARCHAR(500),
  `position` VARCHAR(500) DEFAULT 'home',
  `start_at` VARCHAR(40),
  `end_at` VARCHAR(40),
  `active` BIGINT DEFAULT 1,
  `clicks` BIGINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(64),
  `name` VARCHAR(190),
  `type` VARCHAR(500),
  `parent_id` BIGINT,
  `kind` VARCHAR(32) DEFAULT 'normal',
  `is_system` BIGINT DEFAULT 0,
  `balance` DOUBLE DEFAULT 0,
  UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journals` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `date` VARCHAR(40),
  `ref_type` VARCHAR(500),
  `ref_id` BIGINT,
  `memo` TEXT,
  `created_by` BIGINT,
  `approved` BIGINT DEFAULT 1,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `journal_id` BIGINT,
  `account_id` BIGINT,
  `debit` DOUBLE DEFAULT 0,
  `credit` DOUBLE DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cash_accounts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `kind` VARCHAR(32) DEFAULT 'treasury',
  `name` VARCHAR(190),
  `holder` VARCHAR(190),
  `branch_id` BIGINT,
  `account_no` VARCHAR(190),
  `balance` DOUBLE DEFAULT 0,
  `active` BIGINT DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vouchers` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `kind` VARCHAR(32) DEFAULT 'payment',
  `source` VARCHAR(500) DEFAULT 'cash',
  `cash_account_id` BIGINT,
  `party_type` VARCHAR(500),
  `party_id` BIGINT,
  `amount` DOUBLE DEFAULT 0,
  `date` VARCHAR(40),
  `memo` TEXT,
  `ref` VARCHAR(500),
  `journal_id` BIGINT,
  `created_by` BIGINT,
  `approved` BIGINT DEFAULT 0,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_counts` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `date` VARCHAR(40),
  `branch_id` BIGINT,
  `status` VARCHAR(40) DEFAULT 'draft',
  `memo` TEXT,
  `created_by` BIGINT,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_count_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `count_id` BIGINT,
  `product_id` BIGINT,
  `unit_cost` DOUBLE,
  `system_qty` DOUBLE,
  `actual_qty` DOUBLE,
  `diff` DOUBLE,
  `memo` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `token` VARCHAR(190) PRIMARY KEY,
  `kind` VARCHAR(32),
  `user_id` BIGINT,
  `customer_id` BIGINT,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `counters` (
  `name` VARCHAR(190) PRIMARY KEY,
  `value` BIGINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT,
  `user_name` VARCHAR(190),
  `action` VARCHAR(190),
  `entity` VARCHAR(190),
  `entity_id` BIGINT,
  `detail` TEXT,
  `at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_history` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT,
  `password` VARCHAR(190),
  `changed_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `zones` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `fee` DOUBLE DEFAULT 0,
  `eta` VARCHAR(64),
  `active` BIGINT DEFAULT 1,
  `sort_order` BIGINT DEFAULT 0,
  `notes` TEXT,
  `created_at` VARCHAR(40),
  UNIQUE (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `units` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(190),
  `symbol` VARCHAR(32),
  `allow_fraction` BIGINT DEFAULT 1,
  `active` BIGINT DEFAULT 1,
  `sort_order` BIGINT DEFAULT 0,
  `created_at` VARCHAR(40),
  UNIQUE (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `backup_dirs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `path` VARCHAR(1000),
  `note` TEXT,
  `is_default` BIGINT DEFAULT 0,
  `created_at` VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_proofs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `order_id` BIGINT,
  `method_id` BIGINT,
  `method_name` VARCHAR(500),
  `amount` DOUBLE DEFAULT 0,
  `txn_ref` VARCHAR(500),
  `paid_at` VARCHAR(40),
  `note` TEXT,
  `image` LONGTEXT,
  `image_name` VARCHAR(500),
  `image_mime` VARCHAR(100),
  `status` VARCHAR(40) DEFAULT 'pending',
  `reject_reason` VARCHAR(500),
  `reviewed_by` BIGINT,
  `reviewed_at` VARCHAR(40),
  `created_at` VARCHAR(40),
  INDEX idx_pp_order (order_id),
  INDEX idx_pp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` BIGINT,
  `order_id` BIGINT,
  `kind` VARCHAR(32) DEFAULT 'info',
  `title` VARCHAR(190),
  `body` TEXT,
  `icon` VARCHAR(500) DEFAULT '🔔',
  `is_read` BIGINT DEFAULT 0,
  `created_at` VARCHAR(40),
  INDEX idx_notif_cust (customer_id),
  INDEX idx_notif_read (customer_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

