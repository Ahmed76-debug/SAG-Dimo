/**
 * EduSphere database schema — applied idempotently on boot.
 * Grouped into modules; every table uses INTEGER PRIMARY KEY AUTOINCREMENT.
 */

const AUDIT_COLUMNS = `
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  deleted_at TEXT,
  deleted_by INTEGER
`;

const SIMPLE_AUDIT = `
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
`;

export const CORE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequences (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL DEFAULT 'app',
  key TEXT NOT NULL,
  value TEXT,
  updated_at TEXT,
  UNIQUE (scope, key)
);

CREATE TABLE IF NOT EXISTS locales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  native_name TEXT,
  direction TEXT NOT NULL DEFAULT 'ltr',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  locale TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  namespace TEXT DEFAULT 'app',
  is_custom INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  UNIQUE (locale, key)
);
CREATE INDEX IF NOT EXISTS idx_translations_locale ON translations(locale);

CREATE TABLE IF NOT EXISTS currencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  symbol TEXT,
  decimals INTEGER NOT NULL DEFAULT 2,
  is_base INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_code TEXT NOT NULL,
  quote_code TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 1,
  effective_date TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_fx_pair ON exchange_rates(base_code, quote_code, effective_date);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  type TEXT DEFAULT 'main',
  address TEXT, city TEXT, country TEXT,
  phone TEXT, email TEXT, website TEXT,
  principal_name TEXT,
  currency_code TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  logo TEXT,
  capacity INTEGER DEFAULT 0,
  opened_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  module TEXT,
  action TEXT,
  name_en TEXT,
  name_ar TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  level INTEGER NOT NULL DEFAULT 10,
  is_system INTEGER NOT NULL DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  full_name_en TEXT,
  full_name_ar TEXT,
  phone TEXT,
  avatar TEXT,
  locale TEXT DEFAULT 'ar',
  theme TEXT DEFAULT 'system',
  branch_id INTEGER,
  default_branch_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_super INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  last_login_ip TEXT,
  two_factor_secret TEXT,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  branch_id INTEGER,
  PRIMARY KEY (user_id, role_id, branch_id)
);

CREATE TABLE IF NOT EXISTS user_branches (
  user_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  branch_id INTEGER,
  summary TEXT,
  changes TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  role_code TEXT,
  branch_id INTEGER,
  title_en TEXT, title_ar TEXT,
  body_en TEXT, body_ar TEXT,
  type TEXT DEFAULT 'info',
  severity TEXT DEFAULT 'normal',
  entity TEXT, entity_id INTEGER,
  url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  scheduled_at TEXT,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
  body_en TEXT, body_ar TEXT,
  audience TEXT DEFAULT 'all',
  branch_id INTEGER,
  publish_at TEXT, expire_at TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  priority TEXT DEFAULT 'normal',
  attachment TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  name TEXT,
  original_name TEXT,
  mime TEXT,
  size INTEGER DEFAULT 0,
  storage_path TEXT,
  kind TEXT DEFAULT 'file',
  category TEXT,
  uploaded_by INTEGER,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity, entity_id);

CREATE TABLE IF NOT EXISTS archive_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  label TEXT,
  snapshot TEXT,
  reason TEXT,
  archived_by INTEGER,
  archived_at TEXT NOT NULL DEFAULT (datetime('now')),
  restored_at TEXT,
  restored_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_archive_entity ON archive_records(entity);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en TEXT NOT NULL, title_ar TEXT,
  description TEXT,
  assigned_to INTEGER,
  due_date TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  entity TEXT, entity_id INTEGER,
  completed_at TEXT,
  ${SIMPLE_AUDIT}
);
`;

export const ACADEMICS_SQL = `
CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  branch_id INTEGER,
  is_current INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  academic_year_id INTEGER,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  start_date TEXT, end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  weight REAL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_terms_year ON terms(academic_year_id);

