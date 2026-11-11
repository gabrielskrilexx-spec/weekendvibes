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
- [ ] Pendência operacional, não bloqueadora para o Preview: configurar `VITE_VAPID_PUBLIC_KEY` e o serviço emissor privado antes de ativar/entregar alertas reais; não há envio de notificações implementado nesta base inicial.

## Fase 4 — testes automatizados e monitoramento (E2E) — pendente

- [ ] Criar suítes E2E (usando Vitest ou Playwright) para validar que as rotas `/api/*` NUNCA são servidas via cache do Service Worker (`NetworkOnly`).
- [ ] Criar suítes E2E para validar que o estado “Sem conexão” é exibido corretamente quando offline.
- [ ] Criar suítes E2E para validar que a vitrine “Palcos da Baixada” renderiza os WebP dos 15 venues oficiais sem imagens quebradas.
- [ ] Executar a suíte de testes e o build completo (`pnpm check` && `pnpm build`); commitar a fase.

## Entrega final

- [ ] Fazer push somente da branch `feature/v2-roadmap` (nunca push direto em `main`).
- [ ] Confirmar o SHA remoto e fornecer o link do Preview Vercel para os testes no celular.
