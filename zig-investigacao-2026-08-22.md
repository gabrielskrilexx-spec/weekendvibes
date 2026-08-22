# Investigação Zig Tickets — 2026-08-22

Fonte analisada: https://zig.tickets/pt-BR

A página pública retornou conteúdo renderizado com catálogo de eventos e links internos no padrão `/eventos/{slug}`. O HTML/DOM exibiu títulos, datas, cidade e local em cards, por exemplo `Japa Faz a festa - CABELINHO`, `22 ago 2026`, `Vila Velha`, `Cafe de La Musique Vila Velha`, com href `/eventos/japa-faz-a-festa-cabelinho`. Também foram observadas rotas de categorias e imagens carregadas por `/_next/image`.

A evidência inicial indica que a página inicial não é uma fonte de eventos da Baixada Santista: os cards visíveis pertencem a Vila Velha, Lagoinha, São Paulo, Nova Prata, Belo Horizonte, Curitiba, Cariacica, São Gonçalo do Amarante, Sorocaba, Porto Seguro, Salvador, Brasília, Fortaleza, Vitória, Guarapari e Serra. Não foi encontrado card de Santos ou Guarujá no conteúdo público capturado.

Hipótese técnica: o adaptador anterior tratou a URL inicial como uma única fonte/evento e não percorreu as rotas internas `/eventos/{slug}`; mesmo que percorresse, a página analisada não apresentou eventos da Baixada Santista no catálogo atual. A correção deve extrair links internos, buscar cada detalhe quando necessário e manter a filtragem rígida de cidade/venue/data.

A investigação não autoriza adicionar venues da Zig à allowlist nem persistir eventos fora de Santos/Guarujá.
