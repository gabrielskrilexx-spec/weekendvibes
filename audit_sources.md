# Referências externas para a auditoria estratégica

## Acessibilidade
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*: https://www.w3.org/TR/WCAG22/
- Pontos usados: WCAG 2.2 é a recomendação atual do W3C; organiza acessibilidade nos princípios perceptível, operável, compreensível e robusto; recomenda combinar testes automatizados e avaliação humana; níveis A, AA e AAA.

## SEO e eventos
- Google Search Central, *Event structured data*: https://developers.google.com/search/docs/appearance/structured-data/event
- Pontos usados: páginas individuais de evento podem usar JSON-LD `Event`; cada evento deve ter URL única e marcação na página-folha; propriedades como nome, data inicial, local, imagem, descrição, oferta e status devem ser precisas; validar com Rich Results Test e enviar sitemap.
- O guia informa disponibilidade da experiência de eventos do Google para o Brasil em português.

## Desempenho
- web.dev, *Web Vitals*: https://web.dev/articles/vitals
- Pontos usados: Core Web Vitals devem ser medidos em campo; metas recomendadas no percentil 75 são LCP <= 2,5 s, INP <= 200 ms e CLS <= 0,1; medições reais complementam testes de laboratório; a biblioteca `web-vitals` pode instrumentar LCP, INP e CLS.

## Evidências internas observadas no projeto
- `client/index.html`: idioma declarado como `en`; viewport usa `maximum-scale=1`; não há description, canonical, manifest, robots ou sitemap referenciados.
- `client/src/pages/Home.tsx`: feed carrega até 40 eventos; busca textual é filtrada no cliente somente por título e `locationName`; o mapa recebe a coleção filtrada.
- `server/db.ts`: escopo rígido Santos/Guarujá e quatro gêneros; favoritos/lembretes existem, mas não há consulta de métricas, venue pages, fila de reprocessamento ou entrega visível de lembretes; não há paginação total ou ranking de busca.
- `client/src/components/RegionalEventMap.tsx`: geolocalização e cálculo de distância/tempo são client-side; estimativas usam velocidades médias, não uma API de rotas/trânsito; eventos sem coordenadas ficam fora do mapa.
- `client/src/pages/Admin.tsx`: painel é CRUD/enriquecimento + rotina de terça-feira; não possui relatórios, fila de falhas, reprocessamento por fonte, revisão editorial ou saúde por integração.
- Produção observada em 12/08/2026: Home exibiu 7 eventos, 3 da Agenda da Semana, 4 regiões no mapa e mensagem de ausência de eventos para o dia atual; os 3 eventos de Instagram estavam sem coordenadas, portanto não apareciam no mapa.
