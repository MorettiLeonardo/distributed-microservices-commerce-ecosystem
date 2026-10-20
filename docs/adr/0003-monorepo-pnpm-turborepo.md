# 0003 — Monorepo com pnpm + Turborepo

- **Status:** accepted
- **Data:** 2026-10-19

## Contexto e problema

Vários serviços, Lambdas e pacotes compartilhados (contratos de eventos, logger, config) precisam evoluir juntos num projeto solo.

## Opções consideradas

- pnpm workspaces + Turborepo
- Nx
- Multi-repo (um repositório por serviço)

## Decisão

Monorepo com **pnpm workspaces + Turborepo**, organizado em `apps/`, `functions/`, `packages/`, `infra/` e `docs/`.

## Consequências

- **+** Mudança de contrato e consumidores no mesmo PR; build/test incremental com cache.
- **+** Um único repositório para mostrar no portfólio.
- **−** Risco de acoplamento por conveniência (importar código de outro serviço). Mitigação: `packages/` só contém contratos e infra transversal, nunca regra de negócio; serviços nunca importam uns aos outros.
- **−** Menos realista que multi-repo quanto a deploy independente; compensado com pipelines e imagens por serviço.
