import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, DB_FILE } from './config.mjs';

let db = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  avatarColor TEXT,
  passwordHash TEXT,
  salt TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  permOverrides TEXT,
  createdAt TEXT,
  lastLoginAt TEXT,
  notificationsEnabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legalName TEXT,
  type TEXT,
  nationalId TEXT,
  commercialId TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  profession TEXT,
  notes TEXT,
  tags TEXT,
  priority TEXT,
  assignedTo TEXT,
  status TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  archived INTEGER DEFAULT 0,
  archivedAt TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS matterTypes (
  id TEXT PRIMARY KEY,
  name TEXT,
  color TEXT,
  icon TEXT,
  description TEXT,
  defaultDurationDays INTEGER,
  defaultFee REAL
);

CREATE TABLE IF NOT EXISTS matters (
  id TEXT PRIMARY KEY,
  number TEXT,
  internalRef TEXT,
  title TEXT,
  typeId TEXT,
  clientId TEXT,
  opposingParty TEXT,
  courtName TEXT,
  caseNumber TEXT,
  judge TEXT,
  status TEXT,
  priority TEXT,
  stage TEXT,
  description TEXT,
  lawyerIds TEXT,
  feeType TEXT,
  agreedFee REAL,
  hourlyRate REAL,
  expenses REAL,
  courtFees REAL,
  currency TEXT,
  openedAt TEXT,
  closedAt TEXT,
  nextAction TEXT,
  nextActionDate TEXT,
  progress INTEGER,
  confidential INTEGER,
  tags TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  archived INTEGER DEFAULT 0,
  archivedAt TEXT,
  archiveYear INTEGER,
  outcome TEXT,
  winRate REAL
);

CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY,
  matterId TEXT,
  title TEXT,
  type TEXT,
  amount REAL,
  currency TEXT,
  terms TEXT,
  signedDate TEXT,
  expiresAt TEXT,
  status TEXT,
  installmentCount INTEGER,
  installmentAmount REAL,
  notes TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  matterId TEXT,
  agreementId TEXT,
  kind TEXT,
  amount REAL,
  currency TEXT,
  date TEXT,
  method TEXT,
  receiptNo TEXT,
  notes TEXT,
  recordedBy TEXT,
  createdAt TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  matterId TEXT,
  clientId TEXT,
  assigneeId TEXT,
  createdBy TEXT,
  dueDate TEXT,
  remindAt TEXT,
  priority TEXT,
  status TEXT,
  tags TEXT,
  checklist TEXT,
  estimatedHours REAL,
  createdAt TEXT,
  updatedAt TEXT,
  completedAt TEXT,
  recurring TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT,
  matterId TEXT,
  clientId TEXT,
  date TEXT,
  endTime TEXT,
  location TEXT,
  courtRoom TEXT,
  judge TEXT,
  attendees TEXT,
  notes TEXT,
  outcome TEXT,
  status TEXT,
  remindBeforeDays INTEGER,
  remindersSent INTEGER,
  createdAt TEXT,
  updatedAt TEXT,
  archived INTEGER DEFAULT 0,
  archivedAt TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT,
  category TEXT,
  matterId TEXT,
  clientId TEXT,
  eventId TEXT,
  fileId TEXT,
  fileName TEXT,
  mime TEXT,
  size INTEGER,
  version INTEGER,
  parentId TEXT,
  tags TEXT,
  notes TEXT,
  confidential INTEGER,
  requiresSignature INTEGER,
  signedAt TEXT,
  printCount INTEGER,
  createdBy TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  archived INTEGER DEFAULT 0,
  archivedAt TEXT,
  retentionUntil TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT,
  mime TEXT,
  size INTEGER,
  dataUrl TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  matterId TEXT,
  body TEXT,
  kind TEXT,
  authorId TEXT,
  pinned INTEGER,
  createdAt TEXT,
  updatedAt TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS library (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT,
  author TEXT,
  publisher TEXT,
  year INTEGER,
  category TEXT,
  description TEXT,
  url TEXT,
  fileId TEXT,
  coverColor TEXT,
  rating REAL,
  status TEXT,
  progress INTEGER,
  tags TEXT,
  notes TEXT,
  isFavorite INTEGER,
  addedAt TEXT,
  lastOpenedAt TEXT,
  addedBy TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  body TEXT,
  variables TEXT,
  usageCount INTEGER,
  createdAt TEXT,
  updatedAt TEXT,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  userId TEXT,
  userName TEXT,
  action TEXT,
  entity TEXT,
  entityId TEXT,
  meta TEXT,
  at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT,
  body TEXT,
  kind TEXT,
  refType TEXT,
  refId TEXT,
  read INTEGER DEFAULT 0,
  at TEXT,
  link TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  profile TEXT,
  theme TEXT,
  density TEXT,
  reminderLeadDays INTEGER,
  dailyDigest INTEGER,
  soundEnabled INTEGER,
  currency TEXT,
  defaultFeeType TEXT,
  archiveAfterMonths INTEGER,
  autoArchiveClosed INTEGER,
  printHeader TEXT,
  printFooter TEXT,
  confidentialityNotice TEXT,
  sidebarCollapsed INTEGER
);

CREATE TABLE IF NOT EXISTS portfolio (
  id TEXT PRIMARY KEY,
  heroTitle TEXT,
  heroSubtitle TEXT,
  heroCta TEXT,
  aboutTitle TEXT,
  aboutBody TEXT,
  stats TEXT,
  services TEXT,
  expertise TEXT,
  experience TEXT,
  credentials TEXT,
  caseHighlights TEXT,
  testimonials TEXT,
  articles TEXT,
  languages TEXT,
  memberships TEXT,
  ctaTitle TEXT,
  ctaBody TEXT,
  avatarFileId TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS tutorialVideos (
  id TEXT PRIMARY KEY,
  title TEXT,
  pageName TEXT,
  videoNumber INTEGER,
  description TEXT,
  fileName TEXT,
  mimeType TEXT,
  size INTEGER,
  videoData TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);
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

export function closeDb() {
  try { db?.close(); } catch {}
  db = null;
}