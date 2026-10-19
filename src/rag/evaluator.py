"""
RAG Evaluation Benchmark: Strategy A vs Strategy B
Evaluates Recall@1, Recall@3, Recall@5, MRR, and Trap Query Refusal Rate.
Can run locally using SentenceTransformers or Cosine TF-IDF/Dense fallback.
"""

import os
import json
import numpy as np
from typing import List, Dict, Any, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    if os.getenv("DISABLE_SENTENCE_TRANSFORMERS") == "1":
        raise ImportError("disabled for deterministic offline benchmark")
    from sentence_transformers import SentenceTransformer
    HAS_ST = True
except ImportError:
    HAS_ST = False

from chunker import chunk_strategy_a, chunk_strategy_b

class VectorRetriever:
    def __init__(self, chunks: List[Dict[str, Any]], use_st: bool = False, model_name: str = "all-MiniLM-L6-v2"):
        self.chunks = chunks
        self.use_st = use_st and HAS_ST
        self.texts = [c["text"] for c in chunks]

        if self.use_st:
            try:
                self.model = SentenceTransformer(model_name)
                self.embeddings = self.model.encode(self.texts, convert_to_numpy=True, normalize_embeddings=True)
            except Exception as e:
                print(f"Warning: SentenceTransformer failed ({e}), falling back to TF-IDF.")
                self.use_st = False

        if not self.use_st:
            self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
            self.embeddings = self.vectorizer.fit_transform(self.texts).toarray()

    def query(self, query_text: str, top_k: int = 5, criterion_filter: str = None) -> List[Tuple[Dict[str, Any], float]]:
        if self.use_st:
            q_emb = self.model.encode([query_text], convert_to_numpy=True, normalize_embeddings=True)
            scores = np.dot(self.embeddings, q_emb.T).flatten()
        else:
            q_emb = self.vectorizer.transform([query_text]).toarray()
            scores = cosine_similarity(self.embeddings, q_emb).flatten()

        ranked_indices = np.argsort(scores)[::-1]
        results = []

        for idx in ranked_indices:
            chunk = self.chunks[idx]
            score = float(scores[idx])

            # Apply metadata criterion filter if requested
            if criterion_filter and criterion_filter not in ["general", "trap"]:
                chunk_crit = chunk.get("metadata", {}).get("critere")
                if chunk_crit and chunk_crit != criterion_filter and chunk_crit != "general":
                    continue

            results.append((chunk, score))
            if len(results) >= top_k:
                break

        return results

def evaluate_retriever(retriever: VectorRetriever, queries: List[Dict[str, Any]], top_k_max: int = 5, refusal_threshold: float = 0.15) -> Dict[str, Any]:
    r1, r3, r5 = 0, 0, 0
    rr_sum = 0.0
    valid_query_count = 0
    trap_refusals = 0
    trap_count = 0

    eval_details = []

    for item in queries:
        qid = item["id"]
        q_text = item["query"]
        target_doc = item["target_doc"]
        target_kw = item.get("target_keyword", "").lower()
        is_trap = item.get("is_trap", False)

        results = retriever.query(q_text, top_k=top_k_max)

        if is_trap:
            trap_count += 1
            max_score = results[0][1] if results else 0.0
            # A trap query should be refused if top score is below confidence threshold
            if max_score < refusal_threshold:
                trap_refusals += 1
                refused = True
            else:
                refused = False
            eval_details.append({
                "id": qid,
                "is_trap": True,
                "top_score": max_score,
                "refused_correctly": refused
            })
            continue

        valid_query_count += 1
        found_rank = None

        for rank, (chunk, score) in enumerate(results, start=1):
            doc_match = (chunk["doc"] == target_doc)
            kw_match = (target_kw in chunk["text"].lower()) if target_kw else True

            if doc_match and kw_match:
                found_rank = rank
                break

        if found_rank is not None:
            if found_rank <= 1:
                r1 += 1
            if found_rank <= 3:
                r3 += 1
            if found_rank <= 5:
                r5 += 1
            rr_sum += 1.0 / found_rank

        eval_details.append({
            "id": qid,
            "is_trap": False,
            "target_doc": target_doc,
            "found_rank": found_rank,
            "top_doc": results[0][0]["doc"] if results else None,
            "top_score": results[0][1] if results else 0.0
        })

    mrr = rr_sum / valid_query_count if valid_query_count > 0 else 0.0
    recall_1 = r1 / valid_query_count if valid_query_count > 0 else 0.0
    recall_3 = r3 / valid_query_count if valid_query_count > 0 else 0.0
    recall_5 = r5 / valid_query_count if valid_query_count > 0 else 0.0
    trap_refusal_rate = trap_refusals / trap_count if trap_count > 0 else 1.0

    return {
        "num_valid_queries": valid_query_count,
        "num_trap_queries": trap_count,
        "recall_at_1": round(recall_1, 4),
        "recall_at_3": round(recall_3, 4),
        "recall_at_5": round(recall_5, 4),
        "mrr": round(mrr, 4),
        "trap_refusal_rate": round(trap_refusal_rate, 4),
        "details": eval_details
    }

