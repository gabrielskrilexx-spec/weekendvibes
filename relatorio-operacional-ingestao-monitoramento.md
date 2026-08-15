# Relatório técnico — ingestão e monitoramento do WeekendVibes

**Data da análise:** 15 de agosto de 2026  
**Projeto:** WeekendVibes  
**Escopo:** ingestão pública, ingestão oficial do Instagram via Meta Business Discovery e monitoramento operacional por Heartbeat.

## Resumo executivo

A arquitetura atual separa três responsabilidades. A ingestão pública diária coleta páginas de Articket, Blacktag, Zig Tickets e Ingresse; a ingestão oficial do Instagram é semanal e usa exclusivamente a Graph API da Meta; e um Heartbeat diário consulta o estado das execuções e a quantidade de eventos publicados, sem disparar uma nova ingestão. Essa separação evita que o monitoramento dobre o volume de captura.

Há uma distinção importante entre **configuração efetiva** e **resultado de negócio**. O código está preparado para o caminho oficial Meta e exige `META_INSTAGRAM_TOKEN` e `META_INSTAGRAM_ACCOUNT_ID`. Entretanto, as tentativas operacionais registradas anteriormente retornaram restrição de permissão da Meta, portanto a existência do schedule ativo não equivale à confirmação de novos eventos reais importados. O monitor diário deve reportar essa diferença por meio do último `ingestionRun` e das contagens persistidas.

> **Nota de consistência de infraestrutura:** embora o resumo arquitetural mencione FastAPI/PostGIS/PostgreSQL, o código analisado neste projeto usa Drizzle com `mysqlTable` e consultas compatíveis com MySQL/TiDB em `drizzle/schema.ts`. A descrição de produção deve ser alinhada a essa implementação efetiva antes de uma migração de banco.

## 1. Escopo de monitoramento

### 1.1 Cidades e regra geográfica

O sistema aceita somente as cidades **Santos** e **Guarujá**. Essa regra aparece em múltiplas camadas, e não apenas no prompt do modelo. O filtro público rejeita qualquer evento cujo campo `city` não seja exatamente uma dessas duas opções. O pipeline do Instagram aplica a mesma condição ao estruturar os eventos via schema da OpenAI e, antes do `saveEvent`, exige data válida, local compatível e fonte Instagram válida.

A persistência possui uma barreira adicional: `saveEvent` lança erro quando `data.city` não pertence a `ALLOWED_CITIES`. Portanto, mesmo que uma etapa anterior falhe em filtrar um registro, o banco não aceita uma cidade fora do escopo. No feed público, `filterEventsForPublicFeed` reaplica o recorte de cidades permitidas e remove eventos arquivados ou não publicados.

### 1.2 Fontes públicas e locais-alvo

As URLs-base configuradas no coletor público são Articket, Blacktag e Ingresse, incluindo páginas específicas de eventos. O descobridor segue links do mesmo domínio e limita o conjunto descoberto a 60 páginas. A filtragem textual de venue usa a lista de locais-alvo e os aliases ativos administráveis no painel.

A lista nominal observada em `server/ingestion.ts` inclui Valluns/Vallum Garden, Lucky Scope, Verilonguinho, Moby House/Moby Dick, Curvão Surf House, Curvão, Meu Lugar, Laroc Club Guarujá, Laroc Guarujá e Guarujá Golf Club. O alias manager amplia variações de nomes sem remover a exigência de cidade e categoria/gênero.

| Conjunto | Itens configurados |
|---|---|
| Fontes públicas | Articket, Blacktag, Ingresse; URLs-base adicionais registradas para descoberta |
| Locais públicos | Valluns/Vallum Garden, Lucky Scope, Verilonguinho, Moby House/Moby Dick, Curvão Surf House, Meu Lugar, Laroc Club Guarujá e Guarujá Golf Club |
| Cidades aceitas | Santos e Guarujá |
| Categorias | `show`, `balada`, `evento_musical` |
| Gêneros | `funk`, `house_eletronica`, `samba_pagode`, `rap_trap` |

### 1.3 Perfis de Instagram

O conjunto efetivo de alvos em `server/instagram-pipeline.ts` possui oito perfis. A conta consultada pela API não é necessariamente a conta autenticada: o pipeline usa Business Discovery com `META_INSTAGRAM_ACCOUNT_ID` como conta profissional de referência e consulta cada username no campo `business_discovery.username(...)`.

