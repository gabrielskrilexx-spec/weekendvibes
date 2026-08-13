# Auditoria de agendamentos e bots — 2026-08-13

## Escopo
Auditoria somente leitura dos mecanismos automáticos do WeekendVibes: schedules de agente, Heartbeat jobs, endpoints publicados, autenticação cron, composição das rotinas e histórico de execução.

## Evidências observadas

### Schedule de agente
- Nome: `WeekendVibe — ingestão Instagram`
- Estado: `active` / habilitado.
- Cron exibido: `0 0 10 * * 2`, semanal às terças, 10:00 no fuso `America/Sao_Paulo`.
- Modo: `full_auto`; `runAsNewTask: true`; `agentTaskMode: lite`.
- Última execução registrada pelo status: `2026-08-12T15:04:27.093Z`.
- O prompt orienta chamar `/api/scheduled/ingest-event-documents` e `/api/scheduled/ingest-instagram`, sem `ask_user`, sem login, sem compras, sem publicação e sem inventar dados.
- UID: `cNUuCN6HUNZPyksSNfCrME`.

### Heartbeat job
- Nome: `weekendvibes-ingest-events`.
- Estado: habilitado.
- Callback: `POST /api/scheduled/ingest-events`.
- Cron: `0 0 5 * * *` UTC, equivalente a 02:00 em São Paulo.
- Última execução: `2026-08-13T05:04:29Z`.
- Próxima execução: `2026-08-14T05:00:00Z`.
- UID: `XDaw8eu2MTqCxRhwtwMx4M`.

### Falha concreta
O histórico do Heartbeat mostra a execução de 2026-08-13 como `failed`, HTTP 500, com resposta `HttpError: Invalid session cookie`. O stack aponta `sdk.authenticateRequest` antes de `ingestEventsHandler` iniciar a ingestão. O log de produção também registrou chamadas com `[Auth] Missing session cookie`.

## Código publicado
- `/api/scheduled/ingest-events` está montado em `server/_core/index.ts`.
- `/api/scheduled/ingest-event-documents` está montado.
- `/api/scheduled/ingest-instagram` está montado.
- O handler diário autentica antes de executar `runPublicAgendaStep`.
- A rotina Instagram registra alertas operacionais e notifica o proprietário em falhas de Apify, OCR, OpenAI ou pipeline.
- A rotina combinada `runFullAgendaRoutine` executa fontes públicas e Instagram em paralelo, mas o Heartbeat listado chama somente a rotina pública.
- A autenticação atual tenta validar o cookie localmente com `JWT_SECRET` antes de reconhecer o prefixo cron; esse caminho está rejeitando o cookie entregue ao Heartbeat.

## Diagnóstico
Há dois mecanismos automáticos ativos, não um único bot. O schedule semanal de agente está ativo e configurado para `full_auto`, mas o status disponível não fornece histórico detalhado de resposta. O Heartbeat diário está ativo, porém comprovadamente falhou na última execução por autenticação, portanto não há base para afirmar que as atualizações diárias estão funcionando.

A causa operacional prioritária é a incompatibilidade entre o cookie/token entregue ao Heartbeat e a validação local em `sdk.authenticateRequest`. Não se deve criar outro bot ou outro schedule antes de corrigir e testar esse caminho, pois isso aumentaria o risco de duplicidade.

## Recomendação de correção
1. Corrigir a autenticação cron conforme o contrato do Heartbeat, mantendo a identificação por `user.taskUid` e rejeitando chamadas não cron.
2. Criar teste de integração do callback com a forma real de autenticação do cron e testar resposta 2xx, 403 e 500.
3. Salvar checkpoint, publicar e só então executar uma verificação controlada do Heartbeat.
4. Após uma execução bem-sucedida, revisar o Heartbeat diário e decidir se ele deve permanecer separado do schedule semanal ou ser consolidado para evitar ingestões redundantes.

Nenhuma configuração foi alterada durante esta auditoria.
