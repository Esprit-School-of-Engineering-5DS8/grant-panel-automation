"""
Script to generate official-looking PDF guideline documents from corpus markdown files.
Outputs PDFs to corpus/pdfs/ directory.
"""

import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_DIR = os.path.join(BASE_DIR, "corpus")
PDF_DIR = os.path.join(CORPUS_DIR, "pdfs")
os.makedirs(PDF_DIR, exist_ok=True)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontName='Helvetica-Bold',
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#1a56db'),
    spaceAfter=10
)

subtitle_style = ParagraphStyle(
    'DocSubTitle',
    parent=styles['Heading2'],
    fontName='Helvetica-Bold',
    fontSize=13,
    leading=16,
    textColor=colors.HexColor('#1e293b'),
    spaceAfter=8,
    spaceBefore=12
)

body_style = ParagraphStyle(
    'DocBody',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=10,
    leading=14,
    textColor=colors.HexColor('#334155'),
    spaceAfter=6
)

bullet_style = ParagraphStyle(
    'DocBullet',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9.5,
    leading=13,
    textColor=colors.HexColor('#334155'),
    leftIndent=15,
    spaceAfter=4
)

def md_to_pdf(md_filename):
    md_path = os.path.join(CORPUS_DIR, md_filename)
    if not os.path.exists(md_path):
        return
    
    pdf_filename = md_filename.replace(".md", ".pdf")
    pdf_path = os.path.join(PDF_DIR, pdf_filename)

    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=45,
        leftMargin=45,
        topMargin=45,
        bottomMargin=45
    )

    story = []

    # Header badge
    story.append(Paragraph("<b>EUROPEAN INNOVATION & RESEARCH EXECUTIVE AGENCY (EIREA)</b>", ParagraphStyle(
        'HeaderAgency', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#64748b')
    )))
    story.append(Paragraph("Horizon-AI Framework Programme — Official Regulatory Guidance Document", ParagraphStyle(
        'HeaderProg', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#94a3b8')
    )))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1a56db'), spaceAfter=14))

    for line in lines:
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 4))
            continue
        
        # Check Headings
        if stripped.startswith("# "):
            title_text = stripped[2:].strip()
            story.append(Paragraph(title_text, title_style))
        elif stripped.startswith("## "):
            sub_text = stripped[3:].strip()
            story.append(Paragraph(sub_text, subtitle_style))
        elif stripped.startswith("### "):
            sub3_text = stripped[4:].strip()
            story.append(Paragraph(f"<b>{sub3_text}</b>", subtitle_style))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            bullet_text = stripped[2:].strip()
            # replace markdown bold
            bullet_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', bullet_text)
            story.append(Paragraph(f"• {bullet_text}", bullet_style))
        elif re.match(r'^\d+\.\s', stripped):
            item_text = re.sub(r'^\d+\.\s', '', stripped)
            item_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', item_text)
            story.append(Paragraph(f"<b>{stripped.split('.')[0]}.</b> {item_text}", bullet_style))
        else:
            p_text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', stripped)
            story.append(Paragraph(p_text, body_style))

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#cbd5e1'), spaceAfter=8))
    story.append(Paragraph("<i>Official Reference Corpus • Certified for Automated Panel Deliberation</i>", ParagraphStyle(
        'FooterNote', fontName='Helvetica-Oblique', fontSize=7.5, leading=9, textColor=colors.HexColor('#94a3b8')
    )))

    doc.build(story)
    print(f"Generated PDF: {pdf_filename}")

if __name__ == "__main__":
    for f in sorted(os.listdir(CORPUS_DIR)):
        if f.endswith(".md"):
            md_to_pdf(f)
