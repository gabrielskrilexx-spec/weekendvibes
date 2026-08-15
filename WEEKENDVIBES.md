# WeekendVibes

O WeekendVibes é uma agenda mobile-first de eventos de sexta e sábado na Baixada Santista. A implementação usa o scaffold full-stack do projeto, com React/Tailwind no cliente, Express/tRPC no servidor e **Drizzle ORM sobre o banco gerenciado MySQL/TiDB**. Os helpers internos atendem LLM, mapas, armazenamento e Heartbeat. O runtime publicado não utiliza PostgreSQL/PostGIS nem uma aplicação Python/FastAPI separada; qualquer documentação ou integração que mencione esses componentes deve ser tratada como legado e não como arquitetura efetiva.

## Árvore principal

```text
weekendvibes/
├── client/
│   └── src/
│       ├── components/EventCard.tsx
│       ├── components/Map.tsx
│       ├── pages/Home.tsx
│       ├── pages/EventDetail.tsx
│       ├── pages/Admin.tsx
│       ├── App.tsx
│       └── index.css
├── drizzle/
│   ├── schema.ts
│   └── migrations/0001_oval_red_skull.sql
├── server/
│   ├── _core/
│   │   ├── heartbeat.ts
│   │   ├── llm.ts
│   │   └── index.ts
│   ├── db.ts
│   ├── ingestion.ts
│   ├── scheduled.ts
│   ├── routers.ts
│   ├── auth.logout.test.ts
│   └── events.list.test.ts
├── shared/
├── todo.md
└── package.json
```

## Configuração

Defina `INGESTION_SOURCE_URL` com uma fonte pública de eventos antes de executar o pipeline. As credenciais de LLM, Meta e mapas são fornecidas pelo ambiente gerenciado; secrets não devem ser gravados no repositório nem enviados pelo frontend. O Heartbeat chama os callbacks `POST /api/scheduled/ingest-events`, `POST /api/scheduled/ingest-instagram` e `POST /api/scheduled/monitor-heartbeat` com identidade nativa de tarefa. O AGENT cron não deve ser usado para esses callbacks, pois não herda automaticamente os secrets do cofre.

## Comandos locais

```bash
cd /home/ubuntu/weekendvibes
pnpm install
pnpm check
pnpm test
pnpm dev
```

O preview do projeto é servido pela porta gerenciada do ambiente. O backend expõe tRPC em `/api/trpc` e callbacks periódicos cron-only em `/api/scheduled/ingest-events`, `/api/scheduled/ingest-instagram` e `/api/scheduled/monitor-heartbeat`.

## Persistência e observabilidade

O schema de aplicação está em `drizzle/schema.ts` e as consultas ficam em `server/db.ts`; migrações devem ser geradas pelo Drizzle e aplicadas no banco gerenciado MySQL/TiDB conforme o fluxo do projeto. As tabelas `ingestionRuns` e `operationalAlerts` armazenam, respectivamente, o ciclo de execução e alertas deduplicados. O painel administrativo agrega a tendência dos últimos sete dias por execução, posts recebidos, posts aprovados, eventos estruturados, importações e execuções HTTP 200 sem mídias.

## Job periódico

O handler já está implementado e é idempotente. Depois de publicar o checkpoint, o job deve ser criado para a URL de produção, pois endpoints de preview não são alcançáveis pelo serviço de cron. Exemplo de configuração do projeto:

```bash
manus-heartbeat create \
  --name weekendvibes-ingest-events \
  --cron "0 0 5 * * *" \
  --path /api/scheduled/ingest-events \
  --description "Atualiza eventos da Baixada Santista diariamente"
```

A expressão usa UTC e deve ser ajustada ao horário desejado. O serviço deve estar publicado antes da criação do job.

## Fluxos

A home usa filtros de dia, cidade, categoria, faixa de preço e texto, além de mapa com pins clicáveis. `/eventos/:slug` exibe os dados completos e um pin individual. `/admin` exige usuário com `role=admin` e permite adicionar, editar, remover e enriquecer eventos a partir de texto livre.

## Ingestão pública Articket/Blacktag

A ingestão de fontes públicas usa as páginas-base do Articket (`https://articket.com.br/e/6784/plants-happy-hour` e `https://articket.com.br/`) e do Blacktag (`https://blacktag.com.br/`). Como essas plataformas podem renderizar dados no navegador sem expô-los no HTML inicial, o fluxo renderizado utiliza um schedule agente para abrir as páginas, localizar eventos futuros nos locais Valluns/Vallum Garden, Lucky Scope, Verilonguinho, Moby House/Moby Dick, Curvão Surf House e Meu Lugar, e enviar documentos ao endpoint protegido `/api/scheduled/ingest-event-documents`.

O servidor aceita somente documentos provenientes de Articket ou Blacktag. Antes da persistência, o enriquecimento por LLM exige cidade Santos ou Guarujá, categoria show, balada ou evento musical, e gênero Funk, House/Eletrônica, Samba/Pagode ou Rap/Trap. Eventos sem cidade, local-alvo, gênero inferível ou data futura são descartados. A identidade usa fonte, título e data para manter a ingestão idempotente.

O schedule `WeekendVibes — ingestão Articket e Blacktag` está configurado para repetir a cada 21.600 segundos, equivalente a seis horas, no fuso `America/Sao_Paulo`. A execução deve navegar as fontes e enviar apenas dados públicos reais, sem login, compra ou publicação. O primeiro carregamento pode não inserir registros quando as páginas não tiverem eventos elegíveis; isso é esperado e deve ser acompanhado pelo histórico do schedule e pelos logs do endpoint.

## Fontes públicas adicionais

O pipeline também consulta `https://zig.tickets/eventos/festa-do-branco-22-08` e `https://www.ingresse.com/nosso-after-mc-luuky/`, além das fontes Articket e Blacktag já configuradas. A ingestão renderizada aceita os domínios `zig.tickets` e `ingresse.com`, mas persiste somente eventos de Santos ou Guarujá, dos locais-alvo e dos gêneros musicais permitidos. As páginas podem ser dinâmicas; quando não expõem dados no HTML estático, a coleta deve usar navegação renderizada. Até esta atualização, foram confirmados eventos no Curvão Surf House e no Lucky Scope. Não foram inventados resultados para Valluns Garden, Verilonguinho, Moby House ou Meu Lugar.

## Mídia e preços dos eventos
Os cards públicos exibem a imagem oficial de cada fonte. A Festa do Branco mostra “A partir de R$ 0,00”, conforme a página Zig Tickets. O Nosso After mostra “Preço não informado” porque a página Ingresse retornou “Event not found” e a fonte equivalente Blacktag não expôs lotes ou valores no HTML público consultado. O campo `priceNote` diferencia esse estado de um evento gratuito.
