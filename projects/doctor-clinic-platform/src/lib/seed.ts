import type {
  Appointment,
  ArchiveItem,
  BookingRequest,
  DB,
  DoctorProfile,
  Invoice,
  Patient,
  Prescription,
  Settings,
  User,
  Visit,
} from "./types";
import { addDays, genCode, genNumber, initials, todayISO, uid } from "./utils";

const T = todayISO();

const FEMALE = "female" as const;
const MALE = "male" as const;

const NAMES: { name: string; gender: typeof FEMALE | typeof MALE; birth: string; chronic?: string[]; allergies?: string[] }[] = [
  { name: "أحمد محمود عبد الرحمن", gender: MALE, birth: "1978-04-12", chronic: ["ارتفاع ضغط الدم"], allergies: ["البنسلين"] },
  { name: "فاطمة سيد إبراهيم", gender: FEMALE, birth: "1989-11-03", chronic: ["الأنيميا"], allergies: [] },
  { name: "محمد أشرف علي", gender: MALE, birth: "1994-06-21" },
  { name: "مريم حسن الشريف", gender: FEMALE, birth: "2001-02-17", allergies: ["حبوب اللقاح"] },
  { name: "عمر خالد منصور", gender: MALE, birth: "1965-09-30", chronic: ["السكري من النوع الثاني", "ارتفاع الكوليسترول"], allergies: ["الأسبرين"] },
  { name: "سارة عمرو فؤاد", gender: FEMALE, birth: "1992-08-14" },
  { name: "يوسف إبراهيم نصر", gender: MALE, birth: "2015-03-08" },
  { name: "نور الهدى مصطفى", gender: FEMALE, birth: "1987-12-25", chronic: ["الغدة الدرقية"] },
  { name: "كريم طارق سليم", gender: MALE, birth: "1983-05-19" },
  { name: "هالة عبد العزيز", gender: FEMALE, birth: "1971-01-11", chronic: ["خشونة الركبة"] },
  { name: "مصطفى كامل رشدي", gender: MALE, birth: "1999-10-02" },
  { name: "دينا سمير حبيب", gender: FEMALE, birth: "1996-07-30", allergies: ["المكسرات"] },
  { name: "عمرو ياسر لطفي", gender: MALE, birth: "2008-12-09" },
  { name: "رنا محمد فتحي", gender: FEMALE, birth: "1990-03-23" },
  { name: "حسن علي زيدان", gender: MALE, birth: "1958-06-15", chronic: ["قصور القلب", "السكري"], allergies: ["السلفا"] },
  { name: "ياسمين هشام عادل", gender: FEMALE, birth: "2003-09-05" },
  { name: "إبراهيم صابر قنديل", gender: MALE, birth: "1974-02-27", chronic: ["الربو"] },
  { name: "مي وليد شاكر", gender: FEMALE, birth: "1985-04-18" },
  { name: "طارق صلاح الدين", gender: MALE, birth: "1968-11-22", chronic: ["ارتفاع ضغط الدم"] },
  { name: "أمل رشاد عوض", gender: FEMALE, birth: "1993-01-14" },
  { name: "سيف الدين مجدي", gender: MALE, birth: "2011-08-03" },
  { name: "لينا أيمن غانم", gender: FEMALE, birth: "1998-05-27", allergies: ["اللاتكس"] },
];

const BLOOD = ["A+", "O+", "B+", "AB+", "A-", "O-", "B+", "O+"];
const JOBS = ["مهندس", "معلمة", "محاسب", "طالبة جامعية", "صيدلي", "ربة منزل", "موظف بنك", "مصمم جرافيك", "طالب", "ممرضة", "محامي", "مخرج فني"];
const AREAS = ["المعادي، القاهرة", "مدينة نصر، القاهرة", "الزمالك، القاهرة", "سموحة، الإسكندرية", "الشيخ زايد، الجيزة", "المهندسين، الجيزة", "المنصورة", "طنطا"];
const INSURANCE = ["", "", "مصر للتأمين", "متلايف", "أليانز", "", "شركة النيل", ""];

