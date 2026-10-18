import { useEffect, useMemo, useRef, useState } from 'react'
import './VideoPanel.css'

export interface TranscriptSegment {
  start?: number
  end?: number
  text?: string
}

export interface TranscriptPayload {
  transcript?: string
  transcript_status?: string
  transcriptStatus?: string
  duration?: number | string
  confidence?: number
  segments?: TranscriptSegment[]
  flags?: string[]
}

export interface VideoClaim {
  claim?: string
  evidence?: string
  start?: number
  end?: number
}

export interface VisualEvent {
  timestamp?: number
  observation?: string
}

export interface VideoReviewPayload {
  status?: string
  model?: string
  summary?: string
  claims?: VideoClaim[]
  concerns?: string[]
  visual_events?: VisualEvent[]
  frame_count?: number
  frame_notice?: string
  checked_at?: string
}

export interface VideoEndorsement {
  value: string
  label: string
  hint: string
}

interface VideoPanelProps {
  candidateId: string
  applicantName: string
  videoUrl?: string
  videoFilename?: string
  auditStatus?: string
  stageStatuses?: Record<string, { status?: string; error?: string }>
  transcript?: TranscriptPayload | null
  review?: VideoReviewPayload | null
  busy?: boolean
  endorsement?: VideoEndorsement | null
  onEndorse?: (endorsement: VideoEndorsement) => void
  onRunTranscription?: () => void
  onRunEvaluation?: () => void
  activeStep?: string
  onNavigateStep?: (step: string) => void
}

/** Chair-only video endorsement; carries into the final decision step. */
export const VIDEO_ENDORSEMENTS: VideoEndorsement[] = [
  { value: 'no', label: 'No', hint: 'Leaning REJECT' },
  { value: 'unsure', label: 'Not sure', hint: 'Leaning RESERVE' },
  { value: 'yes', label: 'Yes', hint: 'Leaning FUND' },
  { value: 'strong-yes', label: 'Strong Yes', hint: 'Strong FUND' },
]

