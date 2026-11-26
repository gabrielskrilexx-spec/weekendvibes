# Arquitetura para cliente mobile

## Contratos compartilhados

O backend expõe os dados por tRPC em `/api/trpc`, com autenticação por sessão OAuth e os mesmos procedimentos usados pelo cliente web. Regras de domínio não dependem do navegador: taxonomia de gêneros, validação estrita de Santos/Guarujá, deduplicação, ingestão e procedimentos de eventos ficam em `server/` e `shared/`. Um cliente mobile deve consumir esses contratos, sem reproduzir a lógica de classificação ou escrever diretamente no banco.

Os eventos publicados devem ser tratados como registros futuros com, no mínimo, `id`, `slug`, `title`, `eventDate`, `endDate`, `locationName`, `address`, `city`, `genre`, `category`, `imageUrl`, `sourceUrl` e `sourceType`. Datas trafegam como valores serializados pelo tRPC e devem ser convertidas para o fuso local apenas na apresentação. A cidade elegível para a agenda editorial é exclusivamente `Santos` ou `Guarujá`; o filtro de gênero editorial é `Trap`, `Rap`, `Funk` ou `Eletrônica`.

## Autenticação e origem

O OAuth usa o callback configurado em `OAUTH_REDIRECT_URI`; na ausência dele, o servidor resolve a origem canônica por `PUBLIC_SITE_URL`, `VERCEL_PROJECT_PRODUCTION_URL` ou o fallback estável do projeto. `VERCEL_URL` representa a implantação corrente e não deve ser persistido como URL canônica. O endpoint `/api/health` retorna apenas diagnóstico sanitizado (origens e presença booleana de integrações), nunca tokens, chaves ou URLs de conexão.

## Responsabilidades exclusivas do browser

Componentes em `client/` podem usar `window`, `document`, clipboard, downloads, geolocalização, Service Worker, Web Push e APIs DOM. O Service Worker e o prompt PWA são web-only. O mapa regional depende de Google Maps/geolocalização e deve ter fallback visual no mobile.

Módulos em `shared/` não acessam `window`, `document`, `navigator`, `localStorage` ou Service Worker. Helpers que constroem URLs recebem uma origem explícita do chamador; o cliente web pode fornecer `window.location.origin`, enquanto o cliente mobile deve fornecer sua origem de deep link ou usar uma URL retornada pelo backend.

## Evolução

Novos campos de evento devem ser opcionais ou versionados antes de serem exigidos por clientes móveis. Falhas de fontes externas devem aparecer como estados/diagnósticos de ingestão, sem impedir a leitura dos eventos já publicados. O mobile não deve depender de endpoints administrativos, downloads do navegador ou rotas de SEO/OpenGraph.