| Nome operacional | Username | URL direta |
|---|---|---|
| Moby House | `mobydicksantos` | `instagram.com/mobydicksantos/` |
| Projac Bar | `projac.bar` | `instagram.com/projac.bar/` |
| Meu Lugar Bar e Entretenimento | `meulugar.bar` | `instagram.com/meulugar.bar/` |
| Nosso After | `nossoafterguaruja` | `instagram.com/nossoafterguaruja/` |
| Curvão Surf House | `curvaosurfhouse` | `instagram.com/curvaosurfhouse/` |
| Flamingo Bar | `flamingomusicbar` | `instagram.com/flamingomusicbar/` |
| Rocket Sea Club | `rocketseaclub` | `instagram.com/rocketseaclub/` |
| Ativa House | `ativahouse` | `instagram.com/ativahouse/` |

A conta monitorada pelo Instagram não basta, sozinha, para autorizar um evento. Depois da estruturação, o local e o endereço também precisam passar por `containsTargetVenue`, que combina locais hardcoded e aliases ativos no banco. Assim, um post de um perfil-alvo sobre um evento fora dos locais reconhecidos é descartado. Para incluir novos nomes de estabelecimentos sem alterar o pipeline, o painel de aliases é o mecanismo apropriado.

### 1.4 Filtro estrito da Agenda da Semana

A janela do Instagram é de **cinco dias retrospectivos** em relação ao instante da execução. O post precisa ter timestamp válido e estar entre `now - 5 dias` e `now`. O texto aprovado precisa conter literalmente `Agenda da semana` e pelo menos uma das hashtags exatas `#Sexta-Feira` ou `#Sábado`. O texto pode vir da legenda e, quando a legenda não contém a expressão aprovada, do OCR da imagem.

O pipeline não usa OCR para substituir uma legenda já aprovada; isso reduz chamadas desnecessárias. Falhas de download da imagem e limites temporários do OCR são tratados como continuação com a legenda, com alerta operacional, enquanto falhas não recuperáveis são elevadas como erro de integração.

## 2. Fluxo de persistência até o frontend

### 2.1 Fluxo do Instagram

O fluxo oficial é o seguinte:

1. `runInstagramAgendaStep` arquiva eventos esgotados expirados, executa `runInstagramPipeline` e tenta processar uma pequena fila de geocodificação.
2. `fetchInstagramPosts` exige os dois secrets Meta e chama `https://graph.facebook.com/v26.0/{META_INSTAGRAM_ACCOUNT_ID}` oito vezes, uma por perfil, solicitando até 25 mídias por perfil.
3. O payload é normalizado para `id`, legenda, timestamp, permalink, `media_url` e username.
4. Cada post é filtrado pela janela de cinco dias.
5. Posts sem texto aprovado na legenda podem passar por OCR da imagem. O texto final é submetido ao filtro estrito de `Agenda da semana` e hashtags.
6. Os posts aprovados são enviados ao `gpt-4o-mini` com Structured Outputs. O schema exige título, resumo, data, local, endereço, cidade, categoria, gênero, preço, imagem e URL de origem.
7. O resultado estruturado é validado novamente: data válida, cidade permitida, venue/alias reconhecido e categoria/gênero permitidos.
8. O evento é salvo por `saveEvent` com `isPublished=1`, `isArchived=0`, `sourceType` Instagram, imagem quando fornecida e indicação de preço desconhecido quando o post não informa valor.
9. O frontend consulta os eventos públicos por procedures tRPC. Como o registro está publicado e não arquivado, ele entra nos cards, filtros, mapa e página de detalhe.

A rotina pública segue o mesmo destino de persistência, mas começa por descoberta de páginas HTML. Ela extrai até 60 candidatos, baixa as páginas com timeout de 12 segundos, conserva textos que citam venues-alvo e usa Structured Outputs para obter eventos musicais futuros em Santos ou Guarujá.

### 2.2 Campos persistidos

A tabela `events` contém os campos que alimentam os cards e detalhes públicos:

