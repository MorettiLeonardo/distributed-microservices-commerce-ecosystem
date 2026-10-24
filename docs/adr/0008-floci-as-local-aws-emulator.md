# 0008 — Floci as the local AWS emulator

- **Status:** accepted (supersedes the LocalStack part of 0005)
- **Date:** 2026-10-24

## Context and problem

ADR 0005 chose LocalStack to emulate AWS locally. Since 2026 the LocalStack Community image requires an account and an auth token (`LOCALSTACK_AUTH_TOKEN`), which adds friction for anyone cloning the repository. Nothing in the codebase talks to AWS yet, so switching now is cheap.

## Considered options

- **LocalStack** (keep): most widely known; requires sign-up and auth token; ~1 GB image.
- **Floci**: MIT-licensed, no account or token, ~90 MB image, same port (4566) and LocalStack-compatible endpoints; younger project, so parity with AWS must be verified per service.
- **Moto server**: mature, but mainly a mocking library; no real Lambda execution.

For the web console:

- **Floci UI as its own Compose service**: declarative, managed by `infra:up/down/reset`.
- **Floci UI as a sidecar** started by Floci through the Docker socket: zero config, but the container lives outside Compose and is not removed by `infra:down`.

For emulator state:

- **In memory**: every restart starts empty; Terraform recreates everything.
- **Persistent volume**: resources and messages survive restarts.

## Decision

- **Floci** (`floci/floci`, pinned version) replaces LocalStack in `infra/docker/compose.yaml`.
- **Floci UI** (`floci/floci-ui`, pinned version) runs as its **own Compose service** on port 4500; the built-in sidecar is disabled (`FLOCI_SERVICES_UI_ENABLED=false`).
- **Persistent storage** (`FLOCI_STORAGE_MODE=persistent`) in the `floci-data` volume.
- **Terraform** is used directly with an explicit `endpoints` block in the AWS provider (instead of `tflocal`, which is a LocalStack tool).

## Consequences

- **+** No account or secret needed to run the project locally.
- **+** Much smaller image and faster startup.
- **+** A visual console to inspect queues, topics, functions and other resources.
- **+** Explicit `endpoints` make visible what `tflocal` used to hide.
- **−** Younger project: AWS parity must be checked for each service we adopt.
- **−** Persistent state can drift from Terraform (e.g. resources created by hand). `pnpm infra:reset` wipes it; Terraform recreates the resources.
- **−** The Floci image has no `curl`; its health check relies on the bundled `/usr/local/bin/healthcheck.sh`.
