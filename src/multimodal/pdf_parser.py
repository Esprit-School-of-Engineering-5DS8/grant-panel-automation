"""
Layout-aware PDF Parser & Figure Extractor (Stage 1 Multimodal Ingestion)
Uses pypdf to extract text sections, page structure, and embedded figure images.
"""

import os
import re
from typing import Dict, Any, List

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

def extract_proposal_pdf(pdf_path: str, output_figures_dir: str = None) -> Dict[str, Any]:
    """
    Parses a proposal PDF file, extracting:
    - Page count
    - Full text and structured sections
    - Embedded figures / charts
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    if output_figures_dir:
        os.makedirs(output_figures_dir, exist_ok=True)

    extracted_text = []
    figures = []
    page_count = 0

    if HAS_PYPDF:
        reader = pypdf.PdfReader(pdf_path)
        page_count = len(reader.pages)

        for page_idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            extracted_text.append(f"--- PAGE {page_idx + 1} ---\n{text}")

            # Extract embedded images if available
            try:
                for img_idx, img_file in enumerate(page.images):
                    fig_name = f"page_{page_idx+1}_fig_{img_idx+1}_{img_file.name}"
                    fig_path = None
                    if output_figures_dir:
                        fig_path = os.path.join(output_figures_dir, fig_name)
                        with open(fig_path, "wb") as f_img:
                            f_img.write(img_file.data)

                    figures.append({
                        "figure_id": f"fig_p{page_idx+1}_{img_idx+1}",
                        "page": page_idx + 1,
                        "filename": fig_name,
                        "saved_path": fig_path,
                        "caption": f"Figure detected on Page {page_idx + 1}"
                    })
            except Exception:
                pass
    else:
        with open(pdf_path, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
        extracted_text.append(raw)
        page_count = 1

    full_proposal_text = "\n".join(extracted_text)

    # Basic section heuristic parsing
    sections = {}
    known_headers = [
        ("abstract", r"(?:abstract|résumé)"),
        ("scientific_methodology", r"(?:scientific methodology|methodology|méthodologie)"),
        ("impact_and_dissemination", r"(?:impact and dissemination|impact|retombées)"),
        ("work_packages", r"(?:work packages|lots de travail|wp\b)"),
        ("budget", r"(?:budget|financial plan|plan financier)")
    ]

    for sec_key, pattern in known_headers:
        m = re.search(f"{pattern}[:\\s]+(.*?)(?=(?:abstract|scientific methodology|impact and dissemination|work packages|budget|--- PAGE)|$)",
                      full_proposal_text, re.IGNORECASE | re.DOTALL)
        if m:
            sections[sec_key] = m.group(1).strip()
        else:
            sections[sec_key] = ""

    return {
        "pdf_path": pdf_path,
        "page_count": page_count,
        "full_text": full_proposal_text,
        "sections": sections,
        "figures": figures
    }
