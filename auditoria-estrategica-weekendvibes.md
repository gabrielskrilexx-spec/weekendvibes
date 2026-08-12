# Auditoria estratégica do WeekendVibes

**Data da análise:** 12 de agosto de 2026.  
**Escopo:** produto, experiência mobile, acessibilidade, descoberta de eventos, mapa, compartilhamento, ingestão, operação, SEO, desempenho, dados e crescimento.

## 1. Resumo executivo

O WeekendVibes já deixou de ser apenas uma página de agenda e se tornou um produto de descoberta local com cinco pilares importantes: catálogo restrito a Santos e Guarujá, filtros por cidade/categoria/gênero/local, Agenda da Semana alimentada por Instagram, mapa regional e mecanismos de engajamento como favoritos, lembretes e compartilhamento social. A base funcional é consistente e a identidade visual tropical está bem definida.

O principal gargalo agora não é adicionar mais controles à interface, mas **aumentar a confiança, a cobertura e a conversão do catálogo**. Na produção analisada, a Home exibiu sete eventos, três vindos da Agenda da Semana e quatro regiões no mapa. Os três eventos capturados do Instagram estavam sem latitude e longitude; por isso, ficaram fora do mapa. O usuário também encontra estados vazios legítimos, como “não há eventos confirmados para hoje”, mas ainda falta transformar esses estados em caminhos úteis para a próxima ação.

A recomendação central é concentrar o próximo ciclo em três resultados mensuráveis: **mais eventos válidos com localização e dados completos**, **mais descoberta e compartilhamento por evento** e **mais controle operacional sobre a ingestão**. Recursos novos devem ser avaliados contra esses resultados, evitando aumentar a complexidade sem melhorar a jornada.

## 2. Diagnóstico por área

| Área | Situação observada | Impacto | Prioridade |
|---|---|---:|---:|
| Cobertura e qualidade do catálogo | O catálogo tem apenas sete eventos visíveis na produção analisada; parte da Agenda da Semana não possui coordenadas. | Alto | P0 |
| Descoberta | Filtros são bons e combináveis, mas a busca textual é limitada e não há ordenação inteligente ou páginas por estabelecimento. | Alto | P1 |
| Conversão | O produto já possui “Ver evento”, favoritos, lembretes e compartilhamento, mas ainda não mede o funil por ação. | Alto | P1 |
| Operação | Alertas e rotina automática existem, porém faltam relatórios, fila de reprocessamento e revisão editorial estruturada. | Alto | P0 |
| SEO | A página pública ainda não declara português no HTML e não há evidência de `description`, canonical, sitemap ou JSON-LD de evento. | Alto | P0 |
| Acessibilidade | Houve investimento relevante em foco, tema, alto contraste e teclado; ainda é necessário validar com leitor de tela e zoom real. | Médio/alto | P1 |
| Desempenho | O mapa carrega recursos do Google Maps e múltiplas imagens; não há medição de Core Web Vitals de campo. | Médio/alto | P1 |
| Diferenciação | A identidade tropical e o foco geográfico são claros, mas o produto ainda pode se tornar mais útil pela confiança dos dados e personalização. | Médio | P1 |

## 3. O que está funcionando

A proposta de valor é imediatamente compreensível: encontrar shows, baladas e eventos musicais da Baixada Santista. A combinação de Santos e Guarujá é suficientemente específica para evitar um agregador genérico, e os gêneros Funk, House/Eletrônica, Samba/Pagode e Rap/Trap dão ao catálogo uma taxonomia reconhecível.

A Home tem uma hierarquia razoável: hero, Agenda da Semana, “O que fazer hoje”, filtros, feed e mapa. A observação da versão publicada confirmou que o carregamento assíncrono muda de estado de forma clara, e que a Agenda da Semana consegue mostrar imagens oficiais e links para detalhes. O mapa também apresenta agrupamentos por região, ações de rota e seletor de transporte, o que é uma diferenciação funcional relevante para um produto local.

A acessibilidade visual evoluiu acima do padrão inicial: há tema claro, alto contraste, foco visível, rótulos para controles e preferência persistente. O próximo passo deve ser transformar esse bom trabalho visual em uma política testável de acessibilidade, incluindo leitor de tela, zoom de 200% e fluxos de erro.

## 4. Oportunidades prioritárias

### P0 — Qualidade de dados e cobertura geográfica

