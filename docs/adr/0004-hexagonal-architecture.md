# 0004 — Hexagonal architecture in every service

- **Status:** accepted
- **Date:** 2026-10-19

## Context and problem

The same use case may be triggered by HTTP, an SQS message or a Lambda, and may persist/publish through different technologies (Postgres, Redis, SNS, EventBridge). The domain must not depend on those details.

## Considered options

- Hexagonal (Ports & Adapters)
- Clean Architecture
- Vertical Slice
- Simple layers (controller → service → repository)

## Decision

**Hexagonal.** Each service has `domain/`, `application/` (use cases + ports), `adapters/in/`, `adapters/out/` and a composition root (`main.ts`) with manual DI. Dependencies always point inward.

## Consequences

- **+** Domain testable without I/O; swapping SQS for EventBridge or Express for a Lambda handler only touches adapters.
- **+** Makes inbound and outbound ports explicit — the foundation for reasoning about sync vs async.
- **−** More files and mappings (DTO ↔ domain ↔ model).
- **−** Manual DI requires discipline in `main.ts`.
