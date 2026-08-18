# Referência de webhook para alertas operacionais

A documentação oficial do Discord confirma que incoming webhooks são endpoints HTTP vinculados a um canal, capazes de receber payloads POST e publicar mensagens sem exigir um bot user ou autenticação adicional além da própria URL do webhook.

Fontes consultadas:

- [Webhook Resource — Discord Developer Platform](https://docs.discord.com/developers/resources/webhook)
- [Webhooks — Discord Developer Platform](https://docs.discord.com/developers/platform/webhooks)

Decisão técnica: o WeekendVibes usará uma variável de ambiente `DISCORD_WEBHOOK_URL` no backend. A URL nunca será incluída em logs nem no conteúdo do alerta; a mensagem conterá somente o tipo de falha, timestamp e instrução para renovar manualmente o token do Instagram.
