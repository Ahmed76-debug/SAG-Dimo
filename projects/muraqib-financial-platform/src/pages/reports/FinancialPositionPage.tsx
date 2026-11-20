import { useTranslation } from 'react-i18next'
import { BarChart3 } from 'lucide-react'

export function FinancialPositionPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('nav.financialPosition')}</h1>
        <p className="text-text-secondary">قائمة المركز المالي</p>
      </div>
      <div className="rounded-[2rem] border border-border bg-surface p-10 text-center shadow-soft">
        <BarChart3 className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-semibold">قيد الإنشاء</h2>
      </div>
    </div>
  )
}
