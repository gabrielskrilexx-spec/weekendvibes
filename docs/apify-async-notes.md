# Apify — notas de implementação assíncrona

A documentação oficial do Apify indica que a API V2 permite iniciar Actors por endpoint de execução e acompanhar o progresso por polling do endpoint de consulta do run. Também é possível configurar webhooks para enviar POST ao servidor após eventos do Actor, incluindo `ACTOR.RUN.SUCCEEDED` e falhas, evitando manter a requisição inicial aberta.

Referências consultadas:

- https://docs.apify.com/academy/api/run-actor-and-retrieve-data-via-api — execução do Actor, recuperação de dados e webhooks.
- https://docs.apify.com/api/v2 — API V2, execução e monitoramento de Actors.
- https://docs.apify.com/integrations/webhooks/actions — ações e eventos de webhook, incluindo conclusão de runs.
- https://docs.apify.com/integrations/webhooks/ad-hoc-webhooks — webhooks ad hoc para runs iniciados via API.

Decisão preliminar: o endpoint público deve disparar o run assíncrono e retornar HTTP 202; o processamento do dataset deve ocorrer por webhook seguro ou worker controlado, com idempotência por `runId` e atualização de `ingestionRuns`.

## Validação adicional de Actors de Stories

Fontes adicionais consultadas:

- https://apify.com/automation-lab/instagram-stories-scraper
- https://apify.com/gordian/instagram-story-scraper/api
- https://apify.com/apify/instagram-scraper/input-schema
- https://apify.com/apify/instagram-scraper/issues/doesnt-get-stories-gC9D6s8yOhkWzwNMr

O Actor principal `apify~instagram-scraper` é documentado para posts, reels, perfis, locais, hashtags e comentários. O issue oficial consultado informa que `resultsType: "stories"` pode ser mapeado para reels na interface, portanto não é uma base confiável para Stories.

Actors específicos de Stories documentam campos como `mediaUrl`, `mediaType`, `timestamp`, `expiresAt`, `isHighlight` e `highlightTitle`. A documentação consultada também informa que alguns exigem um cookie `sessionid` no campo seguro `sessionCookie`; não se deve presumir coleta anônima apenas por o perfil ser público.

A configuração do pipeline deve usar usernames sem `@`, habilitar Highlights com os campos documentados pelo Actor e aceitar `mediaUrl`/`imageUrl` e `thumbnailUrl`. Quando o dataset contiver somente metadados de perfil ou nenhum item de mídia, o diagnóstico deve registrar isso explicitamente, sem converter o resultado em falso sucesso.
