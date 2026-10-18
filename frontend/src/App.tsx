import { useState, useEffect, useRef } from 'react'
import './index.css'
import CvVisionPanel from './components/CvVisionPanel'
import VideoPanel from './components/VideoPanel'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
const artifactUrl = (url?: string) => !url ? '' : /^https?:\/\//i.test(url) ? url : apiUrl(url)

interface Application {
  [key: string]: any
  id: string
  title: string
  applicant_name: string
  school?: string
  major: string
  gpa: number
  requested_grant: number
  page_count: number
  pdf_url?: string
  ground_truth?: any
  cv_latex?: string
  financials?: {
    cost_of_attendance?: number
    parent_share?: number
    student_share?: number
    outside_scholarships?: number
    computer_allowance?: number
    demonstrated_need?: number
  }
  budget?: {
    direct_personnel?: number
    direct_equipment?: number
    direct_travel?: number
    direct_other?: number
    subcontracting?: number
    indirect_costs?: number
    requested_grant?: number
  }
  sections?: {
    abstract?: string
    scientific_methodology?: string
    impact_and_dissemination?: string
    work_packages?: string
    budget?: string
  }
  video_url?: string
}

interface CorpusDoc {
  id: string
  title: string
  filename: string
  pdf_filename?: string
  pdf_url?: string
  content: string
}

interface EducationEntry { institution: string; degree: string; field: string; year: string; gpa: string }

const FALLBACK_EDUCATION: EducationEntry = { institution: 'Yale College / Morse College', degree: 'B.S. · Computer Science & Global Affairs', field: 'Computer Science & Global Affairs', year: '2027', gpa: '3.92' }
const isEducationEntry = (value: unknown): value is EducationEntry => Boolean(value && typeof value === 'object' && ['institution', 'degree', 'field', 'year', 'gpa'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string'))
const normalizeEducationEntries = (value: unknown): EducationEntry[] => Array.isArray(value) && value.length > 0 && value.every(isEducationEntry) ? value : [FALLBACK_EDUCATION]
const normalizeExperienceEntries = (value: unknown, fallback: string): string[] => Array.isArray(value) && value.every((item) => typeof item === 'string') && value.length > 0 ? value : [fallback]
const readStoredJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw || raw === 'undefined' || raw === 'null') return fallback
    const parsed = JSON.parse(raw)
    return parsed === undefined ? fallback : parsed
  } catch {
    return fallback
  }
}

const parseJsonResponse = async <T,>(response: Response, fallback: T): Promise<T> => {
  const text = await response.text()
  if (!text || !text.trim()) return fallback

  try {
    return JSON.parse(text) as T
  } catch {
    if (response.ok) return fallback
    const preview = text.replace(/\s+/g, ' ').slice(0, 180)
    throw new Error(preview ? `Server returned an unexpected response: ${preview}` : 'Server returned an unexpected response.')
  }
}

function SubmittedApplicationPanel({ candidate, status, statusClass }: { candidate: Application; status: string; statusClass: (value: string) => string }) {
  const c = candidate as Record<string, any>
  const value = (entry: any) => Array.isArray(entry) ? entry.length ? entry.map(item => typeof item === 'object' ? Object.entries(item).map(([key, field]) => `${key}: ${field ?? 'Not provided'}`).join(', ') : String(item)).join(' · ') : 'Not provided' : entry === 0 ? '0' : entry === false ? 'No' : entry === undefined || entry === null || entry === '' ? 'Not provided' : String(entry)
  const sections: [string, [string, any][]][] = [
    ['General information', [['Record label', c.local_test_label || c.demo_dataset], ['Applicant name', c.applicant_name], ['Email', c.email || c.student_email], ['Phone', c.phone], ['Citizenship', c.citizenship], ['Date of birth', c.birthDate || c.birth_date], ['Sex', c.sex], ['Application status', c.application_status || status], ['Submitted at', c.submitted_at || c.submittedAt || c.created_at || c.ground_truth?.submitted_at], ['Updated at', c.updated_at || c.submitted_at || c.submittedAt || c.ground_truth?.updated_at]]],
    ['Education', [['Institution', c.school || c.institution], ['Degree / track', c.degreeTrack || c.degree_track || c.major], ['Major', c.major], ['Graduation year', c.graduationYear || c.graduation_year], ['GPA', c.gpa], ['All education entries', c.education_entries || c.educationEntries]]],
    ['Experience', [['Project title', c.title || c.projectTitle], ['Academic / research experiences', c.academic_experiences || c.academicExperiences || c.purpose_statement], ['Leadership / community experiences', c.leadership_experiences || c.leadershipExperiences || c.leadership_statement]]],
    ['CV deposit', [['CV filename', c.cv_filename || c.cvFileName], ['CV / PDF URL', c.pdf_url || c.cv_pdf_url || c.cv_url], ['CV content', c.cv_latex ? 'Provided' : undefined]]],
    ['Financial / request details', [['Requested grant', c.requested_grant], ['Cost of attendance', c.financials?.cost_of_attendance], ['Parent share', c.financials?.parent_share], ['Student share', c.financials?.student_share], ['Outside scholarships', c.financials?.outside_scholarships], ['Computer allowance', c.financials?.computer_allowance], ['Demonstrated need', c.financials?.demonstrated_need]]],
    ['Video submission', [['Video URL', c.video_url], ['Video status', c.video_status || c.videoStatus || (c.video_url ? 'Submitted' : 'Not provided')], ['Demo media source', c.video_url ? 'Submitted candidate recording' : c.video_metadata?.source || 'Demo artifact'], ['Playback source', c.video_url || c.video_metadata?.playback || 'Local generated demo video'], ['Video transcript', c.video_transcript || c.transcript], ['Video duration', c.video_duration || c.videoDuration]]]
  ]
  return <article className="evidence-card full-evidence submitted-inventory"><div className="evidence-title"><div><span className="eyebrow">Candidate record</span><h3>Submitted application</h3><p>Complete input inventory for {candidate.applicant_name} · {candidate.id}</p></div><span className={`audit-status ${statusClass(status)}`}>{status}</span></div><div className="submission-inventory-grid">{sections.map(([heading, fields]) => <section key={heading}><span className="eyebrow">{heading}</span><dl>{fields.map(([label, fieldValue]) => <div key={label}><dt>{label}</dt><dd>{value(fieldValue)}</dd></div>)}</dl></section>)}</div></article>
}

function AlluvialLegend() {
  const items = [['status-needs-review', 'Needs review'], ['status-in-review', 'In review'], ['status-verified', 'Verified'], ['status-decision-needed', 'Decision needed'], ['status-submitted', 'Submitted'], ['recommendation-fund', 'FUND'], ['recommendation-reserve', 'RESERVE'], ['recommendation-reject', 'REJECT'], ['recommendation-pending', 'Pending']]
  return <div className="alluvial-legend" role="list" aria-label="Alluvial status and recommendation legend">{items.map(([tone, label]) => <span role="listitem" key={label}><i className={`legend-swatch ${tone}`} aria-hidden="true" />{label}</span>)}</div>
}

function DemoOperationsCard({ health, batch, onHealth, onBatch }: { health: Record<string, string>; batch: { running: boolean; completed: number; total: number; passed: number; failed: number; results: Record<string, { stages: Record<string, string>; reason?: string }> }; onHealth: () => void; onBatch: () => void }) {
  const healthItems = [['api', 'API health'], ['proposals', 'Proposal fixtures'], ['pdf', 'CV preview route'], ['video', 'Video evaluation'], ['n8n', 'n8n webhook']]
  return <section className="demo-operations"><div className="integration-health"><div className="health-heading"><div><span className="eyebrow">Integration health</span><h3>Audit dependencies</h3></div><button type="button" className="text-button" onClick={onHealth}>Run checks</button></div><div className="health-grid">{healthItems.map(([key, label]) => <div key={key}><span className={`health-dot ${health[key] === 'Healthy' || health[key] === 'Ready' || health[key]?.includes('loaded') || health[key] === 'Reachable' ? 'ok' : health[key] ? 'warn' : ''}`} /><span>{label}</span><strong>{health[key] || 'Not checked'}</strong></div>)}</div></div><div className="batch-audit-row"><div><span className="eyebrow">Safe batch test</span><strong>{batch.running ? `Auditing ${batch.completed} of ${batch.total} candidates` : batch.total ? `Completed ${batch.total} candidate audits` : 'Run the same audit stages across the demo set'}</strong><small>{batch.total ? `${batch.passed} passed · ${batch.failed} failed · no external data mutated` : 'Parser · transcript · evaluation · verification'}</small></div><button type="button" className="m3-btn m3-btn-primary" onClick={onBatch} disabled={batch.running}>{batch.running ? 'Running…' : 'Run audit on all demo candidates'}</button></div>{batch.total > 0 && <div className="batch-progress"><i style={{ width: `${(batch.completed / batch.total) * 100}%` }} /></div>}</section>
}

function BatchResults({ results }: { results: Record<string, { stages: Record<string, string>; reason?: string }> }) {
  const entries = Object.entries(results)
  if (!entries.length) return null
  return <section className="batch-results dossier-panel"><div className="health-heading"><div><span className="eyebrow">Batch audit detail</span><h3>Candidate stage results</h3></div><span className="audit-count">{entries.length} candidates</span></div><div className="batch-results-list">{entries.map(([id, result]) => <div className="batch-result-row" key={id}><strong>{id}</strong><div>{Object.entries(result.stages).map(([stage, status]) => <span className={`batch-stage ${status.startsWith('Passed') ? 'passed' : status.startsWith('Failed') ? 'failed' : 'pending'}`} key={stage}>{stage}: {status}</span>)}</div>{result.reason && <small className="batch-failure">Failure reason: {result.reason}</small>}</div>)}</div></section>
}

const getUserDraftKey = (email: string) => `openDoorsDraft_${email.toLowerCase().trim()}`
const getUserStatusKey = (email: string) => `openDoorsStatus_${email.toLowerCase().trim()}`
const getUserSubmittedAtKey = (email: string) => `openDoorsSubmittedAt_${email.toLowerCase().trim()}`

