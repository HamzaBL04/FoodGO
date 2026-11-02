#!/usr/bin/env python3
"""
Fills the Lab 5 handout (Word) with FoodGO's answers, keeping the handout's own
layout and styles. Every answer is read from the two markdown files next to
this script, so the .docx and the markdown can never disagree.

Usage: python3 docs/lab5-design/build_docx.py <handout.docx>
Writes docs/lab5-design/Lab5_Design_Practical_Session_FoodGO.docx
Needs python-docx.
"""
import copy
import re
import sys
from pathlib import Path

import docx
from docx.oxml.ns import qn
from docx.shared import Inches
from docx.text.paragraph import Paragraph

HERE = Path(__file__).resolve().parent
UML = HERE.parent / 'uml'
WORKSHEET = (HERE / 'LAB5_DESIGN_WORKSHEET.md').read_text(encoding='utf-8')
SDD = (HERE / 'SDD_SKELETON_SECTIONS_1-2.md').read_text(encoding='utf-8')
OUT = HERE / 'Lab5_Design_Practical_Session_FoodGO.docx'


# ---------------------------------------------------------------- markdown
def section(md, heading):
    """Text under a markdown heading (any level) up to the next heading of the same or higher level."""
    m = re.search(rf'^(#+) {re.escape(heading)}.*$', md, re.M)
    if not m:
        raise SystemExit(f'heading not found: {heading}')
    level = len(m.group(1))
    rest = md[m.end():]
    nxt = re.search(rf'^#{{1,{level}}} ', rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def tables_in(text):
    """All markdown tables in a block, each as a list of rows (header first)."""
    out, cur = [], []
    for line in text.splitlines():
        if line.startswith('|'):
            if re.match(r'^\|[\s:|-]+\|$', line):
                continue
            cur.append([c.strip() for c in line.strip().strip('|').split('|')])
        elif cur:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def numbered(text):
    return [re.sub(r'^\d+\.\s*', '', l) for l in text.splitlines() if re.match(r'^\d+\.\s', l)]


def paragraph_after(text, prefix):
    for block in text.split('\n\n'):
        if block.strip().startswith(prefix):
            return ' '.join(block.strip().split('\n'))
    raise SystemExit(f'paragraph not found: {prefix}')


def clean(s):
    s = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', s)
    s = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', s)
    return s.replace('`', '').replace('_to do in class_', 'to do in class').strip()


# ---------------------------------------------------------------- docx helpers
def set_runs(p_el, text, rpr):
    """Replace a paragraph's runs with text; **bold** spans become bold runs."""
    for r in p_el.findall(qn('w:r')) + p_el.findall(qn('w:hyperlink')):
        p_el.remove(r)
    for i, part in enumerate(re.split(r'\*\*', clean(text))):
        if not part:
            continue
        r = p_el.makeelement(qn('w:r'), {})
        if rpr is not None:
            rp = copy.deepcopy(rpr)
            if i % 2 == 1 and rp.find(qn('w:b')) is None:
                rp.insert(0, rp.makeelement(qn('w:b'), {}))
            r.append(rp)
        elif i % 2 == 1:
            rp = r.makeelement(qn('w:rPr'), {})
            rp.append(rp.makeelement(qn('w:b'), {}))
            r.append(rp)
        for j, line in enumerate(part.split('\n')):
            if j:
                r.append(r.makeelement(qn('w:br'), {}))
            t = r.makeelement(qn('w:t'), {qn('xml:space'): 'preserve'})
            t.text = line
            r.append(t)
        p_el.append(r)


def first_rpr(p_el):
    r = p_el.find(qn('w:r'))
    return None if r is None else r.find(qn('w:rPr'))


def add_after(anchor_el, template_p, text):
    """Insert a copy of template paragraph after anchor, with new text. Returns the new element."""
    rpr = first_rpr(template_p)
    new = copy.deepcopy(template_p)
    set_runs(new, text, rpr)
    anchor_el.addnext(new)
    return new


def add_image_after(doc, anchor_el, image, width):
    # A bare, centred paragraph: copying a body paragraph would carry its
    # exact line spacing, which clips the picture to one line.
    new = BODY_P.makeelement(qn('w:p'), {})
    ppr = new.makeelement(qn('w:pPr'), {})
    ppr.append(ppr.makeelement(qn('w:spacing'), {qn('w:before'): '120', qn('w:after'): '120', qn('w:line'): '240', qn('w:lineRule'): 'auto'}))
    ppr.append(ppr.makeelement(qn('w:jc'), {qn('w:val'): 'center'}))
    new.append(ppr)
    anchor_el.addnext(new)
    Paragraph(new, doc.paragraphs[0]._parent).add_run().add_picture(str(image), width=width)
    return new


def section_break(doc, anchor_el, landscape):
    """Insert a paragraph that ends the current section, with portrait or landscape pages."""
    sp = copy.deepcopy(doc.element.body.sectPr)
    for tp in sp.findall(qn('w:titlePg')):
        sp.remove(tp)
    size = sp.find(qn('w:pgSz'))
    w, h = (15840, 12240) if landscape else (12240, 15840)
    size.set(qn('w:w'), str(w))
    size.set(qn('w:h'), str(h))
    size.set(qn('w:orient'), 'landscape' if landscape else 'portrait')
    p = anchor_el.makeelement(qn('w:p'), {})
    ppr = p.makeelement(qn('w:pPr'), {})
    ppr.append(sp)
    p.append(ppr)
    anchor_el.addnext(p)
    return p


def landscape_image(doc, anchor_el, image, caption):
    """A wide diagram on its own landscape page, between two portrait sections."""
    end_portrait = section_break(doc, anchor_el, landscape=False)
    img = add_image_after(doc, end_portrait, image, Inches(9))
    cap = add_after(img, BODY_P, caption)
    return section_break(doc, cap, landscape=True)


def set_cell(cell, text):
    p = cell.paragraphs[0]._p
    for extra in cell.paragraphs[1:]:
        extra._p.getparent().remove(extra._p)
    set_runs(p, text, first_rpr(p) if first_rpr(p) is not None else CELL_RPR)


def fill_table(table, rows):
    """rows exclude the header. Adds rows (copies of the last row) as needed."""
    body = table.rows[1:]
    while len(body) < len(rows):
        table._tbl.append(copy.deepcopy(table.rows[-1]._tr))
        body = table.rows[1:]
    for extra in body[len(rows):]:
        table._tbl.remove(extra._tr)
    for row, values in zip(table.rows[1:], rows):
        for cell, value in zip(row.cells, values):
            set_cell(cell, value)


def clone_table(template_table, anchor_el, header, rows):
    new = copy.deepcopy(template_table._tbl)
    anchor_el.addnext(new)
    t = docx.table.Table(new, template_table._parent)
    for cell, value in zip(t.rows[0].cells, header):
        set_cell(cell, f'**{value}**' if first_rpr(cell.paragraphs[0]._p) is None else value)
    fill_table(t, rows)
    return new


def check(p, label):
    """Turn a ☐ checklist line into ☑, optionally with a note."""
    for t in p._p.iter(qn('w:t')):
        if '☐' in (t.text or ''):
            t.text = t.text.replace('☐', '☑', 1)
            break


def annotate(p, note):
    # Take the formatting of the last run: the first one is the ☐ symbol, set larger.
    runs = p._p.findall(qn('w:r'))
    rpr = runs[-1].find(qn('w:rPr')) if runs else None
    r = p._p.makeelement(qn('w:r'), {})
    if rpr is not None:
        r.append(copy.deepcopy(rpr))
    t = r.makeelement(qn('w:t'), {qn('xml:space'): 'preserve'})
    t.text = note
    r.append(t)
    p._p.append(r)


# ---------------------------------------------------------------- build
def main(handout):
    global BODY_P, CELL_RPR
    doc = docx.Document(handout)
    P = doc.paragraphs
    T = doc.tables
    width = doc.sections[0].page_width - doc.sections[0].left_margin - doc.sections[0].right_margin

    BODY_P = P[11]._p          # plain body paragraph
    LIST_P = P[26]._p          # bulleted list item
    H1, H2 = P[23]._p, P[25]._p
    CELL_RPR = first_rpr(T[3].rows[1].cells[2].paragraphs[0]._p)

    # Keep handles before inserting anything (indices shift afterwards).
    p_title, p_checks = P[5], [P[15], P[16], P[17], P[18]]
    p_discuss_anchor, p_justif = P[28], P[32]
    p_step2_anchor, p_step3_anchor, p_step6_anchor = P[40], P[50], P[80]
    p_seq, p_seq2 = P[62], P[63]
    checkpoints = [P[33], P[43], P[53], P[64]]
    final_checks, p_section4 = P[86:94], P[85]

    ws_intro = WORKSHEET.split('\n---\n')[0]

    # Team block under the title
    a = add_after(p_title._p, BODY_P, '**Team:** Hamza Ben Labiedh, Ali Chamakh, Mohamed Krid · **Project:** FoodGO — pre-order lunch for Lac 3 / Zone Industrielle Le Kram · **Filled in:** 1 Nov 2026')
    a = add_after(a, BODY_P, paragraph_after(ws_intro, '**How we did this session.**'))
    add_after(a, BODY_P, paragraph_after(ws_intro, '> **Honest notes.**').lstrip('> '))

    notes = ['Lab 3 specification: docs/lab3-specification', 'Lab 4 SDD §2.1 and §7.1 reused', 'Mermaid (sources in docs/uml)', 'Node.js 22 + Express + SQLite (ADR-0002)']
    for p, n in zip(p_checks, notes):
        check(p, None)
        annotate(p, f' — {n}')

    # Step 1
    s1 = section(WORKSHEET, 'Step 1')
    add_after(p_discuss_anchor._p, BODY_P, paragraph_after(s1, '**Team discussion.**'))
    fill_table(T[5], tables_in(s1)[0][1:])
    set_runs(p_justif._p, paragraph_after(s1, '**Justification.**'), first_rpr(p_justif._p))

    # Step 2
    s2 = section(WORKSHEET, 'Step 2')
    img = landscape_image(doc, p_step2_anchor._p, UML / 'component-deployment.png', '**Figure 1 — Component and deployment diagram** (source: docs/uml/component-deployment.mmd). Revised after the peer review: Platform Administration and four missing dependencies added.')
    add_after(img, BODY_P, paragraph_after(s2, 'External systems'))
    fill_table(T[6], tables_in(s2)[0][1:])

    # Step 3
    s3 = section(WORKSHEET, 'Step 3')
    landscape_image(doc, p_step3_anchor._p, UML / 'class-diagram.png', '**Figure 2 — Class diagram** (source: docs/uml/class-diagram.mmd). Revised after the peer review: control classes carry the behaviour; forecast classes added; attributes synced with the schema.')
    fill_table(T[7], tables_in(s3)[0][1:])
    cohesion = [l[2:] for l in s3.splitlines() if l.startswith('- **')]
    anchor = add_after(T[7]._tbl, BODY_P, '**Cohesion check (two classes for the instructor).**')
    for line in cohesion:
        anchor = add_after(anchor, LIST_P, line)

    # Step 4 — two sequences in the template's own format
    s4 = section(WORKSHEET, 'Step 4')
    uc1 = section(s4, 'UC-01')
    uc2 = section(s4, 'UC-02')
    seq_rpr = first_rpr(p_seq._p)

    def write_sequence(head_p, title, block, image):
        actors = paragraph_after(block, '**Actors/objects:**').replace('**Actors/objects:**', '').strip()
        lines = [f'**Sequence for Use Case:** {title}', f'**Actors/Objects involved:** {actors}']
        lines += [f'{i}. {step}' for i, step in enumerate(numbered(block), 1)]
        # One box, with line breaks, exactly like the handout's template.
        set_runs(head_p, '\n'.join(lines), seq_rpr)
        return add_image_after(doc, head_p, UML / image, width)

    end1 = write_sequence(p_seq._p, 'UC-01 — Place a morning pre-order (US-11, FR-09–FR-14, BR-01, BR-17)', uc1, 'sequence-uc01-place-order.png')
    # The handout's "copy this template a second time" line becomes the second sequence.
    second_head = copy.deepcopy(p_seq._p)
    end1.addnext(second_head)
    p_seq2._p.getparent().remove(p_seq2._p)
    end2 = write_sequence(second_head, 'UC-02 — Assign a delivery person and complete the delivery (US-16, US-18, FR-19–FR-23, BR-10, BR-11)', uc2, 'sequence-uc02-assign-deliver.png')
    add_after(end2, BODY_P, clean(paragraph_after(s4, '**Extra, added after the peer review:**')) + ' (docs/uml/sequence-uc15-forecast.png)')

    # Step 5
    s5 = section(WORKSHEET, 'Step 5')
    fill_table(T[8], tables_in(s5)[0][1:])
    add_after(T[8]._tbl, BODY_P, paragraph_after(s5, 'Patterns deliberately'))

    # Step 6
    s6 = section(WORKSHEET, 'Step 6')
    add_after(p_step6_anchor._p, BODY_P, paragraph_after(s6, '**Reviewing team.**'))
    fill_table(T[9], tables_in(s6)[0][1:])
    anchor = add_after(T[9]._tbl, BODY_P, paragraph_after(s6, '**What the reviewer said'))
    add_after(anchor, BODY_P, '**SDD skeleton:** Sections 1–2 are at the end of this document (also docs/lab5-design/SDD_SKELETON_SECTIONS_1-2.md).')

    for p in checkpoints:
        annotate(p, ' — to be signed by the instructor in class')

    # End-of-session checklist: the first seven are done, sign-off is not.
    for p in final_checks[:7]:
        check(p, None)
    annotate(final_checks[5], ' (independent AI reviewer; a peer team\'s review still to add)')
    annotate(final_checks[7], ' — not yet obtained')

    # SDD skeleton, inserted before "4. End-of-Session Submission Checklist"
    anchor = p_section4._p.getprevious()
    br = copy.deepcopy(BODY_P)
    for r in br.findall(qn('w:r')):
        br.remove(r)
    r = br.makeelement(qn('w:r'), {})
    r.append(r.makeelement(qn('w:br'), {qn('w:type'): 'page'}))
    br.append(r)
    anchor.addnext(br)
    anchor = add_after(br, H1, 'Draft SDD skeleton — Sections 1–2 (Step 6)')
    anchor = add_after(anchor, BODY_P, paragraph_after(SDD, '**Lab 5, Step 6 deliverable.**'))

    sdd_body = '\n'.join(SDD.split('\n---\n')[1:])
    two_col, four_col = T[0], T[7]   # Field/Details (1:2 widths) and the class table
    for block in re.split(r'\n(?=#{2,3} )', sdd_body):
        lines = block.strip().splitlines()
        if not lines or not lines[0].startswith('#'):
            continue
        level = len(lines[0].split(' ')[0])
        title = lines[0].lstrip('#').strip()
        anchor = add_after(anchor, H1 if level == 2 else H2, title)
        body = '\n'.join(lines[1:])
        tables = tables_in(body)
        if tables:
            t = tables[0]
            template = two_col if len(t[0]) == 2 else four_col
            anchor = clone_table(template, anchor, t[0], t[1:])
            body = '\n'.join(l for l in body.splitlines() if not l.startswith('|'))
        for para in [b.strip() for b in body.split('\n\n') if b.strip()]:
            if para.startswith('!['):
                anchor = add_after(anchor, BODY_P, 'Component diagram: see Step 2 above (docs/uml/component-deployment.png).')
                continue
            if para.startswith('Source:'):
                continue
            items = [l for l in para.splitlines() if re.match(r'^(- |\d+\. )', l)]
            lead = [l for l in para.splitlines() if not re.match(r'^(- |\d+\. )', l)]
            if lead:
                anchor = add_after(anchor, BODY_P, ' '.join(lead))
            for it in items:
                anchor = add_after(anchor, LIST_P, re.sub(r'^(- |\d+\. )', '', it))

    doc.save(OUT)
    print(f'written {OUT.relative_to(HERE.parent.parent)}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
