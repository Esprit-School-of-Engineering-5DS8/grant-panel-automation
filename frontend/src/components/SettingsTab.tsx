import { HeroCard } from '../m3/HeroCard'

export interface SettingsTabProps {
  totalCandidates: number
  needsReviewCount: number
  onOpenWorkspace: () => void
  onGoTo: (tab: any) => void
}

export function SettingsTab({
  totalCandidates,
  needsReviewCount,
  onOpenWorkspace,
  onGoTo,
}: SettingsTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <HeroCard
        total={totalCandidates}
        needsReview={needsReviewCount}
        title="Committee Workspace Settings"
        subtitle="Workspace preferences, committee accounts, and automated evidence audit pipeline thresholds."
        onOpenWorkspace={onOpenWorkspace}
        actions={[
          { label: 'Overview', icon: 'space_dashboard', onClick: () => onGoTo('overview') },
          { label: 'Candidates', icon: 'groups', onClick: () => onGoTo('audit') },
          { label: 'RAG rules', icon: 'policy', onClick: () => onGoTo('corpus') },
          { label: 'Decisions', icon: 'gavel', onClick: () => onGoTo('decisions') },
        ]}
      />
      <div className="admin-settings dossier-panel">
        <div className="overview-intro">
          <div>
            <span className="eyebrow">Committee workspace</span>
            <h2>Settings</h2>
            <p>Workspace preferences, committee accounts and audit pipeline configuration.</p>
          </div>
          <span className="audit-count">Active</span>
        </div>
        <div className="audit-empty">
          <span className="material-symbols-outlined">settings</span>
          <strong>Workspace settings & security</strong>
          <small>
            Committee accounts, audit token thresholds, and automated evidence models are active in this workspace.
          </small>
        </div>
      </div>
    </div>
  )
}