const CHIEF = [
  "صداع مزمن منذ أسبوعين مع دوخة عند الوقوف",
  "ألم في الصدر مع ضيق تنفس عند المجهود",
  "ألم أسفل الظهر يمتد للطرف السفلي",
  "ارتفاع مستمر في قراءات السكر الصباحية",
  "رشح وحرارة وكحة جافة منذ 5 أيام",
  "متابعة نتائج التحاليل الشهرية",
  "تورم واحمرار في مفصل الركبة اليمنى",
  "ألم حارق في المعدة بعد الأكل",
  "حكة جلدية منتشرة بالذراعين",
  "تعب عام وشحوب مع فقدان وزن غير مبرر",
];
const DX = [
  ["صداع توتري", "نقص فيتامين د"],
  ["التهاب شعبي حاد"],
  ["ارتفاع ضغط الدم غير المنضبط"],
  ["بدأ سكري من النوع الثاني"],
  ["التهاب المعدة المزمن", "جرثومة المعدة"],
  ["انزلاق غضروفي قطني مبكر"],
  ["التهاب المفصل الروماتويدي"],
  ["أكزيما تأتبية"],
  ["أنيميا نقص الحديد"],
  ["التهاب اللوزتين الحاد"],
];
const MEDS = [
  { name: "باراسيتامول 500 مجم", form: "أقراص", dose: "قرص", frequency: "كل 8 ساعات", duration: "5 أيام", route: "فموي" },
  { name: "أوميبرازول 20 مجم", form: "كبسولات", dose: "كبسولة", frequency: "مرة يوميًا قبل الفطار", duration: "14 يومًا", route: "فموي" },
  { name: "أموكسيسيلين 500 مجم", form: "كبسولات", dose: "كبسولة", frequency: "كل 8 ساعات", duration: "7 أيام", route: "فموي" },
  { name: "ميتفورمين 850 مجم", form: "أقراص", dose: "قرص", frequency: "مرتين يوميًا بعد الأكل", duration: "شهر", route: "فموي" },
  { name: "فيتامين د 50000 وحدة", form: "أمبولات", dose: "أمبول", frequency: "مرة أسبوعيًا", duration: "8 أسابيع", route: "فموي" },
  { name: "سيتريزين 10 مجم", form: "أقراص", dose: "قرص", frequency: "مرة يوميًا مساءً", duration: "10 أيام", route: "فموي" },
  { name: "ديكلوفيناك جل", form: "دهان", dose: "طبقة رقيقة", frequency: "3 مرات يوميًا", duration: "7 أيام", route: "موضعي" },
  { name: "سالبوتامول بخاخ", form: "بخاخ", dose: "بختان", frequency: "عند الحاجة", duration: "شهر", route: "استنشاق" },
];

function buildUsers(): User[] {
  return [
    {
      id: "usr_admin",
      name: "مدير النظام",
      role: "manager",
      email: "admin",
      phone: "admin",
      active: true,
      specialty: "مدير النظام — صلاحيات كاملة",
      extraPermissions: [
        "dashboard.view",
        "patients.view",
        "patients.edit",
        "appointments.view",
        "appointments.edit",
        "records.view",
        "records.edit",
        "prescriptions.view",
        "prescriptions.edit",
        "billing.view",
        "billing.edit",
        "archive.view",
        "reports.view",
        "users.view",
        "users.edit",
        "settings.edit",
        "profile.edit",
      ],
      createdAt: "2024-01-01",
    },
    {
      id: "usr_doctor",
      name: "د. كريم الجوهري",
      role: "doctor",
      email: "doctor@tabib.clinic",
      phone: "01001234567",
      active: true,
      specialty: "استشاري الباطنة العامة",
      extraPermissions: [],
      createdAt: "2023-01-04",
    },
    {
      id: "usr_manager",
      name: "نهى عبد المنعم",
      role: "manager",
      email: "manager@tabib.clinic",
      phone: "01007654321",
      active: true,
      specialty: "مدير العيادة",
      extraPermissions: [],
      createdAt: "2023-02-11",
    },
    {
      id: "usr_reception",
      name: "محمود سامي",
      role: "receptionist",
      email: "reception@tabib.clinic",
      phone: "01102223344",
      active: true,
      extraPermissions: ["records.view"],
      createdAt: "2023-06-19",
    },
    {
      id: "usr_nurse",
      name: "سلمى فايز",
      role: "nurse",
      email: "nurse@tabib.clinic",
      phone: "01203334455",
      active: true,
      extraPermissions: [],
      createdAt: "2024-01-08",
    },
    {
      id: "usr_accountant",
      name: "وليد شعبان",
      role: "accountant",
      email: "accounts@tabib.clinic",
      phone: "01505556677",
      active: true,
      extraPermissions: [],
      createdAt: "2024-03-02",
    },
    {
      id: "usr_inactive",
      name: "ريم حسن",
      role: "receptionist",
      email: "reem@tabib.clinic",
      phone: "01098887766",
      active: false,
      extraPermissions: [],
      createdAt: "2024-05-21",
    },
  ];
}

