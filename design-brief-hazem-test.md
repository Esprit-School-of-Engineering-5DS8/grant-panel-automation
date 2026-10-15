# Hazem Mrad local test candidate

Use the user-provided local files as a separate test candidate in the existing Grant Panel app:

- CV: `C:\Users\Hazem\Desktop\Grant Panel\cv-hazem-mrad-toptal.pdf`
- Video: `C:\Users\Hazem\Desktop\Grant Panel\WIN_20261015_13_04_11_Pro.mp4`

## Safety and labeling

This is an explicitly authorized local test record for Hazem Mrad, not a synthetic cohort member and not a production applicant. Label it “Local test candidate · Hazem Mrad” in the UI. Do not duplicate the media into the frontend bundle if avoidable.

## Backend

- Add explicit local test asset routes:
  - `GET /api/test-assets/hazem-mrad/cv.pdf`
  - `GET /api/test-assets/hazem-mrad/video.mp4`
- Resolve files from environment variables with these local workspace paths as development defaults. Return 404 with a clear JSON detail if missing.
- Add a stable candidate record `LOCAL-HAZEM-MRAD` to `/api/proposals` after synthetic candidates, with full profile fields from the supplied CV, education/experience arrays, contact details, CV/PDF URL, video URL, local-test labels, and realistic requested grant/financial placeholders clearly marked as test data.
- Make `/api/proposals/{id}` return it and keep existing PDF route behavior.

## Frontend

- Render this candidate in the audit queue with a local-test badge and prefer its real `pdf_url` and `video_url` in the PDF object/iframe and `<video controls>` player.
- Add “Load Hazem test candidate” or similar clearly labeled control in the Overview / demo operations area; it may simply select/open `LOCAL-HAZEM-MRAD`.
- Preserve the supplied candidate’s fields in the Submitted application inventory. Do not expose the local test record as an actual production submission.

## Validation

- Verify the two asset routes return 200 and correct content types.
- Fetch the candidate from `/api/proposals`.
- Run CV parse, transcript extraction, video evaluation, and contract verification for `LOCAL-HAZEM-MRAD`.
- Run frontend build, backend compile/tests, and workflow JSON validation.
