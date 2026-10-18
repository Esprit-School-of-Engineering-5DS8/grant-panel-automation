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
   using a Groq chat model, with a deterministic keyword heuristic as a fallback.

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
MAX_LINES_FOR_LLM = 400


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
# Heuristic labelling (fallback + gap filling)
# ---------------------------------------------------------------------------
_SECTION_KEYWORDS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("Experience", ("work experience", "professional experience", "employment", "experience", "career", "leadership", "volunteering", "activities")),
    ("Education", ("education", "academic background", "academics", "studies")),
    ("Projects", ("projects", "project", "publications", "publication", "research", "awards", "honors", "certificates")),
    ("Skills", ("skills", "technical skills", "computer skills", "languages", "technologies", "tools", "competencies")),
    ("Introduction", ("profile", "summary", "objective", "about me", "introduction")),
    ("Personal", ("personal information", "personal details", "contact information", "contact", "details")),
)

_CONTACT_RE = re.compile(r"(@|https?://|www\.|linkedin|\+?\d[\d ()-]{7,}\d)", re.IGNORECASE)
_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z'.\- ]{2,48}$")


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower()).strip()


def _detect_header(text: str) -> Optional[str]:
    """Return the field label when a line is a short section heading, else None."""
    norm = _normalise(text)
    if not norm or len(norm.split()) > 5:
        return None
    for label, keywords in _SECTION_KEYWORDS:
        if any(norm == kw or norm.startswith(kw) for kw in keywords):
            return label
    return None


def heuristic_label_lines(lines: List[Dict[str, Any]]) -> List[str]:
    """Deterministic keyword-based labelling used when the LLM is unavailable."""
    labels: List[str] = []
    current = "Other"
    name_assigned = False
    for line in lines:
        text = line.get("text", "")
        header = _detect_header(text)
        assigned: Optional[str] = None
        if header:
            current = header
            assigned = header

        if assigned is None and _CONTACT_RE.search(text):
            assigned = "Personal"

        if assigned is None and not name_assigned and text.strip():
            words = text.strip().split()
            if (
                line["rect"][1] < 260  # near top of the page
                and 1 <= len(words) <= 4
                and not any(ch.isdigit() for ch in text)
                and _NAME_RE.match(text.strip()) is not None
                and current == "Other"
            ):
                assigned = "Name"
                name_assigned = True

        labels.append(assigned or (current if current != "Other" else "Other"))
    return labels


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

    payload_lines = [
        {"id": f"l{idx}", "page": line.get("page"), "text": line["text"]}
        for idx, line in enumerate(lines[:MAX_LINES_FOR_LLM])
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
def _merge_labels(lines: List[Dict[str, Any]], assignments: Optional[List[Dict[str, Any]]]) -> Tuple[List[str], str]:
    heuristic = heuristic_label_lines(lines)
    if not assignments:
        return heuristic, "heuristic"

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
        if position < len(heuristic):
            by_index[position] = {"label": label, "confidence": item.get("confidence")}

    if not by_index:
        return heuristic, "heuristic"

    labels: List[str] = []
    confidences: List[float] = []
    for idx in range(len(heuristic)):
        entry = by_index.get(idx)
        if entry and entry["label"] in CV_FIELD_LABELS:
            labels.append(entry["label"])
        else:
            labels.append(heuristic[idx])
        conf = entry.get("confidence") if entry else None
        try:
            confidences.append(float(conf))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            confidences.append(0.6)

    # Re-attach confidences on the line dicts for downstream use.
    for idx, line in enumerate(lines):
        line["label_confidence"] = round(confidences[idx], 3)

    # Section headers should inherit their section even if the model said "Other".
    for idx, line in enumerate(lines):
        if labels[idx] == "Other":
            header = _detect_header(line.get("text", ""))
            if header:
                labels[idx] = header
    return labels, "groq"


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
    if pages is None:
        pages = render_pdf_pages(pdf_path, dpi=dpi)

    # Build a flat, globally indexed list of OCR lines across all pages.
    all_lines: List[Dict[str, Any]] = []
    for page in pages:
        for line in _ocr_image(page["png"]):
            line["page"] = page["index"]
            all_lines.append(line)

    labelled_by = "heuristic"
    if groq_api_key and all_lines:
        try:
            assignments = _label_with_groq(all_lines, groq_api_key, label_model)
            labels, labelled_by = _merge_labels(all_lines, assignments)
        except Exception:
            labels, labelled_by = heuristic_label_lines(all_lines), "heuristic"
    else:
        labels = heuristic_label_lines(all_lines)

    # Default label confidence when the heuristic path was used.
    for line in all_lines:
        line.setdefault("label_confidence", 0.6)

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
        "engine": "rapidocr+groq" if labelled_by == "groq" else "rapidocr+heuristic",
        "ocr_engine": "RapidOCR (PP-OCR, onnxruntime)",
        "label_model": label_model if labelled_by == "groq" else "deterministic-heuristic",
        "labelled_by": labelled_by,
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
