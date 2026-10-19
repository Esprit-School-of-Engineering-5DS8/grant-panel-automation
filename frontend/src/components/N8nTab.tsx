import { HeroCard } from '../m3/HeroCard'

export interface N8nTabProps {
  totalCandidates: number
  needsReviewCount: number
  selectedProposal: any
  n8nTriggerLoading: boolean
  n8nTriggerResult: any
  triggerN8nWorkflow: (mode: 'test' | 'live') => void
  onOpenWorkspace: () => void
  onGoTo: (tab: any) => void
}

export function N8nTab({
  totalCandidates,
  needsReviewCount,
  selectedProposal,
  n8nTriggerLoading,
  n8nTriggerResult,
  triggerN8nWorkflow,
  onOpenWorkspace,
  onGoTo,
}: N8nTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <HeroCard
        total={totalCandidates}
        needsReview={needsReviewCount}
        title="n8n Low-Code Multi-Agent Orchestrator Bridge"
        subtitle="Triggers the live n8n workflow webhook (Stage 0 Intake → Stage 2 Deterministic → Stage 3 Parallel Agents → Stage 5 Chair)."
        onOpenWorkspace={onOpenWorkspace}
        actions={[
          { label: 'Open n8n UI', icon: 'open_in_new', onClick: () => window.open('http://localhost:5678', '_blank') },
          { label: 'Overview', icon: 'space_dashboard', onClick: () => onGoTo('overview') },
          { label: 'Candidates', icon: 'groups', onClick: () => onGoTo('audit') },
          { label: 'Decisions', icon: 'gavel', onClick: () => onGoTo('decisions') },
        ]}
      />
      <div className="m3-card">
        <div className="m3-card-title-row">
          <div>
            <h2>n8n Low-Code Multi-Agent Orchestrator Bridge</h2>
            <span className="m3-subtitle">
              Triggers the live n8n workflow webhook (Stage 0 Intake → Stage 2 Deterministic → Stage 3 Parallel Agents → Stage 5 Chair)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="m3-btn m3-btn-outlined"
              onClick={() => window.open('http://localhost:5678', '_blank')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              Open n8n Web UI
            </button>
          </div>
        </div>

        {/* Workflow Architecture Overview */}
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: 24 }}>account_tree</span>
              <strong style={{ fontSize: '0.95rem' }}>Active Workflow: workflows/grant_panel_simulator_n8n.json</strong>
            </div>
            <span className="m3-badge m3-badge-neutral" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
              Port: 5678 • Webhook Mode
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
            When triggered, n8n receives the proposal JSON via Webhook, executes deterministic code gating in pure Python/Node, fans out 3 parallel evaluation agents (Technical, Impact, Budget), detects score divergence (&ge; 2.0), and arbitrates through the Chair node.
          </p>
        </div>

        {/* Interactive Trigger Controls */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, background: '#ffffff', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Target Candidate Dossier: {selectedProposal?.applicant_name || selectedProposal?.id || 'None selected'}</strong>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                ID: {selectedProposal?.id || '—'} • Major: {selectedProposal?.major || '—'} • GPA: {selectedProposal?.gpa?.toFixed(2) || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="m3-btn m3-btn-outlined"
                onClick={() => triggerN8nWorkflow('test')}
                disabled={n8nTriggerLoading}
                style={{ fontSize: '0.8rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>science</span>
                {n8nTriggerLoading ? 'Triggering...' : 'Test Event Webhook'}
              </button>
              <button
                className="m3-btn m3-btn-primary"
                onClick={() => triggerN8nWorkflow('live')}
                disabled={n8nTriggerLoading}
                style={{ background: '#00356b', fontSize: '0.8rem' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
                {n8nTriggerLoading ? 'Executing via n8n...' : 'Trigger Production Webhook'}
              </button>
            </div>
          </div>

          {/* Execution Response Banner */}
          {n8nTriggerResult && (
            <div style={{
              background: n8nTriggerResult.success ? '#ecfdf5' : '#fffbeb',
              border: `1px solid ${n8nTriggerResult.success ? '#a7f3d0' : '#fde68a'}`,
              borderRadius: 10,
              padding: 14,
              marginTop: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="material-symbols-outlined" style={{ color: n8nTriggerResult.success ? '#059669' : '#d97706', fontSize: 20 }}>
                  {n8nTriggerResult.success ? 'check_circle' : 'info'}
                </span>
                <strong style={{ color: n8nTriggerResult.success ? '#065f46' : '#92400e', fontSize: '0.88rem' }}>
                  {n8nTriggerResult.success ? `Successfully Dispatched to n8n Webhook (${n8nTriggerResult.target_url})` : 'n8n Bridge Status'}
                </strong>
              </div>
              {n8nTriggerResult.error && (
                <div style={{ color: '#b45309', fontSize: '0.8rem', marginBottom: 4 }}>
                  {n8nTriggerResult.error}
                </div>
              )}
              {n8nTriggerResult.hint && (
                <div style={{ color: '#78350f', fontSize: '0.76rem', fontStyle: 'italic' }}>
                  💡 Tip: {n8nTriggerResult.hint}
                </div>
              )}
              {n8nTriggerResult.result && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: '0.78rem', color: '#065f46', cursor: 'pointer', fontWeight: 700 }}>View n8n Pipeline Output Payload</summary>
                  <pre style={{ background: '#ffffff', padding: 10, borderRadius: 8, marginTop: 6, fontSize: '0.72rem', overflowX: 'auto', border: '1px solid #cbd5e1' }}>
                    {JSON.stringify(n8nTriggerResult.result, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* 5-Stage Orchestration Trace Visualizer */}
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12, color: '#334155' }}>End-to-End n8n Orchestrated Pipeline Graph</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { step: 'Stage 0', title: 'Webhook Trigger', desc: 'POST /submit-proposal accepts candidate dossier', icon: 'input' },
            { step: 'Stage 2', title: 'Deterministic Gate', desc: 'Checks GPA >= 3.0 & $2.5k tech cap', icon: 'verified' },
            { step: 'Stage 3', title: '3 Parallel Agents', desc: 'Technical, Impact & Budget evaluators', icon: 'group_work' },
            { step: 'Stage 4', title: 'Disagreement Check', desc: 'Detects divergence >= 2.0 pts', icon: 'alt_route' },
            { step: 'Stage 5', title: 'Chair ESR', desc: 'Hierarchical arbitration & final letter', icon: 'gavel' },
          ].map((node) => (
            <div key={node.step} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#ffffff', textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', color: '#00356b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{node.icon}</span>
              </div>
              <span className="m3-badge m3-badge-neutral" style={{ fontSize: '0.68rem', marginBottom: 4 }}>{node.step}</span>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', marginTop: 4 }}>{node.title}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>{node.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
