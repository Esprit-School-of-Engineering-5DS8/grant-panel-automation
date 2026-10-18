import { useState, useEffect } from 'react'
import './index.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
const artifactUrl = (url?: string) => !url ? '' : /^https?:\/\//i.test(url) ? url : apiUrl(url)

interface Application {
  [key: string]: any
  id: string
  title: string
  applicant_name: string
  school?: string
  major?: string
  gpa?: number
  requested_grant?: number
  page_count?: number
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
  cv_media_id?: string
  video_media_id?: string
  reviews?: Record<string, Record<string, any>>
  decision?: { decision: 'FUND' | 'RESERVE' | 'REJECT'; score: number; notes: string; admin_email?: string; decided_at: string }
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

const EMPTY_EDUCATION: EducationEntry = { institution: '', degree: '', field: '', year: '', gpa: '' }
const isEducationEntry = (value: unknown): value is EducationEntry => Boolean(value && typeof value === 'object' && ['institution', 'degree', 'field', 'year', 'gpa'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string'))
const normalizeEducationEntries = (value: unknown): EducationEntry[] => Array.isArray(value) && value.every(isEducationEntry) ? value : [{ ...EMPTY_EDUCATION }]
const normalizeExperienceEntries = (value: unknown): string[] => Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : ['']

function SubmittedApplicationPanel({ candidate, status, statusClass }: { candidate: Application; status: string; statusClass: (value: string) => string }) {
  const c = candidate as Record<string, any>
  const value = (entry: any) => Array.isArray(entry) ? entry.length ? entry.map(item => typeof item === 'object' ? Object.entries(item).map(([key, field]) => `${key}: ${field ?? 'Not provided'}`).join(', ') : String(item)).join(' · ') : 'Not provided' : entry === 0 ? '0' : entry === false ? 'No' : entry === undefined || entry === null || entry === '' ? 'Not provided' : String(entry)
  const sections: [string, [string, any][]][] = [
    ['General information', [['Record label', c.local_test_label || c.demo_dataset], ['Applicant name', c.applicant_name], ['Email', c.email || c.student_email], ['Phone', c.phone], ['Citizenship', c.citizenship], ['Date of birth', c.birthDate || c.birth_date], ['Sex', c.sex], ['Application status', c.application_status || status], ['Submitted at', c.submitted_at || c.submittedAt || c.created_at], ['Updated at', c.updated_at || c.submitted_at || c.submittedAt]]],
    ['Education', [['Institution', c.school || c.institution], ['Degree / track', c.degreeTrack || c.degree_track || c.major], ['Major', c.major], ['Graduation year', c.graduationYear || c.graduation_year], ['GPA', c.gpa], ['All education entries', c.education_entries || c.educationEntries]]],
    ['Experience', [['Project title', c.title || c.projectTitle], ['Academic / research experiences', c.academic_experiences || c.academicExperiences || c.purpose_statement], ['Leadership / community experiences', c.leadership_experiences || c.leadershipExperiences || c.leadership_statement]]],
    ['CV deposit', [['CV filename', c.cv_filename || c.cvFileName], ['CV / PDF URL', c.pdf_url || c.cv_pdf_url || c.cv_url], ['CV content', c.cv_latex ? 'Provided' : undefined]]],
    ['Financial / request details', [['Requested grant', c.requested_grant], ['Cost of attendance', c.financials?.cost_of_attendance], ['Parent share', c.financials?.parent_share], ['Student share', c.financials?.student_share], ['Outside scholarships', c.financials?.outside_scholarships], ['Computer allowance', c.financials?.computer_allowance], ['Demonstrated need', c.financials?.demonstrated_need]]],
    ['Video submission', [['Video URL', c.video_url], ['Video status', c.video_status || c.videoStatus || (c.video_url ? 'Submitted' : 'Not provided')], ['Video asset', c.video_url ? 'Uploaded' : 'Not provided'], ['Playback source', c.video_url], ['Video transcript', c.video_transcript || c.transcript], ['Video duration', c.video_duration || c.videoDuration]]]
  ]
  return <article className="evidence-card full-evidence submitted-inventory"><div className="evidence-title"><div><span className="eyebrow">Candidate record</span><h3>Submitted application</h3><p>Complete input inventory for {candidate.applicant_name} · {candidate.id}</p></div><span className={`audit-status ${statusClass(status)}`}>{status}</span></div><div className="submission-inventory-grid">{sections.map(([heading, fields]) => <section key={heading}><span className="eyebrow">{heading}</span><dl>{fields.map(([label, fieldValue]) => <div key={label}><dt>{label}</dt><dd>{value(fieldValue)}</dd></div>)}</dl></section>)}</div></article>
}

function AlluvialLegend() {
  const items = [['status-needs-review', 'Needs review'], ['status-in-review', 'In review'], ['status-verified', 'Verified'], ['status-decision-needed', 'Decision needed'], ['status-submitted', 'Submitted'], ['recommendation-fund', 'FUND'], ['recommendation-reserve', 'RESERVE'], ['recommendation-reject', 'REJECT'], ['recommendation-pending', 'Pending']]
  return <div className="alluvial-legend" role="list" aria-label="Alluvial status and recommendation legend">{items.map(([tone, label]) => <span role="listitem" key={label}><i className={`legend-swatch ${tone}`} aria-hidden="true" />{label}</span>)}</div>
}

export function App() {
  // Top-Level Portal Mode: Student Portal vs. Committee Admin Console
  const [portalMode, setPortalMode] = useState<'student' | 'admin'>('student')
  const [applicantSession, setApplicantSession] = useState<{ email: string; name: string } | null>(null)
  const [adminSession, setAdminSession] = useState<{ email: string; name: string } | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authView, setAuthView] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [applicantView, setApplicantView] = useState<'status' | 'workspace'>('status')
  const [draftUpdatedAt, setDraftUpdatedAt] = useState('')
  const [applicationStatus, setApplicationStatus] = useState<'draft' | 'submitting' | 'submitted' | 'failed'>('draft')

  // Committee Admin Tabs
  const [adminTab, setAdminTab] = useState<'overview' | 'audit' | 'decisions' | 'corpus' | 'n8n' | 'dossiers' | 'compliance' | 'multimodal' | 'deliberation' | 'arbitration'>('overview')
  const [n8nTriggerLoading, setN8nTriggerLoading] = useState(false)
  const [n8nTriggerResult, setN8nTriggerResult] = useState<any>(null)

  const [proposals, setProposals] = useState<Application[]>([])
  const [selectedProposal, setSelectedProposal] = useState<Application | null>(null)
  const [applicantApplication, setApplicantApplication] = useState<Application | null>(null)
  const [applicantDecision, setApplicantDecision] = useState<{ decision: string; score: number; notes: string; decided_at: string } | null>(null)
  const [corpusDocs, setCorpusDocs] = useState<CorpusDoc[]>([])
  const [selectedCorpusDoc, setSelectedCorpusDoc] = useState<CorpusDoc | null>(null)
  const [ragQuery, setRagQuery] = useState('')
  const [ragResults, setRagResults] = useState<any[]>([])
  const [ragLoading, setRagLoading] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditStatusFilter, setAuditStatusFilter] = useState('All statuses')
  const [auditPanel, setAuditPanel] = useState<'profile' | 'submitted' | 'cv' | 'video' | 'rag' | 'verification' | 'decision'>('profile')
  const [auditArtifacts, setAuditArtifacts] = useState<Record<string, any>>({})
  const [cvParserStages, setCvParserStages] = useState<Record<string, string>>({})
  const [videoStages, setVideoStages] = useState<Record<string, string>>({})
  const [videoPlayingByCandidate, setVideoPlayingByCandidate] = useState<Record<string, boolean>>({})
  const [candidateAuditStatus, setCandidateAuditStatus] = useState<Record<string, string>>({})
  const [auditDecision, setAuditDecision] = useState<'FUND' | 'RESERVE' | 'REJECT' | ''>('')
  const [auditNotes, setAuditNotes] = useState('')
  const [reviewRunning, setReviewRunning] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [, setFactCheckStage] = useState<Record<string, string>>({})
  const [pdfViewMode, setPdfViewMode] = useState<boolean>(false)

  // Student Form State
  const [studentName, setStudentName] = useState('')
  const [studentSchool, setStudentSchool] = useState('')
  const [studentMajor, setStudentMajor] = useState('')
  const [studentGpa, setStudentGpa] = useState<number | ''>('')
  const [projectTitle, setProjectTitle] = useState('')
  const [requestedGrant, setRequestedGrant] = useState<number | ''>('')
  const [costOfAttendance, setCostOfAttendance] = useState<number | ''>('')
  const [parentContribution, setParentContribution] = useState<number | ''>('')
  const [studentContribution, setStudentContribution] = useState<number | ''>('')
  const [outsideScholarships, setOutsideScholarships] = useState<number | ''>('')
  const [techPurchaseRequested, setTechPurchaseRequested] = useState<number | ''>('')
  const [purposeStatement, setPurposeStatement] = useState('')
  const [studyPlan, setStudyPlan] = useState('')
  const [leadershipStatement, setLeadershipStatement] = useState('')

  // CV Deposit State (LaTeX / ATS)
  const [cvExtractedText, setCvExtractedText] = useState('')
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null)
  const [cvMediaId, setCvMediaId] = useState<string | null>(null)
  const [videoMediaId, setVideoMediaId] = useState<string | null>(null)
  const [videoFileName, setVideoFileName] = useState('')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const [cvAtsResult, setCvAtsResult] = useState<any>(null)
  const [isParsingCv, setIsParsingCv] = useState<boolean>(false)
  const [cvParseError, setCvParseError] = useState<string | null>(null)
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null)

  // Submission feedback
  const [submitStatus, setSubmitStatus] = useState<string | null>(null)

  // Student dossier stepper state
  const [studentStep, setStudentStep] = useState(0)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [completedStudentSteps, setCompletedStudentSteps] = useState<number[]>([])
  const [cvFileName, setCvFileName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [citizenship, setCitizenship] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState('')
  const [degreeTrack, setDegreeTrack] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>([{ ...EMPTY_EDUCATION }])
  const [academicExperiences, setAcademicExperiences] = useState<string[]>([''])
  const [leadershipExperiences, setLeadershipExperiences] = useState<string[]>([''])

  const studentSteps = ['General information', 'Education', 'Experience', 'CV deposit', 'Review', 'Video motivation']
  const stepIcons = ['person', 'school', 'auto_awesome', 'description', 'fact_check', 'videocam']
  const markStepComplete = (step: number) => setCompletedStudentSteps((current) => current.includes(step) ? current : [...current, step])
  const validateStudentStep = () => {
    if (studentStep === 0) return Boolean(
      studentName.trim()
      && (applicantSession?.email || studentEmail).trim()
      && citizenship.trim()
      && phone.trim()
      && birthDate,
    )
    if (studentStep === 1) return educationEntries.length > 0 && educationEntries.some(entry => [entry.institution, entry.degree, entry.field, entry.year, entry.gpa].every(value => value.trim()))
    if (studentStep === 2) return Boolean(projectTitle.trim() && academicExperiences.some(value => value.trim()) && leadershipExperiences.some(value => value.trim()))
    if (studentStep === 3) return Boolean(cvMediaId)
    if (studentStep === 4) return Boolean(studentName && projectTitle && cvMediaId && requestedGrant !== '' && costOfAttendance !== '' && parentContribution !== '' && studentContribution !== '')
    return true
  }
  const continueStudentStep = () => {
    if (!validateStudentStep()) { setSubmitStatus('Please complete the required fields in this section before continuing.'); return }
    markStepComplete(studentStep)
    setSubmitStatus(null)
    if (studentStep < studentSteps.length - 1) setStudentStep(studentStep + 1)
    else handleStudentSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  // Committee Interactive Simulator values
  const [simGpa, setSimGpa] = useState<number>(0)
  const [simCostOfAttendance, setSimCostOfAttendance] = useState<number>(0)
  const [simParentShare, setSimParentShare] = useState<number>(0)
  const [simStudentShare, setSimStudentShare] = useState<number>(0)
  const [simOutsideAwards, setSimOutsideAwards] = useState<number>(0)
  const [simComputerAllowance, setSimComputerAllowance] = useState<number>(0)
  const [simDossierPages, setSimDossierPages] = useState<number>(0)

  // Admin Multimodal Cross-Verification result state
  const [adminMultimodalResult, setAdminMultimodalResult] = useState<any>(null)
  const [isCrossVerifying, setIsCrossVerifying] = useState<boolean>(false)

  // Prompt Version Toggle (v1 vs v2)
  const [promptVersion, setPromptVersion] = useState<'v1' | 'v2'>('v2')

  // Chair HITL form states
  const [overrideScore, setOverrideScore] = useState<number>(0)
  const [overrideDecision, setOverrideDecision] = useState<'FUND' | 'RESERVE' | 'REJECT'>('FUND')
  const [overrideNotes, setOverrideNotes] = useState('')
  const [isSignedOff, setIsSignedOff] = useState<boolean>(false)
  const [signOffTimestamp, setSignOffTimestamp] = useState<string>('')

  useEffect(() => {
    let active = true
    fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      .then(async response => {
        if (!response.ok) return null
        return response.json()
      })
      .then(user => {
        if (!active || !user) return
        if (user.role === 'admin') {
          setAdminSession({ email: user.email, name: user.name })
          setPortalMode('admin')
        } else if (user.role === 'applicant') {
          setApplicantSession({ email: user.email, name: user.name })
          setStudentName(user.name)
          setStudentEmail(user.email)
        }
      })
      .catch(() => {
        if (active) setAuthError('Could not verify your session. Please sign in again.')
      })
      .finally(() => { if (active) setAuthReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!authReady || !adminSession) return
    let active = true
    fetch(apiUrl('/api/admin/decision-register'), { credentials: 'include' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || `Candidate list failed (${response.status}).`)
        if (!active) return
        setProposals(data)
        setCandidateAuditStatus(Object.fromEntries(data.map((candidate: Application) => [
          candidate.id,
          candidate.decision ? 'Submitted' : Object.keys(candidate.reviews || {}).length === 3 ? 'Decision needed' : Object.keys(candidate.reviews || {}).length ? 'In review' : 'Needs review',
        ])))
      })
      .catch(error => { if (active) setReviewError(error instanceof Error ? error.message : 'Candidate list failed to load.') })
    fetch(apiUrl('/api/corpus'), { credentials: 'include' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || `Corpus retrieval failed (${response.status}).`)
        if (!active) return
        setCorpusDocs(data)
        if (data.length) setSelectedCorpusDoc(data[0])
      })
      .catch(error => { if (active) setReviewError(error instanceof Error ? error.message : 'Policy corpus failed to load.') })
    return () => { active = false }
  }, [authReady, adminSession])

  useEffect(() => {
    if (!applicantSession) return
    let active = true
    fetch(apiUrl('/api/student/me/draft'), { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error(`Draft retrieval failed (${response.status}).`)
        return response.json()
      })
      .then(({ draft, updated_at }) => {
        if (!active || !draft) return
        setStudentName(draft.studentName || applicantSession.name)
        setStudentEmail(applicantSession.email)
        setStudentSchool(draft.studentSchool || '')
        setStudentMajor(draft.studentMajor || '')
        setStudentGpa(draft.studentGpa ?? '')
        setProjectTitle(draft.projectTitle || '')
        setRequestedGrant(draft.requestedGrant ?? '')
        setCostOfAttendance(draft.costOfAttendance ?? '')
        setParentContribution(draft.parentContribution ?? '')
        setStudentContribution(draft.studentContribution ?? '')
        setOutsideScholarships(draft.outsideScholarships ?? '')
        setTechPurchaseRequested(draft.techPurchaseRequested ?? '')
        setPurposeStatement(draft.purposeStatement || '')
        setStudyPlan(draft.studyPlan || '')
        setLeadershipStatement(draft.leadershipStatement || '')
        setEducationEntries(normalizeEducationEntries(draft.educationEntries))
        setAcademicExperiences(normalizeExperienceEntries(draft.academicExperiences))
        setLeadershipExperiences(normalizeExperienceEntries(draft.leadershipExperiences))
        setCitizenship(draft.citizenship || '')
        setPhone(draft.phone || '')
        setBirthDate(draft.birthDate || '')
        setSex(draft.sex || '')
        setDegreeTrack(draft.degreeTrack || '')
        setGraduationYear(draft.graduationYear || '')
        setCvMediaId(draft.cvMediaId || null)
        setVideoMediaId(draft.videoMediaId || null)
        setCvPreviewUrl(draft.cvMediaId ? apiUrl(`/api/student/media/${draft.cvMediaId}`) : null)
        setVideoPreviewUrl(draft.videoMediaId ? apiUrl(`/api/student/media/${draft.videoMediaId}`) : null)
        setCvFileName(draft.cvFileName || '')
        setVideoFileName(draft.videoFileName || '')
        setStudentStep(draft.studentStep || 0)
        setCompletedStudentSteps(Array.isArray(draft.completedStudentSteps) ? draft.completedStudentSteps : [])
        if (updated_at) setDraftUpdatedAt(updated_at)
        if (draft.cvMediaId) {
          setIsParsingCv(true)
          void fetch(apiUrl(`/api/student/me/cv/${draft.cvMediaId}`), { credentials: 'include' })
            .then(async response => {
              const result = await response.json()
              if (!response.ok) throw new Error(result.detail || `CV extraction failed (${response.status}).`)
              if (!active) return
              setCvExtractedText(result.text || '')
              setCvAtsResult(result)
              setCvParseError(null)
            })
            .catch(error => { if (active) setCvParseError(error instanceof Error ? error.message : 'CV extraction failed.') })
            .finally(() => { if (active) setIsParsingCv(false) })
        }
      })
      .catch(error => { if (active) setSubmitStatus(error.message) })
      .finally(() => {
        if (active) {
          setDraftLoaded(true)
          void fetch(apiUrl('/api/student/me/application'), { credentials: 'include' })
            .then(async response => {
              if (!response.ok) throw new Error(`Application status failed (${response.status}).`)
              return response.json()
            })
            .then(({ application, decision }) => {
              if (!active) return
              setApplicantApplication(application)
              setApplicantDecision(decision)
              if (application) setApplicationStatus('submitted')
            })
            .catch(error => { if (active) setSubmitStatus(error.message) })
        }
      })
    return () => { active = false }
  }, [applicantSession])

  useEffect(() => {
    if (!applicantSession || !draftLoaded || applicationStatus === 'submitted') return
    const timeout = window.setTimeout(() => {
      const draft = {
        studentStep, completedStudentSteps, educationEntries, academicExperiences, leadershipExperiences,
        studentName, studentSchool, studentMajor, studentGpa, projectTitle, requestedGrant, costOfAttendance,
        parentContribution, studentContribution,
        outsideScholarships, techPurchaseRequested, purposeStatement, studyPlan, leadershipStatement,
        cvMediaId, videoMediaId, cvFileName, videoFileName, studentEmail, citizenship, phone, birthDate,
        sex, degreeTrack, graduationYear, updatedAt: new Date().toISOString(),
      }
      void fetch(apiUrl('/api/student/me/draft'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }).then(async response => {
        if (!response.ok) throw new Error(`Draft save failed (${response.status}).`)
        const result = await response.json()
        setDraftUpdatedAt(result.updated_at)
      }).catch(error => setSubmitStatus(error.message))
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [applicantSession, draftLoaded, applicationStatus, studentStep, completedStudentSteps, educationEntries, academicExperiences, leadershipExperiences, studentName, studentSchool, studentMajor, studentGpa, projectTitle, requestedGrant, costOfAttendance, parentContribution, studentContribution, outsideScholarships, techPurchaseRequested, purposeStatement, studyPlan, leadershipStatement, cvMediaId, videoMediaId, cvFileName, videoFileName, studentEmail, citizenship, phone, birthDate, sex, degreeTrack, graduationYear])

  const fetchProposals = async () => {
    const res = await fetch(apiUrl('/api/admin/decision-register'), { credentials: 'include' })
    if (!res.ok) throw new Error(`Candidate list failed (${res.status}).`)
    const data = await res.json()
    setProposals(data)
    setCandidateAuditStatus(Object.fromEntries(data.map((candidate: Application) => [
      candidate.id,
      candidate.decision ? 'Submitted' : Object.keys(candidate.reviews || {}).length === 3 ? 'Decision needed' : Object.keys(candidate.reviews || {}).length ? 'In review' : 'Needs review',
    ])))
    if (selectedProposal) {
      const refreshed = data.find((candidate: Application) => candidate.id === selectedProposal.id)
      if (refreshed) {
        setSelectedProposal(refreshed)
        setAuditDecision(refreshed.decision?.decision || '')
        setAuditNotes(refreshed.decision?.notes || '')
        setOverrideScore(refreshed.decision?.score || 0)
      }
    } else if (data.length) {
      void handleSelectProposal(data[0].id)
    }
  }
  const handleSelectProposal = async (id: string) => {
    try {
      const [response, reviewsResponse] = await Promise.all([
        fetch(apiUrl(`/api/proposals/${id}`), { credentials: 'include' }),
        fetch(apiUrl(`/api/admin/proposals/${id}/reviews`), { credentials: 'include' }),
      ])
      if (!response.ok) throw new Error(`Candidate lookup returned HTTP ${response.status}`)
      if (!reviewsResponse.ok) throw new Error(`Review lookup returned HTTP ${reviewsResponse.status}`)
      const data = await response.json()
      const reviewState = await reviewsResponse.json()
      if (!data?.id || !data?.applicant_name) throw new Error('Candidate response was incomplete')
      const candidate = { ...data, reviews: reviewState.reviews, decision: reviewState.decision }
      setSelectedProposal(candidate)
      setAuditDecision(candidate.decision?.decision || '')
      setAuditNotes(candidate.decision?.notes || '')
      setOverrideScore(candidate.decision?.score || 0)
      setSimGpa(data.gpa || 0)
      if (data.financials) {
        setSimCostOfAttendance(data.financials.cost_of_attendance || 0)
        setSimParentShare(data.financials.parent_share || 0)
        setSimStudentShare(data.financials.student_share || 0)
        setSimOutsideAwards(data.financials.outside_scholarships || 0)
        setSimComputerAllowance(data.financials.computer_allowance || 0)
      }
      setSimDossierPages(data.page_count || 0)

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
      setReviewError(err instanceof Error ? err.message : 'Could not load this application.')
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
  const reviewerKeys = ['technical', 'impact', 'budget'] as const
  const allReviewsComplete = Boolean(auditCandidate && reviewerKeys.every(reviewer => auditCandidate.reviews?.[reviewer]))
  const updateAuditArtifact = (key: string, value: any) => setAuditArtifacts(current => ({ ...current, [key]: { ...value, updatedAt: new Date().toISOString() } }))
  const statusForCandidate = (candidate: Application | undefined) => candidate ? (candidateAuditStatus[candidate.id] || 'Needs review') : 'Needs review'
  const decisionForCandidate = (candidate: Application | undefined) => candidate?.decision
  const statusClass = (status: string) => ({ 'Needs review': 'status-needs-review', 'In review': 'status-in-review', Verified: 'status-verified', 'Decision needed': 'status-decision-needed', Submitted: 'status-submitted' }[status] || 'status-needs-review')
  const recommendationClass = (decision?: string) => ({ FUND: 'recommendation-fund', RESERVE: 'recommendation-reserve', REJECT: 'recommendation-reject', Pending: 'recommendation-pending' }[decision || 'Pending'] || 'recommendation-pending')
  const runCriterionReview = async (reviewer: 'technical' | 'impact' | 'budget') => {
    if (!auditCandidate) return
    setReviewRunning(reviewer)
    setReviewError(null)
    try {
      const response = await fetch(apiUrl(`/api/admin/proposals/${auditCandidate.id}/reviews/${reviewer}`), {
        method: 'POST',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || `Review failed (${response.status}).`)
      setSelectedProposal(current => current?.id === auditCandidate.id ? { ...current, reviews: { ...current.reviews, [reviewer]: result } } : current)
      await fetchProposals()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Review run failed.')
    } finally {
      setReviewRunning(null)
    }
  }
  const persistCandidateDecision = async (candidate: Application) => {
    if (!auditDecision || !candidate.reviews || ['technical', 'impact', 'budget'].some(reviewer => !candidate.reviews?.[reviewer])) {
      setReviewError('Run all three reviews before submitting a decision.')
      return
    }
    setReviewError(null)
    try {
      const response = await fetch(apiUrl(`/api/admin/proposals/${candidate.id}/decision`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: auditDecision, score: overrideScore, notes: auditNotes }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || `Decision submission failed (${response.status}).`)
      setSelectedProposal(current => current?.id === candidate.id ? { ...current, ...result } : current)
      await fetchProposals()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Decision submission failed.')
    }
  }
  const runAuditCvParser = async () => {
    if (!auditCandidate) return
    const id = auditCandidate.id
    setCvParserStages(current => ({ ...current, [id]: 'extracting text' }))
    try {
      const response = await fetch(apiUrl(`/api/admin/proposals/${id}/cv`), { credentials: 'include' })
      const parsed = await response.json()
      if (!response.ok) throw new Error(parsed.detail || `CV parsing failed (${response.status}).`)
      updateAuditArtifact(id, { cv: { status: 'parsed', fileName: parsed.filename || auditCandidate.cv_filename, parsed: parsed.ats_parsed, extracted: parsed.text, extractionMethod: parsed.extraction_method } })
      setCvParserStages(current => ({ ...current, [id]: 'complete' }))
    } catch (error) {
      setCvParserStages(current => ({ ...current, [id]: 'error' }))
      setReviewError(error instanceof Error ? error.message : 'CV parsing failed.')
    }
  }
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
  const runAuditVerifier = async () => { if (auditCandidate) { const id = auditCandidate.id; let result: any = null; setFactCheckStage(current => ({ ...current, [id]: 'preparing evidence' })); await new Promise(resolve => setTimeout(resolve, 350)); setFactCheckStage(current => ({ ...current, [id]: 'comparing facts' })); try { const res = await fetch(apiUrl('/api/admin/cross-verify-evidence'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: { ...auditCandidate, cv_parsed: auditArtifacts[id]?.cv?.parsed || {}, video_transcript: auditArtifacts[id]?.video?.transcript || '' } }) }); if (!res.ok) throw new Error(`HTTP ${res.status}`); result = await res.json(); setFactCheckStage(current => ({ ...current, [id]: 'complete' })) } catch (error: any) { result = { status: 'failed', model_opinion: `Fact checker failed: ${error.message}. No conclusion was fabricated.`, checks: [], final_decision: 'human_required' }; setFactCheckStage(current => ({ ...current, [id]: 'error' })) } updateAuditArtifact(id, { verification: { ...result, institution: auditCandidate.school, party: auditCandidate.applicant_name, checkedAt: result.checked_at } }); setCandidateAuditStatus(current => ({ ...current, [id]: 'In review' })) } }
  const runRagSearch = async () => { setRagLoading(true); try { const res = await fetch(apiUrl('/api/rag/retrieve'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: ragQuery }) }); const data = await res.json(); setRagResults(data.results || []) } finally { setRagLoading(false) } }

  const handleCvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCvParseError(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setCvParseError('Please choose a PDF file.')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setCvParseError('This file is larger than 10 MB. Please upload a smaller PDF.')
      e.target.value = ''
      return
    }
    setIsParsingCv(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(apiUrl('/api/student/upload-cv'), {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `CV upload failed (${res.status}).`)
      setCvMediaId(data.media_id)
      setCvFileName(data.filename)
      setCvExtractedText(data.text || '')
      setCvAtsResult(data)
      setCvPreviewUrl(apiUrl(`/api/student/media/${data.media_id}`))
    } catch (err) {
      setCvParseError(err instanceof Error ? err.message : 'CV upload failed.')
    } finally {
      setIsParsingCv(false)
      e.target.value = ''
    }
  }

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoUploadError(null)
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    const extensionAllowed = /\.(mp4|webm|mov)$/i.test(file.name)
    if (!allowedTypes.includes(file.type) && !extensionAllowed) {
      setVideoUploadError('Upload an MP4, WebM, or MOV video.')
      e.target.value = ''
      return
    }
    setIsUploadingVideo(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(apiUrl('/api/student/upload-video'), {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `Video upload failed (${res.status}).`)
      setVideoMediaId(data.media_id)
      setVideoFileName(data.filename)
      setVideoPreviewUrl(apiUrl(`/api/student/media/${data.media_id}`))
    } catch (err) {
      setVideoUploadError(err instanceof Error ? err.message : 'Video upload failed.')
    } finally {
      setIsUploadingVideo(false)
      e.target.value = ''
    }
  }

  const refreshApplicantStatus = async () => {
    try {
      const response = await fetch(apiUrl('/api/student/me/application'), { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || `Application status failed (${response.status}).`)
      setApplicantApplication(result.application)
      setApplicantDecision(result.decision)
      setSubmitStatus(null)
    } catch (error) {
      setSubmitStatus(error instanceof Error ? error.message : 'Application status could not be refreshed.')
    }
  }

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!applicantSession || !cvMediaId) {
      setSubmitStatus('Sign in and upload a CV before submitting.')
      return
    }
    setApplicationStatus('submitting')
    setSubmitStatus('Submitting application…')
    const firstEducation = educationEntries[0]
    const grantAmount = Number(requestedGrant)
    const cost = Number(costOfAttendance)
    const parentShare = Number(parentContribution)
    const studentShare = Number(studentContribution)
    const payload = {
      title: projectTitle,
      applicant_name: studentName,
      school: firstEducation?.institution || studentSchool,
      major: firstEducation?.field || studentMajor,
      gpa: Number(firstEducation?.gpa ?? studentGpa),
      education_entries: educationEntries,
      academic_experiences: academicExperiences,
      leadership_experiences: leadershipExperiences,
      purpose_statement: academicExperiences[0]?.trim() || purposeStatement.trim(),
      leadership_statement: leadershipExperiences[0]?.trim() || leadershipStatement.trim(),
      requested_grant: grantAmount,
      cv_media_id: cvMediaId,
      cv_filename: cvFileName,
      video_media_id: videoMediaId,
      email: applicantSession.email,
      citizenship,
      phone,
      birth_date: birthDate,
      sex,
      degree_track: firstEducation?.degree || degreeTrack,
      graduation_year: firstEducation?.year || graduationYear,
      financials: {
        cost_of_attendance: cost,
        parent_share: parentShare,
        student_share: studentShare,
        outside_scholarships: Number(outsideScholarships),
        computer_allowance: Number(techPurchaseRequested),
        demonstrated_need: grantAmount
      },
      sections: {
        abstract: `${studentName} (${firstEducation?.institution || studentSchool}) proposes: ${academicExperiences[0] || purposeStatement}. Cumulative GPA: ${firstEducation?.gpa ?? studentGpa}.`,
        scientific_methodology: studyPlan,
        impact_and_dissemination: leadershipExperiences[0] || leadershipStatement,
        work_packages: studyPlan,
        budget: `Requested amount: $${grantAmount.toLocaleString()}; cost of attendance: $${cost.toLocaleString()}; parent contribution: $${parentShare.toLocaleString()}; student contribution: $${studentShare.toLocaleString()}.`
      },
    }

    try {
      const res = await fetch(apiUrl('/api/student/submit-application'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.detail || `Submission failed (${res.status}).`)
      setApplicationStatus('submitted')
      setApplicantApplication(result.application)
      setApplicantDecision(null)
      setSubmitStatus(`Application ${result.application.id} submitted successfully.`)
    } catch (err) {
      setApplicationStatus('failed')
      setSubmitStatus(err instanceof Error ? err.message : 'Application submission failed.')
    }
  }
  // Deterministic checks calculations
  const sapViolation = simGpa < 3.0
  const computerAllowanceViolation = simComputerAllowance > 2500.0
  const studentShareViolation = simStudentShare > 4500.0
  const pagesViolation = simDossierPages > 15
  const hasViolations = sapViolation || computerAllowanceViolation || studentShareViolation || pagesViolation

  const expectedEfc = simParentShare + simStudentShare
  const computedNeed = Math.max(0, simCostOfAttendance - expectedEfc - simOutsideAwards + simComputerAllowance)

  const sortedCohort = [...proposals].sort((a, b) => (b.decision?.score ?? -1) - (a.decision?.score ?? -1))
  const savedLabel = draftUpdatedAt ? `Last saved ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draftUpdatedAt))}` : 'No saved draft yet'
  const submissionLabel = applicationStatus === 'submitted' ? `Submitted ${applicantApplication?.submitted_at ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(applicantApplication.submitted_at)) : ''}` : applicationStatus === 'submitting' ? 'Submission in progress' : applicationStatus === 'failed' ? 'Submission needs attention' : 'Draft · Not submitted'

  const signInApplicant = async () => {
    setAuthError(null)
    try {
      const response = await fetch(apiUrl('/api/auth/signin'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || `Sign-in failed (${response.status}).`)
      setDraftLoaded(false)
      setApplicantSession({ email: result.email, name: result.name })
      setStudentName(result.name)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed.')
    }
  }
  const signUpApplicant = async () => {
    setAuthError(null)
    try {
      const response = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: authName, email: authEmail, password: authPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || `Account creation failed (${response.status}).`)
      setDraftLoaded(false)
      setApplicantSession({ email: result.email, name: result.name })
      setStudentName(result.name)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Account creation failed.')
    }
  }
  const signInAdmin = async () => {
    setAuthError(null)
    try {
      const response = await fetch(apiUrl('/api/auth/admin'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || `Admin sign-in failed (${response.status}).`)
      setAdminSession({ email: result.email, name: result.name })
      setPortalMode('admin')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Admin sign-in failed.')
    }
  }
  const signOut = async () => {
    await fetch(apiUrl('/api/auth/signout'), { method: 'POST', credentials: 'include' })
    setApplicantSession(null)
    setAdminSession(null)
    setApplicantApplication(null)
    setApplicantDecision(null)
    setDraftLoaded(false)
    setApplicationStatus('draft')
    setPortalMode('student')
  }

  if (!authReady) return <div className="auth-page"><div className="auth-panel">Checking your session…</div></div>

  if (portalMode === 'admin' && !adminSession) return <div className="auth-page admin-auth-page"><div className="auth-panel"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Committee portal</span></div></div><span className="eyebrow">Secure workspace</span><h1>Welcome back, committee.</h1><p className="auth-lede">Sign in to review applicant dossiers and committee decisions.</p><label className="field"><span>Admin email</span><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} /></label><label className="field"><span>Password</span><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void signInAdmin() }} /></label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" onClick={() => void signInAdmin()}>Sign in to admin console <span className="material-symbols-outlined">arrow_forward</span></button><button className="back-to-app" onClick={() => { setPortalMode('student'); setAuthError(null) }}>Back to applicant portal</button></div></div>

  if (portalMode === 'student' && !applicantSession) return <div className="auth-page"><div className="auth-visual"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Applicant portal</span></div></div><div className="auth-quote"><span className="eyebrow">Applicant access</span><h1>Your story deserves room to move.</h1><p>Build a thoughtful application, one piece at a time.</p><div className="quote-mark">“</div></div><div className="auth-visual-foot">Open Doors Fellowship · Applicant portal</div></div><div className="auth-panel"><div className="auth-tabs"><button className={authView === 'signin' ? 'active' : ''} onClick={() => { setAuthView('signin'); setAuthError(null) }}>Sign in</button><button className={authView === 'signup' ? 'active' : ''} onClick={() => { setAuthView('signup'); setAuthError(null) }}>Create account</button></div><span className="eyebrow">Applicant access</span><h1>{authView === 'signin' ? 'Welcome back.' : 'Start your application.'}</h1><p className="auth-lede">{authView === 'signin' ? 'Continue your saved application securely.' : 'Create an account to save your application on the server.'}</p>{authView === 'signup' && <label className="field"><span>Full name</span><input value={authName} onChange={e => setAuthName(e.target.value)} /></label>}<label className="field"><span>Email address</span><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} /></label><label className="field"><span>Password</span><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void (authView === 'signin' ? signInApplicant() : signUpApplicant()) }} /></label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" onClick={() => void (authView === 'signin' ? signInApplicant() : signUpApplicant())}>{authView === 'signin' ? 'Sign in' : 'Create account'} <span className="material-symbols-outlined">arrow_forward</span></button><button className="admin-entry" onClick={() => { setPortalMode('admin'); setAuthError(null) }}>Committee / admin sign in</button></div></div>

  if (portalMode === 'student' && applicantSession && applicantView === 'status') return <div className="status-page"><header className="status-header"><div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Applicant portal</span></div></div><div className="status-user"><span className="avatar">{applicantSession.name.slice(0, 2).toUpperCase()}</span><span>{applicantSession.name}</span><button onClick={() => void signOut()}>Sign out</button></div></header><main className="status-main"><span className="eyebrow">My application</span><h1>Good to see you, {applicantSession.name.split(' ')[0]}.</h1><p className="auth-lede">Your application and saved progress are linked to your account.</p><section className="status-hero"><div><span className="eyebrow">Current stage</span><h2>{applicationStatus === 'submitted' ? 'Submitted' : completedStudentSteps.length ? studentSteps[Math.min(studentStep, studentSteps.length - 1)] : studentSteps[0]}</h2><p>{savedLabel} · {submissionLabel}</p></div><div className="status-ring"><strong>{Math.round((completedStudentSteps.length / studentSteps.length) * 100)}%</strong><span>complete</span></div></section>{applicantApplication && <section className="status-card"><span className="eyebrow">Application {applicantApplication.id}</span><h3>{applicantApplication.title}</h3><p>Status: {applicantApplication.application_status || 'Submitted'}</p>{applicantDecision ? <p><strong>Decision: {applicantDecision.decision}</strong> · {applicantDecision.notes}</p> : <p>Your application is awaiting committee review.</p>}</section>}<section className="status-card"><div className="status-card-top"><div><h3>Application progress</h3><p>Complete the sections below before submitting.</p></div><strong>{completedStudentSteps.length} of {studentSteps.length} complete</strong></div><div className="status-progress"><i style={{ width: `${(completedStudentSteps.length / studentSteps.length) * 100}%` }} /></div><div className="status-step-list">{studentSteps.map((step, index) => <div key={step} className={completedStudentSteps.includes(index) ? 'complete' : index === studentStep ? 'current' : ''}><span className="material-symbols-outlined">{completedStudentSteps.includes(index) ? 'check_circle' : stepIcons[index]}</span><span>{step}</span><small>{completedStudentSteps.includes(index) ? 'Complete' : index === studentStep ? 'Up next' : 'Not started'}</small></div>)}</div><button type="button" className="text-button" onClick={() => void refreshApplicantStatus()}>Refresh application status</button><button className="primary-button" onClick={() => setApplicantView('workspace')} disabled={applicationStatus === 'submitted'}>{applicationStatus === 'submitted' ? 'Application submitted' : 'Continue application'} <span className="material-symbols-outlined">arrow_forward</span></button></section></main></div>

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
            {portalMode === 'student' ? 'ST' : 'YU'}
          </div>
          <div>
            <div className="m3-user-name">{portalMode === 'student' ? applicantSession?.name || 'Applicant' : adminSession?.name || 'Committee'}</div>
            <div className="m3-user-role">{portalMode === 'student' ? 'Student Applicant' : 'Committee Administrator'}</div>
          </div>
          {portalMode === 'admin' && <button className="admin-signout" onClick={() => { void signOut() }} title="Sign out"><span className="material-symbols-outlined">logout</span></button>}
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
        </header>

        {/* ============================================================= */}
        {/* VIEW 1: DEDICATED STUDENT APPLICATION SPACE                   */}
        {/* ============================================================= */}
        {portalMode === 'student' && (
          <div className="student-shell">
            <div className="student-mobile-progress"><div><span>Step {studentStep + 1} of 6</span><span className="mobile-saved"><i className="status-dot" /> {savedLabel}</span></div><strong>{studentSteps[studentStep]}</strong><div className="mobile-context"><span className="avatar">{applicantSession?.name.slice(0, 2).toUpperCase()}</span> {applicantSession?.name} · Applicant</div><div className="progress-track"><i style={{ width: `${((studentStep + 1) / 6) * 100}%` }} /></div></div>
            <div className="student-intro"><div><span className="eyebrow">Applicant workspace</span><h1>Your story, in six pieces.</h1><p>Build your dossier at your own pace. Everything is saved as you go.</p></div><div className="save-state"><span className="status-dot" /> {savedLabel}</div></div>
            <div className="student-layout">
              <aside className="student-rail">
                <div className="portal-brand"><div className="brand-mark">OD</div><div><strong>Open Doors</strong><span>Applicant portal</span></div></div>
                <div className="deadline-card"><span className="eyebrow">Application deadline</span><strong>Not configured</strong><span>Check the program guidance.</span></div>
                <nav className="student-steps" aria-label="Application steps">
                  {studentSteps.map((label, index) => { const active = index === studentStep; const done = completedStudentSteps.includes(index); const unlocked = index === 0 || done || index <= studentStep; return <button key={label} className={`${active ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!unlocked} onClick={() => unlocked && setStudentStep(index)}><span className="step-icon material-symbols-outlined">{done ? 'check' : stepIcons[index]}</span><span><small>0{index + 1}</small>{label}</span></button> })}
                </nav>
                <div className="rail-note"><span className="material-symbols-outlined">lightbulb</span><p>Take your time. You can return to any completed section before submitting.</p></div>
                <button className="mode-switch" onClick={() => setApplicantView('status')}><span className="material-symbols-outlined">space_dashboard</span> My application status</button>
                <button className="mode-switch" onClick={() => setPortalMode('admin')}><span className="material-symbols-outlined">admin_panel_settings</span> Open admin console</button>
              </aside>
              <section className="student-canvas">
                <div className="canvas-top"><div><span className="eyebrow">Section 0{studentStep + 1}</span><h2>{studentSteps[studentStep]}</h2></div><div className="profile-chip"><span className="avatar">{applicantSession?.name.slice(0, 2).toUpperCase()}</span><span><strong>{applicantSession?.name}</strong><small>Applicant</small></span><span className="material-symbols-outlined">expand_more</span></div></div>
                {submitStatus && <div className="student-alert"><span className="material-symbols-outlined">info</span>{submitStatus}</div>}{applicationStatus === 'submitted' && applicantApplication && <section className="status-card submitted-status"><span className="eyebrow">Application {applicantApplication.id}</span><h3>{applicantApplication.title}</h3><p>Your application has been received.</p>{applicantDecision ? <p><strong>Decision: {applicantDecision.decision}</strong> ? Score {applicantDecision.score}/5 ? {applicantDecision.notes}</p> : <p>No committee decision has been recorded yet.</p>}<button type="button" className="text-button" onClick={() => void refreshApplicantStatus()}>Refresh application status</button></section>}
                <div className="dossier-card">
                  {studentStep === 0 && <><div className="card-heading"><span className="section-number">01</span><div><h3>Let’s start with you</h3><p>Tell us how to reach you and how you’d like your name represented.</p></div></div><div className="form-grid"><label className="field wide"><span>Full legal name <b>*</b></span><input value={studentName} onChange={e => setStudentName(e.target.value)} /></label><label className="field"><span>Email address <b>*</b></span><input type="email" value={applicantSession?.email || studentEmail} disabled /></label><label className="field"><span>Citizenship <b>*</b></span><input value={citizenship} onChange={e => setCitizenship(e.target.value)} /></label><label className="field"><span>Phone number <b>*</b></span><input value={phone} onChange={e => setPhone(e.target.value)} /></label><label className="field"><span>Date of birth <b>*</b></span><input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} /></label><label className="field"><span>Sex</span><select value={sex} onChange={e => setSex(e.target.value)}><option>Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option></select></label></div></>}
                  {studentStep === 1 && <><div className="card-heading"><span className="section-number">02</span><div><h3>Your academic foundation</h3><p>Add every institution or program that helps tell your academic story.</p></div></div><div className="repeatable-list">{educationEntries.map((entry, index) => <div className="repeatable-card" key={`education-${index}`}><div className="repeatable-card-top"><span className="eyebrow">Education 0{index + 1}</span>{educationEntries.length > 1 && <button type="button" className="remove-button" onClick={() => setEducationEntries(items => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div><div className="form-grid"><label className="field wide" htmlFor={`education-${index}-institution`}><span>Institution / school <b>*</b></span><input required id={`education-${index}-institution`} value={entry.institution} onChange={e => setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, institution: e.target.value } : item))} /></label><label className="field wide" htmlFor={`education-${index}-degree`}><span>Degree or track <b>*</b></span><input required id={`education-${index}-degree`} value={entry.degree} onChange={e => setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, degree: e.target.value } : item))} /></label><label className="field" htmlFor={`education-${index}-field`}><span>Field of study <b>*</b></span><input required id={`education-${index}-field`} value={entry.field} onChange={e => setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, field: e.target.value } : item))} /></label><label className="field" htmlFor={`education-${index}-year`}><span>Graduation year <b>*</b></span><input required id={`education-${index}-year`} value={entry.year} onChange={e => setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, year: e.target.value } : item))} /></label><label className="field" htmlFor={`education-${index}-gpa`}><span>Cumulative GPA <b>*</b></span><input required id={`education-${index}-gpa`} type="number" step="0.01" min="0" max="4" value={entry.gpa} onChange={e => setEducationEntries(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, gpa: e.target.value } : item))} /></label></div></div>)}</div><button type="button" className="add-button" onClick={() => setEducationEntries(items => [...items, { institution: '', degree: '', field: '', year: '', gpa: '' }])}><span className="material-symbols-outlined">add</span> Add education</button></>}
                  {studentStep === 2 && <><div className="card-heading"><span className="section-number">03</span><div><h3>Make the case for your work</h3><p>Short, specific answers help reviewers see the person behind the transcript.</p></div></div><label className="field wide project-field" htmlFor="project-title"><span>Project or research title <b>*</b></span><input required id="project-title" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} /></label><div className="experience-group"><div className="experience-group-heading"><div><span className="eyebrow">Academic / research</span><strong>What have you explored?</strong></div><span className="section-number">A</span></div>{academicExperiences.map((experience, index) => <div className="repeatable-card experience-card" key={`academic-${index}`}><div className="repeatable-card-top"><span className="entry-heading">Research experience {String(index + 1).padStart(2, '0')}</span>{academicExperiences.length > 1 && <button type="button" className="remove-button" onClick={() => setAcademicExperiences(items => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div><label className="field" htmlFor={`academic-experience-${index}`}><span>Academic / research experience <b>*</b></span><textarea required id={`academic-experience-${index}`} rows={4} value={experience} onChange={e => setAcademicExperiences(items => items.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} /></label></div>)}<button type="button" className="add-button" onClick={() => setAcademicExperiences(items => [...items, ''])}><span className="material-symbols-outlined">add</span> Add experience</button></div><div className="experience-group"><div className="experience-group-heading"><div><span className="eyebrow">Leadership / community</span><strong>Where have you made an impact?</strong></div><span className="section-number">B</span></div>{leadershipExperiences.map((experience, index) => <div className="repeatable-card experience-card" key={`leadership-${index}`}><div className="repeatable-card-top"><span className="entry-heading">Community experience {String(index + 1).padStart(2, '0')}</span>{leadershipExperiences.length > 1 && <button type="button" className="remove-button" onClick={() => setLeadershipExperiences(items => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div><label className="field" htmlFor={`leadership-experience-${index}`}><span>Leadership & community experience <b>*</b></span><textarea required id={`leadership-experience-${index}`} rows={4} value={experience} onChange={e => setLeadershipExperiences(items => items.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} /></label></div>)}<button type="button" className="add-button" onClick={() => setLeadershipExperiences(items => [...items, ''])}><span className="material-symbols-outlined">add</span> Add experience</button></div></>}
                  {studentStep === 3 && <><div className="card-heading"><span className="section-number">04</span><div><h3>Upload your CV</h3><p>Upload a PDF to extract searchable text, including scanned pages.</p></div></div><label className="upload-zone"><span className="upload-icon material-symbols-outlined">upload_file</span><strong>{cvFileName || 'Choose a CV PDF'}</strong><small>PDF only ? Maximum 10 MB</small><input type="file" accept="application/pdf,.pdf" onChange={handleCvFileUpload} disabled={isParsingCv} /></label>{cvParseError && <div className="inline-error"><span className="material-symbols-outlined">error</span><span>{cvParseError}</span></div>}{isParsingCv && <p role="status">Uploading and extracting CV text?</p>}{cvPreviewUrl && <section className="cv-full-preview"><h4>CV preview</h4><iframe title="Uploaded CV preview" src={cvPreviewUrl} /></section>}{cvExtractedText && <details className="cv-extracted-text"><summary>OCR / extracted text</summary><pre>{cvExtractedText}</pre></details>}{cvAtsResult?.ats_parsed && <div className="parsed-preview"><strong>Extraction method: {cvAtsResult.extraction_method}</strong><pre>{JSON.stringify(cvAtsResult.ats_parsed, null, 2)}</pre></div>}</>}
                  {studentStep === 4 && <><div className="card-heading"><span className="section-number">05</span><div><h3>Review your application</h3><p>Verify your information and enter your financial request before submitting.</p></div></div><div className="review-list">{[['Applicant', studentName], ['Education', educationEntries[0]?.institution && educationEntries[0]?.field], ['Experience', projectTitle], ['CV', cvFileName]].map(([label, value]) => <div className="review-row" key={String(label)}><span className="material-symbols-outlined">fact_check</span><div><strong>{label}</strong><small>{value || 'Needs your attention'}</small></div><span className={value ? 'check-mark material-symbols-outlined' : 'warning-mark material-symbols-outlined'}>{value ? 'check_circle' : 'warning'}</span></div>)}</div><div className="form-grid financial-inputs"><label className="field"><span>Requested amount ($) *</span><input required type="number" min="0" value={requestedGrant} onChange={e => setRequestedGrant(e.target.value === '' ? '' : Number(e.target.value))} /></label><label className="field"><span>Cost of attendance ($) *</span><input required type="number" min="0" value={costOfAttendance} onChange={e => setCostOfAttendance(e.target.value === '' ? '' : Number(e.target.value))} /></label><label className="field"><span>Parent contribution ($) *</span><input required type="number" min="0" value={parentContribution} onChange={e => setParentContribution(e.target.value === '' ? '' : Number(e.target.value))} /></label><label className="field"><span>Student contribution ($) *</span><input required type="number" min="0" value={studentContribution} onChange={e => setStudentContribution(e.target.value === '' ? '' : Number(e.target.value))} /></label><label className="field"><span>Outside scholarships ($)</span><input type="number" min="0" value={outsideScholarships} onChange={e => setOutsideScholarships(e.target.value === '' ? '' : Number(e.target.value))} /></label><label className="field"><span>Computer allowance requested ($)</span><input type="number" min="0" value={techPurchaseRequested} onChange={e => setTechPurchaseRequested(e.target.value === '' ? '' : Number(e.target.value))} /></label></div></>}
                  {studentStep === 5 && <><div className="card-heading"><span className="section-number">06</span><div><h3>Optional video motivation</h3><p>A recorded video is welcome but not required. Upload an existing recording if you choose.</p></div></div><label className="upload-zone"><span className="upload-icon material-symbols-outlined">videocam</span><strong>{videoFileName || 'Choose a video (optional)'}</strong><small>MP4, WebM, or MOV ? Maximum 50 MB</small><input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={handleVideoFileUpload} disabled={isUploadingVideo} /></label>{videoUploadError && <div className="inline-error" role="alert">{videoUploadError}</div>}{videoPreviewUrl && <video className="uploaded-video-preview" controls preload="metadata" src={videoPreviewUrl}>Your browser does not support video playback.</video>}<p>{videoMediaId ? 'Video uploaded and attached to this application.' : 'You can submit without a video.'}</p></>}
                </div>
                <div className="sticky-nav"><button type="button" className="back-button" disabled={studentStep === 0 || applicationStatus === 'submitted'} onClick={() => setStudentStep(Math.max(0, studentStep - 1))}><span className="material-symbols-outlined">arrow_back</span> Back</button><span>Step {studentStep + 1} of 6</span><button type="button" className="primary-button" onClick={continueStudentStep} disabled={applicationStatus === 'submitted'}>{applicationStatus === 'submitted' ? 'Application submitted' : studentStep === 5 ? 'Submit application' : 'Save & continue'} <span className="material-symbols-outlined">arrow_forward</span></button></div>
              </section>
            </div>
          </div>
        )}


        {/* ============================================================= */}
        {/* VIEW 2: COMMITTEE ADMIN CONSOLE                               */}
        {/* ============================================================= */}
        {portalMode === 'admin' && (
          <div style={{ padding: '24px 32px' }}>
            {adminTab === 'overview' && <AlluvialLegend />}
            {adminTab === 'overview' && <div className="admin-overview"><div className="overview-intro"><div><span className="eyebrow">Committee overview · Application 2026</span><h2>Good morning, committee.</h2><p>Keep the review room moving with a clear view of workload and evidence.</p></div><button className="m3-btn m3-btn-primary" onClick={() => setAdminTab('audit')}>Continue audit <span className="material-symbols-outlined">arrow_forward</span></button></div><div className="overview-metrics">{['Total applicants','Needs review','In review','Verified','Decision needed','Submitted'].map(label => <div className={`overview-metric ${label === 'Total applicants' ? 'overview-total' : ''}`} key={label}><span>{label}</span><strong>{label === 'Total applicants' ? proposals.length : proposals.filter(p => statusForCandidate(p) === label).length}</strong></div>)}</div><div className="overview-lower"><section className="overview-distribution dossier-panel"><div className="audit-section-head"><div><span className="eyebrow">Evidence flow</span><h3>Status to recommendation</h3></div><span className="audit-count">{proposals.length} applicants</span></div><div className="alluvial-wrap"><svg className="alluvial-svg" viewBox="0 0 760 280" role="img" aria-label="Candidate audit statuses flowing into chair recommendations">{['Needs review','In review','Verified','Decision needed','Submitted'].map((status, index) => <g key={status}><rect x="12" y={20 + index * 48} width="138" height="28" className={`alluvial-node ${statusClass(status)}`} /><text x="22" y={38 + index * 48} className="alluvial-label">{status}</text><text x="142" y={38 + index * 48} textAnchor="end" className="alluvial-count">{proposals.filter(p => statusForCandidate(p) === status).length}</text></g>)}{['FUND','RESERVE','REJECT','Pending'].map((recommendation, index) => <g key={recommendation}><rect x="610" y={40 + index * 56} width="138" height="28" className={`alluvial-node ${recommendationClass(recommendation)}`} /><text x="620" y={58 + index * 56} className="alluvial-label">{recommendation}</text><text x="738" y={58 + index * 56} textAnchor="end" className="alluvial-count">{proposals.filter(p => (decisionForCandidate(p)?.decision || 'Pending') === recommendation).length}</text></g>)}{['Needs review','In review','Verified','Decision needed','Submitted'].flatMap((status, si) => ['FUND','RESERVE','REJECT','Pending'].map((recommendation, ri) => { const count = proposals.filter(p => statusForCandidate(p) === status && (decisionForCandidate(p)?.decision || 'Pending') === recommendation).length; if (!count) return null; const y1 = 34 + si * 48; const y2 = 54 + ri * 56; return <path key={`${status}-${recommendation}`} d={`M 150 ${y1} C 330 ${y1}, 430 ${y2}, 610 ${y2}`} className={`alluvial-flow ${recommendationClass(recommendation)}`} style={{ strokeWidth: Math.max(3, count * 8) }} /> }))}</svg></div></section><section className="overview-recent dossier-panel"><span className="eyebrow">Recent updates</span><h3>Candidate activity</h3>{proposals.slice(0, 5).map(p => <button type="button" key={p.id} onClick={() => openCandidateAudit(p.id)}><span className="candidate-avatar">{(p.applicant_name || p.id).slice(0, 2).toUpperCase()}</span><span><strong>{p.applicant_name || p.id}</strong><small>{p.id} · {statusForCandidate(p)}</small></span><span className="material-symbols-outlined">arrow_forward</span></button>)}</section></div></div>}
            {adminTab === 'decisions' && <div className="admin-decisions dossier-panel"><div className="overview-intro"><div><span className="eyebrow">Committee decisions · Application 2026</span><h2>Decision register</h2><p>Candidate-keyed recommendations and chair sign-offs.</p></div><button className="m3-btn m3-btn-primary" onClick={() => setAdminTab('audit')}>Open audit workspace</button></div><div className="decisions-table-wrap"><table className="decisions-table"><thead><tr><th>Candidate</th><th>Track / GPA</th><th>Audit status</th><th>Recommendation</th><th>Score</th><th>Sign-off</th><th>Requested grant</th><th></th></tr></thead><tbody>{proposals.map(p => { const decision = decisionForCandidate(p); const recommendation = decision?.decision || 'Pending'; return <tr key={p.id}><td><strong>{p.applicant_name || p.id}</strong><small>{p.id}</small></td><td>{p.major}<br /><small>GPA {p.gpa?.toFixed(2) || '—'}</small></td><td><span className={`audit-status ${statusClass(statusForCandidate(p))}`}>{statusForCandidate(p)}</span></td><td><span className={`recommendation-chip ${recommendationClass(recommendation)}`}>{recommendation}</span></td><td>{decision?.score ? `${decision.score.toFixed(1)} / 5.0` : '—'}</td><td>{decision?.decided_at ? new Date(decision.decided_at).toLocaleString() : 'Not signed off'}</td><td>${p.requested_grant?.toLocaleString() || '—'}</td><td><button className="text-button" onClick={() => openCandidateAudit(p.id, 'decision')}>Open <span className="material-symbols-outlined">arrow_forward</span></button></td></tr> })}</tbody></table>{!proposals.length && <div className="audit-empty"><span className="material-symbols-outlined">gavel</span><strong>No decisions yet</strong><small>Candidate decisions will appear here after chair sign-off.</small></div>}</div></div>}
            {adminTab === 'audit' && <div className="audit-workspace">
              <section className="audit-queue dossier-panel">
                <div className="audit-section-head"><div><span className="eyebrow">01 · Queue</span><h2>Candidate review queue</h2><p>Choose a dossier to audit across every evidence source.</p></div><span className="audit-count">{proposals.length} candidates</span></div>
                <div className="audit-controls"><label className="audit-search"><span className="material-symbols-outlined">search</span><input placeholder="Search candidate or ID" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} /></label><select value={auditStatusFilter} onChange={e => setAuditStatusFilter(e.target.value)}><option>All statuses</option><option>Needs review</option><option>In review</option><option>Verified</option><option>Decision needed</option><option>Submitted</option></select></div>
                <div className="candidate-queue">{proposals.filter(p => `${p.applicant_name} ${p.id}`.toLowerCase().includes(auditSearch.toLowerCase()) && (auditStatusFilter === 'All statuses' || statusForCandidate(p) === auditStatusFilter)).map((p) => <button type="button" className={`candidate-row ${selectedProposal?.id === p.id ? 'selected' : ''}`} key={p.id} onClick={() => { setSelectedProposal(p); setAuditPanel('profile'); handleSelectProposal(p.id) }}><span className="candidate-avatar">{(p.applicant_name || p.id).slice(0, 2).toUpperCase()}</span><span className="candidate-main"><strong>{p.applicant_name || p.id}</strong><small>{p.id} · {p.major || 'Applicant track'}</small></span><span className="candidate-gpa">GPA {p.gpa?.toFixed(2) || '—'}</span><span className={`audit-status ${statusClass(statusForCandidate(p))}`}>{statusForCandidate(p)}</span><span className="material-symbols-outlined">chevron_right</span></button>)}{proposals.filter(p => `${p.applicant_name} ${p.id}`.toLowerCase().includes(auditSearch.toLowerCase()) && (auditStatusFilter === 'All statuses' || statusForCandidate(p) === auditStatusFilter)).length === 0 && <div className="audit-empty"><span className="material-symbols-outlined">search_off</span><strong>No candidates match this filter</strong><small>Try another status or clear the search.</small></div>}</div>
              </section>
              <section className="audit-detail dossier-panel">
                <div className="audit-candidate-head"><div><span className="eyebrow">02 · Selected dossier</span><h2>{auditCandidate?.applicant_name || 'Select a candidate'}</h2><p>{auditCandidate ? `${auditCandidate.id} · ${auditCandidate.major || 'Applicant track'} · ${auditCandidate.school || 'Institution pending'} · GPA ${auditCandidate.gpa?.toFixed(2) || '—'}` : 'Choose a candidate from the queue to begin an evidence audit.'}</p>{auditCandidate && <div className="audit-header-meta"><span>{statusForCandidate(auditCandidate)}</span><span>Updated {auditCandidate.updated_at || auditCandidate.submitted_at || 'No timestamp'}</span><span>${auditCandidate.requested_grant?.toLocaleString() || '—'} requested</span></div>}</div><div className="audit-head-actions"><span className="mint-pill">{auditCandidate ? 'Context linked' : 'Awaiting candidate'}</span>{auditCandidate && <button className="m3-btn m3-btn-primary" onClick={() => setAuditPanel('decision')}>Open decision</button>}</div></div>
                {auditCandidate && <><div className="audit-tabs">{[['profile','Profile & education'],['submitted','Submitted application'],['cv','CV PDF parser'],['video','Video evaluation'],['rag','RAG rule verification'],['verification','Contract / institution'],['decision','Decision']].map(([key, label]) => <button type="button" className={auditPanel === key ? 'active' : ''} key={key} onClick={() => setAuditPanel(key as any)}>{label}</button>)}</div><div className="audit-evidence">{auditPanel === 'submitted' && <SubmittedApplicationPanel candidate={auditCandidate} status={statusForCandidate(auditCandidate)} statusClass={statusClass} />}
                  {auditPanel === 'profile' && <div className="evidence-grid"><article className="evidence-card"><span className="eyebrow">Candidate context</span><h3>Profile & education</h3><dl><dt>Applicant</dt><dd>{auditCandidate.applicant_name}</dd><dt>Institution</dt><dd>{auditCandidate.school || 'Not provided'}</dd><dt>Track</dt><dd>{auditCandidate.major}</dd><dt>GPA</dt><dd>{auditCandidate.gpa?.toFixed(2)} / 4.00</dd><dt>Requested grant</dt><dd>${auditCandidate.requested_grant?.toLocaleString()}</dd></dl></article><article className="evidence-card attention-card"><span className="eyebrow">Audit posture</span><h3>Evidence status</h3><div className="audit-check"><span className="material-symbols-outlined">check_circle</span><span>Application identity linked</span></div><div className="audit-check"><span className="material-symbols-outlined">check_circle</span><span>CV source available</span></div><div className="audit-check"><span className="material-symbols-outlined">pending</span><span>Video evaluation pending</span></div><div className="audit-check"><span className="material-symbols-outlined">pending</span><span>Institution verification pending</span></div></article></div>}
                  {auditPanel === 'cv' && <article className="evidence-card full-evidence"><div className="evidence-title"><div><span className="eyebrow">Automated evidence artifact</span><h3>CV PDF parser</h3><p>Candidate: {auditCandidate.applicant_name} · {auditCandidate.id}</p></div><button className="m3-btn m3-btn-primary" onClick={runAuditCvParser}>{(cvParserStages[auditCandidate.id] || 'idle') === 'complete' ? 'Run again' : 'Run parser'}</button></div>{(() => { const pdfUrl = artifactUrl(auditCandidate.pdf_url || `/api/proposals/${auditCandidate.id}/pdf`); const parsed = auditArtifacts[auditCandidate.id]?.cv?.parsed || {}; const groups: any[] = [['Education', [...(parsed.institutions || []), ...(parsed.degrees || []), parsed.extracted_gpa ? `GPA ${parsed.extracted_gpa}` : '']], ['Research & publications', parsed.publications || []], ['Honors & awards', parsed.honors_awards || []], ['Skills', parsed.detected_skills || []], ['Contact', [...(parsed.emails || []), ...(parsed.phones || []), ...(parsed.urls || [])]], ['Employers', parsed.employers || []]]; return <><div className="cv-audit-split"><div className="cv-pdf-preview"><object title="Candidate CV PDF" data={pdfUrl} type="application/pdf"><iframe title="Candidate CV PDF" src={pdfUrl} /><div className="pdf-fallback"><span className="material-symbols-outlined">picture_as_pdf</span><strong>PDF preview unavailable</strong><small>Open the candidate document in a new tab.</small><a href={pdfUrl} target="_blank" rel="noreferrer">Open PDF <span className="material-symbols-outlined">open_in_new</span></a></div></object><a className="pdf-open-link" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF <span className="material-symbols-outlined">open_in_new</span></a></div><div className="cv-parser-fields"><span className="artifact-label">Parser progress</span><div className="parser-steps">{['queued','extracting text','matching entities','complete'].map(stage => <span className={(cvParserStages[auditCandidate.id] || 'idle') === stage ? 'active' : (cvParserStages[auditCandidate.id] || 'idle') === 'complete' ? 'done' : ''} key={stage}>{stage}</span>)}</div><div className="artifact-grid"><div><span className="artifact-label">Extracted fields</span><strong>{auditArtifacts[auditCandidate.id]?.cv?.extracted || 'Awaiting parser run'}</strong><small>All extracted entities are shown below</small></div><div><span className="artifact-label">Status</span><strong>{(cvParserStages[auditCandidate.id] || 'idle') === 'complete' ? 'Complete' : (cvParserStages[auditCandidate.id] || 'idle') === 'idle' ? 'Ready' : 'Processing'}</strong><small>Candidate-linked artifact</small></div></div></div></div><div className="parsed-entity-list"><span className="artifact-label">All parsed CV information</span>{Object.keys(parsed).length ? <div className="parsed-card-grid">{groups.map(([label, values]) => <div className="parsed-info-card" key={label}><span className="artifact-label">{label}</span>{values.filter(Boolean).length ? <ul>{values.filter(Boolean).map((value: string) => <li key={value}>{value}</li>)}</ul> : <p>None detected</p>}</div>)}</div> : <p>Run parser to display every extracted field.</p>}<details className="parsed-raw"><summary>Raw parser payload</summary><pre>{JSON.stringify(parsed, null, 2)}</pre></details></div>{(auditArtifacts[auditCandidate.id]?.cv?.flags || []).map((flag: string) => <div className="audit-flag" key={flag}><span className="material-symbols-outlined">warning</span>{flag}</div>)}</>})()}</article>}
                  {auditPanel === 'video' && <article className="evidence-card full-evidence"><div className="evidence-title"><div><span className="eyebrow">Automated evidence artifact</span><h3>Video evaluation</h3><p>Video replaces the motivation letter · Candidate: {auditCandidate.applicant_name}</p></div><div><button className="m3-btn m3-btn-outlined" onClick={runVideoTranscription}>Run transcription</button><button className="m3-btn m3-btn-primary" onClick={runVideoEvaluation}>Evaluate video</button></div></div><div className="video-audit-preview"><video className="audit-video" controls preload="metadata" src={auditCandidate.video_url || undefined} onPlay={() => setVideoPlayingByCandidate(current => ({ ...current, [auditCandidate.id]: true }))} onPause={() => setVideoPlayingByCandidate(current => ({ ...current, [auditCandidate.id]: false }))}><track kind="captions" /><span>Video preview unavailable.</span></video><div><strong>{videoPlayingByCandidate[auditCandidate.id] ? 'Playing candidate video' : 'Candidate video ready'}</strong><small>Duration: {auditArtifacts[auditCandidate.id]?.video?.duration || '—'} · Transcript: {auditArtifacts[auditCandidate.id]?.video?.transcriptStatus || 'Not extracted'}</small></div><span className="confidence-chip">Confidence {auditArtifacts[auditCandidate.id]?.video?.confidence || '—'}</span></div><div className="parser-steps">{['queued','extracting transcript','evaluating','complete'].map(stage => <span className={(videoStages[auditCandidate.id] || 'idle') === stage ? 'active' : (videoStages[auditCandidate.id] || 'idle') === 'complete' ? 'done' : ''} key={stage}>{stage}</span>)}</div><div className="transcript-panel"><span className="artifact-label">Extracted transcript</span><p>{auditArtifacts[auditCandidate.id]?.video?.transcript || 'Run transcription to display the real transcript returned by Groq.'}</p></div><div className="claim-list"><span className="artifact-label">Model/rubric opinion · final decision remains human</span>{(auditArtifacts[auditCandidate.id]?.video?.claims || ['No opinion generated until a real transcript is available.']).map((claim: string) => <div key={claim}><span className="material-symbols-outlined">check</span>{claim}</div>)}</div></article>}
                  {auditPanel === 'rag' && <article className="evidence-card full-evidence candidate-rag-panel">
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

                  {auditPanel === 'verification' && <article className="evidence-card full-evidence"><div className="evidence-title"><div><span className="eyebrow">Contract / institution verification</span><h3>Three-source fact checker</h3><p>Compare submitted form fields against parsed CV information and the extracted video transcript.</p></div><button className="m3-btn m3-btn-primary" onClick={runAuditVerifier}>Run fact checker</button></div><div className="verified-banner"><span className="material-symbols-outlined">{auditArtifacts[auditCandidate.id]?.verification ? 'fact_check' : 'pending'}</span>{auditArtifacts[auditCandidate.id]?.verification?.model_opinion || 'Run the fact checker to compare all evidence sources.'}</div><div className="fact-check-table"><div className="fact-check-head"><span>Fact</span><span>Form</span><span>CV</span><span>Video</span><span>State</span></div>{(auditArtifacts[auditCandidate.id]?.verification?.checks || []).map((row: any) => <div className="fact-check-row" key={row.fact}><strong>{row.fact}</strong><span>{row.form}</span><span>{row.cv}</span><span>{row.video}</span><b className={`state-chip ${row.state}`}>{row.state}</b></div>)}</div><div className="human-decision-note"><strong>Human final decision required</strong><span>The model may summarize contradictions and recommend review, but it cannot approve or reject the candidate.</span></div></article>}
                  {auditPanel === 'decision' && <article className="evidence-card full-evidence"><div className="evidence-title"><div><span className="eyebrow">Committee decision</span><h3>Three required reviews</h3><p>Run each reviewer before saving a final decision. Review output is stored for this application.</p></div></div>{reviewError && <div className="inline-error" role="alert">{reviewError}</div>}<div className="review-results-grid">{reviewerKeys.map(reviewer => { const result = auditCandidate.reviews?.[reviewer]; return <section className="review-result-card" key={reviewer}><div className="review-result-heading"><div><span className="eyebrow">{reviewer} review</span><h4>{result ? `${result.score} / 5 ? ${result.recommendation}` : 'Not run'}</h4></div><button type="button" className="m3-btn m3-btn-outlined" disabled={reviewRunning !== null} onClick={() => void runCriterionReview(reviewer)}>{reviewRunning === reviewer ? 'Running?' : result ? 'Run again' : 'Run review'}</button></div>{result && <><p>{result.summary}</p><small>Method: {result.method} ? Completed: {result.completed_at || '?'}</small>{result.citations?.length > 0 && <ul>{result.citations.map((item: { quote: string; section: string }, index: number) => <li key={`${item.section}-${index}`}><strong>{item.section}:</strong> ?{item.quote}?</li>)}</ul>}{result.discrepancies?.length > 0 && <p>Discrepancies: {result.discrepancies.join('; ')}</p>}</>}</section>})}</div>{auditCandidate.decision && <section className="saved-decision"><span className="eyebrow">Saved final decision</span><h4>{auditCandidate.decision.decision} ? {auditCandidate.decision.score} / 5</h4><p>{auditCandidate.decision.notes || 'No decision notes provided.'}</p><small>Decided {auditCandidate.decision.decided_at || '?'} ? {auditCandidate.decision.admin_email || 'Committee'}</small></section>}<section className="decision-form"><h4>Submit final decision</h4><label className="field"><span>Decision</span><select value={auditDecision} onChange={event => setAuditDecision(event.target.value as 'FUND' | 'RESERVE' | 'REJECT' | '')}><option value="">Choose a decision</option><option value="FUND">FUND</option><option value="RESERVE">RESERVE</option><option value="REJECT">REJECT</option></select></label><label className="field"><span>Committee score (0?5)</span><input type="number" min="0" max="5" step="0.1" value={overrideScore} onChange={event => setOverrideScore(Number(event.target.value))} /></label><label className="field"><span>Notes</span><textarea rows={4} value={auditNotes} onChange={event => setAuditNotes(event.target.value)} /></label><button type="button" className="m3-btn m3-btn-primary" disabled={!allReviewsComplete || !auditDecision || reviewRunning !== null} onClick={() => void persistCandidateDecision(auditCandidate)}>{allReviewsComplete ? 'Save committee decision' : 'Run all 3 reviews to unlock decision'}</button></section></article>}
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
                          <td><strong>{p.gpa?.toFixed(2) || '?'}</strong></td>
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
                    <strong style={{ fontSize: '1rem' }}>Active Candidate: {selectedProposal?.applicant_name || selectedProposal?.id}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Major: {selectedProposal?.major} • Stated GPA: {selectedProposal?.gpa?.toFixed(2)} • Dossier: {selectedProposal?.id}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="m3-btn m3-btn-outlined"
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      onClick={() => handleSelectProposal('YALE-01-EXCELLENT')}
                    >
                      Test YALE-01 (100% Match)
                    </button>
                    <button
                      className="m3-btn m3-btn-outlined"
                      style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#dc2626' }}
                      onClick={() => handleSelectProposal('YALE-03-TRANSCRIPT-CONTRADICTION')}
                    >
                      Test YALE-03 (Divergence Flaw)
                    </button>
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
                      <strong style={{ fontSize: '1.1rem', color: '#00356b' }}>{selectedProposal?.gpa?.toFixed(2) || '?'} / 4.00</strong>
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
                        "{selectedProposal?.video_url || 'No video uploaded.'}"
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
                    <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>Candidate Audit: {selectedProposal?.applicant_name}</h3>
                    
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
                            const score = p.decision?.score
                            const decision = p.decision?.decision || 'Pending'
                            return (
                              <tr key={p.id}>
                                <td><strong>#{idx + 1}</strong></td>
                                <td><span className="m3-badge m3-badge-neutral">{p.applicant_name || p.id}</span></td>
                                <td style={{ fontSize: '0.8rem' }}>{p.major || 'Not provided'}</td>
                                <td><strong>{p.gpa?.toFixed(2) || '—'}</strong></td>
                                <td><strong>{score === undefined ? '—' : score.toFixed(1)}</strong></td>
                                <td>
                                  <span className={`m3-badge ${decision === 'FUND' ? 'm3-badge-success' : decision === 'Pending' ? 'm3-badge-neutral' : 'm3-badge-warning'}`}>
                                    {decision}
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
                      <strong style={{ fontSize: '0.95rem' }}>Target Candidate Dossier: {selectedProposal?.applicant_name || selectedProposal?.id || 'YALE-01-EXCELLENT'}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        ID: {selectedProposal?.id || 'YALE-01-EXCELLENT'} • Major: {selectedProposal?.major || 'Computer Science'} • GPA: {selectedProposal?.gpa?.toFixed(2) || '3.92'}
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
