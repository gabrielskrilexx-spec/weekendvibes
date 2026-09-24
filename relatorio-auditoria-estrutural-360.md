# Relatório de Auditoria Estrutural 360° — WeekendVibes

**Data:** 24 de setembro de 2026  
**Escopo:** Backend Node/Express/tRPC, Drizzle ORM/MySQL, pipeline de ingestão, Apify/Meta/OCR, frontend administrativo React/Vite, escalabilidade, segurança, performance e dívida técnica.  
**Fora do escopo:** alterações de código, sugestões visuais e avaliação de UX.

## Síntese executiva

A plataforma apresenta uma arquitetura funcionalmente madura. Há separação clara entre procedimentos tRPC, helpers de banco, rotinas agendadas, Circuit Breaker persistido e componentes administrativos modularizados. O uso de schemas Zod, autenticação administrativa e migrations Drizzle reduz o risco de contratos inconsistentes.

Os riscos mais relevantes não indicam uma falha imediata, mas podem comprometer o comportamento em Autoscale ou sob crescimento de volume. O principal ponto é que o rate limit HTTP local usa estado em memória, enquanto o banco já é usado para alguns controles distribuídos. Em múltiplas instâncias, o limite efetivo pode ser multiplicado pelo número de pods. O segundo ponto é a ausência de índices compostos evidentes em algumas tabelas de consulta operacional, especialmente alertas e execuções de ingestão. O terceiro é a existência de caminhos de OCR que ainda materializam imagens em `Buffer`/Base64 e de um caminho público que concatena até 48.000 caracteres em uma única chamada de modelo.

A recomendação é tratar os itens de prioridade **ALTA** antes de aumentar significativamente o número de fontes ou permitir lotes grandes de ingestão concorrente. Os itens **MÉDIA** melhoram previsibilidade, rastreabilidade e custo operacional. Os itens **BAIXA** são principalmente de padronização e redução de dívida técnica.

## Matriz de prioridades

| Prioridade | Área | Achado principal | Impacto provável |
|---|---|---|---|
| ALTA | Segurança e escalabilidade | Rate limit HTTP local em `Map`, por processo | Limites inconsistentes entre pods e possibilidade de abuso distribuído |
| ALTA | Memória e custos | OCR ainda pode baixar imagem para `Buffer`/Base64; ingestão pública concatena payload grande | Pico de memória, GC prolongado e falhas sob lotes grandes |
| ALTA | Dados | Algumas consultas operacionais não demonstram índice composto alinhado ao filtro temporal/status | Scans crescentes e degradação de latência com milhares de registros |
| ALTA | Jobs externos | Worker assíncrono atualiza execução após processamento, mas necessita garantia explícita de idempotência por dataset/item | Duplicidade ou reprocessamento após webhook/retry |
| MÉDIA | Segurança de API | Mutations custosas e exportações dependem principalmente do rate limit global de `/api/trpc` | Um administrador autenticado pode consumir recursos de outros operadores |
| MÉDIA | Dados | Paginação por offset permanece vulnerável a custo crescente e inconsistência durante inserções | Páginas lentas e itens repetidos/omitidos em listas mutáveis |
| MÉDIA | Observabilidade | Métricas e alertas estão amplos, mas falta uma visão uniforme de correlação entre request, job, run e provider | Diagnóstico operacional mais lento |
| MÉDIA | Frontend | Há polling independente de 30 segundos em vários painéis | Carga recorrente desnecessária e refetch simultâneo em múltiplas abas |
| BAIXA | Manutenibilidade | Parsing de JSON armazenado em strings é repetido no frontend | Duplicação e risco de divergência de interpretação |
| BAIXA | Testes | Cobertura é extensa, porém testes de concorrência real, isolamento entre pods e índices não podem ser garantidos por Vitest unitário | Falsa sensação de segurança em condições distribuídas |

## 1. Arquitetura de dados e consultas

### ALTA — Índices operacionais incompletos ou não alinhados aos filtros

**Evidência.** O schema possui bons índices para `manualReviewEvents`, incluindo `(status, createdAt)`, `(sourceType, status)` e `eventDate`, além de índices para auditoria por evento/data e jobs por status/lease. Entretanto, `operationalAlerts` e `ingestionRuns` aparecem como entidades centrais sem um conjunto equivalente de índices compostos visível na definição auditada. O helper `listOperationalAlerts` filtra por `isResolved` e `createdAt`, ordenando por `createdAt` e limitando o resultado em [server/db.ts](server/db.ts). O filtro ideal é, portanto, composto por estado e data, não apenas por data.

