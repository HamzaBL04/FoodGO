# FoodGO documentation index

Mapped to the CS 488 midterm instructions (submission checklist §5 and rubric §6).

| Course requirement | Where |
|---|---|
| Git repo with commit / PR history | https://github.com/HamzaBL04/foodGO (feature branches merged through pull requests) |
| **Project proposal PDF** (user stories, acceptance criteria, methodology) | [proposal/PROJECT_PROPOSAL.pdf](proposal/PROJECT_PROPOSAL.pdf) · [source](proposal/PROJECT_PROPOSAL.md) |
| **Backlog** (prioritised, MoSCoW, story points) + **NFRs** + AI elicitation prompt | [requirements/BACKLOG.md](requirements/BACKLOG.md) · [PDF](requirements/BACKLOG.pdf) |
| Requirements traceability | [requirements/TRACEABILITY.md](requirements/TRACEABILITY.md) (generated: `npm run traceability`) |
| Lab 3 — Software specification | [lab3-specification/](lab3-specification/) |
| Lab 4 — Software Design Document (architecture rationale) | [lab4-sdd/FoodGO_Software_Design_Document.pdf](lab4-sdd/FoodGO_Software_Design_Document.pdf) |
| **UML**: use-case, class, sequence ×3, component/deployment — images + Mermaid source | [uml/](uml/README.md) |
| **Working code with tests and CI** | [`src/`](../src), [`test/`](../test), [CI workflow](../.github/workflows/ci.yml) |
| Coding style guide | [STYLE_GUIDE.md](STYLE_GUIDE.md), [eslint.config.js](../eslint.config.js) |
| **Refactor & optimisation report** with metrics | [REFACTOR_AND_OPTIMIZATION_REPORT.md](REFACTOR_AND_OPTIMIZATION_REPORT.md) |
| **README** (purpose, run, system diagram, credentials) | [../README.md](../README.md) |
| **API docs** (OpenAPI) | [api/openapi.yaml](api/openapi.yaml), served at `/api/docs` |
| **Developer docs** (architecture, setup, style, contribution, CI, deployment) | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) |
| **User guide** | [USER_GUIDE.md](USER_GUIDE.md) |
| **AI usage log** (tools, prompts, direct outputs flagged) | [ai/AI_USAGE_LOG.md](ai/AI_USAGE_LOG.md) |
| **Ethics & AI usage reflection** | [ai/ETHICS_AND_AI_REFLECTION.md](ai/ETHICS_AND_AI_REFLECTION.md) |
| **Signed academic honesty statement** | [ACADEMIC_HONESTY_STATEMENT.md](ACADEMIC_HONESTY_STATEMENT.md) — with a who-did-what table; each member signs |
| **Recorded demo** | [demo/foodgo-demo.mp4](../demo/foodgo-demo.mp4) (2 min, captioned) · [storyboard and re-recording](../demo/README.md) |
| Final presentation slides | Final submission (not part of the midterm progress milestone) |

## Lab 6 — implementation environment

| Lab 6 checklist item | Where |
|---|---|
| Repo set up from the CS 488 starter template | Template adopted into the existing repo: [decisions/0003](decisions/0003-adopt-starter-template-in-existing-repo.md) |
| `scripts/setup.sh`, `.env.example`, `.env` ignored | [../scripts/setup.sh](../scripts/setup.sh), [../.env.example](../.env.example), [../.gitignore](../.gitignore) |
| `AI_CONTEXT.md` + per-tool configs | [../AI_CONTEXT.md](../AI_CONTEXT.md), [../CLAUDE.md](../CLAUDE.md), [../.github/copilot-instructions.md](../.github/copilot-instructions.md), [../.cursor/rules/project.mdc](../.cursor/rules/project.mdc) |
| README header + generated structure tree | [../README.md](../README.md#project-structure) (`./scripts/update-structure.sh`) |
| Architecture with diagrams | [architecture.md](architecture.md) |
| ADRs beyond the first | [decisions/](decisions/) (0002–0006) |
| Team workflow, PR and issue templates | [../CONTRIBUTING.md](../CONTRIBUTING.md), [../.github/](../.github/) |
| Living docs | [CHANGELOG.md](CHANGELOG.md), [setup.md](setup.md), docs reminder hook + CI job |
| **Setup Report** | [setup-report.md](setup-report.md) |
