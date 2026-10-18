"""
CV Field Vision Extraction
==========================
Layout-aware OCR pipeline for candidate Curriculum Vitae (CV / Resume) auditing.

Stages
------
1. Render every PDF page to a raster image (PyMuPDF).
2. Detect text lines and their pixel bounding boxes with RapidOCR (onnxruntime).
3. Classify each OCR line into a CV field label
   (Name, Introduction, Education, Experience, Projects, Skills, Personal, Other)
   using the configured Groq chat model.

The output is a JSON-ready payload that a frontend can render as labelled
bounding boxes over the page image plus a structured field table.
"""

from __future__ import annotations

import io
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

try:  # PyMuPDF is shipped under either import name depending on version.
    import pymupdf  # type: ignore
except ImportError:  # pragma: no cover - fallback for older PyMuPDF installs
    try:
        import fitz as pymupdf  # type: ignore
    except ImportError:
        pymupdf = None  # type: ignore


CV_FIELD_LABELS = [
    "Name",
    "Introduction",
    "Education",
    "Experience",
    "Projects",
    "Skills",
    "Personal",
    "Other",
]

DEFAULT_LABEL_MODEL = "llama-3.3-70b-versatile"
DEFAULT_RENDER_DPI = 150
MAX_PAGES = 6
MAX_LINES_PER_LLM_REQUEST = 60


# ---------------------------------------------------------------------------
# Dependency / engine handling
# ---------------------------------------------------------------------------
_OCR_ENGINE = None
_OCR_ENGINE_READY = False
_OCR_IMPORT_ERROR: Optional[str] = None


def ocr_available() -> bool:
    """Return True when a local RapidOCR engine can be constructed."""
    _get_ocr_engine()
    return _OCR_ENGINE is not None


def ocr_error() -> Optional[str]:
    return _OCR_IMPORT_ERROR


def _get_ocr_engine():
    """Lazily construct and cache a RapidOCR engine (supports v1 and v3 APIs)."""
    global _OCR_ENGINE, _OCR_ENGINE_READY, _OCR_IMPORT_ERROR
    if _OCR_ENGINE_READY:
        return _OCR_ENGINE
    _OCR_ENGINE_READY = True
    try:
        try:
            from rapidocr import RapidOCR  # type: ignore  # rapidocr >= 2
        except ImportError:
            from rapidocr_onnxruntime import RapidOCR  # type: ignore  # legacy package
        _OCR_ENGINE = RapidOCR()
    except Exception as exc:  # pragma: no cover - environment dependent
        _OCR_IMPORT_ERROR = str(exc)
        _OCR_ENGINE = None
    return _OCR_ENGINE


# ---------------------------------------------------------------------------
# PDF rendering
# ---------------------------------------------------------------------------
def _render_doc(doc, dpi: int) -> List[Dict[str, Any]]:
    pages: List[Dict[str, Any]] = []
    for index in range(min(doc.page_count, MAX_PAGES)):
        page = doc[index]
        pixmap = page.get_pixmap(dpi=dpi)
        pages.append(
            {
                "index": index + 1,
                "width": pixmap.width,
                "height": pixmap.height,
                "png": pixmap.tobytes("png"),
            }
        )
    return pages


def render_pdf_pages(pdf_path: str, dpi: int = DEFAULT_RENDER_DPI) -> List[Dict[str, Any]]:
    """Render each page of a PDF file to PNG bytes and capture its pixel dimensions."""
    if pymupdf is None:
        raise RuntimeError("PyMuPDF is required for CV rendering but is not installed.")
    doc = pymupdf.open(pdf_path)
    try:
        return _render_doc(doc, dpi)
    finally:
        doc.close()


def render_pdf_bytes(data: bytes, dpi: int = DEFAULT_RENDER_DPI) -> List[Dict[str, Any]]:
    """Render each page of an in-memory PDF to PNG bytes."""
    if pymupdf is None:
        raise RuntimeError("PyMuPDF is required for CV rendering but is not installed.")
    doc = pymupdf.open(stream=data, filetype="pdf")
    try:
        return _render_doc(doc, dpi)
    finally:
        doc.close()


