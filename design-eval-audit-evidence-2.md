# Evaluation — Attempt 2

## Overall Verdict: PASS

## Overall Assessment

The second attempt successfully addresses the evaluator blockers while preserving the strong committee-dossier direction. The updated audit workspace now connects candidate-scoped evidence states to real backend actions, includes the requested status-to-recommendation alluvial overview, supports editable persisted decisions, and keeps demo fallbacks explicit. The implementation is ready to pass the design/integration gate, with a small amount of non-blocking visual polish recommended for the next iteration.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The navy / warm-paper / mint system, square dossier cards, evidence tabs, queue/detail composition, and now-flow-based overview form a coherent product identity. The direction is professional and clearly suited to committee audit work. |
| Originality | 2/3 | PASS | HIGH | The candidate-linked dossier model, editorial labeling, semantic audit language, and custom SVG flow view show deliberate design decisions beyond a stock dashboard. It is distinctive enough for this product without becoming ornamental. |
| Craft | 2/3 | PASS | MEDIUM | Responsive layouts, candidate-scoped progress maps, API URL normalization, PDF artifact normalization, centralized chip classes, and a responsive SVG visualization are solid improvements. Minor visual polish remains around alluvial node fills and empty-video affordance. |
| Functionality | 2/3 | PASS | MEDIUM | Frontend build, backend compile/tests, and workflow validation pass. Transcription and evaluation now call separate real endpoints, decisions persist immediately, and the nine-stage n8n sequence remains aligned. Demo fallback states are explicit and safe. |

## Verification Evidence

- `npm run build` in `frontend`: passed; TypeScript and Vite production build completed successfully.
- `python -m compileall -q services/api src tests`: passed.
- `python -m pytest -q`: passed, 1 test passed.
- Workflow JSON parsing: passed; the workflow contains exactly nine nodes.
- n8n endpoints remain environment-driven through `GRANT_PANEL_API_BASE_URL` with a demo-safe fallback.
- Frontend API calls now resolve through `VITE_API_BASE_URL` / relative `/api` paths rather than hardcoded application calls to `127.0.0.1`.
- `/api/admin/extract-video-transcript`, `/api/admin/evaluate-video`, and `/api/admin/verify-contract-institution` remain implemented with structured candidate-linked deterministic fallback responses.

## Fixes Confirmed Since Attempt 1

- Replaced overview distribution bars with a responsive SVG alluvial view showing audit statuses flowing to FUND, RESERVE, REJECT, and Pending counts.
- Split video actions into transcription and evaluation handlers; the evaluation action now calls `/api/admin/evaluate-video` and carries the transcript artifact.
- Added shared frontend API URL resolution and applied it to CV parsing, video, verification, and corpus artifact requests.
- Normalized candidate PDF URLs through `artifactUrl(...)` so the iframe works across frontend/backend origins.
- Added candidate-scoped CV/video stages and playback state to prevent cross-candidate state leakage.
- Centralized `statusClass` and `recommendationClass`, and applied them to the decisions table and audit queue.
- Corrected the deterministic verification wording to state that no external institution integration is configured.
- Added a local-safe video element with poster/fallback behavior and visible transcript/evaluation states.

## What's Working Well

- The audit information architecture is strong: queue, selected dossier, evidence tabs, and decision panel keep candidate context visible while moving between artifacts.
- The CV panel now meets the requested evidence pattern: candidate-linked PDF iframe when available, clear fallback state, split preview/parser layout, staged progress, extracted-field summary, and flags.
- The video panel now distinguishes “Run transcription” from “Evaluate video,” renders duration, transcript status, confidence, claims, staged progress, and explicit fallback copy. The poster simulation is local-safe and does not require YouTube or external downloads.
- The alluvial overview is the right analytical replacement for the former bars. It shows both sides of the decision pipeline and derives counts from the same persisted status/decision maps used elsewhere in the console.
- Decisions are editable per candidate, and recommendation, notes, score, sign-off time, and submitted status propagate through local persistence and the Overview / Decisions / Audit views.
- Semantic status chips and recommendation chips now use shared mappings, reducing the chance of contradictory labels and colors.
- The backend and n8n layers are aligned: the three requested admin endpoints exist, deterministic fallbacks are labeled, and the workflow keeps its nine-stage ordering without A/B branches.

## Remaining Issues

### Issue 1: Alluvial SVG nodes need explicit fills

- **What**: `.alluvial-node` sets `stroke: currentColor` but does not set a fill. SVG rectangles therefore rely on the browser default fill, which can render as solid black and reduce the intended semantic color treatment.
- **Where**: `frontend/src/index.css`, `.alluvial-node` and the status/recommendation node rules.
- **Why it matters**: The new visualization is functionally correct, but the node styling should visually match the semantic chip system and remain readable at a glance.
- **Suggested fix**: Set `fill: color-mix(in srgb, currentColor 14%, white)` where supported, or add explicit fill tokens for each status/recommendation class with a contrasting text color. Keep the existing colored stroke for the flow identity.

### Issue 2: Empty candidate video has controls but no playable media source

- **What**: When a candidate has no `video_url`, the audit `<video>` element has a poster and fallback copy but no actual local media source. The UI correctly labels it as a demo element, but the controls cannot play media.
- **Where**: `frontend/src/App.tsx`, the audit video panel.
- **Why it matters**: The brief permits a polished poster/play simulation, so this is not a release blocker. Still, evaluator expectations are clearer if the empty state makes the simulation behavior explicit or includes a tiny checked-in local asset.
- **Suggested fix**: Add a visible “Poster simulation · no source file attached” label, or ship a very small local WebM/MP4 demo asset and use it only when `video_url` is absent.

### Issue 3: Workflow fallback URL is still localhost by design

- **What**: The n8n workflow uses `GRANT_PANEL_API_BASE_URL` correctly but falls back to `http://127.0.0.1:8001`.
- **Where**: `workflows/grant_panel_admin_audit_n8n.json`.
- **Why it matters**: This is appropriate for local demo execution and satisfies the environment-driven requirement. In a shared deployment, the environment variable must be set or the workflow will call its own loopback interface.
- **Suggested fix**: Document the required n8n environment variable in the README or workflow metadata and fail with a clear configuration error when a production profile is detected without it.

## Priority Fixes for Next Attempt

1. Add explicit semantic fills to the alluvial SVG nodes and verify contrast at desktop, tablet, and mobile widths.
2. Make the no-source video state visibly explicit or include a tiny checked-in local demo media asset.
3. Document `GRANT_PANEL_API_BASE_URL` and `VITE_API_BASE_URL` as required deployment configuration while retaining the local demo defaults.

## Should the next attempt REFINE or PIVOT?

REFINE. The blockers are resolved and the design/integration direction is sound. Any next work should be polish and deployment clarity, not a visual or architectural pivot.

