# 0004 — Arquitetura hexagonal em cada serviço

- **Status:** accepted
- **Data:** 2026-10-19

## Contexto e problema

O mesmo caso de uso pode ser disparado por HTTP, por uma mensagem SQS ou por uma Lambda, e persistir/publicar em tecnologias diferentes (Postgres, Redis, SNS, EventBridge). O domínio não deve depender desses detalhes.

## Opções consideradas

- Hexagonal (Ports & Adapters)
- Clean Architecture
- Vertical Slice
- Camadas simples (controller → service → repository)

## Decisão

**Hexagonal.** Cada serviço tem `domain/`, `application/` (use cases + ports), `adapters/in/`, `adapters/out/` e um composition root (`main.ts`) com DI manual. Dependências apontam sempre para dentro.

## Consequências

- **+** Domínio testável sem I/O; trocar SQS por EventBridge ou Express por handler de Lambda afeta só adapters.
- **+** Deixa explícito o que é porta de entrada e de saída — base para entender sync vs async.
- **−** Mais arquivos e mapeamentos (DTO ↔ domínio ↔ model).
- **−** DI manual exige disciplina no `main.ts`.
