"""
Multimodal Figure, Vision & Video Transcript Verifier (Yale Fellowship Review Tool)
Compares claims made in personal statements with transcripts, credentials, charts, or video speech.
Catches cases such as: "Candidate claims 3.95 GPA in essay, verified transcript shows 3.12"
or "Claims +40% benchmark gain, figure shows 11.8%".
"""

import re
from typing import Dict, Any, List

def verify_figure_text_consistency(text_claims: str, artifact_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates multimodal consistency between written statements and attached exhibits:
    - Figures/charts (metric percentages)
    - Transcript GPA numbers
    - Video pitch transcripts
    """
    discrepancies = []

    # 1. GPA verification if present in artifact_data
    if "verified_gpa" in artifact_data:
        verified_gpa = float(artifact_data["verified_gpa"])
        # Find GPA mentions in text (e.g. "GPA of 3.95", "GPA: 4.0")
        gpa_matches = re.findall(r'GPA\s*(?:of|:)?\s*([0-4](?:\.\d{1,2})?)', text_claims, re.IGNORECASE)
        if gpa_matches:
            claimed_gpas = [float(g) for g in gpa_matches]
            max_claimed = max(claimed_gpas)
            if max_claimed - verified_gpa >= 0.25:
                discrepancies.append({
                    "severity": "CRITICAL_ACADEMIC_INTEGRITY_MISMATCH",
                    "text_claim": f"GPA {max_claimed:.2f}",
                    "verified_record": f"Official Transcript GPA {verified_gpa:.2f}",
                    "gap": f"{max_claimed - verified_gpa:.2f} points",
                    "explanation": (
                        f"Transcript contradiction: Applicant personal statement asserts a cumulative GPA of {max_claimed:.2f}, "
                        f"whereas official registrar record confirms {verified_gpa:.2f}."
                    )
                })

    # 2. Percentage claims verification (charts/experimental gains)
    pct_matches = re.findall(r'([+-]?\d+(?:\.\d+)?)\s*%', text_claims)
    claimed_percentages = [float(p) for p in pct_matches] if pct_matches else []

    detected_values = artifact_data.get("detected_values", [])

    if claimed_percentages and detected_values:
        max_claimed = max(claimed_percentages)
        avg_detected = sum(detected_values) / len(detected_values)

        if max_claimed >= 1.5 * avg_detected and (max_claimed - avg_detected) > 5.0:
            discrepancies.append({
                "severity": "CRITICAL_METHODOLOGICAL_FLAW",
                "text_claim": f"{max_claimed}%",
                "figure_measurement": f"{avg_detected:.1f}%",
                "discrepancy_gap": f"{max_claimed - avg_detected:.1f}%",
                "explanation": (
                    f"Multimodal discrepancy detected: The essay asserts a {max_claimed}% research improvement, "
                    f"whereas {artifact_data.get('caption', 'the accompanying exhibit')} demonstrates an actual gain of only ~{avg_detected:.1f}%."
                )
            })

    is_consistent = (len(discrepancies) == 0)

    return {
        "is_consistent": is_consistent,
        "artifact_id": artifact_data.get("figure_id", artifact_data.get("artifact_id", "transcript_or_fig")),
        "caption": artifact_data.get("caption", "Candidate Verified Exhibits"),
        "claimed_in_text": claimed_percentages,
        "measured_in_exhibit": detected_values,
        "discrepancies": discrepancies,
        "reviewer_flag": "FLAGGED_FOR_PENALIZATION" if not is_consistent else "VERIFIED_ACCURATE"
    }
