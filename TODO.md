# Roadmap — WeekendVibes v2

## Fase 1 — otimização da ingestão Apify & Instagram — concluída

- [x] Resolver e integrar as otimizações de pipeline pendentes: ajuste de orçamento/dispatch da Apify, limites de performance de ingestão e resiliência no scraper de Instagram.
- [x] Garantir que as 9 marcas monitoradas (Nosso After, Plants Santos, The Crew, PANDANCE, Mimada Festa, Mega Universitária, APÊ 22, OSUCO e Casa Jamboo) sejam capturadas sem estourar quotas ou falhar na concorrência de requisições.
- [x] Validar a fase com `pnpm check` e `pnpm build`; ambos aprovados. Testes direcionados: 106/106 aprovados.
- [x] Commits locais da fase: `b4e627e`, `2cd056d`, `18a749a`, `3b6596a`.

## Fase 2 — SEO local e compartilhamento social (Dynamic Open Graph) — concluída

- [x] Implementar meta tags dinâmicas de Open Graph (`og:title`, `og:description`, `og:image`) para a vitrine “Palcos da Baixada” e páginas de eventos no HTML inicial, antes de hidratação do React.
- [x] Configurar um gerador/servidor de imagens de pré-visualização para que links compartilhados no WhatsApp e Instagram Stories exibam o card visual do evento com o logo e cores do WeekendVibes.
- [x] Validar HTML de rotas públicas, páginas de evento, inexistentes, status HTTP, origem absoluta e PNG 1200×630; `pnpm check`, `pnpm build` e 9/9 testes direcionados passaram.

## Fase 3 — engajamento no PWA & Push Notifications — concluída (base inicial)

- [x] Configurar listeners de `push` e `notificationclick` no Service Worker para notificações nativas, com URLs de clique limitadas à mesma origem.
- [x] Adicionar toggle discreto “Receber alertas dos eventos do fim de semana”, com consentimento explícito, estados de suporte/configuração e inscrição via `PushManager`.
- [x] Adicionar analytics agregados para page views, instalações PWA, eventos do toggle e transições offline, sem PII; API protegida por allowlist/rate limit e emitida nos logs.
- [x] Executar `pnpm check`, `pnpm build` e 2 testes unitários direcionados (aprovados).
- [x] Manter o opt-in oculto quando `VITE_VAPID_PUBLIC_KEY` não estiver configurada; ativar somente com um par VAPID correspondente.

### Incremento autorizado — Web Push completo

- [x] Criar migração Drizzle/PostgreSQL para `push_subscriptions`: `id` serial/primary key, `endpoint` texto único, `p256dh` chave pública do cliente, `auth` segredo de autenticação do cliente e `createdAt` timestamp; aplicar a migração aditiva no Neon Production e conferir colunas/índice único.
- [x] Adicionar `web-push`; carregar `VITE_VAPID_PUBLIC_KEY` no frontend e `VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` exclusivamente no servidor; implementar saveSubscription/removeSubscription idempotentes e envio Admin a todas as inscrições, removendo endpoints expirados.
- [x] Conectar opt-in à subscription do Service Worker após consentimento explícito, converter a chave pública VAPID em `Uint8Array`, persistir/remover no backend e ocultar sem chave pública.
- [x] Adicionar testes Vitest para persistência/remoção, envio VAPID com `web-push` mockado, proteção administrativa, entradas inválidas e configuração ausente; nenhum push real é enviado nos testes.
- [x] Validar `pnpm check`, `pnpm build`, Vitest completo (135 arquivos, 768 passaram, 2 skipped) e os 7 cenários Playwright (7/7).
- [ ] Integrar a branch de trabalho em `main` por merge seguro e `git push origin main`.
- [ ] Provisionar um par VAPID correspondente no ambiente Production da Vercel (`VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) e validar a ativação; até lá o opt-in permanece oculto em produção.

## Fase 4 — testes automatizados e monitoramento (E2E) — concluída para os critérios solicitados

- [x] Criar suíte Playwright verificando que `/api/*` não grava respostas em CacheStorage e não é servida quando a rede está offline (`NetworkOnly`).
- [x] Criar E2E para validar o aviso “Sem conexão” quando o navegador fica offline e seu desaparecimento ao reconectar.
- [x] Criar E2E que verifica os WebP dos 15 venues: renderização, dimensões naturais, HTTP 200 e MIME `image/webp`.
- [x] Executar `pnpm check`, `pnpm build` e `npx vitest run`: 132 arquivos passaram, 751 testes passaram e 2 foram pulados.
- [x] Executar os 3 novos cenários Playwright da fase: todos passaram.
- [x] Corrigir o fixture administrativo do `admin-actions-audit.spec.ts`, cobrindo filas e métricas dos subpainéis e os endpoints REST atuais de ações em massa; validar que os 7 cenários Playwright passam.
- [x] Sincronizar `feature/v2-roadmap` com `main` e preparar a integração por merge seguro, preservando os recursos já publicados.

## Entrega final

- [x] Corrigir o fixture administrativo do `admin-actions-audit.spec.ts`, cobrindo filas e métricas dos subpainéis e os endpoints REST atuais de ações em massa; validar que os 7 cenários Playwright passam.
- [x] Integrar `feature/v2-roadmap` em `main` por merge seguro e publicar `main` conforme autorização atual.
- [x] Confirmar o SHA remoto publicado e o estado `READY` do deployment Vercel.
