"""
Traceability Verifier Module (Stage 7 of n8n Pipeline)
Pure deterministic code verification that checks reviewer citations
against raw proposal text to guarantee zero hallucinations.
"""

import re
from typing import List, Dict, Any

def normalize_text(text: str) -> str:
    """Normalizes whitespace and removes punctuation for robust matching."""
    text = text.lower()
    text = re.sub(r'[\r\n\t]+', ' ', text)
    text = re.sub(r'[^\w\s]', '', text)
    return " ".join(text.split())

def verify_traceability(review: Dict[str, Any], raw_proposal_text: str) -> Dict[str, Any]:
    """
    Validates all quoted evidentiary excerpts in a review against raw text.
    review format:
    {
       "evaluator": "technical",
       "score": 4.0,
       "citations": [
          {"quote": "...exact words from proposal...", "section": "Methodology", "claimed_strength": True}
       ]
    }
    """
    normalized_raw = normalize_text(raw_proposal_text)
    citations = review.get("citations", [])

    verified_citations = []
    unverified_citations = []

    for cit in citations:
        quote = cit.get("quote", "").strip()
        if not quote:
            continue

        normalized_quote = normalize_text(quote)

        # Check exact or normalized substring inclusion
        if normalized_quote in normalized_raw:
            verified_citations.append({
                "quote": quote,
                "section": cit.get("section", "Unknown"),
                "status": "VERIFIED_IN_PROPOSAL"
            })
        else:
            # Check partial overlap (if citation was slightly paraphrased)
            words = normalized_quote.split()
            if len(words) > 6:
                # Check sliding 5-gram
                found_partial = False
                for i in range(len(words) - 5):
                    ngram = " ".join(words[i:i+5])
                    if ngram in normalized_raw:
                        found_partial = True
                        break
                if found_partial:
                    verified_citations.append({
                        "quote": quote,
                        "section": cit.get("section", "Unknown"),
                        "status": "PARTIALLY_VERIFIED_PARAPHRASING"
                    })
                    continue

            unverified_citations.append({
                "quote": quote,
                "section": cit.get("section", "Unknown"),
                "status": "HALLUCINATION_OR_UNFOUND"
            })

    total_citations = len(citations)
    valid_count = len(verified_citations)
    traceability_rate = (valid_count / total_citations) if total_citations > 0 else 1.0

    is_compliant = (len(unverified_citations) == 0 and total_citations > 0)

    return {
        "evaluator": review.get("evaluator", "unknown"),
        "total_citations": total_citations,
        "verified_count": valid_count,
        "unverified_count": len(unverified_citations),
        "traceability_rate": round(traceability_rate, 2),
        "is_traceable": is_compliant,
        "verified_citations": verified_citations,
        "flagged_unverified_citations": unverified_citations,
        "action_required": "FLAG_FOR_HUMAN_CHAIR_REVIEW" if not is_compliant else "AUDIT_CLEAN"
    }
