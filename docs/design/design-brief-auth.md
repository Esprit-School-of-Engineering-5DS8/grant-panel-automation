# Applicant + admin access iteration

Update the existing React/Vite app in `frontend/src`.

## Required product changes

1. Remove the applicant video “Transcript / notes” input completely. The video replaces the motivation letter; applicants should only record/upload the video. Remove its state and stop using it as a required/validation dependency. Keep admin copy focused on the video submission, not a manually entered transcript.

2. Add a polished authentication entry experience for the student portal:
   - Sign in and Sign up views with email, password, full name for sign up, and a “Continue as demo applicant” option.
   - Persist the demo/local session and form progress using localStorage so a refresh does not lose responses.
   - Add a “My application” status/progress view accessible after sign-in: percentage/step progress, current stage, last saved time, submission status, and a “Continue application” action.
   - Keep the existing stepper as the main application workspace.
   - Use the existing applicant visual language: warm paper, ink navy, cobalt, mint success, editorial dossier feeling.

3. Add admin authentication before the admin console:
   - Simple admin sign-in screen with email/password and demo admin action.
   - Keep admin session in localStorage.
   - Add sign out action.

4. Transfer the applicant portal visual system to the admin portal. Refactor the admin shell from the old generic blue header/drawer look into the same Open Doors dossier style: warm surfaces, navy rail, cobalt active controls, compact status chips, editorial section headings, and responsive behavior. Admin information architecture can stay the same (dossiers, compliance, multimodal, deliberation, arbitration, corpus).

## Implementation notes

- Preserve the current API calls and admin functionality where possible.
- Use client-side demo/local auth only; do not invent a backend auth API.
- Do not include any transcript-notes textarea or label anywhere in the student video step.
- Ensure required student step validation only checks the recorded video (or an uploaded video if available), not transcript text.
- Build must pass with `npm run build`.

## Output

Modify the existing app in place, primarily `frontend/src/App.tsx` and `frontend/src/index.css`.
