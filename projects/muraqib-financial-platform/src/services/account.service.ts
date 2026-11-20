import { db, type Account, type Company, type TrialBalanceLine } from '@/lib/db'
import type { AccountType } from '@/types'
import { accountLevel, accountNature, generateTemplateForCompany, inferSection } from '@/data/trialBalanceTemplates'

export async function syncAccountsFromLines(companyId: number, lines: Array<{
  code: string; nameAr: string; nameEn: string; type: AccountType; section?: string
}>): Promise<number> {
  const now = new Date().toISOString()
  const existing = await db.accounts.where({ companyId }).toArray()
  const byCode = new Map(existing.map((a) => [a.code, a]))
  let created = 0
  for (const line of lines) {
    const section = line.section || inferSection(line.code, line.type, line.nameAr, line.nameEn)
    const current = byCode.get(line.code)
    if (current) {
      await db.accounts.update(current.id!, {
        nameAr: line.nameAr || current.nameAr,
        nameEn: line.nameEn || current.nameEn,
        type: line.type,
        section,
        updatedAt: now,
      })
    } else {
      const nature = accountNature(line.type)
      await db.accounts.add({
        companyId,
        code: line.code,
        nameAr: line.nameAr,
        nameEn: line.nameEn,
        type: line.type,
        section,
        level: accountLevel(line.code),
        nature,
        isActive: true,
        isSystem: true,
        allowPosting: true,
        createdAt: now,
        updatedAt: now,
      } as Account)
      created++
    }
  }
  return created
}

export async function initializeChartOfAccounts(company: Company): Promise<number> {
  const companyId = company.id!
  const existing = await db.accounts.where({ companyId }).count()
  if (existing > 0) return 0
  const template = generateTemplateForCompany(company)
  return syncAccountsFromLines(companyId, template)
}

export async function getAccountsByCompany(companyId: number) {
  return db.accounts.where({ companyId }).sortBy('code')
}

export async function getPostingAccounts(companyId: number) {
  return db.accounts.where({ companyId }).filter((a) => a.allowPosting && a.isActive).sortBy('code')
}

export async function createAccount(account: Account) {
  const now = new Date().toISOString()
  return db.accounts.add({ ...account, createdAt: now, updatedAt: now })
}

export async function deleteAccount(id: number) {
  const account = await db.accounts.get(id)
  if (!account) throw new Error('ACCOUNT_NOT_FOUND')
  const used = await db.trialBalanceLines.where({ companyId: account.companyId })
    .filter((l) => l.code === account.code)
    .count()
  if (used > 0) throw new Error('ACCOUNT_IN_USE')
  return db.accounts.delete(id)
}

export async function getAccountCodesInTb(companyId: number) {
  const lines = await db.trialBalanceLines.where({ companyId }).toArray()
  return new Map(lines.map((l: TrialBalanceLine) => [l.code, l]))
}
