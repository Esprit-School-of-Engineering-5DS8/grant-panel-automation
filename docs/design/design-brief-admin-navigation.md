# Admin navigation and overview simplification

Update the existing React/Vite admin workspace in `frontend/src`.

## Required changes

1. Remove the Student Portal / Admin / Chair toggle from the authenticated admin shell entirely. Authentication already determines the workspace. Do not render that segmented toggle in the drawer or header.

2. Simplify admin navigation to only four destinations:
   - Overview
   - Candidate audit
   - Decisions
   - PDF corpus / rules
   Hide or remove the old Dossiers, Compliance, Multimodal Verification, Deliberation, and Arbitration nav items from the primary navigation. Existing code can remain behind the scenes, but the visible experience must not compete with the new flow.

3. Add an Overview dashboard as the default admin landing tab. Use the Open Doors dossier styling. Show:
   - total applicants
   - needs review
   - in review
   - verified
   - decision needed
   - submitted
   - a compact status distribution visualization (CSS bars or segmented meter)
   - recent candidates / recent updates list
   - “Continue audit” action to the candidate audit workspace

4. Add a Decisions tab with a real table that visualizes all candidate decisions. Columns: candidate, track/major, GPA, audit status, recommendation, score, sign-off state/time, requested grant, and an action to open the candidate audit. Use candidate-keyed persisted decisions and statuses already present. Empty states should be explicit.

5. The candidate queue in the audit workspace should be constrained with a visible scrollbar and a reasonable max height. Do not let the full candidate list create an endlessly long page. Keep search and status filter controls.

6. Keep only PDF corpus as the rules/reference area. The admin should be able to open the corpus and read the selected rule document.

## UX constraints

- Keep the Open Doors applicant visual language: navy rail, warm paper, cobalt actions, mint verified, amber attention.
- The overview and decisions table must share candidate identity/status with the audit workspace. Updating a decision in audit must be reflected in the Decisions table.
- Preserve applicant portal access through the separate auth entry flow, but do not expose a portal-mode toggle inside admin.
- Run `npm run build`.