A primeira oportunidade é resolver a ausência de coordenadas na ingestão do Instagram. Os eventos do Meu Lugar Bar tinham endereço textual, mas não latitude/longitude, enquanto eventos de outras fontes já apareciam no mapa. Isso cria uma inconsistência perceptível: o evento existe no feed, porém não existe na camada espacial. A solução recomendada é uma fila de geocodificação assíncrona, com normalização de endereço, cache por endereço, confiança do resultado e revisão manual para casos ambíguos.

A mesma camada deve registrar `geocodingStatus`, `geocodingProvider`, `geocodingConfidence` e `geocodedAt`. Não se deve transformar automaticamente qualquer texto em coordenada sem validação, pois um ponto incorreto pode levar o usuário a um endereço errado. O cartão do evento pode exibir “localização em confirmação” quando a precisão não for suficiente.

### P0 — SEO técnico e páginas indexáveis

O HTML público analisado declara `lang="en"`, embora todo o produto esteja em português. Também não há evidência no `index.html` de descrição, canonical, manifest, robots ou sitemap. Para um catálogo local, isso reduz a capacidade de cada evento ser encontrado por buscas como “pagode em Santos sexta-feira”.

A correção mínima é declarar `lang="pt-BR"`, configurar title e description por rota, canonical por URL e meta tags sociais. Cada página de detalhe deve incluir JSON-LD `Event` com nome, data, local, endereço, imagem, descrição, status e oferta somente quando o preço for realmente conhecido. O Google recomenda que cada evento tenha uma URL única e marcação na página-folha; também recomenda validar com Rich Results Test e manter sitemap atualizado [2].

Essa recomendação é especialmente adequada ao WeekendVibes porque o Google informa disponibilidade da experiência de eventos para o Brasil em português [2]. É importante não marcar como preço “R$ 0,00” um evento cujo preço é desconhecido; o modelo atual já diferencia preço desconhecido, e essa distinção deve ser preservada no JSON-LD.

### P0 — Operação da ingestão como produto interno

A automação de Apify, OCR e OpenAI está madura, mas o painel administrativo ainda precisa evoluir de “status e acionamento” para uma central operacional. Recomendo uma fila de execuções com origem, início, fim, duração, itens capturados, itens aceitos, descartes por filtro, duplicatas, erros e última mensagem. Cada falha deve permitir reprocessamento idempotente da fonte ou do item, sem repetir todo o ciclo.

O painel também deve mostrar a saúde por fonte: Articket, Blacktag, Zig, Ingresse e cada conta de Instagram. Uma fonte sem novos eventos por várias semanas não é necessariamente saudável; deve haver diferença entre “nenhum evento encontrado”, “fonte indisponível” e “fonte não processada”.

### P1 — Busca e descoberta mais inteligentes

A busca atual ajuda a encontrar título e estabelecimento, mas a descoberta pode melhorar com tolerância a acentos, sinônimos e termos comuns. “Pagode”, “samba”, “roda de samba” e “feijuca” deveriam conduzir a resultados relacionados sem alterar a taxonomia oficial. A busca também deve considerar descrição, atrações, bairro e nome normalizado do local.

Depois da busca textual, a próxima melhoria de maior impacto é ordenar resultados por relevância contextual: proximidade da data, qualidade dos dados, disponibilidade de ingresso, preferência salva e distância do usuário, sempre deixando claro por que um resultado aparece primeiro. A ordenação não deve esconder eventos; filtros e ordenação precisam ser independentes.

### P1 — Páginas de estabelecimento

Os eventos já usam locais recorrentes, como Meu Lugar Bar, Curvão Surf House, Lucky Scope e Laroc Club Guarujá. Uma página de estabelecimento criaria uma unidade de navegação persistente, com endereço, mapa, próximos eventos, gêneros mais frequentes, links oficiais e aviso de última atualização. Isso melhora SEO, recorrência e confiança sem exigir uma rede social completa.

O modelo deve separar local físico de evento. Um estabelecimento pode alterar nome, endereço, redes ou capacidade; os eventos permanecem históricos. Também é importante não criar avaliações ou depoimentos fictícios. Qualquer reputação futura deve vir de dados reais e identificados.

### P1 — Conversão e engajamento mensuráveis

Favoritos, lembretes e compartilhamento já estão implementados, mas ainda falta medir o funil: visualização de card, abertura de detalhe, clique em ingresso, clique em rota, favorito, lembrete, compartilhamento e cópia de link. Esses eventos devem ser agregados de forma anônima e respeitar a política de privacidade.

O próximo recurso de maior valor é um lembrete realmente entregue, não apenas registrado. Pode começar por notificação no navegador ou e-mail, com consentimento explícito, horário configurável e cancelamento fácil. A rotina deve considerar eventos arquivados, vendidos ou alterados para não notificar conteúdo desatualizado.

