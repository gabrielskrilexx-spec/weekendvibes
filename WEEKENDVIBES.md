# WeekendVibes

O WeekendVibes é uma agenda mobile-first de eventos de sexta e sábado na Baixada Santista. A implementação usa o scaffold full-stack do projeto, com React/Tailwind no cliente, Express/tRPC no servidor, Drizzle/MySQL no banco gerenciado e os helpers internos para LLM, mapas e Heartbeat. Essa adaptação preserva o objetivo funcional do briefing, embora o ambiente gerenciado não utilize uma pasta Python/FastAPI separada.

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

Defina `INGESTION_SOURCE_URL` com uma fonte pública de eventos antes de executar o pipeline. As credenciais de LLM e do Google Maps são fornecidas pelo ambiente gerenciado; não é necessário solicitar uma chave do Google Maps ao usuário. O cron chama `POST /api/scheduled/ingest-events` e autentica o chamador pelo sistema de tarefas.

## Comandos locais

```bash
cd /home/ubuntu/weekendvibes
pnpm install
pnpm check
pnpm test
pnpm dev
```

O preview do projeto é servido pela porta gerenciada do ambiente. O backend expõe tRPC em `/api/trpc` e o endpoint periódico em `/api/scheduled/ingest-events`.

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