function buildPatients(): Patient[] {
  return NAMES.map((n, i) => {
    const code = genCode("PT", i + 1);
    return {
      id: `pat_${i + 1}`,
      code,
      name: n.name,
      phone: `010${(20000000 + i * 137317).toString().slice(0, 8)}`,
      gender: n.gender,
      birthDate: n.birth,
      nationalId: `3${(1980 + (i % 30)).toString()}${String((i + 1) % 12 + 1).padStart(2, "0")}${String((i + 3) % 27 + 1).padStart(2, "0")}${String(1000 + i * 37).slice(0, 4)}`,
      bloodType: BLOOD[i % BLOOD.length],
      allergies: n.allergies ?? [],
      chronic: n.chronic ?? [],
      address: AREAS[i % AREAS.length],
      insurance: INSURANCE[i % INSURANCE.length] || undefined,
      job: JOBS[i % JOBS.length],
      emergencyName: i % 3 === 0 ? "أحد الأقارب" : undefined,
      emergencyPhone: i % 3 === 0 ? `011${(40000000 + i * 91311).toString().slice(0, 8)}` : undefined,
      notes: i === 4 ? "يفضل المواعيد الصباحية، يعاني من رهبة الإبر." : undefined,
      tags: [n.chronic?.length ? "مزمن" : "جديد", i % 4 === 0 ? "متابعة دورية" : "كشف"].filter(Boolean),
      createdAt: addDays(T, -(60 + i * 9)),
    };
  });
}

function buildAppointments(patients: Patient[]): Appointment[] {
  const list: Appointment[] = [];
  const todayTimes = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "16:00", "16:30", "17:00"];
  const statuses: Appointment["status"][] = [
    "completed", "completed", "completed", "completed", "waiting", "waiting", "confirmed", "confirmed", "scheduled", "scheduled",
  ];
  const types: Appointment["type"][] = ["consultation", "followup", "consultation", "followup", "consultation", "procedure", "consultation", "telemedicine", "followup", "consultation"];
  const complaints = [
    "متابعة نتائج التحاليل",
    "ألم بالصدر عند المجهود",
    "كحة مستمرة منذ أسبوع",
    "متابعة ضغط الدم",
    "دوخة وتنميل بالأطراف",
    "غيار جرح بسيط",
    "صداع نصفي متكرر",
    "استشارة عن بُعد لنتائج الأشعة",
    "متابعة سكر",
    "فحص دوري شامل",
  ];

  todayTimes.forEach((time, i) => {
    list.push({
      id: `apt_t${i + 1}`,
      patientId: patients[i % patients.length].id,
      date: T,
      time,
      duration: 30,
      type: types[i],
      status: statuses[i],
      doctorId: "usr_doctor",
      room: i % 2 === 0 ? "غرفة 1" : "غرفة 2",
      fee: i % 3 === 0 ? 400 : 300,
      source: i % 4 === 0 ? "online" : "clinic",
      complaint: complaints[i],
      createdAt: addDays(T, -3),
    });
  });

  const futureStatuses: Appointment["status"][] = ["confirmed", "scheduled", "confirmed", "scheduled", "scheduled"];
  for (let d = 1; d <= 5; d++) {
    const perDay = 3 + (d % 3);
    for (let k = 0; k < perDay; k++) {
      const hour = 9 + k * 2;
      list.push({
        id: `apt_f${d}_${k}`,
        patientId: patients[(d * 3 + k) % patients.length].id,
        date: addDays(T, d),
        time: `${String(hour).padStart(2, "0")}:00`,
        duration: 30,
        type: types[(d + k) % types.length],
        status: futureStatuses[k % futureStatuses.length],
        doctorId: "usr_doctor",
        room: k % 2 === 0 ? "غرفة 1" : "غرفة 2",
        fee: 300,
        source: k % 2 === 0 ? "online" : "clinic",
        complaint: complaints[(d + k) % complaints.length],
        createdAt: addDays(T, -2),
      });
    }
  }

  // past
  for (let p = 1; p <= 18; p++) {
    list.push({
      id: `apt_p${p}`,
      patientId: patients[p % patients.length].id,
      date: addDays(T, -p),
      time: `${String(9 + (p % 8)).padStart(2, "0")}:30`,
      duration: 30,
      type: p % 4 === 0 ? "followup" : "consultation",
      status: p % 9 === 0 ? "no-show" : "completed",
      doctorId: "usr_doctor",
      room: "غرفة 1",
      fee: 300,
      source: p % 3 === 0 ? "online" : "clinic",
      complaint: complaints[p % complaints.length],
      createdAt: addDays(T, -p - 2),
    });
  }
  return list;
}

