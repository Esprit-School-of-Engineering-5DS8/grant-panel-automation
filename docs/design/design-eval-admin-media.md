# Evaluation — Attempt 1

## Overall Verdict: NEEDS REVISION

## Overall Assessment

The updated admin console makes meaningful progress on the media brief: the CV panel now has a real candidate PDF object/iframe path with an explicit Open PDF fallback, the Sankey nodes have semantic fills and a visible legend, and a Submitted application tab has been added. The implementation is not ready to pass because the normal proposal-list data path still strips most submitted fields before the inventory renders, and candidates without `video_url` still receive a `<video>` element with no playable local/demo source.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The navy, warm-paper, mint, amber, and blue system remains coherent, and the filled Sankey nodes are materially more readable than the previous black-node version. The media panels fit the dossier-console visual language. |
| Originality | 2/3 | PASS | HIGH | Candidate-linked audit tabs, a custom alluvial overview, explicit evidence artifacts, and a grouped submitted-field inventory show clear product-specific design intent. |
| Craft | 1/3 | PASS | MEDIUM | The actual PDF object/iframe fallback, responsive media sizing, semantic SVG fills, and legend are solid. The video source fallback and data-shape mismatch are noticeable implementation gaps that prevent a more polished score. |
| Functionality | 1/3 | PASS | MEDIUM | The build and backend/workflow checks pass, and the controls are wired. However, the default video path cannot play a demo artifact and the submitted-field panel is not complete for candidates returned by `/api/proposals`. |

## Validation Evidence

- `npm run build` in `frontend`: passed; TypeScript and Vite production build completed successfully.
- `python -m compileall -q services/api src tests`: passed.
- `python -m pytest -q`: passed, 1 test passed.
- `json.load(workflows/grant_panel_admin_audit_n8n.json)`: passed; workflow remains valid with nine nodes.
- Backend contains a local inline PDF route at `GET /api/proposals/{proposal_id}/pdf`, served with `application/pdf` and inline content disposition.
- Backend submission model and save path include education entries, academic/leadership experiences, contact/profile fields, financials, video metadata, and CV metadata.

## What's Working Well

- The CV preview now uses `object` with `type="application/pdf"`, an iframe fallback, and a visible Open PDF link. It derives `/api/proposals/{candidate_id}/pdf` when a candidate does not provide `pdf_url`, which is the correct demo-safe direction.
- Parser progress and extracted fields remain adjacent to the actual preview rather than replacing it with a placeholder card.
- The video panel uses a real `<video controls preload="metadata">` element and remains tied to candidate `video_url` when present. Transcription and evaluation actions remain separate and candidate-linked.
- The alluvial node classes now define explicit fills and contrasting text colors for all requested status and recommendation categories. The CSS legend text is visible above the SVG, and the SVG carries an accessible `aria-label`.
- The audit tabs include Submitted application, and the inventory is grouped into General information, Education, Experience, CV deposit, Financial / request details, and Video submission. Missing values are rendered as “Not provided.”
- The backend’s `StudentApplicationPayload` and submission persistence include the requested arrays and profile fields, so the storage model is capable of preserving the data.

## Issues Found

### Issue 1: `/api/proposals` strips the fields required by the submitted-field inventory

- **What**: `list_proposals()` returns only id, filename, title, applicant, major, school, GPA, requested grant, page count, `pdf_url`, and `ground_truth`. It does not return email, phone, citizenship, birth date, sex, degree track, graduation year, education entries, academic experiences, leadership experiences, CV filename/content, financials, video URL/status/transcript/duration, or submission timestamps.
- **Where**: `services/api/main.py`, `list_proposals()` response shaping around the proposal summary object.
- **Why it matters**: The new Submitted application panel is structurally complete but is fed by the reduced list payload used by the admin queue. For normal candidates it will display “Not provided” for values that were actually submitted, violating the explicit complete field-inventory requirement and making the audit record misleading.
- **Suggested fix**: Either return the complete candidate record from `/api/proposals` or fetch `/api/proposals/{candidate_id}` when a candidate is selected and merge that detail into `selectedProposal`. The safest approach is to preserve all submitted fields in the list response while retaining summary fields for compatibility.

### Issue 2: Default admin video player has no usable local/demo source

- **What**: The audit panel renders a real `<video>` element, but its `src` is `auditCandidate.video_url || undefined`. The poster is only a static fallback; for synthetic candidates without a video URL, the controls cannot play a local/demo artifact.
- **Where**: `frontend/src/App.tsx`, the admin Video evaluation panel.
- **Why it matters**: The brief specifically requires a usable local/demo video source when `video_url` is absent and permits a poster/empty state only when the source truly cannot load. The current default path presents “Demo video element ready” while providing no playable media, so the primary media experience is still incomplete.
- **Suggested fix**: Add a small checked-in browser-compatible WebM/MP4 under `frontend/public` and use it as `src` when `video_url` is absent, or generate a deterministic inline media asset. Keep the poster and fallback copy only for load errors, and label the source as “Local demo video.”

### Issue 3: The Sankey legend is accessible text but not a true keyed legend

- **What**: The legend is implemented through `.alluvial-wrap::before` content containing a pipe-delimited sentence rather than actual legend items tied to swatches/classes.
- **Where**: `frontend/src/index.css`, `.alluvial-wrap::before`.
- **Why it matters**: The colors are now readable, but pseudo-element text is not semantically discoverable as a legend and cannot be individually focused or announced as separate keys. It is also harder to scan at tablet/mobile widths.
- **Suggested fix**: Add a real `<div role="list" aria-label="Alluvial legend">` with one item per status/recommendation, each containing a colored swatch and label. Keep the SVG `aria-label` and add a concise text summary of the flow counts if needed.

### Issue 4: PDF fallback nesting is more complex than necessary

- **What**: The `object` contains an iframe and fallback markup, then a separate Open PDF link is rendered outside the object as well.
- **Where**: `frontend/src/App.tsx`, CV parser panel.
- **Why it matters**: The fallback is useful, but nested fallback markup can behave inconsistently across PDF viewer implementations and may lead to duplicated fallback/link content in browsers that partially support `object`.
- **Suggested fix**: Keep the object as the primary viewer, use a simple fallback anchor inside it, and retain one external Open PDF link outside for guaranteed access. Add an iframe/object error or loading state if the browser exposes one.

## Priority Fixes for Next Attempt

1. Preserve and expose the complete submitted candidate record through the admin data path, preferably by enriching `/api/proposals` or loading the full detail record on candidate selection.
2. Ship and wire a real local/demo WebM or MP4 source for candidates without `video_url`; do not rely on the poster as the playable path.
3. Replace the pseudo-element Sankey legend with semantic keyed legend items and verify contrast at 1440px, 768px, and 375px.
4. Simplify the PDF object fallback structure and add a clear preview-load failure state.

## Should the next attempt REFINE or PIVOT?

REFINE. The visual direction and component structure are correct, and the major media architecture is in place. The next attempt should complete the data contract and default video artifact rather than change the design language.

