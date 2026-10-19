import { useState } from 'react'
import { HeroCard } from './HeroCard'
import { icon } from './md'

type AnyRecord = Record<string, any>

export interface TalentPoolProps {
  proposals: AnyRecord[]
  statusForCandidate: (candidate: any) => string
  onOpenCandidate: (id: string) => void
  onGoTo?: (tab: string) => void
}

const AVATAR_TONES = ['blue', 'violet', 'amber', 'mint', 'rose', 'slate']

const initials = (value: string) => value
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase() || '')
  .join('') || '?'

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = value.find(item => typeof item === 'string' && item.trim())
      if (found) return found as string
    } else if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return ''
}

const excerpt = (value: string, max = 168) => {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean
}

export function TalentPool({ proposals, statusForCandidate, onOpenCandidate, onGoTo }: TalentPoolProps) {
  const [query, setQuery] = useState('')
  const total = proposals.length
  const needsReview = proposals.filter(p => statusForCandidate(p) === 'Needs review').length

  const q = query.trim().toLowerCase()
  const pool = proposals.filter(p => {
    if (!q) return true
    const name = p.applicant_name || p.id
    const role = p.degree_track || p.major || ''
    const school = p.school || ''
    return [name, role, school, p.id].some(v => String(v).toLowerCase().includes(q))
  })

  return (
    <div className="talent-pool">
      <HeroCard
        total={total}
        needsReview={needsReview}
        title="Talent pools & candidate cohorts"
        subtitle="Every fellowship candidate in one place. Open any profile to inspect evidence and run the live audit pipeline."
        onSearch={setQuery}
        onOpenWorkspace={() => proposals[0] && onOpenCandidate(proposals[0].id)}
        actions={[
          { label: 'All candidates', icon: 'groups', onClick: () => onGoTo ? onGoTo('audit') : undefined },
          { label: 'RAG rules', icon: 'policy', onClick: () => onGoTo ? onGoTo('corpus') : undefined },
        ]}
      />

      {pool.length === 0 ? (
        <div className="talent-pool-empty">
          {icon('group_off')}
          <strong>{total === 0 ? 'No candidates in the pool yet' : 'No candidates match your search'}</strong>
          <small>{total === 0 ? 'Submitted applications will appear here as talent profiles.' : 'Try adjusting the search query.'}</small>
        </div>
      ) : (
        <div className="talent-grid">
          {pool.map((p, index) => {
            const name = p.applicant_name || p.id
            const role = p.degree_track || p.major || 'Applicant track'
            const description = excerpt(firstText(
              p.sections?.abstract,
              p.purpose_statement,
              p.academic_experiences,
              p.sections?.impact_and_dissemination,
              'Fellowship candidate profile pending a narrative summary.',
            ))
            return (
              <button
                key={p.id}
                type="button"
                className="talent-card"
                onClick={() => onOpenCandidate(p.id)}
                title={`Open ${name} in the audit workspace`}
              >
                <span className="talent-card-top">
                  <span className={`talent-avatar ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>{initials(name)}</span>
                  <span className="talent-card-open">{icon('arrow_outward')}</span>
                </span>
                <span className="talent-card-body">
                  <strong className="talent-card-name">{name}</strong>
                  <span className="talent-card-role">{role}</span>
                  <span className="talent-card-school">{p.school || 'Institution pending'}</span>
                  <p className="talent-card-desc">{description}</p>
                </span>
                <span className="talent-card-foot">
                  <span className="talent-card-id">{p.id}</span>
                  <span className="talent-card-status">{statusForCandidate(p)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
