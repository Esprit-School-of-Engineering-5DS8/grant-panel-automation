import { HeroCard } from '../m3/HeroCard'
import type { Application, CandidateDecision } from '../types'

export interface DecisionsTabProps {
  proposals: Application[]
  statusForCandidate: (candidate: Application) => string
  decisionForCandidate: (candidate: Application) => CandidateDecision | undefined
  statusClass: (status: string) => string
  recommendationClass: (recommendation: string) => string
  onOpenCandidate: (id: string, panel?: 'profile' | 'submitted' | 'cv' | 'video' | 'rag' | 'verification' | 'decision') => void
  onGoTo: (tab: any) => void
  onRunBatch: () => void
}

export function DecisionsTab({
  proposals,
  statusForCandidate,
  decisionForCandidate,
  statusClass,
  recommendationClass,
  onOpenCandidate,
  onGoTo,
  onRunBatch,
}: DecisionsTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <HeroCard
        total={proposals.length}
        needsReview={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
        title="Committee Decision Register"
        subtitle="Candidate-keyed recommendations, score calibrations, and chair binding sign-offs."
        onOpenWorkspace={() => proposals[0] && void onOpenCandidate(proposals[0].id)}
        actions={[
          { label: 'Batch audit', icon: 'play_circle', onClick: onRunBatch },
          { label: 'All candidates', icon: 'groups', onClick: () => onGoTo('audit') },
          { label: 'Chair sign-off', icon: 'verified', onClick: () => onGoTo('arbitration') },
          { label: 'RAG rules', icon: 'policy', onClick: () => onGoTo('corpus') },
        ]}
      />
      <div className="admin-decisions dossier-panel">
        <div className="overview-intro">
          <div>
            <span className="eyebrow">Committee decisions · Application 2026</span>
            <h2>Decision register</h2>
            <p>Candidate-keyed recommendations and chair sign-offs.</p>
          </div>
          <button className="m3-btn m3-btn-primary" onClick={() => onGoTo('audit')}>
            Open audit workspace
          </button>
        </div>
        <div className="decisions-table-wrap">
          <table className="decisions-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Track / GPA</th>
                <th>Audit status</th>
                <th>Recommendation</th>
                <th>Score</th>
                <th>Sign-off</th>
                <th>Requested grant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => {
                const decision = decisionForCandidate(p)
                const recommendation = decision?.decision || 'Pending'
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.applicant_name || p.id}</strong>
                      <small>{p.id}</small>
                    </td>
                    <td>
                      {p.major}
                      <br />
                      <small>GPA {p.gpa?.toFixed(2) || '—'}</small>
                    </td>
                    <td>
                      <span className={`audit-status ${statusClass(statusForCandidate(p))}`}>
                        {statusForCandidate(p)}
                      </span>
                    </td>
                    <td>
                      <span className={`recommendation-chip ${recommendationClass(recommendation)}`}>
                        {recommendation}
                      </span>
                    </td>
                    <td>{decision?.score ? `${decision.score.toFixed(1)} / 5.0` : '—'}</td>
                    <td>{decision?.signedOffAt ? new Date(decision.signedOffAt).toLocaleString() : 'Not signed off'}</td>
                    <td>${p.requested_grant?.toLocaleString() || '—'}</td>
                    <td>
                      <button className="text-button" onClick={() => onOpenCandidate(p.id, 'decision')}>
                        Open <span className="material-symbols-outlined">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!proposals.length && (
            <div className="audit-empty">
              <span className="material-symbols-outlined">gavel</span>
              <strong>No decisions yet</strong>
              <small>Candidate decisions will appear here after chair sign-off.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