**Risco estrutural.** O filtro de alertas recentes pode evoluir para um range scan amplo à medida que o histórico cresce. Consultas de runs por rotina, status, período, source key ou `actorRunId` apresentam o mesmo risco se esses campos forem combinados sem índices adequados. O problema pode permanecer invisível com poucos milhares de linhas e aparecer como aumento de P95 no painel ou nos heartbeats.

**Solução arquitetural.** Medir primeiro com `EXPLAIN` nas consultas de produção e adicionar índices compostos direcionados, por exemplo `(isResolved, createdAt)`, `(routine, startedAt)`, `(status, startedAt)`, `(sourceKey, startedAt)` e um índice único ou seletivo para o identificador externo do provider quando o contrato permitir. A migration deve ser acompanhada de uma janela de manutenção ou execução online compatível com o provedor.

### MÉDIA — Offset pagination em entidades mutáveis

**Evidência.** A timeline do Heartbeat e listagens administrativas expõem `offset`/`limit`, enquanto a fila manual usa ordenação por data/status. O componente [HeartbeatTimelinePanel.tsx](client/src/components/HeartbeatTimelinePanel.tsx) altera o offset para navegar entre páginas.

**Risco estrutural.** Em uma timeline append-only o risco é menor, mas em listas que recebem novas linhas entre duas requisições o offset pode repetir ou omitir itens. O custo também cresce linearmente porque o banco precisa percorrer linhas anteriores ao offset.

**Solução arquitetural.** Migrar listagens grandes para cursor pagination baseada em uma chave estável, como `(timestamp, id)` ou `(createdAt, id)`. Manter offset apenas para relatórios pequenos e exportações controladas. O cursor deve fazer parte do contrato Zod e ser validado junto com a direção da ordenação.

### MÉDIA — Atomicidade parcial em operações de estado composto

**Evidência.** A aprovação manual atualiza a fila e publica um evento; o undo arquiva o evento publicado e retorna a revisão para `pending` em [server/manual-review.ts](server/manual-review.ts). A operação de orçamento Apify usa incremento condicional no banco, o que é uma boa base para concorrência.

**Risco estrutural.** Em falha entre duas escritas relacionadas, a fila e o evento publicado podem ficar temporariamente divergentes. O mesmo vale para auditoria append-only se a mudança principal persistir e o log falhar depois.

**Solução arquitetural.** Colocar mudanças de estado, criação/atualização do evento e registro de auditoria na mesma transação Drizzle quando o driver e o provedor garantirem isso. Para operações que cruzam storage externo, usar uma outbox persistida e um reconciliador idempotente, em vez de depender de duas chamadas síncronas.

### BAIXA — JSON operacional em colunas textuais

**Evidência.** O painel interpreta `details` e `counts` com `JSON.parse` em [AdminReportsPanel.tsx](client/src/components/AdminReportsPanel.tsx). Esse padrão é coerente com a flexibilidade do pipeline, mas dispersa o contrato.

**Risco estrutural.** Mudanças de shape podem quebrar relatórios silenciosamente, e filtros por campos internos não podem usar índices relacionais normais.

**Solução arquitetural.** Manter o JSON para payload bruto, mas promover campos de consulta recorrente — `sourceKey`, `trigger`, `readCount`, `filteredCount`, `provider`, `actorRunId` e `errorKind` — a colunas tipadas. Centralizar a desserialização em um parser Zod compartilhado no servidor.

## 2. Resiliência e segurança do backend

### ALTA — Rate limit não distribuído

**Evidência.** [server/_core/security.ts](server/_core/security.ts) implementa `createRateLimit` com um `Map<string, Bucket>`. O próprio comentário do módulo indica que a proteção é por instância e que edge/WAF deve complementar o controle. O servidor aplica limites para OAuth, tRPC, storage e maps em [server/_core/index.ts](server/_core/index.ts).

**Risco estrutural.** Em Autoscale, cada pod mantém buckets diferentes. Um cliente pode distribuir requisições entre pods e exceder o limite global. Além disso, reinício de pod zera os buckets. Isso é insuficiente para mutations custosas, exports e endpoints administrativos.

