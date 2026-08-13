
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
- [x] Localizar preços de ingressos verificáveis; Festa do Branco com valor publicado e Nosso After sem preço público por vendas encerradas
- [x] Atualizar os registros e validar a exibição pública de imagem e preço; preço do Nosso After sinalizado como não informado
- [x] Exibir preço confirmado ou “Preço não informado” diretamente nos cards dos eventos
- [x] Confirmar em fonte oficial que o Nosso After está com vendas encerradas e sem preço público; manter o estado não informado
- [x] Adicionar selo visual de esgotado nos cards de eventos com vendas encerradas
- [x] Arquivar automaticamente eventos esgotados após a data de realização, sem excluir registros do banco
- [x] Exibir o selo Esgotado também na página de detalhes do evento
- [x] Inspecionar e adicionar eventos eletrônicos elegíveis das URLs Ingresse Réveillon Guarujá 2027 e Laroc Guarujá apresenta Meduza
- [x] Adicionar status estruturado de venda e reutilizá-lo no card, detalhe e arquivamento automático
- [x] Criar teste de integração do handler agendado arquivando evento vencido e removendo-o do feed/detalhe sem excluir o registro
- [x] Incorporar as URLs Ingresse novas ao fluxo automatizado e ampliar a allowlist de venues com testes de regressão
- [x] Criar teste de integração realista do arquivamento expirado, verificando estado persistido e ausência no feed/detalhe sem exclusão
- [x] Atualizar agent-ingestion e a configuração agendada com as duas URLs Ingresse, venues e testes ponta a ponta
- [x] Cobrir o fluxo completo de arquivamento com um adaptador de banco isolado, verificando atualização persistida e exclusão lógica do feed/detalhe
- [x] Cobrir o handler renderizado encaminhando as duas URLs Ingresse e a persistência dos eventos correspondentes no agent-ingestion
- [x] Testar que getEventBySlug não retorna evento arquivado e não exclui o registro
- [x] Testar persistência via saveEvent para os dois eventos Ingresse novos, incluindo as URLs e idempotência por fonte/data
- [x] Testar lookup por slug com registro arquivado preservado, comprovando que a condição isArchived/isPublished oculta o detalhe sem exclusão
- [x] Repetir a ingestão dos dois eventos Ingresse e validar idempotência por sourceUrl e data para ambos
- [x] Inspecionar no teste do lookup por slug as condições SQL isArchived=0 e isPublished=1, mantendo o registro arquivado preservado
- [x] Remover a aba/seção de precificação do início do layout, preservando os demais filtros
- [x] Adicionar atalho rápido para alternar entre Santos e Guarujá na interface principal
- [x] Adicionar filtro por local ou estabelecimento no feed público
- [x] Adicionar botão de compartilhamento na página de detalhes do evento
- [x] Cobrir o filtro por estabelecimento no helper público e no contrato tRPC
- [x] Cobrir o fallback de compartilhamento por cópia de link quando Web Share não estiver disponível
- [x] Ampliar o filtro público por local para buscar também no endereço do evento
- [x] Adicionar teste de regressão do contrato tRPC encaminhando venue para a listagem
- [x] Adicionar teste automatizado do fallback de compartilhamento via clipboard quando Web Share não estiver disponível
- [x] Criar pipeline autônomo de ingestão Instagram com Apify, filtro estrito de agenda e OCR
- [x] Extrair eventos aprovados com saída estruturada e fazer upsert no banco do WeekendVibes
- [x] Configurar o schedule WeekendVibe — ingestão Instagram para quinta-feira às 10:00 em modo automático
- [x] Validar o pipeline, o endpoint agendável, os segredos e o schedule sem confirmação manual
- [x] Executar OCR também quando a legenda não passar no filtro e combinar legenda com OCR antes da decisão
- [x] Adicionar testes do handler Instagram para autenticação cron-only, arquivamento e execução do pipeline
- [x] Adicionar teste controlado do pipeline cobrindo Apify, aprovação por OCR, saída estruturada e upsert
- [x] Adicionar teste mockado em que a legenda falha, o OCR contém a agenda aprovada e o evento é persistido
- [x] Criar carrossel destacado na página inicial exclusivo para eventos recentes da Agenda da Semana
- [x] Expor e filtrar os eventos recentes capturados pela Agenda da Semana sem misturar outras fontes
- [x] Validar carrossel em estados de carregamento/vazio e em mobile/desktop
- [x] Adicionar marcador estruturado da origem Agenda da Semana e filtrar o carrossel por esse marcador
- [x] Usar atualização/captura recente para manter no carrossel eventos reingeridos, sem depender de createdAt
- [x] Cobrir consulta dedicada com evento Instagram não-Agenda excluído e evento reingerido incluído
- [x] Cobrir explicitamente loading, empty e success states do carrossel
- [x] Testar a consulta real recentInstagramAgenda com sourceType diferente excluído e updatedAt recente incluído apesar de createdAt antigo
- [x] Adicionar teste de renderização do Home/carrossel com query mockada cobrindo loading, empty e success
- [x] Testar a consulta/rota com itens mockados, excluindo sourceType diferente e mantendo evento com createdAt antigo e updatedAt recente
- [x] Testar o Home integrado com query recentInstagramAgenda mockada nos estados loading, empty e success
- [x] Incluir arquivos client/**/*.test.tsx na configuração Vitest e executar os testes integrados do Home/carrossel
- [x] Adicionar teste da consulta recentInstagramAgenda com banco mockado retornando itens controlados: excluir sourceType diferente e incluir createdAt antigo com updatedAt recente

