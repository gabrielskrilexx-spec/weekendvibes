# Plano de evolução integrado — WeekendVibes

## Direção de implementação

Evoluir o projeto existente em uma branch isolada de trabalho, preservando o `main` enquanto a implementação é validada. Para esta solicitação, o usuário autorizou explicitamente integrar a branch por merge seguro e publicar em `main`; não fazer force-push nem reescrever histórico. O banco permanece PostgreSQL/Neon acessado via Drizzle.

## Estrutura do projeto e responsabilidades

- `server/`: rotinas de ingestão, controle de orçamento, APIs/Express, persistência Neon via Drizzle e renderização de metadados/imagens sociais.
- `server/_core/`: bootstrap Express, estáticos, segurança, cron e pontos de roteamento.
- `client/src/`: aplicação React, páginas públicas, componentes, PWA e analytics de interface.
- `client/public/` e `client/src/sw.ts`: ativos públicos e Service Worker gerado pelo `vite-plugin-pwa`.
- `drizzle/`: schema e migrações do PostgreSQL/Neon.
- `vercel.json`: rewrites das rotas públicas/API e configuração de preview/produção.
- `server/*.test.ts`: testes unitários existentes com Vitest; testes E2E usarão Playwright se a infraestrutura instalada permitir sem alterar a experiência de build.

## Decisões de implementação

### Fase 1 — ingestão Apify/Instagram

Reusar o monitoramento dinâmico `monitoredBrands` já consumido pelo pipeline, sem listas novas de marcas. Preservar limites de despachos, actor e mídias por perfil; quando a reserva de orçamento não for confirmada, retornar `SKIPPED` em vez de transformar o bloqueio controlado em falha de coleta. Preservar latências P95 e AbortSignal atuais da `main`, combinando-os com ajustes que não regridam rotinas recentes.

### Fase 2 — SEO local e Open Graph

Servir metadados route-specific no HTML inicial de páginas públicas, especialmente `/` (vitrine Palcos da Baixada) e `/eventos/:slug`. Não depender da hidratação React para crawlers. Renderizar imagens preview PNG server-side de 1200×630 com identidade WeekendVibes, sem buscar imagens arbitrárias fornecidas por eventos. Servir somente registros publicados/não arquivados. URLs absolutas de canonical/OG usam apenas `PUBLIC_SITE_URL` ou domínios públicos explícitos do ambiente Vercel, nunca o cabeçalho Host do request. Rotas de imagem/páginas dinâmicas devem ser encaminhadas pela Vercel à função Express antes do fallback SPA.

### Fase 3 — Web Push PWA completo

Preservar os listeners `push`/`notificationclick` e o ciclo de atualização do Service Worker. Criar no PostgreSQL/Neon, via Drizzle, `push_subscriptions` com `id` serial primary key, `endpoint` text único, `p256dh`, `auth` e `createdAt`. Adicionar `web-push`; ler `VITE_VAPID_PUBLIC_KEY` no cliente e `VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` somente no servidor. Implementar save/remove de subscriptions para visitantes e um send administrativo protegido para avisos de teste ou de eventos novos; remover endpoints expirados e não registrar endpoints, chaves ou payloads sensíveis. O opt-in pede permissão somente após ação explícita, cria subscription com a chave VAPID convertida em bytes e persiste/removes no backend. Ausência de VAPID esconde o toggle e bloqueia envio sem vazar configuração. Preservar os analytics agregados já implementados para instalações PWA, interações com o toggle e transições offline, sem PII.

Aplicar a migração aditiva de forma versionada; usar provider do web-push mockado nos testes, sem tráfego real, banco compartilhado ou segredos na suíte. Documentar como configurar o par de chaves correspondente no ambiente de produção.

### Fase 4 — testes e observabilidade E2E

Cobrir com teste automatizado: (1) `/api/*` não entra no precache/cache do Service Worker e é `NetworkOnly`; (2) o estado offline apresenta a mensagem de falta de conexão; (3) os 15 venues oficiais referenciam WebP existentes e nenhum asset retorna erro. Preferir Playwright instalado/compatível; na ausência dele, adicionar a menor dependência necessária e usar Vitest para testes unitários auxiliares. Não exigir banco de produção, rede externa ou credenciais para a suíte.

## Direção visual

Reutilizar a identidade já existente do WeekendVibes, evitando nova direção visual: base dark `#09090b`, gradientes de laranja/fúcsia/amarelo, cartões de cantos generosos e títulos de alto contraste. Os cards OG usam hierarquia tipográfica forte, wordmark/monograma, título e contexto de cidade/data em tela 1200×630; layouts responsivos no app seguem os componentes existentes. Push deve permanecer discreto e consentido, e analytics não deve expor identidade ou dados pessoais.