**Solução arquitetural.** Manter o limiter local como primeira barreira, mas adicionar um limiter distribuído por Redis/TiDB/MySQL com janela deslizante ou token bucket atômico. Aplicar quotas específicas por identidade, rota e custo. Separar limites para leitura, mutation, exportação e disparo de provider. O WAF deve continuar sendo a primeira camada contra abuso anônimo.

### MÉDIA — Rate limit por rota de alto custo

**Evidência.** O limite global de `/api/trpc` é de 120 requisições por minuto por bucket local. As rotas de ingestão manual, reprocessamento, exportação assíncrona e alterações administrativas possuem custos muito diferentes, mas compartilham a mesma camada geral.

**Risco estrutural.** Um cliente autenticado pode ocupar o orçamento de requests sem necessariamente atingir o limite global. Uma mutation pode disparar Apify, OCR ou consultas extensas repetidamente.

**Solução arquitetural.** Adicionar middleware de custo por procedimento. Limitar por `openId`, `sourceKey`, tipo de job e janela temporal. Para exports e provider calls, responder com `429` e `Retry-After`, além de deduplicar jobs equivalentes.

### MÉDIA — Superfície M2M ampla

**Evidência.** A autenticação por `x-cron-secret` usa comparação segura e é aplicada a health e handlers específicos. Porém, várias rotas agendadas são registradas diretamente no Express, e a garantia depende de cada handler chamar o verificador corretamente.

**Risco estrutural.** Uma nova rota agendada pode ser adicionada sem o guard de segredo. A segurança passa a depender de revisão manual e não de uma composição obrigatória.

**Solução arquitetural.** Criar um middleware Express `requireInternalCron` e aplicá-lo no mount das rotas M2M. Separar rotas públicas, administrativas de sessão e M2M em routers/mounts distintos. Emitir métrica para tentativas sem autenticação, sem registrar o segredo ou o valor recebido.

### BAIXA — Contratos de erro heterogêneos

**Evidência.** Os handlers retornam códigos sanitizados como `APIFY_TOKEN_MISSING`, `DATASET_REFERENCE_MISSING`, `ACTOR_TIMEOUT` e `APIFY_DISPATCH_FAILED`, enquanto tRPC usa `TRPCError`.

**Risco estrutural.** Consumidores e observabilidade precisam manter várias convenções de erro. Mensagens podem divergir entre REST e tRPC.

**Solução arquitetural.** Definir um catálogo compartilhado de códigos de erro e um envelope versionado. Mapear o catálogo para HTTP e tRPC sem expor mensagens do provider.

## 3. Memória, performance e pipeline de ingestão

### ALTA — Fallback Base64 ainda cria picos de memória

**Evidência.** [server/instagram-pipeline.ts](server/instagram-pipeline.ts) faz download com `response.arrayBuffer()`, cria `Buffer` e transforma os bytes em Base64 quando a URL direta não é aceita. O caminho é correto como fallback, mas mantém simultaneamente resposta, ArrayBuffer, Buffer e string codificada durante a chamada.

**Risco estrutural.** Com 500 flyers simultâneos, o pico pode multiplicar pelo tamanho das imagens e pela expansão Base64 de aproximadamente um terço. O garbage collector pode atrasar o event loop, aumentar latência e causar OOM.

**Solução arquitetural.** Priorizar sempre URL pública para Vision. Para fallback, impor limite de bytes antes de materializar o corpo, redimensionar/comprimir em worker ou processo separado e liberar referências imediatamente após a chamada. Adicionar um semáforo global de Vision com concorrência baixa e fila persistida para lotes grandes. Registrar bytes baixados e pico de concorrência.

### ALTA — Carga pública ainda concatena até 48.000 caracteres

**Evidência.** [server/ingestion.ts](server/ingestion.ts) monta `rawText` com todas as páginas e aplica `.slice(0, 48_000)` antes de uma chamada ao modelo. Isso limita caracteres, mas não limita o número de fontes processadas nem preserva necessariamente fronteiras semânticas por documento.

**Risco estrutural.** Uma execução com muitas páginas cria uma string grande, um corpo JSON adicional e uma resposta igualmente grande. O truncamento pode remover eventos no final e dificultar rastreabilidade por fonte.

**Solução arquitetural.** Processar páginas em chunks com tamanho máximo de tokens, mantendo `sourceUrl` por item. Validar cada resposta com Zod, deduplicar no servidor e aplicar um orçamento de tokens por execução. Para 500 itens, usar fila com worker concurrency limitada, não `Promise.all` irrestrito.

