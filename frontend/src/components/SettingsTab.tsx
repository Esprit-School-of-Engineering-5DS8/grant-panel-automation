import { HeroCard } from '../m3/HeroCard'
import { useEffect, useState } from 'react'
import { notifyToast } from './ToastHost'

export interface SettingsTabProps {
  totalCandidates: number
  needsReviewCount: number
  onOpenWorkspace: () => void
  onGoTo: (tab: any) => void
  adminProfile: { name: string; email: string; avatar: string }
  onSaveProfile: (profile: { name: string; email: string; avatar: string; password?: string }) => void
  apiUrl: (path: string) => string
}

export function SettingsTab({
  totalCandidates,
  needsReviewCount,
  onOpenWorkspace,
  onGoTo,
  adminProfile,
  onSaveProfile,
  apiUrl,
}: SettingsTabProps) {
  const [name, setName] = useState(adminProfile.name)
  const [email, setEmail] = useState(adminProfile.email)
  const [avatar, setAvatar] = useState(adminProfile.avatar)
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState('')
  const groqModelOptions = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ]
  const transcriptionModelOptions = ['whisper-large-v3-turbo', 'whisper-large-v3']
  useEffect(() => { fetch(apiUrl('/api/admin/runtime-settings')).then(r => r.json()).then(data => { setModels(data); setApiKey('') }).catch(() => {}) }, [apiUrl])
  const saveProfile = () => { if (!name.trim() || !email.trim()) return notifyToast('Display name and email are required.', 'warning'); onSaveProfile({ name, email, avatar, password: password || undefined }); setPassword(''); setSaved('Profile saved'); notifyToast('Profile saved successfully.', 'success') }
  const saveRuntime = async () => { try { const response = await fetch(apiUrl('/api/admin/runtime-settings'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groq_api_key: apiKey || undefined, ...Object.fromEntries(Object.entries(models).filter(([key]) => key.startsWith('groq_') && !key.includes('configured') && !key.includes('preview'))) }) }); if (!response.ok) throw new Error(`Settings could not be saved (HTTP ${response.status}).`); setModels(await response.json()); setApiKey(''); setSaved('Project settings saved'); notifyToast('Project settings saved successfully.', 'success') } catch (error) { notifyToast(error instanceof Error ? error.message : 'Project settings could not be saved.', 'error') } }
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
        <div className="settings-grid">
          <section className="settings-card"><span className="eyebrow">Admin profile</span><h3>Profile & security</h3>
            <label className="field"><span>Display name</span><input value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="field"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label className="field"><span>Avatar URL or initials</span><input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="e.g. HM or https://…" /></label>
            <label className="field"><span>New password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep current password" /></label>
            <button className="m3-btn m3-btn-primary" onClick={saveProfile}>Save profile</button>
          </section>
          <section className="settings-card"><span className="eyebrow">Project runtime</span><h3>Groq & model configuration</h3>
            <label className="field"><span>Groq API key</span><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={models.groq_api_key_preview || 'Enter API key'} /></label>
            <label className="field"><span>Transcription model</span><select value={models.groq_transcription_model || ''} onChange={e => setModels(current => ({ ...current, groq_transcription_model: e.target.value }))}>{transcriptionModelOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
            {[['groq_cv_label_model','CV labelling model'],['groq_audit_model','Audit model'],['groq_criterion_model','Criterion model'],['groq_video_model','Video model']].map(([key,label]) => <label className="field" key={key}><span>{label}</span><select value={models[key] || ''} onChange={e => setModels(current => ({ ...current, [key]: e.target.value }))}>{groqModelOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}
            <button className="m3-btn m3-btn-primary" onClick={saveRuntime}>Save project settings</button>
            <small className="settings-note">Changes apply to new pipeline requests. The API key is never returned in full.</small>
          </section>
        </div>
        {saved && <div className="student-alert"><span className="material-symbols-outlined">check_circle</span>{saved}</div>}
      </div>
    </div>
  )
}
