from __future__ import annotations

import argparse
import re
from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

PRIMARY = "1D4ED8"
INFO = "0891B2"
TEXT = "0F172A"
MUTED = "475569"
SURFACE = "EEF4FF"
FONT_AR = "Traditional Arabic"
FONT_CODE = "Consolas"


def set_run_font(run, name=FONT_AR, size=None, bold=None, color=None, italic=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn('w:ascii'), name)
    run._element.rPr.rFonts.set(qn('w:hAnsi'), name)
    run._element.rPr.rFonts.set(qn('w:cs'), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def set_paragraph_rtl(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    if pPr.find(qn('w:bidi')) is None:
        pPr.append(OxmlElement('w:bidi'))


def set_cell_fill(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill)
    tcPr.append(shd)


def set_cell_margins(cell, top=90, bottom=90, start=110, end=110):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for tag, value in (('top', top), ('bottom', bottom), ('start', start), ('end', end)):
        el = OxmlElement(f'w:{tag}')
        el.set(qn('w:w'), str(value))
        el.set(qn('w:type'), 'dxa')
        tcMar.append(el)
    tcPr.append(tcMar)


def set_cell_vertical_center(cell):
    tcPr = cell._tc.get_or_add_tcPr()
    el = OxmlElement('w:vAlign')
    el.set(qn('w:val'), 'center')
    tcPr.append(el)


def set_repeat_table_header(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:tblHeader')
    trPr.append(el)


def set_column_width(cell, width_cm):
    tcPr = cell._tc.get_or_add_tcPr()
    width = OxmlElement('w:tcW')
    width.set(qn('w:w'), str(int(width_cm * 567)))
    width.set(qn('w:type'), 'dxa')
    tcPr.append(width)


def add_field(paragraph, field):
    b = OxmlElement('w:fldChar')
    b.set(qn('w:fldCharType'), 'begin')
    i = OxmlElement('w:instrText')
    i.set(qn('xml:space'), 'preserve')
    i.text = field
    e = OxmlElement('w:fldChar')
    e.set(qn('w:fldCharType'), 'end')
    r1 = OxmlElement('w:r')
    r2 = OxmlElement('w:r')
    r3 = OxmlElement('w:r')
    r1.append(b)
    r2.append(i)
    r3.append(e)
    paragraph._p.extend([r1, r2, r3])


def add_horizontal_rule(document):
    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(14)
    pPr = p._p.get_or_add_pPr()
    pPr.append(OxmlElement('w:bidi'))
    pBdr = OxmlElement('w:pBdr')
    el = OxmlElement('w:bottom')
    el.set(qn('w:val'), 'single')
    el.set(qn('w:sz'), '8')
    el.set(qn('w:space'), '1')
    el.set(qn('w:color'), INFO)
    pBdr.append(el)
    pPr.append(pBdr)


def set_style(document):
    styles = document.styles
    normal = styles['Normal']
    normal.font.name = FONT_AR
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(TEXT)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.2

    for name, size, color, before, after in [
        ('Heading 1', 20, PRIMARY, 6, 10),
        ('Heading 2', 13, PRIMARY, 10, 6),
        ('Heading 3', 11, INFO, 8, 4),
    ]:
        style = styles[name]
        style.font.name = FONT_AR
        style.font.bold = True
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.line_spacing = 1.15

    for name in ('List Bullet', 'List Number'):
        style = styles[name]
        style.font.name = FONT_AR
        style.font.size = Pt(10.5)
        style.paragraph_format.space_after = Pt(2)
        style.paragraph_format.line_spacing = 1.15


def add_page_number_footer(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.text = ''
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_rtl(p)
    run = p.add_run('منصة المراقب المالي المعتمد  ·  ')
    set_run_font(run, size=8, color=MUTED)
    add_field(p, 'PAGE')
    sep = p.add_run(' / ')
    set_run_font(sep, size=8, color=MUTED)
    add_field(p, 'NUMPAGES')


def add_header(section, brand, doc_type):
    p = section.header.paragraphs[0]
    p.text = ''
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph_rtl(p)
    r = p.add_run(f'{brand}  |  {doc_type}')
    set_run_font(r, size=8, bold=True, color=MUTED)


def setup_document(title, brand, doc_type, subtitle):
    document = Document()
    section = document.sections[0]
    section.page_height, section.page_width = Cm(29.7), Cm(21.0)
    section.top_margin, section.bottom_margin = Cm(2.0), Cm(2.0)
    section.left_margin, section.right_margin = Cm(2.0), Cm(2.0)
    section.header_distance, section.footer_distance = Cm(1.0), Cm(1.0)
    set_style(document)
    add_header(section, brand, doc_type)
    add_page_number_footer(section)

    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    set_paragraph_rtl(p)
    r = p.add_run(brand)
    set_run_font(r, size=10, bold=True, color=INFO)

    p = document.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    set_paragraph_rtl(p)
    r = p.add_run(doc_type)
    set_run_font(r, size=9, bold=True, color=MUTED)

    add_horizontal_rule(document)

    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(10)
    set_paragraph_rtl(p)
    r = p.add_run(title)
    set_run_font(r, size=27, bold=True, color=PRIMARY)

    p = document.add_paragraph()
    p.paragraph_format.space_after = Pt(24)
    set_paragraph_rtl(p)
    r = p.add_run(subtitle)
    set_run_font(r, size=13, color=MUTED)

    box = document.add_table(rows=1, cols=1)
    box.autofit = False
    cell = box.cell(0, 0)
    set_cell_fill(cell, SURFACE)
    set_cell_margins(cell, top=180, bottom=180, start=220, end=220)
    set_cell_vertical_center(cell)
    set_column_width(cell, 17)
    p = cell.paragraphs[0]
    set_paragraph_rtl(p)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r = p.add_run('هذا الدليل مرجع عملي وتقني معتمد لمنصة المراقب المالي المعتمد. ')
    set_run_font(r, size=10.5, bold=True, color=PRIMARY)
    r = p.add_run('يشرح مسار العمل من إنشاء الشركة وحتى الاعتماد وتوليد القوائم والنسخ الاحتياطي. يرجى الاحتفاظ به مع النسخة الاحتياطية.')
    set_run_font(r, size=10.5, color=TEXT)

    document.add_page_break()
    return document


def add_runs(paragraph, text):
    set_paragraph_rtl(paragraph)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pattern = re.compile(r'(`[^`]+`|\*\*[^*]+\*\*)')
    for part in pattern.split(text):
        if not part:
            continue
        if len(part) >= 2 and part.startswith('`') and part.endswith('`'):
            r = paragraph.add_run(part[1:-1])
            set_run_font(r, name=FONT_CODE, size=9, color=PRIMARY)
        elif len(part) >= 4 and part.startswith('**') and part.endswith('**'):
            r = paragraph.add_run(part[2:-2])
            set_run_font(r, size=10.5, bold=True, color=TEXT)
        else:
            r = paragraph.add_run(part)
            set_run_font(r, size=10.5, color=TEXT)


def add_code_block(document, lines):
    p = document.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.left_indent = Cm(0.35)
    p.paragraph_format.right_indent = Cm(0.35)
    set_paragraph_rtl(p)
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:fill'), 'F8FAFC')
    pPr.append(shd)
    for idx, line in enumerate(lines):
        if idx:
            p.add_run().add_break()
        r = p.add_run(line or ' ')
        set_run_font(r, name=FONT_CODE, size=8.5, color='334155')


def parse_table_row(line):
    raw = line.strip().strip('|')
    return [cell.strip() for cell in raw.split('|')]


def is_table_separator(line):
    cells = parse_table_row(line)
    return bool(cells) and all(re.fullmatch(r':?-{3,}:?', c.replace(' ', '')) for c in cells)


def add_table(document, table_lines):
    if not table_lines:
        return
    rows = [parse_table_row(line) for line in table_lines if not is_table_separator(line)]
    if not rows:
        return
    col_count = max(len(row) for row in rows)
    rows = [row + [''] * (col_count - len(row)) for row in rows]
    table = document.add_table(rows=len(rows), cols=col_count)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    width = 17 / col_count
    for r_idx, row in enumerate(rows):
        for c_idx, value in enumerate(row):
            cell = table.cell(r_idx, c_idx)
            set_column_width(cell, width)
            set_cell_margins(cell)
            set_cell_vertical_center(cell)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            set_paragraph_rtl(p)
            if r_idx == 0:
                set_cell_fill(cell, PRIMARY)
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r = p.add_run(value)
                set_run_font(r, size=8.7, bold=True, color='FFFFFF')
            else:
                if r_idx % 2 == 0:
                    set_cell_fill(cell, 'F8FAFC')
                add_runs(p, value)
    set_repeat_table_header(table.rows[0])
    document.add_paragraph().paragraph_format.space_after = Pt(4)


def add_toc(document, headings):
    p = document.add_heading('المحتويات', level=1)
    p = document.paragraphs[-1]
    set_paragraph_rtl(p)
    for heading in headings:
        p = document.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.left_indent = Cm(0.2 if heading['level'] == 2 else 0.55)
        set_paragraph_rtl(p)
        r = p.add_run(('— ' if heading['level'] == 2 else '') + heading['text'])
        set_run_font(r, size=9.5 if heading['level'] == 2 else 9, bold=heading['level'] == 2, color=PRIMARY if heading['level'] == 2 else MUTED)
    document.add_page_break()


def collect_headings(markdown):
    headings = []
    for line in markdown.splitlines():
        m = re.match(r'^(##)\s+(.+)$', line.strip())
        if m:
            headings.append({'level': 2, 'text': re.sub(r'\*\*', '', m.group(2).strip())})
        else:
            m3 = re.match(r'^###\s+(.+)$', line.strip())
            if m3:
                text = re.sub(r'\*\*', '', m3.group(1).strip())
                if len(text) <= 90:
                    headings.append({'level': 3, 'text': text})
    return headings[:35]


def parse_markdown(document, markdown):
    lines = markdown.splitlines()
    i = 0
    skipped_title = False
    in_code = False
    code_lines = []
    table_lines = []

    def flush_table():
        nonlocal table_lines
        if table_lines:
            add_table(document, table_lines)
            table_lines = []

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip('\n')
        stripped = line.strip()

        if stripped.startswith('```'):
            flush_table()
            if in_code:
                add_code_block(document, code_lines)
                in_code, code_lines = False, []
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_lines.append(line)
            i += 1
            continue
        if stripped.startswith('|') and stripped.endswith('|'):
            table_lines.append(stripped)
            i += 1
            continue
        flush_table()

        if not stripped or stripped == '---':
            i += 1
            continue

        h = re.match(r'^(#{1,3})\s+(.+)$', stripped)
        if h:
            level = len(h.group(1))
            text = re.sub(r'\*\*', '', h.group(2).strip())
            if level == 1 and not skipped_title:
                skipped_title = True
                i += 1
                continue
            p = document.add_heading(text, level=max(1, level - 1))
            set_paragraph_rtl(p)
            i += 1
            continue

        if stripped.startswith('> '):
            p = document.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.35)
            p.paragraph_format.right_indent = Cm(0.2)
            set_paragraph_rtl(p)
            add_runs(p, stripped[2:])
            pPr = p._p.get_or_add_pPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:val'), 'clear')
            shd.set(qn('w:fill'), 'FFF7ED')
            pPr.append(shd)
            i += 1
            continue

        bullet = re.match(r'^[-*]\s+(.+)$', stripped)
        if bullet:
            p = document.add_paragraph(style='List Bullet')
            p.paragraph_format.left_indent = Cm(0.35)
            set_paragraph_rtl(p)
            add_runs(p, bullet.group(1))
            i += 1
            continue

        numbered = re.match(r'^\d+\.\s+(.+)$', stripped)
        if numbered:
            p = document.add_paragraph(style='List Number')
            p.paragraph_format.left_indent = Cm(0.35)
            set_paragraph_rtl(p)
            add_runs(p, numbered.group(1))
            i += 1
            continue

        p = document.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        add_runs(p, stripped)
        i += 1

    flush_table()
    if in_code and code_lines:
        add_code_block(document, code_lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--title', required=True)
    parser.add_argument('--subtitle', required=True)
    parser.add_argument('--doc-type', required=True)
    args = parser.parse_args()

    markdown = Path(args.input).read_text(encoding='utf-8')
    document = setup_document(args.title, 'C.F.C  ·  منصة المراقب المالي المعتمد', args.doc_type, args.subtitle)
    add_toc(document, collect_headings(markdown))
    parse_markdown(document, markdown)

    props = document.core_properties
    props.title = args.title
    props.author = 'مكتب المراقب المالي المعتمد'
    props.subject = args.doc_type
    props.comments = 'دليل إصدار 1.1.0'
    props.language = 'ar-EG'

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    document.save(output)


if __name__ == '__main__':
    main()