### P1 — Melhor uso dos estados vazios

A mensagem “Ainda não há eventos confirmados para hoje” é honesta, mas pode ser mais útil. O estado vazio deve oferecer ações como “Ver sexta-feira”, “Ver sábado”, “Explorar Santos”, “Explorar Guarujá” e “Ver Agenda da Semana”. Em um produto de agenda, o vazio não deve ser um beco sem saída.

O mesmo vale para eventos sem preço, sem imagem, sem coordenadas ou com vendas encerradas. Cada ausência deve explicar o motivo e sugerir a próxima ação. A transparência aumenta confiança mais do que preencher lacunas com informação estimada sem origem.

## 5. Acessibilidade: pontos fortes e próximos testes

O projeto já tem foco visível, alternância de tema, alto contraste, rótulos e ações de teclado. Isso cobre uma parte importante dos princípios “perceptível” e “operável”. A WCAG 2.2 organiza a acessibilidade em quatro princípios — perceptível, operável, compreensível e robusto — e recomenda combinar testes automatizados com avaliação humana [1].

A próxima auditoria deve testar os fluxos completos: abrir e fechar mapa em tela cheia com teclado, navegar pelos agrupamentos, abrir popups, selecionar transporte, usar filtros sem mouse, editar a mensagem do WhatsApp, ativar alto contraste e recuperar de erro de localização. Também deve verificar zoom de 200% e 400%, orientação paisagem, leitura por NVDA/VoiceOver e ausência de foco preso.

Há uma decisão técnica importante: o `index.html` usa `maximum-scale=1`, que pode impedir ou limitar zoom de pinça em alguns navegadores. Para baixa visão, isso é uma barreira desnecessária; recomendo remover essa restrição e validar o layout com zoom. A página também deve declarar `lang="pt-BR"` para que leitores de tela usem pronúncia e regras linguísticas apropriadas.

## 6. Desempenho e experiência mobile

A Home combina imagens de eventos, carrossel, feed, mapa Google e chamadas de dados. Em conexões móveis lentas, a prioridade deve ser mostrar primeiro o hero, busca e primeiros eventos; o mapa pode carregar sob demanda quando o usuário alcançar a seção ou tocar em “Explorar no mapa”. Isso reduz custo inicial e evita carregar mapas para quem só quer ver a agenda.

Recomendo imagens responsivas com `srcset`, dimensões reservadas, compressão WebP/AVIF quando permitido e `loading="lazy"` para cards abaixo da primeira tela. O carrossel da Agenda da Semana deve ter altura previsível para evitar deslocamento de layout. O mapa deve ter um placeholder de altura fixa e só montar o SDK quando necessário.

O desempenho deve ser medido em campo, não apenas localmente. Core Web Vitals recomendam acompanhar LCP, INP e CLS; as referências correntes indicam como metas no percentil 75 LCP de até 2,5 s, INP de até 200 ms e CLS de até 0,1 [3]. A biblioteca `web-vitals` pode enviar essas métricas ao endpoint analítico já existente.

## 7. Dados e modelo de domínio

O modelo atual já diferencia publicação, arquivamento, status de ingresso, origem e hash de deduplicação. As próximas extensões deveriam consolidar entidades e estados em vez de espalhar regras pelo frontend.

| Entidade recomendada | Responsabilidade |
|---|---|
| `venues` | Nome normalizado, endereço, cidade, coordenadas, precisão, links oficiais e histórico de atualização. |
| `event_sources` | URL, tipo de fonte, conta, última execução, política de confiança e estado operacional. |
| `ingestion_runs` | Execução, métricas, duração, erros, itens capturados, aceitos e descartados. |
| `ingestion_items` | Texto bruto, OCR, hash, decisão do filtro, motivo de descarte e vínculo ao evento. |
| `event_changes` | Histórico de data, local, preço, status, imagem e origem da mudança. |
| `notification_deliveries` | Lembrete, canal, horário, status de entrega, falha e cancelamento. |

A origem deve ser preservada em cada campo sensível, não apenas no evento inteiro. Por exemplo, data extraída do OCR, endereço confirmado pela página oficial e preço consultado em uma fonte de ingresso têm níveis de confiança diferentes. Isso permite explicar ao usuário por que um valor está “não informado” e ao administrador revisar apenas os campos frágeis.

## 8. Produto e crescimento

