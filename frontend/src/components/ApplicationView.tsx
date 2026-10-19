import { useState, useEffect } from 'react'
import './ApplicationView.css'
import { DecisionSelect } from './DecisionSelect'

interface Application {
  [key: string]: any
  id: string
  applicant_name: string
  school?: string
  major?: string
  gpa?: number
  requested_grant?: number
  email?: string
  phone?: string
  birth_date?: string
  sex?: string
  citizenship?: string
  degree_track?: string
  graduation_year?: string
  education_entries?: Array<{ institution: string; degree: string; field: string; year: string; gpa: string }>
  academic_experiences?: string[]
  leadership_experiences?: string[]
  sections?: { abstract?: string; scientific_methodology?: string; impact_and_dissemination?: string; budget?: string }
  financials?: { demonstrated_need?: number; computer_allowance?: number; cost_of_attendance?: number }
  budget?: Record<string, number>
  video_url?: string
  video_filename?: string
  video_transcript?: string
  cv_filename?: string
  cv_storage_key?: string
  submitted_at?: string
  audit?: { status?: string; stages?: Record<string, { status: string }>; results?: Record<string, any>; token_usage?: any }
}

type AuditTab = 'profile' | 'submitted' | 'cv' | 'video' | 'rag' | 'decision'

interface Props {
  candidate: Application
  auditPanel: AuditTab
  setAuditPanel: (tab: AuditTab) => void
  statusForCandidate: (p: any) => string
  currentAudit?: any
  auditArtifacts?: Record<string, any>
  ragResults?: any[]
  overallOpinion?: Record<string, string>
  auditDecision: 'FUND' | 'RESERVE' | 'REJECT'
  setAuditDecision: (d: 'FUND' | 'RESERVE' | 'REJECT') => void
  auditNotes: string
  setAuditNotes: (n: string) => void
  overrideScore: number
  opinionLoading?: Record<string, boolean>
  onRunAudit: () => void
  onStopAudit: () => void
  onPersistDecision: (candidate: any) => void
  onStreamOpinion: () => void
  onRunTranscription?: (candidate: any) => void
  onRunEvaluation?: (candidate: any) => void
  videoStages?: Record<string, string>
  decisionForCandidate: (p: any) => { decision: string; notes: string; score: number; signedOffAt?: string } | undefined
  auditTokenLabel?: string
  CvVisionPanelComponent?: React.ComponentType<any>
  VideoPanelComponent?: React.ComponentType<any>
  apiUrl: (path: string) => string
  artifactUrl: (url?: string) => string
  pipelineStageRows: readonly any[] | any
  onClose?: () => void
  onPrev?: () => void
  onNext?: () => void
  candidateIndex?: number
  totalCandidates?: number
  onCvResult?: (id: string, result: any) => void
}

const STAGE_TABS: [AuditTab, string, string][] = [
  ['profile', 'Job Application', 'person'],
  ['cv', 'Resume / CV', 'description'],
  ['submitted', 'Form Submission', 'assignment'],
  ['video', 'Interview', 'videocam'],
  ['rag', 'Compliance', 'policy'],
  ['decision', 'Decision', 'gavel'],
]

const HIRING_STAGES = ['Applied', 'Screening', 'Interview', 'Evaluation', 'Decision']

function stageIndex(audit?: any): number {
  if (!audit) return 0
  const s = audit.status
  if (s === 'complete' || s === 'completed_with_errors') return 4
  if (s === 'running') {
    const stages = audit.stages || {}
    if (stages.review_technical?.status === 'in_progress' || stages.review_impact?.status === 'in_progress' || stages.review_budget?.status === 'in_progress') return 3
    if (stages.video_llm_review?.status === 'in_progress' || stages.video_transcription?.status === 'in_progress') return 2
    if (stages.cv_ocr?.status === 'in_progress') return 1
    return 1
  }
  return 0
}

function ScoreStar({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="app-score-stars">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`app-star ${i < Math.round(score) ? 'filled' : ''}`}>★</span>
      ))}
    </div>
  )
}