## Alertas de falha nas integrações
- [x] Modelar alertas operacionais para falhas de Apify, OCR e OpenAI
- [x] Capturar e persistir falhas do pipeline com deduplicação e estado de leitura
- [x] Expor alertas ao frontend via contrato tRPC público e seguro
- [x] Adicionar centro visual de notificações com badge, lista e ação de marcar como lido
- [x] Cobrir falhas, consulta, leitura e estados visuais com testes Vitest
- [x] Validar a interface em desktop/mobile e publicar checkpoint
- [x] Implementar marcar alerta como lido/resolvido via mutation tRPC com atualização otimista e invalidação
- [x] Testar o fluxo de resolução no frontend e o contrato operationalAlerts.resolve
- [x] Adicionar estados de loading e erro ao centro de alertas
- [x] Implementar atualização otimista com rollback no cache para resolver alertas
- [x] Simular clique no centro visual e comprovar mutate com o id correto
- [x] Testar o contrato tRPC operationalAlerts.resolve com autorização admin
- [x] Salvar novo checkpoint após os ajustes finais de alertas

## Revisão de destaque Instagram enviado pelo usuário
- [x] Consultar publicamente o destaque fornecido e registrar os dados realmente observados
- [x] Validar eventos encontrados contra Santos/Guarujá, categorias e gêneros permitidos: o item observado era passado e gastronômico, portanto inelegível
- [x] Persistir somente eventos elegíveis na Agenda da Semana com origem verificável: nenhum evento elegível confirmado; nenhuma inserção realizada
- [x] Verificar idempotência da ingestão manual, consultar os três eventos elegíveis e preparar a publicação

## Ingestão manual de capturas do Meu Lugar Bar
- [x] Extrair e documentar os eventos visíveis nas quatro capturas enviadas
- [x] Validar data futura, endereço do Meu Lugar Bar, cidade e gêneros musicais permitidos
- [x] Persistir eventos elegíveis com origem manual verificável e imagem da captura quando aplicável
- [x] Testar idempotência, consultar a Agenda da Semana e publicar a atualização
- [x] Analisar explicitamente a captura 1000595737, registrar que é uma arte alternativa do mesmo Pagode do Mota e não um evento adicional
- [x] Documentar a classificação principal samba/pagode do Pagode do Mota, mantendo DJ Babu como atração complementar de funk
- [x] Repetir a inserção idêntica das capturas e comprovar ausência de duplicatas
- [x] Consultar a query Agenda da Semana e verificar os três cards no frontend
- [x] Salvar novo checkpoint após a atualização dos eventos manuais

