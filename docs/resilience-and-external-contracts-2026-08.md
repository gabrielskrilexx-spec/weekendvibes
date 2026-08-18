# Resiliência do mapa e contratos externos

**Data:** 18 de agosto de 2026  
**Escopo:** fallback mapa/lista, retries do Google Maps, controlador frontend e contratos Meta/Routes/relay.

## Implementação

O carregamento do mapa foi extraído para `useGoogleMapsController`. O hook mantém uma máquina de estados explícita com os estados `idle`, `loading`, `success` e `error`, além das transições testáveis `INTERSECT`, `LOAD_START`, `LOAD_SUCCESS`, `LOAD_ERROR` e `RETRY`. A camada visual `MapView` ficou responsável pela apresentação dos estados, ações de retry e fallback para lista.

O singleton do Maps mantém o comportamento de carregamento único e agora valida o corpo retornado pelo relay antes de criar o `Blob` executável. Respostas vazias ou que não apresentam assinatura de JavaScript do Maps são rejeitadas. Polling, timeout, listeners e objeto URL continuam sendo limpos em todos os caminhos de sucesso e falha.

Foi criado `resilienceTelemetry.ts`, que registra eventos sanitizados de fallback, retry agendado, sucesso e falha. O botão “Ver em Lista” registra `map_fallback_list` com somente a causa categorizada (`offline` ou `load_error`). Os retries registram tentativa e atraso, sem URL de evento, coordenadas, token, cookie ou identificador pessoal. Os contadores locais são mantidos apenas como métricas anônimas e o envio para Umami depende do consentimento de métricas já existente.

A resposta do Business Discovery da Meta agora é validada por Zod antes da transformação das mídias. Um payload incompatível é convertido em `InstagramIntegrationFailure` da integração Meta, preservando o tratamento degradado existente em vez de permitir um erro estrutural escapar sem classificação.

A Routes API é validada pelo schema client-side antes da normalização de rotas, e o relay do Maps é validado antes de sua execução. Esses contratos rejeitam ausência de listas obrigatórias, identificadores ou corpos inesperados.

## Testes adicionados

| Área | Cobertura |
|---|---|
| Máquina de estados | Transições idle → loading → success/error e retry → loading; eventos incompatíveis preservam o estado |
| Meta | Mídias opcionais aceitas, identificador obrigatório e erro Graph com código estruturado |
| Routes API | Lista de rotas válida e rejeição de payload sem `routes` |
| Relay Maps | JavaScript não vazio com assinatura do Maps e rejeição de resposta inesperada |
| Regressão existente | Backoff, fallback, filtros, clustering, InfoWindow, ingestão e reconexão permanecem cobertos |

## Observação operacional

O pipeline público de ingestão não possuía uma política de retry automática local para instrumentar sem alterar sua semântica. Por isso, a telemetria de retry foi aplicada aos retries reais do carregamento do Maps, enquanto as falhas de fontes externas continuam registradas pelo fluxo de ingestão e pelos `ingestionRuns`. Recomenda-se, em uma etapa separada, definir uma política explícita de retry por fonte, com limite, jitter e idempotência, antes de adicionar métricas de tentativas à ingestão.

## Validação final

TypeScript, **57 arquivos com 175 testes Vitest**, **7 testes E2E headless**, build de produção e `git diff --check` foram aprovados. A correção intermediária do contrato do relay também foi coberta por teste e validada antes da execução final.

## Próximas recomendações

A evolução natural é exibir no painel administrativo os contadores de fallback e retry agregados no servidor, usando uma fila ou armazenamento de métricas apropriado para múltiplas instâncias. Também é recomendável adicionar contratos versionados para respostas de erro da Meta e para o relay, além de um teste de contrato executado em CI contra fixtures atualizadas e aprovadas manualmente.
