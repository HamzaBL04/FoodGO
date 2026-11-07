#!/usr/bin/env python3
"""Assembles ACTIVITY1_PROMPT_ENGINEERING.md from the raw prompt outputs in raw/."""
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / 'raw'
IDEA = ('FoodGO — a web app where employees in the Lac 3 / Zone Industrielle Le Kram area of Tunis pre-order lunch '
        'from local restaurants before a morning deadline; each restaurant delivers with its own staff at noon, to reduce '
        'lunchtime traffic in the area. Payment is cash on delivery or Tunisian e-payment.')

PARTS = [
    ('Part 1 — Stakeholder Identification', 'Providing Concept (Explain-then-Ask)', 'Stakeholders',
     f'List the stakeholders for this project: {IDEA}',
     f'In software engineering, stakeholders are people or groups affected by the project, including end-users, customers, maintainers, regulators, and others. Based on this definition, list all potential stakeholders for this project: {IDEA}',
     '1A', '1B', 'C1'),
    ('Part 2 — Functional Requirements', 'One-Shot Prompting', 'Functional Requirements',
     f'Generate 10 functional requirements for this project: {IDEA}',
     f'Here is the style I want: Example: REQ-001: The system must allow users to register via email and password. Priority: High. Rationale: Required for authentication. Now generate 10 functional requirements in this format for this project: {IDEA}',
     '2A', '2B', 'C2'),
    ('Part 3 — Non-Functional Requirements', 'Few-Shot Prompting', 'Non-Functional Requirements',
     f'List 10 non-functional requirements for this project: {IDEA}',
     f'Here are examples of good non-functional requirements: Performance: The system must respond to user clicks within 2 seconds. Usability: The app must achieve a System Usability Scale score of at least 75. Reliability: The system must have 99.9% uptime over a 30-day period. Based on these examples, write 10 non-functional requirements for this project: {IDEA}',
     '3A', '3B', 'C3'),
    ('Part 4 — User Stories & Acceptance Criteria', 'Prompt Chaining', 'User Stories',
     f'Create user stories with acceptance criteria for this project: {IDEA}',
     'Prompt 1: "Generate 6 user stories for these functional requirements: [the Part 2 one-shot output, REQ-001 to REQ-010]." Prompt 2 (same conversation): "For each user story, write 3 acceptance criteria using Given/When/Then format."',
     '4A', '4B', 'C4'),
    ('Part 5 — Quality Review & Refinement', 'Self-Critique Prompting', 'Quality-checked Requirements',
     'Review my requirements and make them better. [pasted: the Part 2 one-shot FRs + Part 3 few-shot NFRs + Part 4 chained user stories]',
     'Here is my full requirements draft (functional + non-functional + user stories): [pasted, same draft]. 1. List which ones are vague or ambiguous, 2. Rewrite them to be specific, measurable, and testable, 3. Then explain how your changes improve quality.',
     '5A', '5B', 'C5'),
]


def demote(md):
    """Keep the AI's own headings below our section headings."""
    out = []
    for line in md.strip().splitlines():
        if line.startswith('#'):
            line = '#####' + line.lstrip('#')
        out.append(line)
    return '\n'.join(out)


def main():
    parts = [(HERE / 'intro.md').read_text(encoding='utf-8').strip()]
    for title, technique, srs, pa, pb, a, b, c in PARTS:
        parts.append(f'## {title}\n\n**Technique:** {technique} · **SRS section:** {srs}')
        parts.append(f'### Step A — Normal prompt\n\n> {pa}\n\n**Output A:**\n\n{demote((RAW / f"{a}.md").read_text(encoding="utf-8"))}')
        parts.append(f'### Step B — {technique}\n\n> {pb}\n\n**Output B:**\n\n{demote((RAW / f"{b}.md").read_text(encoding="utf-8"))}')
        parts.append(f'### Comparison\n\n{(RAW / f"{c}.md").read_text(encoding="utf-8").strip()}')
    parts.append((HERE / 'conclusion.md').read_text(encoding='utf-8').strip())
    (HERE / 'ACTIVITY1_PROMPT_ENGINEERING.md').write_text('\n\n---\n\n'.join(parts) + '\n', encoding='utf-8')
    print('written ACTIVITY1_PROMPT_ENGINEERING.md')


if __name__ == '__main__':
    main()
