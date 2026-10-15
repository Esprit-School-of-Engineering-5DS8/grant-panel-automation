# Admin evidence media and candidate record correction

Update the existing React/Vite + FastAPI app in place.

## User-visible fixes

1. CV PDF preview must be a real preview in the admin panel, not a placeholder box:
   - In the selected candidate’s “CV PDF parser” evidence panel, render an actual `<iframe>` or `<object>` PDF viewer using a candidate PDF URL.
   - Use the existing candidate `pdf_url` when available, otherwise derive a real local demo PDF URL from an existing synthetic proposal PDF endpoint. Add a visible “Open PDF” link as a fallback.
   - Keep parser progress and extracted fields beside/below the actual preview.

2. Video evaluation must contain a real video player:
   - Render an actual `<video controls>` element with a usable local/demo source. Do not show a static play-state mock as the primary experience.
   - Support candidate `video_url` when present, otherwise use a clearly labeled local demo video source or a browser-compatible generated demo asset. Show poster/empty state only if the source truly cannot load.
   - Keep Run transcription and Evaluate video actions tied to the player/candidate.

3. Candidate context must list all submitted/input fields in the admin panel:
   - Add a “Submitted application” evidence panel or section with a complete field inventory grouped as General information, Education, Experience, CV deposit, Financial/request details, and Video submission.
   - Display every available value for the selected candidate, including applicant name, email/contact if present, citizenship, date of birth, sex, institution, degree/track, major, graduation year, GPA, all education entries, project title, all academic/research experiences, all leadership/community experiences, CV filename/PDF, requested grant, financial fields, video URL/status, and submission timestamps/status. Use “Not provided” when absent; do not silently omit fields.
   - Add the new panel to the audit tabs and include it in the candidate audit flow.

4. Fix the Sankey/alluvial overview shown in the screenshot:
   - The node rectangles currently render black with nearly invisible text. Replace them with readable filled cards using semantic colors and high-contrast text: amber Needs review, blue In review, mint Verified, orange Decision needed, navy Submitted; recommendation nodes mint FUND, amber RESERVE, red REJECT, neutral Pending.
   - Ensure SVG labels remain visible and counts are readable in the actual rendered dashboard, not just through CSS assumptions. Add an accessible legend.

## API/data

- Ensure proposal payloads preserve all submitted fields from the applicant workflow, including arrays for education and experience, contact/profile fields, financials, video metadata, and CV/PDF URL.
- Add or extend API response shaping only where needed; preserve existing endpoints.

## Validation

- Run `npm run build`.
- Run backend compile/tests.
- Keep n8n workflow valid.
