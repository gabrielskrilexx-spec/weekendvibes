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

## Fase 3 — engajamento no PWA & Push Notifications — pendente

- [ ] Configurar a estrutura inicial da Web Push API no Service Worker existente para suporte a notificações nativas no Android e iOS.
- [ ] Adicionar um toggle discreto na interface para o usuário permitir “Receber alertas dos eventos do fim de semana”.
- [ ] Adicionar eventos de analytics simples para monitorar instalações do PWA e uso da interface.
- [ ] Persistir consentimentos/inscrições de forma segura, manter a inscrição opt-in, não expor segredos VAPID e explicar/representar estados sem configuração; executar `pnpm check` e `pnpm build` e commitar a fase.

## Fase 4 — testes automatizados e monitoramento (E2E) — pendente

- [ ] Criar suítes E2E (usando Vitest ou Playwright) para validar que as rotas `/api/*` NUNCA são servidas via cache do Service Worker (`NetworkOnly`).
- [ ] Criar suítes E2E para validar que o estado “Sem conexão” é exibido corretamente quando offline.
- [ ] Criar suítes E2E para validar que a vitrine “Palcos da Baixada” renderiza os WebP dos 15 venues oficiais sem imagens quebradas.
- [ ] Executar a suíte de testes e o build completo (`pnpm check` && `pnpm build`); commitar a fase.

## Entrega final

- [ ] Fazer push somente da branch `feature/v2-roadmap` (nunca push direto em `main`).
- [ ] Confirmar o SHA remoto e fornecer o link do Preview Vercel para os testes no celular.
