# Evaluation — Attempt 1

## Overall Verdict: NEEDS REVISION

## Overall Assessment

The updated Grant Panel has a credible committee-console direction: the navy / paper / mint palette, squared dossier cards, compact audit metadata, candidate queue, and evidence tabs create a coherent review-room product rather than a generic dashboard. The CV parser and decision workflows are visibly staged and candidate-linked, and the backend/n8n foundation is substantially present. It is not ready to approve because a required Sankey/alluvial overview was not implemented, the video evaluation action never calls the evaluation endpoint, the “local video” is only a play-state presentation card, and several integration details make the demo misleading or fragile.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | Clear editorial admin-console identity with strong navy, warm-paper, mint, cobalt, and amber system. The audit workspace has a sensible hierarchy, but the overview still uses generic distribution bars and does not deliver the requested flow visualization. |
| Originality | 2/3 | PASS | HIGH | Deliberate dossier language, square geometry, queue/detail composition, semantic chips, and candidate-linked evidence give the product a custom feel. The overview and video artifact remain fairly standard placeholder patterns. |
| Craft | 1/3 | PASS | MEDIUM | Responsive CSS exists for the audit workspace, parser split, metrics, and decision panel, and the build is clean. Noticeable issues remain: status styling is hardcoded incorrectly in the decisions table, the CV iframe URL is relative to the frontend origin, and several “complete” states are presentation-only rather than backed by the corresponding artifact call. |
| Functionality | 1/3 | PASS | MEDIUM | Build, Python compile, pytest, and workflow JSON validation pass. Core click paths exist, but video evaluation is not actually invoked, the local video is not a playable local/inline artifact, and parser/video progress is mostly simulated. |

## Verification Evidence

- `npm run build` in `frontend`: passed; Vite production bundle generated successfully.
- `python -m compileall -q services/api src tests`: passed.
- `python -m pytest -q`: passed, 1 test passed.
- `json.load(workflows/grant_panel_admin_audit_n8n.json)`: passed.
- n8n workflow contains nine nodes and preserves the requested sequence from webhook/normalization through CV, transcript, video evaluation, verification, deterministic checks, aggregation, and chair decision.
- Backend contains `POST /api/admin/extract-video-transcript`, `POST /api/admin/evaluate-video`, and `POST /api/admin/verify-contract-institution`; responses include candidate id, status, timestamp-like `checked_at`, source, and artifact fields.

## What's Working Well

- The audit workspace is structurally strong: a candidate queue sits beside a selected-dossier detail area, with tabs for Profile, CV PDF parser, Video evaluation, Verification, and Decision. This is an appropriate information architecture for committee review.
- The CV panel has the requested split layout and an actual iframe branch when `pdf_url` exists, plus a clear no-file demo state. The visible parser sequence is `queued → extracting text → matching entities → complete`, and the artifact is keyed to the candidate id.
- The decision panel supports editable recommendation, reviewer notes, score display, sign-off/update, and immediate local persistence. The decisions table’s “Open” action routes into the candidate-linked decision panel.
- Semantic status and recommendation classes are present for Needs review, In review, Verified, Decision needed, Submitted and FUND, RESERVE, REJECT, Pending. The visual language is consistent with the rest of the console.
- The backend fallback is explicitly deterministic in the video and verification responses rather than pretending that an external model or institutional integration ran. The workflow uses `GRANT_PANEL_API_BASE_URL` with a demo-safe localhost fallback and keeps error-tolerant orchestration in scope.
- Responsive rules cover the main audit workspace, evidence grids, decision summary, metrics, and queue. The implementation is compact and the production build is free of TypeScript errors.

## Issues Found

### Issue 1: Required Sankey/alluvial overview is missing

- **What**: The overview still renders `.distribution-row` horizontal bars for status counts. There is no SVG, CSS flow, or alluvial relationship from audit statuses to recommendations.
- **Where**: `frontend/src/App.tsx`, the `adminTab === 'overview'` block; `frontend/src/index.css`, `.distribution-row` styles.
- **Why it matters**: This is an explicit brief requirement and a key analytical view. Bars show workload but cannot answer how statuses translate into FUND, RESERVE, REJECT, or Pending decisions.
- **Suggested fix**: Replace the status-bar section with a responsive SVG or HTML/SVG hybrid: left nodes for the five statuses, right nodes for recommendations, labeled counts, and proportional paths. Use the persisted `candidateAuditStatus` and `candidateDecisions` maps so the flow updates immediately after sign-off.

### Issue 2: “Evaluate video” never calls the evaluation endpoint

- **What**: `runAuditVideo` calls `/api/admin/extract-video-transcript` only. Both “Run transcription” and “Evaluate video” invoke the same handler, and the returned evaluation artifact is locally synthesized instead of using `/api/admin/evaluate-video`.
- **Where**: `frontend/src/App.tsx`, `runAuditVideo` and the Video evaluation panel.
- **Why it matters**: The backend endpoint and n8n node exist, but the primary frontend action does not exercise them. This creates a false sense of completed evaluation and prevents backend/frontend integration verification.
- **Suggested fix**: Split into `runVideoTranscription` and `runVideoEvaluation`, preserve staged progress, pass the transcript response into the evaluation request, and render the returned `evaluation_status`, claims, confidence, and flags. Disable evaluation until transcript extraction is available or provide a clear fallback state.

