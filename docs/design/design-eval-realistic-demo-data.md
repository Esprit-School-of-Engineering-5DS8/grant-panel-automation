# Evaluation — Attempt 1

## Overall Verdict: NEEDS REVISION

## Overall Assessment

The realistic demo-data iteration is well structured for safe audit-room testing: the proposal list normalizes the existing synthetic fixtures, adds deterministic PDF links and demo artifact metadata, the overview visibly identifies the dataset as synthetic, and the admin UI provides both single-candidate evidence actions and a sequential batch audit. The seeded end-to-end artifact path is working, but the Integration health card currently overstates n8n availability because it checks an HTTP `OPTIONS` response on the local API trigger route rather than the actual n8n webhook.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The demo badge, safe-review explanation, integration health card, batch operation row, and existing dossier workspace form a coherent admin testing surface. |
| Originality | 2/3 | PASS | HIGH | The explicit synthetic-data boundary, candidate-linked artifact model, and safe batch audit treatment are deliberate product-specific decisions rather than generic dashboard decoration. |
| Craft | 2/3 | PASS | MEDIUM | Normalization fallbacks, explicit artifact labels, progress counters, and responsive existing audit layout are solid. The health-status implementation needs tighter truthfulness and status semantics. |
| Functionality | 1/3 | PASS | MEDIUM | Build/backend/workflow checks pass and one seeded candidate completed the full local artifact path. The n8n health check is not a real reachability test, which can mislead reviewers about integration readiness. |

## Validation Evidence

- `npm run build` in `frontend`: passed.
- `python -m compileall -q services/api src tests`: passed.
- `python -m pytest -q`: passed, 1 test passed.
- `json.load(workflows/grant_panel_admin_audit_n8n.json)`: passed; workflow remains valid with nine nodes.
- Seeded candidate smoke path passed for `YALE-01-EXCELLENT`:
  - local PDF route resolved to `PROP-01-EXCELLENT.pdf`;
  - CV parse returned an ATS-parsed result;
  - transcript extraction returned `complete`;
  - video evaluation returned `evaluated`;
  - contract/institution verification returned `verified`.

## What's Working Well

- `list_proposals()` now normalizes the existing repository fixtures rather than importing external data. It provides realistic fallback education and experience arrays, financials, synthetic PDF URLs, video metadata, and the explicit `demo_dataset: "Demo / synthetic candidates"` marker.
- The Overview contains a visible “Demo / synthetic candidates” badge and copy stating that candidates are repository fixtures, PDFs are synthetic, demo media is generated locally, and no private applicants or external video downloads are used.
- Each candidate can be tested through the existing audit workspace: Run parser, Run transcription, Evaluate video, and Run verifier update candidate-linked artifacts in the UI.
- The batch action runs CV parse, transcript extraction, video evaluation, and verification sequentially for every loaded proposal, reports `completed / total`, passed and failed counts, and explicitly says no external data is mutated.
- The integration health card checks API health, proposal loading, the candidate PDF route, and video evaluation through actual requests. It labels absent/unavailable states instead of assuming every integration is configured.
- The seeded smoke test confirms that the local PDF route and three artifact endpoints work together for a real fixture, not only for an empty demo candidate.
- Existing auth, local decision persistence, candidate selection, and audit artifact state remain in place.

## Issues Found

### Issue 1: n8n “Reachable” health status is a false-positive check

- **What**: `runIntegrationHealth()` sends `OPTIONS` to `/api/n8n/trigger-webhook` and marks n8n “Reachable” when that response is OK. This is the app’s API route and CORS preflight behavior; it does not contact the n8n webhook at port 5678 or confirm an active workflow.
- **Where**: `frontend/src/App.tsx`, `runIntegrationHealth()`.
- **Why it matters**: The card is explicitly presented as Integration health. A committee reviewer can see “Reachable” while n8n is stopped, the workflow is inactive, or the webhook URL is misconfigured. That undermines trust in the safety/operations view.
- **Suggested fix**: Add a backend health probe that performs a bounded request to the configured n8n webhook URL, or expose a dedicated `/api/integrations/health` endpoint that reports `reachable`, `configured`, `inactive`, and `unavailable` separately. If no n8n URL is configured, display “Not configured”; if the request fails, display “Unavailable” with a short reason. Do not use `OPTIONS` as the reachability signal.

### Issue 2: Batch audit does not expose per-candidate artifact results

- **What**: The batch loop updates the shared `auditArtifacts` map with CV/video/verification artifacts, but the batch card only displays aggregate passed/failed counts and overall progress.
- **Where**: `frontend/src/App.tsx`, `runBatchDemoAudit()` and `DemoOperationsCard`.
- **Why it matters**: A failed candidate cannot be diagnosed from the batch surface, and reviewers must manually inspect candidates one by one to discover which stage failed. For a realistic demo-data test action, aggregate counts are useful but insufficient for trust and debugging.
- **Suggested fix**: Add a compact expandable batch-results list keyed by candidate id, with stage-level statuses and a failure reason. Keep the aggregate summary at the top and avoid changing persisted decision state during the batch.

### Issue 3: Synthetic video metadata and actual player source are not visibly connected in the inventory

- **What**: The normalized API record includes `video_metadata` with “Local generated demo video,” while the Submitted application inventory renders only Video URL, status, transcript, and duration. The actual player selects the runtime-generated `adminDemoVideoUrl` separately.
- **Where**: `services/api/main.py`, normalized `video_metadata`; `frontend/src/App.tsx`, `SubmittedApplicationPanel` and admin video panel.
- **Why it matters**: The demo-data safety boundary is clear at the Overview, but candidate-level reviewers may not see that a missing submitted video is being replaced by a generated local artifact rather than a real recording.
- **Suggested fix**: Add a “Demo media source” / “Playback source” field to the candidate inventory and show a small “Demo artifact” label beside the player when the candidate has no `video_url`.

## Priority Fixes for Next Attempt

1. Replace the n8n `OPTIONS` check with a real bounded webhook/integration health probe and distinguish configured, reachable, inactive, and unavailable states.
2. Add per-candidate batch result visibility with stage-level statuses and failure reasons.
3. Surface the candidate-level demo video source label alongside the generated player and metadata.

## Should the next attempt REFINE or PIVOT?

REFINE. The demo-data architecture and audit workflow are sound; the remaining work is operational truthfulness and test-result visibility, not a redesign.

