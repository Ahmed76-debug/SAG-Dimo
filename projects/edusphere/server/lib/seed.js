import { all, get, run, insertRow, transaction, setSetting, getSetting, nextSequence } from './db.js';
import { nowIso, todayIso, round2 } from './util.js';
import { buildPermissionCatalogue } from '../entities/index.js';

/* Deterministic PRNG so demo data is stable across installs */
function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261111);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pad = (n, len = 4) => String(n).padStart(len, '0');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const FIRST_EN = ['Adam', 'Omar', 'Yousef', 'Ali', 'Hassan', 'Mohamed', 'Karim', 'Ziad', 'Tarek', 'Amir', 'Sarah', 'Layla', 'Nour', 'Mariam', 'Hana', 'Salma', 'Jana', 'Aya', 'Dana', 'Yara', 'Liam', 'Emma', 'Noah', 'Olivia', 'Ethan', 'Mia', 'Lucas', 'Sofia'];
const FIRST_AR = ['آدم', 'عمر', 'يوسف', 'علي', 'حسن', 'محمد', 'كريم', 'زياد', 'طارق', 'أمير', 'سارة', 'ليلى', 'نور', 'مريم', 'هنا', 'سلمى', 'جنى', 'آية', 'دانة', 'يارا', 'ليام', 'إيما', 'نواه', 'أوليفيا', 'إيثان', 'ميا', 'لوكاس', 'صوفيا'];
const LAST_EN = ['Hassan', 'Ibrahim', 'Mahmoud', 'Khalil', 'Nasser', 'Fahmy', 'Sayed', 'Mostafa', 'Shawky', 'Adel', 'Smith', 'Johnson', 'Brown', 'Wilson', 'Taylor'];
const LAST_AR = ['حسن', 'إبراهيم', 'محمود', 'خليل', 'ناصر', 'فهمي', 'سيد', 'مصطفى', 'شوقي', 'عادل', 'سميث', 'جونسون', 'براون', 'ويلسون', 'تايلور'];
const NATIONALITIES = ['Egyptian', 'Saudi', 'Emirati', 'Jordanian', 'Lebanese', 'British', 'American', 'French', 'Indian', 'Sudanese'];
const NATIONALITIES_AR = { Egyptian: 'مصري', Saudi: 'سعودي', Emirati: 'إماراتي', Jordanian: 'أردني', Lebanese: 'لبناني', British: 'بريطاني', American: 'أمريكي', French: 'فرنسي', Indian: 'هندي', Sudanese: 'سوداني' };

/* ------------------------------------------------------------------ */
/* 1. Permissions & roles                                              */
/* ------------------------------------------------------------------ */
export function seedPermissions() {
  const catalogue = buildPermissionCatalogue();
  for (const p of catalogue) {
    const existing = get(`SELECT id FROM permissions WHERE code = ?`, [p.code]);
    if (!existing)
      insertRow('permissions', {
        code: p.code,
        module: p.module,
        action: p.action,
        name_en: p.nameEn,
        name_ar: p.nameAr,
      });
  }
  return catalogue;
}

const ROLE_DEFS = [
  { code: 'super_admin', name_en: 'Super Administrator', name_ar: 'مدير النظام العام', level: 100, is_system: 1 },
  { code: 'school_admin', name_en: 'School Administrator', name_ar: 'مدير المدرسة', level: 90, is_system: 1 },
  { code: 'vice_principal', name_en: 'Vice Principal', name_ar: 'وكيل المدرسة', level: 80, is_system: 1 },
  { code: 'accountant', name_en: 'Accountant', name_ar: 'المحاسب', level: 70, is_system: 1 },
  { code: 'registrar', name_en: 'Registrar', name_ar: 'مسجل الطلاب', level: 60, is_system: 1 },
  { code: 'teacher', name_en: 'Teacher', name_ar: 'معلم', level: 50, is_system: 1 },
  { code: 'librarian', name_en: 'Librarian', name_ar: 'أمين المكتبة', level: 40, is_system: 1 },
  { code: 'receptionist', name_en: 'Receptionist', name_ar: 'موظف الاستقبال', level: 30, is_system: 1 },
  { code: 'nurse', name_en: 'School Nurse', name_ar: 'ممرض المدرسة', level: 30, is_system: 1 },
  { code: 'parent', name_en: 'Parent / Guardian', name_ar: 'ولي أمر', level: 10, is_system: 1 },
  { code: 'student', name_en: 'Student', name_ar: 'طالب', level: 5, is_system: 1 },
];

function rolePermissionCodes(code, allCodes) {
  const mods = (prefixes) => allCodes.filter((c) => prefixes.some((p) => c.startsWith(p)));
  switch (code) {
    case 'super_admin':
      return allCodes;
    case 'school_admin':
      return allCodes.filter((c) => !c.startsWith('users.') && !c.startsWith('backup.'));
    case 'vice_principal':
      return mods(['students.', 'staff.', 'sections.', 'attendance_records.', 'assessments.', 'grades.', 'report_cards.', 'timetable_slots.', 'discipline_records.', 'activities.', 'events.', 'certificates.']).concat([
        'reports.view', 'reports.financial', 'dashboard.executive', 'attendance.mark', 'grades.enter',
      ]);
    case 'accountant':
      return mods(['invoices.', 'payments.', 'invoice_lines.', 'fee_', 'discounts.', 'scholarships.', 'payment_', 'installments.', 'accounts.', 'journal_', 'fiscal_', 'vendors.', 'customers.', 'purchase_orders.', 'expenses.', 'budgets.', 'bank_accounts.', 'fixed_assets.', 'inventory_', 'exchange_rates.', 'currencies.']).concat([
        'reports.view', 'reports.financial', 'erp.post', 'fees.collect', 'dashboard.executive',
      ]);
    case 'registrar':
      return mods(['students.', 'guardians.', 'student_guardians.', 'sections.', 'grade_levels.', 'academic_years.', 'terms.', 'attendance_records.', 'student_transport.']).concat(['reports.view', 'attendance.mark']);
    case 'teacher':
      return mods(['students.', 'assessments.', 'grades.', 'report_cards.', 'assignments.', 'assignment_submissions.', 'attendance_records.', 'timetable_slots.', 'courses.', 'course_modules.', 'course_lessons.', 'live_sessions.', 'quizzes.', 'quiz_attempts.', 'discipline_records.', 'health_records.', 'activities.']).concat([
        'attendance.mark', 'grades.enter', 'reports.view',
      ]);
    case 'librarian':
      return mods(['books.', 'book_copies.', 'library_members.', 'book_loans.']).concat(['reports.view']);
    case 'receptionist':
      return mods(['students.', 'guardians.', 'visitors.', 'bookings.', 'announcements.', 'notifications.']).concat(['reports.view']);
    case 'nurse':
      return mods(['health_records.', 'students.']).concat(['reports.view']);
    case 'parent':
      return ['students.read', 'invoices.read', 'payments.read', 'attendance_records.read', 'report_cards.read', 'assignments.read', 'events.read', 'announcements.read', 'notifications.read'];
    case 'student':
      return ['assignments.read', 'courses.read', 'course_lessons.read', 'videos.read', 'events.read', 'announcements.read', 'notifications.read', 'report_cards.read'];
    default:
      return [];
  }
}

