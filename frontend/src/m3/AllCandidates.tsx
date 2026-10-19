import { useMemo, useState } from 'react'
import { HeroCard } from './HeroCard'
import { icon } from './md'

type AnyRecord = Record<string, any>

export interface AllCandidatesProps {
  proposals: AnyRecord[]
  statusForCandidate: (candidate: any) => string
  decisionForCandidate: (candidate: any) => { decision: string; notes?: string; score?: number; signedOffAt?: string } | undefined
  onOpenCandidate: (id: string) => void
  onAddCandidate: () => void
}

const AVATAR_TONES = ['blue', 'violet', 'amber', 'mint', 'rose', 'slate']
const STATUS_ORDER = ['Needs review', 'In review', 'Verified', 'Decision needed', 'Submitted']
const FILTER_TONES: Record<string, string> = {
  All: 'all',
  'Needs review': 'amber',
  'In review': 'blue',
  Verified: 'mint',
  'Decision needed': 'amber',
  Submitted: 'slate',
}

const initials = (value: string) => value
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase() || '')
  .join('') || '?'

const money = (value: unknown) => `$${Number(value || 0).toLocaleString()}`
const gpa = (value: unknown) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—'

const statusTone = (status: string) => ({
  'Needs review': 'amber',
  'In review': 'blue',
  Verified: 'mint',
  'Decision needed': 'amber',
  Submitted: 'slate',
} as Record<string, string>)[status] || 'slate'

const DECISION_LABELS: Record<string, string> = { FUND: 'Fund', RESERVE: 'Reserve', REJECT: 'Reject' }
const decisionTone = (decision: string) => ({ FUND: 'mint', RESERVE: 'amber', REJECT: 'rose' } as Record<string, string>)[decision] || 'slate'

export function AllCandidates({ proposals, statusForCandidate, decisionForCandidate, onOpenCandidate, onAddCandidate }: AllCandidatesProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set())

  const total = proposals.length
  const needsReview = proposals.filter(p => statusForCandidate(p) === 'Needs review').length

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: total }
    for (const status of STATUS_ORDER) map[status] = proposals.filter(p => statusForCandidate(p) === status).length
    return map
  }, [proposals, statusForCandidate, total])

  const toggleFavorite = (id: string) => setFavorites(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const q = query.trim().toLowerCase()
  const rows = proposals
    .filter(p => filter === 'All' || statusForCandidate(p) === filter)
    .filter(p => !q || [p.applicant_name, p.id, p.major, p.degree_track, p.school, DECISION_LABELS[decisionForCandidate(p)?.decision || '']].some(v => String(v || '').toLowerCase().includes(q)))

  return (
    <div className="all-candidates">
      <HeroCard
        total={total}
        needsReview={needsReview}
        onSearch={setQuery}
        onOpenWorkspace={() => proposals[0] && onOpenCandidate(proposals[0].id)}
        heading={false}
        footer={(
          <button type="button" className="dash-add-candidate" onClick={onAddCandidate}>
            {icon('person_add')} Add candidate
          </button>
        )}
      />

      <div className="cand-stack">
        <section className="cand-panel cand-filters-panel">
          <div className="cand-filters">
            <span className="cand-filters-label">Saved filters</span>
            <div className="cand-filter-chips">
              {['All', ...STATUS_ORDER].map(name => (
                <button
                  key={name}
                  type="button"
                  className={`cand-filter-chip tone-${FILTER_TONES[name] || 'slate'} ${filter === name ? 'active' : ''}`}
                  onClick={() => setFilter(name)}
                >
                  {name}<span className="cand-filter-count">{counts[name] ?? 0}</span>
                </button>
              ))}
            </div>
            <span className="cand-results">{rows.length} of {total}</span>
          </div>
        </section>

        <section className="cand-panel cand-table-panel">
          <div className="cand-table-wrap">
          <div className="cand-table">
            <div className="cand-table-head" role="row">
              <span />
              <span className="cand-th">Candidate {icon('arrow_drop_down')}</span>
              <span className="cand-th">Institution</span>
              <span className="cand-th">Track</span>
              <span className="cand-th">GPA</span>
              <span className="cand-th">Requested</span>
              <span className="cand-th">Status</span>
              <span className="cand-th">Decision</span>
              <span className="cand-th">Phone</span>
            </div>

            {rows.length === 0 ? (
              <div className="cand-table-empty">
                {icon(total === 0 ? 'inbox' : 'search_off')}
                <strong>{total === 0 ? 'No candidates submitted yet' : 'No candidates match this view'}</strong>
                <small>{total === 0 ? 'Submitted applications will appear here.' : 'Try another filter or clear the search.'}</small>
              </div>
            ) : rows.map((p, index) => {
              const name = p.applicant_name || p.id
              const status = statusForCandidate(p)
              const decision = decisionForCandidate(p)
              const starred = favorites.has(p.id)
              return (
                <div
                  key={p.id}
                  className="cand-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenCandidate(p.id)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenCandidate(p.id) } }}
                >
                  <button
                    type="button"
                    className={`cand-star ${starred ? 'on' : ''}`}
                    title={starred ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={starred}
                    onClick={event => { event.stopPropagation(); toggleFavorite(p.id) }}
                  >{icon(starred ? 'star' : 'star_border')}</button>

                  <div className="cand-cell cand-identity">
                    <span className={`cand-avatar ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>{initials(name)}</span>
                    <span className="cand-identity-main">
                      <strong>{name}</strong>
                      <small>{p.id} · {p.degree_track || p.major || 'Applicant track'}</small>
                    </span>
                  </div>
                  <div className="cand-cell">{p.school || '—'}</div>
                  <div className="cand-cell">{p.degree_track || p.major || '—'}</div>
                  <div className="cand-cell"><strong>{gpa(p.gpa)}</strong></div>
                  <div className="cand-cell">{money(p.requested_grant)}</div>
                  <div className="cand-cell"><span className={`cand-status ${statusTone(status)}`}>{status}</span></div>
                  <div className="cand-cell">
                    {decision
                      ? <span className={`cand-status ${decisionTone(decision.decision)}`}>{DECISION_LABELS[decision.decision] || decision.decision}</span>
                      : <span className="cand-status slate">Pending</span>}
                  </div>
                  <div className="cand-cell cand-muted">{p.phone || '—'}</div>
                </div>
              )
            })}
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}