| Campo | Função operacional |
|---|---|
| `title` | Nome exibido do evento |
| `slug` | Rota amigável e estável do detalhe |
| `description` | Resumo estruturado do texto do post/fonte |
| `eventDate`, `endDate` | Ordenação e exibição temporal |
| `locationName`, `address`, `city` | Localização, filtros e mapa |
| `category`, `genre` | Filtros musicais e classificação |
| `priceCents`, `priceNote`, `ticketStatus` | Preço e disponibilidade sem inferência |
| `sourceUrl`, `sourceType` | Rastreabilidade e origem |
| `imageUrl` | Imagem oficial para o card, quando disponível |
| `latitude`, `longitude` | Mapa e rotas, quando geocodificados |
| `sourceHash` | Fingerprint da origem/evento |
| `isPublished`, `isArchived` | Controle de visibilidade pública |
| `createdAt`, `updatedAt` | Tags de novidade e atualização |

O sistema não inventa preço: quando o Instagram não informa valor, grava `priceCents=0`, `priceNote` explicativo e `ticketStatus=unknown`. Da mesma forma, o evento só é persistido se data, cidade, local e gênero puderem ser estruturados com segurança.

### 2.3 Idempotência e prevenção de duplicidade

A identidade lógica usada nos testes é `sourceUrl|YYYY-MM-DD`, conforme `eventIdentityKey`. O `saveEvent` consulta primeiro uma combinação de `sourceUrl` e `eventDate`; se encontrar registro, executa `UPDATE` com os dados mais recentes e `updatedAt`. Se não encontrar, executa `INSERT` com `onDuplicateKeyUpdate`. A tabela ainda declara `slug` e `sourceHash` como únicos.

Na prática, a idempotência é reforçada por três camadas: a URL original do post/fonte, a data normalizada do evento e o hash calculado a partir da origem, data e título. Ler o mesmo post em duas execuções não deve criar um segundo card; deve atualizar o registro existente. O título pode alterar o hash calculado, mas a consulta por origem e data continua sendo a primeira barreira de atualização.

### 2.4 Observabilidade e monitoramento

Cada etapa rastreada cria um registro em `ingestionRuns` com rotina, source key, status, contagens importadas, falhas, detalhes e timestamps. Os estados são `running`, `succeeded`, `failed` e `partial`. Falhas com timeout ou HTTP 5xx geram alerta operacional crítico classificado como `pipeline`.

O callback `monitor-heartbeat` é cron-only. Ele não chama a Meta, não chama OpenAI e não inicia outra ingestão. Consulta as últimas execuções de `full-agenda`, `instagram-agenda` e `scheduled-instagram`, considera saudável uma última execução bem-sucedida e concluída há no máximo 26 horas, conta eventos publicados e não arquivados e grava seu próprio snapshot como `heartbeat-monitor`. A resposta retorna `healthy`, última execução, idade, contagem persistida e `monitorRunId`.

## 3. Frequência, demanda e capacidade

### 3.1 Schedules ativos

A configuração autoritativa consultada contém três Heartbeats ativos:

| Tarefa | Cron UTC | Frequência | Papel |
|---|---:|---|---|
| `weekendvibes-ingest-events` | `0 0 5 * * *` | Diária, 05:00 UTC | Ingestão pública |
| `weekendvibes-monitor-diario` | `0 0 11 * * *` | Diária, 11:00 UTC / 08:00 São Paulo | Observação e persistência de snapshot |
| `weekendvibes-ingest-instagram` | `0 0 13 * * 2` | Terças, 13:00 UTC / 10:00 São Paulo | Ingestão oficial Meta |

O monitor diário não adiciona chamadas de captura. Em uma semana típica, há sete execuções públicas, sete verificações de monitoramento e uma execução Instagram. Isso é deliberadamente baixo para um agregador regional.

### 3.2 Volume estimado de processamento

A ingestão Instagram consulta oito perfis, com limite de 25 mídias por perfil. O teto nominal é **200 itens recebidos por execução semanal** antes da janela de cinco dias e dos filtros textuais. Na prática, a janela reduz esse número para os posts recentes; o filtro de texto reduz novamente para posts com a frase e hashtags exigidas. OCR só é solicitado quando a legenda não contém a expressão aprovada, e o OCR é limitado ao conjunto de posts ainda candidatos.

A ingestão pública pode descobrir até 60 URLs por execução. Como há uma etapa de download das bases e outra de download dos candidatos, o teto aproximado é de até 120 requisições HTML por execução diária, além das chamadas ao LLM quando existem páginas compatíveis. O valor real costuma ser menor por deduplicação de URLs, falhas filtradas por `Promise.allSettled` e ausência de páginas de venues-alvo.

