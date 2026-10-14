"""
Disagreement Detector Module (Stage 4 of n8n Pipeline)
Pure deterministic code comparing Review 1 (Technical), Review 2 (Impact),
and Review 3 (Budget). Determines if Round 2 Discussion is mandatory.
"""

from typing import Dict, Any, List

def detect_disagreement(reviews: Dict[str, Dict[str, Any]], delta_threshold: float = 2.0) -> Dict[str, Any]:
    """
    reviews format:
    {
       "technical": {"score": 4.5, "recommendation": "FUND", ...},
       "impact": {"score": 2.0, "recommendation": "REJECT", ...},
       "budget": {"score": 3.0, "recommendation": "RESERVE", ...}
    }
    """
    scores = {}
    recommendations = {}
    for role, rev in reviews.items():
        if "score" in rev:
            scores[role] = float(rev["score"])
        if "recommendation" in rev:
            recommendations[role] = rev["recommendation"]

    if not scores:
        return {
            "triggers_round_2": False,
            "reason": "No numerical scores provided.",
            "max_gap": 0.0,
            "conflicting_roles": []
        }

    score_values = list(scores.values())
    max_score = max(score_values)
    min_score = min(score_values)
    max_gap = round(max_score - min_score, 2)

    highest_role = [k for k, v in scores.items() if v == max_score][0]
    lowest_role = [k for k, v in scores.items() if v == min_score][0]

    reasons = []
    triggers = False

    # Check Rule 1: Score delta >= 2.0
    if max_gap >= delta_threshold:
        triggers = True
        reasons.append(
            f"Significant score divergence: gap of {max_gap} points between {highest_role} ({max_score}) and {lowest_role} ({min_score}) >= threshold {delta_threshold}."
        )

    # Check Rule 2: Polarization Conflict (one strongly positive >= 4.0, one strongly negative <= 2.0)
    if max_score >= 4.0 and min_score <= 2.0:
        triggers = True
        reasons.append(
            f"Polarization conflict: {highest_role} recommends high grade ({max_score}) while {lowest_role} flags serious failure ({min_score})."
        )

    # Check Rule 3: Conflicting binary recommendations (FUND vs REJECT)
    recs = set(recommendations.values())
    if "FUND" in recs and "REJECT" in recs:
        triggers = True
        reasons.append("Qualitative conflict: Direct opposition between FUND and REJECT recommendations.")

    return {
        "triggers_round_2": triggers,
        "max_gap": max_gap,
        "highest_reviewer": highest_role,
        "highest_score": max_score,
        "lowest_reviewer": lowest_role,
        "lowest_score": min_score,
        "reasons": reasons,
        "summary": "DISAGREEMENT_DETECTED_TRIGGER_ROUND_2" if triggers else "CONSENSUS_REACHED_PROCEED_TO_AGGREGATION"
    }
