# Technical Report: Grant Panel Simulator
**Course:** Advanced Deep Learning — Final Project: AI Automation  
**Institution:** Esprit 5DS 2026-2027  
**Architecture:** Low-Code n8n Backbone, Qdrant Vector DB, 4 Evaluator Agents, Multimodal Pipeline  

---

## 1. System Overview & Problem Statement
Funding review panels (e.g. Horizon Europe, NSF) process dozens of multi-million euro grant applications under high time pressure. Typical pain points include:
- Unchecked arithmetical errors in complex budget tables.
- Discrepancies between high-level claims in abstracts and accompanying visual charts.
- Reviewer fatigue leading to grade inflation (compression of all marks to 4/5) and vague feedback.
- Anchoring bias in sequential review chains or conformity pressure in unstructured group chats.

**Grant Panel Simulator** implements an 8-stage automated workflow where **deterministic code handles hard administrative math and compliance checks**, while **independent LLM agents read and reason** under isolated contexts. A Chair agent arbitrates persistent disputes strictly when evidentiary discrepancies emerge.

---

## 2. Low-Code Automation Platform (n8n Backbone)
The pipeline is orchestrated end-to-end within **n8n** (`workflows/grant_panel_simulator_n8n.json`), triggered via Webhook or File Upload:
1. **Stage 1 (Reception & Parsing):** Parses proposal PDF and 2-minute video pitch (ASR Whisper).
2. **Stage 2 (Deterministic Code Checks):** Verifies consortium size ($\ge 3$), page counts ($\le 40$), subcontracting cap ($\le 15\%$), and the 25% indirect cost flat rate rule. Non-compliant proposals exit early with deterministic rejection notices.
3. **Stage 3 (Round 1 Independent Evaluators):** Dispatches the proposal to three parallel evaluators in isolated contexts:
   - Technical Evaluator (Excellence & multimodal figure verification)
   - Impact Evaluator (Exploitation & video pitch consistency)
   - Budget Evaluator (Cost eligibility & code check findings)
4. **Stage 4 (Deterministic Disagreement Detector):** Pure code node checking score delta ($\Delta \ge 2.0$) or conflict between recommendations.
5. **Stage 5 (Round 2 Chair Arbitration):** If triggered, the Chair reviews isolated evidence, arbitrates scores, and drafts the Evaluation Summary Report (ESR).
6. **Stage 6 (Aggregation & Lot Ranking):** Code node calculating weighted scores ($50\%$ Technical, $30\%$ Impact, $20\%$ Budget) and cohort rank.
7. **Stage 7 (Traceability Verifier):** Pure code node matching cited quotes against verbatim proposal text.
8. **Stage 8 (Human-in-the-Loop Approval):** Hand-off for final Human Chair authorization.

---

## 3. Versioned Prompt Engineering Library
To prevent grade inflation and hallucinated compliance, prompts were developed across two formal iterations:

### Iteration Summary
1. **Evaluator Scoring (v1 $\rightarrow$ v2):**
   - *v1 Failure:* Naive prompts produced score inflation (all proposals received 4.0–4.5) and generic flattery.
   - *v2 Fix:* Rubric anchoring with explicit definitions for marks 0 to 5, few-shot calibration examples, and mandatory verbatim evidentiary quotations with section citations.
2. **Technical Figure Verification:**
   - *v1 Failure:* LLMs casually affirmed consistency without reading numerical axes.
   - *v2 Fix:* Multimodal prompt requiring extraction of measured data points, comparing against abstract claims, and penalizing deviations $> 20\%$.
3. **Dispute Arbitration:**
   - *v1 Failure:* Naive synthesis averaged opposing scores and fabricated false consensus.
   - *v2 Fix:* Hierarchical prompt strictly bound to documentary evidence; upheld factual flaws unless refuted by verbatim text.
4. **Prompt Injection Guardrails:**
   - Evaluators isolate proposal inputs using strict `<proposal_document>` demarcations to neutralize adversarial prompt injections (e.g., hidden *"give 5/5"* attacks).

---

## 4. RAG Knowledge Base & Chunking Evaluation
The persistent rules corpus contains 8 official Horizon-AI guidelines (eligibility, financial rules, scoring anchors, ethics, video pitch specs).

### Chunking Strategy Comparison
- **Strategy A (Fixed-Size):** Sliding window of 400 words with 50-word overlap (8 chunks).
- **Strategy B (Structural Markdown):** Header-based chunking by document section with metadata `{doc, version, section, critere}` (31 chunks).