def latex_to_pdf_bytes(latex: str, title: str = "") -> bytes:
    """Lay out plain-text CV content (derived from LaTeX) into a simple PDF."""
    try:
        from fpdf import FPDF  # type: ignore
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("fpdf2 is required to render a CV from LaTeX content.") from exc

    from multimodal.cv_parser import clean_latex  # local import avoids import cycles

    latex = re.sub(r"\\documentclass(\[[^\]]*\])?\{[^}]*\}", "", latex)
    latex = re.sub(r"\\usepackage(\[[^\]]*\])?\{[^}]*\}", "", latex)
    text = clean_latex(latex).replace("\\\\", "\n")

    def sanitize(value: str) -> str:
        return value.encode("latin-1", "replace").decode("latin-1")

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    pdf.set_font("Helvetica", size=10.5)
    if title:
        pdf.set_font("Helvetica", style="B", size=16)
        pdf.multi_cell(0, 9, sanitize(title))
        pdf.ln(2)
        pdf.set_font("Helvetica", size=10.5)
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            pdf.ln(2)
            continue
        heading = line.strip("-").strip()
        if line.startswith("---") and line.endswith("---") and heading:
            pdf.ln(2)
            pdf.set_font("Helvetica", style="B", size=12.5)
            pdf.multi_cell(0, 7, sanitize(heading.upper()))
            pdf.set_font("Helvetica", size=10.5)
        else:
            pdf.multi_cell(0, 5.5, sanitize(line))
    return bytes(pdf.output())


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------
def _ocr_image(image_bytes: bytes) -> List[Dict[str, Any]]:
    """Run RapidOCR over a single image and normalise its output to a line list."""
    engine = _get_ocr_engine()
    if engine is None:
        raise RuntimeError(_OCR_IMPORT_ERROR or "RapidOCR is not available.")

    output = engine(image_bytes)

    boxes_raw: Any = None
    texts_raw: Any = None
    scores_raw: Any = None

    # rapidocr >= 2 returns a RapidOCROutput object.
    if hasattr(output, "boxes"):
        boxes_raw = output.boxes
        texts_raw = output.txts
        scores_raw = output.scores
    # legacy rapidocr-onnxruntime returns (result, elapse).
    elif isinstance(output, tuple):
        result = output[0] or []
        boxes_raw = [item[0] for item in result]
        texts_raw = [item[1] for item in result]
        scores_raw = [item[2] for item in result]

    if boxes_raw is None:
        return []

    lines: List[Dict[str, Any]] = []
    for idx, box in enumerate(boxes_raw):
        # box is a 4x2 sequence of [x, y] points.
        points = [[float(pt[0]), float(pt[1])] for pt in box]
        xs = [pt[0] for pt in points]
        ys = [pt[1] for pt in points]
        text = ""
        try:
            text = str(texts_raw[idx]).strip()
        except (IndexError, TypeError):
            text = ""
        score = 0.0
        try:
            score = float(scores_raw[idx])
        except (IndexError, TypeError, ValueError):
            score = 0.0
        if not text:
            continue
        lines.append(
            {
                "polygon": points,
                "rect": [min(xs), min(ys), max(xs), max(ys)],
                "text": text,
                "score": max(0.0, min(1.0, score)),
            }
        )
    return lines


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Groq labelling
# ---------------------------------------------------------------------------
def _label_with_groq(
    lines: List[Dict[str, Any]],
    api_key: str,
    model: str,
) -> Optional[List[Dict[str, Any]]]:
    """Ask a Groq chat model to classify OCR lines; returns id/label/confidence list."""
    import requests

    if len(lines) > MAX_LINES_PER_LLM_REQUEST:
        assignments: List[Dict[str, Any]] = []
        for start in range(0, len(lines), MAX_LINES_PER_LLM_REQUEST):
            batch = _label_with_groq(lines[start : start + MAX_LINES_PER_LLM_REQUEST], api_key, model)
            if not batch:
                raise ValueError(f"CV label model returned no assignments for OCR lines starting at {start}.")
            for item in batch:
                local_id = re.fullmatch(r"l(\d+)", str(item.get("id", "")))
                if local_id is None:
                    raise ValueError("CV label model returned an invalid line identifier.")
                item["id"] = f"l{start + int(local_id.group(1))}"
            assignments.extend(batch)
        return assignments

    payload_lines = [
        {"id": f"l{idx}", "page": line.get("page"), "text": line["text"]}
        for idx, line in enumerate(lines)
    ]
    system_prompt = (
        "You are a CV / resume layout analyst. You receive OCR text lines from a "
        "candidate CV and must classify every line into exactly one field label from: "
        f"{', '.join(CV_FIELD_LABELS)}. "
        "Label definitions: Name = the applicant's full name (usually the largest, "
        "most prominent line near the top). Introduction = profile / summary / objective "
        "paragraph. Education = degrees, institutions, dates, GPA, coursework, honours. "
        "Experience = work, internships, employment, and leadership roles. "
        "Projects = projects, publications, research, and awards. Skills = technical "
        "skills, languages, tools, and competencies. Personal = contact details, address, "
        "nationality, and other personal information. Other = anything that does not fit. "
        "A section header (e.g. 'EDUCATION', 'WORK EXPERIENCE') applies to the following "
        "lines until a new header appears; classify each line by its section. Return "
        "strict JSON only, no prose."
    )
    user_prompt = (
        "Classify the following OCR lines. Respond with JSON of the exact shape "
        '{"assignments":[{"id":"l0","label":"Name","confidence":0.97}]}. '
        "Include one object for every provided id, in order. Labels must be one of "
        f"{', '.join(CV_FIELD_LABELS)}.\n\nLINES:\n" + json.dumps(payload_lines, ensure_ascii=False)
    )

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=90,
    )
    response.raise_for_status()
    content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
    parsed = json.loads(content)
    assignments = parsed.get("assignments") if isinstance(parsed, dict) else None
    return assignments if isinstance(assignments, list) else None


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def _merge_labels(
    lines: List[Dict[str, Any]],
    assignments: Optional[List[Dict[str, Any]]],
    source: str = "groq",
) -> Tuple[List[str], str]:
    if not assignments:
        raise ValueError("CV label model returned no line assignments.")

    by_index: Dict[int, Dict[str, Any]] = {}
    for item in assignments:
        raw_id = str(item.get("id", ""))
        match = re.match(r"l(\d+)$", raw_id)
        if not match:
            continue
        position = int(match.group(1))
        label = str(item.get("label", "")).strip()
        if label not in CV_FIELD_LABELS:
            # Light normalisation of common variants.
            label = _canonical_label(label)
        if position < len(lines) and label in CV_FIELD_LABELS:
            by_index[position] = {"label": label, "confidence": item.get("confidence")}

    if len(by_index) != len(lines):
        raise ValueError("CV label model did not provide one valid label for every OCR line.")

    labels: List[str] = []
    confidences: List[float] = []
    for idx in range(len(lines)):
        entry = by_index[idx]
        labels.append(entry["label"])
        conf = entry.get("confidence")
        try:
            confidence = float(conf)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            confidence = 0.6
        confidences.append(min(1.0, max(0.0, confidence)))

    # Re-attach confidences on the line dicts for downstream use.
    for idx, line in enumerate(lines):
        line["label_confidence"] = round(confidences[idx], 3)

    return labels, source


