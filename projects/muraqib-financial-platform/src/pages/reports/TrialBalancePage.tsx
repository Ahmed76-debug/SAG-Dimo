import { useTranslation } from 'react-i18next'
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react'
import { useLiveQuery } from "@/lib/liveQuery"
import { db } from '@/lib/db'
import { useState } from 'react'
import { generateTrialBalance } from '@/services/reports.service'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export function TrialBalancePage() {
  const { t } = useTranslation()
  const [companyId, setCompanyId] = useState<number | ''>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [report, setReport] = useState<any>(null)
  const companies = useLiveQuery(() => db.companies.toArray())

  const generate = async () => {
    if (!companyId) return
    const res = await generateTrialBalance(companyId as number, fromDate || undefined, toDate || undefined)
    setReport(res)
  }

  const exportPDF = () => {
    if (!report) return
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('ميزان المراجعة / Trial Balance', 14, 15)
    autoTable(doc, {
      startY: 25,
      head: [['كود الحساب / Code', 'اسم الحساب / Account', 'مدين / Debit', 'دائن / Credit']],
      body: report.rows.map((r: any) => [r.accountCode, r.accountNameAr + ' / ' + r.accountNameEn, r.debit.toLocaleString(), r.credit.toLocaleString()]),
      foot: [['', 'الإجمالى / Total', report.totalDebit.toLocaleString(), report.totalCredit.toLocaleString()]],
    })
    doc.save('trial-balance.pdf')
  }

  const exportExcel = () => {
    if (!report) return
    const ws = XLSX.utils.json_to_sheet(report.rows.map((r: any) => ({ 'كود الحساب': r.accountCode, 'اسم الحساب بالعربية': r.accountNameAr, 'Account Name EN': r.accountNameEn, 'مدين': r.debit, 'دائن': r.credit })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance')
    XLSX.writeFile(wb, 'trial-balance.xlsx')
  }

  const printReport = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.trialBalance')}</h1>
          <p className="text-text-secondary">يولد تلقائياً من القيود المحاسبية المعتمدة فقط</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPDF} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><FileDown className="h-4 w-4" />{t('actions.exportPdf')}</button>
          <button onClick={exportExcel} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><FileSpreadsheet className="h-4 w-4" />{t('actions.exportExcel')}</button>
          <button onClick={printReport} disabled={!report} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm disabled:opacity-40"><Printer className="h-4 w-4" />{t('actions.print')}</button>
        </div>
      </div>
      <div className="rounded-[2rem] border border-border bg-surface p-6 shadow-soft">
        <div className="grid gap-3 md:grid-cols-5">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm md:col-span-2">
            <option value="">اختر الشركة</option>
            {(companies||[]).map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-2xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm" />
          <button onClick={generate} className="rounded-2xl bg-gradient-to-r from-primary to-info px-4 py-2.5 text-sm font-semibold text-primary-foreground">توليد ميزان المراجعة</button>
        </div>
      </div>
      {report && (
        <div className="print-area overflow-x-auto rounded-[2rem] border border-border bg-surface shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/60">
                <th className="px-6 py-3 text-start">الكود</th>
                <th className="px-6 py-3 text-start">الحساب</th>
                <th className="px-6 py-3 text-start">مدين</th>
                <th className="px-6 py-3 text-start">دائن</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r: any) => (
                <tr key={r.accountId} className="border-b border-border/60">
                  <td className="px-6 py-3 font-mono">{r.accountCode}</td>
                  <td className="px-6 py-3">{r.accountNameAr} <span className="text-text-secondary">/ {r.accountNameEn}</span></td>
                  <td className="px-6 py-3">{r.debit ? r.debit.toLocaleString('ar-EG') : '-'}</td>
                  <td className="px-6 py-3">{r.credit ? r.credit.toLocaleString('ar-EG') : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2/60 font-semibold">
                <td className="px-6 py-3" colSpan={2}>الإجمالى</td>
                <td className="px-6 py-3">{report.totalDebit.toLocaleString('ar-EG')}</td>
                <td className="px-6 py-3">{report.totalCredit.toLocaleString('ar-EG')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

