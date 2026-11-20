import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { ReportModel, ReportRow } from '@/lib/finance'
import type { AccountType } from '@/types'
import type { Company, TrialBalanceLine } from '@/lib/db'
import { formatNumber } from '@/lib/format'
import { inferSection } from '@/data/trialBalanceTemplates'

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80)
}

function reportLabels(model: ReportModel, lang: 'ar' | 'en') {
  return {
    report: lang === 'ar' ? model.titleAr : model.titleEn,
    subtitle: lang === 'ar' ? model.subtitleAr : model.subtitleEn,
    item: lang === 'ar' ? 'البند' : 'Item',
    current: lang === 'ar' ? 'الفترة الحالية' : 'Current period',
    prior: lang === 'ar' ? 'الفترة السابقة' : 'Prior period',
    debit: lang === 'ar' ? 'مدين' : 'Debit',
    credit: lang === 'ar' ? 'دائن' : 'Credit',
    company: lang === 'ar' ? 'الشركة' : 'Company',
    year: lang === 'ar' ? 'السنة المالية' : 'Financial year',
    period: lang === 'ar' ? 'الفترة' : 'Period',
    currency: lang === 'ar' ? 'العملة' : 'Currency',
    approvedBy: lang === 'ar' ? 'اعتماد' : 'Approved by',
    generated: lang === 'ar' ? 'تاريخ الإعداد' : 'Generated at',
    notes: lang === 'ar' ? 'ملاحظات وإفصاحات' : 'Notes & disclosures',
    total: lang === 'ar' ? 'الإجمالي' : 'Total',
  }
}

export interface ReportExportMeta {
  companyNameAr: string
  companyNameEn: string
  year: string
  periodStart: string
  periodEnd: string
  currency: string
  approvedBy?: string
  generatedAt: string
}

export function exportReportToExcel(model: ReportModel, meta: ReportExportMeta, lang: 'ar' | 'en') {
  const labels = reportLabels(model, lang)
  const aoa: (string | number)[][] = [
    [labels.report],
    [labels.company, lang === 'ar' ? meta.companyNameAr : meta.companyNameEn],
    [labels.year, meta.year],
    [labels.period, `${meta.periodStart} — ${meta.periodEnd}`],
    [labels.currency, meta.currency],
    [labels.approvedBy, meta.approvedBy || '—'],
    [labels.generated, meta.generatedAt],
    [],
  ]
  if (model.columns === 'debit-credit') {
    aoa.push([labels.item, labels.debit, labels.credit])
  } else if (model.columns === 'amount-prior') {
    aoa.push([labels.item, labels.current, labels.prior])
  } else {
    aoa.push([labels.item, labels.current])
  }

  for (const section of model.sections) {
    aoa.push([lang === 'ar' ? section.titleAr : section.titleEn])
    for (const r of section.rows) {
      const label = lang === 'ar' ? r.labelAr : r.labelEn
      if (model.columns === 'debit-credit') {
        aoa.push([label, r.debit ?? '', r.credit ?? ''])
      } else if (model.columns === 'amount-prior') {
        aoa.push([label, r.amount ?? '', r.prior ?? ''])
      } else {
        aoa.push([label, r.amount ?? ''])
      }
    }
    aoa.push([])
  }
  aoa.push([labels.notes])
  const notes = lang === 'ar' ? model.notesAr : model.notesEn
  notes.forEach((n) => aoa.push([n]))

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 55 }, { wch: 18 }, { wch: 18 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'القائمة' : 'Report')
  XLSX.writeFile(wb, `${safeName(labels.report)}-${meta.year}.xlsx`)
}

export async function exportElementToPdf(elementId: string, filename: string, lang: 'ar' | 'en') {
  const element = document.getElementById(elementId)
  if (!element) throw new Error('ELEMENT_NOT_FOUND')
  await document.fonts.ready
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
  })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const margin = 8
  const contentWidth = pageWidth - margin * 2
  const imgHeight = (canvas.height * contentWidth) / canvas.width
  const pageContentHeight = pageHeight - margin * 2
  const image = canvas.toDataURL('image/png')
  let heightLeft = imgHeight
  let position = margin
  pdf.addImage(image, 'PNG', margin, position, contentWidth, imgHeight, undefined, 'FAST')
  heightLeft -= pageContentHeight
  while (heightLeft > 0) {
    position -= pageContentHeight
    pdf.addPage()
    pdf.addImage(image, 'PNG', margin, position, contentWidth, imgHeight, undefined, 'FAST')
    heightLeft -= pageContentHeight
  }
  pdf.save(`${safeName(filename)}.pdf`)
  void lang
}