CREATE TABLE IF NOT EXISTS grade_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  stage TEXT,
  sort_order INTEGER DEFAULT 0,
  branch_id INTEGER,
  capacity INTEGER DEFAULT 0,
  age_from INTEGER, age_to INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  branch_id INTEGER,
  head_staff_id INTEGER,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  department_id INTEGER,
  grade TEXT,
  min_salary REAL DEFAULT 0,
  max_salary REAL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS classrooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  branch_id INTEGER,
  building TEXT, floor TEXT,
  capacity INTEGER DEFAULT 0,
  type TEXT DEFAULT 'classroom',
  resources TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  category TEXT,
  department_id INTEGER,
  credit_hours REAL DEFAULT 1,
  is_elective INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#4f7cff',
  language TEXT,
  description_en TEXT, description_ar TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS curricula (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  subject_id INTEGER,
  grade_level_id INTEGER,
  framework TEXT,
  version TEXT DEFAULT '1.0',
  description_en TEXT, description_ar TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS curriculum_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  curriculum_id INTEGER,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  weeks REAL DEFAULT 1,
  objectives_en TEXT, objectives_ar TEXT,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_units_curriculum ON curriculum_units(curriculum_id);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 45,
  content_en TEXT, content_ar TEXT,
  resources TEXT,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  grade_level_id INTEGER,
  academic_year_id INTEGER,
  branch_id INTEGER,
  room_id INTEGER,
  homeroom_teacher_id INTEGER,
  capacity INTEGER DEFAULT 30,
  students_count INTEGER DEFAULT 0,
  shift TEXT DEFAULT 'morning',
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_sections_grade ON sections(grade_level_id);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  admission_no TEXT,
  first_name_en TEXT NOT NULL, last_name_en TEXT,
  first_name_ar TEXT, last_name_ar TEXT,
  gender TEXT,
  dob TEXT,
  nationality TEXT,
  religion TEXT,
  blood_group TEXT,
  photo TEXT,
  email TEXT, phone TEXT, mobile TEXT,
  address TEXT, city TEXT, country TEXT,
  branch_id INTEGER,
  grade_level_id INTEGER,
  section_id INTEGER,
  academic_year_id INTEGER,
  status TEXT DEFAULT 'active',
  enrollment_date TEXT,
  previous_school TEXT,
  medical_notes TEXT,
  special_needs TEXT,
  transport_required INTEGER NOT NULL DEFAULT 0,
  bus_route_id INTEGER,
  bus_stop_id INTEGER,
  user_id INTEGER,
  fee_structure_id INTEGER,
  discount_percent REAL DEFAULT 0,
  guardian_name TEXT, guardian_phone TEXT, guardian_email TEXT,
  notes TEXT,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id);
CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

