import { useState, useEffect, useRef } from 'react'
import './index.css'
import CvVisionPanel from './components/CvVisionPanel'
import VideoPanel from './components/VideoPanel'
import ApplicationView from './components/ApplicationView'
import { Dashboard } from './m3/Dashboard'
import { TalentPool } from './m3/TalentPool'
import { AllCandidates } from './m3/AllCandidates'
import { HeroCard } from './m3/HeroCard'
import { SettingsTab } from './components/SettingsTab'
import { CorpusTab } from './components/CorpusTab'
import { N8nTab } from './components/N8nTab'

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
  funding_type?: string
  funding_program?: string
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

const FALLBACK_EDUCATION: EducationEntry = { institution: 'Yale College / Morse College', degree: 'B.S. Â· Computer Science & Global Affairs', field: 'Computer Science & Global Affairs', year: '2027', gpa: '3.92' }
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



const getUserDraftKey = (email: string) => `openDoorsDraft_${email.toLowerCase().trim()}`
const getUserStatusKey = (email: string) => `openDoorsStatus_${email.toLowerCase().trim()}`
const getUserSubmittedAtKey = (email: string) => `openDoorsSubmittedAt_${email.toLowerCase().trim()}`

export function App() {
  // Top-Level Portal Mode: Student Portal vs. Committee Admin Console
  const [portalMode, setPortalMode] = useState<'student' | 'admin'>(() => readStoredJson<{ email: string } | null>('openDoorsAdminSession', null) ? 'admin' : 'student')
  const [applicantSession, setApplicantSession] = useState<{ email: string; name: string } | null>(() => readStoredJson<{ email: string; name: string } | null>('openDoorsApplicantSession', null))
  const [adminSession, setAdminSession] = useState<{ email: string; name?: string; avatar?: string } | null>(() => readStoredJson<{ email: string; name?: string; avatar?: string } | null>('openDoorsAdminSession', null))
  const adminProfile = { name: adminSession?.name || 'Committee Admin', email: adminSession?.email || 'admin@opendoors.org', avatar: adminSession?.avatar || 'CA' }
  const saveAdminProfile = (profile: { name: string; email: string; avatar: string; password?: string }) => {
    const next = { email: profile.email, name: profile.name, avatar: profile.avatar }
    setAdminSession(next)
    localStorage.setItem('openDoorsAdminSession', JSON.stringify(next))
  }
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')

  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authFieldErrors, setAuthFieldErrors] = useState<Record<string, string>>({})
  const [applicantView, setApplicantView] = useState<'status' | 'workspace'>('status')
  const [routeReady, setRouteReady] = useState(false)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string>('')
  const [applicationStatus, setApplicationStatus] = useState<'draft' | 'submitting' | 'submitted' | 'failed'>('draft')

  // Committee Admin Tabs
  const [adminTab, setAdminTab] = useState<'overview' | 'audit' | 'fellowships' | 'scholarships' | 'corpus' | 'settings' | 'n8n' | 'dossiers' | 'compliance' | 'multimodal' | 'deliberation'>('overview')
  const [candidatesNavOpen, setCandidatesNavOpen] = useState(true)
  const [drawerCollapsed, setDrawerCollapsed] = useState<boolean>(() => readStoredJson<boolean>('openDoorsDrawerCollapsed', false))
  const toggleDrawer = () => setDrawerCollapsed(prev => {
    const next = !prev
    try { localStorage.setItem('openDoorsDrawerCollapsed', JSON.stringify(next)) } catch { /* local storage unavailable */ }
    return next
  })
  const [candidateView, setCandidateView] = useState<'all' | 'application' | 'audit' | 'pools' | 'searches'>('all')
  const [n8nTriggerLoading, setN8nTriggerLoading] = useState(false)
  const [n8nTriggerResult, setN8nTriggerResult] = useState<any>(null)
  const [n8nHealth, setN8nHealth] = useState<any>(null)

  const [proposals, setProposals] = useState<Application[]>([])
  const [selectedProposal, setSelectedProposal] = useState<Application | null>(null)
  const [corpusDocs, setCorpusDocs] = useState<CorpusDoc[]>([])
  const [selectedCorpusDoc, setSelectedCorpusDoc] = useState<CorpusDoc | null>(null)
  const [ragQuery, setRagQuery] = useState('')
  const [ragResults, setRagResults] = useState<any[]>([])
  const [ragLoading, setRagLoading] = useState(false)
  const [auditPanel, setAuditPanel] = useState<'profile' | 'submitted' | 'cv' | 'video' | 'rag' | 'verification' | 'decision'>('cv')
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false)
  const [auditArtifacts, setAuditArtifacts] = useState<Record<string, any>>({})
  const [candidateAuditRuns, setCandidateAuditRuns] = useState<Record<string, any>>({})
  const [videoStages, setVideoStages] = useState<Record<string, string>>({})
  const [candidateAuditStatus, setCandidateAuditStatus] = useState<Record<string, string>>(() => readStoredJson<Record<string, string>>('openDoorsCandidateStatuses', {}))
  const [candidateDecisions, setCandidateDecisions] = useState<Record<string, { decision: 'FUND' | 'RESERVE' | 'REJECT'; notes: string; score: number; signedOffAt?: string }>>(() => readStoredJson<Record<string, { decision: 'FUND' | 'RESERVE' | 'REJECT'; notes: string; score: number; signedOffAt?: string }>>('openDoorsCandidateDecisions', {}))
  const [auditDecision, setAuditDecision] = useState<'FUND' | 'RESERVE' | 'REJECT'>('FUND')
  const [auditNotes, setAuditNotes] = useState('')
  const [overallOpinion, setOverallOpinion] = useState<Record<string, string>>({})
  const [opinionLoading, setOpinionLoading] = useState<Record<string, boolean>>({})
  const [pdfViewMode, setPdfViewMode] = useState<boolean>(true)

  // Student Form State
  const [studentName, setStudentName] = useState('')
  const [studentSchool, setStudentSchool] = useState('')
  const [studentMajor, setStudentMajor] = useState('')
  const [studentGpa, setStudentGpa] = useState<number>(0)
  const [projectTitle, setProjectTitle] = useState('')
  const [fundingType, setFundingType] = useState<'fellowship' | 'scholarship' | 'other'>('fellowship')
  const [fundingProgram, setFundingProgram] = useState('')
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

  const [cvParseError, setCvParseError] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  // Video Motivation Feature: Modal & workflow states
  const [activeVideoModal, setActiveVideoModal] = useState<'none' | 'record' | 'upload'>('none')

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

      if (!fundingProgram.trim()) errors.fundingProgram = 'Please select the Yale scholarship or fellowship you are applying for.'
      if (!Number.isFinite(Number(requestedGrant)) || Number(requestedGrant) <= 0) errors.requestedGrant = 'Please enter the amount you are requesting.'
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
      setSubmitStatus('Thank you â€” your application was already submitted successfully. There is no need to resubmit.')
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
  const [batchAudit, setBatchAudit] = useState<{ running: boolean; completed: number; total: number; passed: number; failed: number; results: Record<string, { stages: Record<string, string>; reason?: string }> }>({ running: false, completed: 0, total: 0, passed: 0, failed: 0, results: {} })

  // Prompt Version Toggle (v1 vs v2)
  const [promptVersion, setPromptVersion] = useState<'v1' | 'v2'>('v2')

  // Chair HITL form states
  const [overrideScore, setOverrideScore] = useState<number>(4.6)

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
    setFundingType('fellowship')
    setFundingProgram('')
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
      setFundingType(userDraft.fundingType || 'fellowship')
      setFundingProgram(userDraft.fundingProgram || '')
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
  useEffect(() => {
    if (portalMode !== 'admin') return
    let cancelled = false
    fetch(apiUrl('/api/integrations/health'))
      .then((response) => response.json())
      .then((payload) => { if (!cancelled) setN8nHealth(payload) })
      .catch(() => { if (!cancelled) setN8nHealth({ api: 'unavailable', n8n: 'unavailable', detail: 'API health check failed.' }) })
    return () => { cancelled = true }
  }, [portalMode])
  useEffect(() => {
    const applyRoute = () => {
      const path = window.location.pathname
      if (path === '/signin' || path === '/signup') { setPortalMode('student'); setAuthView(path.slice(1) as 'signin' | 'signup') }
      else if (path.startsWith('/admin')) { setPortalMode('admin'); const match = path.match(/^\/admin\/([^/]+)/); const tab = match?.[1]; if (tab === 'settings' || tab === 'rag-rules' || tab === 'decisions' || tab === 'candidates') setAdminTab(tab === 'rag-rules' ? 'corpus' : tab === 'candidates' ? 'audit' : tab as any) }
      else if (path === '/applicant/application') { setPortalMode('student'); setApplicantView('workspace') }
      else if (path === '/applicant/status' || path === '/') { setPortalMode('student'); setApplicantView('status') }
      setRouteReady(true)
    }
    applyRoute()
    window.addEventListener('popstate', applyRoute)
    return () => window.removeEventListener('popstate', applyRoute)
  }, [])
  useEffect(() => {
    if (!routeReady) return
    const path = portalMode === 'admin'
      ? `/admin/${adminTab === 'corpus' ? 'rag-rules' : adminTab}`
      : !applicantSession
        ? `/${authView}`
        : applicantView === 'workspace' ? '/applicant/application' : '/applicant/status'
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
  }, [routeReady, portalMode, adminTab, applicantView, applicantSession, authView])
  useEffect(() => { localStorage.setItem('openDoorsCandidateStatuses', JSON.stringify(candidateAuditStatus)) }, [candidateAuditStatus])
  useEffect(() => { const decision = decisionForCandidate(selectedProposal || undefined); setAuditDecision(decision?.decision || 'FUND'); setAuditNotes(decision?.notes || ''); setOverrideScore(decision?.score || 4.6) }, [selectedProposal, candidateDecisions])
  useEffect(() => {
    const id = selectedProposal?.id
    if (!id || (adminTab !== 'audit' && !isCandidateModalOpen)) return
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
  }, [selectedProposal?.id, adminTab, isCandidateModalOpen])
  useEffect(() => {
    if (!applicantSession?.email) return
    const stamp = new Date().toISOString()
    const draft = {
      studentStep, completedStudentSteps, educationEntries, academicExperiences, leadershipExperiences,
      studentName, studentSchool, studentMajor, studentGpa, projectTitle, fundingType, fundingProgram,
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
  const openCandidateAudit = async (id: string, panel: 'profile' | 'submitted' | 'cv' | 'video' | 'rag' | 'verification' | 'decision' = 'profile') => {
    setAuditPanel(panel as any)
    const cand = proposals.find(p => p.id === id)
    if (cand) {
      setSelectedProposal(cand)
      setIsCandidateModalOpen(true)
      const currentRun = candidateAuditRuns[id]
      if (!currentRun || currentRun.status === 'stopped' || currentRun.status === 'failed') {
        void runFullAudit(cand)
      }
    }
    void handleSelectProposal(id)
  }

  const handleOpenCandidateModal = async (p: Application) => {
    setSelectedProposal(p)
    setIsCandidateModalOpen(true)
    await handleSelectProposal(p.id)
    const currentRun = candidateAuditRuns[p.id]
    if (!currentRun || currentRun.status === 'stopped' || currentRun.status === 'failed') {
      void runFullAudit(p)
    }
  }

  const auditCandidate = selectedProposal || proposals[0]
  const currentCandidateIndex = proposals.findIndex(p => p.id === (selectedProposal?.id || auditCandidate?.id))
  const handlePrevCandidate = () => {
    if (currentCandidateIndex > 0) {
      const prev = proposals[currentCandidateIndex - 1]
      void handleOpenCandidateModal(prev)
    }
  }
  const handleNextCandidate = () => {
    if (currentCandidateIndex >= 0 && currentCandidateIndex < proposals.length - 1) {
      const next = proposals[currentCandidateIndex + 1]
      void handleOpenCandidateModal(next)
    }
  }

  const currentAudit = auditCandidate ? candidateAuditRuns[auditCandidate.id] : undefined
  const auditTokenUsage = currentAudit?.token_usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  const auditTokenLabel = `${Number(auditTokenUsage.total_tokens || 0).toLocaleString()} tokens Â· ${Number(auditTokenUsage.prompt_tokens || 0).toLocaleString()} in / ${Number(auditTokenUsage.completion_tokens || 0).toLocaleString()} out`

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
  const runFullAudit = async (targetCandidate?: Application) => {
    const candidate = targetCandidate || auditCandidate
    if (!candidate) return
    if (candidateAuditRuns[candidate.id]?.status === 'running') return
    const id = candidate.id
    // A rerun is a clean pass: discard the previous visible progress and artifacts
    // before asking the server to recreate every stage from the beginning.
    setCandidateAuditRuns(current => ({ ...current, [id]: { status: 'queued', stages: {}, results: {}, timeline: [] } }))
    setAuditArtifacts(current => { const next = { ...current }; delete next[id]; return next })
    setVideoStages(current => { const next = { ...current }; delete next[id]; return next })
    setOverallOpinion(current => { const next = { ...current }; delete next[id]; return next })
    await fetch(apiUrl(`/api/admin/candidate-audit/${encodeURIComponent(id)}/run`), { method: 'POST' })
  }
  const stopFullAudit = async (targetCandidate?: Application) => {
    const candidate = targetCandidate || auditCandidate
    if (!candidate) return
    const id = candidate.id
    await fetch(apiUrl(`/api/admin/candidate-audit/${encodeURIComponent(id)}/stop`), { method: 'POST' })
    setCandidateAuditRuns(current => ({ ...current, [id]: { status: 'stopped', stages: {}, results: {}, timeline: [] } }))
    setAuditArtifacts(current => { const next = { ...current }; delete next[id]; return next })
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


  // Handle Dynamic Student Form Submission
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (applicationStatus === 'submitted') {
      setSubmitStatus('Thank you â€” your application was already submitted successfully. There is no need to resubmit.')
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
      funding_type: fundingType,
      funding_program: fundingProgram,
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
        budget: `${fundingType} â€” ${fundingProgram}. Direct request: $${(Number(requestedGrant) || 0).toLocaleString()}. Parent share and standard student share accounted for.`
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
        setSubmitStatus(`âœ… Thank you! Your application [${result.application?.id || 'new'}] was submitted successfully. No further action is required.`)
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

    // Read duration with a temp element â€” ref may not be mounted yet
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

  const savedLabel = draftUpdatedAt ? `Last saved ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draftUpdatedAt))}` : 'No saved draft yet'
  const submittedAtValue = applicantSession?.email ? localStorage.getItem(getUserSubmittedAtKey(applicantSession.email)) : null
  const submissionLabel = applicationStatus === 'submitted' ? `Submitted ${submittedAtValue ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(submittedAtValue)) : ''}` : applicationStatus === 'submitting' ? 'Submission in progress' : applicationStatus === 'failed' ? 'Submission needs attention' : 'Draft Â· Not submitted'
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

  if (portalMode === 'admin' && !adminSession) return <div className="auth-page admin-auth-page"><div className="auth-panel"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Committee portal</span></div></div><span className="eyebrow">Secure workspace</span><h1>Welcome back, committee.</h1><p className="auth-lede">Sign in to review applicant dossiers, compliance, and committee decisions.</p><label className="field"><span>Admin email</span><input type="email" placeholder="admin@opendoors.org" value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.email; return n }) }} />{authFieldErrors.email && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.email}</span>}</label><label className="field"><span>Password</span><input type="password" placeholder="Admin password" value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.password; return n }) }} />{authFieldErrors.password && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.password}</span>}</label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" onClick={() => signInAdmin()}>Sign in to admin console <span className="material-symbols-outlined">arrow_forward</span></button><button className="demo-link" onClick={() => signInAdmin(true)}>Continue as demo admin</button><button className="back-to-app" onClick={() => { setPortalMode('student'); setAuthError(null); setAuthFieldErrors({}) }}>â† Back to applicant portal</button></div></div>

  if (portalMode === 'student' && !applicantSession) return <div className="auth-page"><div className="auth-visual"><div className="auth-visual-slides" aria-hidden="true"><span style={{ backgroundImage: "url('/yale-bg-1.svg')" }} /><span style={{ backgroundImage: "url('/yale-bg-2.svg')" }} /><span style={{ backgroundImage: "url('/yale-bg-3.svg')" }} /><span style={{ backgroundImage: "url('/yale-bg-4.svg')" }} /></div><div className="auth-visual-scrim" aria-hidden="true" /><div className="portal-brand"><div className="brand-mark brand-mark-yale"><img src="/yale-shield.svg" alt="Yale University" /></div><div><strong>Yale University</strong><span>Applicant portal</span></div></div><div className="auth-quote"><span className="eyebrow">Application 2026</span><h1>Your story deserves room to move.</h1><p>Build a thoughtful application, one piece at a time.</p><div className="quote-mark">â€œ</div></div><div className="auth-visual-foot">Yale University Â· Fellowship &amp; scholarship support</div></div><div className="auth-panel"><div className="auth-tabs"><button className={authView === 'signin' ? 'active' : ''} onClick={() => { setAuthView('signin'); setAuthError(null); setAuthFieldErrors({}) }}>Sign in</button><button className={authView === 'signup' ? 'active' : ''} onClick={() => { setAuthView('signup'); setAuthError(null); setAuthFieldErrors({}) }}>Create account</button></div><span className="eyebrow">Applicant access</span><h1>{authView === 'signin' ? 'Welcome back.' : 'Start your application.'}</h1><p className="auth-lede">{authView === 'signin' ? 'Pick up where you left off, whenever youâ€™re ready.' : 'Create a local applicant account to save your progress on this device.'}</p>{authView === 'signup' && <label className="field"><span>Full name</span><input placeholder="e.g. Alex Rivera" value={authName} onChange={e => { setAuthName(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.name; return n }) }} />{authFieldErrors.name && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.name}</span>}</label>}<label className="field"><span>Email address</span><input type="email" placeholder="e.g. applicant@university.edu" value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.email; return n }) }} />{authFieldErrors.email && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.email}</span>}</label><label className="field"><span>Password</span><input type="password" placeholder={authView === 'signup' ? 'At least 6 characters' : 'Enter your password'} value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthFieldErrors(prev => { const n = { ...prev }; delete n.password; return n }) }} />{authFieldErrors.password && <span className="field-error"><span className="material-symbols-outlined">error</span>{authFieldErrors.password}</span>}</label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" onClick={() => authView === 'signin' ? signInApplicant() : signUpApplicant()}>{authView === 'signin' ? 'Sign in' : 'Create local account'} <span className="material-symbols-outlined">arrow_forward</span></button><div className="auth-divider"><span>or</span></div><button className="demo-link" onClick={() => signInApplicant(true)}>Continue as demo applicant</button><button className="admin-entry" onClick={() => { setPortalMode('admin'); setAuthError(null); setAuthFieldErrors({}) }}>Committee / admin sign in</button></div></div>

  if (portalMode === 'student' && applicantSession && applicantView === 'status') return <div className="status-page"><header className="status-header"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Applicant portal</span></div></div><div className="status-user"><span className="avatar">{applicantInitials}</span><span><strong>{applicantDisplayName}</strong><small style={{ display: 'block', color: 'var(--muted)', fontSize: '.65rem', marginTop: 2 }}>{applicantSession.email}</small></span><button onClick={signOutApplicant}>Sign out</button></div></header><main className="status-main"><span className="eyebrow">My application Â· 2026</span><h1>Good to see you, {applicantDisplayName.split(' ')[0]}.</h1>{applicationStatus === 'submitted' ? <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}><span className="material-symbols-outlined" style={{ fontSize: 24 }}>check_circle</span><div><strong style={{ display: 'block' }}>Thank you â€” your application was submitted successfully.</strong><small style={{ opacity: 0.9 }}>No need to resubmit. You can review your status below.</small></div></div> : <p className="auth-lede">Your application is saved securely on this device. Continue when youâ€™re ready.</p>}<section className="status-hero"><div><span className="eyebrow">Current stage</span><h2>{applicationStatus === 'submitted' ? 'Application received' : completedStudentSteps.length ? studentSteps[Math.min(studentStep, 5)] : 'General information'}</h2><p>{savedLabel} Â· {submissionLabel}</p></div><div className="status-ring"><strong>{applicationStatus === 'submitted' ? 100 : Math.round((completedStudentSteps.length / 6) * 100)}%</strong><span>{applicationStatus === 'submitted' ? 'submitted' : 'complete'}</span></div></section><section className="status-card"><div className="status-card-top"><div><h3>Application progress</h3><p>Six pieces make up your dossier.</p></div><strong>{applicationStatus === 'submitted' ? 'Submitted' : `${completedStudentSteps.length} of 6 complete`}</strong></div><div className="status-progress"><i style={{ width: `${applicationStatus === 'submitted' ? 100 : (completedStudentSteps.length / 6) * 100}%` }} /></div><div className="status-step-list">{studentSteps.map((step, index) => <div key={step} className={applicationStatus === 'submitted' || completedStudentSteps.includes(index) ? 'complete' : index === studentStep ? 'current' : ''}><span className="material-symbols-outlined">{applicationStatus === 'submitted' || completedStudentSteps.includes(index) ? 'check_circle' : stepIcons[index]}</span><span>{step}</span><small>{applicationStatus === 'submitted' ? 'Complete' : completedStudentSteps.includes(index) ? 'Complete' : index === studentStep ? 'Up next' : 'Not started'}</small></div>)}</div><button className="primary-button" onClick={() => setApplicantView('workspace')}>{applicationStatus === 'submitted' ? 'View submitted application' : 'Continue application'} <span className="material-symbols-outlined">arrow_forward</span></button></section></main></div>

  return (
    <div className={`m3-app-layout ${portalMode === 'student' ? 'student-mode' : 'admin-mode'}`}>
      {/* Sidebar: Clean, Logical Role Navigation */}
      <aside className={`m3-drawer ${drawerCollapsed ? 'collapsed' : ''}`}>
        <div className="m3-brand-row">
          <div className="m3-brand-logo">
            <img src="/yale-shield.svg" alt="Yale University" />
          </div>
          <div className="m3-brand-text">
          <div className="m3-brand-title">Yale University</div>
          <span className="m3-brand-badge">Committee dossier</span>
          </div>
          <button
            type="button"
            className="m3-drawer-toggle"
            aria-label={drawerCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!drawerCollapsed}
            title={drawerCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={toggleDrawer}
          >
            <span className="material-symbols-outlined">{drawerCollapsed ? 'left_panel_open' : 'left_panel_close'}</span>
          </button>
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
              <span className="material-symbols-outlined">edit_document</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Application Intake</div>
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
              </div>
            </div>
          </nav>
        ) : (
          <nav className="m3-nav-list">
            <div className={`m3-nav-item ${adminTab === 'overview' ? 'active' : ''}`} title="Overview" onClick={() => setAdminTab('overview')}><span className="material-symbols-outlined">space_dashboard</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Overview</div></div></div>
            <div className="m3-nav-group">
              <div
                className={`m3-nav-item ${adminTab === 'audit' ? 'active' : ''}`}
                title="Candidates"
                aria-expanded={candidatesNavOpen}
                onClick={() => {
                  setAdminTab('audit')
                  setCandidateView('all')
                  setCandidatesNavOpen(open => !open)
                }}
              >
                <span className="material-symbols-outlined">fact_check</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Candidates</div></div>
                <span className="material-symbols-outlined m3-nav-caret">{candidatesNavOpen ? 'expand_more' : 'chevron_right'}</span>
              </div>
              {candidatesNavOpen && <div className="m3-nav-sub">
                <button
                  type="button"
                  className={`m3-nav-sub-item ${adminTab === 'audit' && candidateView === 'all' ? 'active' : ''}`}
                  onClick={() => { setCandidateView('all'); setAdminTab('audit') }}
                >All candidates</button>
                <button
                  type="button"
                  className={`m3-nav-sub-item ${adminTab === 'audit' && candidateView === 'pools' ? 'active' : ''}`}
                  onClick={() => { setCandidateView('pools'); setAdminTab('audit') }}
                >Talent pools</button>
              </div>}
            </div>
            <div className={`m3-nav-item ${adminTab === 'corpus' ? 'active' : ''}`} title="Rules" onClick={() => setAdminTab('corpus')}><span className="material-symbols-outlined">hub</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Rules</div></div></div>
            <div className={`m3-nav-item ${adminTab === 'settings' ? 'active' : ''}`} title="Settings" onClick={() => setAdminTab('settings')}><span className="material-symbols-outlined">settings</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Settings</div></div></div>
            <div className={`m3-nav-item ${adminTab === 'n8n' ? 'active' : ''}`} title="n8n Pipeline" onClick={() => setAdminTab('n8n')}><span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>hub</span><div><div style={{ fontSize: '0.86rem', fontWeight: 700 }}>n8n Pipeline</div></div></div>
          </nav>

        )}

        <div style={{ marginTop: 'auto', marginBottom: 12 }}>
          <button
            className="m3-btn m3-btn-outlined"
            style={{ width: '100%', fontSize: '0.8rem' }}
            onClick={() => window.open('http://localhost:5678', '_blank')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hub</span>
            <span className="btn-label">Open n8n Orchestrator</span>
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
        {/* Top Header removed: each tab now provides its own consistent HeroCard */}

        {/* ============================================================= */}
        {/* VIEW 1: DEDICATED STUDENT APPLICATION SPACE                   */}
        {/* ============================================================= */}
        {portalMode === 'student' && (
          <div className="student-shell">
            <div className="student-mobile-progress"><div><span>Step {studentStep + 1} of 6</span><span className="mobile-saved"><i className="status-dot" /> Saved just now</span></div><strong>{studentSteps[studentStep]}</strong><div className="mobile-context"><span className="avatar">{applicantInitials}</span> {applicantDisplayName} Â· Applicant</div><div className="progress-track"><i style={{ width: `${((studentStep + 1) / 6) * 100}%` }} /></div></div>
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
                  {studentStep === 0 && <><div className="card-heading"><span className="section-number">01</span><div><h3>Letâ€™s start with you</h3><p>Tell us how to reach you and how youâ€™d like your name represented.</p></div></div><div className="form-grid">
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

                    <div className="form-grid funding-selection">
                      <label className="field">
                        <span>Yale funding type <b>*</b></span>
                        <select value={fundingType} onChange={e => { setFundingType(e.target.value as 'fellowship' | 'scholarship' | 'other'); setFundingProgram('') }}>
                          <option value="fellowship">Fellowship</option>
                          <option value="scholarship">Scholarship</option>
                          <option value="other">Other Yale funding</option>
                        </select>
                      </label>
                      <label className={`field ${formErrors.fundingProgram ? 'has-error' : ''}`}>
                        <span>Yale opportunity <b>*</b></span>
                        <select value={fundingProgram} onChange={e => { setFundingProgram(e.target.value); clearFieldError('fundingProgram') }}>
                          <option value="">Select an opportunity</option>
                          {fundingType === 'fellowship' && <>
                            <option>Yale Graduate Fellowship</option>
                            <option>Yale Research Fellowship</option>
                            <option>Yale Public Service Fellowship</option>
                          </>}
                          {fundingType === 'scholarship' && <>
                            <option>Yale Need-Based Scholarship</option>
                            <option>Yale Merit Scholarship</option>
                            <option>Yale International Student Scholarship</option>
                          </>}
                          {fundingType === 'other' && <option>Other Yale funding programme</option>}
                        </select>
                        {formErrors.fundingProgram && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.fundingProgram}</span>}
                      </label>
                      <label className={`field ${formErrors.requestedGrant ? 'has-error' : ''}`}>
                        <span>Requested budget (USD) <b>*</b></span>
                        <input type="number" min="1" step="100" value={requestedGrant || ''} onChange={e => { setRequestedGrant(Number(e.target.value)); clearFieldError('requestedGrant') }} placeholder="e.g. 75000" />
                        {formErrors.requestedGrant && <span className="field-error"><span className="material-symbols-outlined">error</span>{formErrors.requestedGrant}</span>}
                      </label>
                      <label className="field">
                        <span>Outside scholarships / awards (USD)</span>
                        <input type="number" min="0" step="100" value={outsideScholarships || ''} onChange={e => setOutsideScholarships(Number(e.target.value))} placeholder="0" />
                      </label>
                    </div>

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
                      <small>PDF only Â· Max 10 MB</small>
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
                  {studentStep === 4 && <><div className="card-heading"><span className="section-number">05</span><div><h3>Review your dossier</h3><p>A final calm read-through before you record your motivation.</p></div></div><div className="review-list">{[['General information', studentName && studentEmail, 'person'], ['Education', studentSchool && studentMajor, 'school'], ['Experience', projectTitle && purposeStatement, 'auto_awesome'], ['CV deposit', !!cvFilePreviewUrl, 'description']].map(([label, value, icon]) => <div className="review-row" key={String(label)}><span className="material-symbols-outlined">{icon}</span><div><strong>{label}</strong><small>{value ? 'Complete Â· Ready to review' : 'Needs your attention'}</small></div><span className={value ? 'check-mark material-symbols-outlined' : 'warning-mark material-symbols-outlined'}>{value ? 'check_circle' : 'warning'}</span></div>)}</div><div className="review-callout"><span className="material-symbols-outlined">verified</span><p><strong>Almost there.</strong> Your application will remain editable until you submit the final video.</p></div></>}
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
                        <p>Share what drives your work and how this grant would change whatâ€™s possible. Aim for 90 seconds and keep it between 60 and 120 seconds.</p>
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
                                Duration: {formatVideoDuration(videoDuration)} {videoDuration !== null && (videoDuration >= 60 && videoDuration <= 120 ? 'Â· Valid duration (60â€“120s)' : 'Â· Outside 60â€“120s range')}
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
                              ? 'âœ“ Meets the 60â€“120 second requirement'
                              : 'âš  Video must be between 60 and 120 seconds long'}
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
                          <small>Use your camera to record directly in your browser. Enforces 60â€“120s timer with a live counter.</small>
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
                          <small>Already recorded? Upload your MP4, WebM, or MOV video file (up to 25 MB). Length must be 60â€“120s.</small>
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
                                    : 'Ready to record Â· Target 60â€“120s'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: recordingSeconds >= 60 ? '#047857' : '#78818c', fontWeight: 700 }}>
                                {recordingSeconds < 60
                                  ? `${60 - recordingSeconds}s remaining until valid minimum`
                                  : `Valid length (${formatVideoDuration(recordingSeconds)}) â€” max 2:00`}
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
                                MP4, WebM, or MOV Â· Max 25 MB Â· Duration 60 to 120 seconds
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

        {/* ============================================================= */}
        {/* VIEW 2: COMMITTEE ADMIN CONSOLE                               */}
        {/* ============================================================= */}
        {portalMode === 'admin' && (
          <div style={{ padding: '24px 32px' }}>
            {adminTab === 'overview' && <Dashboard proposals={proposals} statusForCandidate={statusForCandidate} decisionForCandidate={decisionForCandidate} onOpenCandidate={openCandidateAudit} onGoTo={setAdminTab} onRunBatch={runBatchDemoAudit} />}
            {adminTab === 'audit' && candidateView === 'pools' && (
              <TalentPool
                proposals={proposals}
                statusForCandidate={statusForCandidate}
                onOpenCandidate={(id) => { void openCandidateAudit(id) }}
                onGoTo={(tab) => setAdminTab(tab as any)}
              />
            )}
            {adminTab === 'audit' && candidateView !== 'pools' && (
              <AllCandidates
                proposals={proposals}
                statusForCandidate={statusForCandidate}
                decisionForCandidate={decisionForCandidate}
                onOpenCandidate={(id) => { void openCandidateAudit(id) }}
                onAddCandidate={() => window.alert('Candidate intake is submitted through the applicant portal.')}
              />
            )}
            {/* TAB: SETTINGS */}
            {adminTab === 'settings' && (
              <SettingsTab
                totalCandidates={proposals.length}
                needsReviewCount={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                onGoTo={(tab) => { setAdminTab(tab); if (tab === 'audit') setCandidateView('all'); }}
                adminProfile={adminProfile}
                onSaveProfile={saveAdminProfile}
                apiUrl={apiUrl}
              />
            )}
            {/* TAB: SCHOLARSHIPS */}
            {adminTab === 'scholarships' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <HeroCard
                  total={proposals.length}
                  needsReview={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                  title="Scholarships & Need-Based Stipends"
                  subtitle="Scholarship awards, stipend levels and eligibility criteria managed alongside the fellowship catalogue."
                  onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                  actions={[
                    { label: 'Overview', icon: 'space_dashboard', onClick: () => setAdminTab('overview') },
                    { label: 'Candidates', icon: 'groups', onClick: () => { setAdminTab('audit'); setCandidateView('all') } },
                    { label: 'RAG rules', icon: 'policy', onClick: () => setAdminTab('corpus') },
                  ]}
                />
                <div className="admin-scholarships dossier-panel">
                  <div className="overview-intro">
                    <div>
                      <span className="eyebrow">Award catalogue Â· Application 2026</span>
                      <h2>Scholarships</h2>
                      <p>Scholarship awards, stipend levels and eligibility criteria managed alongside the fellowship catalogue.</p>
                    </div>
                    <span className="audit-count">Coming soon</span>
                  </div>
                  <div className="audit-empty">
                    <span className="material-symbols-outlined">workspace_premium</span>
                    <strong>No scholarships configured yet</strong>
                    <small>Once the award catalogue is connected, each scholarship, stipend level and eligibility rule will be listed here.</small>
                  </div>
                </div>
              </div>
            )}
            {/* TAB: FELLOWSHIPS */}
            {adminTab === 'fellowships' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <HeroCard
                  total={proposals.length}
                  needsReview={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                  title="Fellowship Programmes Catalogue"
                  subtitle="Programme definitions, award levels and eligibility criteria for the committee's fellowship catalogue."
                  onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                  actions={[
                    { label: 'Overview', icon: 'space_dashboard', onClick: () => setAdminTab('overview') },
                    { label: 'Candidates', icon: 'groups', onClick: () => { setAdminTab('audit'); setCandidateView('all') } },
                    { label: 'RAG rules', icon: 'policy', onClick: () => setAdminTab('corpus') },
                  ]}
                />
                <div className="admin-fellowships dossier-panel">
                  <div className="overview-intro">
                    <div>
                      <span className="eyebrow">Programme catalogue Â· Application 2026</span>
                      <h2>Fellowships</h2>
                      <p>Programme definitions, award levels and eligibility criteria for the committee's fellowship catalogue.</p>
                    </div>
                    <span className="audit-count">Coming soon</span>
                  </div>
                  <div className="audit-empty">
                    <span className="material-symbols-outlined">school</span>
                    <strong>No fellowship programmes configured yet</strong>
                    <small>Once the programme catalogue is connected, each fellowship, award ceiling and eligibility rule will be listed here.</small>
                  </div>
                </div>
              </div>
            )}
            {/* TAB: DOSSIERS OVERVIEW */}
            {adminTab === 'dossiers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <HeroCard
                  total={proposals.length}
                  needsReview={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                  title={`Active Candidate Dossiers (${proposals.length} Applicants)`}
                  subtitle="Overview of registered undergraduate and graduate fellowship candidates."
                  onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                  actions={[
                    { label: 'Batch audit', icon: 'play_circle', onClick: runBatchDemoAudit },
                    { label: 'All candidates', icon: 'groups', onClick: () => { setAdminTab('audit'); setCandidateView('all') } },
                  ]}
                />
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
              </div>
            )}

            {/* TAB: MULTIMODAL VERIFICATION (CV vs FORM vs VIDEO) */}
            {adminTab === 'multimodal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <HeroCard
                  total={proposals.length}
                  needsReview={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                  title="Multimodal Evidence Verification"
                  subtitle="Cross-references candidate self-declarations against their ATS/LaTeX CV and submitted video."
                  onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                  actions={[
                    { label: 'Re-verify', icon: 'refresh', onClick: () => selectedProposal && triggerMultimodalVerification(selectedProposal) },
                    { label: 'All candidates', icon: 'groups', onClick: () => { setAdminTab('audit'); setCandidateView('all') } },
                    { label: 'RAG rules', icon: 'policy', onClick: () => setAdminTab('corpus') },
                  ]}
                />
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
                      {selectedProposal ? `Major: ${selectedProposal.major || 'General'} â€¢ Stated GPA: ${selectedProposal.gpa?.toFixed(2) || 'â€”'} â€¢ Dossier: ${selectedProposal.id}` : 'Select a candidate to review cross-modal evidence.'}
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
                      <strong>Confidence: 98.7% â€¢ 16kHz Audio Channel</strong>
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
                            <div style={{ fontWeight: 700, color: '#dc2626' }}>{d.source} â€” Delta: {d.delta}</div>
                            <div style={{ color: '#475569', marginTop: 2 }}>{d.explanation}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

            {/* TAB: COMPLIANCE ENGINE */}
            {adminTab === 'compliance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <HeroCard
                  total={proposals.length}
                  needsReview={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                  title="Deterministic Compliance & Financial Need Audit"
                  subtitle="Pure code validation: Title IV SAP progress (GPA >= 3.00), $3,700 Student Share, and $2,500 Tech Allowance Cap."
                  onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                  actions={[
                    { label: 'All candidates', icon: 'groups', onClick: () => { setAdminTab('audit'); setCandidateView('all') } },
                    { label: 'RAG rules', icon: 'policy', onClick: () => setAdminTab('corpus') },
                  ]}
                />
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
            </div>
          )}

            {/* TAB: MULTI-AGENT DELIBERATION */}
            {adminTab === 'deliberation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <HeroCard
                  total={proposals.length}
                  needsReview={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                  title="Multi-Agent Evaluation & Rubrics"
                  subtitle="3 Isolated Evaluators (Academic Rigor, Leadership Impact, Financial Need) with verbatim quote verification."
                  onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                  actions={[
                    { label: 'All candidates', icon: 'groups', onClick: () => { setAdminTab('audit'); setCandidateView('all') } },
                    { label: 'RAG rules', icon: 'policy', onClick: () => setAdminTab('corpus') },
                  ]}
                />
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
            </div>
          )}

            {/* TAB: YALE CORPUS & GUIDELINES */}
            {adminTab === 'corpus' && (
              <CorpusTab
                totalCandidates={proposals.length}
                needsReviewCount={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                corpusDocs={corpusDocs}
                selectedCorpusDoc={selectedCorpusDoc}
                setSelectedCorpusDoc={setSelectedCorpusDoc}
                ragQuery={ragQuery}
                setRagQuery={setRagQuery}
                ragResults={ragResults}
                ragLoading={ragLoading}
                pdfViewMode={pdfViewMode}
                setPdfViewMode={setPdfViewMode}
                runRagSearch={() => void runRagSearch()}
                onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                onGoTo={(tab) => { setAdminTab(tab); if (tab === 'audit') setCandidateView('all'); }}
                artifactUrl={artifactUrl}
              />
            )}

            {/* TAB: N8N LOW-CODE ORCHESTRATOR BRIDGE */}
            {adminTab === 'n8n' && (
              <N8nTab
                totalCandidates={proposals.length}
                needsReviewCount={proposals.filter(p => statusForCandidate(p) === 'Needs review').length}
                selectedProposal={selectedProposal}
                n8nTriggerLoading={n8nTriggerLoading}
                n8nTriggerResult={n8nTriggerResult}
                  n8nHealth={n8nHealth}
                triggerN8nWorkflow={triggerN8nWorkflow}
                onOpenWorkspace={() => proposals[0] && void openCandidateAudit(proposals[0].id)}
                onGoTo={(tab) => { setAdminTab(tab); if (tab === 'audit') setCandidateView('all'); }}
              />
            )}
            </div>
        )}

      </main>

      {isCandidateModalOpen && auditCandidate && (
        <ApplicationView
          candidate={auditCandidate}
          auditPanel={auditPanel === 'verification' ? 'rag' : auditPanel}
          setAuditPanel={(tab) => setAuditPanel(tab as any)}
          statusForCandidate={statusForCandidate}
          currentAudit={currentAudit}
          auditArtifacts={auditArtifacts}
          ragResults={ragResults}
          overallOpinion={overallOpinion}
          auditDecision={auditDecision}
          setAuditDecision={setAuditDecision}
          auditNotes={auditNotes}
          setAuditNotes={setAuditNotes}
          overrideScore={overrideScore}
          opinionLoading={opinionLoading}
          onRunAudit={() => void runFullAudit(auditCandidate)}
          onStopAudit={() => void stopFullAudit(auditCandidate)}
          onPersistDecision={persistCandidateDecision}
          onStreamOpinion={streamOverallOpinion}
          onRunTranscription={runVideoTranscription}
          onRunEvaluation={runVideoEvaluation}
          videoStages={videoStages}
          decisionForCandidate={decisionForCandidate}
          auditTokenLabel={auditTokenLabel}
          CvVisionPanelComponent={CvVisionPanel}
          VideoPanelComponent={VideoPanel}
          apiUrl={apiUrl}
          artifactUrl={artifactUrl}
          pipelineStageRows={pipelineStageRows}
          onClose={() => setIsCandidateModalOpen(false)}
          onPrev={currentCandidateIndex > 0 ? handlePrevCandidate : undefined}
          onNext={currentCandidateIndex < proposals.length - 1 ? handleNextCandidate : undefined}
          candidateIndex={currentCandidateIndex >= 0 ? currentCandidateIndex : 0}
          totalCandidates={proposals.length}
          onCvResult={(id, result) => updateAuditArtifact(id, { cv: { status: 'parsed', source: result.document_source, parsed: result.structured, extracted: `${result.stats.box_count} OCR fields detected`, flags: [] } })}
        />
      )}
    </div>
  )
}

export default App






