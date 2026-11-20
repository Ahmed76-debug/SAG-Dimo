import type { AccountType, CurrencyCode } from '@/types'
import { inferSection, sectionLabel } from '@/data/trialBalanceTemplates'

export interface EngineLine {
  code: string
  nameAr: string
  nameEn: string
  type: AccountType
  section: string
  debit: number
  credit: number
  balance: number
}

export interface DatasetMeta {
  companyId: number
  companyNameAr: string
  companyNameEn: string
  year: string
  priorYear?: string
  periodStart: string
  periodEnd: string
  currency: CurrencyCode
  legalForm?: string
  activity?: string
  size?: string
  importId?: number
  approvedBy?: string
  approvedAt?: string
}

export interface FinancialDataset {
  meta: DatasetMeta
  lines: EngineLine[]
  priorLines: EngineLine[]
  hasPrior: boolean
}

export interface ReportRow {
  labelAr: string
  labelEn: string
  amount?: number
  prior?: number
  debit?: number
  credit?: number
  percent?: number
  isTotal?: boolean
  isSubtotal?: boolean
  isHeader?: boolean
  isNegative?: boolean
  indent?: number
}

export interface ReportSection {
  titleAr: string
  titleEn: string
  rows: ReportRow[]
}

export interface ReportModel {
  key: string
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  sections: ReportSection[]
  columns: 'amount-prior' | 'debit-credit' | 'amount'
  notesAr: string[]
  notesEn: string[]
}

export interface RatioResult {
  key: string
  labelAr: string
  labelEn: string
  value: number
  display: string
  benchmarkAr: string
  benchmarkEn: string
  status: 'good' | 'warn' | 'bad' | 'neutral'
  hintAr: string
  hintEn: string
}

export interface Insight {
  ar: string
  en: string
  tone: 'positive' | 'warning' | 'negative' | 'neutral'
}

export interface StatementAnalysis {
  income: Insight[]
  balance: Insight[]
  cashflow: Insight[]
  equity: Insight[]
  position: Insight[]
  ratios: RatioResult[]
  score: number
  grade: string
  gradeAr: string
  gradeEn: string
  summaryAr: string
  summaryEn: string
}

export interface IncomeStatement {
  revenueOperating: EngineLine[]
  revenueOther: EngineLine[]
  revenueContra: EngineLine[]
  cogs: EngineLine[]
  admin: EngineLine[]
  selling: EngineLine[]
  finance: EngineLine[]
  otherExpenses: EngineLine[]
  totalOperatingRevenue: number
  totalRevenueContra: number
  netRevenue: number
  totalCogs: number
  grossProfit: number
  totalAdmin: number
  totalSelling: number
  totalOperatingExpenses: number
  operatingProfit: number
  totalOtherIncome: number
  totalFinance: number
  totalOtherExpenses: number
  ebitda: number
  netIncome: number
  depreciation: number
  amortisation: number
  revenueGrowth?: number
  priorNetIncome?: number
}

export interface BalanceSheet {
  assetsCurrent: EngineLine[]
  assetsNonCurrent: EngineLine[]
  assetsContra: EngineLine[]
  liabilitiesCurrent: EngineLine[]
  liabilitiesNonCurrent: EngineLine[]
  equityCapital: EngineLine[]
  equityReserves: EngineLine[]
  equityRetained: EngineLine[]
  equityContra: EngineLine[]
  totalCurrentAssets: number
  totalNonCurrentAssets: number
  totalContraAssets: number
  totalAssets: number
  totalCurrentLiabilities: number
  totalNonCurrentLiabilities: number
  totalLiabilities: number
  totalCapital: number
  totalReserves: number
  totalRetained: number
  totalDividends: number
  totalEquity: number
  totalLiabilitiesAndEquity: number
  balanced: boolean
  difference: number
  priorAssets?: number
  priorLiabilities?: number
  priorEquity?: number
  workingCapital: number
}

export interface CashFlowStatement {
  netIncome: number
  depreciation: number
  amortisation: number
  workingCapitalChanges: Array<{ labelAr: string; labelEn: string; amount: number }>
  netOperating: number
  investingItems: Array<{ labelAr: string; labelEn: string; amount: number }>
  netInvesting: number
  financingItems: Array<{ labelAr: string; labelEn: string; amount: number }>
  netFinancing: number
  netChange: number
  openingCash: number
  closingCash: number
  actualChange: number
  reconciliation: number
  freeCashFlow: number
  hasPrior: boolean
}

export interface EquityStatement {
  openingCapital: number
  capitalAdditions: number
  openingReserves: number
  reserveMovements: number
  openingRetained: number
  netIncome: number
  dividends: number
  closingEquity: number
  checkDifference: number
}