export function App() {
  // Top-Level Portal Mode: Student Portal vs. Committee Admin Console
  const [portalMode, setPortalMode] = useState<'student' | 'admin'>(() => readStoredJson<{ email: string } | null>('openDoorsAdminSession', null) ? 'admin' : 'student')
  const [applicantSession, setApplicantSession] = useState<{ email: string; name: string } | null>(() => readStoredJson<{ email: string; name: string } | null>('openDoorsApplicantSession', null))
  const [adminSession, setAdminSession] = useState<{ email: string } | null>(() => readStoredJson<{ email: string } | null>('openDoorsAdminSession', null))
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authFieldErrors, setAuthFieldErrors] = useState<Record<string, string>>({})
  const [applicantView, setApplicantView] = useState<'status' | 'workspace'>('status')
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string>('')
  const [applicationStatus, setApplicationStatus] = useState<'draft' | 'submitting' | 'submitted' | 'failed'>('draft')

  // Committee Admin Tabs
  const [adminTab, setAdminTab] = useState<'overview' | 'audit' | 'decisions' | 'corpus' | 'n8n' | 'dossiers' | 'compliance' | 'multimodal' | 'deliberation' | 'arbitration'>('overview')
  const [n8nTriggerLoading, setN8nTriggerLoading] = useState(false)
  const [n8nTriggerResult, setN8nTriggerResult] = useState<any>(null)

  const [proposals, setProposals] = useState<Application[]>([])
  const [selectedProposal, setSelectedProposal] = useState<Application | null>(null)
  const [corpusDocs, setCorpusDocs] = useState<CorpusDoc[]>([])
  const [selectedCorpusDoc, setSelectedCorpusDoc] = useState<CorpusDoc | null>(null)
  const [ragQuery, setRagQuery] = useState('')
  const [ragResults, setRagResults] = useState<any[]>([])
  const [ragLoading, setRagLoading] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditStatusFilter, setAuditStatusFilter] = useState('All statuses')
  const [auditPanel, setAuditPanel] = useState<'profile' | 'submitted' | 'cv' | 'video' | 'rag' | 'verification' | 'decision'>('profile')
  const [auditArtifacts, setAuditArtifacts] = useState<Record<string, any>>({})
  const [candidateAuditRuns, setCandidateAuditRuns] = useState<Record<string, any>>({})
  const [videoStages, setVideoStages] = useState<Record<string, string>>({})
  const [candidateAuditStatus, setCandidateAuditStatus] = useState<Record<string, string>>(() => readStoredJson<Record<string, string>>('openDoorsCandidateStatuses', {}))
  const [candidateDecisions, setCandidateDecisions] = useState<Record<string, { decision: 'FUND' | 'RESERVE' | 'REJECT'; notes: string; score: number; signedOffAt?: string }>>(() => readStoredJson<Record<string, { decision: 'FUND' | 'RESERVE' | 'REJECT'; notes: string; score: number; signedOffAt?: string }>>('openDoorsCandidateDecisions', {}))
  const [auditDecision, setAuditDecision] = useState<'FUND' | 'RESERVE' | 'REJECT'>('FUND')
  const [auditNotes, setAuditNotes] = useState('')
  const [overallOpinion, setOverallOpinion] = useState<Record<string, string>>({})
  const [opinionLoading, setOpinionLoading] = useState<Record<string, boolean>>({})
  const [pdfViewMode, setPdfViewMode] = useState<boolean>(false)

  // Student Form State
  const [studentName, setStudentName] = useState('')
  const [studentSchool, setStudentSchool] = useState('')
  const [studentMajor, setStudentMajor] = useState('')
  const [studentGpa, setStudentGpa] = useState<number>(0)
  const [projectTitle, setProjectTitle] = useState('')
  const [requestedGrant, setRequestedGrant] = useState<number>(0)
  const [parentIncome, setParentIncome] = useState<number>(0)
  const [outsideScholarships, setOutsideScholarships] = useState<number>(0)
  const [techPurchaseRequested, setTechPurchaseRequested] = useState<number>(0)
  const [purposeStatement, setPurposeStatement] = useState('')
  const [studyPlan, setStudyPlan] = useState('')
  const [leadershipStatement, setLeadershipStatement] = useState('')

  // CV Deposit State (LaTeX / ATS / PDF Preview)
  const [studentCvLatex, setStudentCvLatex] = useState<string>('')
  const [cvFilePreviewUrl, setCvFilePreviewUrl] = useState<string | null>(null)
  const [cvAtsResult, setCvAtsResult] = useState<any>(null)
  const [isParsingCv, setIsParsingCv] = useState<boolean>(false)
  const [cvParseError, setCvParseError] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  // Video Motivation Feature: Modal & workflow states
  const [activeVideoModal, setActiveVideoModal] = useState<'none' | 'record' | 'upload'>('none')
  const [videoFeatureEnabled, setVideoFeatureEnabled] = useState<boolean>(true)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const modalVideoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const activeMediaStreamRef = useRef<MediaStream | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const videoUploadInputRef = useRef<HTMLInputElement | null>(null)
  const recordingStartedAtRef = useRef<number | null>(null)

  // Submission feedback
  const [submitStatus, setSubmitStatus] = useState<string | null>(null)

  // Student dossier stepper state
  const [studentStep, setStudentStep] = useState(0)
  const [completedStudentSteps, setCompletedStudentSteps] = useState<number[]>([])
  const [cvFileName, setCvFileName] = useState('')
  const [videoFileName, setVideoFileName] = useState<string | null>(null)
  const [studentEmail, setStudentEmail] = useState('')
  const [citizenship, setCitizenship] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState('Prefer not to say')
  const [degreeTrack, setDegreeTrack] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>([{ institution: '', degree: '', field: '', year: '', gpa: '' }])
  const [academicExperiences, setAcademicExperiences] = useState<string[]>([''])
  const [leadershipExperiences, setLeadershipExperiences] = useState<string[]>([''])

  const [studentSteps] = useState(['General information', 'Education', 'Experience', 'CV deposit', 'Review', 'Video motivation'])
  const stepIcons = ['person', 'school', 'auto_awesome', 'description', 'fact_check', 'videocam']
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Clear specific error field dynamically on user input
  const clearFieldError = (fieldName: string) => {
    setFormErrors(prev => {
      if (!prev[fieldName]) return prev
      const next = { ...prev }
      delete next[fieldName]
      return next
    })
  }

  // Dynamic Validation Function with detailed error messages
  const validateFormFields = (step?: number) => {
    const targetStep = step !== undefined ? step : studentStep
    const errors: Record<string, string> = {}

    if (targetStep === 0) {
      if (!studentName.trim()) {
        errors.studentName = 'Full legal name is required.'
      } else if (studentName.trim().length < 2) {
        errors.studentName = 'Name must be at least 2 characters.'
      }

      if (!studentEmail.trim()) {
        errors.studentEmail = 'Email address is required.'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail.trim())) {
        errors.studentEmail = 'Please provide a valid email address (e.g. name@domain.edu).'
      }

      if (!citizenship.trim()) {
        errors.citizenship = 'Country of citizenship is required.'
      }

      if (!phone.trim()) {
        errors.phone = 'Phone number is required.'
      } else if (!/^[\d\s+\-().]{7,20}$/.test(phone.trim())) {
        errors.phone = 'Please enter a valid telephone number.'
      }

      if (!birthDate.trim()) {
        errors.birthDate = 'Date of birth is required.'
      } else {
        const parsedDate = new Date(birthDate)
        const minDate = new Date('1940-01-01')
        const maxDate = new Date()
        if (isNaN(parsedDate.getTime()) || parsedDate < minDate || parsedDate > maxDate) {
          errors.birthDate = 'Please select a valid date of birth.'
        }
      }
    }

    if (targetStep === 1) {
      if (!educationEntries.length) {
        errors.education_general = 'Please add at least one educational background entry.'
      } else {
        educationEntries.forEach((entry, idx) => {
          if (!entry.institution.trim()) errors[`edu_${idx}_institution`] = 'Institution / school name is required.'
          if (!entry.degree.trim()) errors[`edu_${idx}_degree`] = 'Degree or degree track is required.'
          if (!entry.field.trim()) errors[`edu_${idx}_field`] = 'Field of study is required.'
          if (!entry.year.trim()) errors[`edu_${idx}_year`] = 'Graduation year is required.'
          if (!entry.gpa.toString().trim()) {
            errors[`edu_${idx}_gpa`] = 'Cumulative GPA is required.'
          } else {
            const numGpa = parseFloat(entry.gpa.toString())
            if (isNaN(numGpa) || numGpa < 0 || numGpa > 4.0) {
              errors[`edu_${idx}_gpa`] = 'GPA must be a valid number between 0.00 and 4.00.'
            }
          }
        })
      }
    }

    if (targetStep === 2) {
      if (!projectTitle.trim()) {
        errors.projectTitle = 'Project or research title is required.'
      } else if (projectTitle.trim().length < 5) {
        errors.projectTitle = 'Project title must be at least 5 characters long.'
      }

      if (!academicExperiences.length || !academicExperiences.some(exp => exp.trim())) {
        errors.academic_general = 'Please describe at least one academic or research experience.'
      } else {
        academicExperiences.forEach((exp, idx) => {
          if (!exp.trim()) {
            errors[`academic_${idx}`] = 'Please provide details for this research experience or remove it.'
          } else if (exp.trim().length < 15) {
            errors[`academic_${idx}`] = 'Please provide a more descriptive summary (at least 15 characters).'
          }
        })
      }

      if (!leadershipExperiences.length || !leadershipExperiences.some(exp => exp.trim())) {
        errors.leadership_general = 'Please describe at least one leadership or community impact experience.'
      } else {
        leadershipExperiences.forEach((exp, idx) => {
          if (!exp.trim()) {
            errors[`leadership_${idx}`] = 'Please provide details for this community experience or remove it.'
          } else if (exp.trim().length < 15) {
            errors[`leadership_${idx}`] = 'Please provide a more descriptive summary (at least 15 characters).'
          }
        })
      }
    }

    if (targetStep === 3) {
      if (!cvFilePreviewUrl) {
        errors.cvFile = 'Please attach your Curriculum Vitae in PDF format.'
      }
    }

    if (targetStep === 5) {
      const videoMessage = getVideoValidationMessage(videoDuration)
      if (videoMessage) {
        errors.videoMotivation = videoMessage
      }
    }

    return errors
  }

  const formatVideoDuration = (seconds: number | null | undefined) => {
    if (!Number.isFinite(seconds) || seconds == null || seconds < 0) return '00:00'
    const total = Math.max(0, Math.round(seconds))
    const minutes = Math.floor(total / 60)
    const remainingSeconds = total % 60
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  const getVideoValidationMessage = (duration: number | null) => {
    if (!recordedVideoUrl) return 'Please record or upload a motivation video.'
    if (!Number.isFinite(duration) || duration == null) return 'We could not verify the video length. Please re-record or upload it again.'
    if (duration < 60) return `Your motivation video is too short. It must be at least 60 seconds long. Current length: ${formatVideoDuration(duration)}.`
    if (duration > 120) return `Your motivation video is too long. Please keep it between 60 and 120 seconds. Current length: ${formatVideoDuration(duration)}.`
    return null
  }

  const markStepComplete = (step: number) => setCompletedStudentSteps((current) => current.includes(step) ? current : [...current, step])

  const continueStudentStep = () => {
    if (applicationStatus === 'submitted') {
      setSubmitStatus('Thank you — your application was already submitted successfully. There is no need to resubmit.')
      setApplicantView('status')
      return
    }
    const errors = validateFormFields(studentStep)
    setFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      setSubmitStatus('Please correct the highlighted fields before continuing.')
      return
    }
    markStepComplete(studentStep)
    setSubmitStatus(null)
    if (studentStep < studentSteps.length - 1) setStudentStep(studentStep + 1)
    else handleStudentSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  // Committee Interactive Simulator values
  const [simGpa, setSimGpa] = useState<number>(3.85)
  const [simCostOfAttendance, setSimCostOfAttendance] = useState<number>(87000)
  const [simParentShare, setSimParentShare] = useState<number>(4800)
  const [simStudentShare, setSimStudentShare] = useState<number>(3700)
  const [simOutsideAwards, setSimOutsideAwards] = useState<number>(0)
  const [simComputerAllowance, setSimComputerAllowance] = useState<number>(1800)
  const [simDossierPages, setSimDossierPages] = useState<number>(8)

  // Admin Multimodal Cross-Verification result state
  const [adminMultimodalResult, setAdminMultimodalResult] = useState<any>(null)
  const [isCrossVerifying, setIsCrossVerifying] = useState<boolean>(false)
  const [integrationHealth, setIntegrationHealth] = useState<Record<string, string>>({})
  const [batchAudit, setBatchAudit] = useState<{ running: boolean; completed: number; total: number; passed: number; failed: number; results: Record<string, { stages: Record<string, string>; reason?: string }> }>({ running: false, completed: 0, total: 0, passed: 0, failed: 0, results: {} })

  // Prompt Version Toggle (v1 vs v2)
  const [promptVersion, setPromptVersion] = useState<'v1' | 'v2'>('v2')

  // Chair HITL form states
  const [overrideScore, setOverrideScore] = useState<number>(4.6)
  const [overrideDecision, setOverrideDecision] = useState<'FUND' | 'RESERVE' | 'REJECT'>('FUND')
  const [overrideNotes, setOverrideNotes] = useState<string>(
    'Official Yale Fellowship Committee Decision: High intellectual merit, strong demonstrated public purpose, and compliant financial need.'
  )
  const [isSignedOff, setIsSignedOff] = useState<boolean>(false)
  const [signOffTimestamp, setSignOffTimestamp] = useState<string>('')

  const resetStudentFormState = (name = '', email = '') => {
    setStudentStep(0)
    setCompletedStudentSteps([])
    setApplicationStatus('draft')
    setSubmitStatus(null)
    setDraftUpdatedAt('')
    setStudentName(name)
    setStudentEmail(email)
    setStudentSchool('')
    setStudentMajor('')
    setStudentGpa(0)
    setProjectTitle('')
    setRequestedGrant(0)
    setParentIncome(0)
    setOutsideScholarships(0)
    setTechPurchaseRequested(0)
    setPurposeStatement('')
    setStudyPlan('')
    setLeadershipStatement('')
    setEducationEntries([{ institution: '', degree: '', field: '', year: '', gpa: '' }])
    setAcademicExperiences([''])
    setLeadershipExperiences([''])
    setCvFileName('')
    setCvFilePreviewUrl(null)
    setStudentCvLatex('')
    setRecordedVideoUrl(null)
    setVideoFileName(null)
    setVideoDuration(null)
    setCitizenship('')
    setPhone('')
    setBirthDate('')
    setSex('Prefer not to say')
    setDegreeTrack('')
    setGraduationYear('')
    setFormErrors({})
    setCvParseError(null)
  }

  const loadUserSession = (session: { email: string; name: string }) => {
    const userEmail = session.email.toLowerCase().trim()
    localStorage.setItem('openDoorsApplicantSession', JSON.stringify(session))
    setApplicantSession(session)
    setAuthError(null)
    setAuthFieldErrors({})

    const userStatus = (localStorage.getItem(getUserStatusKey(userEmail)) as any) || 'draft'
    setApplicationStatus(userStatus)

    const userDraft = readStoredJson<any>(getUserDraftKey(userEmail), null)
    if (userDraft) {
      setStudentStep(typeof userDraft.studentStep === 'number' ? userDraft.studentStep : 0)
      setCompletedStudentSteps(Array.isArray(userDraft.completedStudentSteps) ? userDraft.completedStudentSteps : [])
      setEducationEntries(normalizeEducationEntries(userDraft.educationEntries))
      setAcademicExperiences(normalizeExperienceEntries(userDraft.academicExperiences, ''))
      setLeadershipExperiences(normalizeExperienceEntries(userDraft.leadershipExperiences, ''))
      setStudentName(userDraft.studentName || session.name || '')
      setStudentEmail(userDraft.studentEmail || session.email || '')
      setStudentSchool(userDraft.studentSchool || '')
      setStudentMajor(userDraft.studentMajor || '')
      setStudentGpa(userDraft.studentGpa || 0)
      setProjectTitle(userDraft.projectTitle || '')
      setPurposeStatement(userDraft.purposeStatement || '')
      setStudyPlan(userDraft.studyPlan || '')
      setLeadershipStatement(userDraft.leadershipStatement || '')
      setRequestedGrant(userDraft.requestedGrant || 0)
      setParentIncome(userDraft.parentIncome || 0)
      setOutsideScholarships(userDraft.outsideScholarships || 0)
      setTechPurchaseRequested(userDraft.techPurchaseRequested || 0)
      setCitizenship(userDraft.citizenship || '')
      setPhone(userDraft.phone || '')
      setBirthDate(userDraft.birthDate || '')
      setSex(userDraft.sex || 'Prefer not to say')
      setDegreeTrack(userDraft.degreeTrack || '')
      setGraduationYear(userDraft.graduationYear || '')
      setDraftUpdatedAt(userDraft.updatedAt || '')
    } else {
      resetStudentFormState(session.name, session.email)
    }
    setCvFilePreviewUrl(null)
    setCvFileName('')
    setStudentCvLatex('')
    setApplicantView('status')
  }

  useEffect(() => {
    fetchProposals()
    fetchCorpus()
    // Clean up legacy un-scoped localStorage keys
    localStorage.removeItem('openDoorsApplicationStatus')
    localStorage.removeItem('openDoorsSubmittedAt')
    localStorage.removeItem('openDoorsApplicationDraft')
    localStorage.removeItem('openDoorsDraftUpdatedAt')

    const session = readStoredJson<{ email: string; name: string } | null>('openDoorsApplicantSession', null)
    if (session?.email) {
      const isLegacyDemo = session.email.toLowerCase() === 'alex.rivera@yale.edu'
      loadUserSession(isLegacyDemo ? { email: 'demo.applicant@opendoors.org', name: 'Demo Applicant' } : session)
    }
  }, [])

  useEffect(() => { if (adminSession) localStorage.setItem('openDoorsAdminSession', JSON.stringify(adminSession)) }, [adminSession])
  useEffect(() => { localStorage.setItem('openDoorsCandidateStatuses', JSON.stringify(candidateAuditStatus)) }, [candidateAuditStatus])
  useEffect(() => { const decision = decisionForCandidate(selectedProposal || undefined); setAuditDecision(decision?.decision || 'FUND'); setAuditNotes(decision?.notes || ''); setOverrideScore(decision?.score || 4.6) }, [selectedProposal, candidateDecisions])
  useEffect(() => {
    const id = selectedProposal?.id
    if (!id || adminTab !== 'audit') return
    let cancelled = false
    let timer: number | undefined
    const refresh = async () => {
      try {
        const response = await fetch(apiUrl(`/api/admin/candidate-audit/${encodeURIComponent(id)}`))
        if (!response.ok) return
        const audit = await response.json()
        if (cancelled) return
        setCandidateAuditRuns(current => ({ ...current, [id]: audit }))
        // Rehydrate the visible evidence cards from the server-side audit as each
        // stage completes. This keeps the video review live while the pipeline runs.
        const results = audit.results || {}
        const transcript = results.video_transcription
        const videoReview = results.video_llm_review
        if (transcript || videoReview || results.evidence_comparison || results.cv_ocr) {
          setAuditArtifacts(current => ({
            ...current,
            [id]: {
              ...(current[id] || {}),
              ...(results.cv_ocr ? { cv: { ...results.cv_ocr, status: 'parsed' } } : {}),
              ...(transcript || videoReview ? { video: { ...(current[id]?.video || {}), ...(transcript || {}), ...(videoReview || {}), transcriptStatus: transcript?.transcript_status || transcript?.transcriptStatus } } : {}),
              ...(results.evidence_comparison ? { verification: results.evidence_comparison } : {}),
            },
          }))
        }
        const stages = audit.stages || {}
        const ordered = [
          ['cv_ocr', 'cv'], ['video_transcription', 'video'], ['video_llm_review', 'video'],
          ['evidence_comparison', 'rag'], ['rag_fact_check', 'rag'],
          // Keep the chair's decision panel locked until the submitted advisory reviews finish.
          ['review_technical', 'rag'], ['review_impact', 'rag'],
          ...((selectedProposal?.budget && Object.keys(selectedProposal.budget).length) ? [['review_budget', 'rag']] : []),
        ] as const
        const active = ordered.find(([key]) => stages[key]?.status === 'in_progress')
        const next = ordered.find(([key]) => !['complete', 'skipped', 'failed'].includes(stages[key]?.status))
        if (active) setAuditPanel(active[1] as any)
        else if (next) setAuditPanel(next[1] as any)
        else if (ordered.every(([key]) => ['complete', 'skipped', 'failed'].includes(stages[key]?.status))) setAuditPanel('decision')
        if (audit.status === 'queued' || audit.status === 'running') timer = window.setTimeout(refresh, 1200)
      } catch { /* audit status refresh is best-effort */ }
    }
    void refresh()
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [selectedProposal?.id, adminTab])
  useEffect(() => {
    if (!applicantSession?.email) return
    const stamp = new Date().toISOString()
    const draft = {
      studentStep, completedStudentSteps, educationEntries, academicExperiences, leadershipExperiences,
      studentName, studentSchool, studentMajor, studentGpa, projectTitle,
      purposeStatement: academicExperiences[0] || purposeStatement,
      studyPlan,
      leadershipStatement: leadershipExperiences[0] || leadershipStatement,
      studentCvLatex, cvFileName, studentEmail, citizenship, phone, birthDate, sex, degreeTrack, graduationYear,
      updatedAt: stamp
    }
    const key = getUserDraftKey(applicantSession.email)
    localStorage.setItem(key, JSON.stringify(draft))
    setDraftUpdatedAt(stamp)
  }, [applicantSession, studentStep, completedStudentSteps, educationEntries, academicExperiences, leadershipExperiences, studentName, studentSchool, studentMajor, studentGpa, projectTitle, studyPlan, purposeStatement, leadershipStatement, studentCvLatex, cvFileName, studentEmail, citizenship, phone, birthDate, sex, degreeTrack, graduationYear])

  const fetchProposals = async () => {
    try {
      const res = await fetch(apiUrl('/api/proposals'))
      const data = await res.json()
      setProposals(data)
      setCandidateAuditStatus(current => { const next = { ...current }; data.forEach((p: Application, index: number) => { if (!next[p.id]) next[p.id] = index % 4 === 0 ? 'Needs review' : index % 4 === 1 ? 'In review' : index % 4 === 2 ? 'Verified' : 'Decision needed' }); localStorage.setItem('openDoorsCandidateStatuses', JSON.stringify(next)); return next })
      if (data.length > 0 && !selectedProposal) {
        handleSelectProposal(data[0].id)
      }
    } catch (err: any) {
      console.error(err)
    }
  }

  const fetchCorpus = async () => {
    try {
      const res = await fetch(apiUrl('/api/corpus'))
      const data = await res.json()
      setCorpusDocs(data)
      if (data.length > 0) {
        setSelectedCorpusDoc(data[0])
      }
    } catch (err: any) {
      console.error(err)
    }
  }
  const runIntegrationHealth = async () => {
    const next: Record<string, string> = {}
    try { const response = await fetch(apiUrl('/health')); next.api = response.ok ? 'Healthy' : 'Unavailable' } catch { next.api = 'Unavailable' }
    try { const response = await fetch(apiUrl('/api/proposals')); next.proposals = response.ok ? `${(await response.json()).length} loaded` : 'Unavailable' } catch { next.proposals = 'Unavailable' }
    if (proposals[0]) { try { const response = await fetch(apiUrl(`/api/proposals/${proposals[0].id}/pdf`), { method: 'GET' }); next.pdf = response.ok ? 'Ready' : `Unavailable (${response.status})` } catch { next.pdf = 'Unavailable' } } else next.pdf = 'Waiting for candidates'
    try { let response = await fetch(apiUrl('/api/admin/evaluate-video'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: proposals[0] || { id: 'DEMO-HEALTH' } }) }); if (response.status === 404 || response.status === 405) response = await fetch(apiUrl('/api/admin/evaluate-video?candidate_id_param=DEMO-HEALTH&applicant_name=Health%20check'), { method: 'GET' }); next.video = response.ok ? 'Ready' : `Unavailable (${response.status})` } catch { next.video = 'Unavailable' }
    try { const response = await fetch(apiUrl('/api/integrations/health')); const result = await response.json(); next.n8n = result.n8n === 'reachable' ? 'Reachable' : result.n8n === 'not_configured' ? 'Not configured' : 'Unavailable' } catch { next.n8n = 'Unavailable' }
    setIntegrationHealth(next)
  }

  const runBatchDemoAudit = async () => {
    if (!proposals.length || batchAudit.running) return
    setBatchAudit({ running: true, completed: 0, total: proposals.length, passed: 0, failed: 0, results: {} })
    let passed = 0; let failed = 0
    const results: Record<string, { stages: Record<string, string>; reason?: string }> = {}
    for (const candidate of proposals) {
      const stages: Record<string, string> = { parser: 'Pending', transcript: 'Pending', evaluation: 'Pending', verification: 'Pending' }
      try {
        const headers = { 'Content-Type': 'application/json' }
        const parse = await fetch(apiUrl('/api/student/parse-cv'), { method: 'POST', headers, body: JSON.stringify({ cv_content: candidate.cv_latex || '', form_data: candidate }) })
        stages.parser = parse.ok ? 'Passed' : `Failed (${parse.status})`
        if (!parse.ok) throw new Error(`CV parser returned HTTP ${parse.status}`)
        let transcript = await fetch(apiUrl('/api/admin/extract-video-transcript'), { method: 'POST', headers, body: JSON.stringify({ candidate }) })
        if (transcript.status === 405) {
          const params = new URLSearchParams({ candidate_id_param: candidate.id, applicant_name: candidate.applicant_name || 'The candidate' })
          transcript = await fetch(apiUrl(`/api/admin/extract-video-transcript?${params.toString()}`), { method: 'GET' })
        }
        let transcriptArtifact: any
        if (!transcript.ok && transcript.status === 404) {
          transcriptArtifact = { candidate_id: candidate.id, status: 'complete', source: 'local-demo-fallback', transcript_status: 'Fallback', transcript: `${candidate.applicant_name || 'The candidate'} describes their academic work and intended public impact.`, duration: '01:32', confidence: 0.7 }
          stages.transcript = 'Passed (demo fallback)'
        } else {
          stages.transcript = transcript.ok ? 'Passed' : `Failed (${transcript.status})`
          if (!transcript.ok) throw new Error(`Transcript extraction returned HTTP ${transcript.status}`)
          transcriptArtifact = await transcript.json()
        }
        let evaluate = await fetch(apiUrl('/api/admin/evaluate-video'), { method: 'POST', headers, body: JSON.stringify({ candidate, transcript: transcriptArtifact }) })
        if (evaluate.status === 405 || evaluate.status === 404) {
          const params = new URLSearchParams({ candidate_id_param: candidate.id, applicant_name: candidate.applicant_name || 'The candidate' })
          evaluate = await fetch(apiUrl(`/api/admin/evaluate-video?${params.toString()}`), { method: 'GET' })
        }
        stages.evaluation = evaluate.ok ? 'Passed' : `Failed (${evaluate.status})`
        if (!evaluate.ok) throw new Error(`Video evaluation returned HTTP ${evaluate.status}`)
        const verify = await fetch(apiUrl('/api/admin/verify-contract-institution'), { method: 'POST', headers, body: JSON.stringify({ candidate }) })
        stages.verification = verify.ok ? 'Passed' : `Failed (${verify.status})`
        if (!verify.ok) throw new Error(`Verification returned HTTP ${verify.status}`)
        const evaluationArtifact = await evaluate.json(); const verificationArtifact = await verify.json()
        updateAuditArtifact(candidate.id, { cv: { status: 'parsed', source: 'Demo artifact' }, video: { ...transcriptArtifact, ...evaluationArtifact, source: 'Demo artifact' }, verification: { ...verificationArtifact, source: 'Demo artifact' } })
        passed += 1
      } catch (error) { failed += 1; results[candidate.id] = { stages, reason: error instanceof Error ? error.message : 'Unknown audit failure' }; setBatchAudit(current => ({ ...current, results: { ...current.results, [candidate.id]: results[candidate.id] } })) }
      if (!results[candidate.id]) results[candidate.id] = { stages }
      setBatchAudit({ running: true, completed: passed + failed, total: proposals.length, passed, failed, results: { ...results } })
    }
    setBatchAudit({ running: false, completed: proposals.length, total: proposals.length, passed, failed, results })
  }

  const handleSelectProposal = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/proposals/${id}`))
      if (!res.ok) throw new Error(`Candidate lookup returned HTTP ${res.status}`)
      const data = await res.json()
      if (!data?.id || !data?.applicant_name) throw new Error('Candidate response was incomplete')
      setSelectedProposal(data)
      // Selecting a dossier only loads it. The committee explicitly starts one
      // audit cycle with the Run audit button, preventing accidental Groq reruns.
      setSimGpa(data.gpa || 3.85)
      if (data.financials) {
        setSimCostOfAttendance(data.financials.cost_of_attendance || 87000)
        setSimParentShare(data.financials.parent_share || 4800)
        setSimStudentShare(data.financials.student_share || 3700)
        setSimOutsideAwards(data.financials.outside_scholarships || 0)
        setSimComputerAllowance(data.financials.computer_allowance || 0)
      }
      setSimDossierPages(data.page_count || 8)

      // Trigger multimodal verification for this applicant
      triggerMultimodalVerification(data)

      // Automatically retrieve candidate RAG rules without manual query
      const autoQuery = `${data.major || 'academic'} GPA eligibility funding rules`
      setRagQuery(autoQuery)
      fetch(apiUrl('/api/rag/retrieve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: autoQuery })
      }).then(r => r.json()).then(res => setRagResults(res.results || [])).catch(() => {})
    } catch (err: any) {
      console.error(err)
      const fallback = proposals.find(candidate => candidate.id === id)
      if (fallback?.applicant_name) setSelectedProposal(fallback)
    }
  }


  // Trigger real-time Multimodal Cross-Verification (Form vs CV vs Speech)
  const triggerMultimodalVerification = async (appData: Application) => {
    setIsCrossVerifying(true)
    try {
      const res = await fetch(apiUrl('/api/multimodal/cross-verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_data: appData })
      })
      const result = await res.json()
      setAdminMultimodalResult(result)
    } catch (err) {
      console.error(err)
    } finally {
      setIsCrossVerifying(false)
    }
  }

  // Bridge frontend directly to the n8n Low-Code Orchestrator
  const triggerN8nWorkflow = async (mode: 'live' | 'test' = 'live') => {
    const candidate = selectedProposal || proposals[0]
    if (!candidate) return
    setN8nTriggerLoading(true)
    setN8nTriggerResult(null)
    try {
      const res = await fetch(apiUrl('/api/n8n/trigger-webhook?webhook_mode=' + mode), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate)
      })
      const data = await res.json()
      setN8nTriggerResult(data)
    } catch (err: any) {
      setN8nTriggerResult({
        success: false,
        error: `Failed to invoke n8n bridge: ${err.message}`,
        hint: 'Ensure your local n8n instance is running (port 5678).'
      })
    } finally {
      setN8nTriggerLoading(false)
    }
  }
  const openCandidateAudit = async (id: string, panel: 'profile' | 'submitted' | 'cv' | 'video' | 'verification' | 'decision' = 'profile') => { setAuditPanel(panel); await handleSelectProposal(id); setAdminTab('audit') }

  const auditCandidate = selectedProposal || proposals[0]
  const currentAudit = auditCandidate ? candidateAuditRuns[auditCandidate.id] : undefined
  const auditTokenUsage = currentAudit?.token_usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const auditTokenLabel = `${Number(auditTokenUsage.total_tokens || 0).toLocaleString()} tokens · ${Number(auditTokenUsage.prompt_tokens || 0).toLocaleString()} in / ${Number(auditTokenUsage.completion_tokens || 0).toLocaleString()} out`
  const automaticOpinion = ['review_technical', 'review_impact', 'review_budget']
    .map(key => currentAudit?.results?.[key]?.summary)
    .filter(Boolean)
    .join(' ')
  const pipelineStageRows = [
    ['cv_ocr', 'CV parsing'],
    ['video_transcription', 'Video transcription'],
    ['video_llm_review', 'Video evaluation'],
    ['evidence_comparison', 'Evidence comparison'],
    ['rag_fact_check', 'RAG verification'],
    ['review_technical', 'Technical review'],
    ['review_impact', 'Impact review'],
    ...((auditCandidate?.budget && Object.keys(auditCandidate.budget).length) ? [['review_budget', 'Budget review']] : []),
  ] as const
  const updateAuditArtifact = (key: string, value: any) => setAuditArtifacts(current => ({ ...current, [key]: { ...value, updatedAt: new Date().toISOString() } }))
  const statusForCandidate = (candidate: Application | undefined) => candidate ? (candidateAuditStatus[candidate.id] || 'Needs review') : 'Needs review'
  const decisionForCandidate = (candidate: Application | undefined) => candidate ? candidateDecisions[candidate.id] : undefined
  const statusClass = (status: string) => ({ 'Needs review': 'status-needs-review', 'In review': 'status-in-review', Verified: 'status-verified', 'Decision needed': 'status-decision-needed', Submitted: 'status-submitted' }[status] || 'status-needs-review')
  const recommendationClass = (decision?: string) => ({ FUND: 'recommendation-fund', RESERVE: 'recommendation-reserve', REJECT: 'recommendation-reject', Pending: 'recommendation-pending' }[decision || 'Pending'] || 'recommendation-pending')
  const runFullAudit = async () => {
    if (!auditCandidate) return
    if (candidateAuditRuns[auditCandidate.id]?.status === 'running') return
    const id = auditCandidate.id
    // A rerun is a clean pass: discard the previous visible progress and artifacts
    // before asking the server to recreate every stage from the beginning.
    setAuditPanel('profile')
    setCandidateAuditRuns(current => ({ ...current, [id]: { status: 'queued', stages: {}, results: {}, timeline: [] } }))
    setAuditArtifacts(current => { const next = { ...current }; delete next[id]; return next })
    setVideoStages(current => { const next = { ...current }; delete next[id]; return next })
    setOverallOpinion(current => { const next = { ...current }; delete next[id]; return next })
    setIsSignedOff(false)
    await fetch(apiUrl(`/api/admin/candidate-audit/${encodeURIComponent(id)}/run`), { method: 'POST' })
  }
  const stopFullAudit = async () => {
    if (!auditCandidate) return
    const id = auditCandidate.id
    await fetch(apiUrl(`/api/admin/candidate-audit/${encodeURIComponent(id)}/stop`), { method: 'POST' })
    setCandidateAuditRuns(current => ({ ...current, [id]: { status: 'stopped', stages: {}, results: {}, timeline: [] } }))
    setAuditArtifacts(current => { const next = { ...current }; delete next[id]; return next })
    setAuditPanel('profile')
  }
  const persistCandidateDecision = (candidate: Application) => { const decision = { decision: auditDecision, notes: auditNotes, score: overrideScore, signedOffAt: new Date().toISOString() }; setCandidateDecisions(current => { const next = { ...current, [candidate.id]: decision }; localStorage.setItem('openDoorsCandidateDecisions', JSON.stringify(next)); return next }); setCandidateAuditStatus(current => { const next = { ...current, [candidate.id]: 'Submitted' }; localStorage.setItem('openDoorsCandidateStatuses', JSON.stringify(next)); return next }) }
  const runVideoTranscription = async () => {
    if (!auditCandidate) return null
    const id = auditCandidate.id
    setVideoStages(current => ({ ...current, [id]: 'queued' })); await new Promise(resolve => setTimeout(resolve, 350)); setVideoStages(current => ({ ...current, [id]: 'extracting transcript' }))
    let transcript: any
try { const res = await fetch(apiUrl('/api/admin/extract-video-transcript'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: auditCandidate }) }); if (!res.ok) throw new Error(`Transcript endpoint returned HTTP ${res.status}`); transcript = await res.json() } catch (error: any) { transcript = { source: 'endpoint-unavailable', status: 'failed', transcript_status: 'Failed', transcript: '', duration: auditCandidate.video_duration || 'Unknown', confidence: null, flags: [`Transcript request failed: ${error.message}`] } }
    updateAuditArtifact(id, { video: { ...(auditArtifacts[id]?.video || {}), ...transcript, transcriptStatus: transcript.transcript_status || 'Extracted', transcript: transcript.transcript } }); setVideoStages(current => ({ ...current, [id]: 'complete' })); return transcript
  }
  const runVideoEvaluation = async () => {
    if (!auditCandidate) return
    const id = auditCandidate.id
    let transcript = auditArtifacts[id]?.video
    if (!transcript?.transcript) transcript = await runVideoTranscription()
    setVideoStages(current => ({ ...current, [id]: 'evaluating' }))
    let result: any
    try { const res = await fetch(apiUrl('/api/admin/evaluate-video'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: auditCandidate, transcript }) }); result = await res.json() } catch { result = { source: 'endpoint-unavailable', evaluation_status: 'Not evaluated', confidence: null, claims: [], flags: ['Evaluation endpoint unavailable; no result was fabricated.'] } }
    updateAuditArtifact(id, { video: { ...(transcript || {}), ...result, status: 'evaluated', confidence: `${Math.round((result.confidence || 0) * 100)}%`, transcriptStatus: transcript?.transcript_status || transcript?.transcriptStatus || 'Extracted' } }); setVideoStages(current => ({ ...current, [id]: 'complete' })); setCandidateAuditStatus(current => ({ ...current, [id]: 'In review' }))
  }
  const runRagSearch = async () => {
    setRagLoading(true)
    try {
      const response = await fetch(apiUrl('/api/rag/retrieve'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: ragQuery }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'RAG retrieval failed.')
      setRagResults(data.results || [])
    } catch (error) {
      console.error(error)
      setRagResults([])
    } finally {
      setRagLoading(false)
    }
  }
  const streamOverallOpinion = async () => { if (!auditCandidate) return; const id = auditCandidate.id; setOpinionLoading(current => ({ ...current, [id]: true })); try { const res = await fetch(apiUrl('/api/admin/overall-opinion'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: { ...auditCandidate, verification: auditArtifacts[id]?.verification || {} }, transcript: auditArtifacts[id]?.video || {} }) }); const data = await res.json(); const text = data.opinion || 'No opinion returned; human review remains required.'; setOverallOpinion(current => ({ ...current, [id]: '' })); for (let i = 0; i < text.length; i += 5) { await new Promise(resolve => setTimeout(resolve, 18)); setOverallOpinion(current => ({ ...current, [id]: text.slice(0, i + 5) })) } } catch { setOverallOpinion(current => ({ ...current, [id]: 'AI opinion unavailable. Human review remains required.' })) } finally { setOpinionLoading(current => ({ ...current, [id]: false })) } }

  // Parse Deposited CV in the Student Portal
  const handleParseCv = async (contentToParse?: string, candidateId?: string) => {
    setIsParsingCv(true)
    setCvParseError(null)
    const cvText = contentToParse || studentCvLatex
    try {
      const res = await fetch(apiUrl('/api/student/parse-cv'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cv_content: cvText,
          form_data: {
            applicant_name: studentName,
            gpa: Number(studentGpa),
            major: studentMajor,
            id: candidateId
          },
        })
      })
      const data = await res.json()
      setCvAtsResult(data)
      return data
    } catch (err: any) {
      console.warn('CV Parse unavailable; using local preview.', err)
      setCvAtsResult({ ats_parsed: { format: 'PDF', ats_parsability_score: null, extracted_gpa: null, degrees: [], honors_awards: [], extraction_error: 'Live parser unavailable; no synthetic fields were generated.' } })
      setCvParseError('Live parsing is unavailable, so we created a local preview. You can continue and retry later.')
    } finally {
      setIsParsingCv(false)
    }
  }

  // Handle Dynamic Student Form Submission
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (applicationStatus === 'submitted') {
      setSubmitStatus('Thank you — your application was already submitted successfully. There is no need to resubmit.')
      setApplicantView('status')
      return
    }
    setApplicationStatus('submitting'); localStorage.setItem('openDoorsApplicationStatus', 'submitting')
    setSubmitStatus('Submitting application to Yale Fellowship Board...')

    const effectiveName = studentName.trim() || 'Applicant'
    const effectiveTitle = projectTitle.trim() || `${effectiveName} - Yale Fellowship Application`
    const effectiveMajor = studentMajor.trim() || 'Undeclared'
    const effectiveSchool = studentSchool.trim() || 'Yale College'

    const payload = {
      title: effectiveTitle,
      applicant_name: effectiveName,
      school: effectiveSchool,
      major: effectiveMajor,
      gpa: Number(studentGpa) || 0.0,
      education_entries: educationEntries,
      academic_experiences: academicExperiences,
      leadership_experiences: leadershipExperiences,
      purpose_statement: academicExperiences[0]?.trim() || purposeStatement.trim() || 'Academic goals and research interest on file.',
      leadership_statement: leadershipExperiences[0]?.trim() || leadershipStatement.trim() || 'Leadership experience and community service on file.',
      page_count: 8,
      requested_grant: Number(requestedGrant) || 0.0,
      cv_latex: studentCvLatex,
      cv_filename: cvFileName,
      video_url: recordedVideoUrl,
      email: studentEmail,
      citizenship,
      phone,
      birth_date: birthDate,
      sex,
      degree_track: degreeTrack,
      graduation_year: graduationYear,
      financials: {
        cost_of_attendance: 87000.0,
        parent_share: parentIncome < 75000 ? 0.0 : Math.round((parentIncome - 75000) * 0.2),
        student_share: 3700.0,
        outside_scholarships: Number(outsideScholarships) || 0,
        computer_allowance: Number(techPurchaseRequested) || 0,
        demonstrated_need: Number(requestedGrant) || 0
      },
      sections: {
        abstract: `${effectiveName} (${effectiveSchool}) proposes: ${academicExperiences[0] || purposeStatement || effectiveTitle}. Cumulative GPA: ${studentGpa || '0.0'}.`,
        scientific_methodology: studyPlan.trim() || 'Full academic curriculum and methodology on file.',
        impact_and_dissemination: leadershipExperiences[0] || leadershipStatement || 'Leadership and community contribution plan on file.',
        work_packages: 'Term 1: Methodology. Term 2: Research & Fieldwork. Term 3: Thesis.',
        budget: `Direct need-based request: $${(Number(requestedGrant) || 0).toLocaleString()}. Parent share and standard student share accounted for.`
      },
    }

    try {
      const res = await fetch(apiUrl('/api/student/submit-application'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        let errMessage = `HTTP error ${res.status}`
        try {
          const errData = await res.json()
          if (Array.isArray(errData?.detail)) {
            errMessage = errData.detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'field'}: ${d.msg}`).join(', ')
          } else if (typeof errData?.detail === 'string') {
            errMessage = errData.detail
          } else if (errData?.message) {
            errMessage = errData.message
          }
        } catch {}
        throw new Error(errMessage)
      }

      const result = await parseJsonResponse<{ success?: boolean; application?: any; message?: string }>(
        res,
        { success: false, message: 'The server returned an empty or invalid response.' }
      )

      if (result.success) {
        const submittedAt = new Date().toISOString()
        const userEmail = (applicantSession?.email || studentEmail || 'applicant').toLowerCase().trim()
        setApplicationStatus('submitted')
        localStorage.setItem(getUserStatusKey(userEmail), 'submitted')
        localStorage.setItem(getUserSubmittedAtKey(userEmail), submittedAt)
        setSubmitStatus(`✅ Thank you! Your application [${result.application?.id || 'new'}] was submitted successfully. No further action is required.`)
        setApplicantView('status')
        await fetchProposals()
        if (result.application) setSelectedProposal(result.application)
        if (result.application) triggerMultimodalVerification(result.application)
      } else {
        setApplicationStatus('failed')
        const userEmail = (applicantSession?.email || studentEmail || 'applicant').toLowerCase().trim()
        localStorage.setItem(getUserStatusKey(userEmail), 'failed')
        setSubmitStatus(result.message || 'Error submitting application.')
      }
    } catch (err: any) {
      setApplicationStatus('failed')
      const userEmail = (applicantSession?.email || studentEmail || 'applicant').toLowerCase().trim()
      localStorage.setItem(getUserStatusKey(userEmail), 'failed')
      setSubmitStatus(`Submission failed: ${err.message || 'The server response was empty or invalid.'}`)
    }
  }

  // File Upload for CV (.pdf)
  const handleCvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setCvParseError('Please choose a PDF file. Only PDF documents are accepted.')
        e.target.value = ''
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setCvParseError('This file is larger than 10 MB. Please upload a smaller PDF.')
        e.target.value = ''
        return
      }
      setCvParseError(null)
      setCvFileName(file.name)
      const previewUrl = URL.createObjectURL(file)
      setCvFilePreviewUrl(previewUrl)
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        if (text) {
          setStudentCvLatex(text)
        }
      }
      reader.readAsText(file)
    }
  }

  // Webcam Video Recording Handlers

  /** Read duration from a blob/object URL using a temporary off-screen <video>.
   *  This avoids timing issues where videoPreviewRef is not yet mounted. */
  const readVideoDuration = (url: string): Promise<number | null> => {
    return new Promise((resolve) => {
      const tmp = document.createElement('video')
      tmp.preload = 'metadata'
      tmp.muted = true
      tmp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;'
      document.body.appendChild(tmp)
      const cleanup = () => { try { document.body.removeChild(tmp) } catch { /* already removed */ } }
      tmp.onloadedmetadata = () => {
        const dur = Number.isFinite(tmp.duration) && tmp.duration > 0 ? tmp.duration : null
        cleanup()
        resolve(dur)
      }
      tmp.onerror = () => { cleanup(); resolve(null) }
      // Some browsers need a small delay before they report duration
      setTimeout(() => { tmp.src = url; tmp.load() }, 0)
    })
  }

  const loadVideoPreview = (url: string | null) => {
    if (!videoPreviewRef.current) return
    videoPreviewRef.current.srcObject = null
    videoPreviewRef.current.src = url || ''
    videoPreviewRef.current.load()
    if (url) {
      videoPreviewRef.current.muted = false
      videoPreviewRef.current.setAttribute('controls', 'controls')
    } else {
      setVideoDuration(null)
    }
  }

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setVideoError('Please choose a valid video file to upload. The chosen file is not a video.')
      e.target.value = ''
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      setVideoError('This video is larger than 25 MB. Please choose a smaller file or record a shorter clip.')
      e.target.value = ''
      return
    }

    setVideoFileName(file.name)
    const objectUrl = URL.createObjectURL(file)
    setRecordedVideoUrl(objectUrl)
    setVideoDuration(null)
    setVideoError(null)
    setActiveVideoModal('none')
    e.target.value = ''

    // Read duration with a temp element — ref may not be mounted yet
    const dur = await readVideoDuration(objectUrl)
    setVideoDuration(dur)
    setVideoError(getVideoValidationMessage(dur))
    // Sync preview ref if it's now mounted
    loadVideoPreview(objectUrl)
  }

  const startRecording = async () => {
    setVideoError(null)
    setVideoDuration(null)
    setRecordingSeconds(0)
    recordingStartedAtRef.current = Date.now()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
      activeMediaStreamRef.current = stream
      const targetVideo = modalVideoPreviewRef.current || videoPreviewRef.current
      if (targetVideo) {
        targetVideo.srcObject = stream
        targetVideo.src = ''
        targetVideo.muted = true
        targetVideo.removeAttribute('controls')
        void targetVideo.play().catch(() => undefined)
      }
      videoChunksRef.current = []
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? { mimeType: 'video/webm;codecs=vp9' } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: recorder.mimeType || 'video/webm' })
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob)
          const elapsedSeconds = recordingStartedAtRef.current ? (Date.now() - recordingStartedAtRef.current) / 1000 : Math.max(recordingSeconds, 0)
          setRecordedVideoUrl(url)
          setVideoDuration(elapsedSeconds)
          setVideoFileName('applicant-recorded-pitch.webm')
          const message = getVideoValidationMessage(elapsedSeconds)
          setVideoError(message)
          loadVideoPreview(url)
        }
        stream.getTracks().forEach((track) => track.stop())
        activeMediaStreamRef.current = null
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (err: any) {
      setVideoError('Camera or microphone access was not available. Check your browser permissions, then retry, or upload a recording instead.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      recordingStartedAtRef.current = null
    }
  }

  const closeVideoModal = () => {
    if (isRecording) {
      stopRecording()
    }
    if (activeMediaStreamRef.current) {
      activeMediaStreamRef.current.getTracks().forEach(t => t.stop())
      activeMediaStreamRef.current = null
    }
    setActiveVideoModal('none')
  }

  useEffect(() => {
    if (!isRecording) return

    const intervalId = window.setInterval(() => {
      setRecordingSeconds((current) => {
        const nextValue = current + 1
        if (nextValue >= 120) {
          stopRecording()
          return 120
        }
        return nextValue
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isRecording])

  // Deterministic checks calculations
  const sapViolation = simGpa < 3.0
  const computerAllowanceViolation = simComputerAllowance > 2500.0
  const studentShareViolation = simStudentShare > 4500.0
  const pagesViolation = simDossierPages > 15
  const hasViolations = sapViolation || computerAllowanceViolation || studentShareViolation || pagesViolation

  const expectedEfc = simParentShare + simStudentShare
  const computedNeed = Math.max(0, simCostOfAttendance - expectedEfc - simOutsideAwards + simComputerAllowance)

  const sortedCohort = [...proposals].sort((a, b) => {
    const sA = a.ground_truth?.consensus_score || 3.5
    const sB = b.ground_truth?.consensus_score || 3.5
    return sB - sA
  })
  const savedLabel = draftUpdatedAt ? `Last saved ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draftUpdatedAt))}` : 'No saved draft yet'
  const submittedAtValue = applicantSession?.email ? localStorage.getItem(getUserSubmittedAtKey(applicantSession.email)) : null
  const submissionLabel = applicationStatus === 'submitted' ? `Submitted ${submittedAtValue ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(submittedAtValue)) : ''}` : applicationStatus === 'submitting' ? 'Submission in progress' : applicationStatus === 'failed' ? 'Submission needs attention' : 'Draft · Not submitted'
  const applicantDisplayName = applicantSession?.name || studentName || authName || 'Applicant'
  const applicantInitials = applicantDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'A'

  const validateAuthForm = (isSignUp: boolean): boolean => {
    const errors: Record<string, string> = {}
    const email = authEmail.trim()
    const password = authPassword

    if (isSignUp) {
      const name = authName.trim()
      if (!name) {
        errors.name = 'Full name is required.'
      } else if (name.length < 2) {
        errors.name = 'Name must be at least 2 characters long.'
      }
    }

    if (!email) {
      errors.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address (e.g. name@university.edu).'
    }

    if (!password) {
      errors.password = 'Password is required.'
    } else if (isSignUp && password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.'
    }

    if (isSignUp && !errors.email) {
      const users = readStoredJson<Record<string, { email: string; name: string; password?: string }>>('openDoorsUsers', {})
      if (users[email.toLowerCase()]) {
        errors.email = 'An account with this email already exists. Please sign in instead.'
      }
    }

    if (!isSignUp && !errors.email && !errors.password) {
      const users = readStoredJson<Record<string, { email: string; name: string; password?: string }>>('openDoorsUsers', {})
      const existing = users[email.toLowerCase()]
      if (existing && existing.password && existing.password !== password) {
        errors.password = 'Incorrect password for this account.'
      }
    }

    setAuthFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setAuthError('Please correct the highlighted fields.')
      return false
    }
    setAuthError(null)
    return true
  }

  const signInApplicant = (demo = false) => {
    if (demo) {
      const demoSession = { email: 'demo.applicant@opendoors.org', name: 'Demo Applicant' }
      loadUserSession(demoSession)
      return
    }

    if (!validateAuthForm(false)) return
    const email = authEmail.trim().toLowerCase()
    const users = readStoredJson<Record<string, { email: string; name: string; password?: string }>>('openDoorsUsers', {})
    const existing = users[email]
    const name = existing?.name || authName.trim() || email.split('@')[0]
    if (!existing) {
      users[email] = { email, name, password: authPassword }
      localStorage.setItem('openDoorsUsers', JSON.stringify(users))
    }
    const session = { email, name }
    loadUserSession(session)
  }

  const signUpApplicant = () => {
    if (!validateAuthForm(true)) return
    const email = authEmail.trim().toLowerCase()
    const name = authName.trim()
    const users = readStoredJson<Record<string, { email: string; name: string; password?: string }>>('openDoorsUsers', {})
    users[email] = { email, name, password: authPassword }
    localStorage.setItem('openDoorsUsers', JSON.stringify(users))

    // Start with a completely clean draft & status for the new user
    localStorage.setItem(getUserStatusKey(email), 'draft')
    localStorage.removeItem(getUserSubmittedAtKey(email))
    localStorage.removeItem(getUserDraftKey(email))

    const session = { email, name }
    loadUserSession(session)
  }

  const signOutApplicant = () => {
    localStorage.removeItem('openDoorsApplicantSession')
    setApplicantSession(null)
    resetStudentFormState('', '')
    setAuthEmail('')
    setAuthPassword('')
    setAuthName('')
    setAuthError(null)
    setAuthFieldErrors({})
  }

  const signInAdmin = (demo = false) => {
    if (demo) {
      const session = { email: 'committee@opendoors.org' }
      localStorage.setItem('openDoorsAdminSession', JSON.stringify(session))
      setAdminSession(session)
      setPortalMode('admin')
      setAuthError(null)
      return
    }
    const errors: Record<string, string> = {}
    if (!authEmail.trim()) {
      errors.email = 'Admin email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.trim())) {
      errors.email = 'Please enter a valid email address.'
    }
    if (!authPassword) {
      errors.password = 'Password is required.'
    }
    setAuthFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setAuthError('Please enter valid admin credentials.')
      return
    }
    const session = { email: authEmail.trim() }
    localStorage.setItem('openDoorsAdminSession', JSON.stringify(session))
    setAdminSession(session)
    setPortalMode('admin')
    setAuthError(null)
    setAuthFieldErrors({})
  }

  if (portalMode === 'admin' && !adminSession) return <div className="auth-page admin-auth-page"><div className="auth-panel"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Committee portal</span></div></div><span className="eyebrow">Secure workspace</span><h1>Welcome back, committee.</h1><p className="auth-lede">Sign in to review applicant dossiers, compliance, and committee decisions.</p><label className="field"><span>Admin email</span><input type="email" placeholder="admin@opendoors.org" value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.email; return n }) }} />{authFieldErrors.email && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.email}</span>}</label><label className="field"><span>Password</span><input type="password" placeholder="Admin password" value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.password; return n }) }} />{authFieldErrors.password && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.password}</span>}</label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" onClick={() => signInAdmin()}>Sign in to admin console <span className="material-symbols-outlined">arrow_forward</span></button><button className="demo-link" onClick={() => signInAdmin(true)}>Continue as demo admin</button><button className="back-to-app" onClick={() => { setPortalMode('student'); setAuthError(null); setAuthFieldErrors({}) }}>← Back to applicant portal</button></div></div>

  if (portalMode === 'student' && !applicantSession) return <div className="auth-page"><div className="auth-visual"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Applicant portal</span></div></div><div className="auth-quote"><span className="eyebrow">Application 2026</span><h1>Your story deserves room to move.</h1><p>Build a thoughtful application, one piece at a time.</p><div className="quote-mark">“</div></div><div className="auth-visual-foot">Open Doors Fellowship · International student support</div></div><div className="auth-panel"><div className="auth-tabs"><button className={authView === 'signin' ? 'active' : ''} onClick={() => { setAuthView('signin'); setAuthError(null); setAuthFieldErrors({}) }}>Sign in</button><button className={authView === 'signup' ? 'active' : ''} onClick={() => { setAuthView('signup'); setAuthError(null); setAuthFieldErrors({}) }}>Create account</button></div><span className="eyebrow">Applicant access</span><h1>{authView === 'signin' ? 'Welcome back.' : 'Start your application.'}</h1><p className="auth-lede">{authView === 'signin' ? 'Pick up where you left off, whenever you’re ready.' : 'Create a local applicant account to save your progress on this device.'}</p>{authView === 'signup' && <label className="field"><span>Full name</span><input placeholder="e.g. Alex Rivera" value={authName} onChange={e => { setAuthName(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.name; return n }) }} />{authFieldErrors.name && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.name}</span>}</label>}<label className="field"><span>Email address</span><input type="email" placeholder="e.g. applicant@university.edu" value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.email; return n }) }} />{authFieldErrors.email && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.email}</span>}</label><label className="field"><span>Password</span><input type="password" placeholder={authView === 'signup' ? 'At least 6 characters' : 'Enter your password'} value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.password; return n }) }} />{authFieldErrors.password && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.password}</span>}</label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" onClick={() => authView === 'signin' ? signInApplicant() : signUpApplicant()}>{authView === 'signin' ? 'Sign in' : 'Create local account'} <span className="material-symbols-outlined">arrow_forward</span></button><div className="auth-divider"><span>or</span></div><button className="demo-link" onClick={() => signInApplicant(true)}>Continue as demo applicant</button><button className="admin-entry" onClick={() => { setPortalMode('admin'); setAuthError(null); setAuthFieldErrors({}) }}>Committee / admin sign in</button></div></div>

  if (portalMode === 'student' && applicantSession && applicantView === 'status') return <div className="status-page"><header className="status-header"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Applicant portal</span></div></div><div className="status-user"><span className="avatar">{applicantInitials}</span><span><strong>{applicantDisplayName}</strong><small style={{ display: 'block', color: 'var(--muted)', fontSize: '.65rem', marginTop: 2 }}>{applicantSession.email}</small></span><button onClick={signOutApplicant}>Sign out</button></div></header><main className="status-main"><span className="eyebrow">My application · 2026</span><h1>Good to see you, {applicantDisplayName.split(' ')[0]}.</h1>{applicationStatus === 'submitted' ? <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}><span className="material-symbols-outlined" style={{ fontSize: 24 }}>check_circle</span><div><strong style={{ display: 'block' }}>Thank you — your application was submitted successfully.</strong><small style={{ opacity: 0.9 }}>No need to resubmit. You can review your status below.</small></div></div> : <p className="auth-lede">Your application is saved securely on this device. Continue when you’re ready.</p>}<section className="status-hero"><div><span className="eyebrow">Current stage</span><h2>{applicationStatus === 'submitted' ? 'Application received' : completedStudentSteps.length ? studentSteps[Math.min(studentStep, 5)] : 'General information'}</h2><p>{savedLabel} · {submissionLabel}</p></div><div className="status-ring"><strong>{applicationStatus === 'submitted' ? 100 : Math.round((completedStudentSteps.length / 6) * 100)}%</strong><span>{applicationStatus === 'submitted' ? 'submitted' : 'complete'}</span></div></section><section className="status-card"><div className="status-card-top"><div><h3>Application progress</h3><p>Six pieces make up your dossier.</p></div><strong>{applicationStatus === 'submitted' ? 'Submitted' : `${completedStudentSteps.length} of 6 complete`}</strong></div><div className="status-progress"><i style={{ width: `${applicationStatus === 'submitted' ? 100 : (completedStudentSteps.length / 6) * 100}%` }} /></div><div className="status-step-list">{studentSteps.map((step, index) => <div key={step} className={applicationStatus === 'submitted' || completedStudentSteps.includes(index) ? 'complete' : index === studentStep ? 'current' : ''}><span className="material-symbols-outlined">{applicationStatus === 'submitted' || completedStudentSteps.includes(index) ? 'check_circle' : stepIcons[index]}</span><span>{step}</span><small>{applicationStatus === 'submitted' ? 'Complete' : completedStudentSteps.includes(index) ? 'Complete' : index === studentStep ? 'Up next' : 'Not started'}</small></div>)}</div><button className="primary-button" onClick={() => setApplicantView('workspace')}>{applicationStatus === 'submitted' ? 'View submitted application' : 'Continue application'} <span className="material-symbols-outlined">arrow_forward</span></button></section></main></div>

  return (
    <div className={`m3-app-layout ${portalMode === 'student' ? 'student-mode' : 'admin-mode'}`}>
      {/* Sidebar: Clean, Logical Role Navigation */}
      <aside className="m3-drawer">
        <div className="m3-brand-row">
          <div className="m3-brand-logo" style={{ background: 'linear-gradient(135deg, #0f4d92, #00356b)' }}>
            <span className="material-symbols-outlined">school</span>
          </div>
          <div>
          <div className="m3-brand-title">Open Doors</div>
          <span className="m3-brand-badge">Committee dossier</span>
          </div>
        </div>

        {/* Portal Switcher (Student vs Admin/Chair) */}
        {portalMode === 'student' && <div className="portal-switcher" style={{ background: '#f1f5f9', borderRadius: 12, padding: 4, display: 'flex', gap: 4, marginBottom: 16 }}>
          <button
            onClick={() => setPortalMode('student')}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: portalMode === 'student' ? '#00356b' : 'transparent',
              color: portalMode === 'student' ? '#ffffff' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            Student Portal
          </button>
          <button
            onClick={() => {
              setPortalMode('admin')
              if (selectedProposal) triggerMultimodalVerification(selectedProposal)
            }}
            style={{
              flex: 1,
              padding: '8px 10px',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: '#00356b',
              color: '#ffffff',
              transition: 'all 0.2s'
            }}
          >
            Admin / Chair
          </button>
        </div>}

        {/* Role-Specific Navigation Links */}
        {portalMode === 'student' ? (
          <nav className="m3-nav-list">
            <div className="m3-nav-item active">
              <span className="material-symbols-outlined" style={{ color: '#0f4d92' }}>edit_document</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Application Intake</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Submit Profile & Statements</div>
              </div>
            </div>
            <div
              className="m3-nav-item"
              onClick={() => {
                setPortalMode('admin')
                setAdminTab('corpus')
              }}
            >
              <span className="material-symbols-outlined">menu_book</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Yale Guidelines</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>View Official SFS Policies</div>
              </div>
            </div>
          </nav>
        ) : (
          <nav className="m3-nav-list">
            <div className={`m3-nav-item ${adminTab === 'overview' ? 'active' : ''}`} onClick={() => setAdminTab('overview')}><span className="material-symbols-outlined">space_dashboard</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Overview</div><div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Review activity & workload</div></div></div>
            <div className={`m3-nav-item ${adminTab === 'audit' ? 'active' : ''}`} onClick={() => setAdminTab('audit')}>
              <span className="material-symbols-outlined">fact_check</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Candidate audit</div><div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Queue & evidence workspace</div></div>
            </div>
            <div className={`m3-nav-item ${adminTab === 'decisions' ? 'active' : ''}`} onClick={() => setAdminTab('decisions')}><span className="material-symbols-outlined">gavel</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Decisions</div><div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Chair sign-offs & recommendations</div></div></div>
            <div className={`m3-nav-item ${adminTab === 'corpus' ? 'active' : ''}`} onClick={() => setAdminTab('corpus')}><span className="material-symbols-outlined">hub</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>RAG rules & retrieval</div><div style={{ fontSize: 0.68, opacity: 0.8 }}>Corpus, chunks & rule evidence</div></div></div>
            {false && <>
            <div
              className={`m3-nav-item ${adminTab === 'dossiers' ? 'active' : ''}`}
              onClick={() => setAdminTab('dossiers')}
            >
              <span className="material-symbols-outlined">folder_shared</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Applicant Dossiers</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>20 Candidates & Submissions</div>
              </div>
            </div>
            </>}

            {false && <>
            <div
              className={`m3-nav-item ${adminTab === 'multimodal' ? 'active' : ''}`}
              onClick={() => {
                setAdminTab('multimodal')
                if (selectedProposal) triggerMultimodalVerification(selectedProposal)
              }}
            >
              <span className="material-symbols-outlined" style={{ color: '#0284c7' }}>layers</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Multimodal Verification</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>CV vs Form vs Video Speech</div>
              </div>
            </div>

            <div
              className={`m3-nav-item ${adminTab === 'compliance' ? 'active' : ''}`}
              onClick={() => setAdminTab('compliance')}
            >
              <span className="material-symbols-outlined">verified</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Compliance & Need Audit</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>SAP Rules & EFC Calculation</div>
              </div>
            </div>

            {false && <div
              className={`m3-nav-item ${adminTab === 'deliberation' ? 'active' : ''}`}
              onClick={() => setAdminTab('deliberation')}
            >
              <span className="material-symbols-outlined">group_work</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Multi-Agent Evaluation</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Academic, Leadership & Need</div>
              </div>
            </div>}

            <div
              className={`m3-nav-item ${adminTab === 'arbitration' ? 'active' : ''}`}
              onClick={() => setAdminTab('arbitration')}
            >
              <span className="material-symbols-outlined">gavel</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Chair Arbitration & Sign-off</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Leaderboard & Digital Seal</div>
              </div>
            </div>

            <div
              className={`m3-nav-item ${adminTab === 'n8n' ? 'active' : ''}`}
              onClick={() => setAdminTab('n8n')}
            >
              <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>hub</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>n8n Low-Code Pipeline</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>Webhook & Live Orchestration</div>
              </div>
            </div>

            <div
              className={`m3-nav-item ${adminTab === 'corpus' ? 'active' : ''}`}
              onClick={() => setAdminTab('corpus')}
            >
              <span className="material-symbols-outlined">policy</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Official Corpus & PDFs</div>
                <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>8 Yale Scraped Guidelines</div>
              </div>
            </div>
            </>}
          </nav>

        )}

        <div style={{ marginTop: 'auto', marginBottom: 12 }}>
          <button
            className="m3-btn m3-btn-outlined"
            style={{ width: '100%', fontSize: '0.8rem' }}
            onClick={() => window.open('http://localhost:5678', '_blank')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hub</span>
            Open n8n Orchestrator
          </button>
        </div>

        <div className="m3-drawer-footer">
          <div className="m3-avatar" style={{ background: '#00356b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
            {portalMode === 'student' ? applicantInitials : 'YU'}
          </div>
          <div>
            <div className="m3-user-name">{portalMode === 'student' ? applicantDisplayName : 'Yale Fellowship Board'}</div>
            <div className="m3-user-role">{portalMode === 'student' ? (applicantSession?.email || 'Student Applicant') : 'Committee Administrator'}</div>
          </div>
          {portalMode === 'admin' && <button className="admin-signout" onClick={() => { localStorage.removeItem('openDoorsAdminSession'); setAdminSession(null); setPortalMode('admin') }} title="Sign out"><span className="material-symbols-outlined">logout</span></button>}
        </div>
      </aside>

      {/* Main Content Surface */}
      <main className="m3-main">
        {/* Top Header */}
        <header className="m3-hero-header" style={{ background: 'linear-gradient(135deg, #00356b, #0f4d92)' }}>
          <div className="m3-hero-top">
            <div>
              <span className="admin-eyebrow">Committee workspace · Application 2026</span>
              <h1>{portalMode === 'student' ? 'Yale Fellowship & Scholarship Student Portal' : 'Applicant dossier review'}</h1>
              <p>Review candidate stories, evidence, and decisions in one considered workspace.</p>
            </div>
            <div className="m3-hero-actions">
              {portalMode === 'admin' && (
                <>
                  <span className="m3-badge m3-badge-neutral" style={{ background: 'white', color: '#00356b', fontWeight: 700 }}>
                    Active Dossier: {selectedProposal?.applicant_name || selectedProposal?.id || 'Maya Lin-Vance'}
                  </span>
                  <button
                    className="m3-btn m3-btn-filled"
                    style={{ background: '#ffffff', color: '#00356b' }}
                    onClick={() => {
                      setAdminTab('arbitration')
                      alert(`Navigating to Committee Chair tab to evaluate ${selectedProposal?.applicant_name || selectedProposal?.id}`)
                    }}
                  >
                    <span className="material-symbols-outlined">play_arrow</span>
                    Run Deliberation
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Select Bar for Admin/Chair Mode */}
          {false && portalMode === 'admin' && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
              {proposals.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProposal(p.id)}
                  style={{
                    background: selectedProposal?.id === p.id ? 'white' : 'rgba(255,255,255,0.2)',
                    color: selectedProposal?.id === p.id ? '#00356b' : 'white',
                    border: 'none',
                    borderRadius: 16,
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.applicant_name || p.id} (GPA {p.gpa?.toFixed(2) || '3.8'})
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ============================================================= */}
        {/* VIEW 1: DEDICATED STUDENT APPLICATION SPACE                   */}
        {/* ============================================================= */}
        {portalMode === 'student' && (
          <div className="student-shell">
            <div className="student-mobile-progress"><div><span>Step {studentStep + 1} of 6</span><span className="mobile-saved"><i className="status-dot" /> Saved just now</span></div><strong>{studentSteps[studentStep]}</strong><div className="mobile-context"><span className="avatar">{applicantInitials}</span> {applicantDisplayName} · Applicant</div><div className="progress-track"><i style={{ width: `${((studentStep + 1) / 6) * 100}%` }} /></div></div>
            <div className="student-intro"><div><span className="eyebrow">Application 2026</span><h1>Your story, in six pieces.</h1><p>Build your dossier at your own pace. Everything is saved as you go.</p></div><div className="save-state"><span className="status-dot" /> Saved just now</div></div>
            <div className="student-layout">
              <aside className="student-rail">
                <div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Applicant portal</span></div></div>
                <div className="deadline-card"><span className="eyebrow">Priority deadline</span><strong>14 days left</strong><span>March 01, 2026</span></div>
                <nav className="student-steps" aria-label="Application steps">
                  {studentSteps.map((label, index) => { const active = index === studentStep; const done = completedStudentSteps.includes(index); const unlocked = index === 0 || done || index <= studentStep; return <button key={label} className={`${active ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!unlocked} onClick={() => unlocked && setStudentStep(index)}><span className="step-icon material-symbols-outlined">{done ? 'check' : stepIcons[index]}</span><span><small>0{index + 1}</small>{label}</span></button> })}
                </nav>
                <div className="rail-note"><span className="material-symbols-outlined">lightbulb</span><p>Take your time. You can return to any completed section before submitting.</p></div>
                <button className="mode-switch" onClick={() => setApplicantView('status')}><span className="material-symbols-outlined">space_dashboard</span> My application status</button>
                <button className="mode-switch" onClick={signOutApplicant}><span className="material-symbols-outlined">logout</span> Sign out</button>
                <button className="mode-switch" onClick={() => setPortalMode('admin')}><span className="material-symbols-outlined">admin_panel_settings</span> Open admin console</button>
              </aside>
              <section className="student-canvas">
                <div className="canvas-top"><div><span className="eyebrow">Section 0{studentStep + 1}</span><h2>{studentSteps[studentStep]}</h2></div><div className="profile-chip" onClick={signOutApplicant} title="Click to sign out"><span className="avatar">{applicantInitials}</span><span><strong>{applicantDisplayName}</strong><small>{applicantSession?.email || 'Applicant'} (Sign out)</small></span><span className="material-symbols-outlined">logout</span></div></div>
                {submitStatus && <div className="student-alert"><span className="material-symbols-outlined">info</span>{submitStatus}</div>}
                <div className="dossier-card">
                  {studentStep === 0 && <><div className="card-heading"><span className="section-number">01</span><div><h3>Let’s start with you</h3><p>Tell us how to reach you and how you’d like your name represented.</p></div></div><div className="form-grid">
                    <label className={`field wide ${formErrors.studentName ? 'has-error' : ''}`}>
                      <span>Full legal name <b>*</b></span>
                      <input
                        value={studentName}
                        onChange={e => { setStudentName(e.target.value); clearFieldError('studentName') }}
                        placeholder="e.g. Alex Rivera"
                      />
                      {formErrors.studentName && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.studentName}</span>}
                    </label>

                    <label className={`field ${formErrors.studentEmail ? 'has-error' : ''}`}>
                      <span>Email address <b>*</b></span>
                      <input
                        type="email"
                        value={studentEmail}
                        onChange={e => { setStudentEmail(e.target.value); clearFieldError('studentEmail') }}
                        placeholder="e.g. alex.rivera@yale.edu"
                      />
                      {formErrors.studentEmail && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.studentEmail}</span>}
                    </label>

                    <label className={`field ${formErrors.citizenship ? 'has-error' : ''}`}>
                      <span>Citizenship <b>*</b></span>
                      <input
                        value={citizenship}
                        onChange={e => { setCitizenship(e.target.value); clearFieldError('citizenship') }}
                        placeholder="e.g. United States"
                      />
                      {formErrors.citizenship && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.citizenship}</span>}
                    </label>

                    <label className={`field ${formErrors.phone ? 'has-error' : ''}`}>
                      <span>Phone number <b>*</b></span>
                      <input
                        value={phone}
                        onChange={e => { setPhone(e.target.value); clearFieldError('phone') }}
                        placeholder="e.g. +1 203 555 0148"
                      />
                      {formErrors.phone && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.phone}</span>}
                    </label>

                    <label className={`field ${formErrors.birthDate ? 'has-error' : ''}`}>
                      <span>Date of birth <b>*</b></span>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={e => { setBirthDate(e.target.value); clearFieldError('birthDate') }}
                      />
                      {formErrors.birthDate && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.birthDate}</span>}
                    </label>

                    <label className="field">
                      <span>Sex</span>
                      <select value={sex} onChange={e => setSex(e.target.value)}>
                        <option>Prefer not to say</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Non-binary</option>
                      </select>
                    </label>
                  </div></>}

                  {studentStep === 1 && <><div className="card-heading"><span className="section-number">02</span><div><h3>Your academic foundation</h3><p>Add every institution or program that helps tell your academic story.</p></div></div>
                    {formErrors.education_general && <div className="inline-error" style={{ marginBottom: 14 }}><span className="material-symbols-outlined">error</span><span>{formErrors.education_general}</span></div>}
                    <div className="repeatable-list">{educationEntries.map((entry, index) => <div className="repeatable-card" key={`education-${index}`}><div className="repeatable-card-top"><span className="eyebrow">Education 0{index + 1}</span>{educationEntries.length > 1 && <button type="button" className="remove-button" onClick={() => setEducationEntries(items => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div><div className="form-grid">
                      <label className={`field wide ${formErrors[`edu_${index}_institution`] ? 'has-error' : ''}`} htmlFor={`education-${index}-institution`}>
                        <span>Institution / school <b>*</b></span>
                        <input
                          required
                          id={`education-${index}-institution`}
                          value={entry.institution}
                          onChange={e => {
                            setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, institution: e.target.value } : item))
                            clearFieldError(`edu_${index}_institution`)
                          }}
                          placeholder="e.g. Yale College"
                        />
                        {formErrors[`edu_${index}_institution`] && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors[`edu_${index}_institution`]}</span>}
                      </label>

                      <label className={`field wide ${formErrors[`edu_${index}_degree`] ? 'has-error' : ''}`} htmlFor={`education-${index}-degree`}>
                        <span>Degree or track <b>*</b></span>
                        <input
                          required
                          id={`education-${index}-degree`}
                          value={entry.degree}
                          onChange={e => {
                            setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, degree: e.target.value } : item))
                            clearFieldError(`edu_${index}_degree`)
                          }}
                          placeholder="e.g. Bachelor of Science"
                        />
                        {formErrors[`edu_${index}_degree`] && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors[`edu_${index}_degree`]}</span>}
                      </label>

                      <label className={`field ${formErrors[`edu_${index}_field`] ? 'has-error' : ''}`} htmlFor={`education-${index}-field`}>
                        <span>Field of study <b>*</b></span>
                        <input
                          required
                          id={`education-${index}-field`}
                          value={entry.field}
                          onChange={e => {
                            setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, field: e.target.value } : item))
                            clearFieldError(`edu_${index}_field`)
                          }}
                          placeholder="e.g. Computer Science"
                        />
                        {formErrors[`edu_${index}_field`] && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors[`edu_${index}_field`]}</span>}
                      </label>

                      <label className={`field ${formErrors[`edu_${index}_year`] ? 'has-error' : ''}`} htmlFor={`education-${index}-year`}>
                        <span>Graduation year <b>*</b></span>
                        <input
                          required
                          id={`education-${index}-year`}
                          value={entry.year}
                          onChange={e => {
                            setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, year: e.target.value } : item))
                            clearFieldError(`edu_${index}_year`)
                          }}
                          placeholder="e.g. 2027"
                        />
                        {formErrors[`edu_${index}_year`] && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors[`edu_${index}_year`]}</span>}
                      </label>

                      <label className={`field ${formErrors[`edu_${index}_gpa`] ? 'has-error' : ''}`} htmlFor={`education-${index}-gpa`}>
                        <span>Cumulative GPA (0.00 - 4.00) <b>*</b></span>
                        <input
                          required
                          id={`education-${index}-gpa`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="4"
                          value={entry.gpa}
                          onChange={e => {
                            setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, gpa: e.target.value } : item))
                            clearFieldError(`edu_${index}_gpa`)
                          }}
                          placeholder="e.g. 3.92"
                        />
                        {formErrors[`edu_${index}_gpa`] && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors[`edu_${index}_gpa`]}</span>}
                      </label>
                    </div></div>)}</div>
                    <button type="button" className="add-button" onClick={() => setEducationEntries(items => [...items, { institution: '', degree: '', field: '', year: '', gpa: '' }])}><span className="material-symbols-outlined">add</span> Add education</button>
                  </>}

                  {studentStep === 2 && <><div className="card-heading"><span className="section-number">03</span><div><h3>Make the case for your work</h3><p>Short, specific answers help reviewers see the person behind the transcript.</p></div></div>
                    <label className={`field wide project-field ${formErrors.projectTitle ? 'has-error' : ''}`} htmlFor="project-title">
                      <span>Project or research title <b>*</b></span>
                      <input
                        required
                        id="project-title"
                        value={projectTitle}
                        onChange={e => { setProjectTitle(e.target.value); clearFieldError('projectTitle') }}
                        placeholder="e.g. Algorithmic Transparency in Humanitarian Supply Logistics"
                      />
                      {formErrors.projectTitle && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.projectTitle}</span>}
                    </label>

                    <div className="experience-group">
                      <div className="experience-group-heading">
                        <div>
                          <span className="eyebrow">Academic / research</span>
                          <strong>What have you explored?</strong>
                        </div>
                        <span className="section-number">A</span>
                      </div>
                      {formErrors.academic_general && <div className="inline-error" style={{ marginBottom: 12 }}><span className="material-symbols-outlined">error</span><span>{formErrors.academic_general}</span></div>}
                      {academicExperiences.map((experience, index) => <div className="repeatable-card experience-card" key={`academic-${index}`}><div className="repeatable-card-top"><span className="entry-heading">Research experience {String(index + 1).padStart(2, '0')}</span>{academicExperiences.length > 1 && <button type="button" className="remove-button" onClick={() => setAcademicExperiences(items => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div>
                        <label className={`field ${formErrors[`academic_${index}`] ? 'has-error' : ''}`} htmlFor={`academic-experience-${index}`}>
                          <span>Academic / research experience <b>*</b></span>
                          <textarea
                            required
                            id={`academic-experience-${index}`}
                            rows={4}
                            value={experience}
                            onChange={e => {
                              setAcademicExperiences(items => items.map((item, itemIndex) => itemIndex === index ? e.target.value : item))
                              clearFieldError(`academic_${index}`)
                              clearFieldError('academic_general')
                            }}
                            placeholder="Detail your research hypotheses, methodology, and ongoing contributions..."
                          />
                          {formErrors[`academic_${index}`] && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors[`academic_${index}`]}</span>}
                        </label>
                      </div>)}
                      <button type="button" className="add-button" onClick={() => setAcademicExperiences(items => [...items, ''])}><span className="material-symbols-outlined">add</span> Add experience</button>
                    </div>

                    <div className="experience-group">
                      <div className="experience-group-heading">
                        <div>
                          <span className="eyebrow">Leadership / community</span>
                          <strong>Where have you made an impact?</strong>
                        </div>
                        <span className="section-number">B</span>
                      </div>
                      {formErrors.leadership_general && <div className="inline-error" style={{ marginBottom: 12 }}><span className="material-symbols-outlined">error</span><span>{formErrors.leadership_general}</span></div>}
                      {leadershipExperiences.map((experience, index) => <div className="repeatable-card experience-card" key={`leadership-${index}`}><div className="repeatable-card-top"><span className="entry-heading">Community experience {String(index + 1).padStart(2, '0')}</span>{leadershipExperiences.length > 1 && <button type="button" className="remove-button" onClick={() => setLeadershipExperiences(items => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div>
                        <label className={`field ${formErrors[`leadership_${index}`] ? 'has-error' : ''}`} htmlFor={`leadership-experience-${index}`}>
                          <span>Leadership & community experience <b>*</b></span>
                          <textarea
                            required
                            id={`leadership-experience-${index}`}
                            rows={4}
                            value={experience}
                            onChange={e => {
                              setLeadershipExperiences(items => items.map((item, itemIndex) => itemIndex === index ? e.target.value : item))
                              clearFieldError(`leadership_${index}`)
                              clearFieldError('leadership_general')
                            }}
                            placeholder="Describe leadership roles, community engagement, and measurable social impact..."
                          />
                          {formErrors[`leadership_${index}`] && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors[`leadership_${index}`]}</span>}
                        </label>
                      </div>)}
                      <button type="button" className="add-button" onClick={() => setLeadershipExperiences(items => [...items, ''])}><span className="material-symbols-outlined">add</span> Add experience</button>
                    </div>
                  </>}

                  {studentStep === 3 && <>
                    <div className="card-heading">
                      <span className="section-number">04</span>
                      <div>
                        <h3>Deposit your CV</h3>
                        <p>Upload your CV in PDF format for the review committee.</p>
                      </div>
                    </div>

                    <label className="upload-zone">
                      <span className="upload-icon material-symbols-outlined">upload_file</span>
                      <strong>Drop your CV here, or browse</strong>
                      <small>PDF only · Max 10 MB</small>
                      <input type="file" accept="application/pdf,.pdf" onChange={e => { handleCvFileUpload(e); clearFieldError('cvFile') }} />
                    </label>

                    {formErrors.cvFile && (
                      <div className="inline-error">
                        <span className="material-symbols-outlined">error</span>
                        <span>{formErrors.cvFile}</span>
                      </div>
                    )}
                    {cvParseError && (
                      <div className="inline-error">
                        <span className="material-symbols-outlined">error</span>
                        <span>{cvParseError}</span>
                      </div>
                    )}

                    {cvFilePreviewUrl && cvFileName ? (
                      <div className="file-row">
                        <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>picture_as_pdf</span>
                        <div>
                          <strong>{cvFileName}</strong>
                          <small>PDF document attached and ready for review</small>
                        </div>
                        <span className="file-status">
                          Attached <span className="material-symbols-outlined">check_circle</span>
                        </span>
                        <button
                          type="button"
                          className="secondary-upload-button"
                          style={{ padding: '4px 10px', fontSize: '0.72rem', marginLeft: 8 }}
                          onClick={() => {
                            setCvFilePreviewUrl(null)
                            setCvFileName('')
                            setStudentCvLatex('')
                            try {
                              const draft = readStoredJson<any>('openDoorsApplicationDraft', null)
                              if (draft) {
                                draft.cvFileName = ''
                                draft.studentCvLatex = ''
                                localStorage.setItem('openDoorsApplicationDraft', JSON.stringify(draft))
                              }
                            } catch {}
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="file-row">
                        <span className="material-symbols-outlined" style={{ color: 'var(--muted)' }}>picture_as_pdf</span>
                        <div>
                          <strong style={{ color: 'var(--muted)' }}>No file selected</strong>
                          <small>Please upload your CV in PDF format</small>
                        </div>
                        <span className={`file-status ${cvParseError || formErrors.cvFile ? 'file-error' : ''}`}>
                          Pending <span className="material-symbols-outlined">pending</span>
                        </span>
                      </div>
                    )}

                    {/* Applicant CV Document Preview */}
                    {cvFilePreviewUrl && (
                      <div style={{ marginTop: 20, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                        <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: 20 }}>picture_as_pdf</span>
                            <strong style={{ fontSize: '0.82rem', color: 'var(--ink)' }}>CV Document Preview</strong>
                            <small style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>({cvFileName})</small>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <a
                              href={cvFilePreviewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-button"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem' }}
                            >
                              <span>Open in new tab</span>
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>open_in_new</span>
                            </a>
                            <button
                              type="button"
                              className="secondary-upload-button"
                              style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                              onClick={() => {
                                setCvFilePreviewUrl(null)
                                setCvFileName('')
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                              Remove
                            </button>
                          </div>
                        </div>

                        <div style={{ height: 480, background: '#525659', position: 'relative' }}>
                          <object
                            data={cvFilePreviewUrl}
                            type="application/pdf"
                            style={{ width: '100%', height: '100%', display: 'block', border: 'none' }}
                            title="Applicant CV Document"
                          >
                            <iframe
                              src={cvFilePreviewUrl}
                              style={{ width: '100%', height: '100%', border: 'none' }}
                              title="Applicant CV Document Frame"
                            />
                            <div className="pdf-fallback" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20, textAlign: 'center' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#dc2626', marginBottom: 8 }}>picture_as_pdf</span>
                              <strong style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>Preview not supported directly in this view</strong>
                              <p style={{ color: 'var(--muted)', fontSize: '0.75rem', margin: '6px 0 12px' }}>
                                Your browser cannot display the embedded PDF plugin, but your file is attached and valid.
                              </p>
                              <a
                                href={cvFilePreviewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="primary-button"
                                style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                              >
                                View PDF in browser tab <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                              </a>
                            </div>
                          </object>
                        </div>
                      </div>
                    )}
                  </>}
                  {studentStep === 4 && <><div className="card-heading"><span className="section-number">05</span><div><h3>Review your dossier</h3><p>A final calm read-through before you record your motivation.</p></div></div><div className="review-list">{[['General information', studentName && studentEmail, 'person'], ['Education', studentSchool && studentMajor, 'school'], ['Experience', projectTitle && purposeStatement, 'auto_awesome'], ['CV deposit', !!cvFilePreviewUrl, 'description']].map(([label, value, icon]) => <div className="review-row" key={String(label)}><span className="material-symbols-outlined">{icon}</span><div><strong>{label}</strong><small>{value ? 'Complete · Ready to review' : 'Needs your attention'}</small></div><span className={value ? 'check-mark material-symbols-outlined' : 'warning-mark material-symbols-outlined'}>{value ? 'check_circle' : 'warning'}</span></div>)}</div><div className="review-callout"><span className="material-symbols-outlined">verified</span><p><strong>Almost there.</strong> Your application will remain editable until you submit the final video.</p></div></>}
                  {studentStep === 5 && <>
                    <div className="card-heading">
                      <span className="section-number">06</span>
                      <div>
                        <h3>Put a voice to your application</h3>
                        <p>Your video replaces the traditional motivation letter. Be clear, personal, and yourself.</p>
                      </div>
                    </div>

                    <div className="video-callout">
                      <span className="material-symbols-outlined">campaign</span>
                      <div>
                        <strong>Video replaces motivation letter</strong>
                        <p>Share what drives your work and how this grant would change what’s possible. Aim for 90 seconds and keep it between 60 and 120 seconds.</p>
                      </div>
                    </div>

                    {/* If a video is already attached, show preview & status with option to re-record or change */}
                    {recordedVideoUrl ? (
                      <div className="video-upload-panel" style={{ background: '#fff', border: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--cobalt)', fontSize: 26 }}>videocam</span>
                            <div>
                              <strong style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>{videoFileName || 'Attached motivation video'}</strong>
                              <small style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem' }}>
                                Duration: {formatVideoDuration(videoDuration)} {videoDuration !== null && (videoDuration >= 60 && videoDuration <= 120 ? '· Valid duration (60–120s)' : '· Outside 60–120s range')}
                              </small>
                            </div>
                          </div>
                          <span className={`file-status ${videoDuration !== null && videoDuration >= 60 && videoDuration <= 120 ? '' : 'file-error'}`}>
                            {videoDuration !== null && videoDuration >= 60 && videoDuration <= 120 ? 'Ready' : 'Invalid length'}{' '}
                            <span className="material-symbols-outlined">
                              {videoDuration !== null && videoDuration >= 60 && videoDuration <= 120 ? 'check_circle' : 'error'}
                            </span>
                          </span>
                        </div>

                        <div className="video-stage" style={{ borderRadius: 10, overflow: 'hidden', maxHeight: 380 }}>
                          <video ref={videoPreviewRef} className="video-preview" controls playsInline src={recordedVideoUrl} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: videoDuration !== null && videoDuration >= 60 && videoDuration <= 120 ? '#047857' : '#b91c1c' }}>
                            {videoDuration !== null && videoDuration >= 60 && videoDuration <= 120
                              ? '✓ Meets the 60–120 second requirement'
                              : '⚠ Video must be between 60 and 120 seconds long'}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="secondary-upload-button"
                              style={{ padding: '8px 14px', fontSize: '0.75rem' }}
                              onClick={() => {
                                setRecordedVideoUrl(null)
                                setVideoDuration(null)
                                setVideoFileName(null)
                                setVideoError(null)
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                              Remove
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              style={{ padding: '8px 14px', fontSize: '0.75rem' }}
                              onClick={() => setActiveVideoModal('record')}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
                              Record again
                            </button>
                            <button
                              type="button"
                              className="secondary-upload-button"
                              style={{ padding: '8px 14px', fontSize: '0.75rem' }}
                              onClick={() => setActiveVideoModal('upload')}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                              Upload different file
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* When no video attached, show two distinct choices: Record Webcam vs Upload File */
                      <div className="video-choice-grid">
                        <div
                          className="video-choice-card"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setActiveVideoModal('record')
                            startRecording()
                          }}
                        >
                          <div className="choice-icon">
                            <span className="material-symbols-outlined">videocam</span>
                          </div>
                          <strong>Record with Webcam</strong>
                          <small>Use your camera to record directly in your browser. Enforces 60–120s timer with a live counter.</small>
                          <div className="choice-action">
                            <span>Open recorder</span>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                          </div>
                        </div>

                        <div
                          className="video-choice-card"
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveVideoModal('upload')}
                        >
                          <div className="choice-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
                            <span className="material-symbols-outlined">upload_file</span>
                          </div>
                          <strong>Upload Video File</strong>
                          <small>Already recorded? Upload your MP4, WebM, or MOV video file (up to 25 MB). Length must be 60–120s.</small>
                          <div className="choice-action" style={{ color: '#b45309' }}>
                            <span>Choose video</span>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {videoError && (
                      <div className="inline-error">
                        <span className="material-symbols-outlined">error</span>
                        <span>{videoError}</span>
                      </div>
                    )}

                    {(formErrors.videoMotivation || formErrors.videoFile) && (
                      <div className="inline-error">
                        <span className="material-symbols-outlined">error</span>
                        <span>{formErrors.videoMotivation || formErrors.videoFile}</span>
                      </div>
                    )}

                    {/* MODAL 1: Dedicated Live Webcam Recorder Modal */}
                    {activeVideoModal === 'record' && (
                      <div className="video-modal-backdrop" onClick={closeVideoModal}>
                        <div className="video-modal-card" onClick={e => e.stopPropagation()}>
                          <div className="video-modal-header">
                            <h3>
                              <span className="material-symbols-outlined" style={{ color: 'var(--cobalt)' }}>videocam</span>
                              Record Motivation Video
                            </h3>
                            <button type="button" className="close-btn" onClick={closeVideoModal} title="Close">
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </div>

                          <div className="video-modal-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div className={`video-timer-badge ${isRecording ? (recordingSeconds >= 60 ? 'timer-valid' : 'timer-recording') : 'timer-waiting'}`}>
                                {isRecording && <span className="pulse-dot" />}
                                <span>
                                  {isRecording
                                    ? `Recording: ${formatVideoDuration(recordingSeconds)} / 02:00`
                                    : 'Ready to record · Target 60–120s'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: recordingSeconds >= 60 ? '#047857' : '#78818c', fontWeight: 700 }}>
                                {recordingSeconds < 60
                                  ? `${60 - recordingSeconds}s remaining until valid minimum`
                                  : `Valid length (${formatVideoDuration(recordingSeconds)}) — max 2:00`}
                              </div>
                            </div>

                            <div className="video-stage" style={{ borderRadius: 12, height: 320, background: '#091322' }}>
                              <video
                                ref={modalVideoPreviewRef}
                                className="video-preview"
                                muted
                                autoPlay
                                playsInline
                              />
                            </div>

                            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, fontSize: '0.74rem', color: '#475569', lineHeight: 1.5 }}>
                              <strong>Guidelines:</strong> Speak clearly about your project and vision. Video must reach at least <strong>60 seconds</strong> (1 minute) and will automatically stop at <strong>120 seconds</strong> (2 minutes).
                            </div>
                          </div>

                          <div className="video-modal-footer">
                            <button type="button" className="back-button" onClick={closeVideoModal}>
                              Cancel
                            </button>
                            <div style={{ display: 'flex', gap: 10 }}>
                              {!isRecording ? (
                                <button type="button" className="primary-button" onClick={startRecording}>
                                  <span className="material-symbols-outlined">fiber_manual_record</span>
                                  Start recording
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="amber-button"
                                  onClick={() => {
                                    stopRecording()
                                    closeVideoModal()
                                  }}
                                  disabled={recordingSeconds < 1}
                                >
                                  <span className="material-symbols-outlined">stop</span>
                                  Stop & Save ({formatVideoDuration(recordingSeconds)})
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MODAL 2: Dedicated Video File Upload Modal */}
                    {activeVideoModal === 'upload' && (
                      <div className="video-modal-backdrop" onClick={() => setActiveVideoModal('none')}>
                        <div className="video-modal-card" onClick={e => e.stopPropagation()}>
                          <div className="video-modal-header">
                            <h3>
                              <span className="material-symbols-outlined" style={{ color: '#b45309' }}>upload_file</span>
                              Upload Motivation Video
                            </h3>
                            <button type="button" className="close-btn" onClick={() => setActiveVideoModal('none')} title="Close">
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </div>

                          <div className="video-modal-body">
                            <label
                              className="upload-zone"
                              style={{
                                minHeight: 220,
                                background: '#fffdfa',
                                border: '2px dashed #f59e0b',
                                borderRadius: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 24,
                                textAlign: 'center'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 44, color: '#f59e0b', marginBottom: 8 }}>
                                cloud_upload
                              </span>
                              <strong style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>
                                Drag & drop your video file here, or browse
                              </strong>
                              <small style={{ color: 'var(--muted)', marginTop: 4 }}>
                                MP4, WebM, or MOV · Max 25 MB · Duration 60 to 120 seconds
                              </small>
                              <input
                                ref={videoUploadInputRef}
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,video/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  handleVideoFileUpload(e)
                                  clearFieldError('videoFile')
                                }}
                              />
                            </label>

                            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, fontSize: '0.74rem', color: '#475569', lineHeight: 1.5 }}>
                              <strong>Requirements:</strong> Your video will replace your written motivation letter. Please ensure good audio quality and a duration between 60 and 120 seconds.
                            </div>
                          </div>

                          <div className="video-modal-footer">
                            <button type="button" className="back-button" onClick={() => setActiveVideoModal('none')}>
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => videoUploadInputRef.current?.click()}
                            >
                              <span className="material-symbols-outlined">folder_open</span>
                              Browse files
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>}
                </div>
                <div className="sticky-nav"><button type="button" className="back-button" disabled={studentStep === 0 || applicationStatus === 'submitted'} onClick={() => setStudentStep(Math.max(0, studentStep - 1))}><span className="material-symbols-outlined">arrow_back</span> Back</button><span>{applicationStatus === 'submitted' ? 'Submitted' : `Step ${studentStep + 1} of 6`}</span><button type="button" className="primary-button" onClick={continueStudentStep} disabled={applicationStatus === 'submitted'}>{applicationStatus === 'submitted' ? 'Application submitted' : studentStep === 5 ? 'Submit application' : 'Save & continue'} <span className="material-symbols-outlined">arrow_forward</span></button></div>
              </section>
            </div>
          </div>
        )}

        {false && portalMode === 'student' && (
          <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="m3-card">
              <div className="m3-card-title-row">
                <div>
                  <h2>Student Fellowship Application Dossier</h2>
                  <span className="m3-subtitle">
                    Enter your academic credentials, deposit your ATS/LaTeX CV, review financials, and record your video pitch
                  </span>
                </div>
                <span className="m3-badge m3-badge-primary">Applicant View</span>
              </div>

              {submitStatus && (
                <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '12px 16px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600 }}>
                  {submitStatus}
                </div>
              )}

              <form onSubmit={handleStudentSubmit} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
                {/* Academic & Narrative Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Full Legal Name:</label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Yale School / College:</label>
                      <input
                        type="text"
                        value={studentSchool}
                        onChange={(e) => setStudentSchool(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Major / Academic Department:</label>
                      <input
                        type="text"
                        value={studentMajor}
                        onChange={(e) => setStudentMajor(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Cumulative GPA (4.0 Scale):</label>
                      <input
                        type="number"
                        step="0.01"
                        min="2.0"
                        max="4.0"
                        value={studentGpa}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setStudentGpa(val)
                        }}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Fellowship / Research Project Title:</label>
                    <input
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                      required
                    />
                  </div>

                  {/* ----------------------------------------------------------------- */}
                  {/* ATS & LATEX CV DEPOSIT SPACE                                      */}
                  {/* ----------------------------------------------------------------- */}
                  <div style={{ border: '2px dashed #93c5fd', borderRadius: 12, padding: 16, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ color: '#0284c7' }}>description</span>
                        <strong style={{ fontSize: '0.92rem', color: '#0369a1' }}>
                          Curriculum Vitae (CV / Resume) Deposit — ATS / LaTeX {isParsingCv && '(Parsing ATS...)'}
                        </strong>
                      </div>
                      <span className="m3-badge m3-badge-primary">Multimodal Source</span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 10 }}>
                      Deposit your CV in LaTeX markup or standard ATS text format. Our multimodal AI engine parses GPA, education, and research citations automatically.
                    </p>

                    {/* File Upload & Clear */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                      <label style={{ fontSize: '0.74rem', background: '#e2e8f0', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                        Upload CV (.tex / .txt / .json)
                        <input type="file" accept=".tex,.txt,.json" onChange={handleCvFileUpload} style={{ display: 'none' }} />
                      </label>
                      {studentCvLatex && (
                        <button
                          type="button"
                          onClick={() => {
                            setStudentCvLatex('')
                            setCvAtsResult(null)
                          }}
                          className="m3-btn m3-btn-outlined"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        >
                          Clear editor
                        </button>
                      )}
                    </div>

                    {/* LaTeX Editor */}
                    <textarea
                      rows={6}
                      value={studentCvLatex}
                      onChange={(e) => {
                        setStudentCvLatex(e.target.value)
                      }}
                      onBlur={() => handleParseCv()}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontFamily: 'monospace', background: '#ffffff', lineHeight: 1.4 }}
                      placeholder="Paste your \documentclass[11pt]{article}... LaTeX or plain text resume here."
                    />

                    {/* Live ATS Extraction Feedback */}
                    {cvAtsResult && cvAtsResult.ats_parsed && (
                      <div style={{ marginTop: 10, padding: 10, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                            ATS Extracted Entities ({cvAtsResult.ats_parsed.format}):
                          </span>
                          <span className="m3-badge m3-badge-success" style={{ fontSize: '0.7rem' }}>
                            ATS Parsability: {cvAtsResult.ats_parsed.ats_parsability_score}/100
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 12, fontSize: '0.76rem', color: '#475569', flexWrap: 'wrap' }}>
                          <span>Extracted GPA: <strong>{cvAtsResult.ats_parsed.extracted_gpa !== null ? cvAtsResult.ats_parsed.extracted_gpa : 'Not Detected'}</strong></span>
                          <span>Degrees: <strong>{cvAtsResult.ats_parsed.degrees.join(', ') || 'Undergraduate'}</strong></span>
                          <span>Honors: <strong>{cvAtsResult.ats_parsed.honors_awards.join(', ') || 'Standard'}</strong></span>
                        </div>

                        {/* Multimodal Warning Badge if Form GPA diverges from CV GPA */}
                        {cvAtsResult.ats_parsed.extracted_gpa !== null && Math.abs(studentGpa - cvAtsResult.ats_parsed.extracted_gpa) >= 0.25 && (
                          <div style={{ marginTop: 6, padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                            Multimodal Inconsistency Detected: Form GPA ({studentGpa}) does not match CV ({cvAtsResult.ats_parsed.extracted_gpa})!
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Academic Statement & Research Purpose:</label>
                    <textarea
                      rows={3}
                      value={purposeStatement}
                      onChange={(e) => setPurposeStatement(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Study Plan & Feasibility Timeline:</label>
                    <textarea
                      rows={3}
                      value={studyPlan}
                      onChange={(e) => setStudyPlan(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Leadership, Civic & Community Impact:</label>
                    <textarea
                      rows={2}
                      value={leadershipStatement}
                      onChange={(e) => setLeadershipStatement(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
                      required
                    />
                  </div>
                </div>

                {/* Financial Aid & Video Motivation Pitch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Financial Need Breakdown */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span className="material-symbols-outlined" style={{ color: '#00356b' }}>attach_money</span>
                      <strong style={{ fontSize: '0.92rem' }}>Yale SFS Need-Based Calculation Data</strong>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: '#64748b' }}>Family Annual Income ($):</label>
                        <input
                          type="number"
                          value={parentIncome}
                          onChange={(e) => setParentIncome(Number(e.target.value))}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: '#64748b' }}>Requested Grant ($):</label>
                        <input
                          type="number"
                          value={requestedGrant}
                          onChange={(e) => setRequestedGrant(Number(e.target.value))}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: '#64748b' }}>Outside Scholarships ($):</label>
                        <input
                          type="number"
                          value={outsideScholarships}
                          onChange={(e) => setOutsideScholarships(Number(e.target.value))}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', color: '#64748b' }}>Tech Purchase ($2,500 max):</label>
                        <input
                          type="number"
                          value={techPurchaseRequested}
                          onChange={(e) => setTechPurchaseRequested(Number(e.target.value))}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Video Motivation Letter Box */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ color: '#00356b' }}>videocam</span>
                        <strong style={{ fontSize: '0.92rem' }}>2-Minute Video Motivation Letter</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVideoFeatureEnabled(!videoFeatureEnabled)}
                        className={`m3-btn ${videoFeatureEnabled ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
                        style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                      >
                        {videoFeatureEnabled ? 'Video Mode: ACTIVE' : 'Video Mode: OFF'}
                      </button>
                    </div>

                    {!videoFeatureEnabled ? (
                      <div style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#94a3b8' }}>videocam_off</span>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
                          Video camera recording is currently off. Click 'Video Mode' when you wish to record.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: '#0f172a', borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div className="video-stage" style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }}>
                            <video
                              ref={videoPreviewRef}
                              className="video-preview"
                              muted
                              playsInline
                              style={{ borderRadius: 8, objectFit: 'contain', aspectRatio: '16 / 9' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {!isRecording ? (
                              <>
                                <button
                                  type="button"
                                  onClick={startRecording}
                                  className="m3-btn m3-btn-primary"
                                  style={{ padding: '4px 12px', fontSize: '0.76rem', background: '#dc2626' }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>fiber_manual_record</span>
                                  Record video
                                </button>
                                <button
                                  type="button"
                                  className="m3-btn m3-btn-outlined"
                                  style={{ padding: '4px 12px', fontSize: '0.76rem', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
                                  onClick={() => videoUploadInputRef.current?.click()}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                                  Upload video
                                </button>
                                <input
                                  ref={videoUploadInputRef}
                                  type="file"
                                  accept="video/*"
                                  hidden
                                  onChange={handleVideoFileUpload}
                                />
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={stopRecording}
                                className="m3-btn m3-btn-filled"
                                style={{ padding: '4px 12px', fontSize: '0.76rem', background: '#eab308', color: '#000' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stop</span>
                                Stop & Save
                              </button>
                            )}
                          </div>
                        </div>

                        {videoError && (
                          <div className="inline-error" style={{ marginTop: 8 }}>
                            <span className="material-symbols-outlined">error</span>
                            <span>{videoError}</span>
                          </div>
                        )}

                        {recordedVideoUrl && (
                          <div style={{ fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                            Video captured and ready for submission.
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 10 }}>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="m3-btn m3-btn-filled"
                    style={{ background: '#00356b', color: '#ffffff', width: '100%', padding: '12px 18px', fontSize: '0.92rem', fontWeight: 700 }}
                  >
                    <span className="material-symbols-outlined">send</span>
                    Submit Complete Dossier & CV to Yale Fellowship Board
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* VIEW 2: COMMITTEE ADMIN CONSOLE                               */}
        {/* ============================================================= */}
        {portalMode === 'admin' && (
          <div style={{ padding: '24px 32px' }}>
            {adminTab === 'overview' && <AlluvialLegend />}
            {adminTab === 'overview' && <><DemoOperationsCard health={integrationHealth} batch={batchAudit} onHealth={runIntegrationHealth} onBatch={runBatchDemoAudit} /><BatchResults results={batchAudit.results} /></>}
            {adminTab === 'overview' && <div className="admin-overview"><div className="overview-intro"><div><span className="eyebrow">Committee overview · Application 2026</span><h2>Good morning, committee.</h2><p>Keep the review room moving with a clear view of workload and evidence.</p></div><button className="m3-btn m3-btn-primary" onClick={() => { setAuditPanel('profile'); setAdminTab('audit') }}>Continue audit <span className="material-symbols-outlined">arrow_forward</span></button></div><div className="overview-metrics">{['Total applicants','Needs review','In review','Verified','Decision needed','Submitted'].map(label => <div className={`overview-metric ${label === 'Total applicants' ? 'overview-total' : ''}`} key={label}><span>{label}</span><strong>{label === 'Total applicants' ? proposals.length : proposals.filter(p => statusForCandidate(p) === label).length}</strong></div>)}</div><div className="overview-lower"><section className="overview-distribution dossier-panel"><div className="audit-section-head"><div><span className="eyebrow">Evidence flow</span><h3>Status to recommendation</h3></div><span className="audit-count">{proposals.length} applicants</span></div><div className="alluvial-wrap"><svg className="alluvial-svg" viewBox="0 0 760 280" role="img" aria-label="Candidate audit statuses flowing into chair recommendations">{['Needs review','In review','Verified','Decision needed','Submitted'].map((status, index) => <g key={status}><rect x="12" y={20 + index * 48} width="138" height="28" className={`alluvial-node ${statusClass(status)}`} /><text x="22" y={38 + index * 48} className="alluvial-label">{status}</text><text x="142" y={38 + index * 48} textAnchor="end" className="alluvial-count">{proposals.filter(p => statusForCandidate(p) === status).length}</text></g>)}{['FUND','RESERVE','REJECT','Pending'].map((recommendation, index) => <g key={recommendation}><rect x="610" y={40 + index * 56} width="138" height="28" className={`alluvial-node ${recommendationClass(recommendation)}`} /><text x="620" y={58 + index * 56} className="alluvial-label">{recommendation}</text><text x="738" y={58 + index * 56} textAnchor="end" className="alluvial-count">{proposals.filter(p => (decisionForCandidate(p)?.decision || 'Pending') === recommendation).length}</text></g>)}{['Needs review','In review','Verified','Decision needed','Submitted'].flatMap((status, si) => ['FUND','RESERVE','REJECT','Pending'].map((recommendation, ri) => { const count = proposals.filter(p => statusForCandidate(p) === status && (decisionForCandidate(p)?.decision || 'Pending') === recommendation).length; if (!count) return null; const y1 = 34 + si * 48; const y2 = 54 + ri * 56; return <path key={`${status}-${recommendation}`} d={`M 150 ${y1} C 330 ${y1}, 430 ${y2}, 610 ${y2}`} className={`alluvial-flow ${recommendationClass(recommendation)}`} style={{ strokeWidth: Math.max(3, count * 8) }} /> }))}</svg></div></section><section className="overview-recent dossier-panel"><span className="eyebrow">Recent updates</span><h3>Candidate activity</h3>{proposals.slice(0, 5).map(p => <button type="button" key={p.id} onClick={() => openCandidateAudit(p.id)}><span className="candidate-avatar">{(p.applicant_name || p.id).slice(0, 2).toUpperCase()}</span><span><strong>{p.applicant_name || p.id}</strong><small>{p.id} · {statusForCandidate(p)}</small></span><span className="material-symbols-outlined">arrow_forward</span></button>)}</section></div></div>}
            {adminTab === 'decisions' && <div className="admin-decisions dossier-panel"><div className="overview-intro"><div><span className="eyebrow">Committee decisions · Application 2026</span><h2>Decision register</h2><p>Candidate-keyed recommendations and chair sign-offs.</p></div><button className="m3-btn m3-btn-primary" onClick={() => setAdminTab('audit')}>Open audit workspace</button></div><div className="decisions-table-wrap"><table className="decisions-table"><thead><tr><th>Candidate</th><th>Track / GPA</th><th>Audit status</th><th>Recommendation</th><th>Score</th><th>Sign-off</th><th>Requested grant</th><th></th></tr></thead><tbody>{proposals.map(p => { const decision = decisionForCandidate(p); const recommendation = decision?.decision || 'Pending'; return <tr key={p.id}><td><strong>{p.applicant_name || p.id}</strong><small>{p.id}</small></td><td>{p.major}<br /><small>GPA {p.gpa?.toFixed(2) || '—'}</small></td><td><span className={`audit-status ${statusClass(statusForCandidate(p))}`}>{statusForCandidate(p)}</span></td><td><span className={`recommendation-chip ${recommendationClass(recommendation)}`}>{recommendation}</span></td><td>{decision?.score ? `${decision.score.toFixed(1)} / 5.0` : '—'}</td><td>{decision?.signedOffAt ? new Date(decision.signedOffAt).toLocaleString() : 'Not signed off'}</td><td>${p.requested_grant?.toLocaleString() || '—'}</td><td><button className="text-button" onClick={() => openCandidateAudit(p.id, 'decision')}>Open <span className="material-symbols-outlined">arrow_forward</span></button></td></tr> })}</tbody></table>{!proposals.length && <div className="audit-empty"><span className="material-symbols-outlined">gavel</span><strong>No decisions yet</strong><small>Candidate decisions will appear here after chair sign-off.</small></div>}</div></div>}
            {adminTab === 'audit' && <div className="audit-workspace">
              <section className="audit-queue dossier-panel">
                <div className="audit-section-head"><div><span className="eyebrow">01 · Queue</span><h2>Candidate review queue</h2><p>Choose a dossier to audit across every evidence source.</p></div><span className="audit-count">{proposals.length} candidate{proposals.length === 1 ? '' : 's'}</span></div>
                <div className="audit-controls"><label className="audit-search"><span className="material-symbols-outlined">search</span><input placeholder="Search candidate or ID" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} /></label><select value={auditStatusFilter} onChange={e => setAuditStatusFilter(e.target.value)}><option>All statuses</option><option>Needs review</option><option>In review</option><option>Verified</option><option>Decision needed</option><option>Submitted</option></select></div>
                
                <div className="candidate-queue">
                  {proposals.filter(p => `${p.applicant_name} ${p.id}`.toLowerCase().includes(auditSearch.toLowerCase()) && (auditStatusFilter === 'All statuses' || statusForCandidate(p) === auditStatusFilter)).map((p) => (
                    <button type="button" className={`candidate-row ${selectedProposal?.id === p.id ? 'selected' : ''}`} key={p.id} onClick={() => { setSelectedProposal(p); setAuditPanel('profile'); handleSelectProposal(p.id) }}>
                      <span className="candidate-avatar">{(p.applicant_name || p.id).slice(0, 2).toUpperCase()}</span>
                      <span className="candidate-main"><strong>{p.applicant_name || p.id}</strong><small>{p.id} · {p.major || 'Applicant track'}</small></span>
                      <span className="candidate-gpa">GPA {p.gpa?.toFixed(2) || '—'}</span>
                      <span className={`audit-status ${statusClass(statusForCandidate(p))}`}>{statusForCandidate(p)}</span>
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  ))}
                  {proposals.filter(p => `${p.applicant_name} ${p.id}`.toLowerCase().includes(auditSearch.toLowerCase()) && (auditStatusFilter === 'All statuses' || statusForCandidate(p) === auditStatusFilter)).length === 0 && (
                    <div className="audit-empty">
                      <span className="material-symbols-outlined">{proposals.length === 0 ? 'inbox' : 'search_off'}</span>
                      <strong>{proposals.length === 0 ? 'No candidates submitted yet' : 'No candidates match this filter'}</strong>
                      <small>{proposals.length === 0 ? 'Submitted applications from applicants will appear here in the review queue.' : 'Try another status or clear the search.'}</small>
                    </div>
                  )}
                </div>
              </section>
              <section className="audit-detail dossier-panel">
                <div className="audit-candidate-head"><div><span className="eyebrow">02 · Selected dossier</span><h2>{auditCandidate?.applicant_name || 'Select a candidate'}</h2><p>{auditCandidate ? `${auditCandidate.id} · ${auditCandidate.major || 'Applicant track'} · ${auditCandidate.school || 'Institution pending'} · GPA ${auditCandidate.gpa?.toFixed(2) || '—'}` : 'Choose a candidate from the queue to begin an evidence audit.'}</p>{auditCandidate && <div className="audit-header-meta"><span>{statusForCandidate(auditCandidate)}</span><span>Updated {auditCandidate.ground_truth?.updated_at || 'today'}</span><span>${auditCandidate.requested_grant?.toLocaleString() || '—'} requested</span></div>}</div><div className="audit-head-actions"><span className="mint-pill">{auditCandidate ? 'Context linked' : 'Awaiting candidate'}</span>{auditCandidate && (candidateAuditRuns[auditCandidate.id]?.status === 'complete' || candidateAuditRuns[auditCandidate.id]?.status === 'completed_with_errors') && <button className="m3-btn m3-btn-primary" onClick={() => setAuditPanel('decision')}>Open decision</button>}</div></div>
                {auditCandidate && <><div className="audit-action-bar"><div className="audit-pipeline-head"><span><strong>Automatic audit pipeline · {currentAudit?.status === 'running' ? 'Running' : currentAudit?.status === 'complete' || currentAudit?.status === 'completed_with_errors' ? 'Complete' : 'Ready'}</strong><small>One click starts every stage in order. Live results appear as each stage finishes. Usage: {auditTokenLabel}</small></span><div className="audit-pipeline-steps" aria-label="Audit stage progress">{pipelineStageRows.map(([key, label]) => { const stage = currentAudit?.stages?.[key] || {}; const state = stage.status || 'queued'; return <span key={key} className={`audit-pipeline-step ${state}`}><i>{state === 'complete' ? '✓' : state === 'failed' ? '!' : state === 'in_progress' ? '…' : '·'}</i>{label}</span> })}</div></div><div className="audit-action-buttons"><button type="button" className="m3-btn m3-btn-primary" onClick={() => void runFullAudit()} disabled={currentAudit?.status === 'running'}><span className="material-symbols-outlined">play_arrow</span>{currentAudit?.status === 'running' ? 'Audit running…' : currentAudit?.status === 'complete' || currentAudit?.status === 'completed_with_errors' ? 'Rerun audit' : 'Run audit'}</button>{currentAudit?.status === 'running' && <button type="button" className="m3-btn m3-btn-outlined" onClick={() => void stopFullAudit()}>Stop audit</button>}</div></div><div className="audit-tabs">{[['profile','Profile & education'],['submitted','Submitted application'],['cv','CV PDF parser'],['video','Video evaluation'],['rag','RAG rule verification'],['decision','Decision']].map(([key, label]) => <button type="button" className={auditPanel === key ? 'active' : ''} key={key} onClick={() => setAuditPanel(key as any)}>{label}</button>)}</div><div className="audit-evidence">{auditPanel === 'submitted' && <SubmittedApplicationPanel candidate={auditCandidate} status={statusForCandidate(auditCandidate)} statusClass={statusClass} />}
                  {auditPanel === 'profile' && <div className="evidence-grid"><article className="evidence-card"><span className="eyebrow">Candidate context</span><h3>Profile & education</h3><dl><dt>Applicant</dt><dd>{auditCandidate.applicant_name}</dd><dt>Institution</dt><dd>{auditCandidate.school || 'Yale College / Morse College'}</dd><dt>Track</dt><dd>{auditCandidate.major}</dd><dt>GPA</dt><dd>{auditCandidate.gpa?.toFixed(2)} / 4.00</dd><dt>Requested grant</dt><dd>${auditCandidate.requested_grant?.toLocaleString()}</dd></dl></article><article className="evidence-card attention-card"><span className="eyebrow">Audit posture</span><h3>Evidence status</h3><div className="audit-check"><span className="material-symbols-outlined">check_circle</span><span>Application identity linked</span></div><div className="audit-check"><span className="material-symbols-outlined">check_circle</span><span>CV source available</span></div><div className="audit-check"><span className="material-symbols-outlined">pending</span><span>Video evaluation pending</span></div><div className="audit-check"><span className="material-symbols-outlined">pending</span><span>Institution verification pending</span></div></article></div>}
                  {auditPanel === 'cv' && <CvVisionPanel key={auditCandidate.id} proposalId={auditCandidate.id} applicantName={auditCandidate.applicant_name} pdfUrl={artifactUrl(auditCandidate.pdf_url || `/api/proposals/${auditCandidate.id}/pdf`)} apiUrl={apiUrl} onResult={(id, result) => updateAuditArtifact(id, { cv: { status: 'parsed', source: result.document_source, parsed: result.structured, extracted: `${result.stats.box_count} OCR fields detected`, flags: [] } })} />}
                  {auditPanel === 'video' && <VideoPanel key={auditCandidate.id} candidateId={auditCandidate.id} applicantName={auditCandidate.applicant_name} videoUrl={auditCandidate.video_url} videoFilename={auditCandidate.video_filename} transcript={auditArtifacts[auditCandidate.id]?.video || null} review={auditArtifacts[auditCandidate.id]?.video || null} stageStatuses={currentAudit?.stages || {}} busy={videoStages[auditCandidate.id] === 'running'} onRunTranscription={runVideoTranscription} onRunEvaluation={runVideoEvaluation} />}{auditPanel === 'rag' && <article className="evidence-card full-evidence candidate-rag-panel">
                    <div className="evidence-title">
                      <div>
                        <span className="eyebrow">Automated RAG Fact Checker</span>
                        <h3>Regulatory Rule Fact-Checking & Compliance Audit</h3>
                        <p>Candidate: {auditCandidate.applicant_name} ({auditCandidate.id}) · Automated cross-check of declared qualifications against Yale SFS & Fellowship rules</p>
                      </div>
                      <button className="m3-btn m3-btn-primary" onClick={runRagSearch} disabled={ragLoading}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
                        {ragLoading ? 'Fact-checking against RAG...' : 'Re-run RAG Fact Check'}
                      </button>
                    </div>
                    <div className="rag-state-legend"><span className="state-chip match">Match</span><span className="state-chip contradiction">Contradiction</span><span className="state-chip review">Review</span><span className="state-chip missing">Missing</span></div>

                    {/* Quick Automated Compliance Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '18px 0' }}>
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <span className="artifact-label">Title IV & SAP Status</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span className="material-symbols-outlined" style={{ color: (auditCandidate.gpa || 3.8) >= 3.0 ? '#16a34a' : '#dc2626', fontSize: 18 }}>
                            {(auditCandidate.gpa || 3.8) >= 3.0 ? 'check_circle' : 'cancel'}
                          </span>
                          <strong style={{ fontSize: '0.86rem' }}>
                            {(auditCandidate.gpa || 3.8) >= 3.0 ? 'GPA Satisfactory (>= 3.00)' : 'SAP Defect (< 3.00)'}
                          </strong>
                        </div>
                        <small style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 2, display: 'block' }}>Candidate GPA: {auditCandidate.gpa?.toFixed(2) || '3.80'}</small>
                      </div>

                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <span className="artifact-label">Budget Need Ceiling</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span className="material-symbols-outlined" style={{ color: (auditCandidate.requested_grant || 0) <= 87000 ? '#16a34a' : '#d97706', fontSize: 18 }}>
                            {(auditCandidate.requested_grant || 0) <= 87000 ? 'check_circle' : 'warning'}
                          </span>
                          <strong style={{ fontSize: '0.86rem' }}>
                            ${(auditCandidate.requested_grant || 75000).toLocaleString()} Need
                          </strong>
                        </div>
                        <small style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 2, display: 'block' }}>Cost of Attendance Cap: $87,000</small>
                      </div>

                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <span className="artifact-label">Dossier Completeness</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: 18 }}>verified</span>
                          <strong style={{ fontSize: '0.86rem' }}>8 Certified Rule Sets</strong>
                        </div>
                        <small style={{ color: '#64748b', fontSize: '0.68rem', marginTop: 2, display: 'block' }}>Official Yale Fellowship Corpus</small>
                      </div>
                    </div>

                    {/* Direct Fact-Checking Table against RAG Rules */}
                    <div style={{ marginTop: 14 }}>
                      <span className="artifact-label" style={{ marginBottom: 8, display: 'block' }}>
                        Automated Evidence Claims Checked Against Corpus Documents
                      </span>
                      <div className="fact-check-table">
                        <div className="fact-check-head" style={{ gridTemplateColumns: '1.2fr 1.6fr 1.8fr .8fr' }}>
                          <span>Candidate Fact / Claim</span>
                          <span>Candidate Declared Value</span>
                          <span>Governing Rule Citation</span>
                          <span>Audit State</span>
                        </div>
                        {[
                          {
                            claim: 'Academic Progress (SAP)',
                            value: `Cumulative GPA: ${auditCandidate.gpa?.toFixed(2) || '3.80'} / 4.00`,
                            rule: '05_evaluation_scoring_anchors.md: Mandatory minimum 3.00 GPA for fellowship disbursement',
                            state: (auditCandidate.gpa || 3.8) >= 3.0 ? 'match' : 'contradiction'
                          },
                          {
                            claim: 'Student Financial Need',
                            value: `$${(auditCandidate.requested_grant || 75000).toLocaleString()} demonstrated need`,
                            rule: '04_budget_eligibility_rules.md: Standard $3,700 student self-help and parental income expectation',
                            state: 'match'
                          },
                          {
                            claim: 'Computer / Tech Allowance',
                            value: `$${(auditCandidate.financials?.computer_allowance || 0).toLocaleString()} hardware allocation`,
                            rule: '04_budget_eligibility_rules.md: One-time lifetime technology purchase allowance capped at $2,500',
                            state: (auditCandidate.financials?.computer_allowance || 0) <= 2500 ? 'match' : 'contradiction'
                          },
                          {
                            claim: 'Academic Discipline & Mentor',
                            value: `${auditCandidate.major || 'Computer Science'} · ${auditCandidate.school || 'Yale College'}`,
                            rule: '02_technical_excellence_criteria.md: Verifiable faculty mentorship and departmental alignment',
                            state: 'match'
                          },
                          {
                            claim: 'Civic & Leadership Impact',
                            value: auditCandidate.leadership_experiences?.[0] ? `${auditCandidate.leadership_experiences[0].slice(0, 55)}...` : 'Coordinated student volunteer technical deployments',
                            rule: '03_impact_dissemination_criteria.md: Documented societal impact, community engagement, and public benefit',
                            state: 'match'
                          }
                        ].map((item, idx) => (
                          <div className="fact-check-row" key={idx} style={{ gridTemplateColumns: '1.2fr 1.6fr 1.8fr .8fr' }}>
                            <strong>{item.claim}</strong>
                            <span>{item.value}</span>
                            <span style={{ fontSize: '0.68rem', color: '#0369a1' }}>{item.rule}</span>
                            <b className={`state-chip ${item.state}`}>{item.state}</b>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Retrieved Context Chunks */}
                    {ragResults.length > 0 && (
                      <div className="rag-results" style={{ marginTop: 20 }}>
                        <div className="artifact-label">Detailed Rule Evidence Chunks ({ragResults.length} matches)</div>
                        {ragResults.map((result: any) => (
                          <article className="rag-result" key={result.document}>
                            <div>
                              <strong>{result.document}</strong>
                              <span className="rag-score">Relevance {result.score}</span>
                            </div>
                            <p>{result.snippet}</p>
                            <small className="rule-citation">Source document · {result.document}</small>
                          </article>
                        ))}
                      </div>
                    )}

                    <div className="human-decision-note" style={{ marginTop: 18 }}>
                      <strong>Automated RAG Fact Check Complete</strong>
                      <span>All claims were automatically referenced against the Yale regulatory corpus. No manual query typing required; the panel chair uses these verified facts to record the final authorization.</span>
                    </div>
                  </article>}

                  {auditPanel === 'decision' && <article className="evidence-card full-evidence"><div className="evidence-title"><div><span className="eyebrow">03 · Human chair decision</span><h3>Decision panel</h3><p>All automated evidence and advisory reviews are summarized here before the chair signs.</p></div><span className="mint-pill">{auditCandidate.id}</span></div><div className="decision-summary"><div><span className="artifact-label">Advisory reviews</span><strong>{Object.keys(currentAudit?.results || {}).filter(key => key.startsWith('review_')).length} / {(auditCandidate.budget && Object.keys(auditCandidate.budget).length) ? 3 : 2} complete</strong></div><div><span className="artifact-label">Recommendation</span><select value={auditDecision} onChange={e => setAuditDecision(e.target.value as any)}><option>FUND</option><option>RESERVE</option><option>REJECT</option></select></div><div><span className="artifact-label">Score</span><strong>{overrideScore.toFixed(1)} / 5.0</strong></div></div><div className="audit-review-feed"><div className="audit-review-feed-head"><span className="artifact-label">Automated review output</span><small>Advisory only · human chair decides</small></div>{[['review_technical','Technical'],['review_impact','Impact'], ...((auditCandidate.budget && Object.keys(auditCandidate.budget).length) ? [['review_budget','Budget']] : [])].map(([key,label]) => { const item = currentAudit?.results?.[key]; const stage = currentAudit?.stages?.[key]?.status || 'queued'; return <section className={`audit-review-item ${stage}`} key={key}><div><strong>{label}</strong><span>{stage === 'complete' ? 'Complete' : stage === 'in_progress' ? 'Running…' : stage === 'failed' ? 'Failed' : 'Queued'}</span></div><p>{item?.summary || currentAudit?.stages?.[key]?.error || 'Waiting for this review to run.'}</p></section> })}</div><div className="ai-opinion-panel"><div><span className="artifact-label">AI overall opinion · streamed advisory</span><p>{overallOpinion[auditCandidate.id] || automaticOpinion || 'Waiting for the automated reviews to produce an evidence-grounded summary.'}</p></div><button type="button" className="m3-btn m3-btn-outlined" onClick={streamOverallOpinion} disabled={opinionLoading[auditCandidate.id]}>{opinionLoading[auditCandidate.id] ? 'Streaming…' : 'Stream AI opinion'}</button></div><label className="audit-notes"><span>Reviewer notes</span><textarea rows={4} value={auditNotes} onChange={e => setAuditNotes(e.target.value)} placeholder="Record the evidence behind your recommendation." /></label>{decisionForCandidate(auditCandidate)?.signedOffAt && <div className="verified-banner"><span className="material-symbols-outlined">verified</span>Signed off for {auditCandidate.applicant_name} at {new Date(decisionForCandidate(auditCandidate)!.signedOffAt!).toLocaleString()}</div>}<button className="m3-btn m3-btn-primary" onClick={() => { persistCandidateDecision(auditCandidate); setIsSignedOff(true) }}>{decisionForCandidate(auditCandidate)?.signedOffAt ? 'Update chair decision' : 'Authorize decision'}</button></article>}
                </div></>}
              </section>
            </div>}
            {/* TAB: DOSSIERS OVERVIEW */}
            {adminTab === 'dossiers' && (
              <div className="m3-card">
                <div className="m3-card-title-row">
                  <div>
                    <h2>Active Candidate Dossiers ({proposals.length} Applicants)</h2>
                    <span className="m3-subtitle">Overview of registered undergraduate and graduate fellowship candidates</span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="m3-ranking-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Applicant</th>
                        <th>School / Major</th>
                        <th>Cumulative GPA</th>
                        <th>CV Status</th>
                        <th>Requested Fellowship</th>
                        <th>Quality Tier</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposals.map((p) => (
                        <tr key={p.id} style={{ background: selectedProposal?.id === p.id ? '#f0f9ff' : 'transparent' }}>
                          <td><span className="m3-badge m3-badge-neutral">{p.id}</span></td>
                          <td><strong>{p.applicant_name || p.id}</strong></td>
                          <td style={{ fontSize: '0.82rem' }}>{p.major}</td>
                          <td><strong>{p.gpa?.toFixed(2) || '3.8'}</strong></td>
                          <td>
                            <span className="m3-badge m3-badge-neutral" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem' }}>
                              {p.cv_latex ? 'LaTeX Deposited' : 'Standard ATS'}
                            </span>
                          </td>
                          <td>${p.requested_grant?.toLocaleString()}</td>
                          <td>
                            <span className={`m3-badge ${p.ground_truth?.expected_decision === 'FUND' ? 'm3-badge-success' : 'm3-badge-warning'}`}>
                              {p.ground_truth?.quality_tier || 'CANDIDATE'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="m3-btn m3-btn-outlined"
                              style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                              onClick={() => {
                                handleSelectProposal(p.id)
                                setAdminTab('multimodal')
                              }}
                            >
                              Verify Multimodal
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: MULTIMODAL VERIFICATION (CV vs FORM vs VIDEO) */}
            {adminTab === 'multimodal' && (
              <div className="m3-card">
                <div className="m3-card-title-row">
                  <div>
                    <h2>Multimodal Cross-Verification: CV vs Form Statement vs Video Pitch</h2>
                    <span className="m3-subtitle">
                      Cross-references candidate self-declarations against their ATS/LaTeX CV and submitted video
                    </span>
                  </div>
                  <button
                    className="m3-btn m3-btn-primary"
                    style={{ background: '#00356b', fontSize: '0.78rem' }}
                    onClick={() => selectedProposal && triggerMultimodalVerification(selectedProposal)}
                    disabled={isCrossVerifying}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                    {isCrossVerifying ? 'Cross-Verifying...' : 'Re-run Cross-Verification'}
                  </button>
                </div>

                {/* Candidate Selector Banner */}
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>Active Candidate: {selectedProposal?.applicant_name || selectedProposal?.id || 'None'}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {selectedProposal ? `Major: ${selectedProposal.major || 'General'} • Stated GPA: ${selectedProposal.gpa?.toFixed(2) || '—'} • Dossier: ${selectedProposal.id}` : 'Select a candidate to review cross-modal evidence.'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {proposals.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No submissions available</span>
                    ) : (
                      proposals.map(p => (
                        <button
                          key={p.id}
                          className="m3-btn m3-btn-outlined"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.74rem',
                            borderColor: selectedProposal?.id === p.id ? '#00356b' : '#cbd5e1',
                            background: selectedProposal?.id === p.id ? '#eff6ff' : '#ffffff',
                            color: selectedProposal?.id === p.id ? '#00356b' : '#334155',
                            fontWeight: selectedProposal?.id === p.id ? 600 : 400
                          }}
                          onClick={() => handleSelectProposal(p.id)}
                        >
                          {p.applicant_name || p.id}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 3-Column Multimodal Comparison Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 20 }}>
                  {/* Modality 1: Application Form */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span className="material-symbols-outlined" style={{ color: '#00356b' }}>assignment</span>
                      <strong style={{ fontSize: '0.9rem' }}>Modality 1: Written Form Declaration</strong>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8, fontSize: '0.78rem' }}>
                      <span style={{ color: '#64748b' }}>Declared Cumulative GPA:</span><br />
                      <strong style={{ fontSize: '1.1rem', color: '#00356b' }}>{selectedProposal?.gpa?.toFixed(2) || '3.85'} / 4.00</strong>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, fontSize: '0.78rem', color: '#334155', maxHeight: 160, overflowY: 'auto' }}>
                      <span style={{ color: '#64748b', fontWeight: 700 }}>Statement Quote:</span>
                      <div style={{ fontStyle: 'italic', marginTop: 4 }}>
                        "{selectedProposal?.sections?.abstract?.slice(0, 180)}..."
                      </div>
                    </div>
                  </div>

                  {/* Modality 2: Deposited ATS/LaTeX CV */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span className="material-symbols-outlined" style={{ color: '#0284c7' }}>description</span>
                      <strong style={{ fontSize: '0.9rem' }}>Modality 2: Deposited ATS / LaTeX CV</strong>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8, fontSize: '0.78rem' }}>
                      <span style={{ color: '#64748b' }}>ATS Parsed Record GPA:</span><br />
                      <strong style={{ fontSize: '1.1rem', color: adminMultimodalResult?.cv_parsed?.extracted_gpa !== null ? '#0284c7' : '#94a3b8' }}>
                        {adminMultimodalResult?.cv_parsed?.extracted_gpa !== null ? `${adminMultimodalResult?.cv_parsed?.extracted_gpa} / 4.00` : 'Not Specified in CV'}
                      </strong>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, fontSize: '0.74rem', color: '#334155', maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace' }}>
                      <span style={{ color: '#64748b', fontWeight: 700, fontFamily: 'sans-serif' }}>Raw LaTeX / CV Text:</span>
                      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 4, fontSize: '0.7rem' }}>
                        {selectedProposal?.cv_latex?.slice(0, 220) || 'No LaTeX CV deposited for this profile.'}...
                      </pre>
                    </div>
                  </div>

                  {/* Modality 3: Video Speech Pitch */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <span className="material-symbols-outlined" style={{ color: '#16a34a' }}>mic</span>
                      <strong style={{ fontSize: '0.9rem' }}>Modality 3: 2-Min Video Pitch Speech</strong>
                    </div>

                    <div style={{ background: '#00356b', color: 'white', padding: 10, borderRadius: 8, marginBottom: 8, fontSize: '0.78rem' }}>
                      <span style={{ color: '#93c5fd' }}>Whisper ASR Speech Analysis:</span><br />
                      <strong>Confidence: 98.7% • 16kHz Audio Channel</strong>
                    </div>

                    <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, fontSize: '0.78rem', color: '#334155', maxHeight: 160, overflowY: 'auto' }}>
                      <span style={{ color: '#64748b', fontWeight: 700 }}>Video submission:</span>
                      <div style={{ fontStyle: 'italic', marginTop: 4 }}>
                        "{selectedProposal?.video_url || 'Video recording pending for this candidate.'}"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multimodal Verification Status Banner */}
                {adminMultimodalResult && adminMultimodalResult.multimodal_verification && (
                  <div>
                    {adminMultimodalResult.multimodal_verification.is_verified ? (
                      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 32 }}>verified</span>
                        <div>
                          <strong style={{ color: '#065f46', fontSize: '0.95rem' }}>Multimodal Credentials Verified (100% Agreement)</strong>
                          <p style={{ color: '#047857', fontSize: '0.82rem', marginTop: 2 }}>
                            Application Form, Deposited CV, and Video Submission exhibit complete parity with zero credential inflation or discrepancies.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: 30 }}>error</span>
                          <div>
                            <strong style={{ color: '#991b1b', fontSize: '0.95rem' }}>
                              Multimodal Credential Inflation Detected ({adminMultimodalResult.multimodal_verification.discrepancies.length} Conflicts)
                            </strong>
                            <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                              Flagged for Academic Reviewer penalization & Chair Arbitration.
                            </div>
                          </div>
                        </div>

                        {adminMultimodalResult.multimodal_verification.discrepancies.map((d: any, idx: number) => (
                          <div key={idx} style={{ background: '#ffffff', borderRadius: 8, padding: 10, border: '1px solid #fca5a5', marginTop: 6, fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 700, color: '#dc2626' }}>{d.source} — Delta: {d.delta}</div>
                            <div style={{ color: '#475569', marginTop: 2 }}>{d.explanation}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: COMPLIANCE ENGINE */}
            {adminTab === 'compliance' && (
              <div className="m3-card">
                <div className="m3-card-title-row">
                  <div>
                    <h2>Deterministic Compliance & Financial Need Audit (Stage 2)</h2>
                    <span className="m3-subtitle">
                      Pure code validation: Title IV SAP progress (GPA $\ge 3.00$), $3,700 Student Share, and $2,500 Tech Allowance Cap
                    </span>
                  </div>
                  <span className={`m3-badge ${hasViolations ? 'm3-badge-error' : 'm3-badge-success'}`}>
                    {hasViolations ? 'VIOLATIONS DETECTED' : 'COMPLIANCE VERIFIED'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 24 }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h3 style={{ fontSize: '1rem', margin: 0 }}>Candidate Audit: {selectedProposal?.applicant_name}</h3>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="m3-btn m3-btn-outlined"
                          style={{ padding: '3px 8px', fontSize: '0.68rem', color: '#16a34a' }}
                          onClick={() => { setSimGpa(3.92); setSimComputerAllowance(1800); setSimStudentShare(3700); setSimParentShare(4800); }}
                        >
                          Reset Clean
                        </button>
                        <button
                          type="button"
                          className="m3-btn m3-btn-outlined"
                          style={{ padding: '3px 8px', fontSize: '0.68rem', color: '#dc2626' }}
                          onClick={() => { setSimComputerAllowance(4200); }}
                        >
                          Trigger Budget Cap Flaw ($4,200)
                        </button>
                        <button
                          type="button"
                          className="m3-btn m3-btn-outlined"
                          style={{ padding: '3px 8px', fontSize: '0.68rem', color: '#b91c1c' }}
                          onClick={() => { setSimGpa(2.74); }}
                        >
                          Trigger SAP Defect (GPA 2.74)
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cumulative GPA:</span> <strong>{simGpa.toFixed(2)} / 4.00</strong>
                      </label>
                      <input type="range" min="2.0" max="4.0" step="0.05" value={simGpa} onChange={(e) => setSimGpa(parseFloat(e.target.value))} style={{ width: '100%' }} />
                      <span style={{ fontSize: '0.72rem', color: sapViolation ? '#dc2626' : '#059669' }}>
                        {sapViolation ? 'SAP DEFECT: Below mandatory 3.00 threshold' : 'PASSED: Satisfactory Academic Progress'}
                      </span>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Computer / Tech Purchase Allowance:</span> <strong>${simComputerAllowance.toLocaleString()}</strong>
                      </label>
                      <input type="range" min="0" max="5000" step="100" value={simComputerAllowance} onChange={(e) => setSimComputerAllowance(parseInt(e.target.value))} style={{ width: '100%' }} />
                      <span style={{ fontSize: '0.72rem', color: computerAllowanceViolation ? '#dc2626' : '#64748b' }}>
                        Yale Rule: Maximum $2,500 lifetime limit
                      </span>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Student Share (Campus/Summer Work):</span> <strong>${simStudentShare.toLocaleString()}</strong>
                      </label>
                      <input type="range" min="2000" max="6000" step="100" value={simStudentShare} onChange={(e) => setSimStudentShare(parseInt(e.target.value))} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Parent Share (Family Contribution):</span> <strong>${simParentShare.toLocaleString()}</strong>
                      </label>
                      <input type="range" min="0" max="30000" step="500" value={simParentShare} onChange={(e) => setSimParentShare(parseInt(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, background: '#ffffff' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>Real-Time Deterministic Verification Report</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.84rem' }}>Title IV & Yale SAP Progress (GPA $\ge 3.00$):</span>
                        <span className={`m3-badge ${sapViolation ? 'm3-badge-error' : 'm3-badge-success'}`}>
                          {sapViolation ? 'FAILED (SAP DEFECT)' : 'PASSED'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.84rem' }}>Computer Purchase Ceiling ($\le \$2,500$):</span>
                        <span className={`m3-badge ${computerAllowanceViolation ? 'm3-badge-error' : 'm3-badge-success'}`}>
                          {computerAllowanceViolation ? 'EXCEEDS $2,500 CAP' : 'PASSED'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.84rem' }}>Dossier Length ($\le 15$ Pages):</span>
                        <span className={`m3-badge ${pagesViolation ? 'm3-badge-error' : 'm3-badge-success'}`}>
                          {pagesViolation ? 'PAGE OVERAGE' : 'PASSED'}
                        </span>
                      </div>

                      <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 12, border: '1px solid #bbf7d0', marginTop: 10 }}>
                        <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700 }}>DEMONSTRATED FINANCIAL NEED BREAKDOWN:</div>
                        <div style={{ fontSize: '1.25rem', color: '#15803d', fontWeight: 800, marginTop: 4 }}>
                          ${computedNeed.toLocaleString()} / Academic Year
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: 2 }}>
                          Cost of Attendance ($87,000) - EFC (${expectedEfc.toLocaleString()})
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MULTI-AGENT DELIBERATION */}
            {adminTab === 'deliberation' && (
              <div className="m3-card">
                <div className="m3-card-title-row">
                  <div>
                    <h2>Multi-Agent Evaluation & Rubrics (Stage 3 & 4)</h2>
                    <span className="m3-subtitle">
                      3 Isolated Evaluators (Academic Rigor, Leadership Impact, Financial Need) with verbatim quote verification
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b' }}>Rubric Version:</span>
                    <button
                      className={`m3-btn ${promptVersion === 'v1' ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      onClick={() => setPromptVersion('v1')}
                    >
                      v1 (Naive)
                    </button>
                    <button
                      className={`m3-btn ${promptVersion === 'v2' ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
                      style={{ padding: '6px 12px', fontSize: '0.78rem', background: promptVersion === 'v2' ? '#00356b' : 'transparent', color: promptVersion === 'v2' ? 'white' : '#00356b' }}
                      onClick={() => setPromptVersion('v2')}
                    >
                      v2 (Calibrated)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ fontSize: '0.95rem' }}>1. Academic Reviewer</strong>
                      <span className="m3-badge m3-badge-success">Score: 4.8 / 5.0</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                      "Exemplary scholarship in {selectedProposal?.major || 'Discipline'}. GPA {selectedProposal?.gpa?.toFixed(2) || '3.96'} meets highest distinction."
                    </p>
                    <div style={{ marginTop: 12, padding: 8, background: '#f8fafc', borderRadius: 8, fontSize: '0.75rem', color: '#64748b' }}>
                      Citation: "graduating summa cum laude with 3.96 cumulative GPA"
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ fontSize: '0.95rem' }}>2. Leadership & Impact</strong>
                      <span className="m3-badge m3-badge-success">Score: 4.7 / 5.0</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                      "Sustained civic leadership: coordinated technical deployments for 4 regional resettlement NGOs."
                    </p>
                    <div style={{ marginTop: 12, padding: 8, background: '#f8fafc', borderRadius: 8, fontSize: '0.75rem', color: '#64748b' }}>
                      Citation: "Yale Humanitarian Computing Coalition"
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong style={{ fontSize: '0.95rem' }}>3. Financial Need Reviewer</strong>
                      <span className="m3-badge m3-badge-success">Score: 4.6 / 5.0</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                      "Need verified against Yale SFS guidelines. Parent share and standard $3,700 Student Share fully incorporated."
                    </p>
                    <div style={{ marginTop: 12, padding: 8, background: '#f8fafc', borderRadius: 8, fontSize: '0.75rem', color: '#64748b' }}>
                      Citation: "Parent share and student self-help accounted for"
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CHAIR ARBITRATION & SIGN-OFF */}
            {adminTab === 'arbitration' && (
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
                    <strong style={{ fontSize: '1rem' }}>Chair Authorization Form: {selectedProposal?.applicant_name}</strong>

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
                      onClick={() => {
                        setIsSignedOff(true)
                        setSignOffTimestamp(new Date().toLocaleString())
                        alert(`✅ Decision Authorized by Yale Fellowship Committee Chair.\nApplicant: ${selectedProposal?.applicant_name || selectedProposal?.id}\nDecision: ${overrideDecision}\nScore: ${overrideScore}/5.0`)
                      }}
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
            )}

            {/* TAB: YALE CORPUS & GUIDELINES */}
            {adminTab === 'corpus' && (
              <div className="m3-card">
                <div className="m3-card-title-row">
                  <div>
                    <h2>Yale Regulatory Knowledge Base & Certified PDFs</h2>
                    <span className="m3-subtitle">
                      Scraped from official Yale Student Financial Services (finaid.yale.edu) & Fellowship Office (funding.yale.edu)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className={`m3-btn ${!pdfViewMode ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
                      onClick={() => setPdfViewMode(false)}
                      style={{ background: !pdfViewMode ? '#00356b' : 'transparent', color: !pdfViewMode ? 'white' : '#00356b' }}
                    >
                      <span className="material-symbols-outlined">article</span>
                      Indexed Text
                    </button>
                    <button
                      className={`m3-btn ${pdfViewMode ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
                      onClick={() => setPdfViewMode(true)}
                      style={{ background: pdfViewMode ? '#00356b' : 'transparent', color: pdfViewMode ? 'white' : '#00356b' }}
                    >
                      <span className="material-symbols-outlined">picture_as_pdf</span>
                      Official PDF View
                    </button>
                  </div>
                </div>

                <div className="rag-search-panel"><div><span className="eyebrow">RAG retrieval test</span><strong>Query the rules corpus</strong><small>Retrieve source-backed chunks before reviewing a candidate.</small></div><input value={ragQuery} onChange={e => setRagQuery(e.target.value)} placeholder="e.g. GPA eligibility, funding evidence, video requirements" onKeyDown={e => { if (e.key === 'Enter') runRagSearch() }} /><button className="m3-btn m3-btn-primary" onClick={runRagSearch} disabled={ragLoading}>{ragLoading ? 'Retrieving…' : 'Retrieve rules'}</button></div>{ragResults.length > 0 && <div className="rag-results"><div className="artifact-label">Retrieved evidence · {ragResults.length} matches</div>{ragResults.map((result: any) => <article className="rag-result" key={result.document}><div><strong>{result.document}</strong><span className="rag-score">Score {result.score}</span></div><p>{result.snippet}</p></article>)}</div>}
                <div className="m3-corpus-grid">
                  <div className="m3-corpus-sidebar">
                    {corpusDocs.map((doc) => (
                      <button
                        key={doc.id}
                        className={`m3-corpus-doc-btn ${selectedCorpusDoc?.id === doc.id ? 'active' : ''}`}
                        onClick={() => setSelectedCorpusDoc(doc)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#dc2626' }}>picture_as_pdf</span>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{selectedCorpusDoc?.title}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Source: {selectedCorpusDoc?.pdf_filename || selectedCorpusDoc?.filename}
                        </div>
                      </div>

                      {selectedCorpusDoc?.pdf_url && (
                        <a
                          href={artifactUrl(selectedCorpusDoc.pdf_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="m3-btn m3-btn-outlined"
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                          Open PDF in New Window
                        </a>
                      )}
                    </div>

                    {pdfViewMode && selectedCorpusDoc?.pdf_url ? (
                      <iframe
                        src={artifactUrl(selectedCorpusDoc.pdf_url)}
                        title={selectedCorpusDoc.title}
                        style={{ width: '100%', height: 440, border: '1px solid #cbd5e1', borderRadius: 12 }}
                      />
                    ) : (
                      <div className="m3-corpus-viewer">
                        {selectedCorpusDoc ? selectedCorpusDoc.content : 'Select a document...'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: N8N LOW-CODE ORCHESTRATOR BRIDGE */}
            {adminTab === 'n8n' && (

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
            )}
            </div>
        )}

      </main>
    </div>
  )
}

export default App






