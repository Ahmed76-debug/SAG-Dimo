from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os
import re

project = r'C:\Users\CONNECT\Documents\Default Project\doctor-clinic-platform'

files = [
    ('دليل المستخدم - منصة طبيب.md', 'دليل المستخدم - منصة طبيب.docx'),
    ('دليل المطور التقني - منصة طبيب.md', 'دليل المطور التقني - منصة طبيب.docx'),
]

for md_name, docx_name in files:
    md_path = os.path.join(project, md_name)
    docx_path = os.path.join(project, docx_name)
    
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    doc = Document()
    
    # Normal style
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    
    for line in content.splitlines():
        s = line.rstrip()
        stripped = s.strip()
        
        if not stripped:
            continue
        
        # Skip code fences
        if stripped.startswith('```'):
            continue
        
        # Main title
        if stripped.startswith('# ') and not stripped.startswith('## '):
            title = stripped[2:].strip()
            h = doc.add_heading(title, 0)
            h.alignment = WD_ALIGN_PARAGRAPH.CENTER
            continue
        
        # H1
        if stripped.startswith('## ') and not stripped.startswith('### '):
            text = stripped[3:].strip()
            doc.add_heading(text, level=1)
            continue
        
        # H2
        if stripped.startswith('### ') and not stripped.startswith('#### '):
            text = stripped[4:].strip()
            doc.add_heading(text, level=2)
            continue
        
        # H3
        if stripped.startswith('#### '):
            text = stripped[5:].strip()
            doc.add_heading(text, level=3)
            continue
        
        # Blockquote
        if stripped.startswith('> '):
            text = stripped[2:].strip()
            p = doc.add_paragraph(text)
            p.paragraph_format.left_indent = Inches(0.5)
            for run in p.runs:
                run.italic = True
                run.font.color.rgb = RGBColor(100, 100, 100)
            continue
        
        # Unordered list
        if stripped.startswith('- ') or stripped.startswith('* '):
            text = stripped[2:].strip()
            doc.add_paragraph(text, style='List Bullet')
            continue
        
        # Ordered list
        m = re.match(r'^\d+\.\s+(.*)$', stripped)
        if m:
            text = m.group(1).strip()
            doc.add_paragraph(text, style='List Number')
            continue
        
        # Table rows (simple)
        if '|' in stripped and '---' not in stripped:
            cells = [c.strip() for c in stripped.split('|') if c.strip()]
            if cells:
                p = doc.add_paragraph(' | '.join(cells))
                continue
        
        # Normal paragraph
        doc.add_paragraph(stripped)
    
    doc.save(docx_path)
    print('Saved:', docx_name)

print('Done')
