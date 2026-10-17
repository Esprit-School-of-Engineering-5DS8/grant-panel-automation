# Evaluation — Attempt 1

## Overall Verdict: MAJOR REVISION

## Overall Assessment
The student flow has a promising editorial dossier direction: the ink/paper/cobalt palette, six-piece framing, warm card surface, and mobile progress treatment are purposeful and closer to the brief than a generic SaaS form. However, the implementation appears to retain the original global Material-style navigation shell around the new student workspace, creating competing rails and product identities. The core flow also has interaction and content-contract mismatches that keep it from feeling like a polished, trustworthy applicant workspace.

## Scores
| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 1/3 | FAIL | HIGH | The custom dossier styling is coherent in isolation, but it is undermined by the retained global M3 drawer/branding and the additional student rail. The page risks reading as two shells layered together rather than one calm admissions workspace. |
| Originality | 1/3 | FAIL | HIGH | “Your story, in six pieces,” the warm document card, and editorial palette show intent, but the dominant surrounding shell still feels like the earlier generic admin console. The distinctive concept is not given enough visual authority. |
| Craft | 1/3 | PASS | MEDIUM | Spacing, typography hierarchy, focus styles, desktop/mobile breakpoints, and the dossier components are mostly considered. Noticeable issues remain: the student shell uses a second navigation rail, the mobile header hides the save state/profile context, and the upload contract is inconsistent. |
| Functionality | 1/3 | PASS | MEDIUM | Step validation, local step state, clickable unlocked steps, CV parse integration, and webcam handlers exist. The required PDF-only behavior is not enforced, the initial parse depends on the backend with no clear local mock fallback, and camera failure uses a blocking alert rather than an inline error state. |

## What's Working Well
- The “Your story, in six pieces.” framing is a strong response to the brief’s distinctive moment and gives the flow a memorable narrative.
- The palette is well aligned with the requested direction: deep ink, warm paper, cobalt action, mint success, and restrained amber callouts.
- The dossier card, numbered section headings, completion checks, review rows, and sticky bottom navigation establish a credible application-assembly metaphor.
- The mobile breakpoint collapses the rail into a step/progress header and switches the form grid to one column, which is the right responsive strategy.
- The video step explicitly says that the video replaces the motivation letter and includes 90-second guidance, recording controls, and transcript/notes.
- `npm run build` passes successfully.

## Issues Found
### Issue 1: Two competing student shells
- **What**: The student view appears to keep the original global `m3-drawer`/Yale ScholarPath shell while also rendering the new Open Doors-style `student-rail` inside `student-layout`.
- **Where**: Top-level app layout and the student view around `student-shell` / `student-layout`.
- **Why it matters**: A student sees duplicated navigation, branding, and hierarchy. This directly conflicts with the requested persistent Open Doors applicant rail and makes the flow feel like an admin console with a form inserted into it.
- **Suggested fix**: Render the student mode in its own top-level shell with one rail only. Keep the existing drawer and Yale ScholarPath identity exclusively for admin mode; give student mode the Open Doors / Applicant portal identity from the brief.

### Issue 2: Upload behavior contradicts the stated PDF-only contract
- **What**: The visible copy says “PDF only,” but the file input accepts `.pdf,.tex,.txt`, and the handler reads every file as text.
- **Where**: CV deposit upload zone and `handleCvFileUpload`.
- **Why it matters**: Applicants can select a non-PDF file that the UI presents as a parsed PDF, which damages trust in a high-stakes application flow.
- **Suggested fix**: Accept only `application/pdf` / `.pdf`, validate type and size before reading, and show an inline error state. If LaTeX/text is retained for developer fixtures, keep it out of the applicant-facing control.

### Issue 3: CV parsing is not resilient when the API is unavailable
- **What**: The brief permits a lightweight local mock parse, but the initial parse calls the backend and only logs errors; the UI then remains in an empty preview state.
- **Where**: `handleParseCv`, initial `useEffect`, and the CV extracted-profile panel.
- **Why it matters**: The requested “meaningful success state” is absent in the common offline/demo case, making the core CV deposit step look broken.
- **Suggested fix**: Add a deterministic local fallback result when the API fails, preserve the backend call when available, and distinguish “Parsed,” “Parsing,” and “Couldn’t parse—retry” states.

### Issue 4: Error and permission states are not applicant-grade
- **What**: Webcam failure uses `alert(...)`; camera permission denial, unsupported devices, and upload/parse failures do not get an inline recovery path.
- **Where**: `startRecording` and CV parsing/upload flow.
- **Why it matters**: Blocking browser alerts are abrupt and do not explain how an applicant can recover. This is especially risky on mobile and managed browsers.
- **Suggested fix**: Add an inline amber/error panel with clear next actions: retry permission, upload a recording, or continue with a supported alternative if the product allows it.

### Issue 5: Mobile loses useful persistent context
- **What**: At `max-width: 900px`, the save-state is hidden and the profile chip is hidden; the compact progress header only shows step count, title, and a bar.
- **Where**: Responsive rules for `.save-state`, `.profile-chip`, and `.student-mobile-progress`.
- **Why it matters**: Applicants lose reassurance that work is saved and lose identity/context precisely where the layout is most constrained and anxiety is highest.
- **Suggested fix**: Keep a compact saved indicator in the mobile header, and include the applicant initials/name in a small secondary row or menu trigger.

## Priority Fixes for Next Attempt
1. Separate student and admin shells so the student view has one Open Doors rail and no competing M3 drawer/branding.
2. Make the CV workflow truly PDF-only and implement the local mock parse plus explicit loading/success/error states.
3. Replace browser alerts and silent fetch failures with inline, recoverable applicant-facing states; retain save/profile context on mobile.

## Should the next attempt REFINE or PIVOT?
PIVOT the shell architecture, then refine the existing dossier direction. The editorial visual language is worth keeping, but the current composition inherits too much of the admin console to pass as a focused applicant workspace. Once the student mode is isolated and the key failure states are made trustworthy, the palette, content framing, and stepper can be refined rather than redesigned from scratch.
