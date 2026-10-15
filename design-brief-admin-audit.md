# Open Doors admin / chair audit workspace refactor

Refactor the existing React/Vite admin area and n8n workflow in the Grant Panel project.

## User request
Remove the long horizontal candidate pill strip from the admin hero. Remove/retire the A/B testing UI entirely. Reimagine the admin/chair flow around an evidence-based candidate audit workspace. It must connect candidate identity to every evidence source and decision.

## Admin UX direction
Keep the Open Doors applicant dossier styling: warm paper surfaces, ink navy, cobalt actions, mint verified states, amber attention states, editorial section labels, and compact dossier cards. Avoid generic dashboard/table clutter.

Replace the current admin navigation model with a focused review sequence:
1. Queue: a clean candidate queue/table/list with search and filters for status (Needs review, In review, Verified, Decision needed, Submitted), candidate name, track, and updated time. No horizontal pill strip.
2. Candidate audit workspace: a single selected candidate header with name, ID, track, GPA, institution, application status, and action buttons. Below it use evidence cards/tabs for:
   - Profile & education
   - CV PDF parser: file metadata, parsing status, extracted education/experience/entities, discrepancy flags, “Run parser” action.
   - Video evaluation: video preview placeholder/state, duration, recording status, transcript extraction status, extracted claims, confidence, “Run transcription” and “Evaluate video” actions. The transcript is an automated evidence artifact for admins, not an applicant-entered notes field.
   - Contract / institution verification: legal/entity details, institution, contract or funding data, verification status, source/last checked, flags, “Run verifier” action.
3. Decision: an explicit decision panel showing checks passed/attention, recommendation, score, reviewer notes, and chair authorization/sign-off. Decisions should be visible alongside candidate context.

Do not keep the old candidate pill bar, A/B testing tab, or scattered workflows as primary UI. Existing admin tabs can be collapsed/reused behind this new flow if needed, but the new workspace should be the default admin view.

## Data/model requirements
- Preserve current proposal fetching and selection APIs.
- Add local UI state for audit artifacts, deterministic demo results, and per-candidate status so the interface works even if automation endpoints are unavailable.
- Surface existing CV parser and multimodal verification results when present.
- Add candidate-level action functions that call existing endpoints where available and fall back to clear “demo result” states.
- Add a `contract_verification` artifact in the proposal/audit model as a UI-ready shape (institution, contract reference, party, status, checkedAt, flags).
- Transcript extraction should be represented as an automated admin artifact; do not add transcript notes back to the applicant form.

## n8n workflow
Refactor `workflows/grant_panel_simulator_n8n.json` or add a companion workflow JSON so the stages reflect:
Webhook → normalize candidate dossier → parse CV PDF → extract video transcript → evaluate video → verify contract/institution → deterministic checks → aggregate audit → human chair decision.
Use existing API endpoints where possible; new HTTP Request nodes may target clearly named future endpoints on `127.0.0.1:8001`. Keep workflow JSON valid and readable. Remove any A/B testing branch or node if present.

## Files
Implement in `frontend/src/App.tsx`, `frontend/src/index.css`, and the n8n workflow JSON. Run `npm run build` and validate workflow JSON parses.