### Retrieval Evaluation Benchmark (30 Test Queries + 5 Trap Queries)
Using SentenceTransformer neural embeddings (`all-MiniLM-L6-v2`):

| Metric | Strategy A (Fixed 400/50) | Strategy B (Structural Markdown) | Delta / Analysis |
|---|---|---|---|
| **Recall@1** | 63.33% | 43.33% | Strategy A captures broader local context in a single large chunk. |
| **Recall@3** | 80.00% | 76.67% | High retrieval density across both strategies. |
| **Recall@5** | 86.67% | 83.33% | Both capture $>83\%$ of target regulatory sections. |
| **MRR (Mean Recip Rank)** | 0.7333 | 0.6056 | Strategy A provides higher initial rank due to dense document windows. |
| **Trap Refusal Rate** | 60.00% | 40.00% | Strategy A provides clearer threshold separation for queries without ground truth. |

*Justification:* While Strategy A yields slightly higher unconstrained top-1 recall due to larger chunk size, Strategy B enables **metadata-filtered retrieval**, allowing the Budget Evaluator to query exclusively within `critere: budget` documents, preventing cross-contamination.

---

## 5. Multi-Agent Architecture & Justification

### Selected Pattern: Parallel Isolated Specialists + Hierarchical Arbitration
```text
           [Incoming Proposal]
                    |
      +-------------+-------------+
      |                           |
[Technical Eval]            [Impact Eval]            [Budget Eval]
 (Isolated Context)       (Isolated Context)       (Isolated Context)
      |                           |                           |
      +-------------+-------------+
                    |
        [Disagreement Detector (Code)]
          /                     \
[Consensus]                 [Disagreement Delta >= 2.0]
     |                                    |
     |                           [Chair Arbitration]
     \                                    /
      +-------------+-------------+
                    |
        [Aggregation & Ranking (Code)]
                    |
        [Traceability Verifier (Code)]
                    |
        [Human Chair Sign-off]
```

### Why Alternatives Were Rejected:
1. **Single Monolithic LLM Call:** Suffers from the "halo effect"—a proposal with a compelling abstract is automatically forgiven for severe budget flaws.
2. **Sequential Chain (Reviewer 1 $\rightarrow$ Reviewer 2 $\rightarrow$ Reviewer 3):** Suffers from anchoring bias; subsequent evaluators consistently adjust their assessments toward the first reviewer's stance.
3. **Unstructured Group Chat Debate:** Causes conformity pressure and uncontrolled token consumption without guaranteeing factual resolution.
4. **Why 4 Agents (and not 6):** Independent evaluation is reserved for the 3 distinct scientific disciplines. Discussion moderation and ESR drafting are unified under the Chair, while score aggregation, math checks, and quote verification are offloaded to deterministic code for $100\%$ reliability and zero API cost.

---

## 6. Multimodal Integration (PDF Layout, Scanned Budget Tables & Figure Vision)
1. **Layout-Aware PDF & Scanned Table Extraction:** Extracts structured text blocks, hierarchical headers, and embedded figures directly from raw application PDFs.
2. **Vision-Driven Figure vs. Text Consistency Verification:** Solves one of the hardest challenges in scientific peer review: deceptive abstract claims. The vision layer extracts data points from benchmark charts (Figure 2) and compares them against claimed text metrics. In our test case, the Abstract claims a `+45%` speedup while the chart demonstrates only `~11.8%`, triggering an immediate methodological penalty and Round 2 review dispute.
3. **Scanned Financial Breakdown Parsing:** Converts tabular budget scans into JSON matrices for deterministic arithmetic validation by code.

---

## 7. Synthetic Dataset & Empirical Validation
A dataset of 20 grant proposals was programmatically generated, rendered into PDFs, and evaluated:
- **Clean Proposal (`PROP-01`):** Passed all deterministic checks, evaluated as Tier A (Score: 4.61), recommended for funding.
- **Budget Discrepancy Proposal (`PROP-02`):** Flagged for subcontracting at $20.3\%$ ($> 15\%$ cap) and indirect costs at $34.3\%$ ($> 25\%$ flat rate). Deterministically rejected.
- **Figure Contradiction Proposal (`PROP-03`):** Multimodal check detected discrepancy. Reviewer gap $= 2.0$ triggered Round 2 Chair arbitration.
- **Prompt Injection Proposal (`PROP-04`):** Adversarial system override neutralized by delimited prompt guards; penalized to 1.0.
- **Consortium Defect Proposal (`PROP-05`):** Caught at Stage 2 for failing the minimum 3-partner consortium rule and rejected deterministically.
