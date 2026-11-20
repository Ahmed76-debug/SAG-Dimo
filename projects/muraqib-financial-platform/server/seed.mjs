import { getDb } from './db.mjs';
import { nowIso, sha256Hex } from './util.mjs';

function j(v) { return v == null ? null : JSON.stringify(v); }
function b(v) { return v ? 1 : 0; }

export function runSeed() {
  const db = getDb();
  const now = nowIso();

  // app settings
  if (db.prepare('SELECT COUNT(*) c FROM appSettings').get().c === 0) {
    db.prepare(`INSERT INTO appSettings (defaultLanguage,defaultTheme,backupFolderName,autoBackup,lastBackupAt,lastRestoreAt,auditTightening)
      VALUES (?,?,?,?,?,?,?)`).run('ar', 'light', null, 0, null, null, 0);
  }

  // office profile
  if (db.prepare('SELECT COUNT(*) c FROM officeProfile').get().c === 0) {
    db.prepare(`INSERT INTO officeProfile (nameAr,nameEn,ownerNameAr,ownerNameEn,titleAr,titleEn,email,phone,addressAr,addressEn,website,logoDataUrl,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'مكتب مراقب للمحاسبة والمراجعة', 'Muraqib Accounting & Auditing Office',
      'المراقب المالي المعتمد', 'Certified Financial Controller',
      'مراقب مالي معتمد', 'Certified Financial Controller',
      'info@muraqib.local', '01000000000',
      'القاهرة، مصر', 'Cairo, Egypt', 'https://muraqib.local', null, now
    );
  }

  // admin user (compatible with client hash: sha256("muraqib::"+password))
  const adminHash = sha256Hex('muraqib::admin123');
  const existingAdmin = db.prepare("SELECT id FROM users WHERE lower(username) = 'admin' LIMIT 1").get();
  if (!existingAdmin) {
    db.prepare(`INSERT INTO users (username,passwordHash,fullNameAr,fullNameEn,email,phone,role,companyId,isActive,lastLogin,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'admin', adminHash, 'مدير النظام', 'System Administrator', 'admin@muraqib.local', null, 'admin', null, 1, null, now, now
    );
  } else {
    db.prepare("UPDATE users SET username='admin', passwordHash=?, role=COALESCE(NULLIF(role,''),'admin'), isActive=1, updatedAt=? WHERE id=?")
      .run(adminHash, now, existingAdmin.id);
  }

  // demo data
  const companyCount = db.prepare('SELECT COUNT(*) c FROM companies').get().c;
  if (companyCount > 0) return;

  const companies = [
    ['MFC-001','شركة الأفق للتجارة والتوريدات','Al Afaq Trading & Supplies','llc','medium','commercial','تجارة وتوريدات عامة','General trading and supplies',null,null,'02268891122','info@afaq.local','القاهرة - مدينة نصر','Cairo - Nasr City','EGP','2026-01-01','2026-12-31','active',null,now,now],
    ['MFC-002','مصنع النيل للصناعات الغذائية','Nile Food Industries','jsc','large','industrial','تصنيع وتعبئة المواد الغذائية','Food manufacturing and packaging',null,null,'02456637788','finance@nilefood.local','المنصورة - المنطقة الصناعية','Mansoura - Industrial Zone','EGP','2026-01-01','2026-12-31','active',null,now,now],
    ['MFC-003','عيادة د. كريم عبدالعزيز','Dr. Karim Clinic','sole','doctor','service','عيادة تخصصية وخدمات علاجية','Specialized clinic and medical services',null,null,'03574429911','info@drkarim.local','الإسكندرية - سموحة','Alexandria - Smouha','EGP','2026-01-01','2026-12-31','active',null,now,now],
  ];
  const cStmt = db.prepare(`INSERT INTO companies (code,nameAr,nameEn,legalForm,size,activity,activityDetailsAr,activityDetailsEn,taxId,registrationNo,phone,email,addressAr,addressEn,baseCurrency,fiscalYearStart,fiscalYearEnd,status,notes,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const companyIds = companies.map(r => Number(cStmt.run(...r).lastInsertRowid));

  // demo team accounts (same passwords shown on the login screen)
  const demoUsers = [
    ['reviewer', 'reviewer123', 'مراجع معتمد', 'Certified Reviewer', 'reviewer@muraqib.local', 'reviewer', null],
    ['accountant', 'accountant123', 'محاسب', 'Accountant', 'accountant@muraqib.local', 'accountant', null],
    ['ext_gh', 'ext123', 'مدير مالي شركة', 'Client Finance Manager', 'ext@muraqib.local', 'external', companyIds[0]],
    ['viewer', 'viewer123', 'مشاهد', 'Viewer', 'viewer@muraqib.local', 'viewer', null],
  ];
  const userStmt = db.prepare(`INSERT INTO users (username,passwordHash,fullNameAr,fullNameEn,email,phone,role,companyId,isActive,lastLogin,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [username, password, fullNameAr, fullNameEn, email, role, companyId] of demoUsers) {
    if (!db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      userStmt.run(username, sha256Hex(`muraqib::${password}`), fullNameAr, fullNameEn, email, null, role, companyId, 1, null, now, now);
    }
  }

  const aStmt = db.prepare(`INSERT INTO accounts (companyId,code,nameAr,nameEn,parentCode,type,section,level,nature,isActive,isSystem,allowPosting,notes,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const tbiStmt = db.prepare(`INSERT INTO trialBalanceImports (companyId,fiscalYear,periodStart,periodEnd,status,source,submittedBy,submittedByName,reviewedBy,reviewedByName,reviewedAt,reviewNotes,totalDebit,totalCredit,isBalanced,lineCount,notes,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const tblStmt = db.prepare(`INSERT INTO trialBalanceLines (importId,companyId,code,nameAr,nameEn,type,section,debit,credit,currency,exchangeRate,debitBase,creditBase,[order],notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  function seedCompanyTB(cid, accounts, tb) {
    accounts.forEach(r => aStmt.run(cid, ...r, now, now));
    const totalDebit = tb.lines.reduce((s, l) => s + (l[6] || 0), 0);
    const totalCredit = tb.lines.reduce((s, l) => s + (l[7] || 0), 0);
    const info = tbiStmt.run(
      cid, tb.fiscalYear, tb.periodStart, tb.periodEnd, tb.status, tb.source,
      null, tb.submittedByName, null, tb.reviewedByName, tb.reviewedAt, tb.reviewNotes,
      totalDebit, totalCredit, totalDebit === totalCredit ? 1 : 0, tb.lines.length, tb.notes, now, now
    );
    const importId = Number(info.lastInsertRowid);
    tb.lines.forEach((l, i) => {
      // l: [code,nameAr,nameEn,type,section,debit,credit]
      tblStmt.run(importId, cid, l[0], l[1], l[2], l[3], l[4], l[5], l[6], 'EGP', 1, l[5], l[6], i + 1, null);
    });
    return importId;
  }

  // شركة 1 - تجاري
  seedCompanyTB(companyIds[0], [
    ['11101','النقدية بالصندوق','Cash on Hand',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11201','البنك - الحساب الجاري','Bank - Current Account',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11301','العملاء','Accounts Receivable',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11401','المخزون','Inventory',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['12101','الأصول الثابتة','Fixed Assets',null,'asset','asset_noncurrent',3,'debit',1,1,1,null],
    ['21101','الموردون','Accounts Payable',null,'liability','liability_current',3,'credit',1,1,1,null],
    ['22101','قروض طويلة الأجل','Long-term Loans',null,'liability','liability_noncurrent',3,'credit',1,1,1,null],
    ['31101','رأس المال','Capital',null,'equity','equity_capital',3,'credit',1,1,1,null],
    ['31201','أرباح محتجزة','Retained Earnings',null,'equity','equity_retained',3,'credit',1,1,1,null],
    ['41101','إيرادات المبيعات','Sales Revenue',null,'revenue','revenue_operating',3,'credit',1,1,1,null],
    ['51101','تكلفة البضاعة المباعة','Cost of Goods Sold',null,'expense','cogs',3,'debit',1,1,1,null],
    ['52101','مصروفات عمومية وإدارية','General & Admin Expenses',null,'expense','expense_admin',3,'debit',1,1,1,null],
  ], {
    fiscalYear:'2026', periodStart:'2026-01-01', periodEnd:'2026-12-31', status:'approved', source:'direct_entry',
    submittedByName:'admin', reviewedByName:'admin', reviewedAt: now, reviewNotes:'ميزان تجريبي معتمد', notes:'بيانات تجريبية',
    lines:[
      ['11101','النقدية بالصندوق','Cash on Hand','asset','asset_current',85000,0],
      ['11201','البنك - الحساب الجاري','Bank - Current Account','asset','asset_current',120000,0],
      ['11301','العملاء','Accounts Receivable','asset','asset_current',140000,0],
      ['11401','المخزون','Inventory','asset','asset_current',180000,0],
      ['12101','الأصول الثابتة','Fixed Assets','asset','asset_noncurrent',300000,0],
      ['21101','الموردون','Accounts Payable','liability','liability_current',0,120000],
      ['22101','قروض طويلة الأجل','Long-term Loans','liability','liability_noncurrent',0,150000],
      ['31101','رأس المال','Capital','equity','equity_capital',0,350000],
      ['31201','أرباح محتجزة','Retained Earnings','equity','equity_retained',0,80000],
      ['41101','إيرادات المبيعات','Sales Revenue','revenue','revenue_operating',0,550000],
      ['51101','تكلفة البضاعة المباعة','Cost of Goods Sold','expense','cogs',325000,0],
      ['52101','مصروفات عمومية وإدارية','General & Admin Expenses','expense','expense_admin',100000,0],
    ]
  });

  // شركة 2 - صناعي
  seedCompanyTB(companyIds[1], [
    ['11101','النقدية بالصندوق','Cash on Hand',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11201','البنك - الحساب الجاري','Bank - Current Account',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11301','العملاء','Accounts Receivable',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11401','المخزون والمواد الخام','Inventory & Raw Materials',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['12101','الآلات والمعدات','Machinery & Equipment',null,'asset','asset_noncurrent',3,'debit',1,1,1,null],
    ['21101','الموردون','Accounts Payable',null,'liability','liability_current',3,'credit',1,1,1,null],
    ['22101','قروض تمويل صناعي','Industrial Finance Loans',null,'liability','liability_noncurrent',3,'credit',1,1,1,null],
    ['31101','رأس المال','Capital',null,'equity','equity_capital',3,'credit',1,1,1,null],
    ['31201','أرباح المرحلة','Current Period Earnings',null,'equity','equity_retained',3,'credit',1,1,1,null],
    ['41101','إيرادات المبيعات','Sales Revenue',null,'revenue','revenue_operating',3,'credit',1,1,1,null],
    ['51101','تكلفة الإنتاج','Cost of Production',null,'expense','cogs',3,'debit',1,1,1,null],
    ['52101','مصروفات تشغيلية','Operating Expenses',null,'expense','expense_admin',3,'debit',1,1,1,null],
  ], {
    fiscalYear:'2026', periodStart:'2026-01-01', periodEnd:'2026-12-31', status:'approved', source:'excel_import',
    submittedByName:'accountant', reviewedByName:'reviewer', reviewedAt: now, reviewNotes:'تمت المراجعة واعتماد الميزان', notes:'ميزان مصنع النيل',
    lines:[
      ['11101','النقدية بالصندوق','Cash on Hand','asset','asset_current',60000,0],
      ['11201','البنك - الحساب الجاري','Bank - Current Account','asset','asset_current',220000,0],
      ['11301','العملاء','Accounts Receivable','asset','asset_current',310000,0],
      ['11401','المخزون والمواد الخام','Inventory & Raw Materials','asset','asset_current',420000,0],
      ['12101','الآلات والمعدات','Machinery & Equipment','asset','asset_noncurrent',950000,0],
      ['21101','الموردون','Accounts Payable','liability','liability_current',0,260000],
      ['22101','قروض تمويل صناعي','Industrial Finance Loans','liability','liability_noncurrent',0,480000],
      ['31101','رأس المال','Capital','equity','equity_capital',0,700000],
      ['31201','أرباح المرحلة','Current Period Earnings','equity','equity_retained',0,120000],
      ['41101','إيرادات المبيعات','Sales Revenue','revenue','revenue_operating',0,980000],
      ['51101','تكلفة الإنتاج','Cost of Production','expense','cogs',410000,0],
      ['52101','مصروفات تشغيلية','Operating Expenses','expense','expense_admin',170000,0],
    ]
  });

  // شركة 3 - خدمات طبية
  seedCompanyTB(companyIds[2], [
    ['11101','النقدية بالصندوق','Cash on Hand',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11201','البنك','Bank',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['11301','ذمم مرضى وشركات تأمين','Patients & Insurance Receivables',null,'asset','asset_current',3,'debit',1,1,1,null],
    ['12101','أجهزة ومعدات طبية','Medical Equipment',null,'asset','asset_noncurrent',3,'debit',1,1,1,null],
    ['21101','الموردون والدائنون','Suppliers & Creditors',null,'liability','liability_current',3,'credit',1,1,1,null],
    ['31101','رأس المال','Capital',null,'equity','equity_capital',3,'credit',1,1,1,null],
    ['31201','أرباح محتجزة','Retained Earnings',null,'equity','equity_retained',3,'credit',1,1,1,null],
    ['41101','إيرادات الخدمات الطبية','Medical Services Revenue',null,'revenue','revenue_operating',3,'credit',1,1,1,null],
    ['51101','تكلفة مستلزمات طبية','Medical Supplies Cost',null,'expense','cogs',3,'debit',1,1,1,null],
    ['52101','مصروفات إدارية وتشغيلية','Administrative & Operating Expenses',null,'expense','expense_admin',3,'debit',1,1,1,null],
  ], {
    fiscalYear:'2026', periodStart:'2026-01-01', periodEnd:'2026-12-31', status:'approved', source:'direct_entry',
    submittedByName:'accountant', reviewedByName:'admin', reviewedAt: now, reviewNotes:'ميزان معتمد للعيادة', notes:'بيانات تجريبية',
    lines:[
      ['11101','النقدية بالصندوق','Cash on Hand','asset','asset_current',45000,0],
      ['11201','البنك','Bank','asset','asset_current',95000,0],
      ['11301','ذمم مرضى وشركات تأمين','Patients & Insurance Receivables','asset','asset_current',78000,0],
      ['12101','أجهزة ومعدات طبية','Medical Equipment','asset','asset_noncurrent',260000,0],
      ['21101','الموردون والدائنون','Suppliers & Creditors','liability','liability_current',0,52000],
      ['31101','رأس المال','Capital','equity','equity_capital',0,220000],
      ['31201','أرباح محتجزة','Retained Earnings','equity','equity_retained',0,36000],
      ['41101','إيرادات الخدمات الطبية','Medical Services Revenue','revenue','revenue_operating',0,340000],
      ['51101','تكلفة مستلزمات طبية','Medical Supplies Cost','expense','cogs',90000,0],
      ['52101','مصروفات إدارية وتشغيلية','Administrative & Operating Expenses','expense','expense_admin',80000,0],
    ]
  });

  // ميزان قيد المراجعة (لإظهار سير العمل)
  tbiStmt.run(companyIds[0],'2026-Q1','2026-01-01','2026-03-31','submitted','excel_import',null,'accountant',null,null,null,'بانتظار مراجعة المراقب',320000,320000,1,6,'ربع أول تجريبي',now,now);

  // reminders
  const remStmt = db.prepare(`INSERT INTO reminders (titleAr,titleEn,descriptionAr,descriptionEn,companyId,dueDate,remindBeforeDays,status,type,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const d = (days) => new Date(Date.now() + days*86400000).toISOString().slice(0,10);
  [
    ['مراجعة ميزان المراجعة','Trial Balance Review','مراجعة ميزان شركة الأفق واعتماده.','Review and approve Al Afaq trial balance.',companyIds[0],d(5),3,'pending','review'],
    ['استلام مستندات مصنع النيل','Receive Nile Factory Documents','متابعة استلام كشوف البنك والفواتير الداعمة.','Follow up on bank statements and supporting invoices.',companyIds[1],d(2),2,'pending','documents'],
    ['اجتماع مناقشة القوائم','Financial Statements Meeting','اجتماع مع إدارة عيادة د. كريم لمناقشة القوائم.','Meeting with Dr. Karim clinic management.',companyIds[2],d(7),3,'pending','meeting'],
    ['إعداد تقرير المراجعة الربع سنوي','Quarterly Review Report','إعداد مسودة تقرير المراجعة لشركة الأفق.','Prepare draft review report for Al Afaq.',companyIds[0],d(12),5,'in_progress','report'],
    ['متابعة التزام ضريبي','Tax Compliance Follow-up','التأكد من اكتمال مستندات الإقرارات الضريبية.','Ensure tax filing documents are complete.',companyIds[1],d(-2),2,'overdue','tax'],
  ].forEach(r => remStmt.run(...r, now, now));

  // currency rates
  const rates = [['EGP','جنيه مصري','Egyptian Pound',1,now.slice(0,10),'local'],['USD','دولار أمريكي','US Dollar',48.5,now.slice(0,10),'local'],['SAR','ريال سعودي','Saudi Riyal',12.93,now.slice(0,10),'local']];
  const rStmt = db.prepare(`INSERT INTO currencyRates (code,nameAr,nameEn,rateToEGP,date,source) VALUES (?,?,?,?,?,?)`);
  rates.forEach(r => rStmt.run(...r));

  // archive
  const archStmt = db.prepare(`INSERT INTO archive (companyId,year,type,titleAr,titleEn,data,archivedAt,archivedBy) VALUES (?,?,?,?,?,?,?,?)`);
  archStmt.run(companyIds[0],'2025','financial_statements','قوائم مالية 2025 - شركة الأفق','2025 Financial Statements - Al Afaq', j({revenue:2100000, netIncome:420000, status:'archived'}), now, 'admin');
  archStmt.run(companyIds[1],'2025','trial_balance','ميزان مراجعة 2025 - مصنع النيل','2025 Trial Balance - Nile Factory', j({totalDebit:3200000, totalCredit:3200000, balanced:true}), now, 'reviewer');

  // audit log
  const logStmt = db.prepare(`INSERT INTO auditLogs (action,entity,entityId,detailsAr,detailsEn,userName,createdAt) VALUES (?,?,?,?,?,?,?)`);
  [
    ['create','company',companyIds[0],'إنشاء شركة تجريبية: شركة الأفق للتجارة والتوريدات','Created demo company: Al Afaq Trading & Supplies','admin'],
    ['create','company',companyIds[1],'إضافة شركة: مصنع النيل للصناعات الغذائية','Added company: Nile Food Industries','admin'],
    ['create','company',companyIds[2],'إضافة شركة: عيادة د. كريم عبدالعزيز','Added company: Dr. Karim Clinic','admin'],
    ['approve','trial_balance',1,'اعتماد ميزان المراجعة لشركة الأفق','Approved trial balance for Al Afaq','reviewer'],
    ['import','trial_balance',2,'استيراد ميزان مصنع النيل من Excel','Imported Nile Factory trial balance from Excel','accountant'],
    ['submit','trial_balance',4,'رفع ميزان الربع الأول للمراجعة','Submitted Q1 trial balance for review','accountant'],
  ].forEach(r => logStmt.run(...r, now));
}
