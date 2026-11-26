# Auditoria operacional e de leitura — WeekendVibes

**Data da checagem:** 26/11/2026 10:58–11:01 (America/Sao_Paulo)  
**Estado auditado:** SHA `99f475ce7cc6c8b52e2c1495e20db7d66b89ccb5`  
**Vercel:** projeto `weekendvibes-dh6w`, deployment de produção `dpl_GEoPnfHxXYvhrsvJTcryHkJswscV`  
**Banco:** Neon `weekendvibes`, branch `production` (`br-falling-smoke-b4z1mham`), database `neondb`

Esta auditoria foi somente leitura. Não houve `INSERT`, `UPDATE`, `DELETE`, execução de descoberta, persistência de candidatos, alteração de configuração, commit ou push.

## Saúde do deployment e endpoint `/api/health`

A consulta manual a `GET https://weekendvibes-dh6w.vercel.app/api/health` retornou **HTTP 200** com:

- `status: ok`;
- `db: connected`;
- `rateLimiter: active`;
- objeto `configuration` presente e sanitizado.

As origens reportadas são coerentes: `publicOrigin` é `https://weekendvibes-dh6w.vercel.app` e `deploymentOrigin` é o host do deployment ativo. As flags observadas foram `oauthClientConfigured: true`, `openAiConfigured: true` e `apifyConfigured: true`. Permanecem `publicOriginConfigured: false` e `oauthRedirectConfigured: false`; o runtime está funcional por fallback, mas essa configuração implícita deve ser tratada como dívida operacional para evitar divergências entre produção, preview e callbacks OAuth.

## Catálogo publicado

A consulta somente leitura da tabela `events` encontrou:

- **54 eventos** no total;
- **18 publicados e não arquivados**;
- **18 publicados futuros**;
- **18 eventos futuros** no total;
- **36 passados**;
- **54 em Santos ou Guarujá**;
- **0 fora do escopo geográfico**.

Entre os 18 publicados futuros, a distribuição é:

- **Guarujá:** 7 `house_eletronica`, 1 `funk` e 1 `outros`;
- **Santos:** 5 `house_eletronica`, 3 `funk` e 1 `rap_trap`.

A barreira geográfica está íntegra. Há, porém, um evento futuro publicado persistido como `outros`, fora do conjunto prioritário Trap/Rap/Funk/Eletrônica. No histórico total também aparecem gêneros `pop` e `samba_pagode`; eles não aparecem entre os 18 futuros publicados, mas indicam que o catálogo histórico não é taxonomicamente estrito.

## Candidatos e duplicidades

A leitura da fila de `discoveredEventCandidates` retornou **1 candidato futuro com status `rejected`** e nenhum candidato `pending` ou `approved` na agregação executada. Isso significa que a fila não está acumulando pendências, mas também não oferece candidatos novos para curadoria no recorte observado.

O diagnóstico de duplicidade por `sourceUrl` normalizada encontrou uma colisão histórica com **3 registros** para `https://www.instagram.com/flamingomusicbar`, IDs `45`, `46` e `55`, com títulos distintos: `WIU NO FLAMINGO MUSICBAR`, `Rodriguinho Revive Clássicos do Pagode` e `Rodriguinho`. A consulta por identidade normalizada de eventos não arquivados não encontrou grupos duplicados.

## Ingestion runs e stale runs

Nos 50 runs mais recentes, os ciclos públicos concluídos continuam retornando HTTP 200 e, em geral, `partial` por filtros ou falhas isoladas. O run público mais recente é o **#157**, `public-agenda`, com status `partial`, 120 descobertos, 35 fontes correspondidas, 26 filtrados, 3 duplicidades, 4 persistidos e nenhum `fetchFailure`.

O funil do #157 é dominado por itens fora de venue-alvo, estrutura inválida e datas passadas. Isso explica o status `partial` sem caracterizar indisponibilidade total do coletor. Runs anteriores registram repetidamente a URL do Réveillon Laroc Guarujá no Ingresse com HTTP 503 ou ausência de dados essenciais; a execução geral continua em HTTP 200.

