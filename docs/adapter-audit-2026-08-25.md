# Auditoria de adaptadores — 25/08/2026

## Black Pass
A página `https://blackpass.com.br/events` entregou cards visíveis no HTML renderizado e links internos no padrão `/event/{id}`. Foram observados `Jungle Room • Pink Edition • 04.09`, venue `GOAT CLUB`, data exibida `4 de setembro - 23:00`, e `Reveillon Delmare`, venue `Ilha Porchat Clube`, `31 de dezembro - 22:00`. As imagens vieram por URLs de `api.blackpass.com.br` dentro de `/_next/image`. O adaptador deve reconhecer `/events` como catálogo, extrair âncoras `/event/`, e tratar a página de detalhe como fonte de metadados.

## Mr Ingressos
A home `https://mringressos.com.br/` entregou cards e links de compra no padrão `/comprar/{id}/{slug}` no conteúdo renderizado. Exemplos observados: `Se beber Não Case` — `Dolores Bar e Restaurante - Guarujá, SP` — `28 AGO · 19h00`; `Isso é Boteco` — `Boteco Almare - Guarujá, SP` — `29 AGO · 22h00`; `Davi Quaresma` — `Projac - Guarujá, SP` — `30 AGO · 17h00`. Também foram observados links para `Baile Charme` em Santos e outros eventos de Guarujá. O catálogo deve reconhecer `/comprar/`, e o parser precisa aceitar cartões repetidos entre a seção de destaque e a seção geral, deduplicando pela URL.

## Decisão técnica
A implementação deve manter extração passiva, sem login ou evasão de controles. Falhas de fetch, parsing ou ausência de links devem ser retornadas em `sourceReports` por adaptador, com mensagens sanitizadas e status HTTP quando disponível, para diferenciar `fetchFailed`, `parseFailed` e catálogo vazio no Dry-run.
