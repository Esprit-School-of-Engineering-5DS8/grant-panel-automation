# Advanced Deep Learning Project Requirements

Source: `Advanced DL-Exam-6.pdf` (Esprit 5DS, 2026–2027)

This traceability matrix keeps the course requirements separate from the admissions-panel UI and records what can be demonstrated in the final defense. Statuses below distinguish source implementation from a verified live run.

| Requirement | Evidence | Status |
|---|---|---|
| Triggerable low-code automation | `workflows/grant_panel_simulator_n8n.json`, `workflows/grant_panel_admin_audit_n8n.json`, FastAPI bridge in `services/api/main.py` | Implemented; live n8n executions 12 and 13 succeeded |
| Versioned prompt library | `prompts/prompt_library.md` with v1 failures and v2 fixes | Implemented |
| Own RAG corpus | `corpus/`, `src/rag/chunker.py`, evaluation dataset/results | Implemented |
| Chunking comparison | Fixed 400/50 vs structural Markdown; Recall@k, MRR, and trap refusal metrics | Implemented |
| Multi-agent system | Independent technical/impact/budget evaluators, disagreement detector, chair arbitration, aggregation, traceability verifier | Implemented |
| Multimodality | PDF/layout extraction, figure verification, CV preview, Groq Whisper ASR video transcription, and candidate video player | Implemented; candidate-specific end-to-end run still required |
| Retrieval evaluation | `src/rag/evaluator.py` and `data/rag_evaluation_results.json` | Implemented |
| Workflow/repository/run instructions | `README.md`, exported workflows, source modules, tests | Implemented |
| Technical report | `REPORT.md` (comprehensive 8-section report with cohort benchmark) | Implemented |
| Prompt library and retrieval report | `prompts/prompt_library.md`, `data/rag_evaluation_results.json` | Implemented |
| Cohort empirical benchmark | `scripts/run_cohort_benchmark.py`, `data/cohort_benchmark_results.json` (Kendall tau, variance, bias audit) | Implemented |

## Verification status

- Frontend production build: verified.
- Backend Python compilation: verified.
- Workflow JSON parsing: verified.
- n8n live execution: verified by successful executions 12 and 13 in the active admin workflow. Qdrant-specific persistence was not independently revalidated in this pass.
- Groq execution: provider status is exposed by `/health`; a configured key and account-enabled models are required for live transcription/evaluation.
- Stored RAG, cohort, and bias results: regenerated from the current corpus/source. RAG used the deterministic TF-IDF fallback (8 fixed chunks vs 30 structural chunks); cohort/bias used the restored 20-proposal runner and 3-run simulation. SentenceTransformer/Qdrant-specific results remain a separate unverified variant.

## Runtime honesty & ASR Integration

The system natively loads the candidate MP4 video and invokes the **Groq Whisper Large v3 Turbo** ASR engine via the backend microservice (`services/api/main.py`), utilizing `ffmpeg-static` for audio preprocessing. For offline or isolated defense environments, a deterministic verified transcript artifact (`data/hazem_video_transcript.json`) ensures full speech-to-text RAG indexing without external network dependency.

## Grading alignment

- Prompt engineering — 20%: `prompts/prompt_library.md`
- RAG — 25%: `corpus/`, `src/rag/`, and stored benchmark results
- Multi-agent architecture — 25%: `src/engine/` and the simulator n8n workflow
- Multimodality — 15%: `src/multimodal/`, PDF preview, video player, and Groq Whisper Large v3 Turbo ASR
- Demo/report/Q&A — 15%: `README.md`, `REPORT.md`, tests, live server, and this matrix
