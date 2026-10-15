# Realistic candidate demo data and audit testing

Update the existing Grant Panel app to test the admin audit flow with realistic, non-private demo submissions.

## Safety/data boundary
Do not scrape or import private real applicants. Use the existing synthetic proposal fixtures and existing synthetic proposal PDFs as the candidate set. Label the dataset clearly as “Demo / synthetic candidates”. For video, use a public browser-test/sample media source or a generated local sample; do not download YouTube content or personal videos.

## Requirements

1. Seed/normalize the existing 20 synthetic proposal records into a stable admin demo dataset. Every candidate should have:
   - realistic applicant/profile fields
   - education and experience arrays
   - a linked synthetic CV PDF URL from the existing proposal PDF route
   - requested grant/financial fields
   - a video metadata record and a playable demo video source when no real submission exists
   - transcript/evaluation placeholder artifact labeled “Demo artifact” until the workflow runs

2. Add a visible admin demo-data badge and a small “Demo dataset · synthetic candidates” explanation in Overview so reviewers know these are not real personal applications.

3. Make the CV parser and video evaluator testable end-to-end from the admin UI for each seeded candidate. “Run parser”, “Run transcription”, and “Evaluate video” should call the backend endpoints and update the selected candidate artifact state.

4. Add an admin “Run audit on all demo candidates” action or a safe batch test action that runs the same candidate audit stages locally/sequentially (or clearly simulates the batch with structured results). Show progress and final counts without mutating external production data.

5. Add a small “Integration health” card showing API health, proposal data loaded, CV preview route, video evaluation endpoint, and n8n webhook status. Use real `/health` and endpoint checks where possible; label unavailable integrations accurately.

6. Preserve existing applicant/admin auth and candidate decision state.

## Sources
Use the existing repository fixtures under `data/synthetic_proposals` and `data/synthetic_proposals/pdfs`. For a playable sample video source, use a public standards/demo asset only if needed; do not download or scrape YouTube media. The MDN `<video>` examples document public sample media usage: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video.

## Validation

- Run frontend build.
- Run backend tests/compile.
- Validate n8n workflow JSON.
- Exercise at least one seeded candidate through PDF parse, transcript extraction, video evaluation, and contract verification paths.
