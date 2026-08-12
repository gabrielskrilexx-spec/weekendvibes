
# WeekendVibes — TODO

- [x] Feed mobile-first de eventos de sexta e sábado com cards de nome, data, horário, local e categoria
- [x] Filtros por dia, cidade da Baixada Santista, categoria e faixa de preço
- [x] Página de detalhe do evento com descrição, endereço, links, preço e mapa
- [x] Modelo de banco de dados de eventos com campos estruturados e georreferenciamento
- [x] Painel administrativo protegido para adicionar, editar e remover eventos
- [x] API pública de eventos com paginação e filtros
- [x] Pipeline de ingestão por scraping/importação com normalização e deduplicação
- [x] Enriquecimento por LLM para resumo, categoria e extração estruturada
- [x] Endpoint idempotente para job periódico automático; ativação do cron da plataforma após deploy
- [x] Mapa interativo com Google Maps, pins e abertura de detalhes
- [x] Direção visual vibrante tropical com laranja, roxo, amarelo e tipografia bold
- [x] Testes Vitest para os fluxos principais
- [x] Validar responsividade, estados de carregamento, vazio e API indisponível
- [x] Documentar árvore do projeto e comandos de execução
- [x] Adicionar filtro visual de faixa de preço no frontend e conectá-lo à API
- [x] Implementar formulários completos de criação e edição no painel admin
- [x] Ativar o cron real da plataforma após publicação do site
- [x] Corrigir gerenciamento de markers para evitar duplicação e adicionar pin no detalhe
- [x] Expandir testes de integração para CRUD, autorização, enriquecimento e handler agendado
- [x] Criar documentação real com árvore do projeto e comandos exatos
- [x] Adicionar validação de formulário e feedback de erro/sucesso no painel admin para criação e edição de eventos

- [x] Restringir a busca, filtros e ingestão para eventos em Santos e Guarujá
- [x] Reorientar categorias para shows, baladas e eventos musicais
- [x] Adicionar gêneros Funk, House/Eletrônica, Samba/Pagode e Rap/Trap
- [x] Validar filtros, ingestão, testes e publicar os ajustes
- [x] Publicar novamente a versão com Santos/Guarujá e catálogo musical e verificar produção
- [x] Testar filtros públicos por cidade, categoria e gênero musical
- [x] Testar ingestão rejeitando cidades e categorias fora do novo escopo
- [x] Validar o resultado filtrado por cidade, categoria e gênero sobre uma coleção de eventos
- [x] Fazer o teste de escopo importar a implementação real de `server/db.ts`, sem mocká-la

- [x] Escolher e documentar uma fonte pública real de eventos para Santos e Guarujá
- [x] Implementar adaptador de ingestão da fonte escolhida com normalização e deduplicação
- [x] Validar somente eventos musicais de Santos e Guarujá antes da persistência
- [x] Conectar a fonte ao job periódico existente e configurar variáveis de produção
- [ ] Testar ingestão real, falhas da fonte, duplicatas e execução em produção

- [x] Verificar Articket e Blacktag como fontes públicas para a busca de eventos
- [ ] Localizar eventos de Santos e Guarujá nos locais Valluns Garden, Lucky Scope, Verilonguinho, Moby House, Curvão Surf House e Meu Lugar
- [x] Implementar ingestão filtrada a partir das URLs e páginas públicas encontradas
- [x] Testar deduplicação, escopo geográfico e gêneros musicais dos eventos encontrados
- [x] Publicar a atualização da ingestão e documentar fontes e limitações de acesso
- [x] Conectar o fluxo `agent-ingestion` a um schedule recorrente que navegue as fontes e poste documentos renderizados
- [ ] Executar uma ingestão real bem-sucedida com pelo menos um evento persistido das URLs fornecidas