def run_benchmark():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(os.path.dirname(script_dir))
    corpus_dir = os.path.join(base_dir, "corpus")
    dataset_file = os.path.join(script_dir, "eval_dataset.json")

    with open(dataset_file, "r", encoding="utf-8") as f:
        queries = json.load(f)

    print("=" * 60)
    print("RUNNING RAG BENCHMARK: CHUNKING A (FIXED) vs CHUNKING B (STRUCTURAL)")
    print("=" * 60)

    # 1. Chunking
    chunks_A = chunk_strategy_a(corpus_dir, chunk_size=400, overlap=50)
    chunks_B = chunk_strategy_b(corpus_dir)
    print(f"Strategy A created {len(chunks_A)} fixed-size chunks.")
    print(f"Strategy B created {len(chunks_B)} structural section chunks.")

    # 2. Retrievers
    print("\nBuilding Retrievers with SentenceTransformer embeddings...")
    retriever_A = VectorRetriever(chunks_A, use_st=True)
    retriever_B = VectorRetriever(chunks_B, use_st=True)

    # 3. Evaluation
    res_A = evaluate_retriever(retriever_A, queries)
    res_B = evaluate_retriever(retriever_B, queries)

    # 4. Summary Output
    report = {
        "Strategy_A_Fixed_400": res_A,
        "Strategy_B_Structural": res_B,
        "Comparison": {
            "Recall@1_delta": round(res_B["recall_at_1"] - res_A["recall_at_1"], 4),
            "Recall@3_delta": round(res_B["recall_at_3"] - res_A["recall_at_3"], 4),
            "MRR_delta": round(res_B["mrr"] - res_A["mrr"], 4),
            "Refusal_delta": round(res_B["trap_refusal_rate"] - res_A["trap_refusal_rate"], 4)
        }
    }

    output_dir = os.path.join(base_dir, "data")
    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, "rag_evaluation_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[+] Results saved to {out_path}")
    print("\n" + "-" * 55)
    print(f"{'Metric':<25} | {'Strategy A (Fixed)':<12} | {'Strategy B (Struct)':<12}")
    print("-" * 55)
    print(f"{'Recall@1':<25} | {res_A['recall_at_1']:<12.2%} | {res_B['recall_at_1']:<12.2%}")
    print(f"{'Recall@3':<25} | {res_A['recall_at_3']:<12.2%} | {res_B['recall_at_3']:<12.2%}")
    print(f"{'Recall@5':<25} | {res_A['recall_at_5']:<12.2%} | {res_B['recall_at_5']:<12.2%}")
    print(f"{'MRR (Mean Recip Rank)':<25} | {res_A['mrr']:<12.4f} | {res_B['mrr']:<12.4f}")
    print(f"{'Trap Refusal Rate':<25} | {res_A['trap_refusal_rate']:<12.2%} | {res_B['trap_refusal_rate']:<12.2%}")
    print("-" * 55)

if __name__ == "__main__":
    run_benchmark()
