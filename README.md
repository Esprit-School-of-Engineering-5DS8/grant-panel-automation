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