O posicionamento pode evoluir de “lista de eventos” para “assistente de fim de semana”. Para isso, a Home poderia oferecer uma escolha rápida: cidade, dia, gênero e faixa de horário. O resultado seria um feed pessoal, sem exigir cadastro inicial. O cadastro entraria apenas quando o usuário quisesse favoritar, lembrar ou receber notificações.

Uma segunda frente é o calendário editorial. Além de eventos individuais, o sistema pode formar coleções reais e verificáveis, como “Sábado de pagode em Santos”, “Eletrônica no Guarujá” ou “Eventos gratuitos confirmados”. Essas coleções devem ser geradas a partir dos eventos existentes, com regras explícitas e sem inventar avaliações, popularidade ou disponibilidade.

Uma terceira frente é a distribuição: páginas indexáveis, card social, WhatsApp e links de estabelecimento. O crescimento local provavelmente virá mais de compartilhamentos e buscas por evento do que de uma navegação recorrente sem intenção. Por isso, cada detalhe de evento deve ser uma landing page completa e rápida.

## 9. Backlog priorizado

| Horizonte | Entrega | Resultado esperado | Esforço |
|---|---|---|---:|
| 0–2 semanas | Corrigir `lang`, viewport, description, canonical e metadados básicos | Melhor base de acessibilidade e compartilhamento | Baixo |
| 0–2 semanas | Geocodificação assíncrona dos eventos do Instagram | Recuperar eventos da Agenda da Semana no mapa | Médio |
| 0–2 semanas | Estados vazios com ações contextuais | Menos abandono quando não há evento no dia | Baixo |
| 0–2 semanas | Instrumentação do funil de descoberta | Saber quais ações geram valor | Médio |
| 2–4 semanas | JSON-LD `Event`, sitemap e páginas indexáveis | Aumentar descoberta orgânica | Médio |
| 2–4 semanas | Relatório de ingestão e reprocessamento por item | Reduzir tempo de recuperação operacional | Médio |
| 2–4 semanas | Busca normalizada por título, descrição, atração, bairro e venue | Melhorar encontrabilidade | Médio |
| 2–6 semanas | Páginas de estabelecimento | Criar hubs de SEO e recorrência | Médio |
| 2–6 semanas | Carregamento sob demanda do mapa e imagens responsivas | Melhorar LCP, INP e CLS em mobile | Médio |
| 1–2 meses | Lembretes com entrega real e cancelamento | Aumentar retorno ao produto | Alto |
| 1–2 meses | Histórico de alterações e confiança por campo | Aumentar transparência e qualidade editorial | Alto |
| 1–2 meses | Personalização por preferências e proximidade | Transformar catálogo em assistente | Alto |

## 10. Plano recomendado para os próximos três ciclos

### Ciclo 1 — Confiança e base técnica

Corrigir idioma e zoom, adicionar metadados básicos, geocodificar os eventos de Instagram, instrumentar eventos analíticos essenciais e melhorar estados vazios. O sucesso deste ciclo deve ser medido por percentual de eventos com imagem, preço/status, endereço e coordenadas; também por taxa de clique em detalhe e rota.

### Ciclo 2 — Descoberta e operação

Implementar JSON-LD por evento, sitemap, busca normalizada, páginas de estabelecimento e relatório operacional com reprocessamento idempotente. O sucesso deve ser medido por páginas indexáveis válidas, consultas sem resultado, tempo médio de recuperação de falha e eventos aceitos por fonte.

### Ciclo 3 — Retenção e diferenciação

Implementar entrega de lembretes, preferências leves, notificações de alteração e coleções editoriais baseadas em dados reais. O sucesso deve ser medido por retorno semanal, favoritos convertidos em lembretes, lembretes entregues e compartilhamentos por evento.

## 11. Decisão recomendada

Se apenas três melhorias puderem ser escolhidas agora, recomendo: **(1) geocodificação e qualidade dos dados**, **(2) SEO de páginas de evento com JSON-LD e sitemap** e **(3) observabilidade com reprocessamento operacional**. Juntas, elas aumentam cobertura, descoberta e confiabilidade — os três pontos que mais limitam o valor do produto neste momento.

Eu não priorizaria agora uma nova camada social, avaliações, gamificação ou mais filtros. O produto já possui muitos controles; antes de adicionar complexidade, é mais importante fazer cada evento ser encontrável, confiável, localizado no mapa, compartilhável e atualizado.

## Referências

[1] [W3C — Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)  
[2] [Google Search Central — Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event)  
[3] [web.dev — Web Vitals](https://web.dev/articles/vitals)