type LeftTab = 'transcript' | 'actions' | 'snippets'
type RightTab = 'evaluation' | 'tldr'

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export default function VideoPanel({
  candidateId,
  applicantName,
  videoUrl,
  videoFilename,
  transcript,
  review,
  stageStatuses,
}: VideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [leftTab, setLeftTab] = useState<LeftTab>('transcript')
  const [rightTab, setRightTab] = useState<RightTab>('evaluation')
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [mediaDuration, setMediaDuration] = useState(0)

  const segments = useMemo(
    () => (transcript?.segments || []).filter(segment => (segment.text || '').trim().length > 0),
    [transcript],
  )
  const claims = review?.claims || []
  const concerns = review?.concerns || []
  const visualEvents = review?.visual_events || []

  const duration = useMemo(() => {
    const fromMedia = mediaDuration
    const fromTranscript = asNumber(transcript?.duration)
    const fromSegments = segments.reduce((max, segment) => Math.max(max, asNumber(segment.end)), 0)
    const fromClaims = claims.reduce((max, claim) => Math.max(max, asNumber(claim.end)), 0)
    return Math.max(fromMedia, fromTranscript, fromSegments, fromClaims, 0)
  }, [claims, mediaDuration, segments, transcript])

  const seek = (seconds: number) => {
    const target = Math.max(0, seconds)
    const node = videoRef.current
    if (!node) return
    try {
      node.currentTime = target
      void node.play()
    } catch {
      /* seeking is best-effort */
    }
    setCurrent(target)
  }

  useEffect(() => {
    setCurrent(0)
    setLeftTab('transcript')
  }, [candidateId])

  const playheadPercent = duration > 0 ? Math.min(100, (current / duration) * 100) : 0

  const transcriptStatus = transcript?.transcript_status || transcript?.transcriptStatus || (segments.length ? 'Extracted' : 'Not extracted')
  const transcriptText = transcript?.transcript || ''
  const noVideo = !videoUrl
  const transcriptionStage = stageStatuses?.video_transcription?.status || 'queued'
  const evaluationStage = stageStatuses?.video_llm_review?.status || 'queued'
  const stageLabel = (value: string) => value === 'in_progress' ? 'In progress' : value === 'complete' ? 'Complete' : value === 'failed' ? 'Failed' : value === 'skipped' ? 'Skipped' : 'Queued'

  return (
    <article className="evidence-card full-evidence vp-panel">
      <div className="vp-grid">
        {/* ---------------- left: player + tabs ---------------- */}
        <section className="vp-stage">
          <header className="vp-stage-head">
            <div>
              <span className="eyebrow">03 · Video evidence</span>
              <h3>{applicantName}</h3>
              <p>{candidateId}{videoFilename ? ` · ${videoFilename}` : ''}</p>
            </div>
            <div className="vp-stage-actions">
              <span className="vp-auto-badge"><span className="material-symbols-outlined">autoplay</span>Automatic pipeline</span>
            </div>
          </header>

          <div className="vp-live-progress" aria-live="polite">
            <div className={`vp-live-step ${transcriptionStage}`}><span className="material-symbols-outlined">graphic_eq</span><div><strong>Transcription</strong><small>{stageLabel(transcriptionStage)}</small></div></div>
            <div className="vp-live-connector" />
            <div className={`vp-live-step ${evaluationStage}`}><span className="material-symbols-outlined">auto_awesome</span><div><strong>LLM evaluation</strong><small>{stageLabel(evaluationStage)}</small></div></div>
            {(transcriptionStage === 'in_progress' || evaluationStage === 'in_progress') && <div className="vp-live-bar"><i /></div>}
          </div>

          <div className={`vp-player ${noVideo ? 'empty' : ''}`}>
            {noVideo ? (
              <div className="vp-player-empty">
                <span className="material-symbols-outlined">videocam_off</span>
                <strong>No video was submitted for this candidate</strong>
                <small>A declared video is required before the review step can produce visual findings.</small>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="vp-video"
                controls
                preload="metadata"
                src={videoUrl}
                onLoadedMetadata={event => setMediaDuration(asNumber(event.currentTarget.duration))}
                onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              >
                <track kind="captions" />
                <span>Video preview unavailable.</span>
              </video>
            )}
          </div>

          <div className="vp-timeline" role="group" aria-label="Speech timeline">
            <div className="vp-timeline-track" onClick={event => {
              const rect = event.currentTarget.getBoundingClientRect()
              if (!rect.width || duration <= 0) return
              seek(((event.clientX - rect.left) / rect.width) * duration)
            }}>
              {duration > 0 && segments.map((segment, index) => {
                const start = asNumber(segment.start)
                const end = Math.max(start + 0.2, asNumber(segment.end, start + 0.2))
                return (
                  <span
                    key={`${start}-${index}`}
                    className="vp-timeline-seg"
                    style={{ left: `${(start / duration) * 100}%`, width: `${((end - start) / duration) * 100}%` }}
                    title={`${clock(start)} · ${segment.text}`}
                  />
                )
              })}
              {duration > 0 && visualEvents.map((event, index) => (
                <span
                  key={`ev-${event.timestamp}-${index}`}
                  className="vp-timeline-mark"
                  style={{ left: `${(asNumber(event.timestamp) / duration) * 100}%` }}
                  title={`Frame ${clock(asNumber(event.timestamp))}: ${event.observation}`}
                />
              ))}
              <span className="vp-playhead" style={{ left: `${playheadPercent}%` }} />
            </div>
            <div className="vp-timeline-foot">
              <span>{clock(current)}</span>
              <span className="vp-timeline-legend">
                <i className="seg" /> speech segment
                <i className="mark" /> sampled frame
              </span>
              <span>{duration > 0 ? clock(duration) : '—'}</span>
            </div>
          </div>

          <div className="vp-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={leftTab === 'transcript'} className={leftTab === 'transcript' ? 'active' : ''} onClick={() => setLeftTab('transcript')}>Transcript</button>
            <button type="button" role="tab" aria-selected={leftTab === 'actions'} className={leftTab === 'actions' ? 'active' : ''} onClick={() => setLeftTab('actions')}>
              Action items{claims.length ? ` · ${claims.length}` : ''}
            </button>
            <button type="button" role="tab" aria-selected={leftTab === 'snippets'} className={leftTab === 'snippets' ? 'active' : ''} onClick={() => setLeftTab('snippets')}>
              Snippets{visualEvents.length ? ` · ${visualEvents.length}` : ''}
            </button>
            <span className="vp-tabs-meta">
              <span className="material-symbols-outlined">closed_caption</span>
              {transcriptStatus}{playing ? ' · playing' : ''}
            </span>
          </div>

          <div className="vp-tab-body">
            {leftTab === 'transcript' && (
              segments.length ? (
                <ol className="vp-transcript">
                  {segments.map((segment, index) => {
                    const start = asNumber(segment.start)
                    return (
                      <li key={`${start}-${index}`}>
                        <button type="button" className="vp-stamp" onClick={() => seek(start)} title="Jump to this moment">
                          {clock(start)}
                        </button>
                        <span className="vp-speaker">Candidate</span>
                        <span className="vp-text">{segment.text}</span>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <div className="vp-transcript-empty">
                  <p className="vp-empty">{transcriptText || (transcriptStatus.toLowerCase().includes('fail') ? 'Timestamped transcript unavailable.' : 'No timestamped transcript is available yet. Run the transcription step to build the timeline.')}</p>
                  {!!transcript?.flags?.length && <ul className="vp-transcript-flags">{transcript.flags.map((flag, index) => <li key={`${flag}-${index}`}><span className="material-symbols-outlined">warning</span>{flag}</li>)}</ul>}
                </div>
              )
            )}

            {leftTab === 'actions' && (
              claims.length ? (
                <ul className="vp-actions">
                  {claims.map((claim, index) => (
                    <li key={index}>
                      <span className="material-symbols-outlined">task_alt</span>
                      <div>
                        <strong>{claim.claim || 'Untitled claim'}</strong>
                        {claim.evidence && <p>“{claim.evidence}”</p>}
                      </div>
                      {claim.start != null && (
                        <button type="button" className="vp-stamp" onClick={() => seek(asNumber(claim.start))}>{clock(asNumber(claim.start))}</button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vp-empty">No action items recorded yet. Run the video evaluation to extract claims with timestamps.</p>
              )
            )}

            {leftTab === 'snippets' && (
              visualEvents.length ? (
                <ul className="vp-snippets">
                  {visualEvents.map((event, index) => (
                    <li key={`${event.timestamp}-${index}`}>
                      <button type="button" className="vp-snippet-thumb" onClick={() => seek(asNumber(event.timestamp))}>
                        <span className="material-symbols-outlined">visibility</span>
                        <b>{clock(asNumber(event.timestamp))}</b>
                      </button>
                      <span>{event.observation}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vp-empty">{review?.frame_notice || 'No sampled frames yet. Frames are captured during the video evaluation.'}</p>
              )
            )}
          </div>
        </section>

        {/* ---------------- right: evaluation ---------------- */}
        <aside className="vp-review">
          <div className="vp-review-head">
            <div>
              <span className="eyebrow">Review</span>
              <h4>Video evaluation</h4>
            </div>
            <span className="vp-model">{review?.model || 'models not run'}</span>
          </div>

          <div className="vp-tabs small" role="tablist">
            <button type="button" role="tab" aria-selected={rightTab === 'evaluation'} className={rightTab === 'evaluation' ? 'active' : ''} onClick={() => setRightTab('evaluation')}>Evaluation</button>
            <button type="button" role="tab" aria-selected={rightTab === 'tldr'} className={rightTab === 'tldr' ? 'active' : ''} onClick={() => setRightTab('tldr')}>TL;DR</button>
          </div>

          {rightTab === 'evaluation' ? (
            <div className="vp-review-body">
              <section className="vp-block">
                <span className="vp-block-title">Summary</span>
                <p className="vp-prose">{review?.summary || 'The automatic audit will show its evidence-grounded review here.'}</p>
              </section>

              <section className="vp-block">
                <span className="vp-block-title"><span className="material-symbols-outlined up">thumb_up</span>Strengths</span>
                {claims.length ? (
                  <ul className="vp-list">
                    {claims.map((claim, index) => (
                      <li key={index}>
                        <span>{claim.claim}</span>
                        {claim.start != null && <button type="button" className="vp-stamp" onClick={() => seek(asNumber(claim.start))}>{clock(asNumber(claim.start))}</button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="vp-empty">None recorded yet.</p>}
              </section>

              <section className="vp-block">
                <span className="vp-block-title"><span className="material-symbols-outlined down">flag</span>Concerns</span>
                {concerns.length ? (
                  <ul className="vp-list">
                    {concerns.map((concern, index) => <li key={index}><span>{concern}</span></li>)}
                  </ul>
                ) : <p className="vp-empty">No concerns raised.</p>}
              </section>

              <section className="vp-block">
                <span className="vp-block-title"><span className="material-symbols-outlined">star</span>Execution</span>
                {visualEvents.length ? (
                  <ul className="vp-list execution">
                    {visualEvents.map((event, index) => (
                      <li key={`${event.timestamp}-${index}`}>
                        <span>{event.observation}</span>
                        <button type="button" className="vp-stamp" onClick={() => seek(asNumber(event.timestamp))}>{clock(asNumber(event.timestamp))}</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="vp-empty">{review?.frame_notice || 'No timestamped observations yet.'}</p>}
              </section>
            </div>
          ) : (
            <div className="vp-review-body">
              <div className="vp-metrics">
                <span><b>{duration > 0 ? clock(duration) : '—'}</b><small>Duration</small></span>
                <span><b>{segments.length}</b><small>Segments</small></span>
                <span><b>{review?.frame_count ?? 0}</b><small>Frames</small></span>
                <span><b>{claims.length}/{concerns.length}</b><small>Strengths / concerns</small></span>
              </div>
              <section className="vp-block">
                <span className="vp-block-title">Digest</span>
                <p className="vp-prose">{review?.summary || transcriptText || 'Nothing to summarise yet — run the transcript and evaluation steps.'}</p>
              </section>
              {(transcript?.flags || []).length > 0 && (
                <section className="vp-block">
                  <span className="vp-block-title">Flags</span>
                  <ul className="vp-list">
                    {(transcript?.flags || []).map((flag, index) => <li key={index}><span>{flag}</span></li>)}
                  </ul>
                </section>
              )}
              <p className="vp-foot">
                Advisory evidence only · the human chair signs the final decision.
                {review?.checked_at ? ` Evaluated ${new Date(review.checked_at).toLocaleString()}.` : ''}
              </p>
            </div>
          )}
        </aside>
      </div>
    </article>
  )
}

