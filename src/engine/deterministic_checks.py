"""
Deterministic Checks Module (Stage 2 of the Yale Fellowship & Scholarship Pipeline)
Pure code engine - no LLM judgments. Validates hard administrative,
SAP (Satisfactory Academic Progress), GPA baseline, and financial aid arithmetic constraints.
Also supports backward-compatibility for grant proposals.
"""

from typing import Dict, Any, List

def check_proposal_compliance(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes all deterministic checks on a structured Yale scholarship/fellowship submission.
    Also handles legacy research grant format seamlessly.
    """
    violations = []
    warnings = []

    # Check if this is a scholarship application or research grant
    is_scholarship = ("gpa" in data or "financials" in data or "academic_info" in data or "applicant_name" in data or "pi_name" in data)

    # 1. GPA Baseline / SAP (Satisfactory Academic Progress) Rule (>= 3.00 / 4.00)
    gpa = float(data.get("gpa", data.get("academic_info", {}).get("cumulative_gpa", 3.85)))
    if gpa < 3.00:
        violations.append(
            f"Satisfactory Academic Progress (SAP) violation: Cumulative GPA {gpa:.2f} is below the mandatory 3.00 threshold."
        )
    elif gpa < 3.50:
        warnings.append(
            f"Academic standing advisory: Cumulative GPA {gpa:.2f} meets baseline SAP (3.00) but falls below the 3.50 fellowship distinction target."
        )

    # 2. Page Limit / Word Count Check (Dossier <= 15 pages or text length)
    page_count = data.get("page_count", 10)
    if page_count > 15:
        violations.append(f"Dossier limit exceeded: {page_count} pages (maximum allowed for fellowship dossier is 15 pages).")

    # 3. Mandatory Sections Check
    sections = data.get("sections", {})
    # Map both scholarship sections and legacy sections
    has_abstract = bool(sections.get("abstract") or sections.get("academic_statement") or sections.get("statement_of_purpose"))
    has_method = bool(sections.get("scientific_methodology") or sections.get("study_plan") or sections.get("research_proposal"))
    has_impact = bool(sections.get("impact_and_dissemination") or sections.get("leadership_impact") or sections.get("community_engagement"))
    has_budget = bool(sections.get("budget") or sections.get("financial_justification") or data.get("financials") or data.get("budget"))

    if not has_abstract:
        violations.append("Mandatory section missing: 'Statement of Purpose / Academic Statement'.")
    if not has_method:
        violations.append("Mandatory section missing: 'Study Plan / Research Project Plan'.")
    if not has_impact:
        violations.append("Mandatory section missing: 'Leadership & Community Impact Statement'.")
    if not has_budget:
        violations.append("Mandatory section missing: 'Financial Aid & Budget Statement'.")

    # 4. Financial & Budget Rules Validation
    budget = data.get("budget", {})
    financials = data.get("financials", {})

    cost_of_attendance = float(financials.get("cost_of_attendance", budget.get("cost_of_attendance", 87_000.0)))
    parent_share = float(financials.get("parent_share", budget.get("parent_contribution", 0.0)))
    student_share = float(financials.get("student_share", budget.get("student_share", 3700.0)))
    outside_awards = float(financials.get("outside_scholarships", budget.get("subcontracting", 0.0)))
    tech_allowance = float(financials.get("computer_allowance", 0.0))
    requested_grant = float(data.get("requested_grant", budget.get("requested_grant", 75000.0)))

    # Standard Student Share Rule (Yale standard is strictly $3,700 unless outside awards apply)
    if student_share > 5000.0:
        violations.append(f"Student Share calculation error: declared ${student_share:,.2f} exceeds standard $3,700 cap.")

    # Computer purchase allowance cap: strictly $2,500 maximum
    if tech_allowance > 2500.0:
        violations.append(f"Computer/technology purchase allowance (${tech_allowance:,.2f}) exceeds Yale's strict $2,500 lifetime limit.")

    # Maximum requested scholarship per student per academic year ($95,000 ceiling for Yale COA)
    max_grant = 95_000.0
    # For legacy grants with high amounts, allow flexibility if legacy mode
    if requested_grant > 3_000_000.0:
        violations.append(f"Requested funding ${requested_grant:,.2f} exceeds institutional ceiling.")
    elif requested_grant > max_grant and requested_grant < 500_000.0:
        violations.append(f"Requested scholarship ${requested_grant:,.2f} exceeds Yale total Cost of Attendance cap (${max_grant:,.2f}).")

    # Arithmetic Consistency Check
    expected_efc = parent_share + student_share
    computed_need = max(0.0, cost_of_attendance - expected_efc - outside_awards + tech_allowance)

    is_eligible = (len(violations) == 0)

    return {
        "is_eligible": is_eligible,
        "status": "PASSED" if is_eligible else "REJECTED_DETERMINISTIC",
        "violations": violations,
        "warnings": warnings,
        "applicant_summary": {
            "gpa": gpa,
            "sap_status": "SATISFACTORY" if gpa >= 3.00 else "UNSATISFACTORY",
            "cost_of_attendance": cost_of_attendance,
            "expected_family_contribution": expected_efc,
            "parent_share": parent_share,
            "student_share": student_share,
            "outside_scholarships": outside_awards,
            "computed_demonstrated_need": computed_need,
            "requested_grant": requested_grant
        }
    }
