"""
Score Aggregator & Lot Ranking Module (Stage 6 of n8n Pipeline)
Computes official weighted scores, ranking within proposal batch,
and preliminary funding recommendation tier.
"""

from typing import Dict, Any, List

DEFAULT_WEIGHTS = {
    "technical": 0.50,
    "impact": 0.30,
    "budget": 0.20
}

def aggregate_scores(final_scores: Dict[str, float], weights: Dict[str, float] = None) -> Dict[str, Any]:
    """
    final_scores: {"technical": 4.5, "impact": 4.0, "budget": 3.5}
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    composite = 0.0
    weight_sum = 0.0

    breakdown = {}
    for role, weight in weights.items():
        score = final_scores.get(role, 0.0)
        contrib = score * weight
        breakdown[role] = {
            "score": score,
            "weight": weight,
            "weighted_points": round(contrib, 3)
        }
        composite += contrib
        weight_sum += weight

    composite_score = round(composite / weight_sum, 2) if weight_sum > 0 else 0.0

    # Decision Recommendation Tier
    if composite_score >= 4.0:
        recommendation = "RECOMMENDED_FOR_FUNDING"
        tier = "A"
    elif composite_score >= 3.0:
        recommendation = "RESERVE_LIST"
        tier = "B"
    else:
        recommendation = "REJECTED"
        tier = "C"

    return {
        "composite_score": composite_score,
        "recommendation": recommendation,
        "tier": tier,
        "score_breakdown": breakdown
    }

def rank_cohort(proposals_evaluated: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ranks a cohort of evaluated proposals descending by composite_score.
    """
    sorted_proposals = sorted(
        proposals_evaluated,
        key=lambda p: p.get("aggregation", {}).get("composite_score", 0.0),
        reverse=True
    )

    for rank, p in enumerate(sorted_proposals, start=1):
        if "aggregation" not in p:
            p["aggregation"] = {}
        p["aggregation"]["cohort_rank"] = rank
        p["aggregation"]["total_cohort_size"] = len(sorted_proposals)

    return sorted_proposals
