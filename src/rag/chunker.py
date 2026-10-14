"""
RAG Chunking Strategies Implementation:
Strategy A: Fixed-size chunking (~400 tokens with 50 tokens overlap)
Strategy B: Structural semantic chunking (Markdown/Section-aware with metadata)
"""

import os
import re
from typing import List, Dict, Any

def tokenize_approx(text: str) -> List[str]:
    """Approximation of tokens by words/punctuation splitting."""
    return text.split()

def chunk_strategy_a(corpus_dir: str, chunk_size: int = 400, overlap: int = 50) -> List[Dict[str, Any]]:
    """
    Strategy A: Fixed-size chunking with sliding window.
    Default: ~400 words/tokens with 50 words overlap.
    """
    chunks = []
    chunk_id = 0

    for fname in sorted(os.listdir(corpus_dir)):
        if not fname.endswith(".md"):
            continue
        filepath = os.path.join(corpus_dir, fname)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        words = tokenize_approx(content)
        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk_words = words[start:end]
            chunk_text = " ".join(chunk_words)

            chunks.append({
                "id": f"strategy_a_{chunk_id}",
                "doc": fname,
                "version": "1.0",
                "strategy": "fixed_400_50",
                "text": chunk_text,
                "metadata": {
                    "doc": fname,
                    "version": "1.0",
                    "chunk_index": chunk_id,
                    "token_count": len(chunk_words)
                }
            })
            chunk_id += 1
            if end >= len(words):
                break
            start += (chunk_size - overlap)

    return chunks

def extract_criterion(doc_name: str, section_name: str) -> str:
    """Assigns criterion category for filtered evaluation."""
    doc_lower = (doc_name + " " + section_name).lower()
    if "technic" in doc_lower or "scien" in doc_lower or "02_" in doc_lower:
        return "technique"
    elif "impact" in doc_lower or "03_" in doc_lower:
        return "impact"
    elif "budget" in doc_lower or "financ" in doc_lower or "coût" in doc_lower or "04_" in doc_lower:
        return "budget"
    elif "chair" in doc_lower or "arbitr" in doc_lower or "07_" in doc_lower:
        return "chair"
    elif "data_management" in doc_lower or "open_science" in doc_lower or "08_" in doc_lower:
        return "open_science"
    elif "scor" in doc_lower or "anchor" in doc_lower or "05_" in doc_lower:
        return "scoring_rubric"
    return "general"

def chunk_strategy_b(corpus_dir: str) -> List[Dict[str, Any]]:
    """
    Strategy B: Structural chunking based on Markdown headers (#, ##, ###)
    preserves complete logical sections and attaches rich metadata:
    {doc, version, section, critere}
    """
    chunks = []
    chunk_id = 0

    for fname in sorted(os.listdir(corpus_dir)):
        if not fname.endswith(".md"):
            continue
        filepath = os.path.join(corpus_dir, fname)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Split on markdown headings while capturing the heading level
        # Matches # Title, ## Subtitle, ### Section
        sections = re.split(r'\n(?=#{1,3}\s+)', content)

        doc_title = fname.replace(".md", "").replace("_", " ").title()
        for idx, sec in enumerate(sections):
            sec_clean = sec.strip()
            if not sec_clean:
                continue

            lines = sec_clean.splitlines()
            first_line = lines[0].strip() if lines else "Section"
            section_title = re.sub(r'^#{1,3}\s+', '', first_line)

            criterion = extract_criterion(fname, section_title)

            chunks.append({
                "id": f"strategy_b_{chunk_id}",
                "doc": fname,
                "version": "1.0",
                "strategy": "structural_markdown",
                "text": sec_clean,
                "metadata": {
                    "doc": fname,
                    "version": "1.0",
                    "section": section_title,
                    "critere": criterion,
                    "doc_title": doc_title,
                    "section_index": idx
                }
            })
            chunk_id += 1

    return chunks

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    corpus_path = os.path.join(base_dir, "corpus")
    cA = chunk_strategy_a(corpus_path)
    cB = chunk_strategy_b(corpus_path)
    print(f"Strategy A (Fixed 400/50): {len(cA)} chunks generated.")
    print(f"Strategy B (Structural Markdown): {len(cB)} chunks generated.")
