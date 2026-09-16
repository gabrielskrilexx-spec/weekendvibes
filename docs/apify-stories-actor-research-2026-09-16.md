# Pesquisa de Actors Apify para Stories — 2026-09-16

## Fontes consultadas

1. [Apify Instagram Scraper](https://apify.com/apify/instagram-scraper)
   - Actor oficial, mantido pela Apify.
   - A página descreve extração de posts, reels, perfis, lugares, hashtags, carrosséis e comentários.
   - A página não documenta Stories/Highlights como tipo principal de saída; portanto, não é uma substituição comprovada para Stories sem validar o schema/runtime.
   - ID público: `apify~instagram-scraper`.

2. [Instagram Stories & Highlights Scraper — Content Archive](https://apify.com/oneary/instagram-stories-and-highlights-scraper)
   - Actor comunitário dedicado a Stories e Highlights.
   - A página afirma entregar URLs de mídia, timestamps e metadados de contas públicas, com saída JSON estruturada.
   - Página observada em 2026-09-16: 0 avaliações, 104 usuários totais, 16 usuários ativos no mês e última modificação indicada como há um mês.
   - ID público: `oneary~instagram-stories-and-highlights-scraper`.
   - O schema completo de entrada/saída ainda precisa ser confirmado pela aba Input/API ou por uma execução autorizada; não assumir nomes de campos antes dessa confirmação.

## Decisão provisória

Não trocar o Actor em produção apenas com base em snippets. O Actor comunitário `oneary~instagram-stories-and-highlights-scraper` é o candidato mais alinhado funcionalmente, mas exige confirmação de schema, disponibilidade e permissão do token. O Actor oficial `apify~instagram-scraper` é mais confiável como fornecedor, porém a documentação visual consultada não comprova Stories/Highlights.

## Regras de segurança

A pesquisa foi passiva. Não foram executadas chamadas reais, não foram expostos tokens/cookies e não foi assumido que um Actor comunitário oferece o mesmo contrato do Actor despublicado. A migração deve manter tratamento de HTTP 404/400, Circuit Breaker e mapeamento defensivo de mídia/timestamp.

## Schema confirmado do candidato dedicado

A aba Input do Actor `oneary~instagram-stories-and-highlights-scraper` mostra os campos `username` (obrigatório, string), `includeStories` (boolean, padrão true), `includeHighlights` (boolean, padrão true), `maxItems` (inteiro, padrão 50) e `proxy` (objeto). O exemplo JSON exibido usa `username: "nasa"`, os dois flags de inclusão, `maxItems: 50` e proxy com `useApifyProxy: true` e `apifyProxyGroups: ["RESIDENTIAL"]`.

A página observada indica que o Actor é mantido pela comunidade, custa US$ 10 por 1.000 resultados, tem nota 0.0 sem avaliações, 104 usuários totais, 16 usuários ativos no mês e foi modificado há aproximadamente um mês. O schema visual consultado não mostra `sessionCookie`; portanto, o payload atual do projeto não deve enviar esse campo sem confirmação adicional do contrato/API. O mapeamento de saída também não foi exibido na aba Input e precisa ser confirmado antes de uma execução real.

## API do candidato

A aba API do Actor mostra o ID `oneary/instagram-stories-and-highlights-scraper` no cliente Apify, com execução que aguarda a conclusão e leitura do dataset padrão (`run.defaultDatasetId`). A própria página orienta substituir o placeholder pelo token Apify autorizado. A documentação exibida confirma que a integração pode ser feita via API/SDK, mas não expõe nesta tela o schema detalhado de cada item de saída; por isso o mapeamento deve aceitar aliases defensivos (`mediaUrl`, `media_url`, `displayUrl`, `imageUrl`, `thumbnailUrl`, `postedAt`, `timestamp`, `expiresAt`, `username`) e registrar itens incompatíveis como descartados conhecidos, nunca como eventos válidos.

## Candidato alternativo com entrada em lote

O Actor `zaver.api~instagram-stories-highlights-scraper` apresenta entrada por array `instagramProfiles` (nomes de usuário ou URLs, um por item), `scrapeType` com opções `both`, `stories` e `highlights`, `maxHighlights` e `onlyNew`. A página indica que contas privadas não podem ser coletadas e que o modo `onlyNew` é destinado a monitoramento agendado.

O schema de saída documenta os campos `source_username`, `source_user_id`, `item_type` (`story` ou `highlight`), `highlight_title`, `highlight_id`, `media_id`, `media_type`, `image_url`, `video_url`, `video_duration`, `taken_at`, `expiring_at`, `accessibility_caption`, `link_urls`, `mentions`, `hashtags`, `location` e `error`. A página observada indica preço a partir de US$ 7,20 por 1.000 mídias, 0 avaliações, 1 usuário total, 0 usuários ativos no mês e modificação há quatro dias. Apesar da baixa adoção, este contrato se alinha melhor ao pipeline atual por aceitar múltiplos perfis e documentar explicitamente URLs, timestamps e erros por item.

## Seleção técnica provisória

Para reduzir a mudança arquitetural, `zaver.api~instagram-stories-highlights-scraper` é o candidato funcionalmente mais compatível. A baixa adoção exige uma execução autorizada de smoke test antes de substituir o Actor em produção; até essa confirmação, a migração deve permanecer configurável por variável de ambiente e protegida pelo Circuit Breaker.

## Correção confirmada pelo smoke test e exemplo JSON

A primeira execução do smoke test retornou HTTP 400 com `Input is not valid: Field input.targets is required`. A página oficial do schema e o exemplo JSON confirmam que o nome técnico correto é `targets`, não `instagramProfiles`. O exemplo usa `targets: ["nasa"]`, `scrapeType: "both"`, `maxHighlights: 100` e `onlyNew: false`. A implementação deve enviar `targets` e limitar `maxHighlights` para reduzir custo/tempo.
