import { db, type Adjustment, type TrialBalanceImport, type TrialBalanceLine } from '@/lib/db'
import type { AccountType, CurrencyCode } from '@/types'
import type { Company } from '@/lib/db'
import { inferSection } from '@/data/trialBalanceTemplates'
import { buildEngineLines, computeStatements, type FinancialDataset } from '@/lib/finance'
import { syncAccountsFromLines } from '@/services/account.service'
import { logAudit } from '@/services/auth.service'
import { r2 } from '@/lib/exports'

export interface DraftLineInput {
  code: string
  nameAr: string
  nameEn: string
  type: AccountType
  section?: string
  debit: number
  credit: number
  currency?: string
  exchangeRate?: number
  notes?: string
}

export async function getRateMap(): Promise<Record<string, number>> {
  const rates = await db.currencyRates.toArray()
  const map: Record<string, number> = { EGP: 1 }
  for (const rate of rates) map[rate.code] = rate.rateToEGP
  return map
}

export function rateToBase(currency: string | undefined, base: string, rates: Record<string, number>) {
  if (!currency || currency === base) return 1
  const currencyRate = rates[currency] || 1
  const baseRate = rates[base] || 1
  return currencyRate / baseRate
}

export async function saveTrialBalance(input: {
  importId?: number
  company: Company
  year: string
  periodStart: string
  periodEnd: string
  source: TrialBalanceImport['source']
  status: 'draft' | 'pending_approval'
  lines: DraftLineInput[]
  notes?: string
  submittedBy?: number
  submittedByName?: string
}): Promise<number> {
  if (!input.lines.length) throw new Error('NO_LINES')
  const rates = await getRateMap()
  const now = new Date().toISOString()
  const normalized = input.lines.map((l, index) => {
    let debit = Number.isFinite(l.debit) ? l.debit : 0
    let credit = Number.isFinite(l.credit) ? l.credit : 0
    if (debit < 0 && credit === 0) { credit = Math.abs(debit); debit = 0 }
    if (credit < 0 && debit === 0) { debit = Math.abs(credit); credit = 0 }
    if (debit > 0 && credit > 0) {
      const net = debit - credit
      debit = net > 0 ? net : 0
      credit = net < 0 ? Math.abs(net) : 0
    }
    const currency = (l.currency || input.company.baseCurrency) as CurrencyCode
    const factor = l.exchangeRate && currency !== input.company.baseCurrency
      ? l.exchangeRate
      : rateToBase(currency, input.company.baseCurrency, rates)
    return {
      ...l,
      debit: r2(debit), credit: r2(credit),
      debitBase: r2(debit * factor), creditBase: r2(credit * factor),
      currency, exchangeRate: factor,
      section: l.section || inferSection(l.code, l.type, l.nameAr, l.nameEn),
      order: index,
    }
  })
  const totalDebit = r2(normalized.reduce((s, l) => s + l.debitBase, 0))
  const totalCredit = r2(normalized.reduce((s, l) => s + l.creditBase, 0))
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
  const header = {
    companyId: input.company.id!,
    fiscalYear: input.year,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: input.status,
    source: input.source,
    submittedBy: input.submittedBy,
    submittedByName: input.submittedByName,
    totalDebit, totalCredit, isBalanced,
    lineCount: normalized.length,
    notes: input.notes,
    updatedAt: now,
  }
  let importId = input.importId
  if (importId) {
    const existing = await db.trialBalanceImports.get(importId)
    if (!existing) throw new Error('IMPORT_NOT_FOUND')
    if (existing.status === 'approved') throw new Error('CANNOT_EDIT_APPROVED')
    await db.trialBalanceImports.update(importId, header)
    await db.trialBalanceLines.where({ importId }).delete()
  } else {
    importId = await db.trialBalanceImports.add({ ...header, createdAt: now } as TrialBalanceImport)
  }
  const rows: TrialBalanceLine[] = normalized.map((l) => ({
    importId: importId!, companyId: input.company.id!, code: l.code, nameAr: l.nameAr, nameEn: l.nameEn,
    type: l.type, section: l.section, debit: l.debit, credit: l.credit, currency: l.currency,
    exchangeRate: l.exchangeRate, debitBase: l.debitBase, creditBase: l.creditBase, order: l.order, notes: l.notes,
  }))
  await db.trialBalanceLines.bulkAdd(rows)
  await logAudit(
    input.importId ? 'update' : 'create', 'trial_balance', importId,
    `حفظ ميزان مراجعة ${input.company.nameAr} لسنة ${input.year}`,
    `Saved trial balance for ${input.company.nameEn}, ${input.year}`,
    input.submittedByName,
  )
  return importId!
}

