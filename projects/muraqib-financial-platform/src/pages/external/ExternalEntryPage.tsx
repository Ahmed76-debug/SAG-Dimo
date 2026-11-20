import { Navigate } from 'react-router-dom'

/** External company users are isolated to the CFO portal. */
export function ExternalEntryPage() {
  return <Navigate to="/portal" replace />
}
