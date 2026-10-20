# 0001 — Registrar decisões arquiteturais

- **Status:** accepted
- **Data:** 2026-10-19

## Contexto e problema

Este projeto é um laboratório de microsserviços para aprendizado e portfólio. O valor está tanto no código quanto no **porquê** de cada escolha. Sem registro, os trade-offs considerados se perdem.

## Decisão

Registrar toda decisão arquitetural relevante como ADR no formato [MADR](https://adr.github.io/madr/), em `docs/adr/NNNN-titulo.md`.

- ADRs aceitos são imutáveis.
- Mudança de decisão ⇒ novo ADR com status `supersedes NNNN`; o antigo passa a `superseded by NNNN`.

## Consequências

- **+** Histórico explícito de trade-offs, útil em entrevistas e revisões.
- **+** Força pensar nas alternativas antes de implementar.
- **−** Custo de escrita por decisão.
