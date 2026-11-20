import { useTranslation } from 'react-i18next'
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import { useLiveQuery } from "@/lib/liveQuery"
import { db } from '@/lib/db'
import { useState } from 'react'
import { generateIncomeStatement } from '@/services/reports.service'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export function IncomeStatementPage() {
  const { t } = useTranslation()
  const [companyId, setCompanyId] = useState<number | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [report, setReport] = useState<any>(null)
  const companies = useLiveQuery(() => db.companies.toArray())

  const generate = async () => {
    if (!companyId) return
    const res = await generateIncomeStatement(companyId as number, fromDate || undefined, toDate || undefined)
    setReport(res)
  }

  const exportPDF = () => {
    if (!report) return
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('قائمة الدخل / Income Statement', 14, 15)
    autoTable(doc, { startY: 25, head: [['البند', 'المبلغ']], body: [...report.revenues.map((r:any)=>['إيرادات - '+r.accountNameAr, r.credit-r.debit]), ...report.expenses.map((r:any)=>['مصروفات - '+r.accountNameAr, r.debit-r.credit]), ['صافي الربح / Net Income', report.netIncome]] })
    doc.save('income-statement.pdf')
  }

  const exportExcel = () => {
    if (!report) return
    const data = [
      ...report.revenues.map((r: any) => ({ 'البند': 'إيرادات - ' + r.accountNameAr, 'المبلغ': r.credit - r.debit })),
      ...report.expenses.map((r: any) => ({ 'البند': 'مصروفات - ' + r.accountNameAr, 'المبلغ': r.debit - r.credit })),
      { 'البند': 'صافي الربح', 'المبلغ': report.netIncome },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Income Statement')
    XLSX.writeFile(wb, 'income-statement.xlsx')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.incomeStatement')}</h1>
          <p className="text-text-secondary">قائمة الدخل تلقائية بناءً على دليل الحسابات والقيود المعتمدة</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPDF} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><FileDown className="h-4 w-4" />{t('actions.exportPdf')}</button>
          <button onClick={exportExcel} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />{t('actions.exportExcel')}</button>
          <button onClick={()=>window.print()} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><Printer className="h-4 w-4" />{t('actions.print')}</button>
        </div>
      </div>
      <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
        <div className="grid gap-3 md:grid-cols-5">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm md:col-span-2"><option value="">اختر الشركة</option>{(companies||[]).map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}</select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm" />
          <button onClick={generate} className="rounded-2xl bg-gradient-to-r from-primary to-info px-4 py-2.5 text-sm font-semibold text-primary-foreground">توليد قائمة الدخل</button>
        </div>
      </div>
      {report && (
        <div className="print-area rounded-[2rem] border border-border bg-surface p-8 shadow-soft">
          <h2 className="text-center text-xl font-bold">قائمة الدخل</h2>
          <p className="mt-1 text-center text-sm text-text-secondary">عن الفترة</p>
          <div className="mt-6 space-y-4">
            <div>
              <p className="font-semibold">أولاً: الإيرادات</p>
              {report.revenues.map((r:any)=> <div key={r.accountId} className="mt-2 flex justify-between border-b border-border/60 pb-2"><span>{r.accountNameAr}</span><span>{(r.credit-r.debit).toLocaleString('ar-EG')}</span></div>)}
              <div className="mt-2 flex justify-between font-semibold"><span>إجمالى الإيرادات</span><span>{report.totalRevenue.toLocaleString('ar-EG')}</span></div>
            </div>
            <div>
              <p className="font-semibold">ثانياً: المصروفات</p>
              {report.expenses.map((r:any)=> <div key={r.accountId} className="mt-2 flex justify-between border-b border-border/60 pb-2"><span>{r.accountNameAr}</span><span>{(r.debit-r.credit).toLocaleString('ar-EG')}</span></div>)}
              <div className="mt-2 flex justify-between font-semibold"><span>إجمالى المصروفات</span><span>{report.totalExpense.toLocaleString('ar-EG')}</span></div>
            </div>
            <div className="flex justify-between rounded-2xl bg-surface-2 px-4 py-3 text-lg font-bold"><span>صافي الربح / (الخسارة)</span><span>{report.netIncome.toLocaleString('ar-EG')}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}

