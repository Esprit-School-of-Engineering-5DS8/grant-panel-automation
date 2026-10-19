import { HeroCard } from '../m3/HeroCard'
import type { Application } from '../types'

export interface ArbitrationTabProps {
  totalCandidates: number
  needsReviewCount: number
  proposals: Application[]
  sortedCohort: Application[]
  selectedProposal: Application | null
  isSignedOff: boolean
  signOffTimestamp: string
  overrideScore: number
  setOverrideScore: (score: number) => void
  overrideDecision: 'FUND' | 'RESERVE' | 'REJECT'
  setOverrideDecision: (decision: 'FUND' | 'RESERVE' | 'REJECT') => void
  overrideNotes: string
  setOverrideNotes: (notes: string) => void
  onSignOff: () => void
  onOpenWorkspace: () => void
  onGoTo: (tab: any) => void
  onRunBatch: () => void
}

export function ArbitrationTab({
  totalCandidates,
  needsReviewCount,
  proposals,
  sortedCohort,
  selectedProposal,
  isSignedOff,
  signOffTimestamp,
  overrideScore,
  setOverrideScore,
  overrideDecision,
  setOverrideDecision,
  overrideNotes,
  setOverrideNotes,
  onSignOff,
  onOpenWorkspace,
  onGoTo,
  onRunBatch,
}: ArbitrationTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <HeroCard
        total={totalCandidates}
        needsReview={needsReviewCount}
        title="Fellowship Committee Chair Arbitration & Final Authorization"
        subtitle="Cohort ranking, disagreement arbitration, composite score calibration, and binding digital signature."
        onOpenWorkspace={onOpenWorkspace}
        actions={[
          { label: 'Batch audit', icon: 'play_circle', onClick: onRunBatch },
          { label: 'All candidates', icon: 'groups', onClick: () => onGoTo('audit') },
          { label: 'Decisions', icon: 'gavel', onClick: () => onGoTo('decisions') },
          { label: 'RAG rules', icon: 'policy', onClick: () => onGoTo('corpus') },
        ]}
      />
      <div className="m3-card">
        <div className="m3-card-title-row">
          <div>
            <h2>Fellowship Committee Chair Arbitration & Final Authorization</h2>
            <span className="m3-subtitle">Cohort ranking, disagreement arbitration, and binding digital signature</span>
          </div>
          <span className={`m3-badge ${isSignedOff ? 'm3-badge-success' : 'm3-badge-warning'}`}>
            {isSignedOff ? 'CHAIR SIGNED-OFF' : 'AWAITING AUTHORIZATION'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: '1rem' }}>Cohort Ranking ({proposals.length} Candidates)</strong>
              <span className="m3-badge m3-badge-primary">40% Academic • 35% Impact • 25% Need</span>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table className="m3-ranking-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Applicant</th>
                    <th>Major</th>
                    <th>GPA</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCohort.map((p, idx) => {
                    const score = p.ground_truth?.consensus_score || 3.5
                    const isFunded = score >= 4.0
                    return (
                      <tr key={p.id}>
                        <td><strong>#{idx + 1}</strong></td>
                        <td><span className="m3-badge m3-badge-neutral">{p.applicant_name || p.id}</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{p.major || 'Liberal Arts'}</td>
                        <td><strong>{p.gpa?.toFixed(2) || '3.8'}</strong></td>
                        <td><strong>{score.toFixed(1)}</strong></td>
                        <td>
                          <span className={`m3-badge ${isFunded ? 'm3-badge-success' : 'm3-badge-warning'}`}>
                            {isFunded ? 'FUND' : 'RESERVE'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <strong style={{ fontSize: '1rem' }}>Chair Authorization Form: {selectedProposal?.applicant_name || 'Select a candidate'}</strong>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                <span>Composite Score:</span> <strong>{overrideScore.toFixed(1)} / 5.0</strong>
              </label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={overrideScore}
                onChange={(e) => setOverrideScore(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Final Decision Recommendation:
              </label>
              <select
                value={overrideDecision}
                onChange={(e) => setOverrideDecision(e.target.value as any)}
                className="m3-select"
                style={{ width: '100%', border: '1px solid #cbd5e1' }}
              >
                <option value="FUND">FUND — Full Yale Fellowship Approved</option>
                <option value="RESERVE">RESERVE — Alternate Candidate Pool</option>
                <option value="REJECT">REJECT — Defect / SAP Ineligible</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Official Committee Decision Letter:
              </label>
              <textarea
                rows={5}
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.8rem', lineHeight: 1.5 }}
              />
            </div>

            <button
              className="m3-btn m3-btn-primary"
              style={{ background: '#00356b' }}
              onClick={onSignOff}
            >
              <span className="material-symbols-outlined">verified</span>
              Affix Digital Signature & Seal
            </button>

            {isSignedOff && (
              <div style={{ background: '#d1fae5', color: '#065f46', padding: 10, borderRadius: 10, fontSize: '0.78rem', textAlign: 'center' }}>
                Certified Digital Signature: YALE-SFS-CHAIR-2026-VAL • {signOffTimestamp}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