### ALTA — Idempotência do worker Apify deve ser explícita por item

**Evidência.** O webhook verifica a execução e chama `processDataset`; a execução é vinculada por `actorRunId` e o dataset é processado em background em [server/apify-async.ts](server/apify-async.ts). O fluxo atual atualiza o `ingestionRun` ao final.

**Risco estrutural.** Webhooks podem ser reenviados, o worker pode reiniciar após persistir parte dos itens e o endpoint de reprocessamento pode ser chamado novamente. Sem uma chave única por `provider + actorRunId + itemId/mediaUrl`, OCR e eventos podem ser processados duas vezes.

**Solução arquitetural.** Persistir checkpoints por item e uma chave idempotente. Fazer cada etapa aceitar retry seguro: claim, OCR, normalização e persistência. Usar leases e status por item, com retry count e dead-letter state. O run agregado deve ser calculado a partir desses itens, não somente de um callback final.

### MÉDIA — Retry externo precisa de orçamento e backoff centralizados

**Evidência.** O cliente OpenAI usa tentativas e atrasos fixos. Apify possui timeout e caminhos síncrono/assíncrono separados. Há vários wrappers de timeout no projeto.

**Risco estrutural.** Sob falha do provider, retries de múltiplos workers podem formar um thundering herd e consumir orçamento Apify/OpenAI rapidamente.

**Solução arquitetural.** Centralizar política de retry com backoff exponencial, jitter, classificação de erro e orçamento por run. Não repetir erros permanentes como 401, 403, 404 ou schema inválido. Integrar o orçamento diário e o Circuit Breaker como pré-condições transacionais do dispatch.

### MÉDIA — Observabilidade insuficiente de recursos

**Evidência.** O sistema registra latência, status, runId, contagens e falhas sanitizadas, mas os trechos auditados não demonstram métricas consistentes de bytes, tokens, tamanho de dataset, heap, duração de cada etapa e fila de OCR.

**Risco estrutural.** O P95 pode sinalizar degradação sem indicar se a causa foi rede, provider, CPU, heap ou banco.

**Solução arquitetural.** Criar spans ou eventos estruturados por etapa: fetch, parse, provider dispatch, dataset read, OCR, normalization, persistence. Associar `ingestionRunId`, `actorRunId`, `sourceKey` e `heartbeatExecutionId`. Emitir histogramas de duração e contadores de bytes/tokens.

## 4. Frontend administrativo e React

### MÉDIA — Polling independente em vários painéis

**Evidência.** [AdminReportsPanel.tsx](client/src/components/AdminReportsPanel.tsx) faz polling de relatórios, consumo Apify, geocoding e versionamento em intervalos de 30 segundos. Outros painéis mantêm queries próprias e também refetch periódico.

**Risco estrutural.** Uma aba administrativa aberta por muitas horas gera requisições mesmo sem atividade. Vários componentes podem disparar refetch no mesmo instante, criando picos no backend.

**Solução arquitetural.** Centralizar o ciclo de atualização operacional em um hook ou `QueryClient` com jitter, deduplicação e pausa quando a aba estiver oculta. Usar invalidação por evento quando houver webhook ou conclusão de job. Manter polling apenas para jobs ativos.

### MÉDIA — Deriva de estado e processamento no render

**Evidência.** O painel transforma séries de telemetria com `Map`, `find`, `Object.fromEntries` e `sort` durante a renderização. A fila de stories também mantém filtros, ordenação composta, paginação e URL sincronizados no componente administrativo.

**Risco estrutural.** O custo pode crescer como O(n²) em `sourceTelemetryHistory.find` para cada combinação de data e fonte. Mudanças em filtros ou queries podem reexecutar todo o processamento e repassar novas referências para subcomponentes.

**Solução arquitetural.** Mover normalização para `useMemo` com dependências estáveis ou, preferencialmente, para o backend quando os dados já forem agregados. Indexar pontos por `date/sourceKey` em uma passada O(n). Separar estado de URL, estado de dados e apresentação em hooks/containers distintos.

### BAIXA — Componentes modulares ainda dependem de contratos implícitos

**Evidência.** A fila manual foi dividida em componentes, mas tipos locais de histórico, status e payloads ainda são derivados em mais de um arquivo. O frontend também interpreta JSON de runs diretamente.

**Risco estrutural.** Alterações no output tRPC podem compilar parcialmente e produzir estados vazios ou rótulos incorretos.

