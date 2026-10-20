# 0006 — Contratos de API e de eventos

- **Status:** accepted
- **Data:** 2026-10-19

## Contexto e problema

Serviços se comunicam por HTTP e por eventos. Contratos inconsistentes geram acoplamento e bugs difíceis de rastrear.

## Opções consideradas

- **Versionamento:** na URL; header `Accept`; sem versão
- **Casing JSON:** camelCase; snake_case
- **Erros:** RFC 9457 Problem Details; formato próprio
- **Envelope de eventos:** CloudEvents; envelope próprio; formato nativo do EventBridge
- **Nome de eventos:** reverse-DNS + versão; PascalCase; dot.case curto
- **IDs:** UUIDv7; ULID; IDs com prefixo; auto-increment

## Decisão

| Aspecto | Escolha |
|---------|---------|
| Versionamento REST | URL (`/v1/...`) |
| Casing | camelCase |
| Erros HTTP | RFC 9457 (`application/problem+json`) com extensões `code` e `correlationId` |
| Envelope de eventos | CloudEvents 1.0 (JSON) com extensão `correlationid` |
| Tipo de evento | `com.ecommerce.<serviço>.<agregado>.<fato>.v<N>` |
| IDs | UUIDv7 gerado na aplicação |

## Consequências

- **+** Padrões abertos (IETF, CNCF): interoperáveis e reconhecíveis.
- **+** Versão no `type` do evento permite filtrar por prefixo no EventBridge e evoluir contratos.
- **+** UUIDv7 é ordenável no tempo (bom para índice B-tree) e dispensa ida ao banco para gerar ID.
- **−** CloudEvents adiciona campos obrigatórios ao payload.
- **−** Breaking change de evento exige publicar duas versões durante a migração.
