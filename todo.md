
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
- [x] Testar ingestão real, falhas da fonte, duplicatas e execução do pipeline no ambiente configurado

- [x] Verificar Articket e Blacktag como fontes públicas para a busca de eventos
- [x] Confirmar eventos encontrados em Lucky Scope e Curvão Surf House; não inventar resultados para Valluns Garden, Verilonguinho, Moby House e Meu Lugar
- [x] Implementar ingestão filtrada a partir das URLs e páginas públicas encontradas
- [x] Testar deduplicação, escopo geográfico e gêneros musicais dos eventos encontrados
- [x] Publicar a atualização da ingestão e documentar fontes e limitações de acesso
- [x] Conectar o fluxo `agent-ingestion` a um schedule recorrente que navegue as fontes e poste documentos renderizados
- [x] Executar uma ingestão real bem-sucedida com dois eventos persistidos das URLs fornecidas

- [x] Inspecionar publicamente as URLs Zig Tickets e Ingresse e registrar os dados observados
- [x] Criar apenas eventos elegíveis para Santos/Guarujá e o recorte musical permitido
- [x] Registrar as duas URLs como fontes para futuras captações automáticas
- [x] Testar deduplicação e disponibilidade dos eventos no feed público por consulta pública configurada e contagem idempotente
- [x] Executar o endpoint/pipeline de ingestão usando as URLs Zig/Ingresse e registrar evidência de sucesso
- [x] Validar na API/feed público que os eventos importados aparecem para os usuários
- [x] Adicionar e executar teste automatizado do pipeline em duas passagens e validar a identidade sourceUrl + data
- [x] Confirmar eventos para Valluns Garden, Verilonguinho, Moby House e Meu Lugar ou documentar ausência de resultados

- [x] Localizar imagens oficiais verificáveis da Festa do Branco e do Nosso After - MC Luuky
- [ ] Localizar preços de ingressos verificáveis para os dois eventos
- [x] Atualizar os registros e validar a exibição pública de imagem e preço; preço do Nosso After sinalizado como não informado
- [x] Exibir preço confirmado ou “Preço não informado” diretamente nos cards dos eventos
- [ ] Confirmar o preço do Nosso After em uma fonte oficial antes de substituir o estado não informado
