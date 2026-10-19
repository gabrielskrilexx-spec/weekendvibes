# Auditoria técnica — riscos, gargalos e vulnerabilidades do WeekendVibes

**Escopo:** segurança de endpoints e banco, escalabilidade, ingestão/cron e frontend administrativo.  
**Data:** 17/10/2026  
**Método:** inspeção estática do repositório atual, focada exclusivamente em pontos negativos e caminhos de falha.

## Resumo executivo

Os principais riscos antes de aumentar volume ou exposição pública são: rate limiting dependente do mesmo banco que protege e com fail-open; parsing de corpos grandes antes do rate limit; ausência de cancelamento real nos timeouts; pool/conexões sem dimensionamento explícito para serverless; histórico operacional que cresce sem índices/retention abrangentes; e lock de execução apenas local ao processo.

Há ainda uma inconsistência arquitetural que precisa ser resolvida: o código usa **MySQL/TiDB** (`drizzle-orm/mysql2`, `dialect: "mysql"`, `mysqlTable`), enquanto o contexto operacional menciona PostgreSQL. Se produção for PostgreSQL, driver, schema e migrations não estão alinhados; se for MySQL/TiDB, a documentação/expectativa de operação está incorreta.

---

# 🔴 CRÍTICO

## C1. Rate limit falha aberto quando o banco está indisponível

**Evidência:** `server/db.ts:12-21, 24-48`; `server/_core/security.ts:19-41`.

`claimRateLimitRequest()` retorna `null` quando não há banco ou quando a operação falha. O middleware interpreta isso como ausência de bucket e chama `next()`. Logo, durante uma falha do banco, endpoints tRPC, OAuth e storage ficam sem proteção persistente.

**Impacto:** abuso de CPU, parsing, OAuth, chamadas externas e consultas; uma falha de infraestrutura abre uma janela de negação de serviço.

**Correção:** usar rate limiter independente do banco, preferencialmente edge/Redis/KV; fallback local de emergência; fail-closed para rotas caras/admin; limites por IP + identidade + rota; métricas de `limiter_unavailable`.

## C2. O corpo é parseado antes do rate limit

**Evidência:** `server/_core/index.ts:30-43`.

`express.json({ limit: "5mb" })` e `express.urlencoded({ limit: "1mb" })` precedem os limitadores de `/api/trpc`, `/api/oauth` e storage. Cada request pode consumir parsing e memória antes de ser rejeitado. Não há limite de profundidade/número de chaves.

**Impacto:** payloads grandes ou JSON profundamente aninhados podem saturar CPU/heap antes da proteção de frequência, especialmente em serverless.

**Correção:** rejeitar `Content-Length` excessivo antes do parser; reduzir limite global; usar limites por rota; validar tamanho/arrays/strings via schema; separar upload de JSON comum.

## C3. Timeouts não cancelam o trabalho subjacente

**Evidência:** `server/manual-ingestion.ts:153-165` e `server/agenda-routine.ts` usam `Promise.race` com timer. Pipelines externos estão em `server/instagram-pipeline.ts` e `server/apify-async.ts`.

O timer rejeita a promise exposta, mas a operação original continua. Fetches, retries, OCR, processamento de dataset e persistências podem seguir após o chunk ser marcado como expirado.

**Impacto:** trabalho órfão, duplicidade, corridas no Circuit Breaker, conexões pendentes e consumo de créditos/memória. A plataforma pode congelar a função sem finalizar o estado.

**Correção:** propagar `AbortSignal` a fetch/retries/OCR; verificar cancelamento entre lotes; usar leases com expiração; checkpoints por fonte/item; não iniciar novo run enquanto houver lease ativo; distinguir `timed_out` de `failed`.

## C4. Pool/conexão de banco não está dimensionado para serverless

**Evidência:** `server/db.ts:9-21` cria `drizzle(process.env.DATABASE_URL)` sem limite de pool, timeout de aquisição, keep-alive ou estratégia explícita de reconexão. `drizzle.config.ts` usa `dialect: "mysql"`; schema e driver usam MySQL.

O singleton ajuda apenas dentro de um processo quente; não controla processos concorrentes da Vercel, cron, webhooks e painel.

**Impacto:** exaustão de conexões, latência em cascata e falhas simultâneas no rate limit, auditoria e ingestão.

