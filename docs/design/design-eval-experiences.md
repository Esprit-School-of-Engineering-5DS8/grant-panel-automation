# Evaluation — Attempt 3

## Overall Verdict: NEEDS REVISION

## Overall Assessment
The updated applicant flow has a clear Open Doors visual direction: warm paper, navy/cobalt, mint status accents, dossier-card containers, and restrained numbered labels. The repeatable education and experience structures are implemented coherently and the production build succeeds, but the implementation is not yet a professional-quality accessible form: the new required fields are visually marked rather than semantically required, whitespace-only values pass custom validation, and the compatibility contract is only partially preserved in the submission payload.

The local browser automation surface was unavailable for this evaluation (`ERR_CONNECTION_TIMED_OUT`/IAB access restriction), so viewport screenshots and live click-through could not be captured. Findings below are based on the rendered React/CSS implementation and build verification.

## Scores
| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The repeatable cards fit the established dossier language and use consistent paper/navy/cobalt/mint styling. The new sections are visually coherent, though the dense experience page would benefit from stronger grouping and action-row hierarchy. |
| Originality | 2/3 | PASS | HIGH | The Open Doors identity is deliberate rather than generic: editorial serif headings, numbered step labels, warm paper, and compact dossier controls carry through the experience UI. |
| Craft | 1/3 | PASS | MEDIUM | Spacing and responsive rules are mostly sound, and the 900px/600px breakpoints address the card layout. However, the new required controls omit native `required` attributes, the form does not trim/normalize validation values, and the implementation is compressed into very long JSX lines that make maintenance and QA harder. |
| Functionality | 1/3 | PASS | MEDIUM | Add/remove behavior, array persistence, and array submission fields are present. The flow still has validation and compatibility edge cases, so it is functional but not release-ready. |

## What's Working Well

- Education starts with the requested prefilled Yale entry and appends a blank entry through `Add education`.
- Education and both experience groups prevent the list from becoming empty because the remove control is only rendered when a group has more than one item.
- Experience is correctly split into two repeatable groups, each with a textarea, add action, and remove action; the project/research title remains a separate field.
- The draft effect persists `educationEntries`, `academicExperiences`, and `leadershipExperiences` in `openDoorsApplicationDraft`, and the load effect restores those arrays.
- The submission payload includes `education_entries`, `academic_experiences`, and `leadership_experiences` while retaining the first experience values in the existing `sections.abstract` and `sections.impact_and_dissemination` strings.
- All new add/remove controls use `type="button"`, and the inputs are wrapped by visible labels, which is a solid baseline for keyboard and assistive-technology use.
- `npm run build` passes: TypeScript compilation and Vite production bundling both completed successfully.

## Issues Found

### Issue 1: New required fields are not semantically required
- **What**: The education inputs, project title, and repeatable experience textareas display an asterisk and are checked by `validateStudentStep`, but the new controls do not carry `required` attributes. The legacy hidden/other form fields do, which makes this inconsistency easy to miss.
- **Where**: `frontend/src/App.tsx`, the `studentStep === 1` and `studentStep === 2` render branches.
- **Why it matters**: Native browser validation, screen-reader announcements, and automated form tooling cannot identify these fields as required. This directly misses the brief's accessibility requirement and makes the visual `*` misleading.
- **Suggested fix**: Add `required` to every required education input, the project title input, and every experience textarea. Add stable `id`/`htmlFor` pairs or generated field IDs as the lists grow.

### Issue 2: Whitespace-only entries pass validation
- **What**: `some(Boolean)` and field checks such as `entry.institution && ...` treat strings containing only spaces as valid.
- **Where**: `validateStudentStep` for education and experience in `frontend/src/App.tsx`.
- **Why it matters**: The brief requires at least one non-empty experience and one education entry with required fields. A user can enter spaces and advance, producing an invalid dossier and invalid compatibility strings.
- **Suggested fix**: Normalize with `trim()` during validation, e.g. require `entry.institution.trim()`, and use a shared helper for experience text. Consider trimming values before submission while preserving user-visible text until blur.

### Issue 3: Compatibility fields are only retained indirectly
- **What**: The payload sends the new arrays and uses their first items inside `sections.abstract` and `sections.impact_and_dissemination`, but it does not explicitly send the existing primary string fields `purpose_statement` and `leadership_statement` even though those state values and draft keys still exist.
- **Where**: `handleStudentSubmit` payload in `frontend/src/App.tsx`.
- **Why it matters**: Consumers expecting the prior top-level string fields may break, and the compatibility promise is ambiguous when a first array item is removed or reordered.
- **Suggested fix**: Explicitly include `purpose_statement: academicExperiences[0] || purposeStatement` and `leadership_statement: leadershipExperiences[0] || leadershipStatement` in the payload, alongside the arrays. Keep the existing `sections` mappings as needed for downstream compatibility.

### Issue 4: Restored draft data is trusted without shape protection
- **What**: The load effect assigns any truthy `draft.educationEntries`, `draft.academicExperiences`, and `draft.leadershipExperiences` directly into state. An empty or malformed stored value can leave education empty or cause render-time errors.
- **Where**: Draft restoration effect in `frontend/src/App.tsx`.
- **Why it matters**: Local storage is user-editable and can be stale from an earlier schema. The brief explicitly requires the list never become empty; restore should enforce that invariant too.
- **Suggested fix**: Validate array shapes before restoring, provide typed fallback entries, and ensure education restores to at least one valid object. Use a small `loadDraft`/normalizer helper rather than several unguarded assignments.

### Issue 5: Long repeatable groups need clearer action hierarchy at scale
- **What**: The new cards are visually consistent, but each repeated experience item repeats the same full field label and the only distinction is a small `Entry 01` eyebrow. With several entries, the page becomes tall and the add action is visually separated from the group heading by all cards.
- **Where**: `.experience-group`, `.repeatable-card`, and `.add-button` in `frontend/src/index.css` and the step 03 JSX.
- **Why it matters**: Users can lose orientation in a long dossier and may not understand whether “Remove” acts on the entry or the whole group.
- **Suggested fix**: Add a compact entry heading such as “Research experience 01”, keep the remove action aligned in an explicit action row, and consider a sticky/anchored group add action or stronger group footer treatment after 3+ cards.

## Priority Fixes for Next Attempt

1. Add semantic required attributes plus stable IDs/`htmlFor` relationships to every new required control.
2. Make validation trim-aware and normalize restored draft arrays so malformed/empty local storage cannot violate the non-empty-list invariant.
3. Add explicit `purpose_statement` and `leadership_statement` compatibility fields to the submission payload.
4. Re-test add, remove-first, remove-last-remaining, blank-entry validation, reload persistence, and mobile widths at 1440px, 768px, and 375px.
5. Improve repeated-entry headings/action rows after functional fixes are complete.

## Should the next attempt REFINE or PIVOT?

REFINE. The visual direction and repeatable-card interaction model are appropriate for the brief; the next attempt should tighten semantic form behavior, data normalization, and repeated-entry orientation rather than replace the design.

## Verification

- `npm run build` — PASS
- Browser screenshots/click-through — NOT AVAILABLE in this environment because the local Vite page could not be opened by the available browser surface.
