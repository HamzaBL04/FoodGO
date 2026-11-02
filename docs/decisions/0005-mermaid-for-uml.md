# 5. Mermaid instead of PlantUML for UML diagrams

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The midterm instructions require UML diagrams as images *and* source text, naming PlantUML or Mermaid. PlantUML needs Java and a renderer (or a server); in our environment the PlantUML jar could not be run. Mermaid renders natively on GitHub (README, `docs/architecture.md`) and with the `mmdc` CLI.

## Decision

All diagrams are Mermaid sources in `docs/uml/*.mmd`, rendered to PNG with `mmdc`, and Mermaid blocks are embedded directly in Markdown where useful.

## Consequences

- Diagrams render on GitHub without any tool; anyone can edit them as text in a PR.
- Mermaid has no native use-case diagram type: actors and use cases are drawn with flowchart shapes inside a system boundary, which is labelled as such.
- If a grader requires PlantUML specifically, the sources must be translated (a small, mechanical job).