**Correção:** confirmar SGBD; usar driver/pool serverless recomendado, limite por processo, timeout de query/aquisição e backpressure. Se for PostgreSQL, migrar deliberadamente schema/driver/migrations para `pg-core`; não misturar os dois modelos.

## C5. Webhook Apify usa segredo em query string

**Evidência:** `server/apify-async.ts:271-280`; rota pública em `server/_core/index.ts:63`.

O webhook aceita `req.query.token`, comparando-o ao callback token salvo, ou aceita o segredo interno. Segredos em URL podem aparecer em logs, proxies, tracing, histórico e ferramentas de observabilidade.

**Impacto:** vazamento pode permitir replay/disparo de processamento e gerar carga indevida. A rota é pública e depende da confidencialidade da URL/token.

**Correção:** assinatura HMAC em header/corpo com timestamp e nonce; rejeição de replay; nunca segredo em URL; rate limit dedicado; rotação e expiração curta.

## C6. Estado de execução pode ficar inconsistente após falha entre efeitos

**Evidência:** `server/apify-async.ts:292-295, 314-317`; `server/manual-ingestion.ts:51-83`.

Itens podem ser persistidos sem o run ser finalizado, fingerprints podem não ser concluídos e o processo pode morrer após `202`. Em alguns catches, o banco recebe apenas `DATASET_WORKER_FAILED`, sem contexto estruturado suficiente para retomada.

**Impacto:** runs presos em `running`, itens em estado incorreto, duplicidade ou perda de ponto de retomada.

**Correção:** máquina de estados idempotente com lease/heartbeat; checkpoints; transações por lote; erros com `code`, `message` sanitizada, status do provedor e fingerprint do stack; reconciliador de runs órfãos.

## C7. Destinos de webhook externo podem exfiltrar dados e permitir SSRF configuracional

**Evidência:** `server/alert-webhook.ts:10-18, 21-39, 65-74` aceita HTTP/HTTPS definido por ambiente, sem allowlist de host, assinatura, bloqueio de ranges privados ou controle de redirect.

**Impacto:** configuração comprometida pode enviar metadados operacionais para destino arbitrário ou atingir endpoint interno. HTTP permite interceptação em trânsito.

**Correção:** somente HTTPS em produção; allowlist de domínios; bloquear localhost, redes privadas e metadata endpoints; limitar redirects; assinar payload com HMAC; outbox/retry controlado.

---

# 🟠 ALERTA

## A1. Índices insuficientes nas tabelas operacionais

**Evidência:** `drizzle/schema.ts:245-260, 375-420`.

`ingestionRuns` tem índice `(routine, startedAt)`, mas consultas usam também `sourceKey`, status e período. Logs de handle/action, transições de saúde e snapshots não declaram índices suficientes por fonte/timestamp/ação.

**Impacto:** scans e sorts crescentes em timeline, WAF, relatórios e dashboard; limites de retorno não removem o custo de localizar/ordenar.

**Correção:** índices orientados a `EXPLAIN`: `ingestionRuns(sourceKey, startedAt)`, auditorias `(sourceKey, timestamp)`, transições `(observedAt)`, snapshots `(createdAt)` e, se aplicável, hash único/idempotente.

## A2. Timeline “unificada” pagina depois de duas consultas

**Evidência:** `server/db.ts:574-580` lê até 200 registros de cada tabela e combina/ordena em memória.

**Impacto:** a UI é paginada, mas o backend pode buscar até 400 linhas para a primeira página; exportações e histórico grande aumentam CPU/payload. Ordenação entre tabelas pode ser inconsistente em concorrência.

**Correção:** feed operacional único ou view; cursor `(occurredAt,id)`; filtros/paginação no banco; manter tabelas legadas só durante migração.

## A3. Relatórios executivos agregam janelas em Node

**Evidência:** `server/db.ts:497` lê runs por período; `server/ingestion-reports.ts` percorre e agrupa séries em memória.

**Impacto:** custo cresce com número de runs, não somente dias; cron, endpoint e dashboard podem recalcular os mesmos dados simultaneamente.

**Correção:** agregação SQL/rollups; janela máxima; cache curto por filtros; job assíncrono para relatórios pesados.

