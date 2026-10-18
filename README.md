# Grant Panel Simulator — Architecture & Execution Guide
**Simulateur multi-agents d'un comité d'évaluation de financement**  
*Esprit 5DS — Advanced Deep Learning (AI Automation)*

---

## 🚀 Overview

The **Grant Panel Simulator** is a multi-agent decision support system orchestrated by **n8n** that models an official scientific funding panel (e.g., Horizon Europe / NSF). 
It automates the intake of research proposals (PDF), financial schedules, and embedded visual figures, performing:
1. **Multimodal Ingestion**: PDF layout-aware parsing, section extraction, and vision-driven figure consistency verification.
2. **Deterministic Compliance Checks (Pure Code)**: Hard limits on pages, consortium size ($\ge 3$), subcontracting ceiling (15%), and indirect costs (25% flat rate).
3. **Round 1 (Parallel Independent Evaluation)**: 3 isolated evaluator agents (Technical, Impact, Budget) using anchored rubrics and mandatory verbatim citations.
4. **Deterministic Disagreement Detection**: Triggers Round 2 discussion if scores diverge by $\ge 2.0$ points or if polar conflicts occur.
5. **Round 2 (Hierarchical Chair Arbitration)**: Panel Chair arbitrates discrepancies based strictly on documentary proof and drafts the Evaluation Summary Report (ESR).
6. **Code-based Score Aggregation & Lot Ranking**: Weighted composite calculation and cohort ranking.
7. **Traceability & Anti-Hallucination Audit**: Pure code verification checking cited quotes against the raw proposal text.
8. **Human-in-the-Loop Sign-off**: Panel Chair final authorization.

---

## 📁 Repository Structure

```text
Grant Panel/
├── docker-compose.yml             # n8n + Qdrant container stack
├── corpus/                        # Horizon-AI Reference Rules Knowledge Base (8 docs)
│   ├── 01_call_overview.md
│   ├── 02_technical_excellence_criteria.md
│   ├── 03_impact_dissemination_criteria.md
│   ├── 04_budget_eligibility_rules.md
│   ├── 05_evaluation_scoring_anchors.md
│   ├── 06_ethics_and_security_guidelines.md
│   ├── 07_panel_chair_guidelines.md
│   └── 08_data_management_and_open_science.md
├── src/
│   ├── rag/                       # RAG Chunking, Embeddings, Evaluation
│   │   ├── chunker.py             # Strategy A (Fixed 400/50) vs Strategy B (Structural)
│   │   ├── eval_dataset.json      # 30 target test queries + 5 trap refusal queries
│   │   └── evaluator.py           # Benchmark script (Recall@k, MRR, Refusal Rate)
│   ├── engine/                    # Deterministic Code Nodes
│   │   ├── deterministic_checks.py# Hard rules (eligibility, math, caps)
│   │   ├── disagreement_detector.py # Triggers Round 2 on gap >= 2.0
│   │   ├── score_aggregator.py    # Weighted aggregation & cohort ranking
│   │   └── traceability_verifier.py # Anti-hallucination quote checker
│   └── multimodal/                # Multimodal Extractors & Verifiers
│       ├── pdf_parser.py          # pypdf section & layout extractor
│       └── figure_verifier.py     # Multimodal figure vs text consistency
├── services/
│   └── api/
│       └── main.py                # FastAPI microservice bridge for n8n HTTP nodes
├── workflows/
│   └── grant_panel_simulator_n8n.json # Exported full n8n pipeline workflow
├── prompts/
│   └── prompt_library.md          # Versioned Prompt Engineering Library (v1 vs v2)
├── data/
│   ├── rag_evaluation_results.json # Neural RAG evaluation benchmark output
│   └── synthetic_proposals/       # 20 generated proposals with rendered PDFs
├── tests/
│   └── test_pipeline_e2e.py       # End-to-end integration test suite
├── REPORT.md                      # Comprehensive 8-page Technical Report
└── README.md
```

---

## ⚡ Quick Start

### 1. Launch n8n and Qdrant
```bash
docker compose up -d
```
- **n8n Web UI**: [http://localhost:5678](http://localhost:5678)
- **Qdrant Vector DB**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

### 2. Start the Backend API (Microservice for n8n)
In a dedicated terminal:
```bash
python -m uvicorn services.api.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Run the End-to-End Test Suite
```bash
python tests/test_pipeline_e2e.py
```

### 4. Run the RAG Chunking A vs B Benchmark
```bash
python src/rag/evaluator.py
```

### 5. Import Workflow in n8n
1. Open [http://localhost:5678](http://localhost:5678).
2. Go to **Workflows** -> **Import from File**.
3. Select `workflows/grant_panel_simulator_n8n.json`.
4. Test with any generated proposal from `data/synthetic_proposals/PROP-01-EXCELLENT.json`.

## Applicant intake and committee review

The web applicant portal uses server-backed accounts and drafts. It does not provide demo sign-in credentials. Committee access uses the credentials in the repository-root `.env` file.

### Install and run the web application

From the repository root:

```powershell
python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env and set a private, randomly generated GRANT_PANEL_ADMIN_PASSWORD.
python -m uvicorn services.api.main:app --host 127.0.0.1 --port 8001
```

The API loads `.env` at startup. Keep that file private; it is excluded from Git.

Use a second terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (the configured port is `3000`). Create an applicant account in the browser; passwords must contain at least 10 characters. Configure the committee email and password in the backend process environment before signing in to the committee portal. Do not commit production credentials.

Applicant accounts, sessions, and drafts are stored in `data/grant_panel.sqlite3` by default; uploaded files are stored under `data/student_uploads`. Set `GRANT_PANEL_DATABASE_PATH` before starting the API to use a different SQLite file.

### CV and optional video handling

- CVs must be PDF files up to 10 MB and 30 pages. Selectable PDF text is extracted directly; image-only pages are rendered and processed with RapidOCR. The applicant sees an inline PDF preview and the extracted text. OCR errors are reported rather than replaced with sample data.
- An MP4, WebM, or MOV video up to 50 MB may be uploaded, but it is optional and is not recorded through the webcam.
- A submitted application must include a CV owned by the signed-in account. The optional video is attached only if the applicant uploads one.
- In the committee's **Video evaluation** tab, **Evaluate video** transcribes speech with Groq Whisper and compares explicit spoken facts against the application and parsed CV with Groq's text model. Contradictions include the spoken quote and the conflicting dossier value; uncertain or missing evidence is not treated as a confirmed contradiction. This is audio/transcript analysis only: no vision model is used to inspect video frames, and a human reviewer makes the final decision.

### Committee review and final decision

Select a candidate in the committee audit workspace and run the **technical**, **impact**, and **budget** reviews. Each result, evidence summary, citations, and completion time is persisted and shown for that candidate. Re-running a review clears its saved final decision. FUND, RESERVE, or REJECT remains unavailable until all three runs have completed; the API enforces the same rule.

These three reviewer runs currently use deterministic evidence rules; they are not separate LLM agents. The final decision and notes are stored in SQLite and appear in the decision register and the applicant's status view. An applicant can refresh their status to see a newly recorded committee decision.