Foram confirmados **dois runs abertos e stale há mais de duas horas**:

| Run | Rotina | Início | Substatus | Alvo | Situação |
|---:|---|---|---|---|---|
| 149 | `instagram-stories-async` | 22/11/2026 | `QUEUED` | 7 perfis | `running`, `finishedAt = NULL`, stale |
| 146 | `instagram-stories-async` | 21/11/2026 | `QUEUED` | `plantssantos` | `running`, `finishedAt = NULL`, stale |

A agregação dos últimos 14 dias confirma 2 runs `instagram-stories-async` em `running`, ambos abertos e stale. Não foram encontrados alertas diretamente associados aos IDs 146 ou 149. Isso é um alerta operacional alto: a ausência de alerta associado reduz a visibilidade justamente do caso que deveria ser tratado pelo sweeper de duas horas.

## Fontes configuradas

A agregação atual por `kind`, habilitação e último status retornou **111 registros**, sendo **94 habilitados** e **17 desabilitados**. A distribuição bruta foi:

- Instagram: 15 habilitados `skipped` e 1 desabilitado `failed`;
- fontes públicas: 68 habilitadas `never`, 8 `succeeded`, 2 `failed`, 1 `skipped`, além de 12 desabilitadas `never` e 4 desabilitadas `skipped`.

Esse resultado diverge do baseline histórico anteriormente anotado de 108 fontes totais e 91 ativas. A diferença deve ser reconciliada em uma etapa própria, por leitura, porque pode representar registros históricos adicionais ou uma alteração posterior do catálogo de fontes. Não houve nenhuma tentativa de limpeza nesta auditoria.

Integrações principais:

- **Gandaya:** habilitada, última execução `succeeded`, HTTP 200, circuito `closed`, em 26/11/2026; 1 item lido e ignorado, sem erro.
- **Sympla:** habilitada, último status `failed`, HTTP 404, URL cadastrada para Santos, circuito ainda `closed`; mensagem armazenada indica resposta externa HTTP 404.
- **Instagram:** contas habilitadas aparecem como `skipped` por janela semanal, o que é esperado para fontes dentro do intervalo configurado. `instagram:mimadafesta` está desabilitada após HTTP 400.
- Há muitas fontes públicas ArTicket históricas com status `never`, incluindo fontes individuais, o que reduz a clareza entre catálogo ativo, fonte histórica e fonte realmente observada.

## Alertas operacionais não resolvidos

A consulta somente leitura de `operationalAlerts` encontrou sete agrupamentos não resolvidos:

- 3 informativos `public / ticket_lot_changed`;
- 1 informativo `public / ticket_price_changed`;
- 1 aviso `pipeline / structured_not_persisted`;
- 1 aviso `ocr / operational`;
- 1 aviso `meta / operational`.

Não há alerta diretamente ligado aos runs stale 146/149. Os alertas são antigos em relação à checagem, com o mais recente em 20/11 para `ticket_lot_changed` e em 21/11 para `structured_not_persisted`; isso sugere necessidade de reconciliação/resolução automática, não de alteração manual imediata dos eventos.

## Validação local

Foram executados sem commit ou push:

- `pnpm check`: **passou** (`tsc --noEmit`);
- `pnpm build`: **passou**, incluindo Vite, PWA e bundle serverless;
- `pnpm exec vitest run`: **152 arquivos, 913 testes aprovados e 2 ignorados**;
- teste direcionado de health/origem: **5 testes aprovados**.

O arquivo `server/ingestion.test.ts` não existe neste SHA; os testes de ingestão estão distribuídos em arquivos como `ingestion-reports.test.ts`, `ingestion.fetch-resilience.test.ts`, `ingestion.gandaya.test.ts`, `ingestion.ticketing.test.ts` e outros, todos incluídos na suíte completa.

