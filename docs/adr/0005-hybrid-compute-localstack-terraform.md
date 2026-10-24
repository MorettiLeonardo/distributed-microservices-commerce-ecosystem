# 0005 — Hybrid compute, LocalStack and Terraform

- **Status:** accepted; LocalStack and `tflocal` superseded by [0008](0008-floci-as-local-aws-emulator.md)
- **Date:** 2026-10-19

## Context and problem

We want to practice AWS (SQS, SNS, EventBridge, S3, Lambda, Step Functions, etc.) at no cost, and understand when to use a container versus a function.

## Considered options

- **Compute:** hybrid; containers only; serverless only
- **IaC:** Terraform, AWS CDK, `awslocal` scripts

## Decision

- **Hybrid compute:** stateful core services with steady traffic (e.g. Orders, Catalog, Inventory) run in containers; event-reactive workers (notifications, S3 image processing, reports) run in Lambda.
- **Local AWS via LocalStack**, running in Docker Compose alongside Postgres and Redis.
- **Terraform** (via `tflocal`) to provision every AWS resource declaratively.

## Consequences

- **+** Explores the container × serverless trade-off (cold start, database connections, cost, scaling).
- **+** Terraform is the most transferable IaC skill; the same code could target a real account.
- **−** LocalStack does not reproduce 100% of AWS behavior (IAM, limits, some services are paid-tier only).
- **−** Two ways of packaging/running code to maintain.