## Habilidade reutilizável de ingestão de agendas
- [x] Definir o fluxo reutilizável de fontes públicas, capturas, validação geográfica/musical e deduplicação
- [x] Criar a habilidade com SKILL.md e recursos de referência necessários
- [x] Validar a habilidade com o validador oficial e corrigir eventuais problemas
- [x] Entregar o arquivo SKILL.md da habilidade ao usuário

## Rotina automática de terça-feira
- [x] Revisar schedules existentes e o pipeline de ingestão da Agenda da Semana
- [x] Definir horário e fuso da execução de terça-feira
- [x] Criar ou atualizar schedule em modo automático, sem confirmação do usuário
- [x] Validar configuração, endpoint e histórico da rotina
- [x] Verificar disponibilidade do histórico do schedule atualizado: o serviço de schedules confirmou a configuração ativa, mas a primeira execução de terça-feira ainda não ocorreu e o CLI Heartbeat local não expõe esse task UID
- [x] Verificar os callbacks de ingestão de eventos e Instagram após a reconfiguração, sem executar uma ação duplicadora indevida: ambos estão publicados e retornam 403 sem a autenticação cron

## Painel administrativo da rotina de terça-feira
- [x] Exibir a próxima execução da rotina com data, horário e fuso local
- [x] Criar endpoint protegido para disparo manual imediato da ingestão
- [x] Adicionar botão administrativo com confirmação, loading, sucesso e erro
- [x] Impedir disparos simultâneos e preservar idempotência do pipeline
- [x] Cobrir contrato, autorização, estados visuais e publicar a atualização
- [x] Conectar o painel administrativo ao metadata real do schedule ativo para exibir nextExecutionAt, fuso e estado reais
- [x] Adicionar testes TSX do AdminRoutinePanel para loading, erro, sucesso, botão desabilitado e confirmação
- [x] Validar por teste que o disparo manual reproduz a mesma composição da rotina automática de terça-feira
- [x] Ler metadata autoritativa do schedule ativo, incluindo timezone, runMode, nextExecutionAt e estado, sem hardcode ou heurística por regex
- [x] Testar que o painel exibe os campos reais retornados pela integração de metadata do schedule
- [x] Testar que a execução manual usa exatamente o mesmo serviço e composição da rotina automática, incluindo arquivamento, fontes públicas e Instagram
- [x] Ler metadata do schedule ativo a partir da fonte autoritativa usada pela configuração publicada, sem taskUid hardcoded, expondo timezone, runMode, nextExecutionAt e estado reais
- [x] Adicionar asserts explícitos no AdminRoutinePanel para nextExecutionAt, timezone e runMode vindos da integração
- [x] Criar serviço compartilhado pelos handlers agendados e botão manual e testar equivalência ponta a ponta com arquivamento, fontes públicas e Instagram
- [x] Salvar checkpoint do painel administrativo com metadata real e disparo manual

## Prioridades altas de produto
- [x] Criar seção “O que fazer hoje” com ordenação por data e horário, estados vazio/loading e links para detalhes
- [x] Implementar filtros combináveis por cidade, gênero, local, data, preço e horário
- [x] Implementar favoritos autenticados por usuário com persistência, toggle e lembretes configuráveis
- [x] Adicionar testes de backend, frontend e integração para os três fluxos
- [x] Validar responsividade, acessibilidade e publicar checkpoint
- [x] Validar acessibilidade dos novos fluxos, incluindo foco, rótulos/ARIA e navegação por teclado
- [x] Salvar e publicar novo checkpoint após concluir a validação final das prioridades altas

## Mapa interativo por região
- [x] Criar mapa público interativo de eventos com foco em Santos e Guarujá
- [x] Agrupar eventos próximos em clusters regionais e atualizar os grupos com filtros
- [x] Integrar mapa ao feed, popups acessíveis e estados loading/vazio/erro
- [x] Cobrir agrupamento, integração visual, acessibilidade e responsividade com testes
- [x] Salvar e publicar checkpoint do mapa interativo

## Tela cheia e rotas do mapa
- [x] Adicionar abertura do mapa em tela cheia no mobile com fechamento acessível
- [x] Adicionar botões para iniciar rotas até os locais dos eventos e clusters
- [x] Validar fallback de localização, links de navegação, acessibilidade e responsividade
- [x] Salvar e publicar checkpoint das melhorias do mapa