function buildVisits(patients: Patient[]): Visit[] {
  const visits: Visit[] = [];
  for (let i = 0; i < 16; i++) {
    const p = patients[i % patients.length];
    const dx = DX[i % DX.length];
    visits.push({
      id: `vis_${i + 1}`,
      patientId: p.id,
      date: addDays(T, -(i * 4 + 2)),
      doctorId: "usr_doctor",
      type: i % 5 === 0 ? "followup" : i % 7 === 0 ? "telemedicine" : "consultation",
      chiefComplaint: CHIEF[i % CHIEF.length],
      history: i % 2 === 0 ? "لا توجد أمراض مزمنة معروفة سوى ما هو مسجل بالملف. لا يدخن." : "تاريخ مرضي بسيط، يتابع دوريًا بالعيادة.",
      examination: "الوعي كامل، العلامات الحيوية مستقرة، لا يوجد ضيق تنفس حاد. فحص الجهاز المصاب لا يظهر علامات خطورة.",
      diagnosis: dx,
      icd: `R${50 + (i % 9)}.${i % 9}`,
      plan: "بدء العلاج الدوائي، تحاليل دم شاملة، وإعادة التقييم بعد أسبوعين أو عند تدهور الأعراض.",
      vitals: {
        temp: 36.6 + (i % 6) * 0.15,
        bpSys: 110 + (i % 5) * 6,
        bpDia: 70 + (i % 4) * 4,
        pulse: 68 + (i % 7) * 3,
        weight: 58 + (i % 8) * 5.5,
        height: 158 + (i % 6) * 4,
        spo2: 96 + (i % 3),
        glucose: 90 + (i % 6) * 8,
      },
      notes: i === 2 ? "تم شرح خطة العلاج للمريض وتوقيع الإقرار." : undefined,
      followUpDate: addDays(T, -(i * 4 + 2) + 14),
      attachments: i % 3 === 0 ? [{ name: "تحاليل دم شاملة.pdf", kind: "lab" }] : [],
      createdAt: addDays(T, -(i * 4 + 2)),
    });
  }
  return visits;
}

function buildPrescriptions(patients: Patient[], visits: Visit[]): Prescription[] {
  return visits.slice(0, 12).map((v, i) => ({
    id: `rx_${i + 1}`,
    number: `RX-${2026}-${String(120 + i)}`,
    patientId: v.patientId,
    visitId: v.id,
    doctorId: "usr_doctor",
    date: v.date,
    diagnosis: v.diagnosis.join(" / "),
    items: [
      { ...MEDS[i % MEDS.length], id: uid("itm") },
      { ...MEDS[(i + 2) % MEDS.length], id: uid("itm"), notes: i % 2 === 0 ? "بعد الأكل" : undefined },
    ],
    advice: "الإكثار من السوائل، الراحة، وتجنب المجهود البدني العنيف لمدة أسبوع. العودة فورًا عند ظهور أعراض حادة.",
    status: i < 7 ? "active" : "completed",
    createdAt: v.date,
  }));
}

