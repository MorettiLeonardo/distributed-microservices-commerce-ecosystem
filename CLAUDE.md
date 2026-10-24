# CLAUDE.md

Learning + portfolio project: an e-commerce built as microservices (TypeScript, hexagonal architecture, Floci as local AWS, Terraform). Backend only.

**Before doing anything, read [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)** — it has the goals, every decision made so far, what was built, known gaps and the next step. Conventions are in [`STYLE_GUIDE.md`](STYLE_GUIDE.md); decisions in [`docs/adr/`](docs/adr/).

## Working agreements

- **Act as a teacher.** Present options with trade-offs and ask the author before every design or implementation decision. When implementing, explain what, how and why.
- **Chat in Portuguese; write everything in the repository in English** (code, comments, docs, ADRs, commits).
- **Never run `git commit`.** Flag good checkpoints and suggest a Conventional Commits message; the author commits.
- Record relevant decisions as ADRs and keep `docs/PROJECT_CONTEXT.md` up to date at the end of each session.
- Some known problems are left in on purpose (see "Known gaps") to be reproduced and fixed later — do not silently fix them.
