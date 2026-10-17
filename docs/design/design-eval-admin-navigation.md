# Evaluation — Attempt 2

## Overall Verdict: NEEDS REVISION

## Overall Assessment
The updated admin surface has a coherent Open Doors committee-workspace direction: navy rail, warm paper surfaces, cobalt actions, mint verification cues, compact workload cards, and a practical audit/decision flow. The visible admin navigation is reduced to the requested four destinations, and the audit queue has a bounded scroll region. It is not ready to pass because the authenticated shell still renders the Student Portal/Admin / Chair switcher and legacy admin destinations in React, hiding them with CSS rather than removing them from the authenticated experience, and the Overview does not present Total applicants as one of the top-level metric cards.

## Scores
| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The navy rail, warm paper, cobalt/mint/amber semantic palette, dossier panels, status bars, recent-candidate list, and decision register form a clear and consistent Open Doors language. The admin surface is still visually burdened by implementation leftovers and the navigation hierarchy is maintained partly through concealment rather than a clean information architecture. |
| Originality | 2/3 | PASS | HIGH | The dossier framing, committee-specific language, candidate-keyed decision register, workload distribution, and audit evidence panels show deliberate product decisions beyond a generic CRUD dashboard. The approach remains a refinement of the existing template rather than a strongly differentiated new composition. |
| Craft | 1/3 | PASS | MEDIUM | Core spacing, color treatment, table structure, responsive grids, and the queue scrollbar are mostly solid. The navigation cleanup relies on `nth-child` selectors and `display:none`, which is fragile because the selector indexes depend on hidden/conditional nav nodes; the CSS also leaves the old routes in the DOM. |
| Functionality | 1/3 | PASS | MEDIUM | Overview, Decisions, candidate audit, corpus, search/filter controls, persisted candidate decisions, and explicit empty states are implemented. The Overview has five status cards but no dedicated Total applicants card; recent-candidate and decision-row shortcuts set local selection directly instead of consistently using the full candidate-selection path, so audit context can be less complete than selecting from the queue. |

## What's Working Well

- The visible authenticated admin navigation is visually limited to Overview, Candidate audit, Decisions, and Official Corpus & PDFs; the old Dossiers, Multimodal Verification, Compliance, and Arbitration items are hidden from the primary rail.
- The Overview is the default admin tab and includes a Continue audit action, status distribution bars, applicant count text, and recent candidate activity.
- The Decisions tab is a real candidate-keyed table with candidate, track/GPA, audit status, recommendation, score, sign-off state/time, requested grant, and an audit-opening action.
- Candidate decisions are stored in `openDoorsCandidateDecisions` and read from shared React state, so a chair sign-off can appear in the Decisions table without inventing a separate decision model.
- The audit queue preserves search and status filtering and is constrained with `max-height: calc(100vh - 360px)` plus `overflow-y: auto` on desktop; responsive rules retain a bounded queue at tablet widths.
- The rules area remains the corpus tab, with selected-document content and PDF controls available behind the corpus view.
- `npm run build` passes: TypeScript compilation and Vite production build completed successfully.

## Issues Found

### Issue 1: Authenticated admin still renders the portal-mode switcher
- **What**: The `portal-switcher` containing “Student Portal” and “Admin / Chair” remains in the authenticated shell JSX. It is suppressed only by `.admin-mode .portal-switcher { display:none!important; }`.
- **Where**: `frontend/src/App.tsx`, immediately inside the authenticated `m3-app-layout`; supporting rule in `frontend/src/index.css`.
- **Why it matters**: The brief explicitly requires the toggle to be gone from authenticated admin UI. CSS concealment leaves the role-switching control in the DOM and keeps `portalMode` as the shell’s routing authority, so the admin workspace is not truly isolated from applicant mode and can regress if CSS changes or accessibility/automation tooling exposes hidden content.
- **Suggested fix**: Remove the switcher JSX from the authenticated shell and split applicant/admin entry routing so admin auth renders only the admin shell. Keep the applicant portal link only in the separate auth entry flow.

### Issue 2: Legacy admin destinations remain rendered and are hidden with positional CSS
- **What**: Applicant Dossiers, Multimodal Verification, Compliance & Need Audit, and Chair Arbitration nav nodes still exist in the admin nav and are hidden through `.m3-nav-list > .m3-nav-item:nth-child(...)` selectors. Their full tab render blocks also remain reachable through state changes.
- **Where**: `frontend/src/App.tsx` admin nav and the legacy tab blocks after the audit view; `frontend/src/index.css` final admin-nav rules.
- **Why it matters**: The requirement is a simplified visible experience with only four destinations. Positional hiding is brittle: adding/removing a conditional item changes which item is hidden, and stale state can still navigate to routes that are supposed to be removed from the admin flow. This also makes the visible nav count depend on CSS rather than the component’s actual navigation model.
- **Suggested fix**: Replace the nav with a literal four-item array/render and remove legacy admin items from the authenticated navigation path. If old panels must remain for later work, keep them behind non-admin/internal code paths rather than allowing `adminTab` to represent them in the active shell.

### Issue 3: Overview lacks an explicit Total applicants metric
- **What**: The top metric row renders only Needs review, In review, Verified, Decision needed, and Submitted. Total applicants appears only as small supporting text in the distribution card (`{proposals.length} applicants`).
- **Where**: `frontend/src/App.tsx`, `adminTab === 'overview'` block.
- **Why it matters**: Total applicants is a named required overview KPI and should be immediately scannable alongside the status counts. Its current placement makes the dashboard less useful for workload orientation and leaves the primary metric row incomplete.
- **Suggested fix**: Add a Total applicants card, then use a six-column desktop layout or a deliberate responsive grid that keeps the total visually primary without making the cards cramped.

### Issue 4: Overview and decision shortcuts do not use the full candidate-selection path
- **What**: Recent-candidate buttons and Decisions-table Open actions call `setSelectedProposal(p)` directly. Queue selection calls `handleSelectProposal(p.id)`, which loads the detailed candidate and triggers verification.
- **Where**: `frontend/src/App.tsx`, Overview recent activity and Decisions table action handlers.
- **Why it matters**: The navigation destinations share the same candidate identity and decision state, but shortcutting from Overview/Decisions can leave the audit workspace with only the list-row object instead of the fully fetched dossier. This creates an inconsistent audit context depending on entry point.
- **Suggested fix**: Route all candidate-opening actions through a single `openCandidateAudit(id, panel?)` helper that fetches the full candidate, updates selection, sets the target audit panel, and then switches to Candidate audit.

## Priority Fixes for Next Attempt
1. Remove the portal switcher from the authenticated admin shell and make admin authentication the only way to enter the admin workspace.
2. Replace CSS `nth-child` hiding with a literal four-destination admin navigation model; ensure legacy tabs cannot be reached through the active admin shell.
3. Add a first-class Total applicants overview metric and use one shared candidate-opening helper for Overview, Decisions, and queue entry points.

## Should the next attempt REFINE or PIVOT?
REFINE. The visual direction and core workflow are sound, and the build is healthy. The next attempt should make the navigation architecture explicit and remove the legacy shell residue rather than redesigning the overall visual language.