function buildInvoices(patients: Patient[], appointments: Appointment[]): Invoice[] {
  const completed = appointments.filter((a) => a.status === "completed").slice(0, 18);
  return completed.map((a, i) => {
    const items = [
      { id: uid("ii"), desc: a.type === "followup" ? "كشف متابعة" : "كشف استشاري", qty: 1, price: i % 4 === 0 ? 400 : 300 },
    ];
    if (i % 3 === 0) items.push({ id: uid("ii"), desc: "تحاليل معملية (صورة دم كاملة)", qty: 1, price: 180 });
    if (i % 5 === 0) items.push({ id: uid("ii"), desc: "رسم قلب كهربائي", qty: 1, price: 250 });
    const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
    const paid = i % 6 === 0 ? Math.round(subtotal * 0.5) : subtotal;
    return {
      id: `inv_${i + 1}`,
      number: `INV-2026-${String(410 + i)}`,
      patientId: a.patientId,
      appointmentId: a.id,
      date: a.date,
      items,
      discount: i % 7 === 0 ? 50 : 0,
      taxRate: 0,
      paid,
      method: i % 4 === 0 ? "instapay" : i % 3 === 0 ? "card" : "cash",
      status: paid >= subtotal ? "paid" : "partial",
      createdAt: a.date,
    };
  });
}

function buildBookings(patients: Patient[]): BookingRequest[] {
  const base = [
    {
      patientName: "هند مصطفى الشناوي",
      phone: "01033445566",
      gender: FEMALE,
      service: "كشف استشاري باطنة",
      complaint: "ألم مستمر في الجانب الأيمن من البطن منذ 4 أيام مع غثيان.",
      paymentMethod: "instapay" as const,
      paymentAmount: 150,
      status: "pending" as const,
      when: 1,
    },
    {
      patientName: "زياد محمد العشري",
      phone: "01199887766",
      gender: MALE,
      service: "متابعة ضغط الدم",
      complaint: "قياسات الضغط مرتفعة رغم الالتزام بالعلاج.",
      paymentMethod: "vodafone-cash" as const,
      paymentAmount: 150,
      status: "pending" as const,
      when: 2,
    },
    {
      patientName: "منى عبد الحميد",
      phone: "01277665544",
      gender: FEMALE,
      service: "استشارة عن بُعد",
      complaint: "أريد مراجعة نتائج تحاليل الغدة الدرقية.",
      paymentMethod: "card" as const,
      paymentAmount: 200,
      status: "verified" as const,
      when: 3,
    },
    {
      patientName: "خالد سعيد الجندي",
      phone: "01011223344",
      gender: MALE,
      service: "كشف جديد",
      complaint: "كحة جافة مستمرة منذ 10 أيام.",
      paymentMethod: "bank-transfer" as const,
      paymentAmount: 150,
      status: "converted" as const,
      when: 4,
    },
    {
      patientName: "أميرة فتحي",
      phone: "01566778899",
      gender: FEMALE,
      service: "كشف جلدية",
      complaint: "طفح جلدي متكرر بالوجه.",
      paymentMethod: "instapay" as const,
      paymentAmount: 100,
      status: "rejected" as const,
      when: 5,
    },
    {
      patientName: "حسام الدين رأفت",
      phone: "01066554433",
      gender: MALE,
      service: "كشف استشاري باطنة",
      complaint: "دوخة متكررة مع زغللة بالعين.",
      paymentMethod: "instapay" as const,
      paymentAmount: 150,
      status: "pending" as const,
      when: 0,
    },
  ];

  return base.map((b, i) => ({
    id: `bk_${i + 1}`,
    ref: `BK-${2026}-${String(880 + i)}`,
    patientName: b.patientName,
    phone: b.phone,
    email: i % 2 === 0 ? `patient${i + 1}@example.com` : undefined,
    gender: b.gender,
    service: b.service,
    preferredDate: addDays(T, b.when + 1),
    preferredTime: i % 2 === 0 ? "10:00" : "17:30",
    complaint: b.complaint,
    paymentMethod: b.paymentMethod,
    paymentRef: `TRX${(9234561 + i * 7919).toString()}`,
    paymentAmount: b.paymentAmount,
    receiptName: i % 3 === 0 ? `receipt-${i + 1}.jpg` : undefined,
    status: b.status,
    createdAt: addDays(T, -b.when - 1),
    reviewNote: b.status === "rejected" ? "لم يتم العثور على إيصال الدفع المرفق." : undefined,
    patientId: b.status === "converted" ? patients[0].id : undefined,
  }));
}

