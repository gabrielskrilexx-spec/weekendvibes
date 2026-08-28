# Apify — notas de implementação assíncrona

A documentação oficial do Apify indica que a API V2 permite iniciar Actors por endpoint de execução e acompanhar o progresso por polling do endpoint de consulta do run. Também é possível configurar webhooks para enviar POST ao servidor após eventos do Actor, incluindo `ACTOR.RUN.SUCCEEDED` e falhas, evitando manter a requisição inicial aberta.

Referências consultadas:

- https://docs.apify.com/academy/api/run-actor-and-retrieve-data-via-api — execução do Actor, recuperação de dados e webhooks.
- https://docs.apify.com/api/v2 — API V2, execução e monitoramento de Actors.
- https://docs.apify.com/integrations/webhooks/actions — ações e eventos de webhook, incluindo conclusão de runs.
- https://docs.apify.com/integrations/webhooks/ad-hoc-webhooks — webhooks ad hoc para runs iniciados via API.

Decisão preliminar: o endpoint público deve disparar o run assíncrono e retornar HTTP 202; o processamento do dataset deve ocorrer por webhook seguro ou worker controlado, com idempotência por `runId` e atualização de `ingestionRuns`.