**Solução arquitetural.** Exportar schemas/outputs inferidos do servidor ou um pacote `shared/contracts` somente para tipos e parsers. Evitar duplicar unions de status no frontend.

## 5. Manutenibilidade, tipagem e dívida técnica

### MÉDIA — Concentração de responsabilidades em módulos extensos

**Evidência.** `server/routers.ts`, `server/db.ts` e `server/instagram-pipeline.ts` concentram contratos, helpers, integração externa, normalização e observabilidade. O projeto já iniciou a modularização do frontend, mas o backend ainda mantém pontos centrais extensos.

**Risco estrutural.** Mudanças locais têm alto acoplamento e aumentam o custo de revisão. Mocks de testes ficam mais complexos porque importar um módulo carrega várias dependências e efeitos de ambiente.

**Solução arquitetural.** Separar por domínio: `routers/ingestion`, `routers/manual-review`, `routers/heartbeat`; `repositories/ingestion`, `repositories/alerts`; `providers/apify`, `providers/meta`, `providers/openai`; e serviços puros de normalização. O router deve orquestrar autorização e chamar serviços, não conter lógica de negócio.

### BAIXA — Repetição de sanitização e parsing

**Evidência.** Há vários caminhos para sanitizar falhas de provider, ler JSON, interpretar detalhes de execução e transformar status em mensagens. O frontend repete `try/catch JSON.parse` em funções de exportação e relatórios.

**Risco estrutural.** Uma nova categoria de erro pode ser tratada em um fluxo e esquecida em outro.

**Solução arquitetural.** Criar utilitários únicos para `parseRunDetails`, `parseRunCounts`, `sanitizeProviderError` e `mapIngestionStatus`. Cobrir os utilitários com testes de propriedades e casos malformados.

## 6. Cobertura dos 514 testes

A quantidade de testes é um sinal positivo e cobre contratos relevantes de Circuit Breaker, ingestão, Apify, fila manual, auditoria e componentes. Ainda assim, a contagem não comprova alguns comportamentos essenciais de produção:

1. **Concorrência distribuída:** dois pods tentando fazer claim do mesmo orçamento, lease ou item do dataset.
2. **Falhas parciais:** processo encerrado após OCR ou persistência parcial.
3. **Performance:** consultas com dezenas de milhares de registros e `EXPLAIN` dos índices.
4. **Limite de memória:** lote grande de imagens, resposta inválida muito grande e provider lento.
5. **Segurança negativa:** abuso de mutations autenticadas, replay de webhook, segredo incorreto e tentativas de atravessar limites por múltiplos IPs.
6. **Contrato de migrations:** banco vazio, banco com dados históricos e rollback/forward compatibility.

A proposta é complementar Vitest unitário com testes de integração contra MySQL/TiDB, testes de concorrência com workers paralelos, testes de carga controlados e cenários de reinício de worker. Os testes devem validar invariantes, especialmente idempotência e a equação de reconciliação, e não somente status HTTP.

## Plano recomendado de execução

### Fase 1 — antes de escalar volume

Adicionar rate limiting distribuído para rotas custosas. Confirmar índices com `EXPLAIN` e criar os índices compostos necessários. Introduzir idempotência por item no worker Apify. Aplicar limites de bytes e concorrência no fallback Base64/OCR. Garantir que cada rotina externa tenha orçamento de retry e erro permanente sem repetição.

### Fase 2 — endurecimento operacional

Migrar listas grandes para cursor pagination. Centralizar polling e adicionar jitter. Instrumentar duração, bytes, tokens e heap por etapa. Separar os routers, repositories e providers por domínio. Criar testes de concorrência e reinício.

### Fase 3 — redução de dívida técnica

Promover campos consultáveis de JSON para colunas tipadas. Consolidar parsers e sanitizadores. Compartilhar contratos entre servidor e frontend. Revisar os módulos extensos após os riscos de maior impacto estarem cobertos.

## Conclusão

O sistema está pronto para operação controlada, mas não deve ser considerado totalmente preparado para crescimento horizontal irrestrito enquanto o rate limit permanecer local e enquanto o worker externo não tiver idempotência por item comprovada. A combinação de índices compostos, limiter distribuído, semáforo de OCR e checkpoints idempotentes elimina os riscos de maior impacto sem exigir mudança de stack. Nenhum código foi alterado durante esta auditoria.

## Referências

