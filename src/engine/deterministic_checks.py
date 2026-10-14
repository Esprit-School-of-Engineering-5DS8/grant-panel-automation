"""
Deterministic Checks Module (Stage 2 of the n8n Pipeline)
Pure code engine - no LLM judgments. Validates hard administrative,
consortium, budget ceilings and arithmetic constraints.
"""

from typing import Dict, Any, List

def check_proposal_compliance(proposal_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes all deterministic checks on a structured proposal submission.
    """
    violations = []
    warnings = []

    # 1. Consortium Rule Check (>= 3 independent partners)
    partners = proposal_data.get("consortium_partners", [])
    if len(partners) < 3:
        violations.append(f"Consortium rule violated: Found {len(partners)} partners, minimum required is 3.")

    # 2. Page Limit Check (<= 40 pages)
    page_count = proposal_data.get("page_count", 0)
    if page_count > 40:
        violations.append(f"Page limit exceeded: {page_count} pages (maximum allowed is 40).")


    # 4. Mandatory Sections Check
    sections = proposal_data.get("sections", {})
    mandatory = ["abstract", "scientific_methodology", "impact_and_dissemination", "work_packages", "budget"]
    for sec in mandatory:
        if sec not in sections or not sections[sec].strip():
            violations.append(f"Mandatory section '{sec}' is missing or empty.")

    # 5. Financial and Budget Rules Validation
    budget = proposal_data.get("budget", {})
    requested_total = budget.get("requested_grant", 0.0)
    max_grant = 3_000_000.0

    if requested_total > max_grant:
        violations.append(f"Requested grant €{requested_total:,.2f} exceeds maximum ceiling €{max_grant:,.2f}.")

    direct_personnel = budget.get("direct_personnel", 0.0)
    direct_equipment = budget.get("direct_equipment", 0.0)
    direct_travel = budget.get("direct_travel", 0.0)
    direct_other = budget.get("direct_other", 0.0)
    subcontracting = budget.get("subcontracting", 0.0)
    indirect_costs = budget.get("indirect_costs", 0.0)

    # Eligible direct costs (excluding subcontracting)
    eligible_direct = direct_personnel + direct_equipment + direct_travel + direct_other

    # Check Subcontracting Cap: <= 15% of requested grant
    if requested_total > 0:
        subcontracting_pct = (subcontracting / requested_total) * 100.0
        if subcontracting_pct > 15.0:
            violations.append(
                f"Subcontracting (€{subcontracting:,.2f} = {subcontracting_pct:.1f}%) exceeds the 15% ceiling."
            )

    # Check Indirect Costs Flat Rate: Strictly 25% of eligible direct costs
    expected_indirect = eligible_direct * 0.25
    if abs(indirect_costs - expected_indirect) > 1.0: # allow 1 EUR rounding
        violations.append(
            f"Indirect cost mismatch: declared €{indirect_costs:,.2f}, but 25% flat rate rule requires €{expected_indirect:,.2f}."
        )

    # Arithmetic Integrity Check
    computed_total = eligible_direct + subcontracting + indirect_costs
    if abs(requested_total - computed_total) > 10.0:
        violations.append(
            f"Arithmetic budget mismatch: declared requested grant €{requested_total:,.2f} does not equal sum of parts €{computed_total:,.2f}."
        )

    is_eligible = (len(violations) == 0)

    return {
        "is_eligible": is_eligible,
        "status": "PASSED" if is_eligible else "REJECTED_DETERMINISTIC",
        "violations": violations,
        "warnings": warnings,
        "budget_analysis": {
            "eligible_direct_costs": eligible_direct,
            "expected_indirect_costs_25pct": expected_indirect,
            "declared_indirect_costs": indirect_costs,
            "subcontracting_amount": subcontracting,
            "subcontracting_percentage": round((subcontracting / requested_total * 100), 2) if requested_total > 0 else 0.0,
            "computed_total": computed_total
        }
    }
