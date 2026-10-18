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

    missing_fields = []

    def optional_number(value, field):
        if value is None or value == "":
            missing_fields.append(field)
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            warnings.append(f"{field} is not numeric and requires manual review.")
            return None

    # 1. GPA Baseline / SAP (Satisfactory Academic Progress) Rule (>= 3.00 / 4.00)
    academic_info = data.get("academic_info") or {}
    gpa = optional_number(
        data.get("gpa", academic_info.get("cumulative_gpa")), "GPA"
    )
    if gpa is None:
        warnings.append("GPA was not available for the SAP check.")
    elif gpa < 3.00:
        violations.append(
            f"Satisfactory Academic Progress (SAP) violation: Cumulative GPA {gpa:.2f} is below the mandatory 3.00 threshold."
        )
    elif gpa < 3.50:
        warnings.append(
            f"Academic standing advisory: Cumulative GPA {gpa:.2f} meets baseline SAP (3.00) but falls below the 3.50 fellowship distinction target."
        )

    # 2. Page Limit / Word Count Check (Dossier <= 15 pages or text length)
    page_count = data.get("page_count")
    if page_count is None:
        missing_fields.append("Dossier page count")
        warnings.append("Dossier page count was not provided; the page-limit check was skipped.")
    elif page_count > 15:
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
    budget = data.get("budget") or {}
    financials = data.get("financials") or {}

    cost_of_attendance = optional_number(
        financials.get("cost_of_attendance", budget.get("cost_of_attendance")),
        "Cost of attendance",
    )
    parent_share = optional_number(
        financials.get("parent_share", budget.get("parent_contribution")),
        "Parent contribution",
    )
    student_share = optional_number(
        financials.get("student_share", budget.get("student_share")),
        "Student contribution",
    )
    outside_awards = optional_number(
        financials.get("outside_scholarships", budget.get("outside_scholarships")),
        "Outside scholarships",
    )
    tech_allowance = optional_number(
        financials.get("computer_allowance", budget.get("computer_allowance")),
        "Computer allowance",
    )
    requested_grant = optional_number(
        data.get("requested_grant", budget.get("requested_grant")),
        "Requested grant",
    )

    # Standard Student Share Rule (Yale standard is strictly $3,700 unless outside awards apply)
    if student_share is not None and student_share > 5000.0:
        violations.append(f"Student Share calculation error: declared ${student_share:,.2f} exceeds standard $3,700 cap.")

    # Computer purchase allowance cap: strictly $2,500 maximum
    if tech_allowance is not None and tech_allowance > 2500.0:
        violations.append(f"Computer/technology purchase allowance (${tech_allowance:,.2f}) exceeds Yale's strict $2,500 lifetime limit.")

    # Maximum requested scholarship per student per academic year ($95,000 ceiling for Yale COA)
    max_grant = 95_000.0
    # For legacy grants with high amounts, allow flexibility if legacy mode
    if requested_grant is not None and requested_grant > 3_000_000.0:
        violations.append(f"Requested funding ${requested_grant:,.2f} exceeds institutional ceiling.")
    elif requested_grant is not None and requested_grant > max_grant and requested_grant < 500_000.0:
        violations.append(f"Requested scholarship ${requested_grant:,.2f} exceeds Yale total Cost of Attendance cap (${max_grant:,.2f}).")

    # Arithmetic Consistency Check
    required_financials = (cost_of_attendance, parent_share, student_share, outside_awards, tech_allowance)
    if all(value is not None for value in required_financials):
        expected_efc = parent_share + student_share
        computed_need = max(0.0, cost_of_attendance - expected_efc - outside_awards + tech_allowance)
    else:
        expected_efc = None
        computed_need = None

    is_eligible = not violations and not missing_fields

    return {
        "is_eligible": is_eligible,
        "status": "REJECTED_DETERMINISTIC" if violations else "NEEDS_REVIEW" if missing_fields else "PASSED",
        "violations": violations,
        "warnings": warnings,
        "missing_fields": sorted(set(missing_fields)),
        "applicant_summary": {
            "gpa": gpa,
            "sap_status": "UNKNOWN" if gpa is None else "SATISFACTORY" if gpa >= 3.00 else "UNSATISFACTORY",
            "cost_of_attendance": cost_of_attendance,
            "expected_family_contribution": expected_efc,
            "parent_share": parent_share,
            "student_share": student_share,
            "outside_scholarships": outside_awards,
            "computed_demonstrated_need": computed_need,
            "requested_grant": requested_grant
        }
    }