O monitoramento diário realiza consultas leves no banco: leitura das últimas dez execuções, contagem dos eventos publicados/não arquivados e uma gravação de snapshot. Ele não consulta fontes externas e não aumenta o custo de Meta, OpenAI ou OCR.

### 3.3 Avaliação de gargalos e rate limits

Para a escala atual, a demanda de banco é baixa e o desenho assíncrono não sugere gargalo estrutural. A captura de oito perfis e até 200 mídias semanais é pequena; o maior risco operacional está nos limites e permissões da Meta, não no volume. A API oficial pode rejeitar a ação por escopo, token expirado, vínculo profissional ou revisão do aplicativo. Os logs devem distinguir HTTP 200 da API de um schedule simplesmente iniciado.

O segundo ponto sensível é OpenAI: OCR e Structured Outputs podem consumir duas etapas por post candidato. O código possui retry curto para 429 no cliente OpenAI e degradação para legenda quando a imagem está indisponível ou o OCR sofre rate limit. Falhas não recuperáveis de OCR/OpenAI geram erro de integração e o handler grava alerta/notifica o proprietário.

A fonte pública usa timeout de 12 segundos por página e `Promise.allSettled`, evitando que uma fonte indisponível derrube todas as demais. Ainda assim, uma execução pública com dezenas de páginas pode durar vários segundos ou minutos dependendo da rede e do LLM; o limite de candidatos e a paralelização atual mantêm o volume controlado.

| Componente | Pressão esperada | Risco principal | Mitigação existente |
|---|---:|---|---|
| Meta Business Discovery | Baixa, 8 consultas semanais | Permissão, token, rate limit | Secrets obrigatórios, erro de integração, logs por rotina |
| OCR/OpenAI | Variável; proporcional a posts sem legenda aprovada | 429, custo e latência | Retry curto, fallback para legenda, alertas |
| OpenAI Structured Outputs | Uma chamada por lote aprovado | Erro de schema ou limite | Schema estrito, descarte sem dados verificáveis |
| Fontes públicas | Até 60 candidatos/dia; downloads paralelos | Timeout/HTTP 5xx | Timeout 12 s, `Promise.allSettled`, alertas críticos |
| Banco | Baixo; upsert + snapshots | indisponibilidade ou concorrência | `saveEvent`, estados de run, monitor diário |
| Heartbeat monitor | Três consultas e uma gravação/dia | dados antigos ou ausência de run | janela de 26 h, snapshot e status `partial` |

### 3.4 Conclusão de capacidade

A infraestrutura atual é dimensionada para a carga regional prevista, desde que os limites externos da Meta e OpenAI permaneçam dentro do plano contratado e que não se aumente significativamente o limite de mídias por perfil ou a frequência. Não há evidência de necessidade de escalabilidade horizontal neste volume. Recomenda-se, contudo, acompanhar semanalmente `receivedPosts`, `approvedPosts`, `structuredEvents`, `importedCount`, falhas por integração e idade da última execução.

Também é recomendável manter um alerta específico quando a Meta retornar 200 com zero mídia por vários ciclos, pois esse cenário pode indicar falta de permissão ou perfil sem dados e não necessariamente uma falha HTTP. O monitor atual confirma a saúde do último `ingestionRun`, mas a interpretação de “saudável” deve considerar também as contagens e os alertas de integração.

## Referências internas

- `server/instagram-pipeline.ts`: perfis, Graph API, janela de cinco dias, filtro textual, OCR, OpenAI e persistência Instagram.
- `server/ingestion.ts`: fontes públicas, locais-alvo, aliases, filtros e persistência pública.
- `server/db.ts`: cidades permitidas, feed público, `saveEvent` e identidade do evento.
- `server/agenda-routine.ts`: composição das rotinas e registros de execução.
- `server/ingestion-reports.ts`: lifecycle, métricas, alertas e reprocessamento.
- `server/scheduled-instagram.ts`, `server/scheduled.ts`: autenticação cron-only e respostas dos callbacks.
- `server/scheduled-heartbeat-monitor.ts`: snapshot diário de saúde e persistência.
- `drizzle/schema.ts`: campos de `events`, `ingestionRuns`, aliases e alertas operacionais.
