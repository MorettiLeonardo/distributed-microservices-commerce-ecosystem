# 0005 — Compute híbrido, LocalStack e Terraform

- **Status:** accepted
- **Data:** 2026-10-19

## Contexto e problema

Queremos praticar AWS (SQS, SNS, EventBridge, S3, Lambda, Step Functions, etc.) sem custo, e entender quando usar container e quando usar função.

## Opções consideradas

- **Compute:** híbrido; tudo em containers; tudo serverless
- **IaC:** Terraform, AWS CDK, scripts `awslocal`

## Decisão

- **Compute híbrido:** serviços core com estado e tráfego contínuo (ex.: Orders, Catalog, Inventory) rodam em containers; workers reativos a eventos (notificações, processamento de imagens no S3, relatórios) rodam em Lambda.
- **AWS local via LocalStack**, rodando no Docker Compose junto com Postgres e Redis.
- **Terraform** (via `tflocal`) para provisionar todos os recursos AWS de forma declarativa.

## Consequências

- **+** Explora o trade-off container × serverless (cold start, conexões com banco, custo, escala).
- **+** Terraform é a skill de IaC mais transferível; o mesmo código poderia apontar para uma conta real.
- **−** LocalStack não reproduz 100% do comportamento da AWS (IAM, limites, alguns serviços são pagos).
- **−** Duas formas de empacotar/rodar código para manter.