CREATE TABLE IF NOT EXISTS guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  first_name_en TEXT NOT NULL, last_name_en TEXT,
  first_name_ar TEXT, last_name_ar TEXT,
  relation TEXT DEFAULT 'father',
  gender TEXT,
  email TEXT, phone TEXT, mobile TEXT, whatsapp TEXT,
  occupation TEXT, employer TEXT,
  address TEXT, city TEXT, country TEXT,
  national_id TEXT, passport_no TEXT,
  user_id INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS student_guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  guardian_id INTEGER NOT NULL,
  relation TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  can_pickup INTEGER NOT NULL DEFAULT 1,
  financial_responsible INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE (student_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  user_id INTEGER,
  first_name_en TEXT NOT NULL, last_name_en TEXT,
  first_name_ar TEXT, last_name_ar TEXT,
  gender TEXT, dob TEXT, nationality TEXT,
  marital_status TEXT,
  photo TEXT,
  email TEXT, phone TEXT, mobile TEXT,
  address TEXT, city TEXT, country TEXT,
  branch_id INTEGER,
  department_id INTEGER,
  position_id INTEGER,
  employment_type TEXT DEFAULT 'full-time',
  hire_date TEXT, end_date TEXT,
  status TEXT DEFAULT 'active',
  basic_salary REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  bank_name TEXT, bank_account TEXT, iban TEXT,
  qualification TEXT, specialization TEXT,
  experience_years REAL DEFAULT 0,
  contract_no TEXT,
  subjects_taught TEXT,
  is_teacher INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_staff_branch ON staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_dept ON staff(department_id);

CREATE TABLE IF NOT EXISTS staff_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER,
  contract_no TEXT,
  type TEXT DEFAULT 'full-time',
  start_date TEXT, end_date TEXT,
  salary REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  signed_date TEXT,
  status TEXT DEFAULT 'active',
  attachment TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  check_in TEXT, check_out TEXT,
  status TEXT DEFAULT 'present',
  hours_worked REAL DEFAULT 0,
  notes TEXT,
  branch_id INTEGER,
  ${SIMPLE_AUDIT},
  UNIQUE (staff_id, date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER,
  type TEXT DEFAULT 'annual',
  start_date TEXT, end_date TEXT,
  days REAL DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  approved_by INTEGER,
  approved_at TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  period_month INTEGER, period_year INTEGER,
  branch_id INTEGER,
  status TEXT DEFAULT 'draft',
  total_gross REAL DEFAULT 0,
  total_deductions REAL DEFAULT 0,
  total_net REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  processed_at TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS payslips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_run_id INTEGER,
  staff_id INTEGER,
  basic REAL DEFAULT 0,
  allowances REAL DEFAULT 0,
  overtime REAL DEFAULT 0,
  deductions REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  insurance REAL DEFAULT 0,
  net REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft',
  paid_at TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  section_id INTEGER,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'present',
  minutes_late INTEGER DEFAULT 0,
  reason TEXT,
  recorded_by INTEGER,
  branch_id INTEGER,
  ${SIMPLE_AUDIT},
  UNIQUE (student_id, date, section_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER,
  subject_id INTEGER,
  teacher_id INTEGER,
  room_id INTEGER,
  term_id INTEGER,
  academic_year_id INTEGER,
  branch_id INTEGER,
  day_of_week INTEGER DEFAULT 1,
  period INTEGER DEFAULT 1,
  start_time TEXT, end_time TEXT,
  color TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_tt_section ON timetable_slots(section_id, day_of_week);

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT,
  subject_id INTEGER, section_id INTEGER, term_id INTEGER,
  type TEXT DEFAULT 'quiz',
  max_score REAL DEFAULT 100,
  weight REAL DEFAULT 1,
  assessment_date TEXT,
  duration_minutes INTEGER,
  instructions TEXT,
  created_by INTEGER,
  status TEXT DEFAULT 'published',
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  score REAL,
  grade_letter TEXT,
  remarks TEXT,
  graded_by INTEGER,
  graded_at TEXT,
  ${SIMPLE_AUDIT},
  UNIQUE (assessment_id, student_id)
);

CREATE TABLE IF NOT EXISTS report_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  term_id INTEGER,
  section_id INTEGER,
  academic_year_id INTEGER,
  gpa REAL DEFAULT 0,
  total_score REAL DEFAULT 0,
  average REAL DEFAULT 0,
  rank INTEGER,
  attendance_rate REAL DEFAULT 0,
  remarks_en TEXT, remarks_ar TEXT,
  status TEXT DEFAULT 'draft',
  issued_at TEXT, published_at TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS exam_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  term_id INTEGER, subject_id INTEGER, section_id INTEGER,
  exam_date TEXT, start_time TEXT, end_time TEXT,
  room_id INTEGER, invigilator_id INTEGER,
  max_score REAL DEFAULT 100,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  student_id INTEGER,
  staff_id INTEGER,
  type TEXT DEFAULT 'achievement',
  title_en TEXT, title_ar TEXT,
  issue_date TEXT,
  serial TEXT,
  template TEXT,
  description TEXT,
  issued_by INTEGER,
  ${SIMPLE_AUDIT}
);
`;

export const FINANCE_SQL = `
CREATE TABLE IF NOT EXISTS fee_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  type TEXT DEFAULT 'tuition',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  account_id INTEGER,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  academic_year_id INTEGER, grade_level_id INTEGER, term_id INTEGER,
  branch_id INTEGER,
  currency_code TEXT DEFAULT 'USD',
  total_amount REAL DEFAULT 0,
  installments INTEGER DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS fee_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_structure_id INTEGER,
  fee_category_id INTEGER,
  name_en TEXT NOT NULL, name_ar TEXT,
  amount REAL DEFAULT 0,
  is_mandatory INTEGER NOT NULL DEFAULT 1,
  due_date TEXT,
  sort_order INTEGER DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  type TEXT DEFAULT 'percentage',
  value REAL DEFAULT 0,
  applies_to TEXT DEFAULT 'tuition',
  reason TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  student_id INTEGER,
  discount_id INTEGER,
  type TEXT DEFAULT 'percentage',
  percentage REAL DEFAULT 0,
  amount REAL DEFAULT 0,
  sponsor TEXT,
  start_date TEXT, end_date TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  type TEXT DEFAULT 'cash',
  account_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  sort_order INTEGER DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT,
  student_id INTEGER,
  academic_year_id INTEGER, term_id INTEGER,
  branch_id INTEGER,
  issue_date TEXT, due_date TEXT,
  currency_code TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1,
  subtotal REAL DEFAULT 0,
  discount_total REAL DEFAULT 0,
  tax_total REAL DEFAULT 0,
  total REAL DEFAULT 0,
  paid_total REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  notes TEXT,
  journal_entry_id INTEGER,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  fee_item_id INTEGER,
  fee_category_id INTEGER,
  description_en TEXT, description_ar TEXT,
  quantity REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  line_total REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines ON invoice_lines(invoice_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no TEXT,
  invoice_id INTEGER,
  student_id INTEGER,
  branch_id INTEGER,
  amount REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1,
  base_amount REAL DEFAULT 0,
  method_id INTEGER,
  method TEXT DEFAULT 'cash',
  reference_no TEXT,
  payment_date TEXT,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  received_by INTEGER,
  journal_entry_id INTEGER,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

CREATE TABLE IF NOT EXISTS payment_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  student_id INTEGER,
  academic_year_id INTEGER,
  total_amount REAL DEFAULT 0,
  installments INTEGER DEFAULT 1,
  currency_code TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active',
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_plan_id INTEGER,
  due_date TEXT,
  amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  invoice_id INTEGER,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'asset',
  subtype TEXT,
  parent_id INTEGER,
  level INTEGER DEFAULT 1,
  is_group INTEGER NOT NULL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  opening_balance REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  branch_id INTEGER,
  cost_center_id INTEGER,
  is_bank INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);

CREATE TABLE IF NOT EXISTS cost_centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  parent_id INTEGER,
  branch_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS fiscal_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  branch_id INTEGER,
  is_closed INTEGER NOT NULL DEFAULT 0,
  is_current INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER,
  code TEXT,
  name_en TEXT, name_ar TEXT,
  start_date TEXT, end_date TEXT,
  status TEXT DEFAULT 'open',
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_no TEXT,
  fiscal_period_id INTEGER,
  entry_date TEXT NOT NULL,
  reference TEXT,
  description_en TEXT, description_ar TEXT,
  source TEXT DEFAULT 'manual',
  source_id INTEGER,
  status TEXT DEFAULT 'draft',
  total_debit REAL DEFAULT 0,
  total_credit REAL DEFAULT 0,
  branch_id INTEGER,
  posted_at TEXT,
  posted_by INTEGER,
  reversal_of INTEGER,
  attachment TEXT,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_je_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_je_status ON journal_entries(status);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_entry_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  description TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1,
  cost_center_id INTEGER,
  branch_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  ${SIMPLE_AUDIT}
);
CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(account_id);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT,
  type TEXT DEFAULT 'supplier',
  contact_person TEXT,
  email TEXT, phone TEXT, mobile TEXT,
  address TEXT, city TEXT, country TEXT,
  tax_no TEXT,
  currency_code TEXT DEFAULT 'USD',
  balance REAL DEFAULT 0,
  payment_terms TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT,
  type TEXT DEFAULT 'parent',
  student_id INTEGER,
  contact_person TEXT,
  email TEXT, phone TEXT,
  address TEXT, tax_no TEXT,
  currency_code TEXT DEFAULT 'USD',
  balance REAL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_no TEXT,
  vendor_id INTEGER,
  order_date TEXT, expected_date TEXT,
  status TEXT DEFAULT 'draft',
  currency_code TEXT DEFAULT 'USD',
  subtotal REAL DEFAULT 0, tax_total REAL DEFAULT 0, total REAL DEFAULT 0,
  branch_id INTEGER,
  notes TEXT,
  approved_by INTEGER,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER,
  description TEXT,
  quantity REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  line_total REAL DEFAULT 0,
  account_id INTEGER,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_no TEXT,
  category_account_id INTEGER,
  vendor_id INTEGER,
  expense_date TEXT,
  amount REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 1,
  payment_method TEXT,
  description_en TEXT, description_ar TEXT,
  status TEXT DEFAULT 'approved',
  branch_id INTEGER,
  receipt_no TEXT,
  attachment TEXT,
  approved_by INTEGER,
  journal_entry_id INTEGER,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT, name_ar TEXT,
  fiscal_year_id INTEGER,
  account_id INTEGER,
  branch_id INTEGER,
  amount REAL DEFAULT 0,
  period_type TEXT DEFAULT 'annual',
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT,
  bank_name TEXT,
  account_no TEXT, iban TEXT, swift TEXT,
  currency_code TEXT DEFAULT 'USD',
  opening_balance REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  account_id INTEGER,
  branch_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT,
  category TEXT,
  purchase_date TEXT,
  cost REAL DEFAULT 0,
  salvage_value REAL DEFAULT 0,
  useful_life_years REAL DEFAULT 5,
  depreciation_method TEXT DEFAULT 'straight-line',
  accumulated_depreciation REAL DEFAULT 0,
  book_value REAL DEFAULT 0,
  location TEXT,
  branch_id INTEGER,
  custodian_staff_id INTEGER,
  status TEXT DEFAULT 'active',
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT,
  category TEXT,
  unit TEXT DEFAULT 'piece',
  quantity REAL DEFAULT 0,
  reorder_level REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  location TEXT,
  branch_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  type TEXT DEFAULT 'in',
  quantity REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  reference TEXT,
  movement_date TEXT,
  branch_id INTEGER,
  staff_id INTEGER,
  notes TEXT,
  ${SIMPLE_AUDIT}
);
`;

export const OPERATIONS_SQL = `
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  isbn TEXT,
  title_en TEXT NOT NULL, title_ar TEXT,
  author TEXT, publisher TEXT, edition TEXT,
  category TEXT, language TEXT,
  publish_year INTEGER, pages INTEGER,
  price REAL DEFAULT 0,
  cover TEXT,
  description_en TEXT, description_ar TEXT,
  total_copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  shelf TEXT,
  branch_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS book_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER,
  barcode TEXT,
  status TEXT DEFAULT 'available',
  condition TEXT DEFAULT 'good',
  acquired_date TEXT,
  branch_id INTEGER,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS library_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membership_no TEXT,
  user_id INTEGER, student_id INTEGER, staff_id INTEGER,
  type TEXT DEFAULT 'student',
  join_date TEXT, expiry_date TEXT,
  max_books INTEGER DEFAULT 3,
  status TEXT DEFAULT 'active',
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS book_loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id INTEGER,
  book_id INTEGER,
  member_id INTEGER,
  loan_date TEXT,
  due_date TEXT,
  return_date TEXT,
  status TEXT DEFAULT 'issued',
  fine REAL DEFAULT 0,
  fine_paid INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  issued_by INTEGER,
  returned_to INTEGER,
  branch_id INTEGER,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  subject_id INTEGER, grade_level_id INTEGER, teacher_id INTEGER,
  description_en TEXT, description_ar TEXT,
  cover TEXT,
  level TEXT DEFAULT 'beginner',
  status TEXT DEFAULT 'draft',
  is_published INTEGER NOT NULL DEFAULT 0,
  start_date TEXT, end_date TEXT,
  duration_hours REAL DEFAULT 0,
  price REAL DEFAULT 0,
  branch_id INTEGER,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS course_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER,
  title_en TEXT NOT NULL, title_ar TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS course_lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER,
  course_id INTEGER,
  title_en TEXT NOT NULL, title_ar TEXT,
  type TEXT DEFAULT 'video',
  content TEXT,
  video_url TEXT,
  attachment TEXT,
  duration_minutes INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_free INTEGER NOT NULL DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS online_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER,
  student_id INTEGER,
  enrolled_at TEXT,
  progress REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  completed_at TEXT,
  score REAL DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER,
  lesson_id INTEGER,
  status TEXT DEFAULT 'not-started',
  progress REAL DEFAULT 0,
  watched_seconds INTEGER DEFAULT 0,
  completed_at TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT,
  course_id INTEGER, section_id INTEGER, subject_id INTEGER,
  description_en TEXT, description_ar TEXT,
  due_date TEXT,
  max_score REAL DEFAULT 100,
  attachment TEXT,
  status TEXT DEFAULT 'published',
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER,
  student_id INTEGER,
  submitted_at TEXT,
  content TEXT,
  attachment TEXT,
  score REAL,
  feedback TEXT,
  status TEXT DEFAULT 'submitted',
  graded_by INTEGER,
  graded_at TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT,
  course_id INTEGER, lesson_id INTEGER,
  total_marks REAL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 15,
  passing_score REAL DEFAULT 50,
  questions TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER,
  student_id INTEGER,
  started_at TEXT,
  submitted_at TEXT,
  score REAL DEFAULT 0,
  answers TEXT,
  status TEXT DEFAULT 'in-progress',
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS video_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT,
  category_id INTEGER, subject_id INTEGER, grade_level_id INTEGER,
  url TEXT,
  provider TEXT DEFAULT 'youtube',
  thumbnail TEXT,
  duration_seconds INTEGER DEFAULT 0,
  description_en TEXT, description_ar TEXT,
  views INTEGER DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  uploaded_by INTEGER,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT,
  course_id INTEGER, section_id INTEGER, subject_id INTEGER, teacher_id INTEGER,
  platform TEXT DEFAULT 'zoom',
  join_url TEXT,
  start_at TEXT, end_at TEXT,
  status TEXT DEFAULT 'scheduled',
  recording_url TEXT,
  attendees_count INTEGER DEFAULT 0,
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS digital_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT,
  type TEXT DEFAULT 'pdf',
  subject_id INTEGER, grade_level_id INTEGER,
  url TEXT, file TEXT, size INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  tags TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  uploaded_by INTEGER,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  type TEXT DEFAULT 'room',
  branch_id INTEGER,
  capacity INTEGER DEFAULT 0,
  location TEXT,
  hourly_rate REAL DEFAULT 0,
  image TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_no TEXT,
  resource_id INTEGER,
  title_en TEXT NOT NULL, title_ar TEXT,
  purpose TEXT,
  booked_by INTEGER,
  requester_type TEXT DEFAULT 'staff',
  student_id INTEGER, staff_id INTEGER,
  start_at TEXT, end_at TEXT,
  attendees INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  recurrence TEXT,
  notes TEXT,
  branch_id INTEGER,
  approved_by INTEGER,
  ${AUDIT_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_bookings_resource ON bookings(resource_id, start_at);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  plate_no TEXT,
  make TEXT, model TEXT, year INTEGER,
  capacity INTEGER DEFAULT 0,
  driver_id INTEGER,
  insurance_expiry TEXT,
  license_expiry TEXT,
  status TEXT DEFAULT 'active',
  branch_id INTEGER,
  notes TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS transport_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT,
  branch_id INTEGER,
  vehicle_id INTEGER, driver_id INTEGER,
  capacity INTEGER DEFAULT 0,
  fee REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  start_time TEXT, end_time TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS transport_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER,
  name_en TEXT NOT NULL, name_ar TEXT,
  pickup_time TEXT, dropoff_time TEXT,
  sort_order INTEGER DEFAULT 0,
  lat REAL, lng REAL,
  fee REAL DEFAULT 0,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS student_transport (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  route_id INTEGER, stop_id INTEGER,
  direction TEXT DEFAULT 'both',
  start_date TEXT, end_date TEXT,
  status TEXT DEFAULT 'active',
  fee REAL DEFAULT 0,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS health_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  record_date TEXT,
  type TEXT DEFAULT 'visit',
  complaint TEXT,
  diagnosis TEXT,
  treatment TEXT,
  medication TEXT,
  nurse_id INTEGER,
  follow_up TEXT,
  status TEXT DEFAULT 'closed',
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS discipline_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  incident_date TEXT,
  category TEXT,
  severity TEXT DEFAULT 'low',
  description TEXT,
  action_taken TEXT,
  reported_by INTEGER,
  status TEXT DEFAULT 'open',
  parent_notified INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  type TEXT DEFAULT 'club',
  category TEXT,
  description_en TEXT, description_ar TEXT,
  start_date TEXT, end_date TEXT,
  schedule TEXT,
  location TEXT,
  supervisor_id INTEGER,
  capacity INTEGER DEFAULT 0,
  fee REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  branch_id INTEGER,
  status TEXT DEFAULT 'active',
  image TEXT,
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS activity_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER,
  student_id INTEGER,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'enrolled',
  joined_at TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  title_en TEXT NOT NULL, title_ar TEXT NOT NULL,
  type TEXT DEFAULT 'event',
  description_en TEXT, description_ar TEXT,
  start_at TEXT, end_at TEXT,
  location TEXT,
  branch_id INTEGER,
  audience TEXT DEFAULT 'all',
  is_public INTEGER NOT NULL DEFAULT 0,
  cover TEXT,
  status TEXT DEFAULT 'scheduled',
  ${AUDIT_COLUMNS}
);

CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT, id_no TEXT,
  purpose TEXT,
  person_to_visit TEXT,
  check_in TEXT, check_out TEXT,
  badge_no TEXT,
  branch_id INTEGER,
  company TEXT,
  notes TEXT,
  ${SIMPLE_AUDIT}
);

CREATE TABLE IF NOT EXISTS cafeteria_menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_date TEXT,
  meal_type TEXT DEFAULT 'lunch',
  items_en TEXT, items_ar TEXT,
  calories INTEGER DEFAULT 0,
  price REAL DEFAULT 0,
  allergens TEXT,
  branch_id INTEGER,
  ${SIMPLE_AUDIT}
);
`;

export const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade_level_id);
CREATE INDEX IF NOT EXISTS idx_staff_position ON staff(position_id);
CREATE INDEX IF NOT EXISTS idx_jl_created ON journal_lines(created_at);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title_en);
CREATE INDEX IF NOT EXISTS idx_loans_member ON book_loans(member_id);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at);
`;
