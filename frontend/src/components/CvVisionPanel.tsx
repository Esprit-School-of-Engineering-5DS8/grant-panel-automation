import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './CvVisionPanel.css'

export interface CvVisionBox {
  id: string
  page: number
  label: string
  text: string
  score: number
  label_confidence: number
  bbox: { x: number; y: number; w: number; h: number }
  pixel: { x0: number; y0: number; x1: number; y1: number }
  polygon: number[][]
}

export interface CvVisionPage {
  index: number
  width: number
  height: number
  image_url: string
}

export interface CvVisionResult {
  status: string
  proposal_id: string
  engine: string
  ocr_engine: string
  label_model: string
  labelled_by: string
  labels: string[]
  page_count: number
  pages: CvVisionPage[]
  boxes: CvVisionBox[]
  fields: { label: string; count: number; items: { id: string; page: number; text: string }[] }[]
  structured: Record<string, string[]>
  stats: {
    box_count: number
    line_count: number
    avg_score: number
    label_counts: Record<string, number>
    render_dpi: number
  }
  generated_at: string
  document_source?: string
  document_name?: string
  message?: string
  error?: string
}

interface CvVisionPanelProps {
  proposalId: string
  applicantName: string
  pdfUrl?: string
  apiUrl: (path: string) => string
  onResult?: (proposalId: string, result: CvVisionResult) => void
}

const STAGES = ['rendering pages', 'reading text (OCR)', 'labelling fields', 'complete']

const LABEL_COLORS: Record<string, string> = {
  Name: '#6d4aff',
  Introduction: '#2f6bff',
  Education: '#1f9d63',
  Experience: '#f08a1d',
  Projects: '#e0457b',
  Skills: '#8b5cf6',
  Personal: '#0ea5b7',
  Other: '#94a3b8',
}

const colorFor = (label: string) => LABEL_COLORS[label] || LABEL_COLORS.Other

const SOURCE_LABELS: Record<string, string> = {
  'uploaded-cv': 'Uploaded CV file',
  'cv-latex': 'Deposited CV (rendered from LaTeX)',
  'proposal-pdf': 'Candidate proposal document',
}