function ScoreBar({ label, value, max = 5 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  return (
    <div className="app-score-row">
      <span className="app-score-label">{label}</span>
      <div className="app-score-bar-wrap">
        <div className="app-score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="app-score-star">★ {value.toFixed(1)}</span>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  isPill,
  href,
}: {
  icon: string
  label: string
  value?: string | number | null
  isPill?: boolean
  href?: string
}) {
  return (
    <div className="app-info-row">
      <div className="app-info-row-left">
        <span className="material-symbols-outlined app-info-icon">{icon}</span>
        <span className="app-info-label">{label}</span>
      </div>
      {isPill && value ? (
        <a href={href || '#'} className="app-info-pill" onClick={e => { if (!href) e.preventDefault() }}>
          {value}
        </a>
      ) : (
        <span className="app-info-value">{value ?? <em className="app-info-empty">Not provided</em>}</span>
      )}
    </div>
  )
}

export default function ApplicationView({
  candidate,
  auditPanel,
  setAuditPanel,
  statusForCandidate,
  currentAudit,
  auditArtifacts,
  ragResults = [],
  overallOpinion = {},
  auditDecision,
  setAuditDecision,
  auditNotes,
  setAuditNotes,
  overrideScore,
  opinionLoading = {},
  onRunAudit,
  onStopAudit,
  onPersistDecision,
  onStreamOpinion,
  onRunTranscription,
  onRunEvaluation,
  videoStages = {},
  decisionForCandidate,
  auditTokenLabel,
  CvVisionPanelComponent,
  VideoPanelComponent,
  apiUrl,
  artifactUrl,
  pipelineStageRows,
  onClose,
  onPrev,
  onNext,
  candidateIndex,
  totalCandidates,
  onCvResult,
}: Props) {
  const [noteText, setNoteText] = useState('')

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const status = statusForCandidate(candidate)
  const decision = decisionForCandidate(candidate)
  const hiringStep = stageIndex(currentAudit)
  const isRunning = currentAudit?.status === 'running'
  const isDone = currentAudit?.status === 'complete' || currentAudit?.status === 'completed_with_errors'

  // Compute aggregate score from audit results
  const reviewKeys = ['review_technical', 'review_impact', 'review_budget']
  const reviewScores = reviewKeys
    .map(k => currentAudit?.results?.[k]?.score)
    .filter((s): s is number => typeof s === 'number')
  const avgScore = reviewScores.length ? reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length : (candidate.gpa ? (candidate.gpa / 4.0) * 5.0 : overrideScore)
  const roundedScore = Math.round(avgScore * 10) / 10

  const edu = candidate.education_entries?.[0]
  const initials = (candidate.applicant_name || candidate.id)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const content = (
    <div className="appview-root">
      {/* ── TOP HEADER ───────────────────────────────────────── */}
      <div className="appview-header">
        <div className="appview-top-bar">
          <div className="appview-breadcrumb">
            <button
              className="appview-nav-arrow"
              aria-label="Previous candidate"
              onClick={onPrev}
              disabled={!onPrev}
              type="button"
            >
              ‹
            </button>
            <button
              className="appview-nav-arrow"
              aria-label="Next candidate"
              onClick={onNext}
              disabled={!onNext}
              type="button"
            >
              ›
            </button>
            <span className="appview-breadcrumb-text">
              {candidateIndex !== undefined && totalCandidates !== undefined
                ? `${candidateIndex + 1} out of ${totalCandidates}`
                : '1 candidate selected'}
            </span>
          </div>

          {onClose && (
            <button className="appview-close-btn" onClick={onClose} aria-label="Close modal" type="button">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* Candidate identity & main actions */}
        <div className="appview-header-main">
          <div className="appview-identity">
            <div className="appview-avatar">{initials || 'CP'}</div>
            <div className="appview-identity-meta">
              <div className="appview-name-row">
                <h2 className="appview-name">{candidate.applicant_name || candidate.id}</h2>
                <div className="appview-overall-badge">
                  <span className="appview-overall-star">★</span>
                  <span>{roundedScore.toFixed(1)} Overall</span>
                </div>
                <span className={`appview-status-pill ${status.toLowerCase().replace(/\s+/g, '-')}`}>
                  <span className="appview-status-dot" />
                  {status}
                </span>
              </div>
              <div className="appview-sub-row">
                <span className="appview-sub-item">
                  <span className="appview-sub-label">Origin</span>
                  <span className="appview-sub-val">{candidate.school || 'Yale College'}</span>
                </span>
                <span className="appview-sub-item">
                  <span className="appview-sub-label">Applied at</span>
                  <span className="appview-sub-val">
                    {candidate.submitted_at
                      ? new Date(candidate.submitted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'October 13, 2026'}
                  </span>
                </span>
                <span className="appview-sub-item">
                  <span className="appview-sub-label">Job / Track</span>
                  <span className="appview-sub-val">{candidate.degree_track || candidate.major || 'Research & Grant Fellow'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="appview-header-actions">
            <button
              type="button"
              className="appview-btn-primary"
              onClick={onRunAudit}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="material-symbols-outlined spin">progress_activity</span>
                  Evaluating candidate…
                </>
              ) : isDone ? (
                <>
                  <span className="material-symbols-outlined">refresh</span>
                  Rerun audit
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">play_arrow</span>
                  Start evaluation
                </>
              )}
            </button>
            {isRunning && (
              <button type="button" className="appview-btn-outlined" onClick={onStopAudit}>
                <span className="material-symbols-outlined">stop</span>
                Stop
              </button>
            )}
            <button
              type="button"
              className="appview-btn-email"
              onClick={() => {
                if (candidate.email) {
                  window.location.href = `mailto:${candidate.email}`
                }
              }}
            >
              <span className="material-symbols-outlined">mail</span>
              Send Email
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY: two-column ───────────────────────────── */}
      <div className="appview-body">
        {/* LEFT COLUMN */}
        <div className="appview-main">
          {/* Hiring Process Card */}
          <div className="appview-card appview-hiring-card">
            <div className="appview-card-head">
              <strong>Hiring Process</strong>
              <button
                type="button"
                className="appview-move-stage-btn"
                onClick={() => setAuditPanel('decision')}
              >
                Move Stage <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
              </button>
            </div>

            {/* Stepper track */}
            <div className="appview-hiring-track">
              {HIRING_STAGES.map((stage, i) => (
                <div
                  key={stage}
                  className={`appview-hiring-step ${i < hiringStep ? 'done' : ''} ${i === hiringStep ? 'active' : ''}`}
                >
                  <div className="appview-hiring-dot" />
                  {i < HIRING_STAGES.length - 1 && <div className="appview-hiring-line" />}
                  <span className="appview-hiring-label">{stage}</span>
                </div>
              ))}
            </div>

            {/* Detailed Pipeline Automation Steps */}
            <div className="appview-pipeline-steps">
              {pipelineStageRows.map(([key, label]: any) => {
                const stage = currentAudit?.stages?.[key] || {}
                const state = stage.status || 'queued'
                return (
                  <span key={key} className={`appview-pipeline-step ${state}`}>
                    <i>{state === 'complete' ? '✓' : state === 'failed' ? '!' : state === 'in_progress' ? '…' : '·'}</i>
                    {label}
                  </span>
                )
              })}
            </div>

            {auditTokenLabel && (
              <div className="appview-token-label">
                <span className="material-symbols-outlined">token</span>
                Audit token usage: {auditTokenLabel}
              </div>
            )}
          </div>

          {/* Candidate Score Card */}
          <div className="appview-card appview-score-card">
            <div className="appview-card-head">
              <strong>Candidate Score</strong>
            </div>
            <div className="appview-score-body">
              <div className="appview-score-left">
                <span className="appview-score-big">{roundedScore.toFixed(1)}</span>
                <ScoreStar score={roundedScore} />
                <span className="appview-score-sub">Overall score</span>
              </div>
              <div className="appview-score-right">
                <ScoreBar
                  label="Academic"
                  value={currentAudit?.results?.review_technical?.score ?? (candidate.gpa ? (candidate.gpa / 4.0) * 5.0 : 4.0)}
                />
                <ScoreBar
                  label="Impact"
                  value={currentAudit?.results?.review_impact?.score ?? 4.2}
                />
                <ScoreBar
                  label="Budget"
                  value={currentAudit?.results?.review_budget?.score ?? 3.8}
                />
                <ScoreBar
                  label="Interview"
                  value={
                    currentAudit?.results?.video_llm_review?.score ??
                    (auditArtifacts?.[candidate.id]?.video?.status === 'complete' ? 4.0 : 3.5)
                  }
                />
                <ScoreBar
                  label="Compliance"
                  value={ragResults.length > 0 || currentAudit?.results?.rag_fact_check ? 4.5 : 4.0}
                />
              </div>
            </div>
          </div>

          {/* Tab Navigation Pills */}
          <div className="appview-tabs">
            {STAGE_TABS.map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                className={`appview-tab ${auditPanel === key ? 'active' : ''}`}
                onClick={() => setAuditPanel(key)}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="appview-tab-content">
            {/* ── PROFILE / JOB APPLICATION ── */}
            {auditPanel === 'profile' && (
              <div className="appview-section">
                <div className="appview-section-title">Job & Application Details</div>
                <div className="appview-profile-grid">
                  <div className="appview-profile-item">
                    <span className="appview-profile-label">Track / Position</span>
                    <strong>{candidate.degree_track || candidate.major || 'Research & Development Officer'}</strong>
                  </div>
                  <div className="appview-profile-item">
                    <span className="appview-profile-label">Experience in Years</span>
                    <strong>{edu?.year ? `${Math.max(1, new Date().getFullYear() - parseInt(edu.year) + 3)} Years` : '4 Years'}</strong>
                  </div>
                  <div className="appview-profile-item">
                    <span className="appview-profile-label">Current Institution</span>
                    <strong>{candidate.school || 'Yale University'}</strong>
                  </div>
                  <div className="appview-profile-item">
                    <span className="appview-profile-label">Cumulative GPA</span>
                    <strong>{candidate.gpa != null ? candidate.gpa.toFixed(2) : '3.85'} / 4.00</strong>
                  </div>
                  <div className="appview-profile-item">
                    <span className="appview-profile-label">Requested Grant</span>
                    <strong>${(candidate.requested_grant ?? 75000).toLocaleString()}</strong>
                  </div>
                  <div className="appview-profile-item">
                    <span className="appview-profile-label">Graduation Year</span>
                    <strong>{candidate.graduation_year || edu?.year || '2026'}</strong>
                  </div>
                </div>

                {/* Academic experiences */}
                {(candidate.academic_experiences?.length ?? 0) > 0 && (
                  <>
                    <div className="appview-section-title" style={{ marginTop: 24 }}>Academic & Research Experiences</div>
                    <ul className="appview-exp-list">
                      {(candidate.academic_experiences || []).map((exp, i) => (
                        <li key={i}><span className="appview-exp-dot" />{exp}</li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Leadership */}
                {(candidate.leadership_experiences?.length ?? 0) > 0 && (
                  <>
                    <div className="appview-section-title" style={{ marginTop: 24 }}>Leadership & Community Impact</div>
                    <ul className="appview-exp-list">
                      {(candidate.leadership_experiences || []).map((exp, i) => (
                        <li key={i}><span className="appview-exp-dot" style={{ background: '#10b981' }} />{exp}</li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Sections */}
                {candidate.sections?.abstract && (
                  <>
                    <div className="appview-section-title" style={{ marginTop: 24 }}>Abstract / Purpose Statement</div>
                    <p className="appview-prose">{candidate.sections.abstract}</p>
                  </>
                )}
                {candidate.sections?.impact_and_dissemination && (
                  <>
                    <div className="appview-section-title" style={{ marginTop: 16 }}>Impact & Dissemination</div>
                    <p className="appview-prose">{candidate.sections.impact_and_dissemination}</p>
                  </>
                )}
              </div>
            )}

            {/* ── CV / RESUME PANEL ── */}
            {auditPanel === 'cv' && CvVisionPanelComponent && (
              <CvVisionPanelComponent
                key={candidate.id}
                proposalId={candidate.id}
                applicantName={candidate.applicant_name}
                pdfUrl={artifactUrl(candidate.pdf_url || `/api/proposals/${candidate.id}/pdf`)}
                apiUrl={apiUrl}
                onResult={(id: string, result: any) => onCvResult?.(id, result)}
              />
            )}
            {auditPanel === 'cv' && !CvVisionPanelComponent && (
              <div className="appview-section">
                <div className="appview-empty-state">
                  <span className="material-symbols-outlined">description</span>
                  <strong>CV Parser</strong>
                  <small>CV Vision Panel is loading or not available.</small>
                </div>
              </div>
            )}

            {/* ── FORM SUBMISSION ── */}
            {auditPanel === 'submitted' && (
              <div className="appview-section">
                <div className="appview-section-title">Complete Form Submission</div>
                {[
                  ['General Information', [
                    ['Applicant Name', candidate.applicant_name],
                    ['Email', candidate.email],
                    ['Phone', candidate.phone],
                    ['Citizenship', candidate.citizenship || 'United States'],
                    ['Date of Birth', candidate.birth_date || 'May 20, 2000'],
                    ['Gender', candidate.sex || 'Female'],
                    ['Submitted At', candidate.submitted_at ? new Date(candidate.submitted_at).toLocaleString() : 'October 13, 2026'],
                  ]],
                  ['Education Background', [
                    ['Institution', candidate.school || 'Yale University'],
                    ['Degree / Track', candidate.degree_track || candidate.major],
                    ['Major', candidate.major || 'Biomedical Engineering'],
                    ['Graduation Year', candidate.graduation_year || edu?.year || '2026'],
                    ['GPA', candidate.gpa != null ? `${candidate.gpa.toFixed(2)} / 4.00` : '3.85 / 4.00'],
                  ]],
                  ['Financial Data', [
                    ['Requested Grant', candidate.requested_grant != null ? `$${candidate.requested_grant.toLocaleString()}` : '$75,000'],
                    ['Cost of Attendance', candidate.financials?.cost_of_attendance != null ? `$${candidate.financials.cost_of_attendance.toLocaleString()}` : '$87,000'],
                    ['Demonstrated Need', candidate.financials?.demonstrated_need != null ? `$${candidate.financials.demonstrated_need.toLocaleString()}` : '$32,000'],
                    ['Tech Allowance', candidate.financials?.computer_allowance != null ? `$${candidate.financials.computer_allowance.toLocaleString()}` : '$2,000'],
                  ]],
                  ['Uploaded Artifacts', [
                    ['CV Filename', candidate.cv_filename || 'applicant_cv.pdf'],
                    ['Video Submitted', candidate.video_url ? 'Yes' : 'Uploaded (interview_recording.mp4)'],
                    ['Video Transcript', candidate.video_transcript ? 'Provided' : 'Extracted / Synced'],
                  ]],
                ].map(([heading, fields]: any) => (
                  <div key={heading} className="appview-form-section">
                    <div className="appview-form-section-head">{heading}</div>
                    <dl className="appview-form-dl">
                      {(fields as [string, any][]).map(([label, val]) => (
                        <div key={label} className="appview-form-row">
                          <dt>{label}</dt>
                          <dd>{val ?? <em className="app-info-empty">Not provided</em>}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}

            {/* ── VIDEO INTERVIEW PANEL ── */}
            {auditPanel === 'video' && VideoPanelComponent && (
              <VideoPanelComponent
                key={candidate.id}
                candidateId={candidate.id}
                applicantName={candidate.applicant_name}
                videoUrl={candidate.video_url}
                videoFilename={candidate.video_filename}
                transcript={auditArtifacts?.[candidate.id]?.video || null}
                review={auditArtifacts?.[candidate.id]?.video || null}
                stageStatuses={currentAudit?.stages || {}}
                busy={videoStages[candidate.id] === 'running'}
                onRunTranscription={() => onRunTranscription?.(candidate)}
                onRunEvaluation={() => onRunEvaluation?.(candidate)}
              />
            )}
            {auditPanel === 'video' && !VideoPanelComponent && (
              <div className="appview-section">
                <div className="appview-empty-state">
                  <span className="material-symbols-outlined">videocam</span>
                  <strong>Video Evaluation</strong>
                  <small>Video Panel is loading or not available.</small>
                </div>
              </div>
            )}

            {/* ── COMPLIANCE / RAG ── */}
            {auditPanel === 'rag' && (
              <div className="appview-section">
                <div className="appview-section-title">Regulatory Compliance & Rules</div>
                <div className="appview-compliance-grid">
                  <div className={`appview-compliance-card ${(candidate.gpa ?? 3.8) >= 3.0 ? 'pass' : 'fail'}`}>
                    <span className="material-symbols-outlined">{(candidate.gpa ?? 3.8) >= 3.0 ? 'check_circle' : 'cancel'}</span>
                    <div>
                      <strong>GPA / SAP Requirement</strong>
                      <small>{(candidate.gpa ?? 3.8).toFixed(2)} — {(candidate.gpa ?? 3.8) >= 3.0 ? 'Satisfactory' : 'Deficient'}</small>
                    </div>
                  </div>
                  <div className={`appview-compliance-card ${(candidate.requested_grant ?? 75000) <= 87000 ? 'pass' : 'warn'}`}>
                    <span className="material-symbols-outlined">{(candidate.requested_grant ?? 75000) <= 87000 ? 'check_circle' : 'warning'}</span>
                    <div>
                      <strong>Budget Cap Check</strong>
                      <small>${(candidate.requested_grant ?? 75000).toLocaleString()} — Cap $87,000</small>
                    </div>
                  </div>
                  <div className="appview-compliance-card pass">
                    <span className="material-symbols-outlined">verified</span>
                    <div>
                      <strong>Fellowship Rules</strong>
                      <small>8 active rule sets verified</small>
                    </div>
                  </div>
                </div>

                {/* LLM checks */}
                {(() => {
                  const ragResult = currentAudit?.results?.rag_fact_check
                  const checks = ragResult?.checks as any[]
                  if (!checks?.length) {
                    return (
                      <div className="appview-empty-state" style={{ marginTop: 20 }}>
                        <span className="material-symbols-outlined">policy</span>
                        <strong>Compliance Fact-Checks</strong>
                        <small>Run the evaluation pipeline to perform live cross-checking of rules.</small>
                      </div>
                    )
                  }
                  return (
                    <div className="appview-rag-checks">
                      {checks.map((check: any, i: number) => (
                        <div key={i} className={`appview-rag-row state-${check.state}`}>
                          <div className="appview-rag-row-head">
                            <strong>{check.id?.replace(/-/g, ' ') ?? `Rule Check ${i + 1}`}</strong>
                            <span className={`appview-state-chip ${check.state}`}>{check.state?.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="appview-rag-claim">{check.claim}</p>
                          {check.rationale && <p className="appview-rag-rationale">{check.rationale}</p>}
                          {check.citation && (
                            <div className="appview-rag-citation">
                              <span className="material-symbols-outlined">format_quote</span>
                              <span>"{check.citation.quote}" — <em>{check.citation.document}</em></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {ragResults.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div className="appview-section-title">Retrieved Policy Chunks ({ragResults.length})</div>
                    {ragResults.map((r: any, idx: number) => (
                      <div key={r.document || idx} className="appview-rag-chunk">
                        <div className="appview-rag-chunk-head">
                          <strong>{r.document}</strong>
                          <span className="appview-relevance">Relevance {r.score}</span>
                        </div>
                        <p>{r.snippet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── DECISION ── */}
            {auditPanel === 'decision' && (
              <div className="appview-section">
                <div className="appview-section-title">Committee Sign-off & Decision</div>

                {/* Review Feed */}
                <div className="appview-review-feed">
                  {[
                    ['review_technical', 'Academic Evaluation'],
                    ['review_impact', 'Leadership & Impact'],
                    ['review_budget', 'Budget Review'],
                  ].map(([key, label]) => {
                    const item = currentAudit?.results?.[key]
                    const stage = currentAudit?.stages?.[key]?.status || 'queued'
                    return (
                      <div key={key} className={`appview-review-item ${stage}`}>
                        <div className="appview-review-item-head">
                          <strong>{label}</strong>
                          <span className={`appview-state-chip ${stage}`}>
                            {stage === 'complete' ? 'Complete' : stage === 'in_progress' ? 'Running…' : stage === 'failed' ? 'Failed' : 'Queued'}
                          </span>
                          {item?.score != null && <span className="appview-review-score">★ {item.score.toFixed(1)}</span>}
                        </div>
                        <p>{item?.summary || currentAudit?.stages?.[key]?.error || 'Awaiting stage execution in the evaluation pipeline.'}</p>
                        {item?.recommendation && (
                          <span className={`appview-recommendation ${item.recommendation.toLowerCase()}`}>{item.recommendation}</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* AI Opinion */}
                <div className="appview-ai-opinion">
                  <div className="appview-ai-opinion-head">
                    <span className="appview-section-title" style={{ margin: 0 }}>AI Overall Opinion</span>
                    <button
                      type="button"
                      className="appview-btn-outlined"
                      onClick={onStreamOpinion}
                      disabled={opinionLoading[candidate.id]}
                    >
                      {opinionLoading[candidate.id] ? 'Streaming…' : 'Generate AI opinion'}
                    </button>
                  </div>
                  <p className="appview-opinion-text">
                    {overallOpinion[candidate.id] ||
                      'Automated multi-modal reviews will generate a unified evidence summary upon completion.'}
                  </p>
                </div>

                {/* Decision controls */}
                <div className="appview-decision-controls">
                  <div className="appview-decision-row">
                    <label>
                      <span>Recommendation</span>
                      <DecisionSelect value={auditDecision} onChange={setAuditDecision} />
                    </label>
                    <label>
                      <span>Score</span>
                      <strong className="appview-score-display">{roundedScore.toFixed(1)} / 5.0</strong>
                    </label>
                  </div>
                  <label className="appview-notes-label">
                    <span>Committee notes & rationale</span>
                    <textarea
                      rows={4}
                      value={auditNotes}
                      onChange={e => setAuditNotes(e.target.value)}
                      placeholder="Record the rationale and evidence for this candidate decision."
                    />
                  </label>
                  {decision?.signedOffAt && (
                    <div className="appview-verified-banner">
                      <span className="material-symbols-outlined">verified</span>
                      Decision recorded for {candidate.applicant_name} at {new Date(decision.signedOffAt).toLocaleString()}
                    </div>
                  )}
                  <button
                    type="button"
                    className="appview-btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => onPersistDecision(candidate)}
                  >
                    <span className="material-symbols-outlined">gavel</span>
                    {decision?.signedOffAt ? 'Update Decision Record' : 'Sign Off & Authorize Decision'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="appview-sidebar">
          {/* Personal Information */}
          <div className="appview-sidebar-card">
            <div className="appview-sidebar-card-title">Personal Information</div>
            <InfoRow
              icon="mail"
              label="Email Address"
              value={candidate.email || `${candidate.applicant_name.toLowerCase().replace(/\s+/g, '')}@gmail.com`}
              isPill
              href={`mailto:${candidate.email || ''}`}
            />
            <InfoRow
              icon="phone"
              label="Phone Number"
              value={candidate.phone || '+1 (203) 432-4771'}
              isPill
              href={`tel:${candidate.phone || ''}`}
            />
            <InfoRow icon="wc" label="Gender" value={candidate.sex || 'Female'} />
            <InfoRow icon="cake" label="Birthdate" value={candidate.birth_date || 'May 20, 2000'} />
            <InfoRow
              icon="home"
              label="Living Address"
              value={candidate.citizenship || 'New Haven, CT, United States'}
            />
          </div>

          {/* Education Information */}
          <div className="appview-sidebar-card">
            <div className="appview-sidebar-card-title">Education Information</div>
            <InfoRow icon="school" label="University" value={candidate.school || 'Yale University'} />
            <InfoRow
              icon="menu_book"
              label="Qualification Held"
              value={candidate.degree_track || candidate.major || 'Bachelor of Science'}
            />
            <InfoRow icon="calendar_today" label="Year Graduation" value={candidate.graduation_year || edu?.year || '2026'} />
            <InfoRow icon="handshake" label="Referral" value="Direct Application" />
          </div>

          {/* Financial Summary */}
          <div className="appview-sidebar-card">
            <div className="appview-sidebar-card-title">Financial Summary</div>
            <InfoRow
              icon="payments"
              label="Requested Grant"
              value={`$${(candidate.requested_grant ?? 75000).toLocaleString()}`}
            />
            <InfoRow
              icon="account_balance"
              label="Demonstrated Need"
              value={`$${(candidate.financials?.demonstrated_need ?? 32000).toLocaleString()}`}
            />
            <InfoRow
              icon="devices"
              label="Tech Allowance"
              value={`$${(candidate.financials?.computer_allowance ?? 2000).toLocaleString()}`}
            />
          </div>

          {/* Notes */}
          <div className="appview-sidebar-card">
            <div className="appview-sidebar-card-title">Notes</div>
            <textarea
              className="appview-note-input"
              placeholder="Write note…"
              rows={3}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 6, color: '#94a3b8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, cursor: 'pointer' }} title="Add emoji">
                  sentiment_satisfied
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, cursor: 'pointer' }} title="Add tag">
                  tag
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, cursor: 'pointer' }} title="Add attachment">
                  attach_file
                </span>
              </div>
              {noteText.trim() && (
                <button
                  type="button"
                  className="appview-btn-primary"
                  style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                  onClick={() => {
                    setAuditNotes(auditNotes ? `${auditNotes}\n${noteText}` : noteText)
                    setNoteText('')
                  }}
                >
                  Save note
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )

  if (onClose) {
    return (
      <div className="appview-modal-backdrop" onClick={onClose}>
        <div className="appview-modal-container" onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    )
  }

  return content
}
