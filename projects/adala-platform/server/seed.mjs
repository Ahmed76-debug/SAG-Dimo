import { getDb } from './db.mjs';
import { hashPassword, randomSalt } from './auth.mjs';
import { nowIso, uid } from './util.mjs';

const DAY = 24 * 60 * 60 * 1000;
const isoDays = (offset, hour = 10) => {
  const d = new Date(Date.now() + offset * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateOnly = (offset) => isoDays(offset).slice(0, 10);
const j = (v) => (v == null ? null : JSON.stringify(v));
const b = (v) => (v ? 1 : 0);

function ensureMatterTypes() {
  const db = getDb();
  if (db.prepare('SELECT COUNT(*) c FROM matterTypes').get().c > 0) return;
  const types = [
    { id: 'mt_civil', name: 'مدني', color: '#2563EB', icon: 'scale', description: 'القضايا المدنية والتعويضات' },
    { id: 'mt_crim', name: 'جنائي', color: '#DC2626', icon: 'gavel', description: 'القضايا الجنائية والدفاع' },
    { id: 'mt_com', name: 'تجاري', color: '#0F766E', icon: 'briefcase', description: 'القضايا التجارية والشركات' },
    { id: 'mt_labor', name: 'عمالي', color: '#D97706', icon: 'users', description: 'نزاعات العمل والأجور' },
    { id: 'mt_admin', name: 'إداري', color: '#7C3AED', icon: 'building', description: 'القضايا الإدارية والقرارات' },
  ];
  const stmt = db.prepare('INSERT INTO matterTypes (id,name,color,icon,description,defaultDurationDays,defaultFee) VALUES (?,?,?,?,?,?,?)');
  for (const t of types) stmt.run(t.id, t.name, t.color, t.icon, t.description, null, null);
}

function ensureSettings() {
  const db = getDb();
  if (db.prepare('SELECT 1 FROM settings WHERE id=?').get('settings')) return;
  db.prepare(`INSERT INTO settings (id,profile,theme,density,reminderLeadDays,dailyDigest,soundEnabled,currency,defaultFeeType,archiveAfterMonths,autoArchiveClosed,printHeader,printFooter,confidentialityNotice,sidebarCollapsed)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'settings',
    j({ firmName:'مكتب العدالة للمحاماة', tagline:'استشارات قانونية وتمثيل نظامي باحترافية', lawyerName:'المحامي أحمد العدل', licenseNumber:'LIC-45872', email:'info@adala.local', phone:'0112345678', address:'الرياض، طريق الملك فهد', website:'https://adala.local' }),
    'system','comfortable',3,1,1,'SAR','fixed',12,0,
    'مكتب العدالة للمحاماة والاستشارات القانونية','هذه الوثيقة سرية وللاستخدام النظامي فقط','سري — للاطلاع من قبل الأطراف المخولة فقط.',0
  );
}

function ensurePortfolio() {
  const db = getDb();
  if (db.prepare('SELECT 1 FROM portfolio WHERE id=?').get('portfolio')) return;
  const now = nowIso();
  db.prepare(`INSERT INTO portfolio (id,heroTitle,heroSubtitle,heroCta,aboutTitle,aboutBody,stats,services,expertise,experience,credentials,caseHighlights,testimonials,articles,languages,memberships,ctaTitle,ctaBody,avatarFileId,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'portfolio',
    'المحامي أحمد العدل — محاماة واستشارات نظامية',
    'نقدّم حلولًا قانونية عملية في القضايا المدنية والتجارية والعمالية والجنائية، مع متابعة دقيقة للمواعيد والإجراءات والنتائج.',
    'احجز استشارة','نبذة عن المكتب','مكتب العدالة للمحاماة يقدم خدمات الترافع والاستشارات وصياغة العقود وإدارة النزاعات للأفراد والشركات، مع الالتزام بالسرية والدقة المهنية.',
    j([{ label: 'قضية', value: '520', suffix: '+' }, { label: 'موكل', value: '430', suffix: '+' }, { label: 'سنوات خبرة', value: '14', suffix: '+' }, { label: 'نسبة رضا', value: '97', suffix: '%' }]),
    j([{ title: 'القضايا المدنية', description: 'التعويضات والمطالبات والنزاعات المدنية.', icon: 'scale' }, { title: 'القضايا التجارية', description: 'الشركات والعقود والنزاعات التجارية.', icon: 'briefcase' }, { title: 'القضايا العمالية', description: 'حقوق العمال والأجور والفصل التعسفي.', icon: 'users' }, { title: 'القضايا الجنائية', description: 'الدفاع والمتابعة أمام الجهات المختصة.', icon: 'gavel' }]),
    j([{ title: 'صياغة ومراجعة العقود', description: 'عقود تجارية ومدنية واتفاقيات تسوية.', items: ['عقود خدمات', 'اتفاقيات سرية', 'مذكرات تفاهم'] }, { title: 'التقاضي والترافع', description: 'تمثيل الموكلين أمام المحاكم واللجان.', items: ['مرافعات', 'مذكرات جوابية', 'استئناف ونقض'] }]),
    j([{ period: '2012 — الآن', title: 'الشريك المؤسس', org: 'مكتب العدالة للمحاماة', description: 'إدارة المكتب والإشراف على القضايا والاستشارات.' }, { period: '2008 — 2012', title: 'محامٍ أول', org: 'مكتب خبرة قانونية', description: 'الترافع في القضايا التجارية والمدنية.' }]),
    j([{ title: 'ترخيص مزاولة المحاماة', org: 'وزارة العدل', year: '2012' }, { title: 'دبلوم التحكيم التجاري', org: 'مركز التدريب القانوني', year: '2016' }]),
    j([{ title: 'نزاع تجاري مع شركة توريد', sector: 'تجاري', result: 'تسوية لصالح الموكل', description: 'استرداد مستحقات مالية عبر تفاوض وتسوية موثقة.' }, { title: 'مطالبة عمالية', sector: 'عمالي', result: 'حكم لصالح العامل', description: 'تحصيل مستحقات نهاية الخدمة والأجور المتأخرة.' }]),
    j([{ quote: 'متابعة دقيقة واحترافية عالية في جميع مراحل القضية.', name: 'شركة النور', role: 'عميل تجاري' }, { quote: 'وضوح في الإجراءات وسرعة في التواصل.', name: 'سالم الحربي', role: 'موكل' }]),
    j([{ title: 'كيف تحمي عقدك التجاري', excerpt: 'بنود أساسية يجب الانتباه لها قبل التوقيع.', tag: 'عقود', date: '2026-02-10' }, { title: 'حقوق العامل عند إنهاء العقد', excerpt: 'أهم المستحقات النظامية وإجراءات المطالبة.', tag: 'عمالي', date: '2026-01-18' }]),
    j(['العربية', 'الإنجليزية']), j(['الهيئة السعودية للمحامين']),
    'هل لديك قضية أو استشارة؟','تواصل معنا للحصول على تقييم أولي وخطة متابعة قانونية واضحة.', null, now
  );
}

export function ensureAdminAndCore() {
  const db = getDb();
  const salt = randomSalt();
  const hash = hashPassword('admin123', salt);
  const now = nowIso();
  const existing = db.prepare("SELECT * FROM users WHERE lower(username) = 'admin' OR id='usr_admin' LIMIT 1").get();
  if (!existing) {
    db.prepare(`INSERT INTO users (id,name,username,email,phone,role,title,bio,avatarColor,passwordHash,salt,isActive,permOverrides,createdAt,lastLoginAt,notificationsEnabled)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      'usr_admin','مدير النظام','admin','admin@adala.local','0500000001','admin','مدير المكتب','إدارة النظام والمستخدمين وإعدادات المكتب.','#B08419',hash,salt,1,null,now,null,1
    );
  } else {
    const uname = String(existing.username || '').toLowerCase();
    const newU = !uname ? 'admin' : existing.username;
    db.prepare(`UPDATE users SET username=?, isActive=1, role=COALESCE(NULLIF(role,''),'admin'), title=COALESCE(NULLIF(title,''),'مدير المكتب'),
      avatarColor=COALESCE(NULLIF(avatarColor,''),'#B08419'), name=COALESCE(NULLIF(name,''),'مدير النظام'),
      passwordHash=?, salt=? WHERE id=?`).run(newU, hash, salt, existing.id);
  }
  ensureMatterTypes();
  ensureSettings();
  ensurePortfolio();
}

export function seedDemoDataIfEmpty() {
  const db = getDb();
  const cc = db.prepare('SELECT COUNT(*) c FROM clients').get().c;
  const mc = db.prepare('SELECT COUNT(*) c FROM matters').get().c;
  if (cc > 0 || mc > 0) return;

  const adminId = 'usr_admin';
  const now = nowIso();

  const extraUsers = [
    { id: 'usr_lawyer1', name: 'المحامي خالد السبيعي', username: 'khaled', email: 'khaled@adala.local', role: 'senior', title: 'محامٍ أول', color: '#2563EB' },
    { id: 'usr_lawyer2', name: 'المحامية نورة العتيبي', username: 'noura', email: 'noura@adala.local', role: 'associate', title: 'محامية', color: '#0F766E' },
  ];
  const uStmt = db.prepare(`INSERT OR IGNORE INTO users (id,name,username,email,phone,role,title,bio,avatarColor,passwordHash,salt,isActive,permOverrides,createdAt,lastLoginAt,notificationsEnabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const u of extraUsers) {
    const salt = randomSalt();
    uStmt.run(u.id,u.name,u.username,u.email,'',u.role,u.title,'',u.color,hashPassword('admin123',salt),salt,1,null,now,null,1);
  }

  const clients = [
    ['cli_001','شركة الأفق للتجارة','شركة الأفق للتجارة المحدودة','company',null,'1010456789','0114001001','legal@ofuq.example','حي العليا','الرياض',null,'عميل تجاري - عقود توريد',j(['تجاري','عقود']),'vip',adminId,'active',isoDays(-120),isoDays(-2),0,null,null],
    ['cli_002','سالم بن محمد الحربي',null,'individual','1023456789',null,'0551112233','salem@example.com','حي النزهة','الرياض','موظف','نزاع عمالي',j(['عمالي']),'high','usr_lawyer1','active',isoDays(-90),isoDays(-5),0,null,null],
    ['cli_003','مؤسسة روافد التقنية','مؤسسة روافد التقنية','company',null,'1010987654','0114556677','info@rawafed.example','حي الملز','الرياض',null,'مطالبات مالية ومديونيات',j(['مدني','تحصيل']),'normal','usr_lawyer2','active',isoDays(-75),isoDays(-10),0,null,null],
    ['cli_004','فهد العتيبي',null,'individual','1098765432',null,'0543332211','fahad@example.com',null,'جدة',null,'قضية جنائية - تمثيل',j(['جنائي']),'high',adminId,'active',isoDays(-60),isoDays(-1),0,null,null],
    ['cli_005','شركة بناء المستقبل',null,'company',null,'1010778899','0126007788',null,null,'جدة',null,'نزاع مقاولة',j(['تجاري','مقاولات']),'normal','usr_lawyer1','active',isoDays(-140),isoDays(-20),0,null,null],
    ['cli_006','نورة بنت عبدالعزيز',null,'individual','1088123456',null,'0567001122',null,null,'الدمام',null,'مطالبة حضانة ونفقة',j(['أحوال']),'normal','usr_lawyer2','active',isoDays(-45),isoDays(-3),0,null,null],
    ['cli_007','مطاعم الذوق الرفيع',null,'company',null,'1010665544','0138334455',null,null,'الدمام',null,'نزاع إيجار تجاري',j(['إيجار']),'normal',adminId,'active',isoDays(-50),isoDays(-7),0,null,null],
    ['cli_008','عبدالرحمن القحطاني',null,'individual','1077001122',null,'0509998877',null,null,'الرياض',null,'اعتراض على قرار إداري',j(['إداري']),'normal','usr_lawyer1','dormant',isoDays(-200),isoDays(-30),0,null,null],
    ['cli_009','شركة وادي النخيل',null,'company',null,'1010223344','0114889900',null,null,'الرياض',null,'قضية مغلقة - تم التحصيل',j(['تحصيل']),'normal',adminId,'closed',isoDays(-300),isoDays(-40),0,null,null],
    ['cli_010','ماجد الشهري',null,'opponent',null,null,'0554443322',null,null,'أبها',null,'طرف خصم في قضية مدنية',j(['خصم']),'normal',null,'active',isoDays(-35),isoDays(-6),0,null,null],
  ];
  const cStmt = db.prepare(`INSERT INTO clients (id,name,legalName,type,nationalId,commercialId,phone,email,address,city,profession,notes,tags,priority,assignedTo,status,createdAt,updatedAt,archived,archivedAt,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of clients) cStmt.run(...r);

  const matters = [
    ['mat_001','2026-001','CIV-001','مطالبة مالية - شركة الأفق','mt_civil','cli_001','شركة المدار','المحكمة التجارية بالرياض','C-45812',null,'hearing','high','مرافعة','مطالبة بمستحقات عقد توريد متأخرة.',j([adminId,'usr_lawyer2']),'fixed',45000,null,2500,1200,'SAR',isoDays(-100),null,'تقديم مذكرة جوابية',isoDays(5),55,0,j(['تجاري','مستحقات']),isoDays(-100),isoDays(-1),0,null,null,null,null],
    ['mat_002','2026-002','LAB-014','مطالبة عمالية - سالم الحربي','mt_labor','cli_002','شركة إشراقة','المحكمة العمالية','L-2231',null,'open','normal','تبادل مذكرات','مطالبة بأجور متأخرة ومكافأة نهاية خدمة.',j(['usr_lawyer1']),'fixed',12000,null,300,0,'SAR',isoDays(-70),null,'جلسة تسوية',isoDays(12),30,0,j(['عمالي']),isoDays(-70),isoDays(-4),0,null,null,null,null],
    ['mat_003','2026-003','COM-022','نزاع شراكة - روافد التقنية','mt_com','cli_003','شريك سابق','المحكمة التجارية','C-7710',null,'in_review','critical','دراسة مستندات','نزاع حول حصص وأرباح شراكة.',j([adminId]),'percentage',80000,null,4200,2000,'SAR',isoDays(-55),null,'مراجعة العقود',isoDays(2),40,1,j(['شركات']),isoDays(-55),isoDays(-2),0,null,null,null,null],
    ['mat_004','2026-004','CR-007','قضية جنائية - فهد العتيبي','mt_crim','cli_004',null,'المحكمة الجزائية','CR-9012',null,'hearing','high','جلسة','تمثيل ودفاع في قضية جزائية.',j([adminId]),'fixed',30000,null,1500,0,'SAR',isoDays(-40),null,'حضور الجلسة',isoDays(1),60,1,j(['جنائي']),isoDays(-40),isoDays(-1),0,null,null,null,null],
    ['mat_005','2026-005','COM-030','نزاع مقاولة - بناء المستقبل','mt_com','cli_005','مورد مواد','المحكمة التجارية بجدة','C-J-1188',null,'open','normal','قيد نظر','مطالبة بتعويض عن تأخير توريد.',j(['usr_lawyer1']),'fixed',25000,null,800,900,'SAR',isoDays(-30),null,'جمع مستندات',isoDays(8),20,0,j(['مقاولات']),isoDays(-30),isoDays(-3),0,null,null,null,null],
    ['mat_006','2026-006','CIV-044','نزاع إيجار - مطاعم الذوق','mt_civil','cli_007','مالك العقار','محكمة التنفيذ','EX-3321',null,'settled','normal','تسوية','تسوية ودية لنزاع إيجار.',j([adminId,'usr_lawyer2']),'fixed',15000,null,400,300,'SAR',isoDays(-120),isoDays(-15),'إغلاق الملف',null,100,0,j(['إيجار','تسوية']),isoDays(-120),isoDays(-15),0,null,null,'تسوية لصالح الموكل',null],
    ['mat_007','2025-019','ADM-003','اعتراض إداري - القحطاني','mt_admin','cli_008',null,'الديوان الإداري','ADM-551',null,'closed','normal','منتهي','اعتراض على قرار إداري وتم الفصل فيه.',j(['usr_lawyer1']),'fixed',10000,null,200,0,'SAR',isoDays(-260),isoDays(-50),null,null,100,0,j(['إداري']),isoDays(-260),isoDays(-50),1,isoDays(-20),2026,'حكم لصالح الموكل',null],
  ];
  const mStmt = db.prepare(`INSERT INTO matters (id,number,internalRef,title,typeId,clientId,opposingParty,courtName,caseNumber,judge,status,priority,stage,description,lawyerIds,feeType,agreedFee,hourlyRate,expenses,courtFees,currency,openedAt,closedAt,nextAction,nextActionDate,progress,confidential,tags,createdAt,updatedAt,archived,archivedAt,archiveYear,outcome,winRate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of matters) mStmt.run(...r);

  const agreements = [
    ['agr_001','mat_001','اتفاقية أتعاب - قضية الأفق','fee',45000,'SAR','دفعة مقدمة 15000 والباقي على دفعتين.',dateOnly(-98),null,'signed',3,15000,null,isoDays(-98),isoDays(-10),0],
    ['agr_002','mat_002','عقد تمثيل عمالي','retainer',12000,'SAR',null,dateOnly(-68),null,'executed',2,6000,null,isoDays(-68),isoDays(-20),0],
    ['agr_003','mat_003','اتفاقية أتعاب نسبة','fee',80000,'SAR',null,null,null,'draft',1,80000,null,isoDays(-54),isoDays(-2),0],
  ];
  db.prepare(`INSERT INTO agreements (id,matterId,title,type,amount,currency,terms,signedDate,expiresAt,status,installmentCount,installmentAmount,notes,createdAt,updatedAt,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(...agreements[0]); agreements.slice(1).forEach(r=>db.prepare(`INSERT INTO agreements (id,matterId,title,type,amount,currency,terms,signedDate,expiresAt,status,installmentCount,installmentAmount,notes,createdAt,updatedAt,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...r));

  const payments = [
    ['pay_001','mat_001','agr_001','fee',15000,'SAR',dateOnly(-95),'transfer','RC-1001','دفعة مقدمة',adminId,isoDays(-95),0],
    ['pay_002','mat_001',null,'court_fee',1200,'SAR',dateOnly(-80),'cash','RC-1008','رسوم المحكمة',adminId,isoDays(-80),0],
    ['pay_003','mat_002','agr_002','installment',6000,'SAR',dateOnly(-60),'transfer','RC-1012','الدفعة الأولى','usr_lawyer1',isoDays(-60),0],
    ['pay_004','mat_004',null,'fee',10000,'SAR',dateOnly(-35),'card','RC-1020','دفعة أتعاب',adminId,isoDays(-35),0],
    ['pay_005','mat_006',null,'fee',15000,'SAR',dateOnly(-18),'transfer','RC-1031','سداد نهائي بعد التسوية',adminId,isoDays(-18),0],
  ];
  const pStmt = db.prepare(`INSERT INTO payments (id,matterId,agreementId,kind,amount,currency,date,method,receiptNo,notes,recordedBy,createdAt,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of payments) pStmt.run(...r);

  const tasks = [
    ['tsk_001','إعداد مذكرة جوابية لقضية الأفق','صياغة الرد على دفوع الخصم وإرفاق المستندات.','mat_001',null,'usr_lawyer2',adminId,dateOnly(4),isoDays(3,9),'high','doing',j(['مذكرة']),j([{id:'chk1',text:'مراجعة عقد التوريد',done:true},{id:'chk2',text:'جمع الإيصالات',done:false}]),6,isoDays(-5),isoDays(-1),null,null,0],
    ['tsk_002','التواصل مع الموكل سالم الحربي',null,'mat_002','cli_002','usr_lawyer1',null,dateOnly(1),null,'normal','todo',j(['متابعة']),j([]),null,isoDays(-3),isoDays(-1),null,null,0],
    ['tsk_003','مراجعة مستندات شراكة روافد',null,'mat_003',null,adminId,null,dateOnly(2),null,'urgent','doing',j(['مستندات']),j([{id:'chk3',text:'تحليل عقد الشراكة',done:false}]),null,isoDays(-7),isoDays(-2),null,null,0],
    ['tsk_004','تجهيز ملف جلسة فهد العتيبي',null,'mat_004',null,adminId,null,dateOnly(0),null,'urgent','todo',j(['جلسة']),j([]),null,isoDays(-2),isoDays(-1),null,null,0],
    ['tsk_005','أرشفة ملف نزاع الإيجار',null,'mat_006',null,'usr_lawyer2',null,dateOnly(-10),null,'low','done',j(['أرشفة']),j([{id:'chk4',text:'رفع محضر التسوية',done:true}]),null,isoDays(-20),isoDays(-10),isoDays(-10),null,0],
  ];
  const tStmt = db.prepare(`INSERT INTO tasks (id,title,description,matterId,clientId,assigneeId,createdBy,dueDate,remindAt,priority,status,tags,checklist,estimatedHours,createdAt,updatedAt,completedAt,recurring,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of tasks) tStmt.run(...r);

  const events = [
    ['evt_001','جلسة مرافعة - شركة الأفق','hearing','mat_001','cli_001',isoDays(6,9),'10:30','المحكمة التجارية بالرياض','قاعة 3',null,null,'إحضار أصل العقد',null,'scheduled',2,0,isoDays(-10),isoDays(-1),0,null],
    ['evt_002','جلسة تسوية عمالية','meeting','mat_002','cli_002',isoDays(12,11),null,'المحكمة العمالية',null,null,null,null,null,'scheduled',3,0,isoDays(-8),isoDays(-2),0,null],
    ['evt_003','جلسة جزائية - فهد العتيبي','hearing','mat_004','cli_004',isoDays(1,9),null,'المحكمة الجزائية',null,null,null,null,null,'scheduled',1,1,isoDays(-6),isoDays(-1),0,null],
    ['evt_004','موعد تسليم مستندات','deadline','mat_003','cli_003',isoDays(3,16),null,null,null,null,null,'تسليم كشوف حسابات الشراكة',null,'scheduled',2,0,isoDays(-4),isoDays(-1),0,null],
    ['evt_005','اجتماع داخلي لمراجعة القضايا','internal',null,null,isoDays(7,13),null,'قاعة الاجتماعات',null,null,j([adminId,'usr_lawyer1','usr_lawyer2']),null,null,'scheduled',1,0,isoDays(-2),isoDays(-1),0,null],
  ];
  const eStmt = db.prepare(`INSERT INTO events (id,title,type,matterId,clientId,date,endTime,location,courtRoom,judge,attendees,notes,outcome,status,remindBeforeDays,remindersSent,createdAt,updatedAt,archived,archivedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of events) eStmt.run(...r);

  const notes = [
    ['note_001','mat_001','تم استلام نسخة من عقد التوريد ومراجعة البنود المالية.','note',adminId,1,isoDays(-9),isoDays(-9),0],
    ['note_002','mat_001','الخصم طلب مهلة إضافية لتقديم المستندات.','update','usr_lawyer2',0,isoDays(-3),isoDays(-3),0],
    ['note_003','mat_004','مكالمة مع الموكل لتأكيد الحضور للجلسة القادمة.','call',adminId,0,isoDays(-2),isoDays(-2),0],
  ];
  const nStmt = db.prepare(`INSERT INTO notes (id,matterId,body,kind,authorId,pinned,createdAt,updatedAt,archived) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const r of notes) nStmt.run(...r);

  const templates = [
    ['tpl_001','مذكرة جوابية','pleading','إلى المحكمة الموقرة...\nالموضوع: {{subject}}\nالوقائع: {{facts}}\nالطلبات: {{requests}}',j(['subject','facts','requests']),5,isoDays(-100),isoDays(-10),0],
    ['tpl_002','عقد أتعاب محاماة','contract','اتفق الطرفان على ما يلي...\nالموكل: {{client}}\nالقضية: {{matter}}\nالأتعاب: {{fee}}',j(['client','matter','fee']),8,isoDays(-120),isoDays(-20),0],
    ['tpl_003','خطاب مطالبة','correspondence','السيد/ {{name}} المحترم\nنطالبكم بسداد مبلغ {{amount}} وذلك بسبب {{reason}}.',j(['name','amount','reason']),3,isoDays(-80),isoDays(-15),0],
  ];
  const tplStmt = db.prepare(`INSERT INTO templates (id,name,category,body,variables,usageCount,createdAt,updatedAt,archived) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const r of templates) tplStmt.run(...r);

  const docs = [
    ['doc_001','عقد توريد - شركة الأفق','contract','mat_001','cli_001',null,null,'عقد_توريد.pdf','application/pdf',0,1,null,j(['عقد','توريد']),null,0,1,isoDays(-110),2,adminId,isoDays(-110),isoDays(-90),0,null,null],
    ['doc_002','مذكرة افتتاحية - مطالبة الأفق','pleading','mat_001','cli_001',null,null,'مذكرة_افتتاحية.pdf','application/pdf',0,2,'doc_001',j(['مذكرة']),null,0,0,null,4,'usr_lawyer2',isoDays(-85),isoDays(-12),0,null,null],
    ['doc_003','محضر تسوية - نزاع الإيجار','report','mat_006','cli_007',null,null,'محضر_تسوية.pdf','application/pdf',0,1,null,j(['تسوية']),null,0,1,isoDays(-16),1,adminId,isoDays(-16),isoDays(-15),0,null,null],
  ];
  const dStmt = db.prepare(`INSERT INTO documents (id,title,category,matterId,clientId,eventId,fileId,fileName,mime,size,version,parentId,tags,notes,confidential,requiresSignature,signedAt,printCount,createdBy,createdAt,updatedAt,archived,archivedAt,retentionUntil) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of docs) dStmt.run(...r);

  const library = [
    ['lib_001','نظام المرافعات الشرعية','book','وزارة العدل',null,null,'أنظمة','مرجع أساسي للإجراءات أمام المحاكم.','',null,'#2563EB',5,'reference',100,j(['نظام','مرافعات']),j([{id:'ln1',body:'مراجعة مواد الاختصاص.',page:45,createdAt:isoDays(-30)}]),1,isoDays(-120),isoDays(-5),adminId,0],
    ['lib_002','دليل صياغة العقود التجارية','book','مركز التدريب القانوني',null,null,'عقود','نماذج وبنود عملية للعقود.',null,null,'#0F766E',4,'reading',60,j(['عقود']),j([]),0,isoDays(-60),isoDays(-2),'usr_lawyer2',0],
    ['lib_003','مبادئ نظام العمل','article','هيئة الخبراء',null,null,'عمالي','ملخص لأهم أحكام نظام العمل.',null,null,'#D97706',4,'finished',100,j(['عمالي']),j([]),1,isoDays(-40),isoDays(-12),'usr_lawyer1',0],
  ];
  const lStmt = db.prepare(`INSERT INTO library (id,title,type,author,publisher,year,category,description,url,fileId,coverColor,rating,status,progress,tags,notes,isFavorite,addedAt,lastOpenedAt,addedBy,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of library) lStmt.run(...r);

  const activity = [
    ['act_001',adminId,'مدير النظام','create','client','cli_001','إضافة موكل: شركة الأفق للتجارة',isoDays(-120)],
    ['act_002',adminId,'مدير النظام','create','matter','mat_001','فتح قضية: مطالبة مالية - شركة الأفق',isoDays(-100)],
    ['act_003','usr_lawyer2','المحامية نورة العتيبي','update','document','doc_002','تحديث مذكرة افتتاحية',isoDays(-12)],
    ['act_004',adminId,'مدير النظام','create','payment','pay_005','تسجيل سداد نهائي',isoDays(-18)],
  ];
  const aStmt = db.prepare(`INSERT INTO activity (id,userId,userName,action,entity,entityId,meta,at) VALUES (?,?,?,?,?,?,?,?)`);
  for (const r of activity) aStmt.run(...r);

  const notifications = [
    ['ntf_001','جلسة قريبة','جلسة جزائية - فهد العتيبي غدًا الساعة 9:00.','deadline','event','evt_003',0,isoDays(-1,8),'/events'],
    ['ntf_002','مهمة عاجلة','مراجعة مستندات شراكة روافد مستحقة قريبًا.','task','task','tsk_003',0,isoDays(-1,12),'/tasks'],
    ['ntf_003','دفعة مستلمة','تم تسجيل دفعة بمبلغ 15,000 ر.س لقضية الأفق.','payment','payment','pay_001',1,isoDays(-20,10),'/payments'],
  ];
  const ntStmt = db.prepare(`INSERT INTO notifications (id,title,body,kind,refType,refId,read,at,link) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const r of notifications) ntStmt.run(...r);
}

export function runSeed() {
  ensureAdminAndCore();
  seedDemoDataIfEmpty();
}