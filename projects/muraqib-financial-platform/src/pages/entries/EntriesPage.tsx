import { Navigate } from 'react-router-dom'

/** Journal entries are intentionally replaced by the TB-driven workflow. */
export function EntriesPage() {
  return <Navigate to="/adjustments" replace />
}
