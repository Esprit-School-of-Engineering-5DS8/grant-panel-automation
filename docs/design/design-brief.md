# Student application stepper redesign

## Objective
Redesign the existing React/Vite student portal in `frontend/src/App.tsx` into a polished, focused multi-step application flow. Keep the existing admin console available, but make the student mode feel like a real applicant workspace.

## Audience
International students completing a scholarship/grant application. They need confidence, clear progress, and low-friction uploads.

## Product direction
Use an editorial admissions-workspace aesthetic: deep ink navy, warm paper surfaces, electric cobalt actions, mint success states, and restrained amber notes. It should feel premium and calm rather than generic SaaS. Use the existing Material Symbols where available. Typography should be clean sans for UI with a strong display face for page titles.

## Student flow
1. General information: name, email, citizenship, phone, date of birth, sex.
2. Education: institution, degree/track, field of study, graduation year, GPA.
3. Experience: project title, academic/research experience, leadership/community experience.
4. CV deposit: drag/drop PDF upload, filename/size, parse status, extracted profile preview, detected fields, edit/replace affordances. The frontend may use a lightweight local mock parse if API is unavailable, but preserve the existing `/api/student/parse-cv` integration when possible.
5. Review: concise read-only summary with completion checklist and validation warning if required data is missing.
6. Video motivation: video replaces the motivation letter. Include a strong explanatory callout, duration guidance (90 seconds), recording/upload area, preview state, transcript/notes preview, and a clear “video replaces motivation letter” label. Preserve existing webcam recording behavior where possible.

## Key UI
- Persistent left rail on desktop with logo “Open Doors / Applicant portal”, application status, and vertical step list.
- Main canvas with small “Application 2026” eyebrow, warm white background, large title, a compact save-state indicator (“Saved just now”), and a step content card.
- Top-right profile chip and deadline card.
- Bottom sticky navigation with Back and Continue buttons.
- Mobile layout collapses rail into a top progress header.
- Make step navigation clickable only for completed/current steps.
- Use meaningful empty/error/success states; avoid lorem ipsum.

## Interaction requirements
- Step state is local React state.
- Continue validates required fields for the current step, advances, and updates completion.
- CV upload accepts PDF and displays parsing UI; a mock parsed result is acceptable when backend is unavailable.
- Video tab/step must clearly say it replaces the motivation letter. No motivation letter textarea.
- Keep admin mode and existing data fetch behavior functioning as much as practical.

## Files/output
Implement in the existing app, chiefly `frontend/src/App.tsx`, `frontend/src/index.css`, and/or `frontend/src/App.css`. Do not create a standalone HTML app. Ensure `npm run build` passes.

## Distinctive moment
The stepper should feel like an application dossier being assembled: a slim progress rail, a warm document-like card, and an encouraging “Your story, in six pieces” summary at the top.
