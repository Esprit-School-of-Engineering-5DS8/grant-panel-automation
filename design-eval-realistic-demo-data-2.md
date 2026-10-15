# Evaluation — Attempt 2

## Overall Verdict: PASS

## Overall Assessment

The realistic demo-data iteration now meets the safety, demo-labeling, artifact-linking, batch-audit, and integration-health requirements. The admin overview clearly identifies synthetic candidates, every seeded candidate is normalized with local PDF/demo-media metadata, the batch action runs the same audit stages sequentially with candidate-level results, and the health card no longer treats a CORS preflight as proof that n8n is online. The remaining implementation is suitable for a realistic local review-room demo.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The demo banner, integration card, batch operation, progress treatment, and existing dossier UI form a clear operational surface without disrupting the committee-console visual system. |
| Originality | 2/3 | PASS | HIGH | The explicit synthetic-data boundary, candidate-linked artifact labels, safe batch audit, and per-stage batch results are thoughtful product-specific choices. |
| Craft | 2/3 | PASS | MEDIUM | Data normalization, truthful health states, structured batch results, and local artifact labeling are cleanly integrated. |
| Functionality | 2/3 | PASS | MEDIUM | Frontend build, backend compile/tests, workflow validation, and seeded end-to-end artifact execution pass. The demo actions are locally safe and preserve decision state. |

## Validation Evidence

- `npm run build` in `frontend`: passed.
- `python -m compileall -q services/api src tests`: passed.
- `python -m pytest -q`: passed, 1 test passed.
- `json.load(workflows/grant_panel_admin_audit_n8n.json)`: passed; nine workflow nodes remain valid.
- Seeded `YALE-01-EXCELLENT` smoke path passed:
  - local PDF route resolved to `PROP-01-EXCELLENT.pdf`;
  - CV parser returned an ATS result;
  - transcript extraction returned `complete`;
  - video evaluation returned `evaluated`;
  - contract verification returned `verified`.
- `/api/integrations/health` returned `n8n: not_configured` in the current environment, which is accurately reflected instead of being reported as reachable.

## Attempt 1 Fixes Confirmed

- Replaced the frontend `OPTIONS`-based n8n check with the backend `/api/integrations/health` probe. The backend distinguishes `reachable`, `unavailable`, and `not_configured`, and uses a bounded request to the configured n8n health URL.
- Added candidate-level batch result state with parser, transcript, evaluation, and verification statuses plus failure reasons. Aggregate progress and pass/fail counts remain visible.
- Added candidate inventory fields for “Demo media source” and “Playback source,” making generated local media explicit when no submitted recording exists.
- Preserved the “Demo / synthetic candidates” overview badge and safe-data explanation.

## What's Working Well

- The proposal normalizer starts from each repository fixture and adds stable fallback data for education, academic experience, leadership experience, financials, synthetic PDF URL, video metadata, and demo-dataset identity.
- The overview makes the safety boundary prominent: synthetic repository fixtures, synthetic PDFs, generated local demo media, no private applicants, and no external video downloads.
- Single-candidate audit controls remain fully testable: Run parser, Run transcription, Evaluate video, and Run verifier update candidate-scoped artifacts.
- The batch action runs the same four local stages sequentially for all loaded candidates, reports progress, avoids mutating production data, and now exposes stage-level results for diagnosis.
- Integration health checks API health, proposal loading, the PDF route, video evaluation, and n8n through real requests. An absent n8n configuration is clearly labeled rather than silently treated as healthy.
- The existing candidate decision state and auth flows remain untouched.

## Issues Found

No release-blocking issues found for this brief.

Non-blocking polish: the n8n health probe uses environment configuration (`N8N_HEALTH_URL` or `N8N_WEBHOOK_URL`), so deployment documentation should continue to make that configuration visible to operators. The current UI correctly reports “Not configured” when it is absent.

## Priority Fixes for Next Attempt

No required fixes. Optional follow-up: add an automated frontend/API contract test asserting that every normalized candidate exposes the demo metadata and all batch stages.

## Should the next attempt REFINE or PIVOT?

REFINE only if desired. The realistic demo-data direction is approved and does not require a design or architecture pivot.

