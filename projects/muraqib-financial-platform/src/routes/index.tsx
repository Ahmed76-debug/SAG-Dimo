import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { PortfolioPage } from '@/pages/portfolio/PortfolioPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { CompaniesPage } from '@/pages/companies/CompaniesPage'
import { ChartOfAccountsPage } from '@/pages/accounts/ChartOfAccountsPage'
import { ReportPage } from '@/pages/reports/ReportPage'
import { BudgetPage } from '@/pages/budget/BudgetPage'
import { AnalysisPage } from '@/pages/analysis/AnalysisPage'
import { AdjustmentsPage } from '@/pages/adjustments/AdjustmentsPage'
import { UsersPage } from '@/pages/users/UsersPage'
import { ArchivePage } from '@/pages/archive/ArchivePage'
import { RemindersPage } from '@/pages/reminders/RemindersPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { BackupRestorePage } from '@/pages/backup/BackupRestorePage'
import { TutorialsPage } from '@/pages/tutorials/TutorialsPage'
import { DataToolsPage } from '@/pages/datatools/DataToolsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { TrialBalanceGeneratorPage } from '@/pages/trialbalance/TrialBalanceGeneratorPage'
import { TrialBalanceImportPage } from '@/pages/trialbalance/TrialBalanceImportPage'
import { TrialBalanceReviewPage } from '@/pages/trialbalance/TrialBalanceReviewPage'
import { CfoPortalPage } from '@/pages/portal/CfoPortalPage'

export const router = createBrowserRouter([
  { path: '/', element: <PortfolioPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'companies', element: <CompaniesPage /> },
      { path: 'accounts', element: <ChartOfAccountsPage /> },
      { path: 'trialbalance/generator', element: <TrialBalanceGeneratorPage /> },
      { path: 'trialbalance/import', element: <TrialBalanceImportPage /> },
      { path: 'trialbalance/review', element: <TrialBalanceReviewPage /> },
      { path: 'portal', element: <CfoPortalPage /> },
      { path: 'adjustments', element: <AdjustmentsPage /> },
      { path: 'reports/:type', element: <ReportPage /> },
      { path: 'budget', element: <BudgetPage /> },
      { path: 'analysis', element: <AnalysisPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'reminders', element: <RemindersPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'backup', element: <BackupRestorePage /> },
      { path: 'data-tools', element: <DataToolsPage /> },
      { path: 'tutorials', element: <TutorialsPage /> },
      { path: 'entries', element: <Navigate to="/adjustments" replace /> },
      { path: 'external', element: <Navigate to="/portal" replace /> },
      { path: 'review', element: <Navigate to="/trialbalance/review" replace /> },
      { path: 'cfo-portal', element: <Navigate to="/portal" replace /> },
      { path: 'reports/trial-balance', element: <Navigate to="/reports/trial" replace /> },
      { path: 'reports/income-statement', element: <Navigate to="/reports/income" replace /> },
      { path: 'reports/balance-sheet', element: <Navigate to="/reports/balance" replace /> },
      { path: 'reports/changes-in-equity', element: <Navigate to="/reports/equity" replace /> },
      { path: 'reports/cash-flow', element: <Navigate to="/reports/cashflow" replace /> },
      { path: 'reports/financial-position', element: <Navigate to="/reports/position" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
