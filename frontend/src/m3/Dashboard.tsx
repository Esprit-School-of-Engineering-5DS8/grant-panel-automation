import { useState } from 'react'
import { icon } from './md'
import { HeroCard } from './HeroCard'

type Decision = 'FUND' | 'RESERVE' | 'REJECT'
type AnyRecord = Record<string, any>

export interface DashboardProps {
  proposals: AnyRecord[]
  statusForCandidate: (candidate: any) => string
  decisionForCandidate: (candidate: any) => { decision: Decision; notes: string; score: number; signedOffAt?: string } | undefined
  onOpenCandidate: (id: string, panel?: any) => void
  onGoTo: (tab: any) => void
  onRunBatch: () => void
}

const AVATAR_TONES = ['blue', 'violet', 'amber', 'mint', 'rose', 'slate']
const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?'
const money = (value: unknown) => `$${Number(value || 0).toLocaleString()}`

const statusTone = (status: string) => ({ 'Needs review': 'amber', 'In review': 'blue', Verified: 'mint', 'Decision needed': 'amber', Submitted: 'slate' } as Record<string, string>)[status] || 'blue'
const decisionTone = (decision?: string) => ({ FUND: 'mint', RESERVE: 'amber', REJECT: 'rose', Pending: 'slate' } as Record<string, string>)[decision || 'Pending'] || 'slate'

export function Dashboard({ proposals, statusForCandidate, decisionForCandidate, onOpenCandidate, onGoTo, onRunBatch }: DashboardProps) {
  const [query, setQuery] = useState('')

  const total = proposals.length
  const countBy = (status: string) => proposals.filter(p => statusForCandidate(p) === status).length
  const needsReview = countBy('Needs review')
  const inReview = countBy('In review')
  const verified = countBy('Verified')
  const decisionNeeded = countBy('Decision needed')
  const pct = (value: number) => total ? Math.round((value / total) * 100) : 0

  const matches = (p: AnyRecord) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [p.applicant_name, p.id, p.major, statusForCandidate(p)].some(v => String(v || '').toLowerCase().includes(q))
  }

  const actions = [
    { label: 'Batch audit', icon: 'play_circle', onClick: onRunBatch },
    { label: 'Audit workspace', icon: 'fact_check', onClick: () => onGoTo('audit') },
    { label: 'RAG rules', icon: 'policy', onClick: () => onGoTo('corpus') },
    { label: 'Continue audit', icon: 'arrow_forward', onClick: () => onGoTo('audit') },
    { label: 'Review queue', icon: 'groups', onClick: () => onGoTo('audit') },
    { label: 'Sign off', icon: 'verified', onClick: () => onGoTo('audit') },
  ]

  const kpis = [
    { label: 'Total applicants', icon: 'groups', value: total, delta: `${total} in cohort`, onClick: () => onGoTo('audit') },
    { label: 'Needs review', icon: 'pending_actions', value: needsReview, delta: `${pct(needsReview)}% of cohort`, onClick: () => onGoTo('audit') },
    { label: 'In review', icon: 'autorenew', value: inReview, delta: `${pct(inReview)}% of cohort`, onClick: () => onGoTo('audit') },
    { label: 'Verified', icon: 'verified', value: verified, delta: `${pct(verified)}% of cohort`, onClick: () => onGoTo('audit') },
    { label: 'Decision needed', icon: 'gavel', value: decisionNeeded, delta: `${pct(decisionNeeded)}% of cohort`, onClick: () => onGoTo('audit') },
  ]

  const applicants = proposals.filter(matches).slice(0, 5)
  const queue = proposals.filter(p => ['Needs review', 'In review'].includes(statusForCandidate(p))).filter(matches).slice(0, 5)
  const signoffs = proposals.filter(p => decisionForCandidate(p)).filter(matches).slice(0, 5)

  return (
    <div className="dash">
      {/* Hero — the M3 top app bar lives inside the card, as in the reference */}
      <HeroCard total={total} needsReview={needsReview} actions={actions} onSearch={setQuery} onOpenWorkspace={() => onGoTo('audit')} />

      {/* KPI row */}
      <div className="dash-kpis">
        {kpis.map(kpi => (
          <button key={kpi.label} type="button" className="dash-kpi" onClick={kpi.onClick}>
            <span className="dash-kpi-head">{kpi.label}{icon('chevron_right')}</span>
            <span className="dash-kpi-body">
              <span className="dash-kpi-icon">{icon(kpi.icon)}</span>
              <span className="dash-kpi-num">{kpi.value}</span>
            </span>
            <span className="dash-kpi-delta">{icon('trending_up')}{kpi.delta}</span>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="dash-section-head"><h3>Recent Activity</h3></div>
      <div className="dash-grid3">
        <section className="dash-card">
          <div className="dash-card-head">{icon('work')}<h4>Applicants</h4>{icon('chevron_right')}</div>
          <div className="dash-rows">
            {applicants.length ? applicants.map((p, index) => (
              <button key={p.id} type="button" className="dash-row" onClick={() => onOpenCandidate(p.id)}>
                <span className={`dash-ava square ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>{icon('description')}</span>
                <span className="dash-row-main"><strong>{p.applicant_name || p.id}</strong><small>{p.id} · {p.major || 'Undeclared'}</small></span>
                <span className={`dash-tag ${statusTone(statusForCandidate(p))}`}>{statusForCandidate(p)}</span>
                <span className="dash-row-menu">{icon('more_vert')}</span>
              </button>
            )) : <p className="dash-empty">No applicants match your search.</p>}
          </div>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">{icon('groups')}<h4>Candidates</h4>{icon('chevron_right')}</div>
          <div className="dash-rows">
            {queue.length ? queue.map((p, index) => (
              <button key={p.id} type="button" className="dash-row" onClick={() => onOpenCandidate(p.id)}>
                <span className={`dash-ava round ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>{initials(p.applicant_name || p.id)}</span>
                <span className="dash-row-main"><strong>{p.applicant_name || p.id}</strong><small>GPA {Number(p.gpa || 0).toFixed(2)} · {money(p.requested_grant)}</small></span>
                <span className={`dash-tag ${statusTone(statusForCandidate(p))}`}>{statusForCandidate(p)}</span>
                <span className="dash-row-menu">{icon('more_vert')}</span>
              </button>
            )) : <p className="dash-empty">Nobody is waiting on the committee.</p>}
          </div>
        </section>

        <section className="dash-card">
          <div className="dash-card-head">{icon('handshake')}<h4>Sign-offs</h4>{icon('chevron_right')}</div>
          <div className="dash-rows">
            {signoffs.length ? signoffs.map((p, index) => (
              <button key={p.id} type="button" className="dash-row" onClick={() => onOpenCandidate(p.id, 'decision')}>
                <span className={`dash-ava round ${AVATAR_TONES[(index + 2) % AVATAR_TONES.length]}`}>{initials(p.applicant_name || p.id)}</span>
                <span className="dash-row-main"><strong>{p.applicant_name || p.id}</strong><small>{decisionForCandidate(p)?.signedOffAt ? new Date(decisionForCandidate(p)!.signedOffAt as string).toLocaleDateString() : 'Signed off'}</small></span>
                <span className={`dash-tag ${decisionTone(decisionForCandidate(p)?.decision)}`}>{decisionForCandidate(p)?.decision}</span>
                <span className="dash-row-menu">{icon('more_vert')}</span>
              </button>
            )) : <p className="dash-empty">No chair recommendations yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