export function printElement(elementId: string) {
  const element = document.getElementById(elementId)
  if (!element) return
  const printRoot = document.createElement('div')
  printRoot.id = 'print-root'
  printRoot.className = 'print-root'
  const clone = element.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.no-print').forEach((n) => n.remove())
  printRoot.appendChild(clone)
  document.body.appendChild(printRoot)
  document.body.classList.add('printing')
  const cleanup = () => {
    document.body.classList.remove('printing')
    printRoot.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  setTimeout(cleanup, 60000)
}

export interface ParsedTrialBalance {
  lines: Array<{
    code: string; nameAr: string; nameEn: string; type: AccountType; section: string
    debit: number; credit: number; currency: string; exchangeRate: number; debitBase: number; creditBase: number; notes?: string
  }>
  totalDebit: number
  totalCredit: number
  balanced: boolean
  warnings: string[]
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  const text = String(value).replace(/,/g, '').replace(/[^\d.\-()]/g, '').trim()
  if (!text) return 0
  if (text.startsWith('(') && text.endsWith(')')) return -Math.abs(parseFloat(text.slice(1, -1)))
  const n = parseFloat(text)
  return Number.isFinite(n) ? n : 0
}

function normalizeHeader(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[\s_\-:/]/g, '')
}

function inferType(code: string, name: string): AccountType {
  const c = code.trim()
  if (c.startsWith('1')) return 'asset'
  if (c.startsWith('2')) return 'liability'
  if (c.startsWith('3')) return 'equity'
  if (c.startsWith('4')) return 'revenue'
  if (c.startsWith('5')) return 'expense'
  const n = name.toLowerCase()
  if (/asset|أصول|نقدية|مخزون|مدينون|عملاء/.test(n)) return 'asset'
  if (/liabil|خصوم|دائنون|موردون|قروض|مستحقة/.test(n)) return 'liability'
  if (/equity|حقوق|رأس المال|احتياط|محتجز/.test(n)) return 'equity'
  if (/revenue|إيراد|مبيعات|أتعاب/.test(n)) return 'revenue'
  return 'expense'
}

