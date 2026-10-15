# Repeatable education and experience entries

Update the current React/Vite applicant stepper in `frontend/src`.

## Request
On step 02 Education, let the applicant add multiple education entries and remove entries. On step 03 Experience, let the applicant add multiple academic/research and leadership/community experience entries and remove entries. Preserve the current visual design and persistence.

## UX
- Education should render as repeatable dossier cards. Keep the existing current education prefilled as the first entry, and allow “Add education” to append a blank card. Each card needs institution/school, degree or track, field of study, graduation year, and GPA. Include a compact “Remove” action on entries after the first; the first can also be removed if at least one entry remains, but never allow the list to become empty.
- Experience should have two repeatable groups: “Academic / research experience” and “Leadership & community experience”. Each group starts with the current text as its first entry. Each entry is a textarea, with Add experience and Remove actions. Keep the existing project/research title as a separate required field.
- Validation should require at least one education entry with required fields and at least one non-empty entry in each experience group. Update payload generation to include arrays while retaining the existing primary string fields for compatibility.
- Persist arrays via the existing localStorage draft mechanism and restore them on load.
- Use the existing Open Doors applicant styles: dossier cards, warm paper, navy/cobalt/mint, subtle numbered labels. Add CSS only where necessary for repeatable cards, action rows, and remove buttons.
- Make the UI responsive and accessible with labels and button types.

## Deliverable
Modify the existing app in place. Run `npm run build`.
