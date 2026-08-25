# Auditoria pública de fontes — 2026-08-25

## Black Pass

URL consultada: https://blackpass.com.br/

A página pública renderiza um catálogo “Próximos Eventos”, com filtro por nome e data. Foram observados links internos no padrão `/event/{id}` e metadados visíveis com título, venue, data civil, horário e imagem. Exemplos públicos observados: `Jungle Room • Pink Edition • 04.09` no `GOAT CLUB`, em 4 de setembro às 23:00, e `Reveillon Delmare` no `Ilha Porchat Clube`, em 31 de dezembro às 22:00. As imagens são servidas por `api.blackpass.com.br` via Next Image. O adapter deve coletar somente páginas públicas, validar o HTML/JSON acessível e não depender de login.

## Mr Ingressos

URL consultada: https://mringressos.com.br/

A página pública lista eventos com links no padrão `/comprar/{id}/{slug}` e metadados de título, data, horário, venue/cidade e imagem. Foram observados eventos públicos como `Se beber Não Case` no `Dolores Bar e Restaurante - Guarujá, SP`, `Isso é Boteco` no `Boteco Almare - Guarujá, SP`, `Davi Quaresma` no `Projac - Guarujá, SP` e `Baile Charme` no `G.R.C.E.S. X9 - Santos, SP`. O portal também exibe eventos fora da allowlist, portanto o adapter deve extrair candidatos e deixar a validação determinística de cidade/venue do WeekendVibes rejeitar locais não oficiais.

## Decisões operacionais

A coleta deve ser passiva e pública. Não foram usados login, CAPTCHA, scraping autenticado, rotação de IP ou contorno de bloqueios. Os adapters devem preservar `sourceUrl`, distinguir preço não informado de gratuidade, validar datas no fuso `America/Sao_Paulo` e aceitar somente Santos/Guarujá e venues da allowlist oficial.

## Auditoria de debug — 2026-08-25

A consulta pública ao Black Pass respondeu com conteúdo de eventos acessível, incluindo dois links `/event/700` e `/event/692`, títulos, venues e horários. Isso indica que a origem não está vazia no navegador; o ponto a verificar no worker é a descoberta/normalização do HTML recebido pelo `fetch`.

A consulta pública ao Mr Ingressos respondeu com catálogo preenchido, incluindo links `/comprar/442/se-beber-nao-case`, `/comprar/439/isso-e-boteco`, `/comprar/415/davi-quaresma` e outros. O catálogo mistura venues oficiais e não oficiais, confirmando que o filtro de allowlist precisa ocorrer após a descoberta. Nenhuma sessão autenticada foi usada nesta auditoria.

## Diagnóstico do catálogo Black Pass

O HTML inicial do Black Pass é uma casca Next.js com `__NEXT_DATA__` sem eventos úteis e sem links `/event/` no HTML recebido pelo worker. O bundle público referencia `https://api.blackpass.com.br` e o caminho `/events/list`. A resposta pública desse endpoint contém uma lista JSON de eventos, com campos de identificação, título, poster, endereço, `address_comp`, `latlng` e uma lista `dates` com início/fim. Portanto, o adapter não deve depender de links descobertos na Home; deve consultar apenas esse endpoint público, validar schema, filtrar cidade/venue/data e montar a URL canônica `/event/{id}`. Dados pessoais presentes em campos auxiliares foram deliberadamente omitidos deste registro.