[1]: [drizzle/schema.ts](drizzle/schema.ts) "Schema Drizzle, tabelas e índices do projeto"

[2]: [server/db.ts](server/db.ts) "Repositórios e consultas de banco"

[3]: [server/manual-review.ts](server/manual-review.ts) "Domínio da fila de revisão manual e auditoria"

[4]: [server/_core/index.ts](server/_core/index.ts) "Inicialização Express, rate limits e rotas agendadas"

[5]: [server/_core/security.ts](server/_core/security.ts) "CORS, cabeçalhos e rate limiter local"

[6]: [server/routers.ts](server/routers.ts) "Contratos e procedures tRPC"

[7]: [server/instagram-pipeline.ts](server/instagram-pipeline.ts) "Pipeline Instagram, OCR, OpenAI e Apify"

[8]: [server/apify-async.ts](server/apify-async.ts) "Dispatcher assíncrono, webhook e worker de dataset"

[9]: [server/ingestion.ts](server/ingestion.ts) "Ingestão pública, parsing e extração estruturada"

[10]: [client/src/components/AdminReportsPanel.tsx](client/src/components/AdminReportsPanel.tsx) "Painel administrativo e polling operacional"

[11]: [client/src/components/HeartbeatTimelinePanel.tsx](client/src/components/HeartbeatTimelinePanel.tsx) "Timeline e paginação de execuções Heartbeat"

[12]: [client/src/components/ManualReviewPanel.tsx](client/src/components/ManualReviewPanel.tsx) "Orquestração da fila de revisão manual"

[13]: [client/src/components/ManualReviewEditDialog.tsx](client/src/components/ManualReviewEditDialog.tsx) "Modal de edição e histórico da revisão manual"

[14]: [package.json](package.json) "Scripts, dependências e ferramentas de validação"

[15]: [server/_core/cron-auth.ts](server/_core/cron-auth.ts) "Autenticação de chamadas M2M"

[16]: [server/instagram-pipeline.test.ts](server/instagram-pipeline.test.ts) "Testes do pipeline Instagram"

[17]: [client/src/components/AdminReportsPanel.test.tsx](client/src/components/AdminReportsPanel.test.tsx) "Testes do painel administrativo"

[18]: [client/src/components/ManualReviewPanel.test.tsx](client/src/components/ManualReviewPanel.test.tsx) "Testes da fila de revisão manual"

[19]: [server/apify-async.test.ts](server/apify-async.test.ts) "Testes do dispatcher e processamento Apify"

[20]: [server/resilience.test.ts](server/resilience.test.ts) "Testes de resiliência e Circuit Breaker"

[21]: [server/ingestion.sources.test.ts](server/ingestion.sources.test.ts) "Testes dos adaptadores e fontes públicas"

[22]: [server/agent-ingestion.persistence.test.ts](server/agent-ingestion.persistence.test.ts) "Teste de persistência da ingestão de documentos"

[23]: [server/manual-review.router.test.ts](server/manual-review.router.test.ts) "Testes de contrato do router de revisão manual"

[24]: [server/manual-review.audit.test.ts](server/manual-review.audit.test.ts) "Testes de auditoria da fila manual"

[25]: [server/scheduled-heartbeat-monitor.ts](server/scheduled-heartbeat-monitor.ts) "Monitor e rotina do Heartbeat"

[26]: [server/ingestion-reports.ts](server/ingestion-reports.ts) "Relatórios, métricas e alertas de ingestão"

[27]: [server/circuit-breaker.ts](server/circuit-breaker.ts) "Política de Circuit Breaker"

[28]: [server/manual-ingestion.ts](server/manual-ingestion.ts) "Orquestração de ingestões manuais e timeouts"

[29]: [server/admin-rest.ts](server/admin-rest.ts) "Rotas REST administrativas legadas/versionadas"

[30]: [README.md](README.md) "Instruções operacionais do projeto"

**Autor:** Manus AI

> Este relatório é um diagnóstico estrutural baseado na inspeção estática dos arquivos atuais. Recomendações de índice, capacidade e concorrência devem ser confirmadas com métricas de produção, `EXPLAIN`, testes de carga e observação de heap antes de serem convertidas em mudanças de infraestrutura.
> 
> A auditoria paralela prevista não foi concluída porque o canal de subagentes ficou indisponível; as conclusões acima foram consolidadas diretamente a partir dos arquivos e evidências locais disponíveis.

