export interface Application {
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
    funding_type?: string
    funding_program?: string
  }
  sections?: {
    abstract?: string
    scientific_methodology?: string
    impact_and_dissemination?: string
    work_packages?: string
    budget?: string
  }
  video_url?: string
  video_filename?: string
  video_metadata?: any
  video_transcript?: string
  video_duration?: number
}

export interface CorpusDoc {
  id: string
  title: string
  filename: string
  pdf_filename?: string
  pdf_url?: string
  content: string
}

export interface EducationEntry {
  institution: string
  degree: string
  field: string
  year: string
  gpa: string
}

export type DecisionType = 'FUND' | 'RESERVE' | 'REJECT'

export interface CandidateDecision {
  decision: DecisionType
  notes: string
  score: number
  signedOffAt?: string
}

export type AdminTab =
  | 'overview'
  | 'audit'
  | 'decisions'
  | 'corpus'
  | 'settings'
  | 'arbitration'
  | 'n8n'

export type CandidateView = 'all' | 'pools'
