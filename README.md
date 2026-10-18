# Grant Panel Simulator — Architecture & Execution Guide
**Simulateur multi-agents d'un comité d'évaluation de financement**  
*Esprit 5DS — Advanced Deep Learning (AI Automation)*

---

## 🚀 Overview

The **Grant Panel Simulator** is a multi-agent decision support system orchestrated by **n8n** that models an official university fellowship & scholarship review panel (Yale University Student Financial Services). 
Application submission queues an asynchronous evidence audit:
1. **Evidence intake**: CV PDFs and motivation videos are uploaded to the API; browser-local `blob:` URLs are never used as server evidence.
2. **CV extraction**: RapidOCR extracts positioned text; Groq labels all OCR lines in bounded batches. Provider errors are surfaced instead of replaced by keyword guesses.
3. **Video analysis**: FFmpeg extracts audio for timestamped Groq Whisper segments and samples up to eight time-spaced frames for a vision-capable Groq model.
4. **RAG fact check**: Markdown is chunked by heading and ranked with TF-IDF. An LLM assesses each declared claim against retrieved excerpts. A compliance conclusion requires an exact quote validated against the cited corpus file; otherwise the result is insufficient evidence.
5. **Evidence comparison and reviewers**: LLM endpoints compare form, OCR, transcript, and corpus evidence. Criterion review and chair synthesis are advisory; neither makes or signs the final award decision.
6. **Persistent audit timeline**: Stage status, timestamps, errors, and results are stored with each candidate record and exposed in the committee UI.
7. **Human-in-the-Loop Sign-off**: The committee records the final decision separately from AI assessments.

---

## 📁 Repository Structure

```text
Grant Panel/
├── docker-compose.yml             # n8n + Qdrant container stack
├── corpus/                        # Yale Fellowship Reference Rules Knowledge Base (8 docs)
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
│       └── main.py                # FastAPI intake, audit pipeline, and n8n bridge
├── workflows/
│   └── grant_panel_simulator_n8n.json # Exported full n8n pipeline workflow
├── prompts/
│   └── prompt_library.md          # Versioned Prompt Engineering Library (v1 vs v2)
├── data/
│   ├── synthetic_proposals/       # Persisted application JSON records
│   └── student_uploads/            # Server-side CV/video evidence
├── tests/
│   └── test_pipeline_e2e.py       # End-to-end integration test suite
├── REPORT.md                      # Comprehensive 8-page Technical Report
└── README.md
```

---

## Automated applicant audit

Application submission queues CV OCR, optional video transcription/vision review, cross-modal evidence comparison, and RAG fact-checking. The committee page polls the stored audit timeline and displays per-stage results. Provider, OCR, or media-conversion errors are retained as failed stages; no synthetic transcript, approval, or compliance match is substituted.

The video upload limit is 200 MB and the CV PDF limit is 10 MB. Configure `GROQ_API_KEY`; OpenCV can sample video frames when FFmpeg is unavailable. The default audit model is `openai/gpt-oss-120b`; CV OCR labeling and video frame review default to the multimodal `qwen/qwen3.8-27b`. `GROQ_AUDIT_MODEL`, `GROQ_CV_LABEL_MODEL`, `GROQ_VIDEO_MODEL`, and `GROQ_TRANSCRIPTION_MODEL` can override these defaults. Use models enabled for your Groq account.

Uploaded evidence is stored under `data/student_uploads/` and application records under `data/synthetic_proposals/`. Keep these directories private and apply the deployment's retention policy.

---

## ⚡ Quick Start

### 1. Launch the Backend API & Frontend UI
```bash
# Configure GROQ_API_KEY in the project-root .env (never commit it).
# FFmpeg must be available for video transcription and frame sampling.

# Terminal 1: Backend API (FastAPI)
python -m uvicorn services.api.main:app --host 127.0.0.1 --port 8000

# Terminal 2: Frontend Dashboard (Vite + React)
cd frontend
npm run dev
# Open http://localhost:3000 in your browser
```

### 2. Run the Automated Tests & Benchmarks
```bash
# End-to-End Test Suite (8/8 stages verified)
python tests/test_pipeline_e2e.py

# Full 20-Proposal Cohort Benchmark (Kendall Tau, 3-run variance, bias audit)
python scripts/run_cohort_benchmark.py

# Neural RAG Chunking Benchmark (Fixed vs Structural)
python src/rag/evaluator.py
```

### 3. Optional: Launch n8n and Qdrant Stack
```bash
docker compose up -d
# n8n Web UI: http://localhost:5678 (Import workflows/grant_panel_simulator_n8n.json)
# Qdrant Vector DB: http://localhost:6333/dashboard
```