Warnings observados, sem falha de validação:

- pnpm ignora o campo legado `pnpm` de `package.json`, incluindo `patchedDependencies` e `overrides`;
- testes React emitem avisos de `act(...)` e de `react-test-renderer` depreciado;
- há avisos de `key` ausente em listas de alguns componentes de admin;
- testes locais que simulam o banco emitem `Unsupported DATABASE_URL protocol; expected PostgreSQL`, porque o ambiente de teste usa configuração diferente do Neon de produção.

## Severidade e plano recomendado

### Crítico

Não foi encontrado incidente crítico de disponibilidade: o deployment responde 200, o banco está conectado e o rate limiter está ativo.

### Alto

1. **Runs 146 e 149 presos em `QUEUED` há vários dias**, sem `finishedAt` e sem alerta associado. Priorizar sweeper idempotente no início de todos os ciclos, encerramento explícito com `timeout_exceeded_2h` e alerta deduplicado.
2. **Sympla habilitada com último diagnóstico HTTP 404.** Validar URL/estratégia de coleta e manter o estado de bloqueio explícito, sem mascará-lo como catálogo vazio.
3. **94 fontes habilitadas na leitura atual, sendo 68 sem execução registrada.** Revisar o catálogo para diferenciar fonte operacional, fonte histórica e fonte aguardando primeira execução.

### Médio

1. **Status `partial` recorrente no `public-agenda`.** O coletor conclui em HTTP 200, mas o volume filtrado é alto: no #157, 85 itens foram rejeitados por venue-alvo, 13 por estrutura inválida e 13 por data passada no preview detalhado. Melhorar o diagnóstico por etapa antes de relaxar filtros.
2. **Falha isolada recorrente do Ingresse para o Réveillon Laroc.** Deve continuar sendo warning por URL, com HTTP 503 e retryability preservados, sem rebaixar o ciclo inteiro.
3. **Um evento futuro publicado em `outros`.** Avaliar curadoria ou regra de publicação para evitar que itens fora da taxonomia prioritária entrem na vitrine futura.
4. **Divergência de baseline de fontes:** 111/94 na consulta atual contra 108/91 no registro anterior.
5. **Alertas não resolvidos antigos**, incluindo `structured_not_persisted`, sem associação aos runs stale.

### Baixo

1. Definir explicitamente `PUBLIC_SITE_URL` e `OAUTH_REDIRECT_URI` no ambiente de produção, após validar todos os aliases e callbacks autorizados.
2. Corrigir o warning de configuração pnpm e os avisos de `key`/`act` quando houver janela de manutenção.
3. Classificar ou arquivar fontes ArTicket `never` antigas apenas após uma consulta de impacto e aprovação curatorial; não fazer limpeza automática.

## Conclusão

O deployment e o catálogo estão operacionais e o foco geográfico Santos/Guarujá está preservado. Os riscos principais são operacionais e de observabilidade: dois runs Apify/Instagram presos há dias, Sympla habilitada com 404, muitas fontes habilitadas sem histórico de execução e divergência entre o baseline de fontes documentado e a contagem atual. Nenhuma correção foi aplicada nesta etapa.

## Evidências internas

- Endpoint validado: `https://weekendvibes-dh6w.vercel.app/api/health`.
- Resultado completo dos runs: `/home/ubuntu/.mcp/tool-results/2026-11-26_13-58-26.082756776_neon_run_sql_7e1fdcc1.json`.
- Resultado completo das fontes: `/home/ubuntu/.mcp/tool-results/2026-11-26_13-58-28.995562428_neon_run_sql_5681bd1f.json`.
- Métricas globais do catálogo: `/home/ubuntu/.mcp/tool-results/2026-11-26_13-58-22.973933188_neon_run_sql_3ebd3f26.json`.
- Log de validação local: `/tmp/weekendvibes-audit-validation.log`.
