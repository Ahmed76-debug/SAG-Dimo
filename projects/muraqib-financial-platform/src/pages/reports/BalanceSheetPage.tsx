import { useTranslation } from 'react-i18next'
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import { useLiveQuery } from "@/lib/liveQuery"
import { db } from '@/lib/db'
import { useState } from 'react'
import { generateBalanceSheet } from '@/services/reports.service'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export function BalanceSheetPage() {
  const { t } = useTranslation()
  const [companyId, setCompanyId] = useState<number | ''>('')
  const [asOfDate, setAsOfDate] = useState('')
  const [report, setReport] = useState<any>(null)
  const companies = useLiveQuery(() => db.companies.toArray())

  const generate = async () => {
    if (!companyId) return
    const res = await generateBalanceSheet(companyId as number, asOfDate || undefined)
    setReport(res)
  }

  const exportPDF = () => {
    if (!report) return
    const doc = new jsPDF()
    doc.text('الميزانية العمومية / Balance Sheet', 14, 15)
    autoTable(doc, { startY: 25, head: [['الأصول'], ['الحساب','المبلغ']], body: report.assets.map((r:any)=>[r.accountNameAr, (r.debit-r.credit).toLocaleString()]) })
    autoTable(doc, { startY: (doc as any).lastAutoTable.finalY + 5, head: [['الخصوم وحقوق الملكية'], ['الحساب','المبلغ']], body: [...report.liabilities.map((r:any)=>[r.accountNameAr,(r.credit-r.debit).toLocaleString()]), ...report.equity.map((r:any)=>[r.accountNameAr,(r.credit-r.debit).toLocaleString()])] })
    doc.save('balance-sheet.pdf')
  }

  const exportExcel = () => {
    if (!report) return
    const data = [
      ...report.assets.map((r: any) => ({ 'القسم': 'أصول', 'الحساب': r.accountNameAr, 'المبلغ': r.debit - r.credit })),
      ...report.liabilities.map((r: any) => ({ 'القسم': 'خصوم', 'الحساب': r.accountNameAr, 'المبلغ': r.credit - r.debit })),
      ...report.equity.map((r: any) => ({ 'القسم': 'حقوق ملكية', 'الحساب': r.accountNameAr, 'المبلغ': r.credit - r.debit })),
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet')
    XLSX.writeFile(wb, 'balance-sheet.xlsx')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.balanceSheet')}</h1>
          <p className="text-text-secondary">الميزانية العمومية مع توازن الأصول = الخصوم + حقوق الملكية</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPDF} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><FileDown className="h-4 w-4" />{t('actions.exportPdf')}</button>
          <button onClick={exportExcel} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />{t('actions.exportExcel')}</button>
          <button onClick={()=>window.print()} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><Printer className="h-4 w-4" />{t('actions.print')}</button>
        </div>
      </div>
      <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
        <div className="grid gap-3 md:grid-cols-4">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm md:col-span-2"><option value="">اختر الشركة</option>{(companies||[]).map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm" />
          <button onClick={generate} className="rounded-2xl bg-gradient-to-r from-primary to-info px-4 py-2.5 text-sm font-semibold text-primary-foreground">توليد الميزانية العمومية</button>
        </div>
      </div>
      {report && (
        <div className="print-area grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
            <h2 className="text-lg font-bold">الأصول / Assets</h2>
            {report.assets.map((r:any)=><div key={r.accountId} className="mt-2 flex justify-between border-b border-border/60 pb-2"><span>{r.accountNameAr}</span><span>{(r.debit-r.credit).toLocaleString('ar-EG')}</span></div>)}
            <div className="mt-3 flex justify-between font-bold"><span>إجمالى الأصول</span><span>{report.totalAssets.toLocaleString('ar-EG')}</span></div>
          </div>
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
              <h2 className="text-lg font-bold">الخصوم / Liabilities</h2>
              {report.liabilities.map((r:any)=><div key={r.accountId} className="mt-2 flex justify-between border-b border-border/60 pb-2"><span>{r.accountNameAr}</span><span>{(r.credit-r.debit).toLocaleString('ar-EG')}</span></div>)}
              <div className="mt-3 flex justify-between font-bold"><span>إجمالى الخصوم</span><span>{report.totalLiabilities.toLocaleString('ar-EG')}</span></div>
            </div>
            <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
              <h2 className="text-lg font-bold">حقوق الملكية / Equity</h2>
              {report.equity.map((r:any)=><div key={r.accountId} className="mt-2 flex justify-between border-b border-border/60 pb-2"><span>{r.accountNameAr}</span><span>{(r.credit-r.debit).toLocaleString('ar-EG')}</span></div>)}
              <div className="mt-3 flex justify-between font-bold"><span>إجمالى حقوق الملكية</span><span>{report.totalEquity.toLocaleString('ar-EG')}</span></div>
            </div>
            <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
              <div className="flex justify-between font-bold"><span>إجمالى الخصوم + حقوق الملكية</span><span>{(report.totalLiabilities+report.totalEquity).toLocaleString('ar-EG')}</span></div>
              <p className="mt-2 text-sm text-text-secondary">{report.balanced ? 'متوازنة ✓' : 'غير متوازنة'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

