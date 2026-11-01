#!/usr/bin/env python3
"""
Builds docs/lab2-srs/FoodGO_SRS.md from its sources, so the SRS never drifts
from the other requirement artifacts:

  srs_template.md                         prose of Sections 1-3, 6.2, 7
  ../lab3-practical/SRS_SKELETON.md       Sections 4 and 5 (reviewed requirements)
  ../lab3-practical/LAB3_REQUIREMENTS_WORKSHEET.md
                                          use cases, stakeholders, analysis table, review log
  ../requirements/TRACEABILITY.md         test case per requirement (run `npm run traceability` first)

Usage: python3 docs/lab2-srs/build_srs.py   (then: node scripts/md-to-pdf.js docs/lab2-srs/FoodGO_SRS.md)
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent
TEMPLATE = (HERE / 'srs_template.md').read_text(encoding='utf-8')
SKELETON = (DOCS / 'lab3-practical' / 'SRS_SKELETON.md').read_text(encoding='utf-8')
WORKSHEET = (DOCS / 'lab3-practical' / 'LAB3_REQUIREMENTS_WORKSHEET.md').read_text(encoding='utf-8')
TRACE = (DOCS / 'requirements' / 'TRACEABILITY.md').read_text(encoding='utf-8')


def block(md, heading, level):
    """Body under a heading of the given level, up to the next heading of that level or higher."""
    m = re.search(rf'^{"#" * level} {re.escape(heading)}.*$', md, re.M)
    if not m:
        raise SystemExit(f'heading not found: {heading}')
    rest = md[m.end():]
    nxt = re.search(rf'^#{{1,{level}}} ', rest, re.M)
    return (rest[: nxt.start()] if nxt else rest).strip()


def first_table(text):
    lines, out, started = text.splitlines(), [], False
    for line in lines:
        if line.startswith('|'):
            out.append(line)
            started = True
        elif started:
            break
    return '\n'.join(out)


def strip_marks(text):
    """Revision marks belong to the review history, not to the final SRS."""
    text = text.replace('**(new, Proposed)**', '**Proposed:**')
    return re.sub(r'\*\*\((?:rev\.|new(?:, [^)]*)?)\)\*\* ?', '', text)


def table_rows(table):
    rows = [[c.strip() for c in l.strip().strip('|').split('|')] for l in table.splitlines()]
    return rows[0], [r for r in rows[2:]]


def md_table(header, rows):
    out = ['| ' + ' | '.join(header) + ' |', '|' + '---|' * len(header)]
    out += ['| ' + ' | '.join(r) + ' |' for r in rows]
    return '\n'.join(out)


# ---------------------------------------------------------------- Section 4
def functional():
    body = block(SKELETON, '4. Functional requirements', 2)
    body = re.sub(r'^Identifiers are kept.*$', 'Grouped by area. Identifiers follow the specification; FR-31, FR-32, BR-17 and BR-18 were added by team decision.', body, flags=re.M)
    return strip_marks(body)


# ---------------------------------------------------------------- Section 5
GROUPS = [
    ('5.1 Performance', {'Performance'}),
    ('5.2 Security', {'Security', 'Privacy'}),
    ('5.3 Usability', {'Usability', 'Accessibility'}),
    ('5.4 Reliability', {'Reliability', 'Availability'}),
]


def non_functional():
    body = block(SKELETON, '5. Non-functional requirements', 2)
    header, rows = table_rows(first_table(body))
    used, parts = set(), ['Targets are the specification\'s Proposed targets unless stated otherwise.']
    for title, cats in GROUPS + [('5.5 Other quality attributes', None)]:
        sel = [r for r in rows if (r[1] in cats if cats else r[0] not in used)]
        used.update(r[0] for r in sel)
        parts.append(f'### {title}\n\n' + strip_marks(md_table(header, sel)))
    return '\n\n'.join(parts)


# ---------------------------------------------------------------- Section 6
SOURCE = {}
for i in range(1, 31):
    SOURCE[f'FR-{i:02d}'] = 'Elicitation document'
for i in range(1, 17):
    SOURCE[f'BR-{i:02d}'] = 'Elicitation document'
SOURCE.update({
    'FR-01': 'Elicitation document (restaurant manager, customer)', 'FR-05': 'Elicitation document (customer)',
    'FR-12': 'Elicitation document (restaurant owner)', 'FR-13': 'Elicitation document (restaurant owner)',
    'FR-19': 'Elicitation document (restaurant staff)', 'FR-21': 'Elicitation document (delivery person); MVP walkthrough',
    'FR-24': 'Elicitation document (customer); MVP walkthrough', 'FR-27': 'Elicitation document (payment provider)',
    'FR-29': 'Elicitation document (platform administrator)',
    'FR-31': 'Team decision, ADR-0004 (restaurant staff)',
    'FR-32': 'Product-owner interview 1 Nov, ADR-0007',
    'BR-17': 'Product-owner interview 1 Nov, ADR-0007', 'BR-18': 'Product-owner interview 1 Nov, ADR-0007',
})

USE_CASE = {
    **{f'FR-{i:02d}': 'UC-04' for i in range(1, 5)}, 'FR-05': 'UC-05', 'FR-06': 'UC-06', 'FR-07': 'UC-07', 'FR-08': 'UC-07',
    **{f'FR-{i:02d}': 'UC-01' for i in range(9, 16)}, 'FR-16': 'UC-08', 'FR-17': 'UC-08', 'FR-18': 'UC-09',
    'FR-19': 'UC-02', 'FR-20': 'UC-10', 'FR-21': 'UC-10', 'FR-22': 'UC-11', 'FR-23': 'UC-02', 'FR-24': 'UC-12',
    'FR-25': 'UC-13', 'FR-26': 'UC-13, UC-03', 'FR-27': 'UC-03', 'FR-28': 'UC-03', 'FR-29': 'UC-14', 'FR-30': 'UC-14',
    'FR-31': 'UC-15', 'FR-32': 'UC-01, UC-04',
    'BR-01': 'UC-01', 'BR-02': 'UC-01', 'BR-03': 'UC-07', 'BR-04': 'UC-05, UC-08', 'BR-05': 'UC-04', 'BR-06': 'UC-09',
    'BR-07': '—', 'BR-08': 'UC-10', 'BR-09': 'all restaurant UCs', 'BR-10': 'UC-02', 'BR-11': 'UC-02', 'BR-12': 'UC-03',
    'BR-13': 'UC-03', 'BR-14': 'UC-01, UC-02', 'BR-15': 'UC-08, UC-10, UC-12', 'BR-16': 'UC-04, UC-05',
    'BR-17': 'UC-01', 'BR-18': 'UC-14',
}


def tests_by_id():
    out = {}
    for line in TRACE.splitlines():
        m = re.match(r'^\| ((?:FR|BR)-\d{2}) \|', line)
        if m:
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            titles = re.findall(r'“([^”]+)”', cells[4])
            out[m.group(1)] = titles[0] if titles else '—'
    return out


def rtm():
    tests = tests_by_id()
    ids = [f'FR-{i:02d}' for i in range(1, 33)] + [f'BR-{i:02d}' for i in range(1, 19)]
    rows = [[i, SOURCE[i], USE_CASE[i], tests.get(i, '—')] for i in ids]
    nfr_header, nfr_rows = table_rows(first_table(block(SKELETON, '5. Non-functional requirements', 2)))
    for r in nfr_rows:
        rows.append([r[0], 'Specification §7 (quality)' if r[0] not in ('NFR-13', 'NFR-14', 'NFR-15') else 'Lab 2/3 validation', '—', r[4]])
    return md_table(['Requirement ID', 'Source (stakeholder / interview)', 'Use case', 'Test case'], rows)


# ---------------------------------------------------------------- copied from the Lab 3 worksheet
def use_cases():
    step4 = block(WORKSHEET, 'Step 4 — Use cases', 2)
    ucs = re.split(r'^### ', step4, flags=re.M)[1:]
    return '\n\n'.join('#### ' + u.strip().split('☐')[0].strip() for u in ucs)


def review():
    step5 = block(WORKSHEET, 'Step 5 — Peer review & validation', 2)
    lead = 'Reviewed against the Lab 2/3 validation checklist. No other team was available for the swap, so an independent AI reviewer (a fresh Claude agent that knew nothing about the project) did the review; every issue was checked against the documents before it was accepted. A peer team\'s review is still to be added in class.'
    return lead + '\n\n' + strip_marks(first_table(step5))


def stakeholders():
    return first_table(block(WORKSHEET, 'Stakeholder list', 3))


def analysis():
    return first_table(block(WORKSHEET, 'Step 2 — Analyze & classify', 2))


def main():
    out = TEMPLATE
    for key, fn in [('USE_CASES', use_cases), ('FUNCTIONAL', functional), ('NON_FUNCTIONAL', non_functional),
                    ('RTM', rtm), ('REVIEW', review), ('STAKEHOLDERS', stakeholders), ('ANALYSIS', analysis)]:
        out = out.replace('{{' + key + '}}', fn())
    assert '{{' not in out, 'unfilled placeholder'
    target = HERE / 'FoodGO_SRS.md'
    target.write_text(out, encoding='utf-8')
    print(f'written {target.relative_to(DOCS.parent)}')


if __name__ == '__main__':
    main()
