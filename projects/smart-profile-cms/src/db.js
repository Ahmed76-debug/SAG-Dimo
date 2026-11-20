const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'app.db');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hero_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS about_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS vmv (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS values_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      title TEXT NOT NULL,
      description TEXT,
      bullets TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subitems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS process_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      num TEXT,
      title TEXT NOT NULL,
      body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS why_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      title TEXT NOT NULL,
      body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      title TEXT NOT NULL,
      body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      title TEXT NOT NULL,
      body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      title TEXT NOT NULL,
      body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT,
      title TEXT NOT NULL,
      body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS contact_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      value TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      company TEXT,
      email TEXT,
      phone TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS experiences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      title TEXT NOT NULL,
      organization TEXT,
      period TEXT,
      body TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'current',
      industry TEXT,
      note TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function now() { return new Date().toISOString(); }

function seed() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (row && row.c > 0) return;

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
  db.prepare('INSERT INTO users (username, salt, password_hash, role, created_at) VALUES (?,?,?,?,?)')
    .run('admin', salt, hash, 'admin', now());

  const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 96">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs>
      <rect width="320" height="96" rx="18" fill="url(#g)"/>
      <circle cx="52" cy="48" r="25" fill="none" stroke="#fff" stroke-width="4" opacity=".95"/>
      <path d="M40 58h24M52 36v24" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
      <text x="90" y="43" fill="#fff" font-family="Arial,sans-serif" font-size="22" font-weight="700">SMART ACTIVITY</text>
      <text x="90" y="70" fill="#ccfbf1" font-family="Arial,sans-serif" font-size="16" font-weight="500">GROUP • مجموعة الأنشطه الذكيه</text>
    </svg>`);

  const settings = {
    company_name: 'SMART ACTIVITY GROUP',
    tagline: 'مجموعة الأنشطه الذكيه • توريدات عامة وحلول إمداد',
    hero_title: 'شريكك الموثوق في التوريدات العامة وإدارة الإمداد',
    hero_subtitle: 'نوفّر لشركتك كل ما تحتاجه من مستلزمات مكتبية وتنظيف وتقنية وسلامة وتعبئة وصيانة—من اختيار المورد حتى التسليم والمتابعة، بشريك واحد مسؤول عن النتيجة.',
    hero_badge: '🟢 جاهز للتعاقد الفوري',
    hero_note: 'اتفاقيات إطار • أوامر شراء مفتوحة • طلبات سريعة',
    about_intro: 'تأسست مجموعة الأنشطه الذكيه لتكون ذراع التوريد الموثوقة للشركات والمؤسسات في مصر والخليج. نجمع بين شبكة موردين مُختارة وخبرة تشغيلية في اللوجستيات، لنقدّم تجربة شراء أبسط وأسرع وأكثر شفافية—مع تقارير دورية تجعل قرارك مبنياً على أرقام واضحة.',
    footer_note: 'جودة • سرعة • التزام',
    logo_url: LOGO,
    company_email: 'sales@smartactivitygroup.com',
    whatsapp_number: '01000762462',
    linkedin_url: 'https://www.linkedin.com/company/smart-activity-group/',
    website_url: 'https://smartactivitygroup.com',
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    whatsapp_phone_number_id: '',
    whatsapp_access_token: '',
    whatsapp_recipient: '',
  };
  const insSetting = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)');
  for (const [k,v] of Object.entries(settings)) insSetting.run(k, v, now());

  const insStat = db.prepare('INSERT INTO hero_stats (label, label_en, label_ar, value, icon, sort_order) VALUES (?,?,?,?,?,?)');
  [
    ['سنة خبرة في التوريد','Years of supply expertise','سنة خبرة في التوريد','12+','📈',1],
    ['عميل من الشركات والمؤسسات','Corporate & institutional clients','عميل من الشركات والمؤسسات','180+','🏢',2],
    ['صنف متاح للتوريد','Ready-to-supply SKUs','صنف متاح للتوريد','4,500','📦',3],
    ['نسبة الالتزام بالمواعيد','On-time delivery rate','نسبة الالتزام بالمواعيد','98.6%','✅',4],
  ].forEach(r => insStat.run(...r));

  const insAbout = db.prepare('INSERT INTO about_items (text, text_en, text_ar, sort_order) VALUES (?,?,?,?)');
  [
    ['توريد متعدد الفئات من مصدر واحد: مكتبية، نظافة، تقنية، سلامة، تعبئة، أدوات وقطع غيار.', 'Multi-category sourcing from one partner: office, hygiene, IT, safety, packing, tools and spare parts.', 'توريد متعدد الفئات من مصدر واحد: مكتبية، نظافة، تقنية، سلامة، تعبئة، أدوات وقطع غيار.', 1],
    ['عقود توريد مرنة: اتفاقيات إطار، أوامر شراء مفتوحة، وتوريد عند الطلب.', 'Flexible contracts: framework agreements, blanket POs and on-demand supply.', 'عقود توريد مرنة: اتفاقيات إطار، أوامر شراء مفتوحة، وتوريد عند الطلب.', 2],
    ['إدارة سلسلة إمداد كاملة تشمل النقل، الاستلام، والجرد في مواقعكم.', 'Full supply-chain management including transport, receiving and on-site inventory control.', 'إدارة سلسلة إمداد كاملة تشمل النقل، الاستلام، والجرد في مواقعكم.', 3],
    ['تقارير دورية واضحة للمصروفات والالتزام بالمواعيد وجودة التوريد.', 'Clear periodic reporting on spend, OTIF and supply quality.', 'تقارير دورية واضحة للمصروفات والالتزام بالمواعيد وجودة التوريد.', 4],
    ['تخصيص كامل في التغليف والعلامة التجارية وتجميع الكيتات حسب المشروع.', 'Full customization in packaging, branding and project-specific kitting.', 'تخصيص كامل في التغليف والعلامة التجارية وتجميع الكيتات حسب المشروع.', 5],
    ['مدير حساب واحد مسؤول عن كل تفصيلة، من العرض حتى ما بعد التسليم.', 'One account manager accountable for every detail—from quotation to after-delivery support.', 'مدير حساب واحد مسؤول عن كل تفصيلة، من العرض حتى ما بعد التسليم.', 6],
  ].forEach(r => insAbout.run(...r));

  const insVmv = db.prepare('INSERT INTO vmv (kind, title, title_en, title_ar, body, sort_order) VALUES (?,?,?,?,?,?)');
  insVmv.run('vision','رؤيتنا','Our Vision','رؤيتنا','أن نكون الشريك المفضل لتوريدات الشركات في المنطقة—موثوقاً، سريعاً، وقابلاً للتوسع مع نمو عملائنا.',1);
  insVmv.run('mission','رسالتنا','Our Mission','رسالتنا','نبسّط شراء المستلزمات ونرفع كفاءة الإمداد لعملائنا عبر منتجات موثوقة، أسعار شفافة، وتسليم في الوقت المحدد.',2);
  insVmv.run('values_card','قيمنا','Our Values','قيمنا','الجودة، الالتزام، الشفافية، المرونة، السلامة، خدمة العميل، والاستمرارية في التحسين.',3);

  const insValue = db.prepare('INSERT INTO values_list (label, label_en, label_ar, sort_order) VALUES (?,?,?,?)');
  [
    ['الجودة','Quality','الجودة'],['الالتزام','Commitment','الالتزام'],['الشفافية','Transparency','الشفافية'],
    ['المرونة','Flexibility','المرونة'],['السلامة','Safety','السلامة'],['خدمة العميل','Customer care','خدمة العميل'],['التحسين المستمر','Continuous improvement','التحسين المستمر'],
  ].forEach((r,i) => insValue.run(r[0], r[1], r[2], i+1));

  const insService = db.prepare('INSERT INTO services (icon, title, title_en, title_ar, description, bullets, sort_order) VALUES (?,?,?,?,?,?,?)');
  [
    ['🛒','توريد وتحديد الموردين','Procurement & Sourcing','توريد وتحديد الموردين','نختار المورد الأنسب لكل فئة، ونقارن العروض، ونتفاوض من أجلك، ثم نتولى إجراءات التعاقد.', ['دعم RFQ / RFP','تحقق من المورد واعتماده','اتفاقيات أسعار ثابتة'],1],
    ['📦','التوريد المجدول والدوري','Supply & Fulfillment','التوريد المجدول والدوري','توريد حسب الطلب أو بجدول زمني ثابت مع تتبع كل طلب حتى الاستلام.', ['أوامر شراء مفتوحة','تسليمات جزئية حسب الحاجة','طلبات طارئة خلال ساعات'],2],
    ['🚚','النقل والتسليم','Logistics & Delivery','النقل والتسليم','من المستودع إلى موقعك، مع التنسيق مع فريق الاستلام وجدول التشغيل لديكم.', ['تسليم من الباب إلى الباب','رحلات مجدولة','تنسيق الاستلام في الموقع'],3],
    ['📊','المخزون وإعادة التوريد','Inventory & Replenishment','المخزون وإعادة التوريد','نضع حدوداً دنيا لكل صنف، ونتابع الاستهلاك، ونبادر بإعادة التوريد قبل النفاد.', ['ضبط الحد الأدنى والأقصى','تدوير المخزون','تقارير استهلاك دورية'],4],
    ['🧩','حلول مخصصة وتجميع','Custom Solutions','حلول مخصصة وتجميع','كيتات جاهزة لكل موظف أو موقع، بتغليف وعلامة تجارية تعكس هوية شركتك.', ['كيتات استلام الموظفين','تغليف بشعارك','حزم خاصة بالمشاريع'],5],
    ['🧾','الفوترة والتقارير','Billing & Reporting','الفوترة والتقارير','فواتير منظمة، كشوف شهرية، وتحليل للمصروفات يساعدك على خفض التكلفة.', ['فواتير ضريبية جاهزة','تقارير مصروفات','دعم المراجعة الداخلية'],6],
  ].forEach(r => insService.run(r[0],r[1],r[2],r[3],r[4],JSON.stringify(r[5]),r[6]));

  const insCat = db.prepare('INSERT INTO categories (title, title_en, title_ar, icon, description, sort_order) VALUES (?,?,?,?,?,?)');
  const insSub = db.prepare('INSERT INTO subitems (category_id, text, text_en, text_ar, sort_order) VALUES (?,?,?,?,?)');
  const cats = [
    ['مكتبية وقرطاسية','Office & Stationery','مكتبية وقرطاسية','✏️','كل ما تحتاجه الإدارة اليومية من ورق وأحبار وأدوات تنظيم.', [
      ['ورق A4/A3 وألوان', 'A4/A3 and colored paper', 'ورق A4/A3 وألوان'],
      ['أحبار وطابعات', 'Toners, inks and cartridges', 'أحبار وطابعات'],
      ['ملفات وأرشيف', 'Folders, binders and archive boxes', 'ملفات وأرشيف'],
      ['أدوات كتابة', 'Pens, markers and highlighters', 'أدوات كتابة'],
      ['سبورات وملحقات', 'Whiteboards and accessories', 'سبورات وملحقات'],
    ]],
    ['نظافة وتعقيم','Hygiene & Cleaning','نظافة وتعقيم','🧼','مستهلكات ومعدات تنظيف للمنشآت بجميع أحجامها.', [
      ['منظفات الأسطح والأرضيات', 'Surface and floor cleaners', 'منظفات الأسطح والأرضيات'],
      ['معقمات الأيدي والأسطح', 'Hand and surface sanitizers', 'معقمات الأيدي والأسطح'],
      ['مناديل ورقية', 'Tissues and paper towels', 'مناديل ورقية'],
      ['أكياس قمامة', 'Garbage bags all sizes', 'أكياس قمامة'],
      ['معدات تنظيف', 'Mops, brooms and machines', 'معدات تنظيف'],
    ]],
    ['تقنية واتصالات','IT & Telecom','تقنية واتصالات','💻','إكسسوارات وقطع تخدم بيئة العمل التقنية.', [
      ['كابلات ومهايئات', 'Cables and adapters', 'كابلات ومهايئات'],
      ['وحدات تخزين', 'Storage devices', 'وحدات تخزين'],
      ['لوحات المفاتيح والفئران', 'Keyboards and mice', 'لوحات المفاتيح والفئران'],
      ['سماعات ومكالمات', 'Headsets and telephony', 'سماعات ومكالمات'],
      ['معدات شبكات صغيرة', 'Small network equipment', 'معدات شبكات صغيرة'],
    ]],
    ['سلامة ووقاية','Safety & PPE','سلامة ووقاية','🦺','معدات حماية معتمدة تحفظ سلامة فرق العمل.', [
      ['خوذ ونظارات', 'Helmets and goggles', 'خوذ ونظارات'],
      ['قفازات وأقنعة', 'Gloves and masks', 'قفازات وأقنعة'],
      ['سترات وملابس', 'Vests and coveralls', 'سترات وملابس'],
      ['أحذية السلامة', 'Safety shoes', 'أحذية السلامة'],
      ['حقائب إسعاف', 'First aid kits', 'حقائب إسعاف'],
    ]],
    ['تعبئة وتغليف','Packing & Packaging','تعبئة وتغليف','📦','حلول تغليف تحمي منتجاتك وتحسّن تجربة الشحن.', [
      ['صناديق كرتون', 'Carton boxes', 'صناديق كرتون'],
      ['أشرطة ولفائح', 'Tapes and stretch film', 'أشرطة ولفائح'],
      ['ملصقات وباركود', 'Labels and barcodes', 'ملصقات وباركود'],
      ['أكياس الشحن', 'Shipping and mailer bags', 'أكياس الشحن'],
    ]],
    ['أدوات وصيانة','Tools & Maintenance','أدوات وصيانة','🔧','عدد يدوية وكهربائية لفرق الصيانة والورش.', [
      ['مفكات وكماشات', 'Screwdrivers and pliers', 'مفكات وكماشات'],
      ['مثاقب وملحقات', 'Drills and accessories', 'مثاقب وملحقات'],
      ['أدوات قياس', 'Measuring tools', 'أدوات قياس'],
      ['حقائب عدد', 'Toolboxes and bags', 'حقائب عدد'],
    ]],
    ['قطع غيار','Spare Parts','قطع غيار','🛠️','قطع استبدال للسيارات والآلات والمعدات المكتبية.', [
      ['فلاتر وزيوت', 'Filters and lubricants', 'فلاتر وزيوت'],
      ['سيور وحلق', 'Belts and bearings', 'سيور وحلق'],
      ['بطاريات', 'Batteries', 'بطاريات'],
      ['قطع كهربائية', 'Electrical spares', 'قطع كهربائية'],
    ]],
    ['حلول مخصصة','Custom Solutions','حلول مخصصة','✨','توريدات تُبنى حسب نطاق مشروعك أو هوية علامتك.', [
      ['كيتات بداية المشروع', 'Project mobilization kits', 'كيتات بداية المشروع'],
      ['تغليف بعلامتك التجارية', 'Branded packaging', 'تغليف بعلامتك التجارية'],
      ['حزم متعددة المواقع', 'Multi-site bundles', 'حزم متعددة المواقع'],
      ['توريد حسب المواصفة', 'Bespoke sourcing', 'توريد حسب المواصفة'],
    ]],
  ];
  cats.forEach((c,i) => {
    const r = insCat.run(c[0], c[1], c[2], c[3], c[4], i+1);
    const cid = Number(r.lastInsertRowid);
    (c[5] || []).forEach((s,j) => insSub.run(cid, s[0], s[1], s[2], j+1));
  });

  const insProc = db.prepare('INSERT INTO process_steps (num, title, title_en, title_ar, body, sort_order) VALUES (?,?,?,?,?,?)');
  [
    ['01','استلام الطلب','Request','استلام الطلب','نموذج أو أمر شراء أو بريد—ونحوّله إلى متطلب واضح.'],
    ['02','العرض والسعر','Quotation','العرض والسعر','سعر تفصيلي مع مدة التوريد والبدائل المتاحة.'],
    ['03','الاعتماد','Approval','الاعتماد','تثبيت النطاق والكميات وجدول التسليم.'],
    ['04','التوريد','Procurement','التوريد','تجهيز الأصناف من الموردين المعتمدين وفحصها.'],
    ['05','التسليم','Delivery','التسليم','نقل واستلام ومطابقة مع مستنداتك.'],
    ['06','الفوترة والمتابعة','Invoice & Review','الفوترة والمتابعة','فاتورة وتقرير أداء ومراجعة دورية للتطوير.'],
  ].forEach((r,i) => insProc.run(r[0],r[1],r[2],r[3],r[4],i+1));

  const insWhy = db.prepare('INSERT INTO why_items (icon, title, title_en, title_ar, body, sort_order) VALUES (?,?,?,?,?,?)');
  [
    ['⚡','استجابة سريعة','Fast response','استجابة سريعة','عروض خلال يوم عمل، ودعم طارئ عند الحاجة.'],
    ['✔️','جودة متسقة','Consistent quality','جودة متسقة','موردون مُقيّمون وفحص استلام قبل التسليم.'],
    ['💰','أسعار تنافسية','Competitive pricing','أسعار تنافسية','اتفاقيات حجم وتسعير شفاف بلا مفاجآت.'],
    ['🤝','مسؤول واحد','Single point of contact','مسؤول واحد','مدير حساب يتابع طلبك من البداية للنهاية.'],
    ['🛡️','امتثال ومستندات','Compliance-ready','امتثال ومستندات','فواتير وشهادات وتوثيق يدعم مراجعتك الداخلية.'],
    ['📈','تحسين مستمر','Continuous improvement','تحسين مستمر','مؤشرات تسليم ومصروفات تُراجع معك دورياً.'],
  ].forEach((r,i) => insWhy.run(r[0],r[1],r[2],r[3],r[4],i+1));

  const insStd = db.prepare('INSERT INTO standards (icon, title, title_en, title_ar, body, sort_order) VALUES (?,?,?,?,?,?)');
  [
    ['📜','السجل التجاري','Commercial Registration','السجل التجاري','مسجل رسمياً — رقم 1478521 (قابل للتعديل من الإعدادات).'],
    ['🧾','التسجيل الضريبي','VAT Registration','التسجيل الضريبي','مسجل ضريبياً — رقم 362-589-741 (قابل للتعديل).'],
    ['🏅','نظام الجودة ISO 9001','ISO 9001:2015','نظام الجودة ISO 9001','إجراءات تشغيل موثقة ومراجعة دورية للجودة.'],
    ['🌱','السلامة والاستدامة','HSE & Sustainability','السلامة والاستدامة','التزام بمعايير السلامة وتقليل الهدر في التغليف.'],
  ].forEach((r,i) => insStd.run(r[0],r[1],r[2],r[3],r[4],i+1));

  const insSeg = db.prepare('INSERT INTO segments (icon, title, title_en, title_ar, body, sort_order) VALUES (?,?,?,?,?,?)');
  [
    ['🏢','الشركات الكبيرة','Large enterprises','الشركات الكبيرة','اتفاقيات إطار، مؤشرات أداء، وتوريد متعدد المواقع.'],
    ['🏬','الشركات المتوسطة','Mid-market','الشركات المتوسطة','تحسين التكلفة وإعادة توريد منظمة دون تعقيد.'],
    ['🏠','الشركات الصغيرة','Small businesses','الشركات الصغيرة','عروض سريعة، أصناف متنوعة، وتسليم مرن.'],
  ].forEach((r,i) => insSeg.run(r[0],r[1],r[2],r[3],r[4],i+1));

  const insModel = db.prepare('INSERT INTO models (icon, title, title_en, title_ar, body, sort_order) VALUES (?,?,?,?,?,?)');
  [
    ['🤝','اتفاقية إطار','Framework Agreement','اتفاقية إطار','أسعار وشروط متفق عليها لتوريد مستمر من 6 إلى 24 شهراً.'],
    ['🧾','أمر شراء مفتوح','Blanket PO','أمر شراء مفتوح','إصدارات على دفعات مقابل أصناف وأسعار محددة مسبقاً.'],
    ['🎯','توريد بالمشروع','Project-Based Supply','توريد بالمشروع','كيتات تجهيز موقع وتغليف خاص ومتابعة حتى الإغلاق.'],
    ['⚡','طلب سريع','On-Demand Supply','طلب سريع','عرض سريع للاحتياجات العاجلة مع تسليم خلال يومين.'],
  ].forEach((r,i) => insModel.run(r[0],r[1],r[2],r[3],r[4],i+1));

  const insCase = db.prepare('INSERT INTO cases (tag, tag_en, tag_ar, title, title_en, title_ar, body, sort_order) VALUES (?,?,?,?,?,?,?,?)');
  [
    ['دراسة حالة','Case study','دراسة حالة','توحيد المستهلكات في 9 مواقع','Consumables rollout across 9 sites','توحيد المستهلكات في 9 مواقع','وحّدنا 320 صنفاً، وخُفض المصروف 14%، وارتفع الالتزام بالمواعيد إلى 98%.'],
    ['دراسة حالة','Case study','دراسة حالة','برنامج نظافة لمصنع','Hygiene program for a plant','برنامج نظافة لمصنع','توريد معدات الوقاية ومواد التنظيف مع جدول متابعة أسبوعي وخفض الحوادث.'],
    ['دراسة حالة','Case study','دراسة حالة','كيتات استقبال الموظفين','Employee onboarding kits','كيتات استقبال الموظفين','120 كيتاً تقنياً ومكتبياً بعلامة العميل، سُلّمت خلال 48 ساعة.'],
    ['دراسة حالة','Case study','دراسة حالة','تغليف بشعار العلامة','Branded packaging program','تغليف بشعار العلامة','تصميم وتوريد عبوات مخصصة لخط إنتاج موسمي مع تقليل الهدر 22%.'],
  ].forEach((r,i) => insCase.run(r[0],r[1],r[2],r[3],r[4],r[5],r[6],i+1));

  const insCF = db.prepare('INSERT INTO contact_fields (label, label_en, label_ar, value, sort_order) VALUES (?,?,?,?,?)');
  [
    ['الشركة','Company','الشركة','SMART ACTIVITY GROUP'],
    ['مسؤول التواصل','Contact person','مسؤول التواصل','أحمد يوسف الخلالي'],
    ['الهاتف / واتساب','Phone / WhatsApp','الهاتف / واتساب','01000762462'],
    ['البريد الإلكتروني','Email','البريد الإلكتروني','sales@smartactivitygroup.com'],
    ['العنوان','Address','العنوان','القاهرة، جمهورية مصر العربية'],
    ['الموقع الإلكتروني','Website','الموقع الإلكتروني','smartactivitygroup.com'],
  ].forEach((r,i) => insCF.run(r[0],r[1],r[2],r[3],i+1));

  const insExp = db.prepare('INSERT INTO experiences (icon, title, title_en, title_ar, organization, period, body, sort_order) VALUES (?,?,?,?,?,?,?,?)');
  [
    ['💼','توريد شامل لعدة مواقع','Multi-site supply program','توريد شامل لعدة مواقع','مجموعة النخبة للاستثمار','2023 – 2025','إدارة توريد 320 صنفاً عبر 9 مواقع مع تقارير مصروفات شهرية.'],
    ['🏭','برنامج سلامة وتنظيف','Safety & hygiene program','برنامج سلامة وتنظيف','شركة النور للصناعات','2022 – 2024','توريد معدات الوقاية ومواد التنظيف وتنفيذ زيارات متابعة دورية.'],
    ['💻','تجهيز فرق تقنية','Tech team enablement','تجهيز فرق تقنية','شركة المدار للتقنية','2024','120 كيتاً تقنياً بأحجام مختلفة، بتسليم خلال 48 ساعة.'],
    ['🎁','تغليف موسمي مخصص','Seasonal branded packaging','تغليف موسمي مخصص','مجموعة الخليج للتجزئة','2025','تصميم وتوريد عبوات مخصصة مع خفض الهدر بنسبة 22%.'],
  ].forEach((r,i) => insExp.run(r[0],r[1],r[2],r[3],r[4],r[5],r[6],i+1));

  const insPart = db.prepare('INSERT INTO partners (name, name_en, name_ar, status, industry, note, sort_order) VALUES (?,?,?,?,?,?,?)');
  [
    ['مجموعة النخبة للاستثمار','Elite Investment Group','مجموعة النخبة للاستثمار','current','استثمار وتطوير عقاري','اتفاقية إطار لتوريد المستهلكات'],
    ['شركة النور للصناعات الغذائية','Al Noor Food Industries','شركة النور للصناعات الغذائية','current','صناعات غذائية','برنامج سلامة وتنظيف مستمر'],
    ['شركة المدار للتقنية','Madar Technology','شركة المدار للتقنية','current','تقنية المعلومات','كيتات استقبال وتجهيز فرق'],
    ['مستشفيات الأمل','Al Amal Hospitals','مستشفيات الأمل','current','رعاية صحية','توريد مستهلكات طبية ووقائية'],
    ['فنادق الخليج','Gulf Hotels','فنادق الخليج','previous','ضيافة','توريد موسمي منتهٍ بنجاح'],
    ['مصانع الندى','Al Nada Factories','مصانع الندى','previous','تصنيع','توريد أدوات وصيانة لعام كامل'],
  ].forEach((r,i) => insPart.run(r[0],r[1],r[2],r[3],r[4],r[5],i+1));

  const insMsg = db.prepare('INSERT INTO messages (name, company, email, phone, message, status, created_at) VALUES (?,?,?,?,?,?,?)');
  [
    ['سارة العتيبي','شركة أفق للتجارة','sara@ofooq.example','0551234567','نحتاج عرض سعر لتوريد مواد مكتبية ونظافة لمقر جديد خلال أسبوعين.','new','2026-11-18T09:24:00.000Z'],
    ['محمد صلاح','مجموعة النور','m.salah@alnoor.example','0102345678','هل يمكن توريد 200 كيت سلامة مع شعار الشركة خلال 10 أيام؟','read','2026-11-16T11:40:00.000Z'],
    ['لمى الحربي','إدارة المرافق','lama@facility.example','0509876543','نرغب في اتفاقية إطار لمدة عام لتوريد مستهلكات التنظيف في 4 مواقع.','new','2026-11-14T08:05:00.000Z'],
    ['أحمد النجار','شركة مسار','ahmed@masar.example','0105566778','طلب عرض لتوريد أحبار وورق A4 بكميات شهرية ثابتة.','archived','2026-11-10T13:15:00.000Z'],
  ].forEach(r => insMsg.run(...r));
}

function ensureColumn(table, name, type = 'TEXT') {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}

function ensureBilingualColumns() {
  const map = {
    hero_stats: ['label_en','label_ar'],
    about_items: ['text_en','text_ar'],
    vmv: ['title_en','title_ar'],
    values_list: ['label_en','label_ar'],
    services: ['title_en','title_ar'],
    categories: ['title_en','title_ar'],
    subitems: ['text_en','text_ar'],
    process_steps: ['title_en','title_ar'],
    why_items: ['title_en','title_ar'],
    standards: ['title_en','title_ar'],
    segments: ['title_en','title_ar'],
    models: ['title_en','title_ar'],
    cases: ['title_en','title_ar','tag_en','tag_ar'],
    contact_fields: ['label_en','label_ar'],
    experiences: ['title_en','title_ar'],
    partners: ['name_en','name_ar'],
  };
  for (const [t, cols] of Object.entries(map)) {
    cols.forEach(c => ensureColumn(t, c, 'TEXT'));
  }
}

function seedDefaults() {
  // ensure logo setting exists
  const logoSetting = db.prepare('SELECT 1 AS ok FROM settings WHERE key=?').get('logo_url');
  if (!logoSetting) {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)')
      .run('logo_url', '', new Date().toISOString());
  }
  // ensure contact/notification settings exist
  const contactDefaults = {
    company_email: 'sales@smartactivitygroup.com',
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    whatsapp_number: '',
    whatsapp_phone_number_id: '',
    whatsapp_access_token: '',
    whatsapp_recipient: '',
  };
  for (const [k,v] of Object.entries(contactDefaults)) {
    const ex = db.prepare('SELECT 1 AS ok FROM settings WHERE key=?').get(k);
    if (!ex) {
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)')
        .run(k, v, new Date().toISOString());
    }
  }
  const expCount = db.prepare('SELECT COUNT(*) AS c FROM experiences').get().c;
  if (expCount === 0) {
    const insExp = db.prepare('INSERT INTO experiences (icon, title, organization, period, body, sort_order) VALUES (?,?,?,?,?,?)');
    [
      ['💼','General Supplies Rollout','Enterprise client','2023–2024','End-to-end supply program across multiple sites with standard SKUs and replenishment.'],
      ['🏭','Facility Hygiene Program','Manufacturing site','2022–2023','PPE + cleaning materials with site monitoring and safety compliance.'],
      ['💻','IT Onboarding Kits','Technology company','2024','Per-employee IT accessory bundles with fast delivery and warranty support.'],
    ].forEach((e,i) => insExp.run(e[0],e[1],e[2],e[3],e[4],i+1));
  }
  const partCount = db.prepare('SELECT COUNT(*) AS c FROM partners').get().c;
  if (partCount === 0) {
    const insPart = db.prepare('INSERT INTO partners (name, status, industry, note, sort_order) VALUES (?,?,?,?,?)');
    [
      ['Client A','current','Manufacturing','Active framework agreement'],
      ['Client B','current','Facilities Management','Recurring consumables'],
      ['Client C','previous','Oil & Gas','Completed project supply'],
      ['Client D','previous','Construction','Mobilization kits'],
      ['Client E','current','Healthcare','PPE & hygiene program'],
    ].forEach((p,i) => insPart.run(p[0],p[1],p[2],p[3],i+1));
  }
}

function init() {
  initSchema();
  ensureBilingualColumns();
  seed();
  seedDefaults();
}

module.exports = { db, init, now };
