# Evaluation — Attempt 2

## Overall Verdict: NEEDS REVISION

## Overall Assessment

Attempt 2 resolves the main media and Sankey presentation failures from Attempt 1. The admin CV evidence panel now has a real PDF object/iframe path with an Open PDF fallback, the video panel can use a candidate recording or a generated local WebM artifact, the proposal list now carries the submitted profile/education/experience/financial/media fields, and the alluvial legend is a real accessible list with explicit high-contrast node fills. One data-completeness gap remains: the list payload still does not preserve the available video transcript and submitted/updated timestamps, so the “complete” inventory is not yet complete for those fields.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The evidence workspace remains coherent and the corrected filled Sankey cards are readable and aligned with the semantic status system. |
| Originality | 2/3 | PASS | HIGH | The candidate dossier architecture, custom alluvial view, grouped submitted-record inventory, and generated demo media show clear intentional design work. |
| Craft | 2/3 | PASS | MEDIUM | PDF fallback structure, responsive media sizing, explicit SVG fills, contrast tokens, and semantic legend markup are solid. A small data-shape omission remains. |
| Functionality | 1/3 | PASS | MEDIUM | The real PDF viewer path and generated local video path are wired, and validation passes. The submitted inventory still loses transcript/timestamp values in the normal list flow, so audit completeness is not fully trustworthy. |

## Validation Evidence

- `npm run build` in `frontend`: passed.
- `python -m compileall -q services/api src tests`: passed.
- `python -m pytest -q`: passed, 1 test passed.
- `json.load(workflows/grant_panel_admin_audit_n8n.json)`: passed; nine workflow nodes remain present.

## Attempt 1 Fixes Confirmed

- Proposal list shaping now preserves financials, budget, sections, education entries, academic experiences, leadership experiences, contact/profile fields, degree/graduation fields, CV filename, video URL/status/duration, and submitted/updated fields where present.
- The audit player uses a real `<video controls>` element and chooses candidate `video_url`, recorded video, or `adminDemoVideoUrl` generated from a canvas/MediaRecorder local WebM artifact. No external video download is required.
- The alluvial legend is now a real `role="list"` with individual `role="listitem"` entries and color swatches rather than CSS pseudo-element prose.
- Sankey/alluvial node rectangles now have explicit semantic fills and contrasting text colors: amber, blue, mint, orange, navy, red, and neutral as required.
- The CV panel retains a real `<object type="application/pdf">`, iframe fallback, derived local `/api/proposals/{id}/pdf` URL, and visible Open PDF links.

## What's Working Well

- The PDF surface is now an actual preview path rather than a placeholder: it uses the candidate URL when available and derives a deterministic local proposal PDF endpoint otherwise.
- The video surface is now a real player. The generated demo artifact has a visible “Open Doors local demo video” canvas treatment, and the player remains tied to candidate media when a submitted recording exists.
- The Submitted application tab is present in the audit flow and groups the record into the requested sections. The renderer consistently uses “Not provided” for absent values and preserves arrays as readable field summaries.
- The Sankey legend and node fills are now accessible and visually legible in the source implementation. Text labels use `currentColor` against explicit fills with dark text for light nodes and white text for Submitted.
- Backend submission storage already includes the broader applicant data model, and the proposal-list response now exposes most of that data to the admin console.

## Remaining Issue

### Issue 1: Video transcript and submission timestamps are still omitted from the normal admin list payload

- **What**: `SubmittedApplicationPanel` renders `Video transcript`, `Submitted at`, and `Updated at`, but `list_proposals()` does not include `video_transcript`, and submitted applications are not assigned a top-level `submitted_at`/`created_at`/`updated_at` value in `application_dict`. As a result, the inventory shows “Not provided” even when the submitted record contains a transcript or when the submission event is known.
- **Where**: `services/api/main.py`, `list_proposals()` and `submit_student_application()`; `frontend/src/App.tsx`, `SubmittedApplicationPanel`.
- **Why it matters**: The brief requires every available submitted/input value, including video metadata and submission timestamps. This is a data-integrity issue in an audit console, not just a cosmetic omission.
- **Suggested fix**: Add `video_transcript`, `submitted_at`, and `updated_at` to the list response. Set a canonical UTC `submitted_at` at application creation and return it in the saved JSON; use that same value in the admin inventory. If the transcript is generated later, persist the transcript artifact or clearly label it as “Not yet extracted” rather than treating it as absent.

## Priority Fix for Next Attempt

1. Complete the proposal response contract with `video_transcript` and canonical submission/update timestamps, then verify those values appear in the Submitted application panel for a normal candidate loaded through `/api/proposals`.

## Should the next attempt REFINE or PIVOT?

REFINE. The media architecture and visual direction now satisfy the core brief. Only the remaining audit data contract needs completion; no design pivot is warranted.

