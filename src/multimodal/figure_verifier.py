"""
Figure vs Text Consistency Verifier (Multimodal Tool for Technical Reviewer)
Compares claims made in the abstract/methodology with measurements in charts/figures.
Catches cases like: "Executive summary claims +40%, chart shows ~12%".
"""

import re
from typing import Dict, Any, List

def verify_figure_text_consistency(text_claims: str, figure_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    figure_data contains:
    {
       "figure_id": "fig_p3_1",
       "caption": "Figure 2: Computational throughput improvement over baseline",
       "detected_values": [12.0, 11.8, 12.4], # measurements in the chart
       "metric_unit": "%"
    }
    """
    # Extract percentage claims from text (e.g., "+40%", "40% increase", "speedup of 45%")
    pct_matches = re.findall(r'([+-]?\d+(?:\.\d+)?)\s*%', text_claims)
    claimed_percentages = [float(p) for p in pct_matches] if pct_matches else []

    detected_values = figure_data.get("detected_values", [])
    discrepancies = []

    if claimed_percentages and detected_values:
        max_claimed = max(claimed_percentages)
        avg_detected = sum(detected_values) / len(detected_values)

        # If claim is significantly higher than measured (e.g. claimed 40% vs detected 12%)
        if max_claimed >= 1.5 * avg_detected and (max_claimed - avg_detected) > 5.0:
            discrepancies.append({
                "severity": "CRITICAL_METHODOLOGICAL_FLAW",
                "text_claim": f"{max_claimed}%",
                "figure_measurement": f"{avg_detected:.1f}%",
                "discrepancy_gap": f"{max_claimed - avg_detected:.1f}%",
                "explanation": (
                    f"Major discrepancy detected: The proposal text asserts a {max_claimed}% improvement, "
                    f"whereas {figure_data.get('caption', 'the accompanying figure')} demonstrates an actual gain of only ~{avg_detected:.1f}%."
                )
            })

    is_consistent = (len(discrepancies) == 0)

    return {
        "is_consistent": is_consistent,
        "figure_id": figure_data.get("figure_id", "unknown"),
        "caption": figure_data.get("caption", ""),
        "claimed_in_text": claimed_percentages,
        "measured_in_figure": detected_values,
        "discrepancies": discrepancies,
        "technical_reviewer_flag": (
            "FLAGGED_FOR_PENALIZATION" if not is_consistent else "VERIFIED_ACCURATE"
        )
    }