export default function CvVisionPanel({ proposalId, applicantName, pdfUrl, apiUrl, onResult }: CvVisionPanelProps) {
  const [result, setResult] = useState<CvVisionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [activePage, setActivePage] = useState(1)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'json'>('table')
  const [hiddenLabels, setHiddenLabels] = useState<Record<string, boolean>>({})
  const [zoom, setZoom] = useState(1)

  const onResultRef = useRef(onResult)
  useEffect(() => { onResultRef.current = onResult }, [onResult])

  const load = useCallback((force: boolean) => {
    let cancelled = false
    const timer = window.setInterval(() => setStageIndex(current => Math.min(current + 1, STAGES.length - 1)), 650)

    const endpoint = `/api/admin/cv-ocr/${encodeURIComponent(proposalId)}${force ? '?force=true' : ''}`
    fetch(apiUrl(endpoint))
      .then(async response => {
        if (!response.ok) {
          let detail = `Request failed (HTTP ${response.status}).`
          try {
            const body = await response.json()
            detail = body?.detail || body?.message || detail
          } catch { /* keep default detail */ }
          throw new Error(detail)
        }
        return (await response.json()) as CvVisionResult
      })
      .then(data => {
        if (cancelled) return
        if (data.status === 'unavailable') {
          setError(data.message || 'The OCR engine is unavailable on the server.')
          return
        }
        setResult(data)
        setActivePage(data.pages?.[0]?.index ?? 1)
        onResultRef.current?.(proposalId, data)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => {
        if (cancelled) return
        window.clearInterval(timer)
        setStageIndex(STAGES.length - 1)
        setLoading(false)
      })

    return () => { cancelled = true; window.clearInterval(timer) }
  }, [apiUrl, proposalId])

  useEffect(() => load(false), [load])

  const rerun = () => {
    setResult(null)
    setError(null)
    setSelectedId(null)
    setHoverId(null)
    setStageIndex(0)
    setLoading(true)
    load(true)
  }

  const pages = result?.pages ?? []
  const boxes = useMemo(() => result?.boxes ?? [], [result])

  const boxesForPage = useMemo(() => boxes.filter(box => box.page === activePage), [boxes, activePage])
  const visibleBoxes = useMemo(
    () => boxesForPage.filter(box => !hiddenLabels[box.label]),
    [boxesForPage, hiddenLabels],
  )
  const activePageMeta = pages.find(page => page.index === activePage) ?? pages[0]

  const labelSummary = useMemo(() => {
    if (!result) return []
    return result.labels
      .map(label => ({ label, count: result.stats.label_counts[label] || 0 }))
      .filter(entry => entry.count > 0)
  }, [result])

  const toggleLabel = (label: string) => {
    setHiddenLabels(current => ({ ...current, [label]: !current[label] }))
  }

  const focusBox = (box: CvVisionBox) => {
    setSelectedId(box.id)
    if (box.page !== activePage) setActivePage(box.page)
  }

  const highlightedId = hoverId || selectedId

  return (
    <article className="evidence-card full-evidence cvv-panel">
      <div className="evidence-title cvv-head">
        <div>
          <span className="eyebrow">Automated vision artifact</span>
          <h3>CV field detection</h3>
          <p>Candidate: {applicantName} · {proposalId}</p>
        </div>
        <div className="cvv-head-actions">
          {pdfUrl && (
            <a className="m3-btn m3-btn-outlined" href={pdfUrl} target="_blank" rel="noreferrer">
              Open PDF <span className="material-symbols-outlined">open_in_new</span>
            </a>
          )}
          <button className="m3-btn m3-btn-primary" onClick={rerun} disabled={loading}>
            <span className="material-symbols-outlined">{result ? 'refresh' : 'document_scanner'}</span>
            {loading ? 'Extracting…' : result ? 'Re-run extraction' : 'Run extraction'}
          </button>
        </div>
      </div>

      <div className="cvv-toolbar">
        <div className="cvv-legend">
          {labelSummary.length > 0 ? labelSummary.map(({ label, count }) => (
            <button
              type="button"
              key={label}
              className={`cvv-legend-chip ${hiddenLabels[label] ? 'off' : ''}`}
              onClick={() => toggleLabel(label)}
              title={`${hiddenLabels[label] ? 'Show' : 'Hide'} ${label}`}
            >
              <span className="cvv-swatch" style={{ background: colorFor(label) }} />
              {label}
              <b>{count}</b>
            </button>
          )) : (result?.labels ?? Object.keys(LABEL_COLORS)).map(label => (
            <span className="cvv-legend-chip muted" key={label}>
              <span className="cvv-swatch" style={{ background: colorFor(label) }} />
              {label}
            </span>
          ))}
        </div>
        <div className="cvv-metrics">
          <span className="cvv-metric"><b>{result?.ocr_engine || 'RapidOCR'}</b><small>OCR engine</small></span>
          <span className="cvv-metric"><b>{result?.stats.box_count ?? 0}</b><small>Detected fields</small></span>
          <span className="cvv-metric"><b>{result ? `${Math.round((result.stats.avg_score || 0) * 100)}%` : '—'}</b><small>Avg. confidence</small></span>
          <span className="cvv-metric"><b>{result ? labelModelName(result.label_model, result.labelled_by) : '—'}</b><small>Labelling model</small></span>
        </div>
      </div>

      {loading && (
        <div className="cvv-progress">
          <div className="parser-steps">
            {STAGES.map((stage, index) => (
              <span key={stage} className={index < stageIndex ? 'done' : index === stageIndex ? 'active' : ''}>{stage}</span>
            ))}
          </div>
          <p>Rendering the document, running OCR for bounding boxes, then labelling each field with the Groq model.</p>
        </div>
      )}

      {error && !loading && (
        <div className="cvv-error">
          <span className="material-symbols-outlined">error</span>
          <div>
            <strong>CV extraction could not complete</strong>
            <p>{error}</p>
          </div>
          <button className="m3-btn m3-btn-outlined" onClick={rerun}>Try again</button>
        </div>
      )}

      {result && !loading && !error && (
        <div className="cvv-workspace">
          {pages.length > 1 && (
            <aside className="cvv-rail" aria-label="CV pages">
              {pages.map(page => (
                <button
                  type="button"
                  key={page.index}
                  className={`cvv-thumb ${page.index === activePage ? 'active' : ''}`}
                  onClick={() => setActivePage(page.index)}
                >
                  <img src={apiUrl(page.image_url)} alt={`CV page ${page.index}`} />
                  <span>Page {page.index}</span>
                </button>
              ))}
            </aside>
          )}

          <div className="cvv-canvas-col">
            <div className="cvv-canvas-tools">
              <span className="cvv-source">
                <span className="material-symbols-outlined">description</span>
                {SOURCE_LABELS[result.document_source || ''] || 'CV document'}
                {result.document_name ? ` · ${result.document_name}` : ''}
              </span>
              <div className="cvv-zoom">
                <button type="button" onClick={() => setZoom(z => Math.max(0.6, Number((z - 0.15).toFixed(2))))} aria-label="Zoom out">
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => setZoom(z => Math.min(2.4, Number((z + 0.15).toFixed(2))))} aria-label="Zoom in">
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            <div className="cvv-canvas">
              {activePageMeta && (
                <div className="cvv-page" style={{ width: `${zoom * 100}%` }}>
                  <img src={apiUrl(activePageMeta.image_url)} alt={`CV page ${activePage}`} draggable={false} />
                  {visibleBoxes.map(box => {
                    const color = colorFor(box.label)
                    const isActive = box.id === highlightedId
                    return (
                      <button
                        type="button"
                        key={box.id}
                        className={`cvv-box ${isActive ? 'active' : ''} ${selectedId === box.id ? 'selected' : ''}`}
                        style={{
                          left: `${box.bbox.x * 100}%`,
                          top: `${box.bbox.y * 100}%`,
                          width: `${box.bbox.w * 100}%`,
                          height: `${box.bbox.h * 100}%`,
                          borderColor: color,
                          background: isActive ? `${color}33` : `${color}14`,
                        }}
                        onMouseEnter={() => setHoverId(box.id)}
                        onMouseLeave={() => setHoverId(null)}
                        onFocus={() => setHoverId(box.id)}
                        onBlur={() => setHoverId(null)}
                        onClick={() => focusBox(box)}
                      >
                        {isActive && <span className="cvv-box-tag" style={{ background: color }}>{box.label}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="cvv-side">
            <div className="cvv-tabs" role="tablist">
              <button role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
              <button role="tab" aria-selected={view === 'json'} className={view === 'json' ? 'active' : ''} onClick={() => setView('json')}>JSON</button>
            </div>

            {view === 'table' ? (
              <div className="cvv-table">
                <div className="cvv-table-head">
                  <span>Label</span>
                  <span>Text</span>
                  <span>Score</span>
                </div>
                {boxes.length === 0 && <p className="cvv-empty">No text detected on this document.</p>}
                {boxes.map(box => (
                  <button
                    type="button"
                    key={box.id}
                    className={`cvv-row ${selectedId === box.id ? 'selected' : ''} ${hiddenLabels[box.label] ? 'dim' : ''}`}
                    onMouseEnter={() => setHoverId(box.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => focusBox(box)}
                  >
                    <span className="cvv-row-label">
                      <span className="cvv-swatch" style={{ background: colorFor(box.label) }} />
                      {box.label}
                    </span>
                    <span className="cvv-row-text">{box.text}</span>
                    <span className="cvv-row-score">{box.score.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <pre className="cvv-json">{JSON.stringify(result, null, 2)}</pre>
            )}

            <div className="cvv-side-foot">
              <span>Labelled by <b>{result.labelled_by}</b> · Generated {new Date(result.generated_at).toLocaleString()}</span>
            </div>
          </aside>
        </div>
      )}
    </article>
  )
}

function labelModelName(model: string, labelledBy: string) {
  if (labelledBy === 'heuristic') return 'keyword heuristic'
  return model || 'groq'
}
