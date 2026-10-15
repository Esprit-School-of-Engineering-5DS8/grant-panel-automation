# Evaluation — Attempt 1

## Overall Verdict: NEEDS REVISION

## Overall Assessment

The refactor has a clear editorial dossier direction: warm paper surfaces, ink/navy framing, cobalt actions, mint verification states, compact cards, and a focused queue-to-evidence-to-decision sequence. The old horizontal candidate strip and A/B testing branch are absent from the new audit flow, and the n8n companion workflow now expresses the requested evidence pipeline. However, the implementation still has a meaningful functional gap in the queue (the status selector does not filter the list), and several audit details are demo-shaped or visually secondary where the brief calls for an operational admin workspace. The direction is sound, but it is not ready to approve without one more refinement pass.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | Coherent Open Doors dossier language with strong navy/paper/cobalt/mint/amber relationships. The admin shell still carries a broad legacy navigation rail, so the focused audit sequence is not fully dominant. |
| Originality | 2/3 | PASS | HIGH | The queue plus evidence-artifact tabs and chair decision framing are deliberate and custom, rather than a generic dashboard. The underlying presentation remains card/table based and could be more distinctive in the selected-dossier header. |
| Craft | 1/3 | PASS | MEDIUM | Spacing, borders, type hierarchy, and responsive breakpoints are mostly disciplined. The desktop-to-tablet jump collapses the two-column workspace into a full-width queue followed by detail, which makes the audit context less efficient; narrow evidence grids also become long vertical scans. |
| Functionality | 1/3 | PASS | MEDIUM | Candidate selection, search, evidence tabs, parser/transcription/verifier actions, and sign-off state are present. The status filter is not wired into filtering, status is index-derived rather than candidate-level, and decision sign-off does not persist per candidate. |

## What's Working Well

- The candidate pill strip is removed from the admin hero, and the A/B testing UI/branch is not present in the admin audit path.
- The queue is a real candidate list with search, status vocabulary, candidate IDs, track/major, GPA, selection state, and linked detail context; it is substantially closer to a working review queue than the previous scattered admin surfaces.
- The selected candidate header keeps identity visible while moving through Profile & education, CV PDF parser, Video evaluation, Contract / institution, and Decision tabs. Candidate name and ID are repeated in artifact panels, which supports evidence traceability.
- CV evidence has the requested file metadata, parse state, extracted-entity summary, discrepancy flag area, and Run parser action.
- Video evidence correctly treats transcript as an automated artifact: it shows duration, transcript state, confidence, extracted claims, Run transcription, and Evaluate video. It does not add an applicant-entered transcript-notes field.
- Contract/institution verification has the requested institution, contract reference, party, source/last checked, verification state, and Run verifier action.
- The chair decision panel keeps the candidate ID and context visible while showing evidence-run count, recommendation, score, reviewer notes, and authorize/sign-off action.
- `npm run build` completed successfully. `workflows/grant_panel_admin_audit_n8n.json` parses as valid JSON, contains 9 nodes, follows Webhook → normalize → CV → transcript → video → contract/institution → deterministic checks → aggregate → chair decision, and contains no A/B test marker or branch.

## Issues Found

### Issue 1: Status filter is visually present but functionally inert
- **What**: The queue renders a select with All statuses, Needs review, In review, Verified, Decision needed, and Submitted, but the proposal filter only checks `auditSearch`; `auditStatusFilter` never participates in the list predicate.
- **Where**: Admin audit queue in `frontend/src/App.tsx`, the `.candidate-queue` map/filter expression around the status select.
- **Why it matters**: This is a primary requirement of the review queue. A chair can select a status and receive no change, which undermines trust in the workspace.
- **Suggested fix**: Store a real status per candidate (with a deterministic fallback only for demo data), then filter by both candidate text and normalized status. Show an explicit empty state when no candidates match.

### Issue 2: Queue statuses are not candidate-level audit state
- **What**: Row status is generated from `index % 3`, so status changes when the filtered/search order changes and the requested Decision needed / Submitted states are never represented by actual candidates.
- **Where**: Candidate-row rendering in the audit queue.
- **Why it matters**: Status is a workflow control, not decoration. Index-based status makes the queue unreliable and breaks the connection between candidate identity and decision state.
- **Suggested fix**: Add a `candidateAuditStatus` map keyed by proposal ID, initialize deterministic demo values once, and update it after parser, video, verifier, and chair actions.