function buildArchive(patients: Patient[]): ArchiveItem[] {
  const defs: { title: string; category: ArchiveItem["category"]; format: ArchiveItem["format"] }[] = [
    { title: "تحاليل صورة دم كاملة — CBC", category: "lab", format: "pdf" },
    { title: "أشعة رنين مغناطيسي على الفقرات القطنية", category: "radiology", format: "pdf" },
    { title: "إقرار موافقة على إجراء طبي", category: "consent", format: "pdf" },
    { title: "تقرير استشاري قلب وأوعية دموية", category: "report", format: "docx" },
    { title: "بطاقة تأمين طبي — نسخة مصورة", category: "insurance", format: "jpg" },
    { title: "تحليل سكر صائم وتراكمي", category: "lab", format: "pdf" },
    { title: "أشعة مقطعية على الصدر", category: "radiology", format: "png" },
    { title: "تقرير خروج من المستشفى", category: "report", format: "pdf" },
    { title: "إقرار استلام وصفة طبية", category: "consent", format: "pdf" },
    { title: "تحليل وظائف كبد وكلى", category: "lab", format: "pdf" },
    { title: "تقرير متابعة ضغط الدم اليومي", category: "other", format: "docx" },
    { title: "موافقة على تصوير إشعاعي", category: "consent", format: "pdf" },
  ];
  return defs.map((d, i) => ({
    id: `arc_${i + 1}`,
    title: d.title,
    category: d.category,
    patientId: patients[i % patients.length].id,
    date: addDays(T, -(3 + i * 5)),
    tags: [i % 2 === 0 ? "متابعة" : "ملف جديد", i % 3 === 0 ? "مهم" : "عادي"],
    size: `${(0.4 + i * 0.37).toFixed(1)} MB`,
    format: d.format,
    note: i === 2 ? "موقّع إلكترونيًا من المريض." : undefined,
  }));
}

const setDays: Settings["workingDays"] = [
  { day: "السبت", open: true, from: "10:00", to: "18:00" },
  { day: "الأحد", open: true, from: "09:00", to: "18:00" },
  { day: "الإثنين", open: true, from: "09:00", to: "18:00" },
  { day: "الثلاثاء", open: true, from: "09:00", to: "18:00" },
  { day: "الأربعاء", open: true, from: "09:00", to: "18:00" },
  { day: "الخميس", open: true, from: "09:00", to: "14:00" },
  { day: "الجمعة", open: false, from: "—", to: "—" },
];

export const defaultSettings: Settings = {
  clinicName: "عيادة د. كريم الجوهري",
  clinicNameEn: "Dr. Karim El-Gohary Clinic",
  doctorName: "د. كريم الجوهري",
  specialty: "استشاري الباطنة العامة والجهاز الهضمي",
  phone: "0223456789",
  whatsapp: "01001234567",
  email: "hello@tabib.clinic",
  address: "٢٧ شارع ٩، المعادي، القاهرة",
  city: "القاهرة",
  currency: "ج.م",
  taxRate: 0,
  consultationFee: 300,
  followUpFee: 200,
  slotMinutes: 30,
  workingDays: setDays,
  onlineBookingEnabled: true,
  requirePayment: true,
  depositAmount: 150,
  autoConfirm: false,
  reminderHours: 24,
  paymentMethods: ["إنستاباي", "فودافون كاش", "تحويل بنكي", "بطاقة بنكية", "نقدي بالعيادة"],
  bankAccount: "بنك مصر — 1234 5678 9012 3456",
  instapayHandle: "karim.clinic@instapay",
  vodafoneCash: "0100 123 4567",
  theme: "light",
};