## A4. Dataset Apify é materializado e fingerprints podem ser concluídos em paralelo sem limite

**Evidência:** `server/apify-async.ts:229-250`; `server/instagram-pipeline.ts:925-936`.

**Impacto:** arrays de payload/resultados/fingerprints elevam heap; `Promise.all` cria muitas operações concorrentes se o dataset crescer além do esperado.

**Correção:** paginação/streaming; máximo de bytes/itens; lotes pequenos; concorrência limitada; liberação de referências e fila de persistência.

## A5. Execuções paralelas só são bloqueadas dentro do mesmo processo

**Evidência:** `server/agenda-routine.ts:381` usa `Promise.allSettled`; `manual-ingestion.ts:87-90` usa `activeRun` em memória. Cron, botão manual, webhook e instâncias serverless podem coexistir.

**Impacto:** chamadas duplicadas, estado de Circuit Breaker fora de ordem e corrida na persistência.

**Correção:** lock distribuído/lease por rotina e fonte, aquisição atômica, expiração/renovação e coalescing de execuções.

## A6. Polling administrativo tem custo multiplicativo

**Evidência:** `AdminLiveLogsPanel.tsx:60-61` usa 3 s; `AdminCircuitBreakerPanel.tsx:14` usa 30 s; relatórios e painel de fontes também fazem polling.

**Impacto:** uma aba gera muitas consultas permanentes e pode competir com ingestão; vários operadores multiplicam o custo.

**Correção:** endpoint agregado/cache curto; polling condicionado à visibilidade; cursor incremental/SSE para logs; backoff em erro.

## A7. Retenção não cobre todo o histórico operacional

**Evidência:** há retenção explícita para `catalogSnapshots`, mas não há política equivalente clara para runs, alertas, transições e auditorias no schema auditado.

**Impacto:** banco e backups crescem indefinidamente; consultas e custo pioram mesmo que snapshots sejam limpos.

**Correção:** classes de retenção por tipo; deletes em lotes idempotentes; métricas e proteção contra remoção de dados ainda referenciados.

## A8. Webhook externo consome a janela do cron

**Evidência:** `server/alert-webhook.ts:24-38` espera até 5 s por destino. O envio ocorre no ciclo de relatório.

**Impacto:** destino lento pode consumir orçamento de função junto com chamadas de Meta/Apify/ticketing.

**Correção:** outbox/worker; entrega assíncrona; retries limitados; não bloquear relatório/ingestão.

## A9. CSP permite origens amplas

**Evidência:** `server/_core/security.ts:91-104` usa `img-src ... https:` e adiciona origem de variável em `script-src`.

**Impacto:** reduz o benefício da CSP e amplia dependência/tracking de hosts externos; configuração errada pode ampliar scripts permitidos.

**Correção:** allowlist mínima de imagem/script; origem derivada de ambiente validada contra allowlist fixa; revisão de CSP em relatório.

## A10. Rate limit por IP depende de topologia correta de proxy

**Evidência:** `server/_core/security.ts:20-22`; `server/_core/index.ts:29` define `trust proxy: 1`.

**Impacto:** se a cadeia real diferir, pode haver concentração de usuários legítimos ou bypass por rotação/spoofing de cabeçalhos encaminhados.

**Correção:** testar topologia Vercel real; usar identificação oficial da borda; combinar IP com identidade/sessão; não confiar em `X-Forwarded-*` fora de proxies conhecidos.

---

# 🟡 DÉBITO TÉCNICO

## D1. `AdminSourcesPanel.tsx` concentra responsabilidades demais

Cadastro, filtros, KPIs, gráfico, exportação, modal de timeline, reativação, reprocessamento e feedback estão no mesmo componente. Isso aumenta superfície de regressão e re-renderização.

**Refatoração:** extrair `SourceFilters`, `SourceKpiGrid`, `TelemetryChart`, `SourceCard`, `OperationalTimelineDialog`, `ExportActions` e hooks de domínio.

## D2. Contratos tRPC são contornados por casts `unknown`

Vários componentes usam casts estruturais para procedures opcionais/legadas. Isso remove garantias end-to-end e desloca erros para runtime.

**Refatoração:** consolidar router, eliminar APIs legadas e consumir tipos diretamente de `AppRouter`.

