import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold">404</p>
      <p className="text-xl font-semibold">الصفحة غير موجودة</p>
      <p className="text-text-secondary">الصفحة التي تبحث عنها غير موجودة أو تم نقلها</p>
      <Link to="/" className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-2.5 text-sm hover:bg-surface-2">
        العودة للبورتفوليو
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
