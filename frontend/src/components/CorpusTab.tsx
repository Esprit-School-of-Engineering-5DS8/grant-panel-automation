import { HeroCard } from '../m3/HeroCard'
import type { CorpusDoc } from '../types'

export interface CorpusTabProps {
  totalCandidates: number
  needsReviewCount: number
  corpusDocs: CorpusDoc[]
  selectedCorpusDoc: CorpusDoc | null
  setSelectedCorpusDoc: (doc: CorpusDoc) => void
  ragQuery: string
  setRagQuery: (query: string) => void
  ragResults: any[]
  ragLoading: boolean
  pdfViewMode: boolean
  setPdfViewMode: (mode: boolean) => void
  runRagSearch: () => void
  onOpenWorkspace: () => void
  onGoTo: (tab: any) => void
  artifactUrl: (url?: string) => string
}

export function CorpusTab({
  totalCandidates,
  needsReviewCount,
  corpusDocs,
  selectedCorpusDoc,
  setSelectedCorpusDoc,
  ragQuery,
  setRagQuery,
  ragResults,
  ragLoading,
  pdfViewMode,
  setPdfViewMode,
  runRagSearch,
  onOpenWorkspace,
  onGoTo,
  artifactUrl,
}: CorpusTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <HeroCard
        total={totalCandidates}
        needsReview={needsReviewCount}
        title="Yale Regulatory Knowledge Base & Certified PDFs"
        subtitle="Scraped from official Yale Student Financial Services (finaid.yale.edu) & Fellowship Office (funding.yale.edu)."
        searchPlaceholder="Search rules, GPA criteria, video requirements..."
        onSearch={(q) => setRagQuery(q)}
        onOpenWorkspace={onOpenWorkspace}
        actions={[
          { label: 'Run RAG query', icon: 'search', onClick: runRagSearch },
          { label: 'All candidates', icon: 'groups', onClick: () => onGoTo('audit') },
          { label: 'Decision register', icon: 'gavel', onClick: () => onGoTo('decisions') },
          { label: 'Overview', icon: 'space_dashboard', onClick: () => onGoTo('overview') },
        ]}
      />
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

        <div className="rag-search-panel">
          <div>
            <span className="eyebrow">RAG retrieval test</span>
            <strong>Query the rules corpus</strong>
            <small>Retrieve source-backed chunks before reviewing a candidate.</small>
          </div>
          <input
            value={ragQuery}
            onChange={e => setRagQuery(e.target.value)}
            placeholder="e.g. GPA eligibility, funding evidence, video requirements"
            onKeyDown={e => { if (e.key === 'Enter') runRagSearch() }}
          />
          <button className="m3-btn m3-btn-primary" onClick={runRagSearch} disabled={ragLoading}>
            {ragLoading ? 'Retrieving…' : 'Retrieve rules'}
          </button>
        </div>

        {ragResults.length > 0 && (
          <div className="rag-results">
            <div className="artifact-label">Retrieved evidence · {ragResults.length} matches</div>
            {ragResults.map((result: any) => (
              <article className="rag-result" key={result.document}>
                <div>
                  <strong>{result.document}</strong>
                  <span className="rag-score">Score {result.score}</span>
                </div>
                <p>{result.snippet}</p>
              </article>
            ))}
          </div>
        )}

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
    </div>
  )
}