export interface FinancialStatements {
  meta: DatasetMeta
  lines: EngineLine[]
  priorLines: EngineLine[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
  previousBalanced: boolean
  income: IncomeStatement
  balance: BalanceSheet
  cashflow: CashFlowStatement
  equity: EquityStatement
  analysis: StatementAnalysis
  priorIncome?: IncomeStatement
  priorBalance?: BalanceSheet
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function mergeLines(raw: EngineLine[]): EngineLine[] {
  const map = new Map<string, EngineLine>()
  for (const l of raw) {
    const current = map.get(l.code)
    if (current) {
      current.debit += l.debit
      current.credit += l.credit
      current.balance = r2(current.debit - current.credit)
    } else {
      map.set(l.code, { ...l, balance: r2(l.debit - l.credit) })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
}

export function buildEngineLines(
  tbLines: Array<{
    code: string; nameAr: string; nameEn: string; type: AccountType; section?: string
    debitBase: number; creditBase: number
  }>,
  adjustments: Array<{
    status: string
    lines: Array<{ code: string; nameAr: string; nameEn: string; type: AccountType; section?: string; debit: number; credit: number }>
  }> = [],
): EngineLine[] {
  const rows: EngineLine[] = tbLines.map((l) => ({
    code: l.code,
    nameAr: l.nameAr,
    nameEn: l.nameEn,
    type: l.type,
    section: l.section || inferSection(l.code, l.type, l.nameAr, l.nameEn),
    debit: r2(l.debitBase),
    credit: r2(l.creditBase),
    balance: r2(l.debitBase - l.creditBase),
  }))
  for (const adj of adjustments) {
    if (adj.status !== 'approved') continue
    for (const l of adj.lines) {
      rows.push({
        code: l.code,
        nameAr: l.nameAr,
        nameEn: l.nameEn,
        type: l.type,
        section: l.section || inferSection(l.code, l.type, l.nameAr, l.nameEn),
        debit: r2(l.debit),
        credit: r2(l.credit),
        balance: r2(l.debit - l.credit),
      })
    }
  }
  return mergeLines(rows)
}

function by<T>(lines: T[], predicate: (l: T) => boolean) { return lines.filter(predicate) }
function sumAmount(lines: EngineLine[], kind: 'debit' | 'credit' | 'asset_contra' | 'contra' = 'debit') {
  return r2(lines.reduce((s, l) => {
    if (kind === 'debit') return s + l.balance
    return s - l.balance
  }, 0))
}

function normal(lines: EngineLine[], side: 'debit' | 'credit') {
  return r2(lines.reduce((s, l) => s + (side === 'debit' ? l.balance : -l.balance), 0))
}

function getSections(lines: EngineLine[], section: string) {
  return lines.filter((l) => l.section === section)
}

function computeIncome(lines: EngineLine[]): IncomeStatement {
  const revenueOperating = getSections(lines, 'revenue_operating')
  const revenueOther = getSections(lines, 'revenue_other')
  const revenueContra = getSections(lines, 'revenue_contra')
  const cogs = getSections(lines, 'cogs')
  const admin = getSections(lines, 'expense_admin')
  const selling = getSections(lines, 'expense_selling')
  const finance = getSections(lines, 'expense_finance')
  const otherExpenses = getSections(lines, 'expense_other')

  const totalOperatingRevenue = normal(revenueOperating, 'credit')
  const totalRevenueContra = normal(revenueContra, 'debit')
  const netRevenue = r2(totalOperatingRevenue - totalRevenueContra)
  const totalCogs = normal(cogs, 'debit')
  const grossProfit = r2(netRevenue - totalCogs)
  const totalAdmin = normal(admin, 'debit')
  const totalSelling = normal(selling, 'debit')
  const totalOperatingExpenses = r2(totalAdmin + totalSelling)
  const operatingProfit = r2(grossProfit - totalOperatingExpenses)
  const totalOtherIncome = normal(revenueOther, 'credit')
  const totalFinance = normal(finance, 'debit')
  const totalOtherExpenses = normal(otherExpenses, 'debit')
  const depreciation = normal(admin, 'debit') && by(admin, (l) => /إهلاك|depreciation/i.test(l.nameAr + l.nameEn))
    ? normal(by(admin, (l) => /إهلاك|depreciation/i.test(l.nameAr + l.nameEn)), 'debit') : 0
  const amortisation = normal(by(admin, (l) => /إطفاء|amorti/i.test(l.nameAr + l.nameEn)), 'debit')
  const ebitda = r2(operatingProfit + depreciation + amortisation)
  const netIncome = r2(netRevenue + totalOtherIncome - totalCogs - totalOperatingExpenses - totalFinance - totalOtherExpenses)

  return {
    revenueOperating, revenueOther, revenueContra, cogs, admin, selling, finance, otherExpenses,
    totalOperatingRevenue, totalRevenueContra, netRevenue, totalCogs, grossProfit,
    totalAdmin, totalSelling, totalOperatingExpenses, operatingProfit,
    totalOtherIncome, totalFinance, totalOtherExpenses, ebitda, netIncome,
    depreciation, amortisation,
  }
}

function computeBalance(lines: EngineLine[], netIncome: number): BalanceSheet {
  const assetsCurrent = getSections(lines, 'asset_current')
  const assetsNonCurrent = getSections(lines, 'asset_noncurrent')
  const assetsContra = getSections(lines, 'asset_contra')
  const liabilitiesCurrent = getSections(lines, 'liability_current')
  const liabilitiesNonCurrent = getSections(lines, 'liability_noncurrent')
  const equityCapital = getSections(lines, 'equity_capital')
  const equityReserves = getSections(lines, 'equity_reserves')
  const equityRetained = getSections(lines, 'equity_retained')
  const equityContra = getSections(lines, 'equity_contra')

  const totalCurrentAssets = normal(assetsCurrent, 'debit')
  const totalNonCurrentAssets = normal(assetsNonCurrent, 'debit')
  const totalContraAssets = normal(assetsContra, 'credit')
  const totalAssets = r2(totalCurrentAssets + totalNonCurrentAssets - totalContraAssets)
  const totalCurrentLiabilities = normal(liabilitiesCurrent, 'credit')
  const totalNonCurrentLiabilities = normal(liabilitiesNonCurrent, 'credit')
  const totalLiabilities = r2(totalCurrentLiabilities + totalNonCurrentLiabilities)
  const totalCapital = normal(equityCapital, 'credit')
  const totalReserves = normal(equityReserves, 'credit')
  const totalRetained = normal(equityRetained, 'credit')
  const totalDividends = normal(equityContra, 'debit')
  const totalEquity = r2(totalCapital + totalReserves + totalRetained - totalDividends + netIncome)
  const totalLiabilitiesAndEquity = r2(totalLiabilities + totalEquity)
  const difference = r2(totalAssets - totalLiabilitiesAndEquity)
  const workingCapital = r2(totalCurrentAssets - totalCurrentLiabilities)
  return {
    assetsCurrent, assetsNonCurrent, assetsContra,
    liabilitiesCurrent, liabilitiesNonCurrent,
    equityCapital, equityReserves, equityRetained, equityContra,
    totalCurrentAssets, totalNonCurrentAssets, totalContraAssets, totalAssets,
    totalCurrentLiabilities, totalNonCurrentLiabilities, totalLiabilities,
    totalCapital, totalReserves, totalRetained, totalDividends, totalEquity,
    totalLiabilitiesAndEquity, balanced: Math.abs(difference) < 0.01, difference, workingCapital,
  }
}

function aggregateChange(
  current: EngineLine[],
  prior: EngineLine[],
  type: AccountType,
  filter: (l: EngineLine) => boolean,
) {
  const cur = normal(by(current.filter(filter), (l) => l.type === type), type === 'asset' || type === 'expense' ? 'debit' : 'credit')
  const pre = normal(by(prior.filter(filter), (l) => l.type === type), type === 'asset' || type === 'expense' ? 'debit' : 'credit')
  return r2(cur - pre)
}

function computeCashFlow(
  current: EngineLine[],
  prior: EngineLine[],
  income: IncomeStatement,
  balance: BalanceSheet,
  hasPrior: boolean,
): CashFlowStatement {
  const cashCodes = (l: EngineLine) => /^1110/.test(l.code) || /cash|نقدية/i.test(l.nameAr + l.nameEn)
  const openingCash = hasPrior ? normal(by(prior, cashCodes), 'debit') : normal(by(current, cashCodes), 'debit')
  const closingCash = normal(by(current, cashCodes), 'debit')

  const workingCapitalChanges: Array<{ labelAr: string; labelEn: string; amount: number }> = []
  if (hasPrior) {
    const items: Array<{ ar: string; en: string; type: AccountType; filter: (l: EngineLine) => boolean; sign: number }> = [
      { ar: 'التغير في العملاء', en: 'Change in trade receivables', type: 'asset', filter: (l) => /^1120/.test(l.code), sign: -1 },
      { ar: 'التغير في المخزون', en: 'Change in inventory', type: 'asset', filter: (l) => /^1130/.test(l.code), sign: -1 },
      { ar: 'التغير في المصروفات المدفوعة مقدماً', en: 'Change in prepaid expenses', type: 'asset', filter: (l) => /^1140/.test(l.code), sign: -1 },
      { ar: 'التغير في الدائنين والمستحقات', en: 'Change in payables & accruals', type: 'liability', filter: (l) => /^2110/.test(l.code), sign: 1 },
      { ar: 'التغير في الضرائب المستحقة', en: 'Change in taxes payable', type: 'liability', filter: (l) => /^2140/.test(l.code), sign: 1 },
    ]
    for (const item of items) {
      const change = aggregateChange(current, prior, item.type, item.filter)
      workingCapitalChanges.push({ labelAr: item.ar, labelEn: item.en, amount: r2(change * item.sign) })
    }
  }

  const wcTotal = r2(workingCapitalChanges.reduce((s, i) => s + i.amount, 0))
  const netOperating = r2(income.netIncome + income.depreciation + income.amortisation + wcTotal)

  const investingItems: Array<{ labelAr: string; labelEn: string; amount: number }> = []
  const financingItems: Array<{ labelAr: string; labelEn: string; amount: number }> = []
  if (hasPrior) {
    const capex = aggregateChange(current, prior, 'asset', (l) => /^12|^13/.test(l.code) && l.section !== 'asset_contra')
    investingItems.push({ labelAr: 'صافي شراء أصول ثابتة', labelEn: 'Net capital expenditure', amount: r2(-capex) })
    const loanChange = aggregateChange(current, prior, 'liability', (l) => /^2210|^2120|^2220/.test(l.code))
    if (loanChange) financingItems.push({ labelAr: 'صافي التغير في القروض', labelEn: 'Net change in borrowings', amount: loanChange })
    const capitalChange = aggregateChange(current, prior, 'equity', (l) => /^3110/.test(l.code))
    if (capitalChange) financingItems.push({ labelAr: 'زيادة رأس المال', labelEn: 'Capital contributions', amount: capitalChange })
    if (balance.totalDividends) financingItems.push({ labelAr: 'توزيعات أرباح مدفوعة', labelEn: 'Dividends paid', amount: -balance.totalDividends })
  }
  const netInvesting = r2(investingItems.reduce((s, i) => s + i.amount, 0))
  const netFinancing = r2(financingItems.reduce((s, i) => s + i.amount, 0))
  const netChange = r2(netOperating + netInvesting + netFinancing)
  const actualChange = r2(closingCash - openingCash)
  const reconciliation = r2(actualChange - netChange)
  const freeCashFlow = r2(netOperating + netInvesting)

  return {
    netIncome: income.netIncome, depreciation: income.depreciation, amortisation: income.amortisation,
    workingCapitalChanges, netOperating, investingItems, netInvesting, financingItems, netFinancing,
    netChange, openingCash, closingCash, actualChange, reconciliation, freeCashFlow, hasPrior,
  }
}

function computeEquity(balance: BalanceSheet, priorBalance: BalanceSheet | undefined, income: IncomeStatement): EquityStatement {
  const openingCapital = priorBalance ? priorBalance.totalCapital : balance.totalCapital
  const capitalAdditions = r2(balance.totalCapital - (priorBalance ? priorBalance.totalCapital : balance.totalCapital))
  const openingReserves = priorBalance ? priorBalance.totalReserves : balance.totalReserves
  const reserveMovements = r2(balance.totalReserves - (priorBalance ? priorBalance.totalReserves : balance.totalReserves))
  const openingRetained = priorBalance ? priorBalance.totalRetained : balance.totalRetained
  const netIncome = income.netIncome
  const dividends = balance.totalDividends
  const closingEquity = r2(openingCapital + capitalAdditions + openingReserves + reserveMovements + openingRetained + netIncome - dividends)
  const checkDifference = r2(closingEquity - balance.totalEquity)
  return {
    openingCapital, capitalAdditions, openingReserves, reserveMovements, openingRetained,
    netIncome, dividends: -dividends, closingEquity, checkDifference,
  }
}

function statusFor(value: number, good: number, warn: number, higherIsBetter = true): 'good' | 'warn' | 'bad' {
  if (!Number.isFinite(value)) return 'neutral' as never
  if (higherIsBetter) return value >= good ? 'good' : value >= warn ? 'warn' : 'bad'
  return value <= good ? 'good' : value <= warn ? 'warn' : 'bad'
}

function ratio(key: string, labelAr: string, labelEn: string, value: number, benchmarkAr: string, benchmarkEn: string, status: 'good' | 'warn' | 'bad' | 'neutral', hintAr: string, hintEn: string, suffix = 'x'): RatioResult {
  return { key, labelAr, labelEn, value: r2(value), display: `${Number.isFinite(value) ? value.toFixed(2) : '—'}${suffix}`, benchmarkAr, benchmarkEn, status, hintAr, hintEn }
}

export function computeStatements(dataset: FinancialDataset): FinancialStatements {
  const lines = dataset.lines
  const priorLines = dataset.priorLines
  const totalDebit = r2(lines.reduce((s, l) => s + l.debit, 0))
  const totalCredit = r2(lines.reduce((s, l) => s + l.credit, 0))
  const income = computeIncome(lines)
  const balance = computeBalance(lines, income.netIncome)
  const priorIncome = dataset.hasPrior ? computeIncome(priorLines) : undefined
  const priorBalance = dataset.hasPrior ? computeBalance(priorLines, priorIncome!.netIncome) : undefined
  if (priorBalance) {
    balance.priorAssets = priorBalance.totalAssets
    balance.priorLiabilities = priorBalance.totalLiabilities
    balance.priorEquity = priorBalance.totalEquity
  }
  if (priorIncome) {
    income.priorNetIncome = priorIncome.netIncome
    income.revenueGrowth = priorIncome.totalOperatingRevenue > 0 ? r2(((income.totalOperatingRevenue - priorIncome.totalOperatingRevenue) / priorIncome.totalOperatingRevenue) * 100) : undefined
  }
  const cashflow = computeCashFlow(lines, priorLines, income, balance, dataset.hasPrior)
  const equity = computeEquity(balance, priorBalance, income)
  const analysis = analyse({ income, balance, cashflow, equity, priorIncome, priorBalance, hasPrior: dataset.hasPrior, meta: dataset.meta })
  return {
    meta: dataset.meta, lines, priorLines, totalDebit, totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    previousBalanced: dataset.hasPrior ? Math.abs(priorLines.reduce((s, l) => s + l.debit, 0) - priorLines.reduce((s, l) => s + l.credit, 0)) < 0.01 : true,
    income, balance, cashflow, equity, analysis, priorIncome, priorBalance,
  }
}

function analyse(input: {
  income: IncomeStatement; balance: BalanceSheet; cashflow: CashFlowStatement
  equity: EquityStatement; priorIncome?: IncomeStatement; priorBalance?: BalanceSheet
  hasPrior: boolean; meta: DatasetMeta
}): StatementAnalysis {
  const { income, balance, cashflow, priorIncome, priorBalance, hasPrior } = input
  const revenue = income.netRevenue || 1
  const totalAssets = balance.totalAssets || 1
  const totalEquity = balance.totalEquity || 1
  const currentLiabilities = balance.totalCurrentLiabilities || 1
  const totalLiabilities = balance.totalLiabilities || 1

  const grossMargin = (income.grossProfit / revenue) * 100
  const operatingMargin = (income.operatingProfit / revenue) * 100
  const netMargin = (income.netIncome / revenue) * 100
  const roa = (income.netIncome / totalAssets) * 100
  const roe = (income.netIncome / totalEquity) * 100
  const currentRatio = balance.totalCurrentAssets / currentLiabilities
  const quickRatio = (balance.totalCurrentAssets - Math.abs(sumAmount(balance.assetsCurrent.filter((l) => /^1130/.test(l.code)), 'debit'))) / currentLiabilities
  const cashRatio = sumAmount(balance.assetsCurrent.filter((l) => /^1110/.test(l.code)), 'debit') / currentLiabilities
  const debtRatio = (totalLiabilities / totalAssets) * 100
  const debtToEquity = totalLiabilities / totalEquity
  const equityRatio = (totalEquity / totalAssets) * 100
  const assetTurnover = revenue / totalAssets
  const receivables = sumAmount(balance.assetsCurrent.filter((l) => /^1120/.test(l.code)), 'debit')
  const inventory = sumAmount(balance.assetsCurrent.filter((l) => /^1130/.test(l.code)), 'debit')
  const payables = sumAmount(balance.liabilitiesCurrent.filter((l) => /^2110/.test(l.code)), 'credit')
  const receivableDays = revenue ? (receivables / revenue) * 365 : 0
  const inventoryDays = income.totalCogs ? (inventory / income.totalCogs) * 365 : 0
  const payableDays = income.totalCogs ? (payables / income.totalCogs) * 365 : 0
  const ccc = r2(receivableDays + inventoryDays - payableDays)
  const interestCover = income.totalFinance > 0 ? income.operatingProfit / income.totalFinance : 99
  const ocfToNi = income.netIncome > 0 ? cashflow.netOperating / income.netIncome : 0
  const dividendPayout = income.netIncome > 0 ? balance.totalDividends / income.netIncome * 100 : 0
  const netIncomeGrowth = priorIncome && priorIncome.netIncome !== 0 ? ((income.netIncome - priorIncome.netIncome) / Math.abs(priorIncome.netIncome)) * 100 : 0
  const equityGrowth = priorBalance && priorBalance.totalEquity !== 0 ? ((balance.totalEquity - priorBalance.totalEquity) / Math.abs(priorBalance.totalEquity)) * 100 : 0

  const ratios: RatioResult[] = [
    ratio('currentRatio', 'نسبة التداول', 'Current ratio', currentRatio, '≥ 1.5', '≥ 1.5', statusFor(currentRatio, 1.5, 1), 'قدرة المنشأة على الوفاء بالالتزامات قصيرة الأجل من الأصول المتداولة.', 'Ability to meet short-term obligations from current assets.'),
    ratio('quickRatio', 'نسبة السيولة السريعة', 'Quick ratio', quickRatio, '≥ 1.0', '≥ 1.0', statusFor(quickRatio, 1, 0.7), 'السيولة بعد استبعاد المخزون.', 'Liquidity excluding inventory.'),
    ratio('cashRatio', 'نسبة النقدية', 'Cash ratio', cashRatio, '≥ 0.2', '≥ 0.2', statusFor(cashRatio, 0.2, 0.1), 'الرصيد النقدي المتاح مقابل الالتزامات قصيرة الأجل.', 'Cash available against current liabilities.'),
    ratio('grossMargin', 'هامش الربح الإجمالي', 'Gross profit margin', grossMargin, '≥ 25%', '≥ 25%', statusFor(grossMargin, 25, 15), 'كفاءة التسعير وإدارة تكلفة الإيرادات.', 'Pricing efficiency and cost of revenue management.', '%'),
    ratio('operatingMargin', 'هامش الربح التشغيلي', 'Operating profit margin', operatingMargin, '≥ 10%', '≥ 10%', statusFor(operatingMargin, 10, 5), 'ربحية النشاط التشغيلي قبل البنود غير المتكررة.', 'Profitability of core operations.', '%'),
    ratio('netMargin', 'هامش الربح الصافي', 'Net profit margin', netMargin, '≥ 5%', '≥ 5%', statusFor(netMargin, 5, 2), 'ما يتبقى من كل جنيه مبيعات بعد كل المصروفات.', 'What remains from each unit of sales after all costs.', '%'),
    ratio('roa', 'العائد على الأصول', 'Return on assets (ROA)', roa, '≥ 5%', '≥ 5%', statusFor(roa, 5, 2), 'كفاءة استخدام الأصول في توليد الأرباح.', 'Efficiency of assets in generating profit.', '%'),
    ratio('roe', 'العائد على حقوق الملكية', 'Return on equity (ROE)', roe, '≥ 12%', '≥ 12%', statusFor(roe, 12, 6), 'العائد المتحقق لأصحاب رأس المال.', 'Return generated for shareholders.', '%'),
    ratio('debtRatio', 'نسبة المديونية', 'Debt ratio', debtRatio, '≤ 60%', '≤ 60%', statusFor(debtRatio, 60, 75, false), 'نسبة الأصول الممولة بالخصوم.', 'Share of assets financed by liabilities.', '%'),
    ratio('debtToEquity', 'الخصوم إلى حقوق الملكية', 'Debt to equity', debtToEquity, '≤ 1.5x', '≤ 1.5x', statusFor(debtToEquity, 1.5, 2.5, false), 'الرفع المالي ومخاطر هيكل التمويل.', 'Financial leverage and financing risk.'),
    ratio('equityRatio', 'نسبة حقوق الملكية', 'Equity ratio', equityRatio, '≥ 40%', '≥ 40%', statusFor(equityRatio, 40, 25), 'متانة المركز المالي وقدرة الامتصاص.', 'Financial strength and loss absorption.', '%'),
    ratio('assetTurnover', 'معدل دوران الأصول', 'Asset turnover', assetTurnover, '≥ 0.8x', '≥ 0.8x', statusFor(assetTurnover, 0.8, 0.5), 'كفاءة توظيف الأصول لتوليد الإيرادات.', 'Efficiency of asset utilisation in generating revenue.'),
    ratio('receivableDays', 'متوسط فترة التحصيل', 'Days sales outstanding', receivableDays, '≤ 60 يوم', '≤ 60 days', statusFor(receivableDays, 60, 90, false), 'سرعة تحصيل مستحقات العملاء.', 'Speed of collecting customer receivables.', 'd'),
    ratio('inventoryDays', 'متوسط فترة المخزون', 'Days inventory outstanding', inventoryDays, '≤ 90 يوم', '≤ 90 days', statusFor(inventoryDays, 90, 120, false), 'كفاءة إدارة المخزون وتكلفة التخزين.', 'Inventory management efficiency.', 'd'),
    ratio('payableDays', 'متوسط فترة السداد', 'Days payables outstanding', payableDays, '30–90 يوم', '30–90 days', payableDays >= 30 && payableDays <= 90 ? 'good' : payableDays < 30 ? 'warn' : 'bad', 'استفادة المنشأة من فترة الائتمان الممنوحة.', 'Use of supplier credit terms.', 'd'),
    ratio('ccc', 'دورة التحويل النقدي', 'Cash conversion cycle', ccc, '≤ 60 يوم', '≤ 60 days', statusFor(ccc, 60, 90, false), 'الزمن بين دفع التكاليف وتحصيل النقدية.', 'Time between paying costs and collecting cash.', 'd'),
    ratio('interestCover', 'تغطية الفوائد', 'Interest coverage', interestCover, '≥ 3x', '≥ 3x', statusFor(interestCover, 3, 1.5), 'قدرة الأرباح التشغيلية على تغطية الأعباء التمويلية.', 'Ability of operating profit to cover finance costs.'),
    ratio('ocfToNi', 'جودة الأرباح النقدية', 'Cash flow to net income', ocfToNi, '≥ 1.0x', '≥ 1.0x', statusFor(ocfToNi, 1, 0.7), 'مطابقة الأرباح المحاسبية للتدفق النقدي التشغيلي.', 'Alignment of accounting profit with operating cash flow.'),
    ratio('dividendPayout', 'نسبة توزيع الأرباح', 'Dividend payout', dividendPayout, '≤ 70%', '≤ 70%', statusFor(dividendPayout, 70, 90, false), 'نسبة الأرباح الموزعة من صافي الربح.', 'Share of profit distributed to owners.', '%'),
  ]

  const scoreParts = [
    Math.min(100, currentRatio / 2 * 100),
    Math.min(100, Math.max(0, netMargin / 10 * 100)),
    Math.min(100, Math.max(0, (100 - debtRatio) / 60 * 100)),
    Math.min(100, Math.max(0, ocfToNi / 1 * 100)),
    Math.min(100, Math.max(0, roe / 15 * 100)),
  ]
  const score = Math.round(scoreParts.reduce((s, x) => s + x, 0) / scoreParts.length)
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D'
  const gradeAr = score >= 85 ? 'ممتاز' : score >= 70 ? 'جيد' : score >= 55 ? 'مقبول' : 'يحتاج معالجة'
  const gradeEn = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Needs attention'

  const incomeInsights: Insight[] = [
    {
      ar: `حققت المنشأة إيرادات تشغيلية بقيمة ${income.totalOperatingRevenue.toLocaleString('en-US')} ${input.meta.currency} وصافي ربح ${income.netIncome.toLocaleString('en-US')} ${input.meta.currency}، بهامش صافي ${netMargin.toFixed(1)}%.`,
      en: `Operating revenue reached ${income.totalOperatingRevenue.toLocaleString('en-US')} ${input.meta.currency} with net profit of ${income.netIncome.toLocaleString('en-US')} ${input.meta.currency}, a net margin of ${netMargin.toFixed(1)}%.`,
      tone: netMargin >= 5 ? 'positive' : netMargin >= 0 ? 'warning' : 'negative',
    },
    {
      ar: `هامش الربح الإجمالي ${grossMargin.toFixed(1)}%؛ ${grossMargin >= 25 ? 'مستوى صحي يعكس كفاءة التسعير وإدارة التكلفة.' : 'يحتاج مراجعة سياسة التسعير وتكلفة الإيرادات.'}`,
      en: `Gross margin is ${grossMargin.toFixed(1)}%; ${grossMargin >= 25 ? 'a healthy level reflecting pricing and cost efficiency.' : 'pricing policy and cost of revenue need review.'}`,
      tone: grossMargin >= 25 ? 'positive' : grossMargin >= 15 ? 'warning' : 'negative',
    },
    {
      ar: `المصروفات التشغيلية تمثل ${((income.totalOperatingExpenses / revenue) * 100).toFixed(1)}% من صافي الإيرادات، وأكبرها ${topExpenseLabel(income, 'ar')}.`,
      en: `Operating expenses represent ${((income.totalOperatingExpenses / revenue) * 100).toFixed(1)}% of net revenue, with the largest item being ${topExpenseLabel(income, 'en')}.`,
      tone: income.totalOperatingExpenses / revenue < 0.35 ? 'positive' : 'warning',
    },
  ]
  if (hasPrior && income.revenueGrowth !== undefined) {
    incomeInsights.push({
      ar: `نمو الإيرادات ${income.revenueGrowth >= 0 ? 'إيجابي' : 'سلبي'} بنسبة ${income.revenueGrowth.toFixed(1)}% مقارنة بالسنة السابقة، وصافي الربح ${netIncomeGrowth >= 0 ? 'نما' : 'تراجع'} بنسبة ${Math.abs(netIncomeGrowth).toFixed(1)}%.`,
      en: `Revenue ${income.revenueGrowth >= 0 ? 'grew' : 'declined'} ${Math.abs(income.revenueGrowth).toFixed(1)}% year-on-year, while net profit ${netIncomeGrowth >= 0 ? 'grew' : 'declined'} ${Math.abs(netIncomeGrowth).toFixed(1)}%.`,
      tone: income.revenueGrowth >= 0 && netIncomeGrowth >= 0 ? 'positive' : 'warning',
    })
  }
  if (income.ebitda > 0) {
    incomeInsights.push({
      ar: `الأرباح قبل الفوائد والضرائب والإهلاك (EBITDA) بلغت ${income.ebitda.toLocaleString('en-US')} ${input.meta.currency}، وهو مؤشر على قدرة النشاط على توليد نقدية تشغيلية.`,
      en: `EBITDA reached ${income.ebitda.toLocaleString('en-US')} ${input.meta.currency}, indicating the core business's ability to generate operating cash.`,
      tone: 'positive',
    })
  }

  const balanceInsights: Insight[] = [
    {
      ar: `رأس المال العامل ${balance.workingCapital.toLocaleString('en-US')} ${input.meta.currency} ونسبة التداول ${currentRatio.toFixed(2)}x؛ ${balance.workingCapital >= 0 ? 'السيولة قصيرة الأجل إيجابية.' : 'يوجد عجز في رأس المال العامل يستلزم خطة تمويل.'}`,
      en: `Working capital is ${balance.workingCapital.toLocaleString('en-US')} ${input.meta.currency} with a current ratio of ${currentRatio.toFixed(2)}x; ${balance.workingCapital >= 0 ? 'short-term liquidity is positive.' : 'a working capital deficit requires a funding plan.'}`,
      tone: balance.workingCapital >= 0 ? 'positive' : 'negative',
    },
    {
      ar: `هيكل التمويل: الخصوم ${debtRatio.toFixed(1)}% من الأصول وحقوق الملكية ${equityRatio.toFixed(1)}%؛ ${debtRatio <= 60 ? 'هيكل متوازن.' : 'الرفع المالي مرتفع ويستلزم مراقبة.'}`,
      en: `Financing structure: liabilities are ${debtRatio.toFixed(1)}% of assets and equity ${equityRatio.toFixed(1)}%; ${debtRatio <= 60 ? 'the structure is balanced.' : 'leverage is high and requires monitoring.'}`,
      tone: debtRatio <= 60 ? 'positive' : debtRatio <= 75 ? 'warning' : 'negative',
    },
    {
      ar: `الأصول المتداولة تمثل ${((balance.totalCurrentAssets / totalAssets) * 100).toFixed(1)}% من إجمالي الأصول، والأصول غير المتداولة ${((balance.totalNonCurrentAssets / totalAssets) * 100).toFixed(1)}%.`,
      en: `Current assets are ${((balance.totalCurrentAssets / totalAssets) * 100).toFixed(1)}% of total assets, while non-current assets are ${((balance.totalNonCurrentAssets / totalAssets) * 100).toFixed(1)}%.`,
      tone: 'neutral',
    },
    {
      ar: balance.balanced ? 'الميزانية متوازنة: إجمالي الأصول يساوي إجمالي الخصوم وحقوق الملكية.' : `فارق التوازن ${balance.difference.toLocaleString('en-US')} ${input.meta.currency}؛ يجب مراجعة القيود والتسويات قبل الاعتماد النهائي.`,
      en: balance.balanced ? 'The balance sheet balances: total assets equal liabilities plus equity.' : `An imbalance of ${balance.difference.toLocaleString('en-US')} ${input.meta.currency} exists; review adjustments before final approval.`,
      tone: balance.balanced ? 'positive' : 'negative',
    },
  ]

  const cashInsights: Insight[] = hasPrior ? [
    {
      ar: `التدفق النقدي التشغيلي ${cashflow.netOperating.toLocaleString('en-US')} ${input.meta.currency} ويعادل ${ocfToNi.toFixed(2)}x من صافي الربح؛ ${ocfToNi >= 1 ? 'جودة أرباح مرتفعة.' : 'يوجد فرق بين الربح المحاسبي والنقدية المحققة.'}`,
      en: `Operating cash flow is ${cashflow.netOperating.toLocaleString('en-US')} ${input.meta.currency}, equal to ${ocfToNi.toFixed(2)}x net profit; ${ocfToNi >= 1 ? 'earnings quality is strong.' : 'there is a gap between accounting profit and realised cash.'}`,
      tone: ocfToNi >= 1 ? 'positive' : ocfToNi >= 0.7 ? 'warning' : 'negative',
    },
    {
      ar: `التدفق النقدي الحر ${cashflow.freeCashFlow.toLocaleString('en-US')} ${input.meta.currency}؛ ${cashflow.freeCashFlow >= 0 ? 'النشاط قادر على تمويل نموه وسداد التزاماته.' : 'الإنفاق الاستثماري يتجاوز التدفق التشغيلي ويحتاج تمويلاً.'}`,
      en: `Free cash flow is ${cashflow.freeCashFlow.toLocaleString('en-US')} ${input.meta.currency}; ${cashflow.freeCashFlow >= 0 ? 'the business can fund growth and debt service.' : 'investing outflows exceed operating cash and need funding.'}`,
      tone: cashflow.freeCashFlow >= 0 ? 'positive' : 'warning',
    },
    {
      ar: `رصيد النقدية انتقل من ${cashflow.openingCash.toLocaleString('en-US')} إلى ${cashflow.closingCash.toLocaleString('en-US')} ${input.meta.currency}، بصافي تغير ${cashflow.actualChange.toLocaleString('en-US')}.`,
      en: `Cash moved from ${cashflow.openingCash.toLocaleString('en-US')} to ${cashflow.closingCash.toLocaleString('en-US')} ${input.meta.currency}, a net change of ${cashflow.actualChange.toLocaleString('en-US')}.`,
      tone: cashflow.actualChange >= 0 ? 'positive' : 'warning',
    },
  ] : [
    {
      ar: 'يتطلب إعداد قائمة التدفقات النقدية بطريقة غير مباشرة وجود ميزان مراجعة معتمد لسنة سابقة للمقارنة. تم عرض الرصيد النقدي الحالي فقط.',
      en: 'Preparing an indirect cash flow statement requires an approved prior-year trial balance for comparison. Only the current cash balance is presented.',
      tone: 'warning',
    },
  ]

  const equityInsights: Insight[] = [
    {
      ar: `حقوق الملكية ${balance.totalEquity.toLocaleString('en-US')} ${input.meta.currency}، والعائد على حقوق الملكية ${roe.toFixed(1)}%.`,
      en: `Equity is ${balance.totalEquity.toLocaleString('en-US')} ${input.meta.currency}, with a return on equity of ${roe.toFixed(1)}%.`,
      tone: roe >= 12 ? 'positive' : roe >= 6 ? 'warning' : 'negative',
    },
    {
      ar: `نسبة توزيعات الأرباح ${dividendPayout.toFixed(1)}% من صافي الربح؛ ${dividendPayout <= 70 ? 'سياسة توزيع متحفظة تدعم إعادة الاستثمار.' : 'التوزيعات مرتفعة وتقلل القدرة على التمويل الداخلي.'}`,
      en: `Dividend payout is ${dividendPayout.toFixed(1)}% of net profit; ${dividendPayout <= 70 ? 'a conservative policy supporting reinvestment.' : 'high distributions reduce internal funding capacity.'}`,
      tone: dividendPayout <= 70 ? 'positive' : 'warning',
    },
    ...(hasPrior ? [{
      ar: `نمو حقوق الملكية ${equityGrowth.toFixed(1)}% مقارنة بالسنة السابقة، مدفوعاً بصافي الربح واحتجاز الأرباح.`,
      en: `Equity grew ${equityGrowth.toFixed(1)}% year-on-year, driven by net profit and retained earnings.`,
      tone: equityGrowth >= 0 ? 'positive' as const : 'warning' as const,
    }] : []),
  ]

  const positionInsights: Insight[] = [
    {
      ar: `قائمة المركز المالي تعكس أصولاً بقيمة ${balance.totalAssets.toLocaleString('en-US')} ${input.meta.currency} ممولة بنسبة ${100 - equityRatio > 0 ? (100 - equityRatio).toFixed(1) : '0.0'}% من الخصوم و${equityRatio.toFixed(1)}% من حقوق الملكية.`,
      en: `The statement of financial position shows assets of ${balance.totalAssets.toLocaleString('en-US')} ${input.meta.currency}, funded ${(100 - equityRatio).toFixed(1)}% by liabilities and ${equityRatio.toFixed(1)}% by equity.`,
      tone: 'neutral',
    },
    {
      ar: `دورة التحويل النقدي ${ccc.toFixed(0)} يوم (تحصيل ${receivableDays.toFixed(0)} + مخزون ${inventoryDays.toFixed(0)} - سداد ${payableDays.toFixed(0)}).`,
      en: `Cash conversion cycle is ${ccc.toFixed(0)} days (collection ${receivableDays.toFixed(0)} + inventory ${inventoryDays.toFixed(0)} - payment ${payableDays.toFixed(0)}).`,
      tone: ccc <= 60 ? 'positive' : ccc <= 90 ? 'warning' : 'negative',
    },
    {
      ar: `نسبة الأصول غير المتداولة ${((balance.totalNonCurrentAssets / totalAssets) * 100).toFixed(1)}%؛ ${(balance.totalNonCurrentAssets / totalAssets) > 0.6 ? 'منشأة كثيفة الأصول تحتاج متابعة العائد على الاستثمار.' : 'هيكل أصول مرن نسبياً.'}`,
      en: `Non-current assets represent ${((balance.totalNonCurrentAssets / totalAssets) * 100).toFixed(1)}% of total assets; ${(balance.totalNonCurrentAssets / totalAssets) > 0.6 ? 'an asset-intensive business requiring investment return monitoring.' : 'a relatively flexible asset structure.'}`,
      tone: 'neutral',
    },
  ]

  const summaryAr = score >= 70
    ? `المركز المالي ${gradeAr}؛ الربحية والسيولة في نطاق مقبول مع ضرورة متابعة ${debtRatio > 60 ? 'الرفع المالي' : 'كفاءة التحصيل والمخزون'}.`
    : `المركز المالي ${gradeAr}؛ توجد مؤشرات تحتاج خطة تحسين عاجلة في ${netMargin < 5 ? 'الربحية' : 'السيولة'} و${debtRatio > 70 ? 'هيكل التمويل' : 'إدارة رأس المال العامل'}.`
  const summaryEn = score >= 70
    ? `Financial position is ${gradeEn}; profitability and liquidity are acceptable, with attention needed on ${debtRatio > 60 ? 'leverage' : 'collection and inventory efficiency'}.`
    : `Financial position is ${gradeEn}; indicators require an urgent improvement plan for ${netMargin < 5 ? 'profitability' : 'liquidity'} and ${debtRatio > 70 ? 'financing structure' : 'working capital management'}.`

  return {
    income: incomeInsights, balance: balanceInsights, cashflow: cashInsights,
    equity: equityInsights, position: positionInsights, ratios, score, grade, gradeAr, gradeEn,
    summaryAr, summaryEn,
  }
}

function topExpenseLabel(income: IncomeStatement, lang: 'ar' | 'en') {
  const groups = [
    { list: income.cogs, labelAr: 'تكلفة الإيرادات', labelEn: 'cost of revenue' },
    { list: income.admin, labelAr: 'المصروفات الإدارية', labelEn: 'administrative expenses' },
    { list: income.selling, labelAr: 'مصروفات البيع', labelEn: 'selling expenses' },
  ]
  const top = groups.map((g) => ({ ...g, value: normal(g.list, 'debit') })).sort((a, b) => b.value - a.value)[0]
  if (!top) return lang === 'ar' ? 'لا يوجد' : 'none'
  const line = top.list.slice().sort((a, b) => b.balance - a.balance)[0]
  return `${lang === 'ar' ? top.labelAr : top.labelEn}${line ? ` (${lang === 'ar' ? line.nameAr : line.nameEn})` : ''}`
}

// ================= Report models =================

function row(labelAr: string, labelEn: string, amount: number, prior?: number, extra: Partial<ReportRow> = {}): ReportRow {
  return { labelAr, labelEn, amount: r2(amount), prior: prior === undefined ? undefined : r2(prior), ...extra }
}

function linesToRows(lines: EngineLine[], side: 'debit' | 'credit', priorLines: EngineLine[] = []): ReportRow[] {
  return lines.map((l) => row(l.nameAr, l.nameEn, side === 'debit' ? l.balance : -l.balance,
    priorLines.find((p) => p.code === l.code) ? (side === 'debit' ? priorLines.find((p) => p.code === l.code)!.balance : -priorLines.find((p) => p.code === l.code)!.balance) : undefined,
    { indent: 1 }))
}

export function getReportModel(type: string, fs: FinancialStatements): ReportModel {
  const { meta, income, balance, cashflow, equity, lines, totalDebit, totalCredit } = fs
  const pi = fs.priorIncome
  const pb = fs.priorBalance
  const notesAr = [
    `أُعدت هذه القائمة من ميزان مراجعة معتمد للفترة ${meta.periodStart} إلى ${meta.periodEnd}، بعد تطبيق قيود التسوية المعتمدة.`,
    'جميع المبالغ معروضة بعملة الأساس للشركة وبعد تحويل العملات الأجنبية بسعر الإقفال المعتمد.',
    'القوائم المعدة آلياً تخضع لمراجعة المراقب المالي المعتمد قبل استخدامها لأغراض رسمية.',
  ]
  const notesEn = [
    `Prepared from an approved trial balance for the period ${meta.periodStart} to ${meta.periodEnd}, after approved adjusting entries.`,
    'All amounts are presented in the company base currency after translation of foreign balances at the approved closing rate.',
    'Automatically generated statements are subject to review by the certified financial controller before official use.',
  ]

  if (type === 'income') {
    const revRows = linesToRows(income.revenueOperating, 'credit', pi?.revenueOperating)
    if (revRows.length === 0) revRows.push(row('لا توجد إيرادات تشغيلية', 'No operating revenue', 0))
    const contraRows = linesToRows(income.revenueContra, 'debit', pi?.revenueContra)
    const cogsRows = linesToRows(income.cogs, 'debit', pi?.cogs)
    const adminRows = linesToRows(income.admin, 'debit', pi?.admin)
    const sellingRows = linesToRows(income.selling, 'debit', pi?.selling)
    const financeRows = linesToRows(income.finance, 'debit', pi?.finance)
    const otherIncRows = linesToRows(income.revenueOther, 'credit', pi?.revenueOther)
    const otherExpRows = linesToRows(income.otherExpenses, 'debit', pi?.otherExpenses)
    return {
      key: 'income', titleAr: 'قائمة الدخل', titleEn: 'Statement of Profit or Loss',
      subtitleAr: 'عن الفترة المالية المنتهية', subtitleEn: 'For the financial period ended',
      columns: 'amount-prior',
      sections: [
        { titleAr: 'الإيرادات التشغيلية', titleEn: 'Operating revenue', rows: revRows },
        ...(contraRows.length ? [{ titleAr: 'مردودات ومسموحات المبيعات', titleEn: 'Sales returns & allowances', rows: contraRows }] : []),
        { titleAr: 'صافي الإيرادات', titleEn: 'Net revenue', rows: [row('صافي الإيرادات', 'Net revenue', income.netRevenue, pi?.netRevenue, { isTotal: true })] },
        { titleAr: 'تكلفة الإيرادات', titleEn: 'Cost of revenue', rows: [...cogsRows, row('إجمالي تكلفة الإيرادات', 'Total cost of revenue', income.totalCogs, pi?.totalCogs, { isSubtotal: true })] },
        { titleAr: 'الربح الإجمالي', titleEn: 'Gross profit', rows: [row('الربح الإجمالي', 'Gross profit', income.grossProfit, pi?.grossProfit, { isTotal: true })] },
        { titleAr: 'المصروفات الإدارية والعمومية', titleEn: 'Administrative & general expenses', rows: [...adminRows, row('إجمالي المصروفات الإدارية', 'Total administrative expenses', income.totalAdmin, pi?.totalAdmin, { isSubtotal: true })] },
        { titleAr: 'مصروفات البيع والتوزيع', titleEn: 'Selling & distribution expenses', rows: [...sellingRows, row('إجمالي مصروفات البيع', 'Total selling expenses', income.totalSelling, pi?.totalSelling, { isSubtotal: true })] },
        { titleAr: 'الربح التشغيلي', titleEn: 'Operating profit', rows: [row('الربح التشغيلي', 'Operating profit', income.operatingProfit, pi?.operatingProfit, { isTotal: true })] },
        ...(otherIncRows.length ? [{ titleAr: 'إيرادات أخرى', titleEn: 'Other income', rows: [...otherIncRows, row('إجمالي الإيرادات الأخرى', 'Total other income', income.totalOtherIncome, pi?.totalOtherIncome, { isSubtotal: true })] }] : []),
        ...(financeRows.length ? [{ titleAr: 'المصروفات التمويلية', titleEn: 'Finance costs', rows: [...financeRows, row('إجمالي الأعباء التمويلية', 'Total finance costs', income.totalFinance, pi?.totalFinance, { isSubtotal: true })] }] : []),
        ...(otherExpRows.length ? [{ titleAr: 'مصروفات أخرى', titleEn: 'Other expenses', rows: [...otherExpRows, row('إجمالي المصروفات الأخرى', 'Total other expenses', income.totalOtherExpenses, pi?.totalOtherExpenses, { isSubtotal: true })] }] : []),
        { titleAr: 'صافي الربح (الخسارة) للفترة', titleEn: 'Net profit (loss) for the period', rows: [row('صافي الربح (الخسارة)', 'Net profit (loss)', income.netIncome, pi?.netIncome, { isTotal: true })] },
      ],
      notesAr, notesEn,
    }
  }

  if (type === 'balance') {
    const acRows = linesToRows(balance.assetsCurrent, 'debit', pb?.assetsCurrent)
    const ancRows = linesToRows(balance.assetsNonCurrent, 'debit', pb?.assetsNonCurrent)
    const contraRows = linesToRows(balance.assetsContra, 'credit', pb?.assetsContra)
    const clRows = linesToRows(balance.liabilitiesCurrent, 'credit', pb?.liabilitiesCurrent)
    const lncRows = linesToRows(balance.liabilitiesNonCurrent, 'credit', pb?.liabilitiesNonCurrent)
    const capRows = linesToRows(balance.equityCapital, 'credit', pb?.equityCapital)
    const resRows = linesToRows(balance.equityReserves, 'credit', pb?.equityReserves)
    const retRows = linesToRows(balance.equityRetained, 'credit', pb?.equityRetained)
    const divRows = linesToRows(balance.equityContra, 'debit', pb?.equityContra)
    return {
      key: 'balance', titleAr: 'الميزانية العمومية', titleEn: 'Statement of Financial Position',
      subtitleAr: 'كما في نهاية الفترة', subtitleEn: 'As at the end of the period',
      columns: 'amount-prior',
      sections: [
        {
          titleAr: 'الأصول', titleEn: 'Assets', rows: [
            row('الأصول المتداولة', 'Current assets', balance.totalCurrentAssets, pb?.totalCurrentAssets, { isHeader: true }),
            ...acRows,
            row('إجمالي الأصول المتداولة', 'Total current assets', balance.totalCurrentAssets, pb?.totalCurrentAssets, { isSubtotal: true }),
            row('الأصول غير المتداولة', 'Non-current assets', balance.totalNonCurrentAssets, pb?.totalNonCurrentAssets, { isHeader: true }),
            ...ancRows,
            ...(contraRows.length ? [{ labelAr: 'يُخصم: مجمع الإهلاك والمخصصات', labelEn: 'Less: accumulated depreciation & provisions', isHeader: true } as ReportRow, ...contraRows.map((r) => ({ ...r, isNegative: true }))] : []),
            row('إجمالي الأصول غير المتداولة', 'Total non-current assets', balance.totalNonCurrentAssets - balance.totalContraAssets, (pb ? pb.totalNonCurrentAssets - pb.totalContraAssets : undefined), { isSubtotal: true }),
            row('إجمالي الأصول', 'Total assets', balance.totalAssets, pb?.totalAssets, { isTotal: true }),
          ],
        },
        {
          titleAr: 'الخصوم', titleEn: 'Liabilities', rows: [
            row('الخصوم المتداولة', 'Current liabilities', balance.totalCurrentLiabilities, pb?.totalCurrentLiabilities, { isHeader: true }),
            ...clRows,
            row('إجمالي الخصوم المتداولة', 'Total current liabilities', balance.totalCurrentLiabilities, pb?.totalCurrentLiabilities, { isSubtotal: true }),
            row('الخصوم غير المتداولة', 'Non-current liabilities', balance.totalNonCurrentLiabilities, pb?.totalNonCurrentLiabilities, { isHeader: true }),
            ...lncRows,
            row('إجمالي الخصوم', 'Total liabilities', balance.totalLiabilities, pb?.totalLiabilities, { isTotal: true }),
          ],
        },
        {
          titleAr: 'حقوق الملكية', titleEn: 'Equity', rows: [
            ...capRows, ...resRows, ...retRows,
            ...(divRows.length ? divRows.map((r) => ({ ...r, isNegative: true })) : []),
            row('نتيجة الفترة (صافي الربح)', 'Result for the period (net profit)', income.netIncome, pi?.netIncome),
            row('إجمالي حقوق الملكية', 'Total equity', balance.totalEquity, pb?.totalEquity, { isTotal: true }),
            row('إجمالي الخصوم وحقوق الملكية', 'Total liabilities and equity', balance.totalLiabilitiesAndEquity, pb?.totalLiabilitiesAndEquity, { isTotal: true }),
            ...(!balance.balanced ? [row('فرق التوازن (يجب تسويته)', 'Balance difference (to be rectified)', balance.difference, undefined, { isTotal: true })] : []),
          ],
        },
      ],
      notesAr, notesEn,
    }
  }

  if (type === 'equity') {
    return {
      key: 'equity', titleAr: 'قائمة التغير في حقوق الملكية', titleEn: 'Statement of Changes in Equity',
      subtitleAr: 'عن الفترة المالية المنتهية', subtitleEn: 'For the financial period ended',
      columns: 'amount', notesAr, notesEn,
      sections: [
        {
          titleAr: 'حركة حقوق الملكية', titleEn: 'Movement in equity', rows: [
            row('الرصيد الافتتاحي - رأس المال', 'Opening balance - capital', equity.openingCapital),
            row('إضافات رأس المال', 'Capital additions', equity.capitalAdditions),
            row('الرصيد الافتتاحي - الاحتياطيات', 'Opening balance - reserves', equity.openingReserves),
            row('حركة الاحتياطيات', 'Movement in reserves', equity.reserveMovements),
            row('الرصيد الافتتاحي - الأرباح المحتجزة', 'Opening balance - retained earnings', equity.openingRetained),
            row('صافي ربح (خسارة) الفترة', 'Net profit (loss) for the period', equity.netIncome),
            row('توزيعات أرباح مدفوعة', 'Dividends paid', equity.dividends),
            row('إجمالي حقوق الملكية في نهاية الفترة', 'Total equity at end of period', equity.closingEquity, undefined, { isTotal: true }),
            ...(Math.abs(equity.checkDifference) > 0.01 ? [row('فرق تسوية مع الميزانية', 'Reconciliation difference with balance sheet', equity.checkDifference)] : []),
          ],
        },
        {
          titleAr: 'مؤشرات حقوق الملكية', titleEn: 'Equity indicators', rows: [
            row('العائد على حقوق الملكية', 'Return on equity', (income.netIncome / (balance.totalEquity || 1)) * 100),
            row('نسبة الأرباح المحتجزة', 'Retained earnings ratio', (balance.totalRetained / (balance.totalEquity || 1)) * 100),
            row('نسبة توزيعات الأرباح', 'Dividend payout ratio', income.netIncome > 0 ? (balance.totalDividends / income.netIncome) * 100 : 0),
          ],
        },
      ],
    }
  }

  if (type === 'cashflow') {
    const opRows: ReportRow[] = [
      row('صافي الربح', 'Net profit', cashflow.netIncome),
      row('يُضاف: الإهلاك', 'Add: depreciation', cashflow.depreciation),
      row('يُضاف: الإطفاء', 'Add: amortisation', cashflow.amortisation),
      ...cashflow.workingCapitalChanges.map((i) => row(i.labelAr, i.labelEn, i.amount, undefined, { indent: 1 })),
      row('صافي التدفق النقدي من الأنشطة التشغيلية', 'Net cash flow from operating activities', cashflow.netOperating, undefined, { isSubtotal: true }),
    ]
    return {
      key: 'cashflow', titleAr: 'قائمة التدفقات النقدية', titleEn: 'Statement of Cash Flows',
      subtitleAr: 'بالطريقة غير المباشرة عن الفترة المالية المنتهية', subtitleEn: 'Indirect method for the financial period ended',
      columns: 'amount', notesAr, notesEn,
      sections: [
        { titleAr: 'الأنشطة التشغيلية', titleEn: 'Operating activities', rows: opRows },
        { titleAr: 'الأنشطة الاستثمارية', titleEn: 'Investing activities', rows: [
          ...cashflow.investingItems.map((i) => row(i.labelAr, i.labelEn, i.amount)),
          ...(cashflow.investingItems.length ? [] : [row('لا توجد حركات استثمارية قابلة للقياس', 'No measurable investing movements', 0)]),
          row('صافي التدفق النقدي من الأنشطة الاستثمارية', 'Net cash flow from investing activities', cashflow.netInvesting, undefined, { isSubtotal: true }),
        ] },
        { titleAr: 'الأنشطة التمويلية', titleEn: 'Financing activities', rows: [
          ...cashflow.financingItems.map((i) => row(i.labelAr, i.labelEn, i.amount)),
          ...(cashflow.financingItems.length ? [] : [row('لا توجد حركات تمويلية قابلة للقياس', 'No measurable financing movements', 0)]),
          row('صافي التدفق النقدي من الأنشطة التمويلية', 'Net cash flow from financing activities', cashflow.netFinancing, undefined, { isSubtotal: true }),
        ] },
        { titleAr: 'صافي التغير في النقدية', titleEn: 'Net change in cash', rows: [
          row('صافي التغير في النقدية', 'Net change in cash', cashflow.netChange, undefined, { isTotal: true }),
          row('النقدية أول الفترة', 'Cash at beginning of period', cashflow.openingCash),
          row('النقدية آخر الفترة', 'Cash at end of period', cashflow.closingCash),
          row('التغير الفعلي في النقدية', 'Actual change in cash', cashflow.actualChange),
          ...(Math.abs(cashflow.reconciliation) > 0.01 ? [row('بنود تسوية / غير مصنفة', 'Reconciling / unclassified items', cashflow.reconciliation)] : []),
        ] },
      ],
    }
  }

  if (type === 'position') {
    const pct = (v: number) => (balance.totalAssets ? (v / balance.totalAssets) * 100 : 0)
    return {
      key: 'position', titleAr: 'قائمة المركز المالي', titleEn: 'Statement of Financial Position (Detailed)',
      subtitleAr: 'تحليل هيكل الأصول والخصوم وحقوق الملكية', subtitleEn: 'Analysis of assets, liabilities and equity structure',
      columns: 'amount-prior', notesAr, notesEn,
      sections: [
        { titleAr: 'هيكل الأصول', titleEn: 'Asset structure', rows: [
          row('النقدية وما يعادلها', 'Cash & cash equivalents', sumAmount(balance.assetsCurrent.filter((l) => /^1110/.test(l.code)), 'debit')),
          row('المدينون التجاريون', 'Trade receivables', sumAmount(balance.assetsCurrent.filter((l) => /^1120/.test(l.code)), 'debit')),
          row('المخزون', 'Inventory', sumAmount(balance.assetsCurrent.filter((l) => /^1130/.test(l.code)), 'debit')),
          row('أصول متداولة أخرى', 'Other current assets', balance.totalCurrentAssets - sumAmount(balance.assetsCurrent.filter((l) => /^11[1234]/.test(l.code)), 'debit')),
          row('إجمالي الأصول المتداولة', 'Total current assets', balance.totalCurrentAssets, pb?.totalCurrentAssets, { isSubtotal: true }),
          row('الأصول غير المتداولة (صافي)', 'Non-current assets (net)', balance.totalNonCurrentAssets - balance.totalContraAssets, pb ? pb.totalNonCurrentAssets - pb.totalContraAssets : undefined, { isSubtotal: true }),
          row('إجمالي الأصول', 'Total assets', balance.totalAssets, pb?.totalAssets, { isTotal: true }),
          row('نسبة الأصول المتداولة', 'Current assets ratio (%)', pct(balance.totalCurrentAssets)),
        ] },
        { titleAr: 'هيكل التمويل', titleEn: 'Funding structure', rows: [
          row('الخصوم المتداولة', 'Current liabilities', balance.totalCurrentLiabilities, pb?.totalCurrentLiabilities),
          row('الخصوم غير المتداولة', 'Non-current liabilities', balance.totalNonCurrentLiabilities, pb?.totalNonCurrentLiabilities),
          row('إجمالي الخصوم', 'Total liabilities', balance.totalLiabilities, pb?.totalLiabilities, { isSubtotal: true }),
          row('رأس المال', 'Capital', balance.totalCapital, pb?.totalCapital),
          row('الاحتياطيات', 'Reserves', balance.totalReserves, pb?.totalReserves),
          row('الأرباح المحتجزة', 'Retained earnings', balance.totalRetained, pb?.totalRetained),
          row('نتيجة الفترة', 'Result for the period', income.netIncome, pi?.netIncome),
          row('إجمالي حقوق الملكية', 'Total equity', balance.totalEquity, pb?.totalEquity, { isSubtotal: true }),
          row('نسبة حقوق الملكية', 'Equity ratio (%)', pct(balance.totalEquity)),
          row('نسبة المديونية', 'Debt ratio (%)', pct(balance.totalLiabilities)),
        ] },
        { titleAr: 'مؤشرات المركز المالي', titleEn: 'Financial position indicators', rows: [
          row('رأس المال العامل', 'Working capital', balance.workingCapital),
          row('نسبة التداول', 'Current ratio', balance.totalCurrentAssets / (balance.totalCurrentLiabilities || 1)),
          row('نسبة السيولة السريعة', 'Quick ratio', (balance.totalCurrentAssets - sumAmount(balance.assetsCurrent.filter((l) => /^1130/.test(l.code)), 'debit')) / (balance.totalCurrentLiabilities || 1)),
          row('الخصوم إلى حقوق الملكية', 'Debt to equity', balance.totalLiabilities / (balance.totalEquity || 1)),
        ] },
      ],
    }
  }

  // trial balance (adjusted)
  const tbRows: ReportRow[] = lines.map((l) => ({
    labelAr: l.nameAr, labelEn: l.nameEn, debit: l.debit, credit: l.credit,
  }))
  return {
    key: 'trial', titleAr: 'ميزان المراجعة المعدل', titleEn: 'Adjusted Trial Balance',
    subtitleAr: 'بعد قيود التسوية والمراجعة المعتمدة', subtitleEn: 'After approved adjusting and review entries',
    columns: 'debit-credit', notesAr, notesEn,
    sections: [{
      titleAr: 'أرصدة الحسابات', titleEn: 'Account balances',
      rows: [...tbRows, { labelAr: 'الإجمالي', labelEn: 'Total', debit: totalDebit, credit: totalCredit, isTotal: true }],
    }],
  }
}

export function getAllReportModels(fs: FinancialStatements): Record<string, ReportModel> {
  return {
    income: getReportModel('income', fs),
    balance: getReportModel('balance', fs),
    equity: getReportModel('equity', fs),
    cashflow: getReportModel('cashflow', fs),
    position: getReportModel('position', fs),
    trial: getReportModel('trial', fs),
  }
}

export function sectionOptions() {
  return Object.keys({
    asset_current: 1, asset_noncurrent: 1, asset_contra: 1, liability_current: 1,
    liability_noncurrent: 1, equity_capital: 1, equity_reserves: 1, equity_retained: 1,
    equity_contra: 1, revenue_operating: 1, revenue_other: 1, revenue_contra: 1,
    cogs: 1, expense_admin: 1, expense_selling: 1, expense_finance: 1, expense_other: 1,
  }).map((key) => ({ key, labelAr: sectionLabel(key, 'ar'), labelEn: sectionLabel(key, 'en') }))
}
