# Audit evidence and production-readiness iteration

Update the existing Grant Panel React/Vite frontend, FastAPI backend, and n8n workflow.

## Frontend requirements

1. CV PDF parser panel:
   - Show an actual embedded PDF preview for the selected candidate when a PDF URL exists (use `/api/corpus/pdf/...` or a candidate `pdf_url`; fallback to a clear demo CV document state if no candidate file exists).
   - Add a split preview/parser layout: PDF viewer on the left, extracted fields on the right.
   - When “Run parser” is clicked, show visible staged progress: queued → extracting text → matching entities → complete, then show extracted education/GPA/research/leadership and flags.
   - Keep the CV artifact candidate-linked.

2. Video evaluation panel:
   - Add a mock video preview that works locally without requiring a YouTube download or external account. Use a small local/inline demo video or a polished poster/play simulation if there is no video asset.
   - Show duration, play/paused state, transcript extraction progress, extracted claims, confidence, and evaluation status.
   - Buttons: Play preview, Run transcription, Evaluate video. Make the staged state visible.

3. Status and decisions:
   - Add semantic color-coded chips for audit status: Needs review amber, In review blue, Verified mint, Decision needed orange, Submitted navy; recommendation chips for FUND mint, RESERVE amber, REJECT red, Pending neutral.
   - In the Decisions table, make decisions editable per candidate. “Open” should enter the candidate audit decision panel with current decision and allow changing recommendation, score, notes, and sign-off/update.
   - Ensure persisted candidate decisions and statuses are reflected immediately in Overview, Decisions, and Audit.

4. Overview visualization:
   - Replace the current distribution bars with a Sankey/alluvial-style visualization implemented in CSS/SVG/HTML (no new dependency required). It should show flows from audit statuses → recommendations, with labels and counts, and be readable/responsive.

## Backend/API requirements

Add real FastAPI endpoints used by the frontend/n8n, with deterministic demo-safe behavior when no external model is configured:

- `POST /api/admin/extract-video-transcript`
- `POST /api/admin/evaluate-video`
- `POST /api/admin/verify-contract-institution`

Each should return structured JSON with candidate id, status, timestamps, and artifact fields. Keep existing endpoints working. Add small Pydantic request models where useful. Do not claim external verification if no integration exists; label deterministic fallback clearly.

Add a candidate CV PDF preview URL in proposal responses when a PDF is available, and ensure the existing corpus PDF route remains usable.

## n8n requirements

Update `workflows/grant_panel_admin_audit_n8n.json` to call the real backend endpoints above, use environment-driven base URL rather than hardcoded localhost where possible, and preserve the nine-stage sequence. Add clear error handling or continue-on-fail behavior for demo-safe artifacts. Keep valid JSON and no A/B testing branches.

## Quality

- Run frontend build.
- Run backend import/compile or tests.
- Validate n8n JSON.
- Do not download remote video media. A local/inline demo artifact is preferred.
