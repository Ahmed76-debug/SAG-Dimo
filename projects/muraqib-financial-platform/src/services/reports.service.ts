import { buildCompanyDataset } from '@/services/tb.service'
import { computeStatements, type EngineLine } from '@/lib/finance'
import { r2 } from '@/lib/exports'

export interface TrialBalanceRow {
  accountId: number
  accountCode: string
  accountNameAr: string
  accountNameEn: string
  accountType: string
  debit: number
  credit: number
}

function reportYear(toDate?: string) {
  const year = toDate ? new Date(toDate).getFullYear() : new Date().getFullYear()
  return String(Number.isFinite(year) ? year : new Date().getFullYear())
}

function toRows(lines: EngineLine[]): TrialBalanceRow[] {
  return lines.map((line, index) => ({
    accountId: index,
    accountCode: line.code,
    accountNameAr: line.nameAr,
    accountNameEn: line.nameEn,
    accountType: line.type,
    debit: line.balance > 0 ? r2(line.balance) : 0,
    credit: line.balance < 0 ? r2(Math.abs(line.balance)) : 0,
  }))
}

/**
 * Statements are TB-driven. This compatibility service only reads approved
 * trial balances and never reconstructs them from journals.
 */
export async function generateTrialBalance(companyId: number, _fromDate?: string, toDate?: string) {
  const dataset = await buildCompanyDataset(companyId, reportYear(toDate))
  const rows = toRows(dataset.lines)
  const totalDebit = r2(rows.reduce((sum, row) => sum + row.debit, 0))
  const totalCredit = r2(rows.reduce((sum, row) => sum + row.credit, 0))
  return { rows, totalDebit, totalCredit, difference: Math.abs(totalDebit - totalCredit) }
}

export async function generateIncomeStatement(companyId: number, _fromDate?: string, toDate?: string) {
  const dataset = await buildCompanyDataset(companyId, reportYear(toDate))
  const statements = computeStatements(dataset)
  return {
    revenues: statements.income.revenueOperating.concat(statements.income.revenueOther),
    expenses: statements.income.cogs.concat(statements.income.admin, statements.income.selling, statements.income.finance, statements.income.otherExpenses),
    totalRevenue: statements.income.netRevenue,
    totalExpense: r2(statements.income.totalCogs + statements.income.totalAdmin + statements.income.totalSelling + statements.income.totalFinance + statements.income.totalOtherExpenses),
    netIncome: statements.income.netIncome,
  }
}

export async function generateBalanceSheet(companyId: number, _asOfDate?: string) {
  const dataset = await buildCompanyDataset(companyId, reportYear())
  const statements = computeStatements(dataset)
  return {
    assets: statements.balance.assetsCurrent.concat(statements.balance.assetsNonCurrent),
    liabilities: statements.balance.liabilitiesCurrent.concat(statements.balance.liabilitiesNonCurrent),
    equity: statements.balance.equityCapital.concat(statements.balance.equityReserves, statements.balance.equityRetained),
    totalAssets: statements.balance.totalAssets,
    totalLiabilities: statements.balance.totalLiabilities,
    totalEquity: statements.balance.totalEquity,
    balanced: statements.balance.balanced,
  }
}
