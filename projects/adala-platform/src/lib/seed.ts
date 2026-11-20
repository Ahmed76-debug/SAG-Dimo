import { db, nowISO } from "./db";
import { hashPassword, randomSalt } from "./auth";
import type {
  ActivityEntry,
  Agreement,
  AppNotification,
  Client,
  DocTemplate,
  LegalDocument,
  LegalEvent,
  LibraryItem,
  Matter,
  MatterNote,
  MatterType,
  Payment,
  PortfolioContent,
  Settings,
  Task,
  User,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
const isoDays = (offset: number, hour = 10) => {
  const d = new Date(Date.now() + offset * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateOnly = (offset: number) => isoDays(offset).slice(0, 10);

export const users: Array<Omit<User, "passwordHash" | "salt"> & { password: string }> = [
  {
    id: "usr_admin",
    name: "مدير النظام",
    username: "admin",
    email: "admin@adala.local",
    phone: "0500000001",
    role: "admin",
    title: "مدير المكتب",
    bio: "إدارة النظام والمستخدمين وإعدادات المكتب.",
    avatarColor: "#B08419",
    isActive: true,
    /* كلمة المرور الافتراضية — تُشفَّر PBKDF2 عند البذر ولا تُحفظ نصًا صريحًا */
    password: "admin123",
    notificationsEnabled: true,
    createdAt: nowISO(),
  },
];

export const matterTypes: MatterType[] = [
  { id: "mt_civil", name: "مدني", color: "#2563EB", icon: "scale", description: "القضايا المدنية والتعويضات" },
  { id: "mt_crim", name: "جنائي", color: "#DC2626", icon: "gavel", description: "القضايا الجنائية والدفاع" },
  { id: "mt_com", name: "تجاري", color: "#0F766E", icon: "briefcase", description: "القضايا التجارية والشركات" },
  { id: "mt_labor", name: "عمالي", color: "#D97706", icon: "users", description: "نزاعات العمل والأجور" },
  { id: "mt_admin", name: "إداري", color: "#7C3AED", icon: "building", description: "القضايا الإدارية والقرارات" },
];

// تُستخدم كمصدر للبذر الأولي؛ البيانات التجريبية الكاملة تُبنى داخل seedDemoData
export const clients: Client[] = [];
export const matters: Matter[] = [];
export const agreements: Agreement[] = [];
export const payments: Payment[] = [];
export const tasks: Task[] = [];
export const events: LegalEvent[] = [];
export const documents: LegalDocument[] = [];
export const notes: MatterNote[] = [];
export const library: LibraryItem[] = [];
export const templates: DocTemplate[] = [];
export const activity: ActivityEntry[] = [];
export const notifications: AppNotification[] = [];

export const settings: Settings = {
  id: "settings",
  profile: {
    firmName: "مكتب العدالة للمحاماة",
    tagline: "استشارات قانونية وتمثيل نظامي باحترافية",
    lawyerName: "المحامي أحمد العدل",
    licenseNumber: "LIC-45872",
    email: "info@adala.local",
    phone: "0112345678",
    address: "الرياض، طريق الملك فهد",
    website: "https://adala.local",
  },
  theme: "system",
  density: "comfortable",
  reminderLeadDays: 3,
  dailyDigest: true,
  soundEnabled: true,
  currency: "SAR",
  defaultFeeType: "fixed",
  archiveAfterMonths: 12,
  autoArchiveClosed: false,
  printHeader: "مكتب العدالة للمحاماة والاستشارات القانونية",
  printFooter: "هذه الوثيقة سرية وللاستخدام النظامي فقط",
  confidentialityNotice: "سري — للاطلاع من قبل الأطراف المخولة فقط.",
  sidebarCollapsed: false,
};

export const portfolio: PortfolioContent = {
  id: "portfolio",
  heroTitle: "المحامي أحمد العدل — محاماة واستشارات نظامية",
  heroSubtitle:
    "نقدّم حلولًا قانونية عملية في القضايا المدنية والتجارية والعمالية والجنائية، مع متابعة دقيقة للمواعيد والإجراءات والنتائج.",
  heroCta: "احجز استشارة",
  aboutTitle: "نبذة عن المكتب",
  aboutBody:
    "مكتب العدالة للمحاماة يقدم خدمات الترافع والاستشارات وصياغة العقود وإدارة النزاعات للأفراد والشركات، مع الالتزام بالسرية والدقة المهنية.",
  stats: [
    { label: "قضية", value: "520", suffix: "+" },
    { label: "موكل", value: "430", suffix: "+" },
    { label: "سنوات خبرة", value: "14", suffix: "+" },
    { label: "نسبة رضا", value: "97", suffix: "%" },
  ],
  services: [
    { title: "القضايا المدنية", description: "التعويضات والمطالبات والنزاعات المدنية.", icon: "scale" },
    { title: "القضايا التجارية", description: "الشركات والعقود والنزاعات التجارية.", icon: "briefcase" },
    { title: "القضايا العمالية", description: "حقوق العمال والأجور والفصل التعسفي.", icon: "users" },
    { title: "القضايا الجنائية", description: "الدفاع والمتابعة أمام الجهات المختصة.", icon: "gavel" },
  ],
  expertise: [
    { title: "صياغة ومراجعة العقود", description: "عقود تجارية ومدنية واتفاقيات تسوية.", items: ["عقود خدمات", "اتفاقيات سرية", "مذكرات تفاهم"] },
    { title: "التقاضي والترافع", description: "تمثيل الموكلين أمام المحاكم واللجان.", items: ["مرافعات", "مذكرات جوابية", "استئناف ونقض"] },
  ],
  experience: [
    { period: "2012 — الآن", title: "الشريك المؤسس", org: "مكتب العدالة للمحاماة", description: "إدارة المكتب والإشراف على القضايا والاستشارات." },
    { period: "2008 — 2012", title: "محامٍ أول", org: "مكتب خبرة قانونية", description: "الترافع في القضايا التجارية والمدنية." },
  ],
  credentials: [
    { title: "ترخيص مزاولة المحاماة", org: "وزارة العدل", year: "2012" },
    { title: "دبلوم التحكيم التجاري", org: "مركز التدريب القانوني", year: "2016" },
  ],
  caseHighlights: [
    { title: "نزاع تجاري مع شركة توريد", sector: "تجاري", result: "تسوية لصالح الموكل", description: "استرداد مستحقات مالية عبر تفاوض وتسوية موثقة." },
    { title: "مطالبة عمالية", sector: "عمالي", result: "حكم لصالح العامل", description: "تحصيل مستحقات نهاية الخدمة والأجور المتأخرة." },
  ],
  testimonials: [
    { quote: "متابعة دقيقة واحترافية عالية في جميع مراحل القضية.", name: "شركة النور", role: "عميل تجاري" },
    { quote: "وضوح في الإجراءات وسرعة في التواصل.", name: "سالم الحربي", role: "موكل" },
  ],
  articles: [
    { title: "كيف تحمي عقدك التجاري", excerpt: "بنود أساسية يجب الانتباه لها قبل التوقيع.", tag: "عقود", date: "2026-02-10" },
    { title: "حقوق العامل عند إنهاء العقد", excerpt: "أهم المستحقات النظامية وإجراءات المطالبة.", tag: "عمالي", date: "2026-01-18" },
  ],
  languages: ["العربية", "الإنجليزية"],
  memberships: ["الهيئة السعودية للمحامين"],
  ctaTitle: "هل لديك قضية أو استشارة؟",
  ctaBody: "تواصل معنا للحصول على تقييم أولي وخطة متابعة قانونية واضحة.",
  updatedAt: nowISO(),
};

async function seedDemoData() {
  const [clientsCount, mattersCount] = await Promise.all([db.clients.count(), db.matters.count()]);
  if (clientsCount > 0 || mattersCount > 0) return;

  const now = nowISO();
  const adminId = "usr_admin";

  // مستخدمون تجريبيون إضافيون (لإثراء التعيين والعرض)
  const demoUsers: User[] = [];
  const extraUsers = [
    { id: "usr_lawyer1", name: "المحامي خالد السبيعي", username: "khaled", email: "khaled@adala.local", role: "senior" as const, title: "محامٍ أول", color: "#2563EB" },
    { id: "usr_lawyer2", name: "المحامية نورة العتيبي", username: "noura", email: "noura@adala.local", role: "associate" as const, title: "محامية", color: "#0F766E" },
  ];
  for (const u of extraUsers) {
    const exists = await db.users.get(u.id);
    if (!exists) {
      const salt = randomSalt();
      demoUsers.push({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        phone: "",
        role: u.role,
        title: u.title,
        bio: "",
        avatarColor: u.color,
        salt,
        passwordHash: await hashPassword("admin123", salt),
        isActive: true,
        createdAt: now,
        notificationsEnabled: true,
      });
    }
  }

  const demoClients: Client[] = [
    { id: "cli_001", name: "شركة الأفق للتجارة", legalName: "شركة الأفق للتجارة المحدودة", type: "company", commercialId: "1010456789", phone: "0114001001", email: "legal@ofuq.example", address: "حي العليا", city: "الرياض", notes: "عميل تجاري - عقود توريد", tags: ["تجاري", "عقود"], priority: "vip", assignedTo: adminId, status: "active", createdAt: isoDays(-120), updatedAt: isoDays(-2), archived: false },
    { id: "cli_002", name: "سالم بن محمد الحربي", type: "individual", nationalId: "1023456789", phone: "0551112233", email: "salem@example.com", address: "حي النزهة", city: "الرياض", profession: "موظف", notes: "نزاع عمالي", tags: ["عمالي"], priority: "high", assignedTo: "usr_lawyer1", status: "active", createdAt: isoDays(-90), updatedAt: isoDays(-5), archived: false },
    { id: "cli_003", name: "مؤسسة روافد التقنية", legalName: "مؤسسة روافد التقنية", type: "company", commercialId: "1010987654", phone: "0114556677", email: "info@rawafed.example", address: "حي الملز", city: "الرياض", notes: "مطالبات مالية ومديونيات", tags: ["مدني", "تحصيل"], priority: "normal", assignedTo: "usr_lawyer2", status: "active", createdAt: isoDays(-75), updatedAt: isoDays(-10), archived: false },
    { id: "cli_004", name: "فهد العتيبي", type: "individual", nationalId: "1098765432", phone: "0543332211", email: "fahad@example.com", city: "جدة", notes: "قضية جنائية - تمثيل", tags: ["جنائي"], priority: "high", assignedTo: adminId, status: "active", createdAt: isoDays(-60), updatedAt: isoDays(-1), archived: false },
    { id: "cli_005", name: "شركة بناء المستقبل", type: "company", commercialId: "1010778899", phone: "0126007788", city: "جدة", notes: "نزاع مقاولة", tags: ["تجاري", "مقاولات"], priority: "normal", assignedTo: "usr_lawyer1", status: "active", createdAt: isoDays(-140), updatedAt: isoDays(-20), archived: false },
    { id: "cli_006", name: "نورة بنت عبدالعزيز", type: "individual", nationalId: "1088123456", phone: "0567001122", city: "الدمام", notes: "مطالبة حضانة ونفقة", tags: ["أحوال"], priority: "normal", assignedTo: "usr_lawyer2", status: "active", createdAt: isoDays(-45), updatedAt: isoDays(-3), archived: false },
    { id: "cli_007", name: "مطاعم الذوق الرفيع", type: "company", commercialId: "1010665544", phone: "0138334455", city: "الدمام", notes: "نزاع إيجار تجاري", tags: ["إيجار"], priority: "normal", assignedTo: adminId, status: "active", createdAt: isoDays(-50), updatedAt: isoDays(-7), archived: false },
    { id: "cli_008", name: "عبدالرحمن القحطاني", type: "individual", nationalId: "1077001122", phone: "0509998877", city: "الرياض", notes: "اعتراض على قرار إداري", tags: ["إداري"], priority: "normal", assignedTo: "usr_lawyer1", status: "dormant", createdAt: isoDays(-200), updatedAt: isoDays(-30), archived: false },
    { id: "cli_009", name: "شركة وادي النخيل", type: "company", commercialId: "1010223344", phone: "0114889900", city: "الرياض", notes: "قضية مغلقة - تم التحصيل", tags: ["تحصيل"], priority: "normal", assignedTo: adminId, status: "closed", createdAt: isoDays(-300), updatedAt: isoDays(-40), archived: false },
    { id: "cli_010", name: "ماجد الشهري", type: "opponent", phone: "0554443322", city: "أبها", notes: "طرف خصم في قضية مدنية", tags: ["خصم"], priority: "normal", status: "active", createdAt: isoDays(-35), updatedAt: isoDays(-6), archived: false },
  ];

  const demoMatters: Matter[] = [
    { id: "mat_001", number: "2026-001", internalRef: "CIV-001", title: "مطالبة مالية - شركة الأفق", typeId: "mt_civil", clientId: "cli_001", opposingParty: "شركة المدار", courtName: "المحكمة التجارية بالرياض", caseNumber: "C-45812", status: "hearing", priority: "high", stage: "مرافعة", description: "مطالبة بمستحقات عقد توريد متأخرة.", lawyerIds: [adminId, "usr_lawyer2"], feeType: "fixed", agreedFee: 45000, expenses: 2500, courtFees: 1200, currency: "SAR", openedAt: isoDays(-100), nextAction: "تقديم مذكرة جوابية", nextActionDate: isoDays(5), progress: 55, confidential: false, tags: ["تجاري", "مستحقات"], createdAt: isoDays(-100), updatedAt: isoDays(-1), archived: false },
    { id: "mat_002", number: "2026-002", internalRef: "LAB-014", title: "مطالبة عمالية - سالم الحربي", typeId: "mt_labor", clientId: "cli_002", opposingParty: "شركة إشراقة", courtName: "المحكمة العمالية", caseNumber: "L-2231", status: "open", priority: "normal", stage: "تبادل مذكرات", description: "مطالبة بأجور متأخرة ومكافأة نهاية خدمة.", lawyerIds: ["usr_lawyer1"], feeType: "fixed", agreedFee: 12000, expenses: 300, courtFees: 0, currency: "SAR", openedAt: isoDays(-70), nextAction: "جلسة تسوية", nextActionDate: isoDays(12), progress: 30, confidential: false, tags: ["عمالي"], createdAt: isoDays(-70), updatedAt: isoDays(-4), archived: false },
    { id: "mat_003", number: "2026-003", internalRef: "COM-022", title: "نزاع شراكة - روافد التقنية", typeId: "mt_com", clientId: "cli_003", opposingParty: "شريك سابق", courtName: "المحكمة التجارية", caseNumber: "C-7710", status: "in_review", priority: "critical", stage: "دراسة مستندات", description: "نزاع حول حصص وأرباح شراكة.", lawyerIds: [adminId], feeType: "percentage", agreedFee: 80000, expenses: 4200, courtFees: 2000, currency: "SAR", openedAt: isoDays(-55), nextAction: "مراجعة العقود", nextActionDate: isoDays(2), progress: 40, confidential: true, tags: ["شركات"], createdAt: isoDays(-55), updatedAt: isoDays(-2), archived: false },
    { id: "mat_004", number: "2026-004", internalRef: "CR-007", title: "قضية جنائية - فهد العتيبي", typeId: "mt_crim", clientId: "cli_004", courtName: "المحكمة الجزائية", caseNumber: "CR-9012", status: "hearing", priority: "high", stage: "جلسة", description: "تمثيل ودفاع في قضية جزائية.", lawyerIds: [adminId], feeType: "fixed", agreedFee: 30000, expenses: 1500, courtFees: 0, currency: "SAR", openedAt: isoDays(-40), nextAction: "حضور الجلسة", nextActionDate: isoDays(1), progress: 60, confidential: true, tags: ["جنائي"], createdAt: isoDays(-40), updatedAt: isoDays(-1), archived: false },
    { id: "mat_005", number: "2026-005", internalRef: "COM-030", title: "نزاع مقاولة - بناء المستقبل", typeId: "mt_com", clientId: "cli_005", opposingParty: "مورد مواد", courtName: "المحكمة التجارية بجدة", caseNumber: "C-J-1188", status: "open", priority: "normal", stage: "قيد نظر", description: "مطالبة بتعويض عن تأخير توريد.", lawyerIds: ["usr_lawyer1"], feeType: "fixed", agreedFee: 25000, expenses: 800, courtFees: 900, currency: "SAR", openedAt: isoDays(-30), nextAction: "جمع مستندات", nextActionDate: isoDays(8), progress: 20, confidential: false, tags: ["مقاولات"], createdAt: isoDays(-30), updatedAt: isoDays(-3), archived: false },
    { id: "mat_006", number: "2026-006", internalRef: "CIV-044", title: "نزاع إيجار - مطاعم الذوق", typeId: "mt_civil", clientId: "cli_007", opposingParty: "مالك العقار", courtName: "محكمة التنفيذ", caseNumber: "EX-3321", status: "settled", priority: "normal", stage: "تسوية", description: "تسوية ودية لنزاع إيجار.", lawyerIds: [adminId, "usr_lawyer2"], feeType: "fixed", agreedFee: 15000, expenses: 400, courtFees: 300, currency: "SAR", openedAt: isoDays(-120), closedAt: isoDays(-15), nextAction: "إغلاق الملف", progress: 100, confidential: false, tags: ["إيجار", "تسوية"], createdAt: isoDays(-120), updatedAt: isoDays(-15), archived: false, outcome: "تسوية لصالح الموكل" },
    { id: "mat_007", number: "2025-019", internalRef: "ADM-003", title: "اعتراض إداري - القحطاني", typeId: "mt_admin", clientId: "cli_008", courtName: "الديوان الإداري", caseNumber: "ADM-551", status: "closed", priority: "normal", stage: "منتهي", description: "اعتراض على قرار إداري وتم الفصل فيه.", lawyerIds: ["usr_lawyer1"], feeType: "fixed", agreedFee: 10000, expenses: 200, courtFees: 0, currency: "SAR", openedAt: isoDays(-260), closedAt: isoDays(-50), progress: 100, confidential: false, tags: ["إداري"], createdAt: isoDays(-260), updatedAt: isoDays(-50), archived: true, archivedAt: isoDays(-20), archiveYear: 2026, outcome: "حكم لصالح الموكل" },
  ];

  const demoAgreements: Agreement[] = [
    { id: "agr_001", matterId: "mat_001", title: "اتفاقية أتعاب - قضية الأفق", type: "fee", amount: 45000, currency: "SAR", terms: "دفعة مقدمة 15000 والباقي على دفعتين.", signedDate: dateOnly(-98), status: "signed", installmentCount: 3, installmentAmount: 15000, createdAt: isoDays(-98), updatedAt: isoDays(-10), archived: false },
    { id: "agr_002", matterId: "mat_002", title: "عقد تمثيل عمالي", type: "retainer", amount: 12000, currency: "SAR", signedDate: dateOnly(-68), status: "executed", installmentCount: 2, installmentAmount: 6000, createdAt: isoDays(-68), updatedAt: isoDays(-20), archived: false },
    { id: "agr_003", matterId: "mat_003", title: "اتفاقية أتعاب نسبة", type: "fee", amount: 80000, currency: "SAR", status: "draft", installmentCount: 1, installmentAmount: 80000, createdAt: isoDays(-54), updatedAt: isoDays(-2), archived: false },
  ];

  const demoPayments: Payment[] = [
    { id: "pay_001", matterId: "mat_001", agreementId: "agr_001", kind: "fee", amount: 15000, currency: "SAR", date: dateOnly(-95), method: "transfer", receiptNo: "RC-1001", notes: "دفعة مقدمة", recordedBy: adminId, createdAt: isoDays(-95), archived: false },
    { id: "pay_002", matterId: "mat_001", kind: "court_fee", amount: 1200, currency: "SAR", date: dateOnly(-80), method: "cash", receiptNo: "RC-1008", notes: "رسوم المحكمة", recordedBy: adminId, createdAt: isoDays(-80), archived: false },
    { id: "pay_003", matterId: "mat_002", agreementId: "agr_002", kind: "installment", amount: 6000, currency: "SAR", date: dateOnly(-60), method: "transfer", receiptNo: "RC-1012", notes: "الدفعة الأولى", recordedBy: "usr_lawyer1", createdAt: isoDays(-60), archived: false },
    { id: "pay_004", matterId: "mat_004", kind: "fee", amount: 10000, currency: "SAR", date: dateOnly(-35), method: "card", receiptNo: "RC-1020", notes: "دفعة أتعاب", recordedBy: adminId, createdAt: isoDays(-35), archived: false },
    { id: "pay_005", matterId: "mat_006", kind: "fee", amount: 15000, currency: "SAR", date: dateOnly(-18), method: "transfer", receiptNo: "RC-1031", notes: "سداد نهائي بعد التسوية", recordedBy: adminId, createdAt: isoDays(-18), archived: false },
  ];

  const demoTasks: Task[] = [
    { id: "tsk_001", title: "إعداد مذكرة جوابية لقضية الأفق", description: "صياغة الرد على دفوع الخصم وإرفاق المستندات.", matterId: "mat_001", assigneeId: "usr_lawyer2", createdBy: adminId, dueDate: dateOnly(4), remindAt: isoDays(3, 9), priority: "high", status: "doing", tags: ["مذكرة"], checklist: [{ id: "chk1", text: "مراجعة عقد التوريد", done: true }, { id: "chk2", text: "جمع الإيصالات", done: false }], estimatedHours: 6, createdAt: isoDays(-5), updatedAt: isoDays(-1), archived: false },
    { id: "tsk_002", title: "التواصل مع الموكل سالم الحربي", matterId: "mat_002", clientId: "cli_002", assigneeId: "usr_lawyer1", dueDate: dateOnly(1), priority: "normal", status: "todo", tags: ["متابعة"], checklist: [], createdAt: isoDays(-3), updatedAt: isoDays(-1), archived: false },
    { id: "tsk_003", title: "مراجعة مستندات شراكة روافد", matterId: "mat_003", assigneeId: adminId, dueDate: dateOnly(2), priority: "urgent", status: "doing", tags: ["مستندات"], checklist: [{ id: "chk3", text: "تحليل عقد الشراكة", done: false }], createdAt: isoDays(-7), updatedAt: isoDays(-2), archived: false },
    { id: "tsk_004", title: "تجهيز ملف جلسة فهد العتيبي", matterId: "mat_004", assigneeId: adminId, dueDate: dateOnly(0), priority: "urgent", status: "todo", tags: ["جلسة"], checklist: [], createdAt: isoDays(-2), updatedAt: isoDays(-1), archived: false },
    { id: "tsk_005", title: "أرشفة ملف نزاع الإيجار", matterId: "mat_006", assigneeId: "usr_lawyer2", dueDate: dateOnly(-10), priority: "low", status: "done", tags: ["أرشفة"], checklist: [{ id: "chk4", text: "رفع محضر التسوية", done: true }], createdAt: isoDays(-20), updatedAt: isoDays(-10), completedAt: isoDays(-10), archived: false },
  ];

  const demoEvents: LegalEvent[] = [
    { id: "evt_001", title: "جلسة مرافعة - شركة الأفق", type: "hearing", matterId: "mat_001", clientId: "cli_001", date: isoDays(6, 9), endTime: "10:30", location: "المحكمة التجارية بالرياض", courtRoom: "قاعة 3", status: "scheduled", remindBeforeDays: 2, remindersSent: 0, notes: "إحضار أصل العقد", createdAt: isoDays(-10), updatedAt: isoDays(-1), archived: false },
    { id: "evt_002", title: "جلسة تسوية عمالية", type: "meeting", matterId: "mat_002", clientId: "cli_002", date: isoDays(12, 11), location: "المحكمة العمالية", status: "scheduled", remindBeforeDays: 3, remindersSent: 0, createdAt: isoDays(-8), updatedAt: isoDays(-2), archived: false },
    { id: "evt_003", title: "جلسة جزائية - فهد العتيبي", type: "hearing", matterId: "mat_004", clientId: "cli_004", date: isoDays(1, 9), location: "المحكمة الجزائية", status: "scheduled", remindBeforeDays: 1, remindersSent: 1, createdAt: isoDays(-6), updatedAt: isoDays(-1), archived: false },
    { id: "evt_004", title: "موعد تسليم مستندات", type: "deadline", matterId: "mat_003", clientId: "cli_003", date: isoDays(3, 16), status: "scheduled", remindBeforeDays: 2, remindersSent: 0, notes: "تسليم كشوف حسابات الشراكة", createdAt: isoDays(-4), updatedAt: isoDays(-1), archived: false },
    { id: "evt_005", title: "اجتماع داخلي لمراجعة القضايا", type: "internal", date: isoDays(7, 13), location: "قاعة الاجتماعات", status: "scheduled", remindBeforeDays: 1, remindersSent: 0, attendees: [adminId, "usr_lawyer1", "usr_lawyer2"], createdAt: isoDays(-2), updatedAt: isoDays(-1), archived: false },
  ];

  const demoNotes: MatterNote[] = [
    { id: "note_001", matterId: "mat_001", body: "تم استلام نسخة من عقد التوريد ومراجعة البنود المالية.", kind: "note", authorId: adminId, pinned: true, createdAt: isoDays(-9), updatedAt: isoDays(-9), archived: false },
    { id: "note_002", matterId: "mat_001", body: "الخصم طلب مهلة إضافية لتقديم المستندات.", kind: "update", authorId: "usr_lawyer2", pinned: false, createdAt: isoDays(-3), updatedAt: isoDays(-3), archived: false },
    { id: "note_003", matterId: "mat_004", body: "مكالمة مع الموكل لتأكيد الحضور للجلسة القادمة.", kind: "call", authorId: adminId, pinned: false, createdAt: isoDays(-2), updatedAt: isoDays(-2), archived: false },
  ];

  const demoTemplates: DocTemplate[] = [
    { id: "tpl_001", name: "مذكرة جوابية", category: "pleading", body: "إلى المحكمة الموقرة...\nالموضوع: {{subject}}\nالوقائع: {{facts}}\nالطلبات: {{requests}}", variables: ["subject", "facts", "requests"], usageCount: 5, createdAt: isoDays(-100), updatedAt: isoDays(-10), archived: false },
    { id: "tpl_002", name: "عقد أتعاب محاماة", category: "contract", body: "اتفق الطرفان على ما يلي...\nالموكل: {{client}}\nالقضية: {{matter}}\nالأتعاب: {{fee}}", variables: ["client", "matter", "fee"], usageCount: 8, createdAt: isoDays(-120), updatedAt: isoDays(-20), archived: false },
    { id: "tpl_003", name: "خطاب مطالبة", category: "correspondence", body: "السيد/ {{name}} المحترم\nنطالبكم بسداد مبلغ {{amount}} وذلك بسبب {{reason}}.", variables: ["name", "amount", "reason"], usageCount: 3, createdAt: isoDays(-80), updatedAt: isoDays(-15), archived: false },
  ];

  const demoDocuments: LegalDocument[] = [
    { id: "doc_001", title: "عقد توريد - شركة الأفق", category: "contract", matterId: "mat_001", clientId: "cli_001", version: 1, tags: ["عقد", "توريد"], confidential: false, requiresSignature: true, signedAt: isoDays(-110), printCount: 2, createdBy: adminId, createdAt: isoDays(-110), updatedAt: isoDays(-90), archived: false },
    { id: "doc_002", title: "مذكرة افتتاحية - مطالبة الأفق", category: "pleading", matterId: "mat_001", clientId: "cli_001", version: 2, parentId: "doc_001", tags: ["مذكرة"], confidential: false, requiresSignature: false, printCount: 4, createdBy: "usr_lawyer2", createdAt: isoDays(-85), updatedAt: isoDays(-12), archived: false },
    { id: "doc_003", title: "محضر تسوية - نزاع الإيجار", category: "report", matterId: "mat_006", clientId: "cli_007", version: 1, tags: ["تسوية"], confidential: false, requiresSignature: true, signedAt: isoDays(-16), printCount: 1, createdBy: adminId, createdAt: isoDays(-16), updatedAt: isoDays(-15), archived: false },
  ];

  const demoLibrary: LibraryItem[] = [
    { id: "lib_001", title: "نظام المرافعات الشرعية", type: "book", author: "وزارة العدل", category: "أنظمة", description: "مرجع أساسي للإجراءات أمام المحاكم.", url: "", coverColor: "#2563EB", rating: 5, status: "reference", progress: 100, tags: ["نظام", "مرافعات"], notes: [{ id: "ln1", body: "مراجعة مواد الاختصاص.", page: 45, createdAt: isoDays(-30) }], isFavorite: true, addedAt: isoDays(-120), lastOpenedAt: isoDays(-5), addedBy: adminId, archived: false },
    { id: "lib_002", title: "دليل صياغة العقود التجارية", type: "book", author: "مركز التدريب القانوني", category: "عقود", description: "نماذج وبنود عملية للعقود.", coverColor: "#0F766E", rating: 4, status: "reading", progress: 60, tags: ["عقود"], notes: [], isFavorite: false, addedAt: isoDays(-60), lastOpenedAt: isoDays(-2), addedBy: "usr_lawyer2", archived: false },
    { id: "lib_003", title: "مبادئ نظام العمل", type: "article", author: "هيئة الخبراء", category: "عمالي", description: "ملخص لأهم أحكام نظام العمل.", coverColor: "#D97706", rating: 4, status: "finished", progress: 100, tags: ["عمالي"], notes: [], isFavorite: true, addedAt: isoDays(-40), lastOpenedAt: isoDays(-12), addedBy: "usr_lawyer1", archived: false },
  ];

  const demoActivity: ActivityEntry[] = [
    { id: "act_001", userId: adminId, userName: "مدير النظام", action: "create", entity: "client", entityId: "cli_001", meta: "إضافة موكل: شركة الأفق للتجارة", at: isoDays(-120) },
    { id: "act_002", userId: adminId, userName: "مدير النظام", action: "create", entity: "matter", entityId: "mat_001", meta: "فتح قضية: مطالبة مالية - شركة الأفق", at: isoDays(-100) },
    { id: "act_003", userId: "usr_lawyer2", userName: "المحامية نورة العتيبي", action: "update", entity: "document", entityId: "doc_002", meta: "تحديث مذكرة افتتاحية", at: isoDays(-12) },
    { id: "act_004", userId: adminId, userName: "مدير النظام", action: "create", entity: "payment", entityId: "pay_005", meta: "تسجيل سداد نهائي", at: isoDays(-18) },
  ];

  const demoNotifications: AppNotification[] = [
    { id: "ntf_001", title: "جلسة قريبة", body: "جلسة جزائية - فهد العتيبي غدًا الساعة 9:00.", kind: "deadline", refType: "event", refId: "evt_003", read: false, at: isoDays(-1, 8), link: "/events" },
    { id: "ntf_002", title: "مهمة عاجلة", body: "مراجعة مستندات شراكة روافد مستحقة قريبًا.", kind: "task", refType: "task", refId: "tsk_003", read: false, at: isoDays(-1, 12), link: "/tasks" },
    { id: "ntf_003", title: "دفعة مستلمة", body: "تم تسجيل دفعة بمبلغ 15,000 ر.س لقضية الأفق.", kind: "payment", refType: "payment", refId: "pay_001", read: true, at: isoDays(-20, 10), link: "/payments" },
  ];

  await db.transaction(
    "rw",
    [
      db.users,
      db.clients,
      db.matters,
      db.agreements,
      db.payments,
      db.tasks,
      db.events,
      db.notes,
      db.templates,
      db.documents,
      db.library,
      db.activity,
      db.notifications,
    ],
    async () => {
      if (demoUsers.length) await db.users.bulkPut(demoUsers);
      await db.clients.bulkAdd(demoClients);
      await db.matters.bulkAdd(demoMatters);
      await db.agreements.bulkAdd(demoAgreements);
      await db.payments.bulkAdd(demoPayments);
      await db.tasks.bulkAdd(demoTasks);
      await db.events.bulkAdd(demoEvents);
      await db.notes.bulkAdd(demoNotes);
      await db.templates.bulkAdd(demoTemplates);
      await db.documents.bulkAdd(demoDocuments);
      await db.library.bulkAdd(demoLibrary);
      await db.activity.bulkAdd(demoActivity);
      await db.notifications.bulkAdd(demoNotifications);
    },
  );
}

export async function ensureSeed() {
  /* إصلاح بذر قديم: كلمات مرور خُزِّنت نصًا صريحًا قبل تفعيل التشفير
     (يحدّث السجل في مكانه — بيانات العميل الأخرى لا تُمس) */
  try {
    const existing = await db.users.toArray();
    for (const u of existing) {
      const rec = u as unknown as Record<string, unknown>;
      /* بذر قديم: كلمة مرور نصًا صريحًا بلا تشفير */
      const plain = typeof rec.password === "string" && rec.password ? String(rec.password) : null;
      const hasHash = !!rec.passwordHash && !!rec.salt;
      /* بذر قديم: حقول ناقصة من الواجهة الحالية (isActive/title/avatarColor) */
      const needsFields = rec.isActive === undefined || !rec.title || !rec.avatarColor;
      if (!plain && !needsFields) continue;

      const { password: _plain, ...rest } = rec;
      const patch: Record<string, unknown> = { ...rest };
      if (plain && !hasHash) {
        const salt = randomSalt();
        patch.salt = salt;
        patch.passwordHash = await hashPassword(plain, salt);
      }
      if (rec.isActive === undefined) patch.isActive = true;
      patch.role = rec.role || "admin";
      patch.title = rec.title || "مدير المكتب";
      patch.avatarColor = rec.avatarColor || "#B08419";
      await db.users.put(patch as never);
    }
  } catch {
    /* قاعدة بيانات غير مهيأة بعد — يتكفل البذر أدناه */
  }

  // ضمان وجود حساب أدمن تجريبي موحّد في كل الحالات (admin / admin123 مع توافق admin)
  try {
    const allUsers = await db.users.toArray();
    let adminUser = allUsers.find((u) => u.id === "usr_admin")
      || allUsers.find((u) => (u.username || "").toLowerCase() === "admin")
      || allUsers.find((u) => (u.username || "").toLowerCase() === "admin");

    if (!adminUser) {
      const base = users[0];
      const salt = randomSalt();
      const passwordHash = await hashPassword("admin123", salt);
      const { password: _seedPlain, ...safeAdmin } = base;
      await db.users.put({
        ...safeAdmin,
        id: "usr_admin",
        username: "admin",
        name: safeAdmin.name || "مدير النظام",
        email: safeAdmin.email || "admin@adala.local",
        role: "admin",
        isActive: true,
        salt,
        passwordHash,
      } as never);
    } else {
      const rec = adminUser as unknown as Record<string, unknown>;
      const patch: Record<string, unknown> = { ...rec };
      const uname = String(rec.username || "").toLowerCase();
      // توحيد اسم الدخول مع الإبقاء على التوافق عند تسجيل الدخول (admin/admin)
      if (!uname || uname === "admin") patch.username = "admin";
      if (rec.isActive !== true) patch.isActive = true;
      if (!rec.role) patch.role = "admin";
      if (!rec.title) patch.title = "مدير المكتب";
      if (!rec.avatarColor) patch.avatarColor = "#B08419";
      if (!rec.name) patch.name = "مدير النظام";
      // ضمان عمل بيانات الدخول التجريبية الموحدة (admin / admin123) للحساب الأدمن الافتراضي
      const isDefaultDemoAdmin = rec.id === "usr_admin" || uname === "admin" || uname === "admin";
      if (isDefaultDemoAdmin || !rec.passwordHash || !rec.salt) {
        const salt = randomSalt();
        patch.salt = salt;
        patch.passwordHash = await hashPassword("admin123", salt);
      }
      await db.users.put(patch as never);
    }
  } catch {
    /* تجاهل — سيحاول الدخول لاحقًا أو يُبذر أدناه عند قاعدة فارغة */
  }

  // ضمان وجود الإعدادات/أنواع القضايا/البورتفوليو دائمًا
  try {
    const hasSettings = await db.settings.get("settings");
    const hasPortfolio = await db.portfolio.get("portfolio");
    const typesCount = await db.matterTypes.count();
    await db.transaction(
      "rw",
      [db.matterTypes, db.settings, db.portfolio],
      async () => {
        if (typesCount === 0) await db.matterTypes.bulkAdd(matterTypes as never);
        if (!hasSettings) await db.settings.put(settings as never);
        if (!hasPortfolio) await db.portfolio.put(portfolio as never);
      },
    );
  } catch {
    /* ignore */
  }

  // بيانات تجريبية لعرض شكل الصفحات (تُضاف مرة واحدة عند خلو بيانات العمل)
  try {
    await seedDemoData();
  } catch (err) {
    console.error("تعذّر بذر البيانات التجريبية:", err);
  }
}