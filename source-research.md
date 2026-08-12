# Pesquisa de fontes públicas — ingestão WeekendVibes

## Fontes consultadas

### Prefeitura de Santos
URL: https://www.santos.sp.gov.br/?q=noticia/confira-a-agenda-cultural-em-santos

A página oficial publica agendas culturais com períodos, horários, locais, preços e descrições em texto livre. O conteúdo está em HTML público e inclui notícias recorrentes de cultura, shows e filmes. É uma boa fonte complementar e institucional para Santos, mas a estrutura é editorial, com variação de formato e possível necessidade de seguir links das notícias mais recentes.

### Prefeitura de Guarujá
URL: https://www.guaruja.sp.gov.br/guaruja-seu-amor-no-verao-segue-com-programacao-de-shows-neste-fim-de-semana

A página oficial consultada retornou proteção por CAPTCHA no navegador automatizado. Não deve ser usada como única fonte sem uma autorização/integração própria; pode permanecer como fonte manual ou ser consultada apenas quando acessível publicamente.

### Juicy Santos — agenda regional
URL: https://www.juicysantos.com.br/santos-baixada-santista-hoje/

A agenda pública apresenta cards de eventos com título, URL individual, imagem, data/período, horário, local e preço. A página é HTML acessível e mostra eventos atuais de Santos e Baixada Santista. É adequada para um adaptador determinístico, com filtragem posterior para Santos e Guarujá e classificação musical pelo pipeline de LLM. A página também expõe a seção de agenda em /eventos-na-regiao/.

## Opções de arquitetura

1. Usar o Juicy Santos como fonte primária de agenda pública, com a Prefeitura de Santos como fonte complementar. Vantagens: HTML estruturado em cards, links individuais e imagens; desvantagens: dependência de uma fonte editorial de terceiros e cobertura possivelmente desigual de Guarujá.

2. Usar somente fontes oficiais municipais. Vantagens: maior autoridade institucional; desvantagens: Guarujá apresentou CAPTCHA na consulta e formatos editoriais variáveis tornam a automação menos estável.

3. Usar uma API agregadora de eventos. Vantagens: dados mais uniformes; desvantagens: APIs confiáveis normalmente exigem chave, limites ou contrato comercial, e a cobertura local precisa ser verificada.

## Recomendação técnica provisória

A opção mais prática para a primeira versão é o Juicy Santos como fonte pública primária, com validação rígida de cidade, data, categoria e gênero no servidor. A Prefeitura de Santos pode ser uma segunda fonte complementar. Para Guarujá, a cobertura precisa ser monitorada; se a fonte pública não fornecer eventos suficientes, será necessário adicionar outra fonte permitida pelo respectivo site ou um fluxo de cadastro manual.

## Pesquisa dirigida pelos locais informados

### Articket
A home pública da Articket lista eventos com data, hora, título, local e links individuais. Entre os resultados visíveis, apareceu `Plants Happy Hour` no `Verilonguinho` em 14/08 às 23:00. A busca também encontrou:

- `FEXTA FORTE - VALLUN GARDEN`: https://articket.com.br/e/2752/fexta-forte-vallun-garden — Vallum Garden, R. Tuyuti, 86, Centro, Santos-SP.
- `AFTER DA MEGA`: https://articket.com.br/e/6382/after-da-mega — Vallum Garden, Centro de Santos.
- `360° WORLD – OPEN BAR`: https://articket.com.br/e/5880/360-world-open-bar — Vallum Garden, Rua Conde D'eu 42, Santos.
- `Plants Happy Hour`: evento destacado na home da Articket, associado ao Verilonguinho.

### Blacktag
A busca pública encontrou páginas individuais do Moby House associadas ao Moby Dick, Avenida Vicente de Carvalho, 30, Boqueirão, Santos-SP:

- `Moby House - Arana Edition`: https://blacktag.com.br/eventos/26674/moby-house-blakes-edition
- `Moby House de Férias com KEW`: https://blacktag.com.br/eventos/30154/moby-house-de-ferias-com-kew
- `Moby House na Copa | Kew e Mene Men`: https://blacktag.com.br/eventos/32519/moby-house-na-copa-kew-e-mene-men
- `Moby House - SUBMUNDO`: https://blacktag.com.br/eventos/27072/moby-house-submundo
- `Moby House com Mc Kako`: https://blacktag.com.br/eventos/25314/moby-house-com-mc-kako

Também foi encontrado `BCKSTG & SOLÉ - Verilonguinho | Inauguração Oficial`: https://blacktag.com.br/eventos/22930/bckstg-sole-verilonguinho-inauguracao-oficial — Verilonguinho, Rua do Comércio 72, Centro, Santos-SP.