### Issue 3: Chair authorization is not scoped to the selected candidate
- **What**: `isSignedOff`, `auditDecision`, `auditNotes`, and score state are global. Signing off one candidate can display the signed-off state after switching to another candidate, and notes/recommendation are not persisted per dossier.
- **Where**: Decision panel state and the Authorize decision button.
- **Why it matters**: This is a high-risk audit-context error: the visual decision can become detached from the candidate it is intended to authorize.
- **Suggested fix**: Store decision artifacts keyed by candidate ID, reset or load them on selection, and display a timestamp plus selected candidate name/ID after authorization.

### Issue 4: The primary audit flow is still competing with legacy admin navigation
- **What**: The left rail exposes Dossiers, Multimodal, Compliance, Deliberation, Arbitration, and Corpus as peer navigation items alongside Candidate audit.
- **Where**: Admin shell navigation.
- **Why it matters**: The brief asks for a focused review sequence and says the new workspace should be the default admin view. The old modules remain visually equal, which makes the product feel like an incremental dashboard retrofit rather than a deliberately reimagined audit workspace.
- **Suggested fix**: Keep Candidate audit as the only primary admin navigation item, and move legacy modules behind a secondary “Tools / legacy views” disclosure or a clearly subordinate utility menu.

### Issue 5: Tablet responsive behavior reduces audit efficiency
- **What**: At `max-width: 1050px`, the queue and selected dossier stack into one column; at `max-width: 650px`, the candidate list becomes a single long list and every evidence grid becomes one column.
- **Where**: Responsive rules for `.audit-workspace`, `.candidate-queue`, `.evidence-grid`, `.artifact-grid`, and `.decision-summary`.
- **Why it matters**: The brief calls for responsive styling, and this technically responds, but a chair reviewing many candidates on a tablet loses the persistent queue/detail relationship and must scroll past the entire queue before reaching the selected dossier.
- **Suggested fix**: On tablet retain a compact two-pane layout with a narrower queue, or make the queue a horizontally scrollable compact region with a sticky selected-candidate summary. Preserve quick switching without forcing a long page traversal.

### Issue 6: Candidate context is linked by repetition, but not fully surfaced as an operational header
- **What**: The selected header includes name, ID, major/track, school, and GPA, but application status and updated time are not shown there, and requested-grant context is only inside the Profile tab.
- **Where**: `.audit-candidate-head` and the profile evidence card.
- **Why it matters**: The brief explicitly requests application status in the selected candidate header. Keeping the most important identity/status fields above the evidence tabs is essential when the reviewer opens CV, video, verification, or decision.
- **Suggested fix**: Add compact header metadata for status, updated time, requested grant, and institution, with the same candidate-level status source used by the queue.

### Issue 7: Evidence action states are too demo-like for an admin audit surface
- **What**: Video displays “Video preview unavailable in demo” until action, and verification uses “Demo verifier · awaiting run”; action results are local UI state rather than clearly separated real endpoint response vs. demo fallback state.
- **Where**: Video and Contract / institution panels.
- **Why it matters**: The brief permits deterministic demo results when endpoints are unavailable, but reviewers need to understand whether an artifact is pending, unavailable, or verified. Ambiguous demo copy weakens audit confidence.
- **Suggested fix**: Use explicit state labels such as `Pending`, `Endpoint unavailable — demo result`, `Verified`, and `Needs attention`, and include checked-at timestamps/source labels in the visible result card.

## Priority Fixes for Next Attempt

1. Make queue filtering and candidate status real, candidate-keyed behavior; include Decision needed and Submitted states and an empty state.
2. Key all decision state, notes, score, and sign-off timestamp by candidate ID so switching dossiers cannot leak decision context.
3. Reduce legacy admin navigation prominence and promote the audit sequence as the unmistakable default workspace.
4. Improve tablet behavior so queue and selected dossier remain quickly switchable without a long stacked scan.
5. Promote application status, updated time, and grant amount into the persistent selected-candidate header and make demo/endpoint states explicit.

## Should the next attempt REFINE or PIVOT?

REFINE. The visual direction and information architecture are fundamentally right: the dossier language is coherent, the evidence categories are well chosen, and the workflow JSON matches the intended audit pipeline. The next attempt should concentrate on state integrity, queue behavior, and responsive review ergonomics rather than replacing the design concept.