export async function getTrialBalanceDetail(importId: number) {
  const header = await db.trialBalanceImports.get(importId)
  const lines = await db.trialBalanceLines.where({ importId }).sortBy('order')
  return { header, lines }
}

export async function listTrialBalances(companyId?: number) {
  const all = companyId
    ? await db.trialBalanceImports.where({ companyId }).toArray()
    : await db.trialBalanceImports.toArray()
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getLatestApproved(companyId: number, year: string) {
  const imports = await db.trialBalanceImports.where({ companyId, fiscalYear: year }).toArray()
  const approved = imports.filter((i) => i.status === 'approved').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (!approved) return undefined
  const lines = await db.trialBalanceLines.where({ importId: approved.id! }).sortBy('order')
  return { header: approved, lines }
}

export async function getCompanyYears(companyId: number): Promise<string[]> {
  const imps = await db.trialBalanceImports.where({ companyId }).toArray()
  const years = new Set(imps.map((i) => i.fiscalYear))
  const current = new Date().getFullYear()
  years.add(String(current))
  return Array.from(years).sort((a, b) => b.localeCompare(a))
}

export async function createOpeningEntry(
  companyId: number,
  year: string,
  periodStart: string,
  lines: TrialBalanceLine[],
  reviewer: { id?: number; nameAr: string; nameEn: string },
) {
  const existing = await db.adjustments.where({ companyId, fiscalYear: year }).toArray()
  const opening = existing.find((a) => a.kind === 'opening')
  if (opening) return opening.id
  const now = new Date().toISOString()
  const openingLines = lines
    .filter((l) => Math.abs(l.debitBase || 0) > 0.001 || Math.abs(l.creditBase || 0) > 0.001)
    .map((l) => ({
      code: l.code,
      nameAr: l.nameAr,
      nameEn: l.nameEn,
      type: l.type,
      section: l.section || inferSection(l.code, l.type, l.nameAr, l.nameEn),
      debit: r2(l.debitBase || 0),
      credit: r2(l.creditBase || 0),
    }))
  if (!openingLines.length) return undefined
  const id = await db.adjustments.add({
    companyId,
    fiscalYear: year,
    no: `OPEN-${year}`,
    kind: 'opening',
    date: periodStart || `${year}-01-01`,
    descriptionAr: 'قيد افتتاحي آلي مطابق لأرصدة ميزان المراجعة المعتمد',
    descriptionEn: 'Automatic opening entry matching the approved trial balance',
    reference: `TB-${year}`,
    status: 'approved',
    lines: openingLines,
    submittedByName: 'النظام - توليد آلي',
    reviewedBy: reviewer.id,
    reviewedByName: reviewer.nameAr,
    reviewedAt: now,
    reviewNotes: 'أُنشئ تلقائياً عند اعتماد ميزان المراجعة للحفاظ على توازن النظام ومسار التدقيق.',
    createdAt: now,
    updatedAt: now,
  } as Adjustment)
  await logAudit('generate', 'opening_entry', id,
    `توليد قيد افتتاحي آلي لسنة ${year}`,
    `Generated automatic opening entry for ${year}`,
    reviewer.nameAr)
  return id
}

export async function approveTrialBalance(
  importId: number,
  reviewer: { id?: number; nameAr: string; nameEn: string },
  notes?: string,
) {
  const header = await db.trialBalanceImports.get(importId)
  if (!header) throw new Error('IMPORT_NOT_FOUND')
  if (header.status === 'approved') throw new Error('ALREADY_APPROVED')
  if (!header.isBalanced) throw new Error('UNBALANCED_TB')
  const lines = await db.trialBalanceLines.where({ importId }).toArray()
  const company = await db.companies.get(header.companyId)
  if (!company) throw new Error('COMPANY_NOT_FOUND')
  await db.trialBalanceImports.update(importId, {
    status: 'approved',
    reviewedBy: reviewer.id,
    reviewedByName: reviewer.nameAr,
    reviewedAt: new Date().toISOString(),
    reviewNotes: notes,
    updatedAt: new Date().toISOString(),
  })
  await syncAccountsFromLines(header.companyId, lines)
  await createOpeningEntry(
    header.companyId,
    header.fiscalYear,
    header.periodStart,
    lines,
    reviewer,
  )
  await logAudit('approve', 'trial_balance', importId,
    `اعتماد ميزان مراجعة ${company.nameAr} لسنة ${header.fiscalYear}`,
    `Approved trial balance of ${company.nameEn} for ${header.fiscalYear}`,
    reviewer.nameAr)
  try {
    const dataset = await buildCompanyDataset(header.companyId, header.fiscalYear)
    const fs = computeStatements(dataset)
    await db.archive.add({
      companyId: header.companyId,
      year: header.fiscalYear,
      type: 'financial_statements',
      titleAr: `قوائم مالية معتمدة - ${company.nameAr} - ${header.fiscalYear}`,
      titleEn: `Approved Financial Statements - ${company.nameEn} - ${header.fiscalYear}`,
      data: {
        importId,
        approvedBy: reviewer.nameAr,
        approvedAt: new Date().toISOString(),
        totalDebit: header.totalDebit,
        totalCredit: header.totalCredit,
        lines,
        statements: fs,
      },
      archivedAt: new Date().toISOString(),
      archivedBy: reviewer.nameAr,
    })
  } catch {
    // The approval stands even if a prior-year comparison cannot yet be assembled.
  }
  return true
}

export async function rejectTrialBalance(importId: number, reviewer: { id?: number; nameAr: string; nameEn: string }, notes: string) {
  const header = await db.trialBalanceImports.get(importId)
  if (!header) throw new Error('IMPORT_NOT_FOUND')
  await db.trialBalanceImports.update(importId, {
    status: 'rejected', reviewedBy: reviewer.id, reviewedByName: reviewer.nameAr,
    reviewedAt: new Date().toISOString(), reviewNotes: notes, updatedAt: new Date().toISOString(),
  })
  await logAudit('reject', 'trial_balance', importId, 'رفض ميزان المراجعة وإعادته للتصحيح', 'Rejected trial balance and returned for correction', reviewer.nameAr)
}

export async function deleteTrialBalance(importId: number) {
  const header = await db.trialBalanceImports.get(importId)
  if (header?.status === 'approved') throw new Error('CANNOT_DELETE_APPROVED')
  await db.transaction('rw', [db.trialBalanceImports, db.trialBalanceLines], async () => {
    await db.trialBalanceLines.where({ importId }).delete()
    await db.trialBalanceImports.delete(importId)
  })
  await logAudit('delete', 'trial_balance', importId, 'حذف مسودة ميزان مراجعة', 'Deleted trial balance draft')
}

export async function buildCompanyDataset(companyId: number, year: string): Promise<FinancialDataset> {
  const company = await db.companies.get(companyId)
  if (!company) throw new Error('COMPANY_NOT_FOUND')
  const current = await getLatestApproved(companyId, year)
  if (!current) throw new Error('NO_APPROVED_TB')
  const adjustments = await db.adjustments.where({ companyId }).toArray()
  const currentAdjustments = adjustments.filter(
    (a) => a.fiscalYear === year && a.status === 'approved' && a.kind !== 'opening',
  )
  const lines = buildEngineLines(current.lines, currentAdjustments)

  const priorYear = String(Number(year) - 1)
  const prior = await getLatestApproved(companyId, priorYear)
  const priorAdjustments = adjustments.filter(
    (a) => a.fiscalYear === priorYear && a.status === 'approved' && a.kind !== 'opening',
  )
  const priorLines = prior ? buildEngineLines(prior.lines, priorAdjustments) : []
  return {
    meta: {
      companyId,
      companyNameAr: company.nameAr,
      companyNameEn: company.nameEn,
      year,
      priorYear: prior ? priorYear : undefined,
      periodStart: current.header.periodStart,
      periodEnd: current.header.periodEnd,
      currency: company.baseCurrency,
      legalForm: company.legalForm,
      activity: company.activity,
      size: company.size,
      importId: current.header.id,
      approvedBy: current.header.reviewedByName,
      approvedAt: current.header.reviewedAt,
    },
    lines,
    priorLines,
    hasPrior: !!prior,
  }
}

export async function getApprovedDatasetOrNull(companyId: number, year: string) {
  try {
    return await buildCompanyDataset(companyId, year)
  } catch {
    return null
  }
}

// ============ Adjustments ============

export async function saveAdjustment(input: {
  id?: number
  company: Company
  year: string
  no?: string
  date: string
  descriptionAr: string
  descriptionEn: string
  reference?: string
  status: 'draft' | 'pending_approval'
  lines: Adjustment['lines']
  submittedBy?: number
  submittedByName?: string
}) {
  if (input.lines.length < 2) throw new Error('MIN_TWO_LINES')
  const totalDebit = input.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = input.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) >= 0.01) throw new Error('UNBALANCED_ADJUSTMENT')
  const count = await db.adjustments.where({ companyId: input.company.id! }).count()
  const no = input.no || `ADJ-${input.year}-${String(count + 1).padStart(3, '0')}`
  const now = new Date().toISOString()
  const header = {
    companyId: input.company.id!,
    fiscalYear: input.year,
    no,
    kind: 'adjustment' as const,
    date: input.date,
    descriptionAr: input.descriptionAr,
    descriptionEn: input.descriptionEn,
    reference: input.reference,
    status: input.status,
    lines: input.lines.map((l) => ({ ...l, section: l.section || inferSection(l.code, l.type, l.nameAr, l.nameEn) })),
    submittedBy: input.submittedBy,
    submittedByName: input.submittedByName,
    updatedAt: now,
  }
  if (input.id) {
    const existing = await db.adjustments.get(input.id)
    if (existing?.status === 'approved') throw new Error('CANNOT_EDIT_APPROVED')
    await db.adjustments.update(input.id, header)
    return input.id
  }
  return db.adjustments.add({ ...header, createdAt: now } as Adjustment)
}