## Distância, tempo e transporte no mapa
- [x] Solicitar localização atual do usuário com estados de permissão e indisponibilidade
- [x] Exibir distância e tempo estimado até os eventos localizados
- [x] Adicionar seletor acessível de carro, transporte público, bicicleta e caminhada
- [x] Gerar rotas com o meio de transporte selecionado e fallback seguro
- [x] Testar cálculos, permissões, acessibilidade e responsividade
- [x] Salvar e publicar checkpoint das estimativas e transportes

## Tema claro tropical
- [x] Criar tokens claros mantendo laranja, roxo e amarelo da identidade visual
- [x] Integrar alternância clara/escura com rótulo e persistência acessíveis
- [x] Ajustar componentes públicos e mapa para leitura correta no tema claro
- [x] Validar contraste, foco, responsividade e alternância com testes e captura visual
- [x] Salvar e publicar checkpoint do tema claro

## Transição e alto contraste
- [x] Adicionar transição suave entre temas com respeito a prefers-reduced-motion
- [x] Criar tokens e sobrescritas de alto contraste para baixa visão
- [x] Integrar controle acessível e persistente da paleta de alto contraste
- [x] Validar foco, legibilidade, movimento, responsividade e testes
- [x] Salvar e publicar checkpoint de acessibilidade visual

## Compartilhamento visual social
- [x] Criar card visual de compartilhamento com imagem oficial e dados reais do evento
- [x] Adicionar ações para WhatsApp, compartilhamento nativo e redes sociais compatíveis
- [x] Manter fallback acessível para copiar link e texto formatado
- [x] Atualizar metadados sociais da página de evento para prévias de link
- [x] Validar conteúdo, acessibilidade, responsividade e testes
- [x] Salvar e publicar checkpoint do compartilhamento visual

## Mensagem personalizada no WhatsApp
- [x] Adicionar campo editável com mensagem padrão baseada no evento
- [x] Integrar texto personalizado ao link de compartilhamento do WhatsApp
- [x] Adicionar contador, limite e restauração da mensagem padrão
- [x] Validar acessibilidade, conteúdo, estados e testes
- [x] Salvar e publicar checkpoint da mensagem personalizada

## Auditoria estratégica do produto
- [x] Auditar produto, arquitetura, UX mobile e jornada de descoberta/compartilhamento
- [x] Avaliar acessibilidade, desempenho, SEO, dados e confiabilidade operacional
- [x] Priorizar oportunidades por impacto, esforço, risco e dependências
- [x] Entregar diagnóstico completo com roadmap recomendado

## Geocodificação e relatórios operacionais
- [x] Criar fila assíncrona e idempotente de geocodificação para eventos do Instagram
- [x] Persistir status, confiança, provedor e timestamp da geocodificação
- [x] Integrar a execução ao fluxo seguro de jobs sem timers em processo
- [x] Criar painel de relatórios de ingestão por execução e por fonte
- [x] Permitir reprocessamento administrativo seguro de fontes com falha
- [x] Cobrir autorização, concorrência, idempotência, erros e acessibilidade com testes
- [x] Salvar e publicar checkpoint da geocodificação e dos relatórios operacionais

## Reforço de segurança e proteção de dados
- [x] Auditar autenticação, autorização, sessões, entradas, CORS, headers e endpoints administrativos
- [x] Reforçar validação, limites, proteção contra abuso e respostas sem dados sensíveis
- [x] Revisar segredos, logs, armazenamento e exposição de dados pessoais
- [x] Proteger fluxos de ingestão, reprocessamento e geocodificação contra concorrência e abuso
- [x] Adicionar testes de segurança e validar regressões
- [x] Salvar e publicar checkpoint do reforço de segurança

## Páginas de erro de autenticação
- [x] Criar página personalizada para acesso negado com orientação e ações úteis
- [x] Criar página personalizada para sessão expirada com retorno seguro ao login
- [x] Integrar estados protegidos sem expor detalhes sensíveis
- [x] Validar navegação, acessibilidade, responsividade e testes
- [x] Salvar e publicar checkpoint das páginas de erro