export async function parseTrialBalanceFile(file: File, defaultCurrency: string, rateToBase = 1): Promise<ParsedTrialBalance> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const preferred = workbook.SheetNames.find((n) => /trial|ميزان/i.test(n)) || workbook.SheetNames[0]
  const sheet = workbook.Sheets[preferred]
  if (!sheet) throw new Error('EMPTY_WORKBOOK')
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
  let headerIndex = -1
  let headers: string[] = []
  for (let i = 0; i < Math.min(aoa.length, 8); i++) {
    const row = (aoa[i] || []).map(normalizeHeader)
    const hasCode = row.some((h) => ['code', 'accountcode', 'كودالحساب', 'الكود', 'رمزالحساب'].includes(h))
    if (hasCode) { headerIndex = i; headers = row; break }
  }
  if (headerIndex === -1) throw new Error('HEADER_NOT_FOUND')

  const find = (...names: string[]) => headers.findIndex((h) => names.includes(h))
  const idxCode = find('code', 'accountcode', 'كودالحساب', 'الكود', 'رمزالحساب')
  const idxAr = find('namear', 'accountnamear', 'اسمالحساببالعربية', 'الاسمبالعربية', 'اسمالحساب')
  const idxEn = find('nameen', 'accountnameen', 'اسمالحساببالانجليزية', 'الاسمالانجليزي', 'nameenglish')
  const idxType = find('type', 'accounttype', 'النوع', 'نوعالحساب')
  const idxSection = find('section', 'التصنيف', 'القسم')
  const idxDebit = find('debit', 'مدين', 'المدين')
  const idxCredit = find('credit', 'دائن', 'الدائن')
  const idxCurrency = find('currency', 'العملة')
  const idxRate = find('exchangeRate', 'rate', 'سعرالصرف')
  const idxNotes = find('notes', 'ملاحظات')

  if (idxCode === -1 || idxAr === -1 || idxDebit === -1 || idxCredit === -1) throw new Error('REQUIRED_COLUMNS_MISSING')

  const lines: ParsedTrialBalance['lines'] = []
  const warnings: string[] = []
  for (let i = headerIndex + 1; i < aoa.length; i++) {
    const row = aoa[i] || []
    const code = String(row[idxCode] ?? '').trim().replace(/\s+/g, '')
    if (!code || /total|اجماع|الإجمالي|الاجمالي/i.test(code)) continue
    const nameAr = String(row[idxAr] ?? '').trim()
    const nameEn = idxEn >= 0 ? String(row[idxEn] ?? '').trim() : nameAr
    if (!nameAr && !nameEn) continue
    const type = (idxType >= 0 ? String(row[idxType]).trim().toLowerCase() : '') as AccountType
    const resolvedType: AccountType = ['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type) ? type : inferType(code, `${nameAr} ${nameEn}`)
    const currency = idxCurrency >= 0 ? String(row[idxCurrency] || defaultCurrency).trim().toUpperCase() : defaultCurrency
    const rate = idxRate >= 0 ? toNumber(row[idxRate]) || rateToBase : rateToBase
    let debit = toNumber(row[idxDebit])
    let credit = toNumber(row[idxCredit])
    if (credit < 0) { debit += Math.abs(credit); credit = 0 }
    if (debit < 0) { credit += Math.abs(debit); debit = 0 }
    const factor = currency === defaultCurrency ? 1 : (rate || 1)
    const section = idxSection >= 0 && row[idxSection]
      ? String(row[idxSection]).trim()
      : inferSection(code, resolvedType, nameAr, nameEn)
    lines.push({
      code, nameAr: nameAr || nameEn, nameEn: nameEn || nameAr, type: resolvedType, section,
      debit, credit, currency, exchangeRate: factor,
      debitBase: r2(debit * factor), creditBase: r2(credit * factor),
      notes: idxNotes >= 0 ? String(row[idxNotes] ?? '') : undefined,
    })
  }
  if (!lines.length) throw new Error('NO_ROWS')
  if (idxEn === -1) warnings.push('English account names were not found; Arabic names were used for both languages.')
  const totalDebit = r2(lines.reduce((s, l) => s + l.debitBase, 0))
  const totalCredit = r2(lines.reduce((s, l) => s + l.creditBase, 0))
  return { lines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01, warnings }
}