export async function approveAdjustment(id: number, reviewer: { id?: number; nameAr: string }, notes?: string) {
  const adj = await db.adjustments.get(id)
  if (!adj) throw new Error('NOT_FOUND')
  const debit = adj.lines.reduce((s, l) => s + l.debit, 0)
  const credit = adj.lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(debit - credit) >= 0.01) throw new Error('UNBALANCED_ADJUSTMENT')
  await db.adjustments.update(id, {
    status: 'approved', reviewedBy: reviewer.id, reviewedByName: reviewer.nameAr,
    reviewedAt: new Date().toISOString(), reviewNotes: notes, updatedAt: new Date().toISOString(),
  })
  await logAudit('approve', 'adjustment', id, `اعتماد قيد تسوية ${adj.no}`, `Approved adjusting entry ${adj.no}`, reviewer.nameAr)
}

export async function rejectAdjustment(id: number, reviewer: { id?: number; nameAr: string }, notes: string) {
  await db.adjustments.update(id, {
    status: 'rejected', reviewedBy: reviewer.id, reviewedByName: reviewer.nameAr,
    reviewedAt: new Date().toISOString(), reviewNotes: notes, updatedAt: new Date().toISOString(),
  })
  await logAudit('reject', 'adjustment', id, 'رفض قيد تسوية', 'Rejected adjusting entry', reviewer.nameAr)
}

