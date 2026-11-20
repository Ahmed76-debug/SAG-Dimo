import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_FILE } from './config.mjs';

let db = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS officeProfile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nameAr TEXT, nameEn TEXT, ownerNameAr TEXT, ownerNameEn TEXT, titleAr TEXT, titleEn TEXT,
  email TEXT, phone TEXT, addressAr TEXT, addressEn TEXT, website TEXT, logoDataUrl TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS appSettings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  defaultLanguage TEXT, defaultTheme TEXT, backupFolderName TEXT, autoBackup INTEGER DEFAULT 0,
  lastBackupAt TEXT, lastRestoreAt TEXT, auditTightening INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT, nameAr TEXT, nameEn TEXT, legalForm TEXT, size TEXT, activity TEXT,
  activityDetailsAr TEXT, activityDetailsEn TEXT, taxId TEXT, registrationNo TEXT,
  phone TEXT, email TEXT, addressAr TEXT, addressEn TEXT, baseCurrency TEXT,
  fiscalYearStart TEXT, fiscalYearEnd TEXT, status TEXT, notes TEXT, createdAt TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  companyId INTEGER, code TEXT, nameAr TEXT, nameEn TEXT, parentCode TEXT, type TEXT, section TEXT,
  level INTEGER, nature TEXT, isActive INTEGER DEFAULT 1, isSystem INTEGER DEFAULT 0, allowPosting INTEGER DEFAULT 1,
  notes TEXT, createdAt TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS trialBalanceImports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  companyId INTEGER, fiscalYear TEXT, periodStart TEXT, periodEnd TEXT, status TEXT, source TEXT,
  submittedBy INTEGER, submittedByName TEXT, reviewedBy INTEGER, reviewedByName TEXT, reviewedAt TEXT, reviewNotes TEXT,
  totalDebit REAL, totalCredit REAL, isBalanced INTEGER, lineCount INTEGER, notes TEXT, createdAt TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS trialBalanceLines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  importId INTEGER, companyId INTEGER, code TEXT, nameAr TEXT, nameEn TEXT, type TEXT, section TEXT,
  debit REAL, credit REAL, currency TEXT, exchangeRate REAL, debitBase REAL, creditBase REAL,
  [order] INTEGER, notes TEXT
);

CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  companyId INTEGER, fiscalYear TEXT, no TEXT, kind TEXT, date TEXT, descriptionAr TEXT, descriptionEn TEXT,
  reference TEXT, status TEXT, lines TEXT, submittedBy INTEGER, submittedByName TEXT, reviewedBy INTEGER,
  reviewedByName TEXT, reviewedAt TEXT, reviewNotes TEXT, createdAt TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE, passwordHash TEXT, fullNameAr TEXT, fullNameEn TEXT, email TEXT, phone TEXT,
  role TEXT, companyId INTEGER, isActive INTEGER DEFAULT 1, lastLogin TEXT, createdAt TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titleAr TEXT, titleEn TEXT, descriptionAr TEXT, descriptionEn TEXT, companyId INTEGER, dueDate TEXT,
  remindBeforeDays INTEGER, status TEXT, type TEXT, createdAt TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  companyId INTEGER, year TEXT, type TEXT, titleAr TEXT, titleEn TEXT, data TEXT, archivedAt TEXT, archivedBy TEXT
);

CREATE TABLE IF NOT EXISTS currencyRates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT, nameAr TEXT, nameEn TEXT, rateToEGP REAL, date TEXT, source TEXT
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  companyId INTEGER, year TEXT, lines TEXT, notes TEXT, createdAt TEXT, updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS auditLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT, entity TEXT, entityId INTEGER, detailsAr TEXT, detailsEn TEXT, userName TEXT, createdAt TEXT
);

CREATE TABLE IF NOT EXISTS tutorialVideos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, pageName TEXT, videoNumber INTEGER, description TEXT, fileName TEXT, mimeType TEXT,
  size INTEGER, videoData TEXT, createdAt TEXT, updatedAt TEXT, deletedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(companyId);
CREATE INDEX IF NOT EXISTS idx_tbi_company ON trialBalanceImports(companyId);
CREATE INDEX IF NOT EXISTS idx_tbl_import ON trialBalanceLines(importId);
CREATE INDEX IF NOT EXISTS idx_adj_company ON adjustments(companyId);
`;

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec(SCHEMA);
  return db;
}
