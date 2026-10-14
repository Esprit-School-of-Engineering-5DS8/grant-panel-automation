import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Root workspace
ROOT = os.path.abspath(os.path.dirname(__file__))
corpus_dir = os.path.join(ROOT, "corpus")
pdf_dir = os.path.join(corpus_dir, "pdfs")
os.makedirs(pdf_dir, exist_ok=True)


styles = getSampleStyleSheet()
title_style = ParagraphStyle('T', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=colors.HexColor('#1a56db'), spaceAfter=8)
sub_style = ParagraphStyle('S', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.HexColor('#1e293b'), spaceAfter=6, spaceBefore=10)
body_style = ParagraphStyle('B', fontName='Helvetica', fontSize=9.5, leading=14, textColor=colors.HexColor('#334155'), spaceAfter=4)
bullet_style = ParagraphStyle('U', fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#334155'), leftIndent=12, spaceAfter=3)

for fname in sorted(os.listdir(corpus_dir)):
    if fname.endswith('.md'):
        in_p = os.path.join(corpus_dir, fname)
        out_p = os.path.join(pdf_dir, fname.replace('.md', '.pdf'))
        with open(in_p, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        doc = SimpleDocTemplate(out_p, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        story.append(Paragraph('<b>EUROPEAN INNOVATION & RESEARCH EXECUTIVE AGENCY (EIREA)</b>', ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor('#64748b'))))
        story.append(Paragraph('Horizon-AI Framework Programme — Official Regulatory Guidance Document', ParagraphStyle('H2', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#94a3b8'))))
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1a56db'), spaceAfter=12))
        for line in lines:
            s = line.strip()
            if not s:
                story.append(Spacer(1, 4))
                continue
            if s.startswith('# '):
                story.append(Paragraph(s[2:], title_style))
            elif s.startswith('## '):
                story.append(Paragraph(s[3:], sub_style))
            elif s.startswith('### '):
                story.append(Paragraph(f'<b>{s[4:]}</b>', sub_style))
            elif s.startswith('- ') or s.startswith('* '):
                b = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', s[2:])
                story.append(Paragraph(f'• {b}', bullet_style))
            elif re.match(r'^\d+\.\s', s):
                prefix = s.split('.')[0]
                item = re.sub(r'^\d+\.\s', '', s)
                item = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', item)
                story.append(Paragraph(f'<b>{prefix}.</b> {item}', bullet_style))
            else:
                p = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', s)
                story.append(Paragraph(p, body_style))
        story.append(Spacer(1, 14))
        story.append(HRFlowable(width='100%', thickness=0.8, color=colors.HexColor('#cbd5e1'), spaceAfter=6))
        story.append(Paragraph('<i>Official Reference Corpus • Certified for Automated Panel Deliberation</i>', ParagraphStyle('F', fontName='Helvetica-Oblique', fontSize=7.5, leading=9, textColor=colors.HexColor('#94a3b8'))))
        doc.build(story)
        print('Created:', fname.replace('.md', '.pdf'))

print('Generated files:', os.listdir(pdf_dir))
