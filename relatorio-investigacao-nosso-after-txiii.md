# Investigação — Nosso After (Lucky Scope) / Ingresse

Data da investigação: 27/11/2026.

## URLs consultadas
- Ingresse: https://www.ingresse.com/nosso-after-after-oficial-da-txiii-med-unoeste/
- API pública tentada: https://api-site.ingresse.com/events/nosso-after-after-oficial-da-txiii-med-unoeste
- Instagram oficial relacionado: https://www.instagram.com/nossoafterguaruja/
- Referência pública: https://www.instagram.com/p/DdPf_SGj2E9/
- Referência pública: https://www.instagram.com/p/Dczl5kAADUn/

## Evidências externas
A página da Ingresse retornou CAPTCHA/loading e não expôs metadados do evento. A API pública da Ingresse para o slug retornou HTTP 403 com página Cloudflare; não houve contorno.

A publicação pública do Instagram DdPf_SGj2E9 informa Guarujá/Litoral, data 25/09, Lucky Scope e o evento “NOSSO AFTER X MANDELÃO WORLD”, com DJ Blakes. A publicação Dczl5kAADUn informa “NOSSO AFTER”, Guarujá-SP e DJ Glenner, em 06.SET. Essas publicações confirmam o contexto regional e recorrência da marca, mas não comprovam os metadados específicos do slug TXIII MED UNOESTE.

## Evidências de produção via tRPC somente leitura
Consulta autenticada `events.list` (size 100) retornou 18 eventos publicados; nenhum continha “Nosso After”, “Lucky Scope”, “TXIII”, “MED UNOESTE” ou o slug investigado.

Consulta `discovery.list` para candidatos pending/rejected (limite 200) não encontrou o slug nem a marca/evento alvo. O resultado rejected continha apenas um candidato Zig diferente (Réveillon Curvão 2027).

`ingestionSources.list` encontrou:
- `instagram:nossoafterguaruja`, nome Nosso After, habilitada, última tentativa 27/11/2026, status skipped por janela, último sucesso 22/11/2026, circuito closed.
- `public:ingresse:deriva-001-sem-rotas-definidas`, nome DERIVA_001 - Sem rotas definidas (Lucky Scope), URL diferente do slug investigado, habilitada, status succeeded, mensagem evento ID 38 presente.

`ingestionReports.summary` filtrado por `public:ingresse` mostrou runs históricos; os mais recentes bem-sucedidos registraram leitura de 7–9 itens, filtragem majoritariamente por evento passado e duplicidades. Não apareceu referência ao slug investigado. O run 46 foi falho com HTTP 500 por erro de consulta histórico, não relacionado diretamente ao slug.

## Código relevante
- `server/ingestion.ts`: `isIngresseEventUrl`, `parseIngresseEventPayload`, `fetchIngresseEventApi` usam `https://api-site.ingresse.com/events/<slug>`; a canonicalização remove parâmetros de rastreamento em helpers compartilhados, e o parser aceita payload JSON de título/data/local/descrição.
- `server/ingestion.ts`: `normalizeVenueCity` possui normalização explícita de Lucky Scope para Guarujá.
- `server/ingestion.ts`: a classificação exige evidência musical e não permite fallback genérico.
- `server/routers.ts`: `events.list`, `discovery.list`, `ingestionSources.list` e `ingestionReports.summary` foram consultados somente via GET tRPC; nenhuma mutação/varredura foi executada.

## Conclusão provisória
Com as evidências disponíveis, a causa exata não pode ser atribuída a cidade ou gênero do evento específico porque a página/API da Ingresse está bloqueada e nenhuma fonte pública indexada expôs os metadados do slug. O que foi confirmado é ausência de registro em `events`/candidatos consultáveis e ausência de referência do slug nos runs/relatório consultados. A hipótese operacional mais forte é falha de descoberta/captura da URL específica ou indisponibilidade/bloqueio da API da Ingresse; não há base segura para publicar ou alterar código/dados. Não executar mutação até obter metadados verificáveis do evento.