export function seedRoles() {
  const allCodes = all(`SELECT code FROM permissions`).map((r) => r.code);
  for (const def of ROLE_DEFS) {
    let role = get(`SELECT * FROM roles WHERE code = ?`, [def.code]);
    if (!role) {
      const id = insertRow('roles', { ...def, description_en: def.name_en, description_ar: def.name_ar });
      role = get(`SELECT * FROM roles WHERE id = ?`, [id]);
    }
    const codes = rolePermissionCodes(def.code, allCodes);
    for (const code of codes) {
      const p = get(`SELECT id FROM permissions WHERE code = ?`, [code]);
      if (p) run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)`, [role.id, p.id]);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. Currencies & settings                                            */
/* ------------------------------------------------------------------ */
export function seedCurrencies() {
  const rows = [
    ['USD', 'US Dollar', 'دولار أمريكي', '$', 2, 1],
    ['EGP', 'Egyptian Pound', 'جنيه مصري', 'E£', 2, 0],
    ['SAR', 'Saudi Riyal', 'ريال سعودي', '﷼', 2, 0],
    ['AED', 'UAE Dirham', 'درهم إماراتي', 'د.إ', 2, 0],
    ['GBP', 'British Pound', 'جنيه إسترليني', '£', 2, 0],
    ['EUR', 'Euro', 'يورو', '€', 2, 0],
    ['KWD', 'Kuwaiti Dinar', 'دينار كويتي', 'د.ك', 3, 0],
  ];
  rows.forEach(([code, en, ar, symbol, decimals, base], i) => {
    if (!get(`SELECT id FROM currencies WHERE code = ?`, [code])) {
      insertRow('currencies', { code, name_en: en, name_ar: ar, symbol, decimals, is_base: base, is_active: 1, sort_order: i });
    }
  });
  const today = todayIso();
  const rates = [
    ['USD', 'EGP', 48.5],
    ['USD', 'SAR', 3.75],
    ['USD', 'AED', 3.6725],
    ['USD', 'GBP', 0.79],
    ['USD', 'EUR', 0.92],
    ['USD', 'KWD', 0.307],
  ];
  if (!get(`SELECT id FROM exchange_rates LIMIT 1`)) {
    for (const [base, quote, rate] of rates) {
      insertRow('exchange_rates', { base_code: base, quote_code: quote, rate, effective_date: today, source: 'Seed' });
    }
  }
}

export function seedSettings() {
  if (getSetting('app', 'seeded')) return false;
  setSetting('app', 'school', {
    name_en: 'EduSphere International School',
    name_ar: 'مدرسة إديو سفير الدولية',
    motto_en: 'Where curiosity becomes excellence',
    motto_ar: 'حيث يتحول الفضول إلى تميّز',
    address: '12 Knowledge Avenue, New Cairo, Egypt',
    city: 'Cairo',
    country: 'Egypt',
    phone: '+20 2 1234 5678',
    email: 'info@edusphere.school',
    website: 'https://edusphere.school',
    principal_en: 'Dr. Sarah Whitfield',
    principal_ar: 'د. سارة ويتفيلد',
  });
  setSetting('app', 'branding', { primary: '#4f7cff', accent: '#12b981', logo: '', radius: 'lg' });
  setSetting('app', 'finance', { base_currency: 'USD', tax_rate: 0, late_fee_percent: 0, invoice_due_days: 30, fiscal_year_start_month: 9 });
  setSetting('app', 'academic', {
    pass_mark: 50,
    grade_scale: [
      { min: 90, letter: 'A', label_en: 'Excellent', label_ar: 'ممتاز' },
      { min: 80, letter: 'B', label_en: 'Very good', label_ar: 'جيد جداً' },
      { min: 70, letter: 'C', label_en: 'Good', label_ar: 'جيد' },
      { min: 60, letter: 'D', label_en: 'Satisfactory', label_ar: 'مقبول' },
      { min: 50, letter: 'E', label_en: 'Pass', label_ar: 'ضعيف' },
      { min: 0, letter: 'F', label_en: 'Fail', label_ar: 'راسب' },
    ],
  });
  setSetting('app', 'numbering', {
    invoice: 'INV', receipt: 'RCT', journal: 'JE', purchase: 'PO', expense: 'EXP',
    booking: 'BKG', student: 'STU', staff: 'EMP', voucher: 'VCH',
  });
  setSetting('app', 'backup', { folder: '', auto: false, frequency: 'daily', include_files: true, keep: 20 });
  setSetting('app', 'notifications', { fee_reminders: true, attendance_alerts: true, low_balance_alerts: true });
  setSetting('app', 'locale', { default: 'ar', default_theme: 'system', date_format: 'dd/MM/yyyy', week_start: 0 });
  setSetting('app', 'seeded', nowIso());
  return true;
}

/* ------------------------------------------------------------------ */
/* 3. Branches, academic structure                                     */
/* ------------------------------------------------------------------ */
export function seedStructure() {
  const existing = get(`SELECT COUNT(*) AS c FROM branches`)?.c || 0;
  if (existing) return;

  const mainId = insertRow('branches', {
    code: 'BR-MAIN', name_en: 'Main Campus', name_ar: 'المقر الرئيسي', type: 'main',
    address: '12 Knowledge Avenue', city: 'New Cairo', country: 'Egypt', phone: '+20 2 1234 5678',
    email: 'main@edusphere.school', principal_name: 'Dr. Sarah Whitfield', currency_code: 'USD',
    capacity: 1200, opened_date: '2012-09-01', is_active: 1,
  });
  const northId = insertRow('branches', {
    code: 'BR-NORTH', name_en: 'North Campus', name_ar: 'فرع الشمال', type: 'branch',
    address: '45 Palm District', city: 'Sheikh Zayed', country: 'Egypt', phone: '+20 2 8765 4321',
    email: 'north@edusphere.school', principal_name: 'Mr. Daniel Reed', currency_code: 'USD',
    capacity: 600, opened_date: '2018-09-01', is_active: 1,
  });

  const yearId = insertRow('academic_years', {
    code: 'AY-2025-26', name_en: 'Academic Year 2025–2026', name_ar: 'العام الدراسي 2025–2026',
    start_date: '2025-09-01', end_date: '2026-06-30', branch_id: null, is_current: 1, status: 'active',
  });
  insertRow('academic_years', {
    code: 'AY-2026-27', name_en: 'Academic Year 2026–2027', name_ar: 'العام الدراسي 2026–2027',
    start_date: '2026-09-01', end_date: '2027-06-30', is_current: 0, status: 'planned',
  });

  const terms = [
    ['T1', 'Term 1', 'الفصل الأول', '2025-09-01', '2025-12-19', 1],
    ['T2', 'Term 2', 'الفصل الثاني', '2026-01-05', '2026-03-26', 0],
    ['T3', 'Term 3', 'الفصل الثالث', '2026-04-05', '2026-06-30', 0],
  ].map(([code, en, ar, s, e, cur], i) =>
    insertRow('terms', { academic_year_id: yearId, code, name_en: en, name_ar: ar, start_date: s, end_date: e, is_current: cur, weight: 1, sort_order: i + 1, status: 'active' }),
  );

  const gradeNames = [
    ['KG1', 'KG 1', 'تمهيدي ١', 'kindergarten', 1],
    ['KG2', 'KG 2', 'تمهيدي ٢', 'kindergarten', 2],
    ['G1', 'Grade 1', 'الصف الأول', 'primary', 3],
    ['G2', 'Grade 2', 'الصف الثاني', 'primary', 4],
    ['G3', 'Grade 3', 'الصف الثالث', 'primary', 5],
    ['G4', 'Grade 4', 'الصف الرابع', 'primary', 6],
    ['G5', 'Grade 5', 'الصف الخامس', 'primary', 7],
    ['G6', 'Grade 6', 'الصف السادس', 'primary', 8],
    ['G7', 'Grade 7', 'الصف السابع', 'middle', 9],
    ['G8', 'Grade 8', 'الصف الثامن', 'middle', 10],
    ['G9', 'Grade 9', 'الصف التاسع', 'middle', 11],
    ['G10', 'Grade 10', 'الصف العاشر', 'high', 12],
    ['G11', 'Grade 11', 'الصف الحادي عشر', 'high', 13],
    ['G12', 'Grade 12', 'الصف الثاني عشر', 'high', 14],
  ];
  const gradeIds = gradeNames.map(([code, en, ar, stage, sort]) =>
    insertRow('grade_levels', { code, name_en: en, name_ar: ar, stage, sort_order: sort, capacity: 90, age_from: sort + 2, age_to: sort + 3, is_active: 1 }),
  );

  const deptDefs = [
    ['DEP-AR', 'Arabic & Islamic Studies', 'اللغة العربية والدراسات الإسلامية'],
    ['DEP-EN', 'English Language', 'اللغة الإنجليزية'],
    ['DEP-MA', 'Mathematics', 'الرياضيات'],
    ['DEP-SC', 'Science', 'العلوم'],
    ['DEP-IT', 'Information Technology', 'تقنية المعلومات'],
    ['DEP-ART', 'Arts & Design', 'الفنون والتصميم'],
    ['DEP-PE', 'Physical Education', 'التربية الرياضية'],
    ['DEP-ADM', 'Administration', 'الإدارة'],
    ['DEP-FIN', 'Finance', 'المالية'],
    ['DEP-OPS', 'Operations', 'التشغيل'],
  ];
  const deptIds = deptDefs.map(([code, en, ar]) => insertRow('departments', { code, name_en: en, name_ar: ar, branch_id: mainId, is_active: 1 }));

  const posDefs = [
    ['Principal', 'مدير', deptIds[7], 9000, 15000],
    ['Vice Principal', 'وكيل', deptIds[7], 7000, 11000],
    ['Teacher', 'معلم', deptIds[0], 2500, 6000],
    ['Senior Teacher', 'معلم أول', deptIds[1], 4000, 7500],
    ['Accountant', 'محاسب', deptIds[8], 3000, 6000],
    ['Registrar', 'مسجل طلاب', deptIds[7], 2200, 4000],
    ['Librarian', 'أمين مكتبة', deptIds[7], 2000, 3500],
    ['Receptionist', 'موظف استقبال', deptIds[7], 1500, 2500],
    ['School Nurse', 'ممرض', deptIds[9], 2000, 3500],
    ['Bus Driver', 'سائق حافلة', deptIds[9], 1200, 2200],
    ['IT Support', 'دعم تقني', deptIds[4], 2500, 4500],
  ];
  const posIds = posDefs.map(([en, ar, dept, min, max]) =>
    insertRow('positions', { code: `POS-${en.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`, name_en: en, name_ar: ar, department_id: dept, min_salary: min, max_salary: max, is_active: 1 }),
  );

  const rooms = [
    ['R-101', 'Room 101', 'قاعة ١٠١', 'classroom', 30],
    ['R-102', 'Room 102', 'قاعة ١٠٢', 'classroom', 30],
    ['R-103', 'Room 103', 'قاعة ١٠٣', 'classroom', 30],
    ['R-201', 'Room 201', 'قاعة ٢٠١', 'classroom', 28],
    ['R-202', 'Room 202', 'قاعة ٢٠٢', 'classroom', 28],
    ['LAB-SC', 'Science Lab', 'مختبر العلوم', 'lab', 24],
    ['LAB-IT', 'Computer Lab', 'مختبر الحاسب', 'lab', 26],
    ['HALL-MAIN', 'Grand Hall', 'القاعة الكبرى', 'hall', 400],
    ['LIB-1', 'Library', 'المكتبة', 'library', 80],
    ['SPORT-1', 'Sports Hall', 'الصالة الرياضية', 'sports', 200],
  ];
  const roomIds = rooms.map(([code, en, ar, type, cap]) =>
    insertRow('classrooms', { code, name_en: en, name_ar: ar, type, capacity: cap, branch_id: mainId, building: 'Main', floor: code.includes('2') ? '2' : '1', is_active: 1 }),
  );

  const subjectDefs = [
    ['SUB-AR', 'Arabic', 'اللغة العربية', 'language', '#e11d48', 'ar'],
    ['SUB-IS', 'Islamic Studies', 'التربية الإسلامية', 'core', '#0ea5e9', 'ar'],
    ['SUB-EN', 'English', 'اللغة الإنجليزية', 'language', '#4f7cff', 'en'],
    ['SUB-MA', 'Mathematics', 'الرياضيات', 'core', '#f59e0b', 'en'],
    ['SUB-SC', 'Science', 'العلوم', 'core', '#12b981', 'en'],
    ['SUB-PH', 'Physics', 'الفيزياء', 'core', '#8b5cf6', 'en'],
    ['SUB-CH', 'Chemistry', 'الكيمياء', 'core', '#06b6d4', 'en'],
    ['SUB-BI', 'Biology', 'الأحياء', 'core', '#22c55e', 'en'],
    ['SUB-ICT', 'ICT', 'تقنية المعلومات', 'technology', '#6366f1', 'en'],
    ['SUB-ART', 'Art & Design', 'الفنون والتصميم', 'arts', '#ec4899', 'en'],
    ['SUB-PE', 'Physical Education', 'التربية الرياضية', 'sports', '#f97316', 'en'],
    ['SUB-SS', 'Social Studies', 'الدراسات الاجتماعية', 'core', '#14b8a6', 'en'],
    ['SUB-FR', 'French', 'اللغة الفرنسية', 'language', '#a855f7', 'en'],
    ['SUB-MU', 'Music', 'الموسيقى', 'arts', '#eab308', 'en'],
  ];
  const subjectIds = subjectDefs.map(([code, en, ar, cat, color, lang]) =>
    insertRow('subjects', { code, name_en: en, name_ar: ar, category: cat, color, language: lang, credit_hours: 1, is_active: 1 }),
  );

  const sections = [];
  for (let gi = 0; gi < gradeIds.length; gi += 1) {
    for (const suffix of ['A', 'B']) {
      sections.push(
        insertRow('sections', {
          code: `${gradeNames[gi][0]}-${suffix}`,
          name_en: `${gradeNames[gi][1]} — ${suffix}`,
          name_ar: `${gradeNames[gi][2]} — ${suffix}`,
          grade_level_id: gradeIds[gi],
          academic_year_id: yearId,
          branch_id: mainId,
          room_id: roomIds[(gi + (suffix === 'B' ? 1 : 0)) % 5],
          capacity: 28,
          shift: 'morning',
          is_active: 1,
        }),
      );
    }
  }

  // Curricula for core subjects across grades
  for (const gi of [2, 6, 9, 11]) {
    for (const si of [2, 3, 4]) {
      insertRow('curricula', {
        code: `CUR-${gradeNames[gi][0]}-${subjectDefs[si][0]}`,
        name_en: `${subjectDefs[si][1]} — ${gradeNames[gi][1]}`,
        name_ar: `${subjectDefs[si][2]} — ${gradeNames[gi][2]}`,
        subject_id: subjectIds[si],
        grade_level_id: gradeIds[gi],
        framework: 'british',
        version: '1.0',
        is_active: 1,
      });
    }
  }

  // Timetable for first 4 sections
  const periods = [
    ['08:00', '08:45'], ['08:50', '09:35'], ['09:45', '10:30'], ['10:35', '11:20'],
    ['11:50', '12:35'], ['12:40', '13:25'], ['13:30', '14:15'],
  ];
  for (const sectionId of sections.slice(0, 6)) {
    for (let day = 0; day <= 4; day += 1) {
      for (let p = 0; p < 6; p += 1) {
        const subjIdx = (day * 6 + p) % 8;
        insertRow('timetable_slots', {
          section_id: sectionId,
          subject_id: subjectIds[subjIdx],
          teacher_id: null,
          room_id: roomIds[p % 5],
          term_id: terms[0],
          academic_year_id: yearId,
          branch_id: mainId,
          day_of_week: day,
          period: p + 1,
          start_time: periods[p][0],
          end_time: periods[p][1],
        });
      }
    }
  }

  return { mainId, northId, yearId, termId: terms[0], terms, gradeIds, gradeNames, deptIds, posIds, roomIds, subjectIds, subjectDefs, sections };
}

/* ------------------------------------------------------------------ */
/* 4. People                                                           */
/* ------------------------------------------------------------------ */
export function seedPeople(ctx) {
  if (get(`SELECT COUNT(*) AS c FROM students`)?.c) return;
  const { mainId, yearId, gradeIds, gradeNames, deptIds, posIds, sections, subjectIds } = ctx;

  const staffDefs = [
    ['Dr. Sarah Whitfield', 'د. سارة ويتفيلد', 'female', posIds[0], deptIds[7], 'Principal', 14000, 0],
    ['Daniel Reed', 'دانيال ريد', 'male', posIds[1], deptIds[7], 'Vice Principal', 9500, 0],
    ['Omar Khalil', 'عمر خليل', 'male', posIds[3], deptIds[2], 'Mathematics', 5200, 1],
    ['Mariam Adel', 'مريم عادل', 'female', posIds[3], deptIds[1], 'English', 4800, 1],
    ['Hassan Nasser', 'حسن ناصر', 'male', posIds[2], deptIds[3], 'Physics', 4200, 1],
    ['Layla Fahmy', 'ليلى فهمي', 'female', posIds[2], deptIds[0], 'Arabic', 4000, 1],
    ['Karim Mostafa', 'كريم مصطفى', 'male', posIds[2], deptIds[4], 'ICT', 4300, 1],
    ['Nour Ibrahim', 'نور إبراهيم', 'female', posIds[2], deptIds[3], 'Chemistry', 4100, 1],
    ['Tarek Shawky', 'طارق شوقي', 'male', posIds[2], deptIds[5], 'Art & Design', 3600, 1],
    ['Salma Hassan', 'سلمى حسن', 'female', posIds[2], deptIds[6], 'Physical Education', 3500, 1],
    ['Ahmed Sayed', 'أحمد سيد', 'male', posIds[4], deptIds[8], 'Accountant', 4500, 0],
    ['Hana Mahmoud', 'هنا محمود', 'female', posIds[5], deptIds[7], 'Registrar', 3200, 0],
    ['Yousef Ali', 'يوسف علي', 'male', posIds[6], deptIds[7], 'Librarian', 3000, 0],
    ['Dina Farouk', 'دينا فاروق', 'female', posIds[7], deptIds[7], 'Receptionist', 2400, 0],
    ['Rania Samir', 'رانيا سمير', 'female', posIds[8], deptIds[9], 'Nurse', 2900, 0],
    ['Mohamed Adel', 'محمد عادل', 'male', posIds[10], deptIds[4], 'IT', 3800, 0],
    ['Aya Gamal', 'آية جمال', 'female', posIds[2], deptIds[1], 'English', 3900, 1],
    ['Ziad Hany', 'زياد هاني', 'male', posIds[2], deptIds[2], 'Mathematics', 4000, 1],
    ['Farida Osman', 'فريدة عثمان', 'female', posIds[2], deptIds[0], 'Arabic', 3700, 1],
    ['Bassem Youssef', 'باسم يوسف', 'male', posIds[2], deptIds[3], 'Biology', 4200, 1],
  ];

  const staffIds = staffDefs.map(([en, ar, gender, posId, deptId, spec, salary, isTeacher], i) => {
    const [firstEn, ...restEn] = en.split(' ');
    const [firstAr, ...restAr] = ar.split(' ');
    return insertRow('staff', {
      code: `EMP-${pad(i + 1)}`,
      first_name_en: firstEn, last_name_en: restEn.join(' '),
      first_name_ar: firstAr, last_name_ar: restAr.join(' '),
      gender, nationality: 'Egyptian', marital_status: 'married',
      email: `${firstEn.toLowerCase().replace(/[^a-z]/g, '')}.${(restEn[0] || 'x').toLowerCase().replace(/[^a-z]/g, '')}@edusphere.school`,
      mobile: `+2010${randInt(10000000, 99999999)}`,
      branch_id: mainId, department_id: deptId, position_id: posId,
      employment_type: 'full-time', hire_date: `20${randInt(15, 23)}-09-01`,
      status: 'active', basic_salary: salary, allowances: Math.round(salary * 0.15),
      currency_code: 'USD', qualification: 'B.Ed / PGCE', specialization: spec,
      experience_years: randInt(2, 18), is_teacher: isTeacher, contract_no: `CT-${pad(i + 1)}`,
    });
  });

  const teacherIds = staffIds.filter((_, i) => staffDefs[i][7] === 1);
  // assign homeroom teachers + timetable teachers
  sections.forEach((sectionId, i) => {
    run(`UPDATE sections SET homeroom_teacher_id = ? WHERE id = ?`, [teacherIds[i % teacherIds.length], sectionId]);
  });
  const slots = all(`SELECT id, subject_id FROM timetable_slots`);
  for (const slot of slots) {
    const teacher = teacherIds[(slot.subject_id + slot.id) % teacherIds.length];
    run(`UPDATE timetable_slots SET teacher_id = ? WHERE id = ?`, [teacher, slot.id]);
  }

  // Students
  const statuses = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'pending', 'graduated'];
  let studentNo = 0;
  const studentIds = [];
  for (const sectionId of sections) {
    const gradeIdx = sections.indexOf(sectionId) < 0 ? 0 : Math.floor(sections.indexOf(sectionId) / 2);
    const count = randInt(6, 10);
    for (let i = 0; i < count; i += 1) {
      studentNo += 1;
      const gender = rand() > 0.5 ? 'male' : 'female';
      const fIdx = randInt(0, FIRST_EN.length - 1);
      const lIdx = randInt(0, LAST_EN.length - 1);
      const nationality = pick(NATIONALITIES);
      const status = pick(statuses);
      const dob = new Date(2026 - (gradeNames[gradeIdx]?.[4] ? gradeNames[gradeIdx][4] + 4 : 10), randInt(0, 11), randInt(1, 28));
      const guardianFirst = gender === 'male' ? pick(['Ahmed', 'Mahmoud', 'Khaled', 'Samir']) : pick(['Fatma', 'Mona', 'Heba', 'Rania']);
      const id = insertRow('students', {
        code: `STU-${pad(studentNo)}`,
        admission_no: `ADM-${2025}${pad(studentNo, 4)}`,
        first_name_en: FIRST_EN[fIdx], last_name_en: LAST_EN[lIdx],
        first_name_ar: FIRST_AR[fIdx], last_name_ar: LAST_AR[lIdx],
        gender, dob: iso(dob), nationality,
        religion: rand() > 0.2 ? 'Muslim' : 'Christian',
        blood_group: pick(['A+', 'O+', 'B+', 'AB+', 'A-', 'O-']),
        email: `student${studentNo}@edusphere.school`,
        mobile: `+2011${randInt(10000000, 99999999)}`,
        address: `${randInt(1, 90)} ${pick(['Nile', 'Palm', 'Garden', 'Sunrise'])} Street`,
        city: 'New Cairo', country: 'Egypt',
        branch_id: mainId, grade_level_id: gradeIds[gradeIdx], section_id: sectionId,
        academic_year_id: yearId,
        status,
        enrollment_date: `2025-09-0${randInt(1, 9)}`,
        guardian_name: `${guardianFirst} ${LAST_EN[lIdx]}`,
        guardian_phone: `+2012${randInt(10000000, 99999999)}`,
        guardian_email: `parent${studentNo}@example.com`,
        transport_required: rand() > 0.65 ? 1 : 0,
      });
      studentIds.push(id);
    }
  }
  for (const sectionId of sections) {
    const c = get(`SELECT COUNT(*) AS c FROM students WHERE section_id = ?`, [sectionId])?.c || 0;
    run(`UPDATE sections SET students_count = ? WHERE id = ?`, [c, sectionId]);
  }

  // Guardians (one per student)
  studentIds.forEach((studentId, idx) => {
    const s = get(`SELECT * FROM students WHERE id = ?`, [studentId]);
    const gid = insertRow('guardians', {
      code: `GRD-${pad(idx + 1)}`,
      first_name_en: s.guardian_name.split(' ')[0],
      last_name_en: s.guardian_name.split(' ').slice(1).join(' ') || s.last_name_en,
      first_name_ar: pick(['أحمد', 'محمود', 'خالد', 'سمير', 'فاطمة', 'منى', 'هبة', 'رانيا']),
      last_name_ar: s.last_name_ar,
      relation: pick(['father', 'mother', 'guardian']),
      email: s.guardian_email, mobile: s.guardian_phone, whatsapp: s.guardian_phone,
      occupation: pick(['Engineer', 'Doctor', 'Business owner', 'Teacher', 'Accountant']),
      city: 'New Cairo', country: 'Egypt', is_primary: 1,
    });
    insertRow('student_guardians', { student_id: studentId, guardian_id: gid, relation: 'father', is_primary: 1, can_pickup: 1, financial_responsible: 1 });
  });

  // Staff attendance today
  const today = todayIso();
  staffIds.forEach((staffId, i) => {
    insertRow('staff_attendance', {
      staff_id: staffId, date: today,
      check_in: `0${randInt(7, 8)}:${pad(randInt(0, 55), 2)}`,
      check_out: `1${randInt(4, 6)}:${pad(randInt(0, 55), 2)}`,
      status: i % 11 === 0 ? 'late' : 'present', hours_worked: 8, branch_id: mainId,
    });
  });

  return { studentIds, staffIds, teacherIds, today };
}

/* ------------------------------------------------------------------ */
/* 5. Attendance, assessments & grades                                 */
/* ------------------------------------------------------------------ */
export function seedAcademicsData(ctx, people) {
  if (get(`SELECT COUNT(*) AS c FROM attendance_records`)?.c) return;
  const { sections, subjectIds, terms } = ctx;
  const { studentIds } = people;
  const today = new Date();

  for (let d = 1; d <= 12; d += 1) {
    const date = iso(addDays(today, -d));
    if ([5, 6].includes(addDays(today, -d).getDay())) continue;
    for (const studentId of studentIds) {
      const r = rand();
      const status = r > 0.94 ? 'absent' : r > 0.88 ? 'late' : r > 0.86 ? 'excused' : 'present';
      const s = get(`SELECT section_id, branch_id FROM students WHERE id = ?`, [studentId]);
      insertRow('attendance_records', {
        student_id: studentId, section_id: s.section_id, date,
        status, minutes_late: status === 'late' ? randInt(5, 25) : 0,
        recorded_by: 1, branch_id: s.branch_id,
      });
    }
  }
  // today's register
  for (const studentId of studentIds) {
    const s = get(`SELECT section_id, branch_id FROM students WHERE id = ?`, [studentId]);
    insertRow('attendance_records', {
      student_id: studentId, section_id: s.section_id, date: todayIso(),
      status: rand() > 0.92 ? 'absent' : 'present', recorded_by: 1, branch_id: s.branch_id,
    });
  }

  // Assessments + grades for 6 sections
  const assessmentTypes = [
    ['Quiz 1', 'اختبار قصير ١', 'quiz', 20, 1],
    ['Homework', 'الواجب المنزلي', 'homework', 10, 1],
    ['Midterm', 'اختبار نصف الفصل', 'midterm', 30, 2],
    ['Final Exam', 'الاختبار النهائي', 'final', 40, 3],
  ];
  let assessmentNo = 0;
  for (const sectionId of sections.slice(0, 8)) {
    for (const subjectId of subjectIds.slice(0, 6)) {
      for (const [en, ar, type, maxScore, weight] of assessmentTypes) {
        assessmentNo += 1;
        const aid = insertRow('assessments', {
          code: `ASM-${pad(assessmentNo)}`,
          name_en: `${en} — ${get(`SELECT name_en FROM subjects WHERE id = ?`, [subjectId])?.name_en}`,
          name_ar: `${ar} — ${get(`SELECT name_ar FROM subjects WHERE id = ?`, [subjectId])?.name_ar}`,
          subject_id: subjectId, section_id: sectionId, term_id: terms[0],
          type, max_score: maxScore, weight, assessment_date: iso(addDays(today, -randInt(2, 40))),
          status: 'published',
        });
        const studentsInSection = all(`SELECT id FROM students WHERE section_id = ?`, [sectionId]);
        for (const st of studentsInSection) {
          const pct = 0.45 + rand() * 0.55;
          const score = round2(maxScore * pct);
          insertRow('grades', {
            assessment_id: aid, student_id: st.id, score,
            grade_letter: pct >= 0.9 ? 'A' : pct >= 0.8 ? 'B' : pct >= 0.7 ? 'C' : pct >= 0.6 ? 'D' : pct >= 0.5 ? 'E' : 'F',
            graded_by: 1, graded_at: nowIso(),
          });
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6. Chart of accounts & opening entries                              */
/* ------------------------------------------------------------------ */
const COA = [
  ['1000', 'Assets', 'الأصول', 'asset', null, 1],
  ['1100', 'Current Assets', 'الأصول المتداولة', 'asset', '1000', 1],
  ['1110', 'Cash on Hand', 'النقدية بالصندوق', 'asset', '1100', 0, 'cash'],
  ['1120', 'Bank — Main Account', 'البنك — الحساب الرئيسي', 'asset', '1100', 0, 'bank'],
  ['1130', 'Accounts Receivable — Students', 'مديونية الطلاب', 'asset', '1100', 0, 'receivable'],
  ['1140', 'Prepaid Expenses', 'مصروفات مدفوعة مقدماً', 'asset', '1100', 0],
  ['1150', 'Inventory — Supplies', 'المخزون — مستلزمات', 'asset', '1100', 0],
  ['1200', 'Non-current Assets', 'الأصول غير المتداولة', 'asset', '1000', 1],
  ['1210', 'Buildings', 'المباني', 'asset', '1200', 0, 'fixed-asset'],
  ['1220', 'Furniture & Fixtures', 'الأثاث والتجهيزات', 'asset', '1200', 0, 'fixed-asset'],
  ['1230', 'IT Equipment', 'أجهزة تقنية', 'asset', '1200', 0, 'fixed-asset'],
  ['1240', 'Vehicles', 'المركبات', 'asset', '1200', 0, 'fixed-asset'],
  ['1250', 'Accumulated Depreciation', 'مجمع الإهلاك', 'asset', '1200', 0, 'fixed-asset'],
  ['2000', 'Liabilities', 'الالتزامات', 'liability', null, 1],
  ['2100', 'Current Liabilities', 'الالتزامات المتداولة', 'liability', '2000', 1],
  ['2110', 'Accounts Payable — Vendors', 'دائنون — موردون', 'liability', '2100', 0, 'payable'],
  ['2120', 'Accrued Salaries', 'رواتب مستحقة', 'liability', '2100', 0],
  ['2130', 'Deferred Revenue — Fees', 'إيرادات مؤجلة — رسوم', 'liability', '2100', 0],
  ['2140', 'VAT Payable', 'ضريبة القيمة المضافة المستحقة', 'liability', '2100', 0],
  ['2200', 'Non-current Liabilities', 'الالتزامات غير المتداولة', 'liability', '2000', 1],
  ['2210', 'Long-term Loans', 'قروض طويلة الأجل', 'liability', '2200', 0],
  ['3000', 'Equity', 'حقوق الملكية', 'equity', null, 1],
  ['3100', 'Share Capital', 'رأس المال', 'equity', '3000', 0, 'capital'],
  ['3200', 'Retained Earnings', 'الأرباح المحتجزة', 'equity', '3000', 0, 'retained'],
  ['3300', 'Current Year Earnings', 'أرباح العام الحالي', 'equity', '3000', 0],
  ['4000', 'Revenue', 'الإيرادات', 'revenue', null, 1],
  ['4100', 'Tuition Revenue', 'إيرادات الرسوم الدراسية', 'revenue', '4000', 0, 'operating-revenue'],
  ['4110', 'Registration Fees', 'رسوم التسجيل', 'revenue', '4000', 0, 'operating-revenue'],
  ['4120', 'Transport Revenue', 'إيرادات المواصلات', 'revenue', '4000', 0, 'operating-revenue'],
  ['4130', 'Activities Revenue', 'إيرادات الأنشطة', 'revenue', '4000', 0, 'operating-revenue'],
  ['4140', 'Books & Uniform Sales', 'مبيعات الكتب والزي', 'revenue', '4000', 0, 'other-revenue'],
  ['4150', 'Other Revenue', 'إيرادات أخرى', 'revenue', '4000', 0, 'other-revenue'],
  ['4900', 'Discounts & Scholarships', 'الخصومات والمنح', 'revenue', '4000', 0, 'operating-revenue'],
  ['5000', 'Expenses', 'المصروفات', 'expense', null, 1],
  ['5100', 'Salaries & Wages', 'الرواتب والأجور', 'expense', '5000', 0, 'operating-expense'],
  ['5110', 'Staff Benefits & Social Insurance', 'مزايا الموظفين والتأمينات', 'expense', '5000', 0, 'operating-expense'],
  ['5200', 'Rent & Facilities', 'الإيجار والمرافق', 'expense', '5000', 0, 'operating-expense'],
  ['5210', 'Utilities', 'المرافق والخدمات', 'expense', '5000', 0, 'operating-expense'],
  ['5220', 'Repairs & Maintenance', 'الإصلاحات والصيانة', 'expense', '5000', 0, 'operating-expense'],
  ['5230', 'Teaching Supplies', 'المستلزمات التعليمية', 'expense', '5000', 0, 'operating-expense'],
  ['5240', 'Books & Library', 'الكتب والمكتبة', 'expense', '5000', 0, 'operating-expense'],
  ['5250', 'Transport Expenses', 'مصروفات المواصلات', 'expense', '5000', 0, 'operating-expense'],
  ['5260', 'Marketing & Admissions', 'التسويق والقبول', 'expense', '5000', 0, 'admin-expense'],
  ['5270', 'Professional Development', 'التطوير المهني', 'expense', '5000', 0, 'admin-expense'],
  ['5280', 'Insurance', 'التأمين', 'expense', '5000', 0, 'admin-expense'],
  ['5290', 'Depreciation Expense', 'مصروف الإهلاك', 'expense', '5000', 0, 'operating-expense'],
  ['5300', 'Administrative Expenses', 'مصروفات إدارية', 'expense', '5000', 0, 'admin-expense'],
  ['5900', 'Other Expenses', 'مصروفات أخرى', 'expense', '5000', 0, 'other-revenue'],
];

export function seedAccounting(ctx) {
  if (get(`SELECT COUNT(*) AS c FROM accounts`)?.c) return;
  const { mainId, yearId } = ctx;
  const codeToId = new Map();
  for (const [code, en, ar, type, parent, isGroup, subtype] of COA) {
    const id = insertRow('accounts', {
      code, name_en: en, name_ar: ar, type, subtype: subtype || null,
      parent_id: parent ? codeToId.get(parent) : null,
      level: code.length >= 4 ? (parent ? (codeToId.get(parent) ? 2 : 1) : 1) : 1,
      is_group: isGroup, currency_code: 'USD', opening_balance: 0, current_balance: 0,
      is_active: 1, branch_id: null, is_bank: subtype === 'bank' || subtype === 'cash' ? 1 : 0,
    });
    codeToId.set(code, id);
  }
  const acc = (code) => codeToId.get(code);

  const fyId = insertRow('fiscal_years', {
    code: 'FY-2025-26', name_en: 'Fiscal Year 2025–2026', name_ar: 'السنة المالية 2025–2026',
    start_date: '2025-09-01', end_date: '2026-08-31', is_current: 1, is_closed: 0,
  });
  for (let m = 0; m < 12; m += 1) {
    const start = new Date(2025, 8 + m, 1);
    const end = new Date(2025, 9 + m, 0);
    insertRow('fiscal_periods', {
      fiscal_year_id: fyId, code: `P${pad(m + 1, 2)}`,
      name_en: start.toLocaleString('en', { month: 'long', year: 'numeric' }),
      name_ar: start.toLocaleString('ar', { month: 'long', year: 'numeric' }),
      start_date: iso(start), end_date: iso(end), status: 'open',
    });
  }
  const periodId = get(`SELECT id FROM fiscal_periods ORDER BY id LIMIT 1`)?.id;

  const post = (date, descEn, descAr, lines, source = 'manual', reference = null) => {
    const totalDebit = round2(lines.reduce((s, l) => s + (l.debit || 0), 0));
    const totalCredit = round2(lines.reduce((s, l) => s + (l.credit || 0), 0));
    const entryNo = `JE-${pad(get(`SELECT COUNT(*) AS c FROM journal_entries`)?.c + 1, 5)}`;
    const jeId = insertRow('journal_entries', {
      entry_no: entryNo, fiscal_period_id: periodId, entry_date: date, reference,
      description_en: descEn, description_ar: descAr, source, status: 'posted',
      total_debit: totalDebit, total_credit: totalCredit, branch_id: mainId,
      posted_at: nowIso(), posted_by: 1,
    });
    lines.forEach((l, i) => {
      insertRow('journal_lines', {
        journal_entry_id: jeId, account_id: acc(l.code), description: l.desc || descEn,
        debit: l.debit || 0, credit: l.credit || 0, currency_code: 'USD', exchange_rate: 1,
        branch_id: mainId, sort_order: i,
      });
      const acct = get(`SELECT current_balance, type FROM accounts WHERE id = ?`, [acc(l.code)]);
      const delta = (l.debit || 0) - (l.credit || 0);
      run(`UPDATE accounts SET current_balance = ? WHERE id = ?`, [round2((acct?.current_balance || 0) + delta), acc(l.code)]);
    });
    return jeId;
  };

  // Opening balances
  post('2025-09-01', 'Opening balances', 'الأرصدة الافتتاحية', [
    { code: '1110', debit: 45000 },
    { code: '1120', debit: 380000 },
    { code: '1130', debit: 62000 },
    { code: '1210', debit: 1500000 },
    { code: '1220', debit: 220000 },
    { code: '1230', debit: 180000 },
    { code: '1240', debit: 260000 },
    { code: '1250', credit: 90000 },
    { code: '2110', credit: 42000 },
    { code: '2120', credit: 85000 },
    { code: '3100', credit: 2000000 },
    { code: '3200', credit: 535000 },
  ], 'opening');

  const months = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  months.forEach((m, i) => {
    const date = `${m}-15`;
    post(date, `Tuition revenue — ${m}`, `إيرادات الرسوم الدراسية — ${m}`, [
      { code: '1120', debit: 185000 + i * 4000 },
      { code: '4100', credit: 165000 + i * 3500 },
      { code: '4110', credit: 12000 },
      { code: '4120', credit: 8000 + i * 500 },
    ], 'invoice', `REV-${m}`);
    post(date, `Salaries — ${m}`, `الرواتب — ${m}`, [
      { code: '5100', debit: 118000 },
      { code: '5110', debit: 14000 },
      { code: '2120', credit: 132000 },
    ], 'payroll', `PAY-${m}`);
    post(date, `Operating expenses — ${m}`, `المصروفات التشغيلية — ${m}`, [
      { code: '5200', debit: 22000 },
      { code: '5210', debit: 9500 },
      { code: '5220', debit: 6200 },
      { code: '5230', debit: 7800 },
      { code: '5250', debit: 5200 },
      { code: '5300', debit: 4300 },
      { code: '1120', credit: 55000 },
    ], 'expense', `OPX-${m}`);
  });

  // Vendors, customers, expenses, assets, inventory
  const vendorIds = [
    ['V-001', 'Nile Educational Supplies', 'النيل للمستلزمات التعليمية', 'supplier'],
    ['V-002', 'Cairo Facilities Services', 'القاهرة لخدمات المرافق', 'service'],
    ['V-003', 'SmartTech Systems', 'سمارت تك سيستمز', 'supplier'],
    ['V-004', 'Green Catering Co.', 'جرين كاترينج', 'service'],
  ].map(([code, en, ar, type]) =>
    insertRow('vendors', { code, name_en: en, name_ar: ar, type, email: `${code.toLowerCase()}@vendor.com`, phone: `+202${randInt(1000000, 9999999)}`, currency_code: 'USD', is_active: 1 }),
  );

  for (let i = 0; i < 14; i += 1) {
    const month = months[i % months.length];
    insertRow('expenses', {
      expense_no: `EXP-${pad(i + 1, 5)}`,
      category_account_id: acc(pick(['5200', '5210', '5220', '5230', '5260', '5270', '5300'])),
      vendor_id: pick(vendorIds),
      expense_date: `${month}-${pad(randInt(1, 27), 2)}`,
      amount: randInt(800, 12000), currency_code: 'USD', exchange_rate: 1,
      payment_method: pick(['Bank transfer', 'Cash', 'Cheque']),
      description_en: pick(['Classroom supplies', 'Maintenance works', 'Marketing campaign', 'Staff training', 'Utilities bill']),
      description_ar: pick(['مستلزمات الفصول', 'أعمال صيانة', 'حملة تسويقية', 'تدريب الموظفين', 'فاتورة مرافق']),
      status: 'paid', branch_id: mainId, approved_by: 1,
    });
  }

  const assetDefs = [
    ['FA-001', 'Main Building', 'المبنى الرئيسي', 'buildings', 1500000, 40],
    ['FA-002', 'School Buses (5)', 'حافلات المدرسة (٥)', 'vehicles', 260000, 8],
    ['FA-003', 'Computer Lab Equipment', 'تجهيزات مختبر الحاسب', 'it', 95000, 5],
    ['FA-004', 'Classroom Furniture', 'أثاث الفصول', 'furniture', 220000, 10],
    ['FA-005', 'Science Lab Equipment', 'تجهيزات مختبر العلوم', 'labs', 85000, 7],
  ];
  for (const [code, en, ar, cat, cost, life] of assetDefs) {
    insertRow('fixed_assets', {
      code, name_en: en, name_ar: ar, category: cat, purchase_date: '2020-09-01',
      cost, salvage_value: Math.round(cost * 0.1), useful_life_years: life, depreciation_method: 'straight-line',
      accumulated_depreciation: Math.round((cost * 0.9 * 3) / life),
      book_value: Math.round(cost - (cost * 0.9 * 3) / life),
      location: 'Main Campus', branch_id: mainId, status: 'active',
    });
  }

  const invDefs = [
    ['INV-001', 'A4 Paper Reams', 'رزم ورق A4', 'stationery', 'ream', 240, 50, 4.5],
    ['INV-002', 'Whiteboard Markers', 'أقلام سبورة', 'stationery', 'box', 85, 20, 6],
    ['INV-003', 'Student Textbooks', 'كتب الطلاب', 'books', 'piece', 320, 100, 12],
    ['INV-004', 'Lab Safety Goggles', 'نظارات سلامة', 'lab', 'piece', 60, 15, 8],
  ];
  for (const [code, en, ar, cat, unit, qty, reorder, cost] of invDefs) {
    insertRow('inventory_items', { code, name_en: en, name_ar: ar, category: cat, unit, quantity: qty, reorder_level: reorder, unit_cost: cost, location: 'Main Store', branch_id: mainId, is_active: 1 });
  }

  return { acc, fyId, post };
}

/* ------------------------------------------------------------------ */
/* 7. Fees, invoices & payments                                        */
/* ------------------------------------------------------------------ */
export function seedFinance(ctx, people) {
  if (get(`SELECT COUNT(*) AS c FROM invoices`)?.c) return;
  const { mainId, yearId, termId, gradeIds } = ctx;
  const { studentIds } = people;

  const catDefs = [
    ['FEE-TUI', 'Tuition Fee', 'الرسوم الدراسية', 'tuition', 1],
    ['FEE-REG', 'Registration Fee', 'رسوم التسجيل', 'registration', 0],
    ['FEE-TRN', 'Transport Fee', 'رسوم المواصلات', 'transport', 0],
    ['FEE-ACT', 'Activities Fee', 'رسوم الأنشطة', 'activities', 1],
    ['FEE-BKS', 'Books & Materials', 'الكتب والمواد', 'books', 0],
    ['FEE-EXM', 'Exam Fee', 'رسوم الامتحانات', 'exam', 1],
  ];
  const catIds = catDefs.map(([code, en, ar, type, rec]) =>
    insertRow('fee_categories', { code, name_en: en, name_ar: ar, type, is_recurring: rec, is_active: 1 }),
  );

  const methodDefs = [
    ['CASH', 'Cash', 'نقدي', 'cash'],
    ['BANK', 'Bank Transfer', 'تحويل بنكي', 'bank'],
    ['CARD', 'Credit Card', 'بطاقة ائتمان', 'card'],
    ['CHEQUE', 'Cheque', 'شيك', 'cheque'],
    ['ONLINE', 'Online Payment', 'دفع إلكتروني', 'online'],
  ];
  const methodIds = methodDefs.map(([code, en, ar, type], i) =>
    insertRow('payment_methods', { code, name_en: en, name_ar: ar, type, is_active: 1, sort_order: i }),
  );

  const discountIds = [
    ['DISC-SIB', 'Sibling Discount', 'خصم الأخوة', 'percentage', 10],
    ['DISC-EARLY', 'Early Payment', 'خصم السداد المبكر', 'percentage', 5],
    ['DISC-STAFF', 'Staff Child', 'أبناء العاملين', 'percentage', 25],
  ].map(([code, en, ar, type, value]) =>
    insertRow('discounts', { code, name_en: en, name_ar: ar, type, value, applies_to: 'tuition', is_active: 1 }),
  );

  // Fee structures per grade
  const structures = gradeIds.map((gradeId, i) => {
    const tuition = 2500 + i * 350;
    const total = tuition + 300 + 200 + 150;
    const id = insertRow('fee_structures', {
      code: `FS-${pad(i + 1, 3)}`,
      name_en: `Grade ${i + 1} — Annual Fees`, name_ar: `الصف ${i + 1} — الرسوم السنوية`,
      academic_year_id: yearId, grade_level_id: gradeId, term_id: null, branch_id: mainId,
      currency_code: 'USD', total_amount: total, installments: 3, is_active: 1,
    });
    const items = [
      [catIds[0], 'Tuition Fee', 'الرسوم الدراسية', tuition],
      [catIds[1], 'Registration Fee', 'رسوم التسجيل', 300],
      [catIds[3], 'Activities Fee', 'رسوم الأنشطة', 200],
      [catIds[4], 'Books & Materials', 'الكتب والمواد', 150],
    ];
    items.forEach(([catId, en, ar, amount], idx) => {
      insertRow('fee_items', { fee_structure_id: id, fee_category_id: catId, name_en: en, name_ar: ar, amount, is_mandatory: 1, sort_order: idx, due_date: '2025-09-15' });
    });
    return id;
  });

  // Invoices & payments
  let invNo = 0;
  let rctNo = 0;
  const today = new Date();
  for (const studentId of studentIds) {
    const s = get(`SELECT * FROM students WHERE id = ?`, [studentId]);
    const gradeIdx = gradeIds.indexOf(s.grade_level_id);
    const fs = structures[Math.max(0, gradeIdx)];
    const fsRow = get(`SELECT * FROM fee_structures WHERE id = ?`, [fs]);
    const items = all(`SELECT * FROM fee_items WHERE fee_structure_id = ?`, [fs]);
    const subtotal = round2(items.reduce((sum, it) => sum + it.amount, 0));
    const discountPct = rand() > 0.8 ? 10 : 0;
    const discountTotal = round2((subtotal * discountPct) / 100);
    const total = round2(subtotal - discountTotal);
    const paidRatio = pick([1, 1, 0.66, 0.33, 0.33, 0]);
    const paid = round2(total * paidRatio);
    const status = paidRatio === 0 ? 'unpaid' : paidRatio === 1 ? 'paid' : 'partial';
    invNo += 1;
    const issueDate = iso(addDays(today, -randInt(20, 120)));
    const invId = insertRow('invoices', {
      invoice_no: `INV-${pad(invNo, 5)}`,
      student_id: studentId, academic_year_id: yearId, term_id: termId, branch_id: s.branch_id,
      issue_date: issueDate, due_date: iso(addDays(new Date(issueDate), 30)),
      currency_code: 'USD', exchange_rate: 1,
      subtotal, discount_total: discountTotal, tax_total: 0, total,
      paid_total: paid, balance: round2(total - paid), status,
      notes: null, created_by: 1,
    });
    items.forEach((it, idx) => {
      insertRow('invoice_lines', {
        invoice_id: invId, fee_item_id: it.id, fee_category_id: it.fee_category_id,
        description_en: it.name_en, description_ar: it.name_ar,
        quantity: 1, unit_price: it.amount, discount: round2((it.amount * discountPct) / 100),
        tax_rate: 0, line_total: round2(it.amount - (it.amount * discountPct) / 100), sort_order: idx,
      });
    });
    if (paid > 0) {
      const installments = paidRatio === 1 ? 2 : 1;
      for (let k = 0; k < installments; k += 1) {
        rctNo += 1;
        insertRow('payments', {
          receipt_no: `RCT-${pad(rctNo, 5)}`,
          invoice_id: invId, student_id: studentId, branch_id: s.branch_id,
          amount: round2(paid / installments), currency_code: 'USD', exchange_rate: 1,
          base_amount: round2(paid / installments),
          method_id: pick(methodIds), method: pick(['cash', 'bank', 'card']),
          reference_no: `REF-${randInt(100000, 999999)}`,
          payment_date: iso(addDays(new Date(issueDate), randInt(1, 25))),
          status: 'completed', received_by: 1,
        });
      }
    }
    run(`UPDATE students SET fee_structure_id = ?, discount_percent = ? WHERE id = ?`, [fs, discountPct, studentId]);
    void fsRow;
  }

  // Scholarships
  for (const studentId of studentIds.slice(0, 6)) {
    insertRow('scholarships', {
      code: `SCH-${pad(studentIds.indexOf(studentId) + 1, 4)}`, student_id: studentId,
      discount_id: discountIds[0], type: 'percentage', percentage: 15, sponsor: 'EduSphere Foundation',
      start_date: '2025-09-01', end_date: '2026-06-30', status: 'active',
    });
  }
}

/* ------------------------------------------------------------------ */
/* 8. Library, e-learning, operations, comms                          */
/* ------------------------------------------------------------------ */
export function seedExtras(ctx, people) {
  const { mainId, yearId, sections, subjectIds } = ctx;
  const { studentIds, staffIds } = people;
  if (get(`SELECT COUNT(*) AS c FROM books`)?.c) return;

  const bookDefs = [
    ['BK-001', '978-0-14-143951-8', 'Pride and Prejudice', 'كبرياء وهوى', 'Jane Austen', 'Penguin Classics', 'Fiction', 'en', 1813],
    ['BK-002', '978-0-7432-7356-5', 'To Kill a Mockingbird', 'أن تقتل طائراً بريئاً', 'Harper Lee', 'Harper Perennial', 'Fiction', 'en', 1960],
    ['BK-003', '978-9953-29-177-1', 'Arabic Language Grammar', 'قواعد اللغة العربية', 'Dr. Ahmad Omar', 'Dar Al-Shorouk', 'Language', 'ar', 2018],
    ['BK-004', '978-0-13-110362-7', 'The C Programming Language', 'لغة البرمجة C', 'Kernighan & Ritchie', 'Prentice Hall', 'Technology', 'en', 1988],
    ['BK-005', '978-0-06-112008-4', 'Brave New World', 'عالم جديد شجاع', 'Aldous Huxley', 'Harper', 'Fiction', 'en', 1932],
    ['BK-006', '978-1-4028-9462-6', 'A Brief History of Time', 'تاريخ موجز للزمن', 'Stephen Hawking', 'Bantam', 'Science', 'en', 1988],
    ['BK-007', '978-977-14-1771-0', 'Islamic History', 'التاريخ الإسلامي', 'Dr. Hussein Amin', 'Dar Al-Maaref', 'History', 'ar', 2015],
    ['BK-008', '978-0-316-76948-0', 'The Catcher in the Rye', 'الحارس في حقل الشوفان', 'J.D. Salinger', 'Little Brown', 'Fiction', 'en', 1951],
    ['BK-009', '978-1-250-30123-4', 'Modern Mathematics', 'الرياضيات الحديثة', 'Prof. Samir Fahmy', 'Academic Press', 'Mathematics', 'en', 2020],
    ['BK-010', '978-0-553-21311-9', 'Foundation', 'الأساس', 'Isaac Asimov', 'Bantam', 'Science Fiction', 'en', 1951],
  ];
  const bookIds = bookDefs.map(([code, isbn, en, ar, author, pub, cat, lang, year]) =>
    insertRow('books', {
      code, isbn, title_en: en, title_ar: ar, author, publisher: pub, category: cat, language: lang,
      publish_year: year, pages: randInt(120, 520), price: randInt(8, 35), total_copies: 4,
      available_copies: 4, shelf: `S-${randInt(1, 9)}`, branch_id: mainId, is_active: 1,
    }),
  );
  for (const bookId of bookIds) {
    for (let c = 1; c <= 4; c += 1) {
      insertRow('book_copies', { book_id: bookId, barcode: `BC-${bookId}-${c}`, status: 'available', condition: 'good', acquired_date: '2024-09-01', branch_id: mainId });
    }
  }
  const memberIds = studentIds.slice(0, 20).map((studentId, i) =>
    insertRow('library_members', {
      membership_no: `LM-${pad(i + 1)}`, student_id: studentId, type: 'student',
      join_date: '2025-09-01', expiry_date: '2026-06-30', max_books: 3, status: 'active',
    }),
  );
  for (let i = 0; i < 8; i += 1) {
    const copy = get(`SELECT * FROM book_copies ORDER BY id LIMIT 1 OFFSET ?`, [i]);
    const loanDate = iso(addDays(new Date(), -randInt(3, 20)));
    insertRow('book_loans', {
      copy_id: copy.id, book_id: copy.book_id, member_id: pick(memberIds),
      loan_date: loanDate, due_date: iso(addDays(new Date(loanDate), 14)),
      status: 'issued', fine: 0, issued_by: 1, branch_id: mainId,
    });
    run(`UPDATE book_copies SET status = 'borrowed' WHERE id = ?`, [copy.id]);
    run(`UPDATE books SET available_copies = available_copies - 1 WHERE id = ?`, [copy.book_id]);
  }

  // E-learning
  const courseDefs = [
    ['CRS-001', 'Mathematics — Algebra Foundations', 'الرياضيات — أساسيات الجبر', subjectIds[3], 'intermediate'],
    ['CRS-002', 'English Reading Comprehension', 'الفهم القرائي في الإنجليزية', subjectIds[2], 'beginner'],
    ['CRS-003', 'Physics — Mechanics', 'الفيزياء — الميكانيكا', subjectIds[5], 'advanced'],
    ['CRS-004', 'Introduction to Programming', 'مقدمة في البرمجة', subjectIds[8], 'beginner'],
  ];
  for (const [code, en, ar, subjectId, level] of courseDefs) {
    const cid = insertRow('courses', {
      code, name_en: en, name_ar: ar, subject_id: subjectId, grade_level_id: ctx.gradeIds[8],
      teacher_id: pick(people.teacherIds), level, status: 'active', is_published: 1,
      start_date: '2025-09-15', end_date: '2026-01-15', duration_hours: 24, branch_id: mainId,
      description_en: 'A complete, self-paced course with videos, readings and quizzes.',
      description_ar: 'دورة متكاملة بالدراسة الذاتية تشمل الفيديوهات والقراءات والاختبارات.',
    });
    for (let m = 1; m <= 3; m += 1) {
      const mid = insertRow('course_modules', { course_id: cid, title_en: `Module ${m}`, title_ar: `الوحدة ${m}`, sort_order: m });
      for (let l = 1; l <= 3; l += 1) {
        insertRow('course_lessons', {
          module_id: mid, course_id: cid, title_en: `Lesson ${m}.${l}`, title_ar: `الدرس ${m}.${l}`,
          type: l === 3 ? 'quiz' : 'video', duration_minutes: randInt(8, 25), sort_order: l, is_free: m === 1 && l === 1,
          video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        });
      }
    }
  }

  const vcatIds = [
    ['VC-01', 'Mathematics', 'الرياضيات'],
    ['VC-02', 'Science', 'العلوم'],
    ['VC-03', 'Languages', 'اللغات'],
    ['VC-04', 'Technology', 'التقنية'],
    ['VC-05', 'School Life', 'حياة المدرسة'],
  ].map(([code, en, ar], i) => insertRow('video_categories', { code, name_en: en, name_ar: ar, sort_order: i }));

  const videoDefs = [
    ['VID-001', 'Solving Quadratic Equations', 'حل المعادلات التربيعية', 0],
    ['VID-002', 'The Water Cycle Explained', 'دورة الماء في الطبيعة', 1],
    ['VID-003', 'English Tenses Masterclass', 'أزمنة اللغة الإنجليزية', 2],
    ['VID-004', 'Building Your First Web Page', 'بناء أول صفحة ويب', 3],
    ['VID-005', 'A Day at EduSphere', 'يوم في إديو سفير', 4],
  ];
  for (const [code, en, ar, catIdx] of videoDefs) {
    insertRow('videos', {
      code, title_en: en, title_ar: ar, category_id: vcatIds[catIdx], subject_id: pick(subjectIds),
      grade_level_id: ctx.gradeIds[6], url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', provider: 'youtube',
      duration_seconds: randInt(180, 900), views: randInt(20, 900), is_published: 1, uploaded_by: 1,
      description_en: 'A short, engaging lesson video.', description_ar: 'درس مصوّر قصير وجاذب.',
    });
  }

  // Assignments
  for (let i = 0; i < 10; i += 1) {
    insertRow('assignments', {
      code: `ASG-${pad(i + 1, 4)}`,
      title_en: pick(['Algebra worksheet', 'Essay: My Hero', 'Lab report: Photosynthesis', 'Build a calculator app']),
      title_ar: pick(['ورقة عمل الجبر', 'مقال: بطلي', 'تقرير مختبر: البناء الضوئي', 'ابنِ تطبيق آلة حاسبة']),
      section_id: pick(sections), subject_id: pick(subjectIds), due_date: iso(addDays(new Date(), randInt(-5, 20))),
      max_score: 100, status: 'published', created_by: 1,
      description_en: 'Please submit your work through the portal before the due date.',
      description_ar: 'يرجى تسليم العمل عبر البوابة قبل تاريخ الاستحقاق.',
    });
  }

  // Resources, bookings, transport, events, activities
  const resIds = [
    ['RES-HALL', 'Grand Hall', 'القاعة الكبرى', 'hall', 400],
    ['RES-SPORT', 'Sports Hall', 'الصالة الرياضية', 'sports', 200],
    ['RES-LAB', 'Science Lab', 'مختبر العلوم', 'lab', 24],
    ['RES-BUS1', 'Bus 1', 'الحافلة ١', 'bus', 45],
    ['RES-PROJ', 'Projector Set', 'جهاز عرض متنقل', 'equipment', 1],
  ].map(([code, en, ar, type, cap], i) =>
    insertRow('resources', { code, name_en: en, name_ar: ar, type, capacity: cap, branch_id: mainId, location: 'Main Campus', is_active: 1, hourly_rate: i === 0 ? 150 : 0 }),
  );
  for (let i = 0; i < 8; i += 1) {
    const start = addDays(new Date(), randInt(-3, 12));
    start.setHours(randInt(8, 15), 0, 0, 0);
    const end = new Date(start.getTime() + 90 * 60000);
    insertRow('bookings', {
      booking_no: `BKG-${pad(i + 1, 4)}`, resource_id: pick(resIds),
      title_en: pick(['Staff meeting', 'Science fair', 'Basketball practice', 'Parent workshop', 'Board meeting']),
      title_ar: pick(['اجتماع الموظفين', 'معرض العلوم', 'تدريب كرة السلة', 'ورشة أولياء الأمور', 'اجتماع مجلس الإدارة']),
      purpose: 'School activity', requester_type: 'staff', staff_id: pick(staffIds),
      start_at: start.toISOString().slice(0, 16).replace('T', ' '), end_at: end.toISOString().slice(0, 16).replace('T', ' '),
      attendees: randInt(10, 120), status: pick(['confirmed', 'confirmed', 'pending']), branch_id: mainId,
    });
  }

  const vehicleIds = [
    ['VH-01', 'ABC-1234', 'Toyota', 'Coaster', 2019, 45],
    ['VH-02', 'ABC-5678', 'Mercedes', 'Sprinter', 2021, 22],
    ['VH-03', 'ABC-9012', 'Hyundai', 'County', 2018, 30],
  ].map(([code, plate, make, model, year, cap]) =>
    insertRow('vehicles', { code, plate_no: plate, make, model, year, capacity: cap, driver_id: pick(staffIds), insurance_expiry: '2026-12-31', license_expiry: '2026-10-31', status: 'active', branch_id: mainId }),
  );
  const routeIds = [
    ['RT-01', 'Nasr City Route', 'خط مدينة نصر', vehicleIds[0]],
    ['RT-02', 'Maadi Route', 'خط المعادي', vehicleIds[1]],
    ['RT-03', '6th of October Route', 'خط السادس من أكتوبر', vehicleIds[2]],
  ].map(([code, en, ar, vId]) =>
    insertRow('transport_routes', { code, name_en: en, name_ar: ar, branch_id: mainId, vehicle_id: vId, capacity: 40, fee: 120, currency_code: 'USD', start_time: '06:30', end_time: '15:30', is_active: 1 }),
  );
  for (const routeId of routeIds) {
    ['Main Gate', 'City Center', 'Palm Square', 'School'].forEach((stop, i) => {
      insertRow('transport_stops', { route_id: routeId, name_en: stop, name_ar: stop, pickup_time: `0${6 + i}:30`, dropoff_time: `1${4 + i}:00`, sort_order: i, fee: 30 });
    });
  }

  const eventDefs = [
    ['EV-001', 'Annual Science Fair', 'معرض العلوم السنوي', 'event', 5, 'Grand Hall'],
    ['EV-002', 'Parent–Teacher Conference', 'لقاء أولياء الأمور والمعلمين', 'meeting', 12, 'Main Building'],
    ['EV-003', 'Mid-year Break', 'إجازة منتصف العام', 'holiday', 20, ''],
    ['EV-004', 'Sports Day', 'اليوم الرياضي', 'event', 28, 'Sports Field'],
    ['EV-005', 'Graduation Ceremony', 'حفل التخرج', 'ceremony', 60, 'Grand Hall'],
  ];
  for (const [code, en, ar, type, inDays, loc] of eventDefs) {
    const start = addDays(new Date(), inDays);
    start.setHours(9, 0, 0, 0);
    insertRow('events', {
      code, title_en: en, title_ar: ar, type, location: loc, branch_id: mainId,
      start_at: start.toISOString().slice(0, 16).replace('T', ' '),
      end_at: new Date(start.getTime() + 4 * 3600000).toISOString().slice(0, 16).replace('T', ' '),
      audience: type === 'meeting' ? 'parents' : 'all', is_public: 1, status: 'scheduled',
      description_en: 'Join us for this special school event.', description_ar: 'انضموا إلينا في هذه الفعالية المدرسية المميزة.',
    });
  }

  const activityIds = [
    ['ACT-01', 'Robotics Club', 'نادي الروبوتات', 'club'],
    ['ACT-02', 'Basketball Team', 'فريق كرة السلة', 'sport'],
    ['ACT-03', 'Debate Club', 'نادي المناظرة', 'club'],
    ['ACT-04', 'Art & Calligraphy', 'الفن والخط العربي', 'club'],
    ['ACT-05', 'Community Service', 'خدمة المجتمع', 'community'],
  ].map(([code, en, ar, type]) =>
    insertRow('activities', {
      code, name_en: en, name_ar: ar, type, schedule: 'Tuesdays 14:00–15:30', location: 'Main Campus',
      supervisor_id: pick(staffIds), capacity: 25, fee: type === 'sport' ? 50 : 0, branch_id: mainId,
      status: 'active', start_date: '2025-09-15', end_date: '2026-06-01',
    }),
  );
  for (const activityId of activityIds) {
    for (const studentId of studentIds.slice(0, 8)) {
      if (rand() > 0.6) insertRow('activity_participants', { activity_id: activityId, student_id: studentId, role: 'member', status: 'enrolled', joined_at: '2025-09-20' });
    }
  }

  // Health & discipline
  for (let i = 0; i < 12; i += 1) {
    insertRow('health_records', {
      student_id: pick(studentIds), record_date: iso(addDays(new Date(), -randInt(1, 60))), type: pick(['visit', 'injury', 'screening']),
      complaint: pick(['Headache', 'Stomach ache', 'Minor cut', 'Fever']), diagnosis: 'Minor ailment',
      treatment: 'Rest and observation', medication: pick(['Paracetamol', 'Antiseptic', 'None']),
      nurse_id: pick(staffIds), status: 'closed',
    });
  }
  for (let i = 0; i < 8; i += 1) {
    insertRow('discipline_records', {
      student_id: pick(studentIds), incident_date: iso(addDays(new Date(), -randInt(1, 45))),
      category: pick(['lateness', 'uniform', 'behavior', 'absence']), severity: pick(['low', 'low', 'medium']),
      description: 'Recorded by homeroom teacher', action_taken: pick(['Verbal warning', 'Parent call', 'Detention']),
      reported_by: pick(staffIds), status: pick(['open', 'resolved']), parent_notified: rand() > 0.5 ? 1 : 0,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const inTime = addDays(new Date(), -randInt(0, 3));
    inTime.setHours(randInt(8, 11), randInt(0, 59), 0, 0);
    insertRow('visitors', {
      name: pick(['Mr. Ahmed Saleh', 'Ms. Laura Green', 'Eng. Hany Talaat', 'Mrs. Mona Kamal']),
      phone: `+2010${randInt(10000000, 99999999)}`, id_no: `ID${randInt(1000000, 9999999)}`,
      purpose: pick(['Parent meeting', 'Interview', 'Maintenance', 'Delivery']), person_to_visit: pick(['Principal', 'Registrar', 'Finance']),
      check_in: inTime.toISOString().slice(0, 16).replace('T', ' '), badge_no: `B-${randInt(100, 999)}`,
      branch_id: mainId,
    });
  }

  // Announcements, notifications, todos, exams
  const annDefs = [
    ['ANN-001', 'Welcome back to a new academic year', 'مرحباً بعودتكم إلى عام دراسي جديد', 'all', 'high'],
    ['ANN-002', 'Term 1 exam timetable published', 'تم نشر جدول امتحانات الفصل الأول', 'students', 'normal'],
    ['ANN-003', 'Fee payment deadline reminder', 'تذكير بموعد سداد الرسوم', 'parents', 'urgent'],
    ['ANN-004', 'Professional development day', 'يوم التطوير المهني', 'staff', 'normal'],
  ];
  for (const [code, en, ar, audience, priority] of annDefs) {
    insertRow('announcements', {
      code, title_en: en, title_ar: ar, body_en: 'Please check the portal for full details.', body_ar: 'يرجى مراجعة البوابة للتفاصيل الكاملة.',
      audience, branch_id: mainId, publish_at: nowIso(), is_published: 1, priority,
    });
  }

  for (const sectionId of sections.slice(0, 10)) {
    for (const subjectId of subjectIds.slice(0, 5)) {
      insertRow('exam_schedules', {
        code: `EXM-${sectionId}-${subjectId}`, term_id: ctx.termId, subject_id: subjectId, section_id: sectionId,
        exam_date: iso(addDays(new Date(), randInt(10, 30))), start_time: '09:00', end_time: '11:00',
        room_id: pick(ctx.roomIds), invigilator_id: pick(people.teacherIds), max_score: 100,
      });
    }
  }

  insertRow('cafeteria_menu', { menu_date: todayIso(), meal_type: 'lunch', items_en: 'Grilled chicken, rice, salad, fruit', items_ar: 'دجاج مشوي، أرز، سلطة، فاكهة', calories: 650, price: 5, branch_id: mainId });

  return { bookIds, resIds, routeIds, activityIds };
}


function ensureTreasuryDefaults() {
  const base = getSetting('app', 'finance', {}).base_currency || 'USD';
  const branches = all(`SELECT id, code, name_en, name_ar FROM branches WHERE is_active = 1 ORDER BY id`);
  if (!branches.length) return;
  const cashGL = get(`SELECT id FROM accounts WHERE (code = '1110' OR subtype = 'cash') AND type='asset' ORDER BY is_group ASC, id ASC LIMIT 1`);
  const bankGL = get(`SELECT id FROM accounts WHERE (code = '1120' OR subtype = 'bank') AND type='asset' ORDER BY is_group ASC, id ASC LIMIT 1`);

  for (const b of branches) {
    const prefix = b.code || `BR${b.id}`;
    const hasCash = get(`SELECT id FROM bank_accounts WHERE branch_id = ? AND kind = 'cashbox' LIMIT 1`, [b.id]);
    if (!hasCash) {
      insertRow('bank_accounts', {
        code: `${prefix}-CASH`, kind: 'cashbox',
        name_en: `Main Cashbox - ${b.name_en}`, name_ar: `الخزينة الرئيسية - ${b.name_ar || b.name_en}`,
        currency_code: base, opening_balance: 0, current_balance: 0,
        account_id: cashGL?.id || null, branch_id: b.id, is_active: 1,
      });
    }
    const hasBank = get(`SELECT id FROM bank_accounts WHERE branch_id = ? AND kind = 'bank' LIMIT 1`, [b.id]);
    if (!hasBank) {
      insertRow('bank_accounts', {
        code: `${prefix}-BANK`, kind: 'bank',
        name_en: `Main Bank Account - ${b.name_en}`, name_ar: `الحساب البنكي الرئيسي - ${b.name_ar || b.name_en}`,
        bank_name: 'Default Bank', currency_code: base, opening_balance: 0, current_balance: 0,
        account_id: bankGL?.id || null, branch_id: b.id, is_active: 1,
      });
    }
  }

  // upgrade existing payment methods to link cashbox/bank where possible
  const firstCash = get(`SELECT id FROM bank_accounts WHERE kind='cashbox' AND is_active=1 ORDER BY id LIMIT 1`);
  const firstBank = get(`SELECT id FROM bank_accounts WHERE kind='bank' AND is_active=1 ORDER BY id LIMIT 1`);
  const methods = all(`SELECT id, type, code, bank_account_id FROM payment_methods`);
  for (const m of methods) {
    if (m.bank_account_id) continue;
    const link = (m.type === 'cash' || m.code === 'CASH') ? firstCash : (m.type === 'bank' || m.type === 'card' || m.type === 'cheque' || m.type === 'online' ? firstBank : null);
    if (link) run(`UPDATE payment_methods SET bank_account_id = ? WHERE id = ?`, [link.id, m.id]);
  }
  // ensure common methods exist
  const ensureMethod = (code, en, ar, type, baId, order) => {
    if (!get(`SELECT id FROM payment_methods WHERE code = ?`, [code])) {
      insertRow('payment_methods', { code, name_en: en, name_ar: ar, type, bank_account_id: baId || null, is_active: 1, sort_order: order });
    }
  };
  ensureMethod('CASH', 'Cash', 'نقدي', 'cash', firstCash?.id, 1);
  ensureMethod('BANK', 'Bank Transfer', 'تحويل بنكي', 'bank', firstBank?.id, 2);
  ensureMethod('CARD', 'Visa / Card', 'فيزا / بطاقة', 'card', firstBank?.id, 3);
  ensureMethod('CHEQUE', 'Cheque', 'شيك', 'cheque', firstBank?.id, 4);
}

/* ------------------------------------------------------------------ */
/* 9. Orchestrator                                                     */
/* ------------------------------------------------------------------ */
export function runSeed() {
  return transaction(() => {
    ensureTreasuryDefaults();
    seedPermissions();
    seedRoles();
    seedCurrencies();
    const fresh = seedSettings();
    const ctx = seedStructure();
    if (!ctx) return { skipped: true };
    const people = seedPeople(ctx);
    seedAcademicsData(ctx, people);
    seedAccounting(ctx);
    seedFinance(ctx, people);
    seedExtras(ctx, people);
    return { skipped: false, fresh };
  });
}