## D3. Modelo de auditoria duplicado impede feed realmente unificado

`ingestionSourceHandleAuditLogs` e `ingestionSourceActionAuditLogs` continuam separados, exigindo merge, ordenação, retenção e exportação duplicados.

**Refatoração:** tabela de eventos operacionais com `eventType`, `sourceKey`, actor, timestamp e detalhes validados; migração gradual das tabelas legadas.

## D4. JSON livre em detalhes de runs/snapshots

`counts`, `details` e `payloadJson` são texto. Módulos fazem `JSON.parse` defensivo, sem contrato versionado.

**Refatoração:** `detailsVersion`, validação Zod na fronteira, campos consultáveis como colunas/indexes e limite de bytes.

## D5. `getDb()` não diferencia banco ausente de banco indisponível

O retorno `null` pode significar configuração ausente, falha de conexão ou falha de inicialização; consumidores podem retornar vazio ou continuar sem persistência.

**Refatoração:** estados `unconfigured/unavailable/ready`; em produção falhar explicitamente em operações que exigem auditoria/rate limit; health check com query real.

## D6. Não há orçamento global de execução

Existem timeouts locais de 8 s, 30 s/75 s e por request, mas não há deadline global nem cálculo de tempo restante do provedor.

**Refatoração:** `ExecutionBudget` com deadline, `AbortSignal`, máximo de lotes/fontes e checkpoint.

## D7. Faltam testes de carga, caos e concorrência

A suíte unitária extensa não substitui testes de banco lento, payload de 5 MB, dataset gigante, webhook pendente, corrida cron/manual ou cancelamento durante persistência.

**Refatoração:** testes de carga/fault injection, banco real, execução multi-instância e métricas de heap/conexões/P95.

## D8. Status e categorias não têm um contrato de domínio único

`running/succeeded/failed/partial`, `never/skipped`, `closed/open/half_open` e categorias WAF/Meta/network aparecem em camadas distintas.

**Refatoração:** enums/versionamento para `RunStatus`, `SourceHealth`, `FailureCategory` e `ActionType`, com mapeamento único para UI/exportações.

---

# Achado adicional confirmado no workspace

A verificação atual de diagnósticos reportou **24 erros ativos**, incluindo `TS2339` e `TS7006` em `client/src/components/AdminSourcesPanel.tsx` — a procedure `operationalTimeline` não aparece no tipo tRPC e há parâmetros implicitamente `any`. Também foi registrado `ERR_MODULE_NOT_FOUND` para `@sentry/node` importado por `server/_core/app.ts`.

Isso contradiz checkpoints históricos que mencionavam build verde: o estado atual não deve ser considerado pronto para deploy até reconciliar router, dependências e lockfile. O item D2 é, portanto, um bloqueador operacional atual, não apenas dívida de manutenção.

---

# Plano de correção priorizado

## Próximo ciclo — bloqueadores

1. Rate limit antes do parsing pesado e sem fail-open para admin/OAuth/rotas caras.
2. Confirmar MySQL/TiDB versus PostgreSQL e alinhar driver, schema, migrations e produção.
3. Configurar pool, timeouts e backpressure de banco para serverless.
4. Implementar abort/cancelamento e lease distribuído.
5. Remover segredo do webhook Apify da query string e adicionar HMAC/replay protection.
6. Corrigir os 24 erros TypeScript e o `@sentry/node` ausente antes de qualquer deploy.
7. Adicionar índices de runs/auditoria/snapshots e validar com `EXPLAIN`.

## Segundo ciclo — escala

1. Feed operacional único paginado por cursor.
2. Rollups/agregações SQL de telemetria.
3. Datasets Apify processados por páginas/lotes.
4. Webhooks em outbox/worker.
5. Retenção para todas as tabelas operacionais.

## Critérios que devem bloquear deploy futuro

- Teste concorrente com banco indisponível provando que o rate limit não falha aberto.
- Teste de payload máximo antes do parser.
- Cron + botão manual + webhook simultâneos com um único lease por fonte.
- Cancelamento real durante fetch, retry e persistência.
- Dataset grande sem crescimento contínuo de heap.
- `EXPLAIN` dos relatórios/timeline com 30–90 dias de dados.
- Verificação de que nenhum webhook envia tokens, segredos ou payload bruto.