export const defaultProfile: DoctorProfile = {
  name: "د. كريم الجوهري",
  title: "استشاري الباطنة العامة والجهاز الهضمي",
  specialty: "الباطنة العامة",
  subSpecialty: "أمراض الجهاز الهضمي والكبد",
  bio:
    "أكثر من ١٨ عامًا في ممارسة الطب الباطني، مع اهتمام خاص بأمراض الجهاز الهضمي والكبد واضطرابات التمثيل الغذائي. أؤمن أن العلاقة بين الطبيب والمريض تبدأ بالاستماع الجيد، وتنتهي بخطة علاج واضحة يمكن للمريض تنفيذها بثقة.",
  philosophy:
    "الطب الجيد ليس وصف دواء فقط، بل شرح سبب المرض بلغة يفهمها المريض، وبناء خطة متابعة واقعية تحترم وقته وظروفه.",
  experienceYears: 18,
  patientsCount: "+9,600",
  rating: 4.9,
  reviewsCount: 327,
  languages: ["العربية", "الإنجليزية", "الفرنسية"],
  education: [
    { year: "2008", title: "بكالوريوس الطب والجراحة — بتقدير امتياز", place: "كلية الطب، جامعة القاهرة" },
    { year: "2012", title: "ماجستير الباطنة العامة", place: "جامعة عين شمس" },
    { year: "2016", title: "دكتوراه أمراض الجهاز الهضمي", place: "جامعة القاهرة" },
  ],
  certifications: [
    { year: "2017", title: "زمالة الجهاز الهضمي", org: "الجمعية الأوروبية لأمراض الجهاز الهضمي (UEG)" },
    { year: "2019", title: "دبلوم السونار البطني", org: "الجامعة الأمريكية بالقاهرة" },
    { year: "2022", title: "شهادة إدارة العيادات", org: "الكلية الملكية للأطباء — لندن" },
  ],
  memberships: [
    "الجمعية المصرية للجهاز الهضمي والكبد",
    "الجمعية الأوروبية للتغذية الإكلينيكية (ESPEN)",
    "نقابة الأطباء المصرية",
  ],
  services: [
    { icon: "stethoscope", title: "الكشف الاستشاري", desc: "تقييم شامل للحالة مع مراجعة التاريخ المرضي والتحاليل السابقة وخطة علاج واضحة.", price: 300 },
    { icon: "activity", title: "متابعة الأمراض المزمنة", desc: "متابعة الضغط والسكري والكوليسترول بخطة شهرية وتعديل الجرعات حسب النتائج.", price: 200 },
    { icon: "scan", title: "سونار البطن والكبد", desc: "تصوير بالموجات الصوتية داخل العيادة مع تقرير فوري وصور للمريض.", price: 350 },
    { icon: "flask", title: "تقييم نتائج التحاليل", desc: "قراءة تحاليلك بعناية وشرح مبسط لكل مؤشر وما يحتاج تعديلًا فعليًا.", price: 150 },
    { icon: "video", title: "استشارة عن بُعد", desc: "جلسة فيديو آمنة لمتابعة الحالات المستقرة أو مراجعة النتائج من منزلك.", price: 200 },
    { icon: "heart", title: "برامج إنقاص الوزن", desc: "خطة غذائية وطبية متكاملة بإشراف مباشر مع متابعة أسبوعية للنتائج.", price: 400 },
  ],
  awards: [
    { year: "2021", title: "أفضل طبيب باطنة — اختيار المرضى" },
    { year: "2023", title: "شهادة التميز في رعاية المرضى" },
  ],
  photoInitials: "ك.ج",
  publicSlug: "dr-karim",
};

export function createSeed(): DB {
  const patients = buildPatients();
  const appointments = buildAppointments(patients);
  const visits = buildVisits(patients);
  const prescriptions = buildPrescriptions(patients, visits);
  const invoices = buildInvoices(patients, appointments);
  const bookings = buildBookings(patients);
  const archive = buildArchive(patients);
  const users = buildUsers();

  // ensure invoices numbering helper import is used
  void genNumber;
  void initials;

  return {
    patients,
    appointments,
    visits,
    prescriptions,
    invoices,
    bookings,
    archive,
    users,
    reminders: [],
    audit: [],
    settings: defaultSettings,
    profile: defaultProfile,
  };
}
