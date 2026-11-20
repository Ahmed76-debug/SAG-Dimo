import { CURRENCIES, type CurrencyCode } from '@/types'

export const numberLocale = (lang: string) => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US')

export function formatNumber(n: number | undefined | null, lang = 'ar', decimals = 2): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat(numberLocale(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function currencySymbol(code: string | undefined, lang: string): string {
  const found = CURRENCIES.find((c) => c.code === code)
  if (!found) return code || ''
  return lang === 'ar' ? found.symbolAr : found.symbolEn
}

export function formatMoney(n: number | undefined | null, currency: string | undefined, lang = 'ar'): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—'
  const negative = n < 0
  const text = formatNumber(Math.abs(n), lang, 2)
  return `${negative ? '(' : ''}${text} ${currencySymbol(currency, lang)}${negative ? ')' : ''}`
}

export function formatPercent(n: number | undefined | null, lang = 'ar', decimals = 1): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—'
  return `${formatNumber(n, lang, decimals)}%`
}

export function formatDate(value: string | Date | undefined, lang = 'ar'): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    year: 'numeric', month: 'short', day: '2-digit',
  }).format(date)
}

export function formatDateTime(value: string | Date | undefined, lang = 'ar'): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.round(ms / 86400000)
}

export function fiscalPeriod(year: string) {
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

export function pick(ar: string | undefined, en: string | undefined, lang: string): string {
  return (lang === 'ar' ? ar : en) || ar || en || ''
}

export function statusTone(status: string): string {
  switch (status) {
    case 'approved': return 'success'
    case 'pending_approval': return 'warning'
    case 'rejected': return 'danger'
    case 'draft': return 'muted'
    default: return 'muted'
  }
}

export function currencyList(): CurrencyCode[] {
  return CURRENCIES.map((c) => c.code)
}
