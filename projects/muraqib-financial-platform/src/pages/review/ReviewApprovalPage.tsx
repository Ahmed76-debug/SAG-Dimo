import { Navigate } from 'react-router-dom'

/** Review now belongs to the trial balance approval workflow. */
export function ReviewApprovalPage() {
  return <Navigate to="/trialbalance/review" replace />
}