Nenhuma página pública atual foi localizada ainda para Lucky Scope, Curvão Surf House ou Meu Lugar. O resultado de Curvão Surf House confirma o endereço público da casa na Av. Miguel Estefno, 2435, Guarujá, mas não fornece por si só um evento atual nas plataformas indicadas.

## Validação do adaptador Articket/Blacktag

A execução real do adaptador descobriu 24 URLs, mas nenhuma página expôs os seis locais no HTML textual estático consumido por `fetch`. A página `https://articket.com.br/e/6784/plants-happy-hour` renderiza os sinais de `Verilonguinho`, `Plants Santos` e links de mapa no navegador, porém o HTML salvo para inspeção não trouxe esses termos de forma acessível ao parser simples. Isso indica que Articket/Blacktag dependem de renderização dinâmica ou dados embutidos em scripts; o adaptador não deve afirmar que encontrou eventos enquanto `matchedSources` for zero.

## URL fornecida: Zig Tickets — Festa do Branco 22-08
Fonte: https://zig.tickets/eventos/festa-do-branco-22-08

Dados observados em 12 de agosto de 2026: título "FESTA DO BRANCO 22-08"; início em 22 de agosto de 2026 às 20:00; término em 23 de agosto de 2026 às 03:00; endereço Avenida Miguel Estefno, 2435, Enseada, Guarujá, SP - 11440-531; classificação 18 anos; preço a partir de R$ 0,00; produtor CURVAO SURF HOUSE; line-up informado: ANALU, MONTARROYOS e LARA SELINE; descrição pública informa música, experiências e celebração com dress code branco. A página inclui link de mapa do Google e imagem pública hospedada em superticket-assets.s3.amazonaws.com. Evento elegível pelo recorte geográfico e musical do WeekendVibes, com gênero a confirmar por enriquecimento sem inventar informação.

## URL fornecida: Ingresse — Nosso After MC Luuky
Fonte fornecida: https://www.ingresse.com/nosso-after-mc-luuky/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAcGRvZgJleHRuA2FlbQIxMQBzcnJjBmFwcF9pZA85MzY2MTk3NDMzOTI0NTkAAacMXCTbasO9hsogEWxL6cZFxBNbdIIrStoScy5qetw3_7snMankuC97VHoywQ_aem_Lakl4BzsZ7vS0-ggGuLXww&utm_id=97760_v0_s00_e0_tv3

Na consulta pública de 12 de agosto de 2026, a página permaneceu em estado de carregamento e o conteúdo textual não expôs título, data, horário, local, cidade, preço ou imagem do evento. A URL deve ser preservada como fonte futura para coleta renderizada, mas não há dados suficientes para criar o evento sem inventar informações. Será necessário que o agente navegador aguarde a hidratação da página ou consulte o endpoint público documentado pela própria plataforma, se disponível.

## Fonte complementar: Blacktag — Nosso After - 16/08
URL: https://blacktag.com.br/eventos/28254/nosso-after-16-08

A página pública confirma o evento no Lucky Scope, espaço Diamond, Praça Doutor Walter Beliam, 86, Guaiúba, Guarujá, SP, às 23:00 de sábado 16 de agosto. A descrição informa Baile do DJ FGOMEZ, com funk como cenário principal e gêneros HIP-HOP, ELETRO, TRAP e FUNK. A imagem pública é https://d106p58duwuiz5.cloudfront.net/event/cover/fbf75b0b9e695ff704bf0b9cc9b7fba9.png. A página indica vendas encerradas. Esta fonte não é a mesma edição futura da URL Ingresse/MC Luuky de 28 de agosto, mas confirma o local e a recorrência do projeto Nosso After; não deve ser confundida com o evento MC Luuky.

## Fonte complementar: busca pública sobre Ingresse — Nosso After MC Luuky
Resultados públicos indicam 28 de agosto de 2026, 23:00, Lucky Scope, Guarujá, com MC Luuky. Como a página Ingresse permaneceu em loading e a fonte complementar não expôs endereço completo ou preço verificável, o registro deve ser criado somente com os campos confirmados e marcado sem preço/endereço detalhado até nova coleta renderizada.

## Validação do feed público
A prévia pública do WeekendVibes carregou 2 rolês após a API responder: Festa do Branco, Guarujá, sábado 22 de agosto, Curvão Surf House, categoria balada e gênero House/Eletrônica; Nosso After - MC Luuky, Guarujá, sexta 28 de agosto, Lucky Scope, categoria balada e gênero Funk. O mapa também exibiu dois pins. Os filtros públicos de cidade, categoria, gênero e preço estavam visíveis.