### Issue 3: Local video preview is a poster simulation, not a local/inline video artifact

- **What**: The UI toggles `videoPlaying` and changes text/icon, but there is no `<video>` element, local source, inline data asset, or poster with a real playback path.
- **Where**: `frontend/src/App.tsx`, `.video-audit-preview` markup; `frontend/src/index.css`, `.video-audit-preview` styles.
- **Why it matters**: The brief explicitly asks for a mock video preview that works locally. A play/pause state simulation is acceptable only if it is clearly a polished simulation; here the control says “Playing” without actual media playback, which is misleading for an evaluator testing the workflow.
- **Suggested fix**: Add a small checked-in local MP4/WebM or an inline generated demo asset and use `<video controls preload="metadata">`; retain the styled fallback poster only when the asset is unavailable and label it “Demo playback simulation.”

### Issue 4: Frontend API URLs are hardcoded and inconsistent with deployment configuration

- **What**: Admin video, verifier, CV parsing, and other calls use `http://127.0.0.1:8001` directly. The Vite proxy is configured for development, but production or a non-local backend cannot be selected through an environment variable.
- **Where**: `frontend/src/App.tsx` fetch calls; `frontend/vite.config.ts`.
- **Why it matters**: The n8n workflow correctly uses `GRANT_PANEL_API_BASE_URL`, but the browser integration is not environment-driven. This will break outside the local machine and makes backend alignment less reliable.
- **Suggested fix**: Define one `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''` and route all browser calls through it. Use relative `/api` in development with the Vite proxy and set `VITE_API_BASE_URL` for deployed environments.

### Issue 5: PDF preview URL is not robust across frontend/backend origins

- **What**: Candidate `pdf_url` values are returned as `/api/corpus/pdf/...`, then passed directly to an iframe hosted by the frontend origin. The corpus viewer elsewhere manually prefixes `http://127.0.0.1:8001`, but the CV iframe does not.
- **Where**: `frontend/src/App.tsx`, `.cv-pdf-preview` iframe branch; backend proposal response mapping in `services/api/main.py`.
- **Why it matters**: With the current Vite proxy it may work in dev, but direct production hosting or a different API origin can show a blank PDF. The requirement is an actual candidate-linked preview, not an origin-dependent best effort.
- **Suggested fix**: Normalize artifact URLs through the shared API base helper, or have the backend return an absolute/configured public URL. Add a visible loading/error fallback around the iframe.

### Issue 6: Decisions table always uses the Verified status class

- **What**: The table renders `<span className="audit-status status-verified">{statusForCandidate(p)}</span>` regardless of the candidate’s actual status.
- **Where**: `frontend/src/App.tsx`, decisions table.
- **Why it matters**: The label may say Needs review or Decision needed while the chip is styled mint/Verified, weakening trust in the audit register and directly undermining the semantic chip requirement.
- **Suggested fix**: Reuse a single `statusClass(statusForCandidate(p))` helper for queue, header, overview, and decisions table. Apply recommendation chip classes in the table as well instead of plain text.

### Issue 7: Backend verification label contradicts the successful deterministic fallback

- **What**: `/api/admin/verify-contract-institution` returns `status: "verified"` but `verification_label: "Endpoint unavailable — deterministic demo result"` even though the endpoint itself handled the request.
- **Where**: `services/api/main.py`, `verify_contract_institution`.
- **Why it matters**: The response correctly avoids claiming an external integration, but the wording implies this endpoint was unavailable and conflicts with the successful structured response. The frontend will display that contradictory label as the source/last-checked value.
- **Suggested fix**: Return an explicit label such as `Deterministic demo fallback; no external institution integration configured` and keep the status as `demo_verified` or `verified_with_fallback` if the UI needs to distinguish external verification.

### Issue 8: Progress states are globally shared rather than candidate-scoped

- **What**: `cvParserStage`, `videoStage`, and `videoPlaying` are single component states, while artifacts are candidate-keyed.
- **Where**: `frontend/src/App.tsx`, top-level audit state.
- **Why it matters**: Switching candidates mid-run can show the previous candidate’s parser/video progress in the newly selected dossier. That is a subtle but high-risk audit-context error.
- **Suggested fix**: Store stage and playback state by candidate id, or reset them in `handleSelectProposal` and explicitly cancel/ignore stale async completions when the selected candidate changes.

## Priority Fixes for Next Attempt

1. Implement the required responsive status-to-recommendation Sankey/alluvial visualization and bind it to persisted candidate state.
2. Separate transcript extraction from video evaluation and call the real `/api/admin/evaluate-video` endpoint from the “Evaluate video” action.
3. Replace hardcoded frontend backend URLs with `VITE_API_BASE_URL`/relative API resolution, then normalize the CV PDF iframe URL through the same helper.
4. Add a real local/inline video artifact or clearly label the poster simulation, and make the playback state truthful.
5. Centralize semantic status/recommendation chip class mapping and fix the decisions table’s hardcoded `status-verified` class.
6. Correct the deterministic verification label and scope parser/video progress to the selected candidate.

## Should the next attempt REFINE or PIVOT?

REFINE. The core direction is sound: the committee-dossier visual language, audit queue/detail architecture, and decision workflow are the right foundation. The next attempt should focus on completing the explicit analytical and integration requirements and making the artifact states truthful, not replacing the visual system.

