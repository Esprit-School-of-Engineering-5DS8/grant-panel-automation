"""
Generate the official Yale regulatory guidance PDFs from the Markdown corpus.

Each corpus/*.md file is rendered to corpus/pdfs/<name>.pdf with a consistent
Yale Student Financial Services header. Run from the repository root:

    python scripts/generate_corpus_pdfs.py
"""

import os
import re

import pymupdf

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS_DIR = os.path.join(BASE_DIR, "corpus")
PDF_DIR = os.path.join(CORPUS_DIR, "pdfs")

HEADER_HTML = """
<div class="hdr">
  <div class="hdr-org">YALE UNIVERSITY</div>
  <div class="hdr-sub">Student Financial Services &amp; Fellowship Programs &mdash; Official Regulatory Guidance Document</div>
  <div class="hdr-rule"></div>
</div>
"""

CSS = """
body { font-family: sans-serif; font-size: 10pt; line-height: 1.35; color: #1a1a1a; }
.hdr-org { font-size: 10pt; font-weight: bold; letter-spacing: 1.5px; color: #00356b; }
.hdr-sub { font-size: 8pt; color: #55607a; margin-bottom: 4px; }
.hdr-rule { border-bottom: 1px solid #00356b; margin-bottom: 10px; }
h1 { font-size: 14pt; color: #00356b; margin: 10px 0 4px 0; }
h2 { font-size: 11.5pt; color: #1f4e8c; margin: 10px 0 4px 0; }
h3 { font-size: 10.5pt; color: #333; margin: 8px 0 3px 0; }
p { margin: 3px 0; }
b { color: #111; }
"""


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def md_to_html(markdown: str) -> str:
    parts = []
    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        escaped = _escape(line)
        escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
        if line.startswith("### "):
            parts.append("<h3>%s</h3>" % escaped[4:])
        elif line.startswith("## "):
            parts.append("<h2>%s</h2>" % escaped[3:])
        elif line.startswith("# "):
            parts.append("<h1>%s</h1>" % escaped[2:])
        elif re.match(r"^\s*[-*]\s+", line):
            parts.append("<p>&bull;&nbsp;%s</p>" % re.sub(r"^\s*[-*]\s+", "", escaped))
        else:
            parts.append("<p>%s</p>" % escaped)
    return "\n".join(parts)


def render(markdown: str, out_path: str) -> None:
    body = HEADER_HTML + md_to_html(markdown)
    story = pymupdf.Story(html=body, user_css=CSS)
    writer = pymupdf.DocumentWriter(out_path)
    mediabox = pymupdf.paper_rect("a4")
    where = mediabox + (40, 40, -40, -40)
    more = 1
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
    writer.close()


def main() -> None:
    os.makedirs(PDF_DIR, exist_ok=True)
    count = 0
    for filename in sorted(os.listdir(CORPUS_DIR)):
        if not filename.endswith(".md"):
            continue
        with open(os.path.join(CORPUS_DIR, filename), "r", encoding="utf-8") as handle:
            markdown = handle.read()
        out_path = os.path.join(PDF_DIR, filename.replace(".md", ".pdf"))
        render(markdown, out_path)
        count += 1
        print("[+] Wrote %s" % out_path)
    print("Generated %d corpus PDFs." % count)


if __name__ == "__main__":
    main()
