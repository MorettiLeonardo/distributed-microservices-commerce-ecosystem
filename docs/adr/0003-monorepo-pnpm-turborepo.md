# 0003 — Monorepo with pnpm + Turborepo

- **Status:** accepted
- **Date:** 2026-10-19

## Context and problem

Several services, Lambdas and shared packages (event contracts, logger, config) must evolve together in a solo project.

## Considered options

- pnpm workspaces + Turborepo
- Nx
- Multi-repo (one repository per service)

## Decision

Monorepo with **pnpm workspaces + Turborepo**, organized into `apps/`, `functions/`, `packages/`, `infra/` and `docs/`.

## Consequences

- **+** Contract changes and their consumers land in the same PR; incremental build/test with caching.
- **+** A single repository to showcase in a portfolio.
- **−** Risk of coupling by convenience (importing another service's code). Mitigation: `packages/` only holds contracts and cross-cutting infrastructure, never business logic; services never import each other.
- **−** Less realistic than multi-repo regarding independent deployment; offset by per-service pipelines and images.
