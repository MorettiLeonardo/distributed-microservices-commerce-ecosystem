# 0001 — Record architecture decisions

- **Status:** accepted
- **Date:** 2026-10-19

## Context and problem

This project is a microservices lab for learning and portfolio purposes. Its value lies both in the code and in **why** each choice was made. Without a record, the trade-offs considered get lost.

## Decision

Record every relevant architectural decision as an ADR in [MADR](https://adr.github.io/madr/) format under `docs/adr/NNNN-title.md`.

- Accepted ADRs are immutable.
- A changed decision ⇒ new ADR with status `supersedes NNNN`; the old one becomes `superseded by NNNN`.

## Consequences

- **+** Explicit history of trade-offs, useful in interviews and reviews.
- **+** Forces alternatives to be considered before implementing.
- **−** Writing cost per decision.