def _canonical_label(label: str) -> str:
    norm = label.strip().lower()
    mapping = {
        "name": "Name",
        "introduction": "Introduction",
        "profile": "Introduction",
        "summary": "Introduction",
        "education": "Education",
        "experience": "Experience",
        "work": "Experience",
        "projects": "Projects",
        "project": "Projects",
        "skill": "Skills",
        "skills": "Skills",
        "personal": "Personal",
        "contact": "Personal",
        "other": "Other",
    }
    return mapping.get(norm, "Other")


_SECTION_PATTERNS: List[Tuple[str, str]] = [
    (r"\b(education|academic background|academic qualifications|qualifications)\b", "Education"),
    (r"\b(experience|work experience|professional experience|employment|internships?)\b", "Experience"),
    (r"\b(projects?|portfolio)\b", "Projects"),
    (r"\b(skills?|technical skills|technologies|competencies|toolkit)\b", "Skills"),
    (r"\b(personal|contact|details)\b", "Personal"),
    (r"\b(introduction|profile|summary|objective|about me)\b", "Introduction"),
]


def _label_with_heuristic(lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deterministic fallback labeller used when the Groq model is unavailable.

    It walks the OCR lines in reading order, tracks the most recent recognised
    section heading, and tags each following line with that section.
    """
    assignments: List[Dict[str, Any]] = []
    heading = "Other"
    for index, line in enumerate(lines):
        text = str(line.get("text", "")).strip()
        lowered = text.lower()
        label: Optional[str] = None
        for pattern, name in _SECTION_PATTERNS:
            if re.search(pattern, lowered):
                label = name
                heading = name
                break
        if label is None:
            looks_like_contact = (
                "@" in text
                or "linkedin" in lowered
                or "github" in lowered
                or bool(re.search(r"\+?\d[\d\s().-]{6,}\d", text))
            )
            looks_like_name = (
                index <= 1
                and 1 <= len(text.split()) <= 4
                and not re.search(r"\d|@", text)
                and bool(re.search(r"[A-Za-z]", text))
            )
            if looks_like_contact:
                label = "Personal"
            elif looks_like_name:
                label = "Name"
                heading = "Name"
            else:
                label = heading
        assignments.append({"id": f"l{index}", "label": label, "confidence": 0.55})
    return assignments


def extract_cv_vision(
    pdf_path: str,
    proposal_id: str,
    groq_api_key: str = "",
    label_model: str = DEFAULT_LABEL_MODEL,
    dpi: int = DEFAULT_RENDER_DPI,
    page_url_builder=None,
    pages: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run the full render -> OCR -> label pipeline and return a JSON-ready result."""
    notice: Optional[str] = None
    if pages is None:
        pages = render_pdf_pages(pdf_path, dpi=dpi)

    # Build a flat, globally indexed list of OCR lines across all pages.
    all_lines: List[Dict[str, Any]] = []
    for page in pages:
        for line in _ocr_image(page["png"]):
            line["page"] = page["index"]
            all_lines.append(line)

    if not all_lines:
        raise RuntimeError("OCR found no readable text in the uploaded CV.")
    if groq_api_key.strip():
        try:
            assignments = _label_with_groq(all_lines, groq_api_key, label_model)
            labels, labelled_by = _merge_labels(all_lines, assignments, "groq")
        except Exception as error:  # noqa: BLE001 - degrade instead of failing the audit
            assignments = _label_with_heuristic(all_lines)
            labels, labelled_by = _merge_labels(all_lines, assignments, "heuristic")
            notice = (
                "The Groq CV label model was unavailable "
                f"({type(error).__name__}: {error}); fields were labelled by the deterministic heuristic labeller."
            )
    else:
        assignments = _label_with_heuristic(all_lines)
        labels, labelled_by = _merge_labels(all_lines, assignments, "heuristic")
        notice = "No GROQ_API_KEY is configured; fields were labelled by the deterministic heuristic labeller."

    pages_meta = []
    for page in pages:
        builder = page_url_builder or (lambda pid, pidx: f"/api/admin/cv-ocr/{pid}/pages/{pidx}")
        pages_meta.append(
            {
                "index": page["index"],
                "width": page["width"],
                "height": page["height"],
                "image_url": builder(proposal_id, page["index"]),
            }
        )
    page_lookup = {page["index"]: page for page in pages}

    boxes: List[Dict[str, Any]] = []
    fields: Dict[str, List[Dict[str, Any]]] = {label: [] for label in CV_FIELD_LABELS}
    label_counts: Dict[str, int] = {label: 0 for label in CV_FIELD_LABELS}
    score_total = 0.0

    for idx, line in enumerate(all_lines):
        page = page_lookup[line["page"]]
        width = max(1, page["width"])
        height = max(1, page["height"])
        x0, y0, x1, y1 = line["rect"]
        box_id = f"p{line['page']}-l{idx}"
        label = labels[idx] if idx < len(labels) else "Other"
        box = {
            "id": box_id,
            "page": line["page"],
            "label": label,
            "text": line["text"],
            "score": round(line["score"], 4),
            "label_confidence": round(float(line.get("label_confidence", 0.6)), 3),
            "bbox": {
                "x": round(x0 / width, 5),
                "y": round(y0 / height, 5),
                "w": round((x1 - x0) / width, 5),
                "h": round((y1 - y0) / height, 5),
            },
            "pixel": {
                "x0": round(x0, 2),
                "y0": round(y0, 2),
                "x1": round(x1, 2),
                "y1": round(y1, 2),
            },
            "polygon": [[round(px, 2), round(py, 2)] for px, py in line["polygon"]],
        }
        boxes.append(box)
        fields[label].append({"id": box_id, "page": line["page"], "text": line["text"]})
        label_counts[label] += 1
        score_total += line["score"]

    field_groups = [
        {
            "label": label,
            "count": label_counts[label],
            "items": fields[label],
        }
        for label in CV_FIELD_LABELS
    ]

    structured = {
        label: [item["text"] for item in fields[label]]
        for label in CV_FIELD_LABELS
        if fields[label]
    }

    return {
        "status": "complete",
        "proposal_id": proposal_id,
        "engine": f"rapidocr+{labelled_by}",
        "ocr_engine": "RapidOCR (PP-OCR, onnxruntime)",
        "label_model": label_model,
        "labelled_by": labelled_by,
        "notice": notice,
        "labels": CV_FIELD_LABELS,
        "page_count": len(pages),
        "pages": pages_meta,
        "boxes": boxes,
        "fields": field_groups,
        "structured": structured,
        "stats": {
            "box_count": len(boxes),
            "line_count": len(all_lines),
            "avg_score": round(score_total / len(boxes), 4) if boxes else 0.0,
            "label_counts": label_counts,
            "render_dpi": dpi,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