export async function deleteAdjustment(id: number) {
  const adj = await db.adjustments.get(id)
  if (adj?.status === 'approved') throw new Error('CANNOT_DELETE_APPROVED')
  await db.adjustments.delete(id)
  await logAudit('delete', 'adjustment', id, 'حذف قيد تسوية', 'Deleted adjusting entry')
}

export async function getAdjustments(companyId: number, year?: string, includeOpening = false) {
  const all = await db.adjustments.where({ companyId }).toArray()
  return all
    .filter((a) => (includeOpening || a.kind !== 'opening') && (!year || a.fiscalYear === year))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function restoreArchiveToDraft(archiveId: number, user: { id?: number; nameAr: string }) {
  const item = await db.archive.get(archiveId)
  if (!item) throw new Error('ARCHIVE_NOT_FOUND')
  const data: any = item.data
  const lines: TrialBalanceLine[] = data.lines || []
  if (!lines.length) throw new Error('NO_ARCHIVED_LINES')
  const company = await db.companies.get(item.companyId)
  if (!company) throw new Error('COMPANY_NOT_FOUND')
  const now = new Date().toISOString()
  const totalDebit = lines.reduce((s, l) => s + (l.debitBase ?? l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.creditBase ?? l.credit), 0)
  const newImport = await db.trialBalanceImports.add({
    companyId: item.companyId, fiscalYear: item.year,
    periodStart: `${item.year}-01-01`, periodEnd: `${item.year}-12-31`,
    status: 'pending_approval', source: 'archive_restore',
    submittedByName: user.nameAr,
    totalDebit: r2(totalDebit), totalCredit: r2(totalCredit),
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    lineCount: lines.length, notes: `Restored from archive #${archiveId}`,
    createdAt: now, updatedAt: now,
  } as TrialBalanceImport)
  await db.trialBalanceLines.bulkAdd(lines.map((l, index) => ({
    ...l, id: undefined, importId: newImport, companyId: item.companyId, order: index,
  })))
  await logAudit('create', 'archive_restore', archiveId, `استعادة ميزان مراجعة من الأرشيف (${item.year})`, `Restored trial balance from archive (${item.year})`, user.nameAr)
  return newImport
}
