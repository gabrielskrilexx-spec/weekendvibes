# Plano de evolução integrado — WeekendVibes

## Direção de implementação

Evoluir o projeto existente em quatro fases sequenciais na branch isolada `feature/v2-roadmap`, sem publicar commits diretamente em `main`. A cada fase: validar com `pnpm check` e `pnpm build`, corrigir regressões, registrar um commit local e continuar na mesma branch. Ao final, rodar a suíte automatizada completa, fazer push apenas de `feature/v2-roadmap` e compartilhar o Preview Vercel para teste em celular. Não mesclar nem fazer push em `main`.

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

### Fase 3 — push PWA e analytics

Adicionar listeners de `push` e `notificationclick` ao Service Worker existente e persistir inscrições por endpoint com upsert/desativação. A subscrição do navegador deve ser explícita, precedida de consentimento e só habilitada quando a chave pública VAPID e o serviço de entrega estiverem configurados. Não registrar nem incluir segredo VAPID no bundle/arquivo versionado. Adicionar toggle discreto, feedback de suporte/indisponibilidade e eventos de analytics sem PII, incluindo instalação do PWA e interações essenciais.

### Fase 4 — testes e observabilidade E2E

Cobrir com teste automatizado: (1) `/api/*` não entra no precache/cache do Service Worker e é `NetworkOnly`; (2) o estado offline apresenta a mensagem de falta de conexão; (3) os 15 venues oficiais referenciam WebP existentes e nenhum asset retorna erro. Preferir Playwright instalado/compatível; na ausência dele, adicionar a menor dependência necessária e usar Vitest para testes unitários auxiliares. Não exigir banco de produção, rede externa ou credenciais para a suíte.

## Direção visual

Reutilizar a identidade já existente do WeekendVibes, evitando nova direção visual: base dark `#09090b`, gradientes de laranja/fúcsia/amarelo, cartões de cantos generosos e títulos de alto contraste. Os cards OG usam hierarquia tipográfica forte, wordmark/monograma, título e contexto de cidade/data em tela 1200×630; layouts responsivos no app seguem os componentes existentes. Push deve permanecer discreto e consentido, e analytics não deve expor identidade ou dados pessoais.