export function exportTrialBalanceTemplate(
  company: Company,
  year: string,
  items: Array<{ code: string; nameAr: string; nameEn: string; type: AccountType; section: string }>,
  lang: 'ar' | 'en' = 'ar',
) {
  const headers = lang === 'ar'
    ? ['كود الحساب', 'اسم الحساب بالعربية', 'اسم الحساب بالإنجليزية', 'نوع الحساب', 'التصنيف', 'العملة', 'مدين', 'دائن', 'سعر الصرف', 'ملاحظات']
    : ['Account Code', 'Account Name (Arabic)', 'Account Name (English)', 'Account Type', 'Section', 'Currency', 'Debit', 'Credit', 'Exchange Rate', 'Notes']
  const rows = items.map((i) => [i.code, i.nameAr, i.nameEn, i.type, i.section, company.baseCurrency, 0, 0, 1, ''])
  const guide = lang === 'ar' ? [
    ['تعليمات إعداد ميزان المراجعة'],
    ['1. لا تعدل أعمدة كود الحساب أو اسم الحساب أو النوع.'],
    ['2. أدخل الأرصدة في عمودي مدين ودائن فقط، ولا تدخل رصيداً في العمودين معاً لنفس الحساب.'],
    ['3. مجموع المدين يجب أن يساوي مجموع الدائن. إذا لم يتساوَ، سيظهر تحذير عند الاستيراد ولن يُعتمد الميزان.'],
    ['4. يمكنك إضافة حسابات جديدة أسفل القائمة بنفس تنسيق الكود.'],
    ['5. إذا كانت العملة مختلفة عن عملة الشركة الأساسية، أدخل سعر التحويل مقابل الجنيه المصري.'],
    ['6. أرسل الملف إلى مكتب المراقب المالي المعتمد بعد الانتهاء. لا تُعتمد القوائم إلا بعد المراجعة والاعتماد.'],
  ] : [
    ['Trial Balance preparation instructions'],
    ['1. Do not change the account code, name or type columns.'],
    ['2. Enter balances in the Debit and Credit columns only. Never enter a balance in both columns for the same account.'],
    ['3. Total debits must equal total credits. Otherwise the file will be flagged and cannot be approved.'],
    ['4. You may add new accounts at the bottom using the same code format.'],
    ['5. If a balance is in a currency other than the company base currency, enter the rate against EGP.'],
    ['6. Send the completed file to the certified financial controller office. Statements are only generated after review and approval.'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 12 }, { wch: 38 }, { wch: 38 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 28 }]
  const guideWs = XLSX.utils.aoa_to_sheet(guide)
  guideWs['!cols'] = [{ wch: 110 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'ميزان المراجعة' : 'Trial Balance')
  XLSX.utils.book_append_sheet(wb, guideWs, lang === 'ar' ? 'تعليمات' : 'Instructions')
  XLSX.writeFile(wb, `TB-${safeName(company.nameEn || company.nameAr)}-${year}.xlsx`)
}

export function exportTrialBalanceLinesToExcel(
  lines: TrialBalanceLine[],
  companyName: string,
  year: string,
  lang: 'ar' | 'en',
) {
  const headers = lang === 'ar'
    ? ['كود الحساب', 'اسم الحساب بالعربية', 'اسم الحساب بالإنجليزية', 'النوع', 'التصنيف', 'مدين', 'دائن']
    : ['Code', 'Name (AR)', 'Name (EN)', 'Type', 'Section', 'Debit', 'Credit']
  const rows = lines.map((l) => [l.code, l.nameAr, l.nameEn, l.type, l.section, l.debit, l.credit])
  const totalDebit = r2(lines.reduce((s, l) => s + l.debit, 0))
  const totalCredit = r2(lines.reduce((s, l) => s + l.credit, 0))
  rows.push(['', '', '', '', '', totalDebit, totalCredit])
  const ws = XLSX.utils.aoa_to_sheet([[companyName, year], [], headers, ...rows])
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'TB')
  XLSX.writeFile(wb, `TB-${safeName(companyName)}-${year}.xlsx`)
}

export function exportBudgetToExcel(
  companyName: string,
  year: string,
  rows: Array<{ code: string; nameAr: string; nameEn: string; actual: number; budget: number }>,
  currency: string,
  lang: 'ar' | 'en',
) {
  const headers = lang === 'ar'
    ? ['كود الحساب', 'الحساب', 'الفعلي', 'الموازنة', 'الانحراف', 'النسبة %']
    : ['Code', 'Account', 'Actual', 'Budget', 'Variance', 'Variance %']
  const body = rows.map((r) => [r.code, lang === 'ar' ? r.nameAr : r.nameEn, r.actual, r.budget, r.actual - r.budget, r.budget ? ((r.actual - r.budget) / r.budget) * 100 : 0])
  const ws = XLSX.utils.aoa_to_sheet([[companyName, year, currency], [], headers, ...body])
  ws['!cols'] = [{ wch: 14 }, { wch: 46 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'الموازنة' : 'Budget')
  XLSX.writeFile(wb, `Budget-${safeName(companyName)}-${year}.xlsx`)
}

export function exportJsonFile(data: unknown, filename: string) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function formatReportCell(value: number | undefined, lang: 'ar' | 'en', decimals = 2) {
  if (value === undefined) return '—'
  return formatNumber(value, lang, decimals)
}

export function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function flattenModelRows(model: ReportModel): ReportRow[] {
  return model.sections.flatMap((s) => s.rows)
}
