import { useMemo } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { MdAssistChip, MdFilledTextField, MdIconButton, icon } from './md'

export interface HeroAction {
  label: string
  icon: string
  onClick: () => void
}

export interface HeroCardProps {
  total: number
  needsReview: number
  actions?: HeroAction[]
  title?: string
  subtitle?: string
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  onOpenWorkspace?: () => void
  searchOnly?: boolean
  footer?: ReactNode
  heading?: boolean
}

export function HeroCard({
  total,
  needsReview,
  actions = [],
  title,
  subtitle,
  searchPlaceholder = 'Search for candidates, tracks, or IDs',
  onSearch,
  onOpenWorkspace,
  searchOnly = false,
  footer,
  heading = true,
}: HeroCardProps) {
  const now = useMemo(() => new Date(), [])
  const dateLabel = `${now.getDate()} ${now.toLocaleString('en', { month: 'short' })}`
  const timeLabel = now.toLocaleString('en', { hour: 'numeric', minute: '2-digit' })

  const searchField = (
    <label className="m3-search">
      <MdFilledTextField
        placeholder={searchPlaceholder}
        style={{ width: '100%' }}
        onInput={(event: FormEvent<HTMLElement>) => onSearch?.((event.target as unknown as { value?: string }).value || '')}
      >
        <span slot="leading-icon" className="material-symbols-outlined">search</span>
      </MdFilledTextField>
    </label>
  )

  return (
    <section className="dash-hero">
      <div className={`m3-topbar ${searchOnly ? 'search-only' : ''}`}>
        {searchOnly ? searchField : (
          <>
            <span className="m3-topbar-avatar">YU</span>
            <MdAssistChip label={dateLabel}>
              <span slot="icon" className="material-symbols-outlined">calendar_month</span>
            </MdAssistChip>
            {searchField}
            <MdAssistChip label={timeLabel} />
            <MdIconButton title="Open audit workspace" onClick={() => onOpenWorkspace?.()}>{icon('edit_square')}</MdIconButton>
          </>
        )}
      </div>
      {heading && (
        <>
          <h2>{title || 'Welcome back. Today is a review day.'}</h2>
          <p>{subtitle || `Your cohort of ${total} candidate dossier${total === 1 ? '' : 's'} is waiting to be organized.`}</p>
        </>
      )}
      <div className="dash-hero-foot">
        {footer ?? (
          <>
            <div className="dash-remind">{icon('lightbulb')} Quick remind: {needsReview} candidate{needsReview === 1 ? '' : 's'} awaiting first review</div>
            <div className="dash-actions">
              {actions.map(action => (
                <button key={action.label} type="button" className="dash-action" onClick={action.onClick}>
                  <span className="dash-action-circle">{icon(action.icon)}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
