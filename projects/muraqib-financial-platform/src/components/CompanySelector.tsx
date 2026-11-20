import { useLiveQuery } from "@/lib/liveQuery"
import { db, type Company, type OfficeProfile } from '@/lib/db'
import { getCompanyYears } from '@/services/tb.service'
import { inputClass, Field } from '@/components/ui'
import { useEffect } from 'react'

export function useCompanies() {
  return useLiveQuery(() => db.companies.orderBy('code').toArray(), []) as Company[] | undefined
}

export function useOfficeProfile() {
  return useLiveQuery(() => db.officeProfile.toArray(), [])?.[0] as OfficeProfile | undefined
}

export function useCompanyYears(companyId?: number) {
  return useLiveQuery(async () => {
    if (!companyId) return [String(new Date().getFullYear())]
    return getCompanyYears(companyId)
  }, [companyId])
}

export function CompanySelect({
  companies,
  value,
  onChange,
  label,
  className,
  includeAll,
}: {
  companies: Company[]
  value: number | undefined
  onChange: (v: number | undefined) => void
  label?: string
  className?: string
  includeAll?: boolean
}) {
  return (
    <Field label={label} className={className}>
      <select
        className={inputClass}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      >
        {includeAll && <option value="">—</option>}
        {!includeAll && <option value="">Choose company...</option>}
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.nameAr}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function YearSelect({
  years,
  value,
  onChange,
  label,
  className,
}: {
  years: string[]
  value: string
  onChange: (v: string) => void
  label?: string
  className?: string
}) {
  return (
    <Field label={label} className={className}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function usePersistedSelection(companyId: number | undefined, setCompanyId: (v: number | undefined) => void) {
  useEffect(() => {
    if (!companyId) return
    const key = 'muraqib-selected-company'
    localStorage.setItem(key, String(companyId))
  }, [companyId])
  void setCompanyId
}

export function readStoredCompany(): number | undefined {
  const raw = localStorage.getItem('muraqib-selected-company')
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : undefined
}

