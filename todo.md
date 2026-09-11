
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

## Redirecionamento inteligente pós-login
- [x] Preservar a rota interna original ao iniciar o login a partir de sessão expirada
- [x] Retornar o usuário à rota solicitada após callback OAuth bem-sucedido
- [x] Validar destino, impedir open redirect e usar fallback seguro para a Home
- [x] Cobrir evento, painel, query string, acessibilidade e testes de regressão
- [x] Salvar e publicar checkpoint do redirecionamento pós-login

## Correção do Nosso After — MC Luuky
- [x] Consultar a página oficial do Ingresse e registrar os dados confirmados
- [x] Comparar status, preço, data, local, imagem e link com o evento persistido
- [x] Corrigir o status incorreto de esgotado e demais informações divergentes confirmadas
- [x] Validar feed, detalhe, compartilhamento e testes de idempotência
- [x] Salvar e publicar checkpoint da correção do evento

## Nova fonte Ingresse — Nosso After 14/08
- [x] Consultar a URL oficial e registrar os dados confirmados; a página individual permaneceu dinâmica e campos não confirmados foram mantidos sem preenchimento
- [x] Verificar elegibilidade para Santos/Guarujá e categorias/gêneros musicais permitidos no pipeline
- [x] Comparar com eventos existentes; não persistir ainda o evento parcial porque horário, endereço completo, imagem, preço e disponibilidade não foram confirmados
- [x] Registrar a URL no conjunto de fontes futuras do Ingresse
- [x] Validar Agenda da Semana, feed, detalhe e idempotência da fonte Ingresse
- [x] Salvar e publicar checkpoint da atualização

## Substituição do evento Nosso After — 14/08
- [x] Consultar a URL oficial enviada e registrar somente os dados confirmados
- [x] Remover ou arquivar o evento Nosso After — MC Luuky incorreto da Agenda da Semana sem apagar histórico indevidamente
- [x] Persistir o Nosso After — 14/08 com deduplicação e origem Ingresse, somente se a cidade, data e categoria forem verificáveis
- [x] Validar Agenda da Semana, feed, detalhe e idempotência da substituição
- [x] Executar Vitest e TypeScript e publicar checkpoint da alteração

## Tag visual de atualização na Agenda da Semana
- [x] Adicionar tag visual “Atualizado” ao card do Nosso After — 14/08
- [x] Garantir contraste, leitura por tecnologias assistivas e responsividade da tag
- [x] Cobrir a renderização da tag com teste e validar visualmente a Home
- [x] Executar Vitest e TypeScript e publicar checkpoint da melhoria

## Tag automática de eventos novos
- [x] Exibir automaticamente “Novo” para eventos criados nos últimos sete dias
- [x] Preservar a tag “Atualizado” e evitar sobreposição visual entre as tags
- [x] Cobrir limites da janela temporal, eventos futuros e datas inválidas com testes
- [x] Validar acessibilidade, responsividade, suíte completa e publicar checkpoint

## Animação sutil da tag Novo
- [x] Adicionar animação discreta de destaque à tag “Novo” na listagem
- [x] Respeitar prefers-reduced-motion e manter acessibilidade visual
- [x] Cobrir a classe/estilo da animação com teste e validar visualmente
- [x] Executar Vitest e TypeScript e publicar checkpoint

## Auditoria de agendamentos e bots automáticos
- [x] Mapear todas as rotinas automáticas implementadas e seus endpoints publicados
- [x] Inspecionar schedules ativos, modo de execução, próxima execução e histórico recente
- [x] Verificar se há bots ou schedules duplicados e se a rotina é idempotente
- [x] Comparar o schedule ativo com o código, secrets e fontes configuradas
- [x] Registrar riscos, evidências e recomendações sem alterar a configuração durante a auditoria

## Correção crítica da autenticação Cron e consolidação
- [x] Implementar autenticação específica e segura para os três callbacks `/api/scheduled/*`
- [x] Rejeitar chamadas sem autenticação cron válida com HTTP 403
- [x] Adicionar testes de integração para sucesso 2xx, acesso negado 403 e erro interno 500 com stack
- [x] Executar suíte completa, TypeScript e validação dos callbacks
- [x] Salvar checkpoint e publicar a correção antes de alterar schedules
- [x] Executar trigger manual controlado do Heartbeat e validar logs de produção
- [x] Avaliar e consolidar o Heartbeat diário com o schedule semanal sem duplicidade

## Métricas e alertas de ingestão no painel administrativo
- [x] Exibir quantidade de eventos ingeridos por fonte no painel administrativo
- [x] Exibir estado e detalhes de alertas para timeout e respostas HTTP 5xx
- [x] Garantir acesso administrativo, estados vazios e atualização segura dos dados
- [x] Adicionar testes de backend e frontend, validar visualmente e publicar checkpoint

## Novos perfis Instagram para monitoramento
- [x] Validar URLs e escopo regional de Flamingo Bar, Rocket Sea Club e Ativa House; os perfis foram aceitos na configuração, mas o Instagram redirecionou para login e não permitiu confirmar publicamente a cidade
- [x] Adicionar @flamingomusicbar, @rocketseaclub e @ativahouse ao pipeline Apify
- [x] Preservar filtros de 5 dias, “Agenda da semana”, hashtags e categorias musicais
- [x] Executar testes, validar a configuração e publicar checkpoint

## Ingestão manual e aliases de locais
- [x] Executar ingestão manual dos novos perfis Instagram e registrar o resultado real — execução realizada; bloqueada por restrição externa do provedor
- [x] Verificar se eventos importados aparecem corretamente no feed e na Agenda da Semana — nenhum evento novo verificável foi importado
- [x] Criar interface administrativa para listar, adicionar, editar e remover aliases de locais
- [x] Persistir aliases com autorização administrativa e aplicar os aliases no filtro de ingestão
- [x] Adicionar testes, validar visualmente o painel e publicar checkpoint; a rota administrativa foi validada com sessão expirada e requer login admin para inspeção visual

## Reexecução da ingestão após restauração dos créditos
- [x] Reexecutar a ingestão manual oficial dos oito perfis — tentativas realizadas; Meta recusou a ação por permissão efetiva
- [x] Verificar eventos dos três novos perfis no feed e na Agenda da Semana — nenhum evento novo verificável foi persistido
- [x] Registrar o resultado real e publicar o fechamento da tarefa — resultado registrado como bloqueio externo

## Resiliência do OCR para imagens CDN do Instagram
- [x] Converter imagens CDN acessíveis para payload compatível com OCR antes da chamada OpenAI
- [x] Não interromper o lote quando uma imagem estiver inacessível ou inválida; registrar alerta e continuar com legenda
- [x] Adicionar testes para URL de imagem inválida, fallback de legenda e continuidade do lote
- [x] Reexecutar ingestão, validar eventos e publicar correção — reexecução tentada; não houve eventos verificáveis por restrição externa

## Tolerância a rate limit do OCR
- [x] Adicionar retry com backoff curto para respostas HTTP 429 da OpenAI
- [x] Continuar o lote com fallback seguro quando o OCR não puder ser executado após retry
- [x] Adicionar testes determinísticos para retry e fallback de rate limit
- [x] Reexecutar ingestão e registrar o resultado final dos novos perfis — registrado como bloqueado por HTTP 402 do Apify antes da migração oficial

- [x] Tratar rate limit 429 do OCR por post, registrar alerta e continuar o lote com a legenda

## Migração do Instagram sem Apify
- [x] Mapear todas as dependências reais do Apify no projeto e comparar com o caminho Python solicitado
- [x] Escolher uma coleta pública gratuita compatível com o runtime publicado, sem contornar login ou controles de acesso
- [x] Remover chamadas, secrets, URLs e testes específicos do Apify
- [x] Preservar contas-alvo, janela de 5 dias, filtros textuais, OpenAI e upsert
- [x] Executar teste real da coleta alternativa e registrar limitações ou sucesso verificável
- [x] Executar suíte, revisar schedules e publicar somente após validação

## Migração para API oficial Meta/Instagram
- [x] Confirmar requisitos de contas profissionais, vinculação Meta e permissões necessárias
- [x] Configurar credenciais oficiais em secrets sem expor tokens
- [x] Validar acesso aos perfis e identificar quais contas são elegíveis pela API oficial
- [x] Implementar coleta oficial preservando filtros, OpenAI e upsert
- [x] Remover Apify somente após coleta oficial real e testes aprovados — Apify removido; testes aprovados; Meta permaneceu bloqueada antes de dados reais
- [x] Publicar checkpoint da migração com evidências de execução

## Business Discovery com credenciais Meta oficiais
- [x] Alinhar os secrets usados pelo projeto para META_INSTAGRAM_TOKEN e META_INSTAGRAM_ACCOUNT_ID
- [x] Validar o token e o ID da conta contra o endpoint oficial da Meta — tentativas registradas; respostas de permissão/expiração foram documentadas
- [x] Implementar Business Discovery no pipeline Instagram TypeScript real
- [x] Preservar janela de 5 dias, filtro “Agenda da semana”, hashtags, OpenAI e upsert
- [x] Executar teste oficial com log 2xx e comprovar eventos persistidos — tentativa oficial executada; não houve 2xx por restrição Meta, sem declarar falso sucesso
- [x] Remover referências ao Apify somente após a comprovação e publicar checkpoint

- [x] Corrigir o teste de credenciais para usar graph.facebook.com/v26.0 e validar /me e /me/accounts
- [x] Confirmar o ID profissional e permissões efetivamente retornados pelo token antes de implementar a consulta

## Revalidação do token Meta e Business Discovery
- [x] Reexecutar `/me` e `/me/accounts` com o novo token Meta — tentativa registrada; validação efetiva permaneceu restrita
- [x] Confirmar o vínculo retornado com o ID Instagram 17841438723866203 — ID mantido na configuração; vínculo efetivo não foi confirmado pela resposta operacional
- [x] Executar Business Discovery e extrair posts elegíveis da Agenda da Semana se a validação passar

## Orientação de vinculação Meta
- [x] Pesquisar instruções oficiais atuais para vincular Página do Facebook e Instagram profissional
- [x] Entregar passo a passo de configuração e checklist de validação do token/API

## Consolidação Instagram sem Apify
- [x] Remover chamadas, variáveis e referências do Apify do projeto
- [x] Preparar cliente Business Discovery com secrets Meta, sem executar quando credenciais não estiverem válidas
- [x] Implementar coletor público sem credenciais com modo sem dados para HTTP 302/429
- [x] Preservar filtros de 5 dias, Agenda da semana, hashtags, cidades, gêneros, OpenAI e upsert
- [x] Atualizar testes de fallback, remover expectativas Apify e verificar schedules
- [x] Executar suíte completa e publicar checkpoint da refatoração

## Reativação oficial Meta — solicitação atual
- [x] Reativar exclusivamente a coleta oficial Business Discovery com os secrets Meta atualizados
- [x] Remover o coletor público temporário e seus caminhos de fallback do pipeline
- [x] Executar ingestão oficial dos perfis alvo e registrar respostas HTTP da Graph API — respostas de erro de permissão registradas por tentativa
- [x] Validar eventos reais persistidos no banco e sua presença na Agenda da Semana — validação realizada sem novos eventos, pois a Meta não autorizou a captura
- [x] Atualizar testes, executar suíte completa e publicar checkpoint da alteração

## Reexecução Meta com token de longa duração
- [x] Reexecutar Business Discovery com o token atualizado e registrar HTTP por perfil — execução registrada com bloqueio de permissão
- [x] Confirmar eventos aprovados da Agenda da Semana e persistência idempotente no banco — nenhum novo evento aprovado nesta execução
- [x] Atualizar evidências, executar suíte e publicar checkpoint somente após validação — evidência negativa e limitação externa documentadas

## Nova reexecução após app Meta Ao Vivo
- [x] Reexecutar Business Discovery com os secrets atuais e registrar HTTP por perfil — bloqueio Meta registrado
- [x] Confirmar posts elegíveis da Agenda da Semana e eventos persistidos no banco — nenhum post elegível verificável
- [x] Atualizar evidências, suíte e checkpoint após resultado verificável — resultado não verificável por restrição externa documentado

## Nova tentativa com token Meta regenerado em produção
- [x] Executar Business Discovery com o token regenerado e registrar o status HTTP real — HTTP 400 de permissão registrado
- [x] Validar posts elegíveis da Agenda da Semana e persistência dos eventos no banco — nenhum post elegível ou inserção nova confirmados
- [x] Atualizar evidências, suíte e checkpoint somente após resultado verificável — tentativa concluída com limitação Meta documentada

## Correção de secrets no runtime do schedule
- [x] Inspecionar o schedule ativo e o prompt de execução sem expor valores
- [x] Corrigir a disponibilização explícita de SCHEDULED_TASK_ENDPOINT_BASE e SCHEDULED_TASK_COOKIE no runtime — substituído por Heartbeat direto, que não depende dessas variáveis
- [x] Publicar a alteração antes de qualquer trigger do schedule
- [x] Executar trigger manual e validar endpoint privado e logs sanitizados — Run Now único do AGENT confirmou missing_required_environment antes do POST; nenhum segredo ou payload foi exposto
- [x] Atualizar testes e registrar o resultado no checkpoint — diagnóstico operacional registrado; nenhuma alteração de código foi necessária

## Diagnóstico temporário do AGENT
- [x] Reativar o AGENT cron antigo sem alterar o Heartbeat direto
- [x] Executar exatamente um Run Now e registrar o resultado sanitizado
- [x] Pausar novamente o AGENT para evitar duplicidade

## Monitoramento diário do Heartbeat direto
- [x] Definir métricas de saúde e persistência sem disparar a ingestão novamente
- [x] Implementar callback cron-only para registrar a última execução e contagens observadas
- [x] Adicionar testes para sucesso, ausência de execução recente e falha de persistência
- [x] Publicar o callback antes de criar o schedule diário
- [x] Criar schedule diário automático e validar metadata, logs e estado

## Schedule diário de monitoramento
- [x] Criar `weekendvibes-monitor-diario` em modo automático
- [x] Configurar POST para `/api/scheduled/monitor-heartbeat` às 09:00 no fuso de São Paulo
- [x] Validar metadata, autenticação cron e ausência de duplicidade com o Heartbeat de ingestão

## Ajuste de horário do monitor diário
- [x] Atualizar `weekendvibes-monitor-diario` para 08:00 America/Sao_Paulo (11:00 UTC)
- [x] Preservar POST, endpoint, task_uid e autenticação nativa do Heartbeat
- [x] Confirmar status ativo e primeira execução programada

## Auditoria operacional de 16/08
- [x] Listar todas as tarefas agendadas ativas e consolidar o status geral
- [x] Consultar o primeiro log de execução de `weekendvibes-monitor-diario` em 16/08 — consulta realizada; ainda não há execução registrada
- [x] Registrar status HTTP, saúde e persistência sem expor credenciais — sem log disponível antes da janela programada

## Verificação pós-execução do monitor diário
- [x] Consultar a primeira execução após 16/08 às 08:00 de São Paulo — consulta realizada; nenhum run foi retornado
- [x] Confirmar status HTTP, `healthy` e contagem de eventos persistidos — indisponíveis porque não há execução registrada
- [x] Registrar o resultado sanitizado sem expor autenticação

## Alertas Meta e tendência semanal
- [x] Detectar respostas HTTP 200 da Meta com zero mídias e persistir alerta deduplicado
- [x] Cobrir o alerta 200/zero mídias em testes de backend e integrar à central administrativa
- [x] Criar consulta protegida de tendência semanal com receivedPosts, approvedPosts, structuredEvents, importedCount e idade da última execução
- [x] Construir painel administrativo responsivo com gráfico/tabela acessível e estados loading, vazio e erro
- [x] Atualizar README e documentação de infraestrutura para refletir Drizzle/MySQL-TiDB
- [x] Executar Vitest, TypeScript, validação visual e publicar checkpoint

- [x] Tornar os smoke tests externos da Meta não bloqueantes quando houver HTTP 400/403/429 ou credencial indisponível, preservando a cobertura local

## Limpeza automática de eventos expirados
- [x] Revisar schema e consultas para identificar o campo temporal efetivo dos eventos
- [x] Implementar limpeza exclusiva da tabela de eventos com comparação correta no fuso America/Sao_Paulo
- [x] Registrar de forma sanitizada a métrica de eventos expirados removidos
- [x] Integrar a limpeza ao monitoramento diário sem duplicar ingestão
- [x] Adicionar testes de timezone, limite de expiração, idempotência e isolamento de tabelas
- [x] Executar suíte, revisar TODO e publicar checkpoint

## Verificação da edição visual do OperationalAlertCenter
- [x] Inspecionar o botão alvo e confirmar se a remoção da aba já está aplicada
- [x] Corrigir manualmente o alvo caso a edição visual não tenha sido aplicada
- [x] Validar a interface e publicar um novo checkpoint

## Limpeza e centralização de alertas de integração
- [x] Mapear e remover componentes, imports e referências visuais de alertas que não são mais utilizados
- [x] Criar seção exclusiva no painel administrativo para listar, filtrar e resolver alertas de integração
- [x] Investigar e corrigir o ReferenceError `ReferenceError: әт is not defined`
- [x] Atualizar testes de frontend e backend para a nova seção administrativa e ausência do erro de console
- [x] Validar interface, suíte completa e publicar novo checkpoint

## Otimização de CSS e bundle administrativo
- [x] Corrigir a ordem do `@import` de fontes no CSS global
- [x] Reduzir o bundle inicial com carregamento sob demanda das áreas administrativas
- [x] Validar tamanhos dos chunks, TypeScript, testes e build de produção
- [x] Publicar checkpoint da otimização de desempenho

## Mobile, qualidade dos eventos e administração de fontes
- [x] Implementar lazy loading e navegação inferior otimizada para mobile
- [x] Exibir indicadores públicos de qualidade e confiança nos cards e detalhes dos eventos
- [x] Criar administração de fontes com ativação/desativação, prioridade, frequência e último sucesso
- [x] Preservar autenticação admin-only e impedir que alterações de frequência criem schedules duplicados
- [x] Atualizar testes, validar interface mobile/desktop e publicar checkpoint

## Habilidade reutilizável do processo WeekendVibes
- [x] Consolidar o fluxo reutilizável de ingestão, validação, qualidade, deduplicação e automação
- [x] Criar SKILL.md e referências sem credenciais ou dados sensíveis
- [x] Validar a habilidade com o validador oficial e entregar o arquivo ao usuário

## Remoção de filtro duplicado
- [x] Localizar os dois filtros exibidos no início e identificar o redundante
- [x] Remover o filtro redundante preservando o filtro funcional
- [x] Atualizar testes, validar a interface e publicar checkpoint

## Relatório operacional do período de ausência
- [x] Coletar estado atual dos schedules, execuções e alertas disponíveis
- [x] Consolidar mudanças e resultados sem inventar execuções não registradas
- [x] Entregar relatório operacional ao usuário

## Saneamento operacional da ingestão e logs
- [x] Auditar o schedule de Instagram, callback e registros de execução
- [x] Garantir carregamento singleton/lazy do Google Maps sem reinicializações redundantes
- [x] Padronizar falhas de sessão inválida sem afetar chamadas cron autenticadas
- [x] Reativar e publicar a configuração do schedule; disparo controlado permanece bloqueado por ambiente ausente
- [x] Validar `ingestionRuns`, eventos persistidos e métricas da execução — dispensado pelo usuário nesta sessão; a execução autônoma será validada pelo Heartbeat

## Skeleton loading de eventos
- [x] Mapear estados de carregamento da agenda e dos cards
- [x] Criar skeletons reutilizáveis com animação acessível
- [x] Integrar skeletons à Home e validar testes/interface
- [x] Publicar checkpoint da melhoria de loading

## Compartilhamento social nos detalhes
- [x] Mapear os contratos e componentes atuais de compartilhamento — já existente em `EventDetail` e `EventShareCard`
- [x] Adicionar ações de WhatsApp, Web Share API e copiar link — já implementado, com Facebook e Instagram adicionais
- [x] Cobrir acessibilidade, feedback e fallback nos testes — cobertura existente para URLs sociais e fallback nativo/cópia
- [x] Validar interface mobile e publicar checkpoint — não aplicável: nenhuma alteração nova foi necessária

## Exportação para calendários
- [x] Mapear os dados disponíveis de data, duração, local e descrição do evento
- [x] Implementar URL do Google Calendar e arquivo iCalendar compatível com Apple Calendar
- [x] Integrar ações acessíveis aos detalhes do evento e cobrir testes
- [x] Validar interface mobile e publicar checkpoint

## Atualização da habilidade WeekendVibes
- [x] Incorporar ao skill o workflow de exportação para Google Calendar e Apple Calendar
- [x] Atualizar referências e critérios de validação da habilidade
- [x] Executar o validador oficial e entregar a habilidade atualizada

## Teste visual minimalista
- [x] Reduzir a complexidade visual da Home sem perder a identidade tropical
- [x] Preservar contraste, foco visível, responsividade e navegação mobile
- [x] Validar a variação em desktop/mobile, executar testes e publicar checkpoint

## Microinterações e modo escuro minimalista
- [x] Adicionar hover/focus sutis e acessíveis aos cards de eventos
- [x] Consolidar o alternador de modo escuro com identidade minimalista tropical
- [x] Validar prefers-reduced-motion, desktop/mobile, testes e publicar checkpoint

## Transição de temas e compatibilidade visual
- [x] Implementar transição suave entre modo claro e escuro
- [x] Ajustar skeleton loading para os tokens e contraste dos dois temas
- [x] Ajustar botões de compartilhamento para os dois temas e estados de foco/hover
- [x] Validar `prefers-reduced-motion`, desktop/mobile, testes e publicar checkpoint

## Verificação preventiva do schedule
- [x] Confirmar configuração, próxima execução e histórico do schedule Instagram
- [x] Verificar callback, autenticação cron e logs recentes sem expor segredos
- [x] Consolidar riscos e checklist da execução de amanhã

## Hashtags regionais e Stories
- [x] Definir regras para `#Guarujá` e `#Santos` sem relaxar o filtro de agenda e o escopo geográfico
- [x] Implementar coleta de Stories somente por fontes e permissões disponíveis, com fallback sem dados
- [x] Deduplicar posts, Stories e highlights e preservar a origem verificável
- [x] Atualizar testes, métricas e alertas de ingestão
- [x] Validar a rotina sem forjar eventos e publicar checkpoint

## Auditoria de segurança e privacidade
- [x] Auditar superfície de APIs, autenticação, CORS, headers, cookies, logs e tratamento de erros
- [x] Implementar rate limiting/throttling para rotas públicas e sensíveis
- [x] Restringir CORS a origens configuradas e seguras
- [x] Reforçar validação/sanitização de inputs e respostas sem vazamento de detalhes internos
- [x] Implementar security headers: CSP, HSTS, X-Content-Type-Options e X-Frame-Options
- [x] Revisar cookies de sessão e criar infraestrutura de consentimento para cookies não essenciais
- [x] Redigir política de redaction para logs e remover dados sensíveis em texto claro
- [x] Criar testes automatizados de segurança e documentação executiva com limitações residuais
- [x] Validar tudo e publicar checkpoint do hardening

## Política de Privacidade e Termos de Uso
- [x] Criar página pública com Política de Privacidade e Termos de Uso
- [x] Integrar links acessíveis no rodapé do site
- [x] Adicionar testes de rota, conteúdo essencial e navegação
- [x] Validar TypeScript, testes, build e publicar checkpoint

## Aceite obrigatório no login
- [x] Auditar o fluxo atual de autenticação e os pontos que iniciam o OAuth
- [x] Exigir checkbox de aceite dos Termos de Uso e Política de Privacidade antes do login
- [x] Exibir links legais e mensagem acessível sem persistir tokens ou dados desnecessários
- [x] Cobrir aceite, bloqueio sem aceite e regressão do login com testes
- [x] Validar TypeScript, testes, build e publicar checkpoint

## Upgrade de mapas e geomapeamento
- [x] Auditar componente de mapa, singleton, geocoding, dependências e testes atuais
- [x] Implementar lazy loading por Intersection Observer e singleton da API
- [x] Implementar marker clustering estável sem piscar ao filtrar eventos
- [x] Adicionar estilo tropical/minimalista, InfoWindows responsivos e bounds regionais
- [x] Adicionar geolocalização do usuário e ação Eventos perto de mim
- [x] Implementar fallback de coordenada aproximada para Santos/Guarujá com indicador visual
- [x] Cobrir as melhorias com testes e documentar a arquitetura do mapa
- [x] Validar TypeScript, Vitest, build, warnings de carregamento e publicar checkpoint

## Sincronização mapa-lista e métricas de viagem
- [x] Auditar o mapa regional, a lista pública e os utilitários de distância/tempo
- [x] Sincronizar a lista com os eventos visíveis no viewport após pan e zoom
- [x] Preservar seleção, clustering e estados vazios sem flicker durante mudanças do mapa
- [x] Exibir distância e tempo estimado nos InfoWindows a partir da localização atual
- [x] Cobrir viewport, localização, distância/tempo e regressões com testes
- [x] Validar TypeScript, Vitest, build, visual e publicar checkpoint

## Directions API e rota em tempo real
- [x] Auditar integração Maps, secrets e contratos de viagem
- [x] Implementar carregamento sob demanda da Directions API
- [x] Exibir rota detalhada, distância e duração real no InfoWindow
- [x] Implementar estados de carregamento, erro e fallback aproximado sem expor detalhes internos
- [x] Cobrir a integração com testes e atualizar a documentação de mapas
- [x] Validar TypeScript, Vitest, build, visual e publicar checkpoint

## Rotas alternativas e cache de Directions
- [x] Auditar fluxo atual de rotas e estratégia de cache
- [x] Implementar cache de curto prazo indexado por origem, destino e transporte
- [x] Solicitar e normalizar rotas alternativas sem armazenar dados sensíveis
- [x] Adicionar seletor acessível de rota no InfoWindow
- [x] Cobrir seleção, expiração, limite do cache e fallback com testes
- [x] Atualizar documentação, validar TypeScript/Vitest/build e publicar checkpoint

## Correção do mapa preto
- [x] Auditar console, carregamento da API e variáveis públicas do Google Maps
- [x] Auditar dimensões do contêiner, overlays, z-index e estilo escuro
- [x] Corrigir a causa raiz e preservar centralização em Santos/Guarujá
- [x] Adicionar ou atualizar testes para o carregamento e o tema do mapa
- [x] Validar visualmente, executar a suíte e publicar checkpoint
- [x] Corrigir o mapa preto: alinhar a credencial Forge server-side, relay same-origin, origem HTTPS encaminhada e callback do Google Maps; validar visualmente a rota Mapa dos rolês.
## Skeleton e tooltips dos marcadores do mapa
- [x] Adicionar skeleton animado e acessível durante lazy loading e inicialização do Google Maps
- [x] Adicionar tooltips interativos aos marcadores/clusters com local, quantidade e detalhes acionáveis
- [x] Cobrir estados de carregamento, erro, tooltip e acessibilidade com testes
- [x] Validar TypeScript, Vitest, build, responsividade e publicar checkpoint
## Legenda visual e interação touch do mapa
- [x] Adicionar legenda responsiva explicando cores por cidade, agrupamentos e endereços aproximados
- [x] Manter tooltip visível após toque no mobile com fechamento acessível e sem bloquear detalhes
- [x] Criar testes para legenda, comportamento touch e estados de acessibilidade
- [x] Validar TypeScript, Vitest, build, screenshots responsivos e publicar checkpoint
## Diagnóstico do fallback do Google Maps
- [x] Rastrear o estado loadError, o relay e a configuração de credenciais sem expor segredos
- [x] Capturar e registrar de forma redigida o erro técnico real do Google Maps
- [x] Corrigir a inicialização ou configuração responsável pelo fallback
- [x] Validar conexão em navegador, TypeScript, Vitest, build e publicar checkpoint
## Routes API e Minha Localização
- [x] Auditar o fluxo atual de DirectionsService, cache, transporte e geolocalização
- [x] Migrar o cálculo de rotas para a Routes API sem expor credenciais ou romper o fallback
- [x] Exibir distância e tempo estimado de chegada no InfoWindow e nos controles do mapa
- [x] Adicionar botão Minha Localização com estados de permissão, erro e sucesso
- [x] Criar testes para rotas, cache, localização e acessibilidade
- [x] Validar TypeScript, Vitest, build, screenshots responsivos e publicar checkpoint
## Mapa populado, filtros e InfoWindows
- [x] Conectar eventos ativos reais ao mapa e posicionar coordenadas exatas e aproximadas
- [x] Implementar clustering funcional com expansão ao clicar no agrupamento
- [x] Transformar legenda em filtros toggles por cidade e precisão/status
- [x] Exibir InfoWindows dark com imagem, título, data/horário e ação para detalhes
- [x] Adicionar testes de dados, filtros, clustering, InfoWindows e acessibilidade
- [x] Validar TypeScript, Vitest, build, screenshots responsivos e publicar checkpoint
## Ação Como chegar nos InfoWindows
- [x] Adicionar botão acessível Como chegar em cada InfoWindow individual
- [x] Gerar link direto do Google Maps com destino exato ou fallback aproximado por cidade
- [x] Cobrir link, escape, acessibilidade e abertura externa com testes
- [x] Validar TypeScript, Vitest, build, responsividade e publicar checkpoint
## Precisão geográfica, busca e auditoria de endereços
- [x] Auditar pipeline de ingestão, schema de eventos, busca pública e sincronização mapa-lista
- [x] Normalizar endereços, restringir geocodificação a Santos/Guarujá e aplicar fallbacks regionais seguros
- [x] Persistir bairro e endereco_formatado com coordenadas válidas e registrar falhas de endereço
- [x] Aprimorar busca por evento, bairro, rua e estabelecimento com atualização instantânea do mapa
- [x] Adicionar filtros geográficos e enquadramento suave por cidade/bairro/raio
- [x] Criar testes unitários e de integração, documentação técnica, validar build e publicar checkpoint
## Recuperação de contexto e resiliência Meta
- [x] Localizar e validar o diretório raiz do WeekendVibes no sandbox atual
- [x] Confirmar a versão/checkpoint disponível e os arquivos de integração Meta
- [x] Identificar a causa da falha HTTP 500 e tratar erros de token, permissões, rate limit e upstream sem vazar segredos
- [x] Adicionar testes de regressão e documentação operacional
- [x] Validar TypeScript, Vitest, build, logs e publicar checkpoint se houver alteração
## Indicador de integração Meta no painel
- [x] Auditar a fonte operacional de status e última sincronização bem-sucedida
- [x] Criar contrato protegido e indicador visual com estados ativo, degradado, falha e nunca sincronizado
- [x] Adicionar testes de autorização, estados, timestamp e responsividade
- [x] Validar TypeScript, Vitest, build, screenshots e publicar checkpoint
## Auditoria da ingestão automática de terça-feira
- [x] Definir a janela da execução das 10:00 America/Sao_Paulo e localizar o callback correspondente
- [x] Consultar logs de produção e ingestionRuns sem expor credenciais
- [x] Correlacionar HTTP, duração, modo degradado e contagens de mídias/eventos
- [x] Entregar relatório operacional com novos eventos persistidos
## Observabilidade completa em execuções degradadas
- [x] Auditar schema e fluxos que criam/atualizam ingestionRuns em falhas precoces
- [x] Persistir obrigatoriamente duration_ms, httpStatus e contagens zeradas quando degraded=true
- [x] Atualizar testes para Meta degradada, erro interno e execução bem-sucedida
- [x] Atualizar documentação, validar TypeScript/Vitest/build e publicar checkpoint

## Observabilidade de execuções degradadas — agosto de 2026
- [x] Adicionar duration_ms, httpStatus e counts à tabela ingestionRuns e aplicar a migração 0015_aromatic_black_tom
- [x] Persistir métricas completas em execuções bem-sucedidas, falhas internas e degradações Meta
- [x] Expor durationMs e counts no callback agendado do Instagram, com zeros explícitos em degraded=true
- [x] Cobrir normalização e persistência dos contadores com testes Vitest
- [x] Executar validação final completa e publicar checkpoint da observabilidade

## Atualização do contato legal
- [x] Substituir o texto provisório de contato pelo e-mail oficial weekendvibes.of@gmail.com
- [x] Atualizar ou criar teste da página legal para validar o novo contato
- [x] Validar e publicar checkpoint da alteração

## Link mailto no contato legal
- [x] Transformar o e-mail da seção de contato em link clicável mailto
- [x] Atualizar o teste da página legal para validar href e acessibilidade do link
- [x] Validar e publicar checkpoint da alteração

## Finalização front-end do Mapa dos rolês
- [x] Auditar a conexão de eventos persistidos com pins e clusters do mapa
- [x] Validar ou corrigir toggles de Santos, Guarujá e precisão exata/aproximada
- [x] Validar ou corrigir InfoWindows dark com imagem, título, data, local e detalhes
- [x] Atualizar testes e verificar responsividade desktop/mobile
- [x] Validar TypeScript/Vitest/build e publicar checkpoint

## Suíte E2E de interatividade do mapa
- [x] Auditar dependências e infraestrutura E2E existentes
- [x] Implementar cenário headless para toggles de Santos e Guarujá
- [x] Verificar no navegador o desaparecimento/retorno de pins e reajuste de clusters
- [x] Garantir mocks controlados do mapa e ausência de erros no console
- [x] Executar E2E, TypeScript, Vitest/build e publicar checkpoint

## Upgrade de performance, skeletons e mobile
- [x] Auditar skeletons existentes para cards, listagens e container do mapa
- [x] Implementar transição fade-in suave entre loading e conteúdo
- [x] Refinar InfoWindows e filtros inferiores para touch targets mínimos de 44px
- [x] Garantir margens e layout mobile dos modais e controles do mapa
- [x] Aplicar loading="lazy" às imagens de eventos e estratégia equivalente de dimensionamento responsivo
- [x] Atualizar testes Vitest/Playwright para estados de loading e interação mobile
- [x] Medir FCP/LCP e validar TypeScript, Vitest, E2E, build e responsividade
- [x] Publicar checkpoint com relatório de performance

## Srcset e InfoWindow touch mobile
- [x] Adicionar srcset e sizes responsivos às imagens de capa de eventos
- [x] Criar teste E2E mobile para abrir InfoWindow por toque
- [x] Validar fechamento do InfoWindow por toque e ausência de erros no console
- [x] Executar TypeScript, Vitest, E2E/build e publicar checkpoint

## Painel de saúde e alertas críticos da Meta
- [x] Auditar ingestão, painel admin, tabela ingestionRuns e classificação blocked_credentials
- [x] Implementar rota restrita de saúde com último status e métricas do lote
- [x] Implementar serviço Discord webhook sem expor secrets e com deduplicação segura do alerta crítico
- [x] Disparar alerta para blocked_credentials e códigos Meta 190/467 com instrução de renovação
- [x] Solicitar/configurar DISCORD_WEBHOOK_URL e validar lógica com testes Vitest
- [x] Validar TypeScript, Vitest, build, segurança e publicar checkpoint

## Diagnóstico do erro oficial do Google Maps
- [x] Auditar loader frontend, relay, variável pública e logs do Maps
- [x] Verificar se o projeto expõe diagnóstico seguro de chave, APIs e domínio
- [x] Corrigir qualquer configuração controlável no código sem expor credenciais
- [x] Validar testes/build e documentar os ajustes externos necessários no Google Cloud

## Fallback do mapa e alternância mapa/lista
- [x] Auditar estados de erro do Google Maps e a lista pública de eventos
- [x] Implementar mensagem amigável de falha com ação de recuperação
- [x] Criar alternador acessível entre mapa interativo e lista detalhada
- [x] Preservar filtros, dados e responsividade nos dois modos
- [x] Atualizar testes Vitest/Playwright, validar TypeScript/build e publicar checkpoint

## Conectividade do mapa e preferência de visualização
- [x] Exibir alerta amigável quando a falha do mapa for compatível com perda de conexão
- [x] Persistir a escolha mapa/lista no localStorage com leitura segura no cliente
- [x] Restaurar a preferência após recarregamento sem quebrar SSR ou testes
- [x] Atualizar testes Vitest/Playwright, validar TypeScript/build e publicar checkpoint

## Recuperação automática do mapa ao voltar a conexão
- [x] Auditar o listener online e o ciclo de retry do fallback do mapa
- [x] Recarregar automaticamente o mapa no evento browser online sem loops
- [x] Cobrir o comportamento com Vitest/Playwright e validar build
- [x] Publicar checkpoint da melhoria

## Reconexão avançada do mapa
- [x] Exibir mensagem transitória de conexão restabelecida após carregamento bem-sucedido
- [x] Implementar backoff progressivo para retries automáticos do mapa
- [x] Exibir indicador visual durante tentativas de reconexão
- [x] Adicionar botão de recarregamento manual quando o retry automático falhar
- [x] Atualizar testes Vitest/Playwright, validar TypeScript/build e publicar checkpoint

## Acesso à lista no erro do mapa
- [x] Adicionar botão “Ver em Lista” diretamente no estado de erro do mapa e validar a troca para o modo lista

## Auditoria técnica de qualidade e health check
- [x] Auditar tratamento de exceções, tipagem, ciclo de vida, UX, acessibilidade, segurança e validação de payloads
- [x] Corrigir defeitos confirmados e atualizar testes/documentação da auditoria
- [x] Executar validação completa e publicar checkpoint da auditoria
- [x] Corrigir lookup de marker por cluster no RegionalEventMap para reabrir/atualizar InfoWindows ao selecionar uma região
- [x] Garantir limpeza de intervalos e timeouts internos do loader singleton do Google Maps
- [x] Adicionar testes de regressão para os achados corrigidos e documentar o health check

## Resiliência do mapa e contratos externos
- [x] Auditar telemetria, controlador do mapa e respostas externas Meta/Routes/relay
- [x] Implementar analytics de fallback e métricas estruturadas de retry
- [x] Extrair controlador do mapa para máquina de estados explícita
- [x] Adicionar schemas e testes de contrato para Meta, Routes API e relay do Maps
- [x] Validar TypeScript, Vitest, E2E e build, documentar e publicar checkpoint

## Saneamento de schedules e reconciliação operacional
- [x] Desativar o schedule diário redundante da ingestão Instagram e manter apenas o Heartbeat semanal de terça-feira
- [x] Implementar reconciliação determinística pós-ingestão para Instagram e fontes públicas
- [x] Validar contagens, duplicidades, coordenadas inválidas e estado degraded sem expor dados sensíveis
- [x] Adicionar resumo operacional semanal ao painel administrativo restrito
- [x] Atualizar testes, documentação, validar TypeScript/Vitest/E2E/build e publicar checkpoint

## Periodicidade oficial da ingestão Instagram
- [x] Mudar a rotina oficial de ingestão do Instagram de terça-feira para quarta-feira às 10:00 em America/Sao_Paulo
- [x] Confirmar Heartbeat e schedules internos sincronizados, mantendo o schedule diário redundante pausado
- [x] Atualizar documentação, testes de periodicidade, validar configuração e publicar checkpoint

## Evolução do painel operacional administrativo
- [x] Implementar indicador de freshness para feed e fontes
- [x] Adicionar alertas acionáveis com severidade, estado e contexto sanitizado
- [x] Construir timeline correlacionada de Heartbeat, ingestionRuns e retries
- [x] Adicionar reconciliação visual por fonte com read, filtered, persisted e duplicidades
- [x] Atualizar testes, documentação, validar TypeScript/Vitest/E2E/build e publicar checkpoint

## Alertas automáticos de freshness e reconciliação
- [x] Implementar avaliação de freshness crítico com limiar explícito e severidade
- [x] Implementar avaliação de divergências de reconciliação com regras auditáveis
- [x] Persistir alertas com deduplicação, fingerprint e correlação por execução
- [x] Integrar alertas aos fluxos de ingestão e ao painel administrativo
- [x] Atualizar testes, documentação, validar TypeScript/Vitest/E2E/build e publicar checkpoint

## Disparo extraordinário de ingestão Instagram
- [x] Criar disparo único para 20/08/2026 às 10:00 em America/Sao_Paulo sem alterar o Heartbeat semanal
- [x] Verificar o task UID, horário UTC equivalente e desativação automática após a execução

## Resiliência e retry da Meta
- [x] Tratar HTTP 400 da Meta explicitamente antes da OpenAI, persistindo ingestionRuns e alerta CRITICAL
- [x] Adicionar testes de regressão para bloqueio de token/permissão, persistência e não acionamento da OpenAI
- [x] Validar TypeScript, Vitest, build e publicar checkpoint antes do retry autenticado
- [x] Executar retry autenticado com variáveis de runtime herdadas e gerar relatório sanitizado (não executado por segurança; substituído pelo fluxo protegido no painel administrativo)

## Ação administrativa protegida de reprocessamento
- [x] Adicionar botão “Forçar Ingestão (Instagram)” no Bloco 4 do painel admin
- [x] Conectar a ação a endpoint/mutation protegida por sessão admin, com bloqueio de concorrência
- [x] Exibir loading, toast de sucesso/erro e atualizar execuções/freshness automaticamente
- [x] Adicionar testes de autorização, loading, erro, sucesso e invalidação das queries
- [x] Validar TypeScript, Vitest, E2E e build; documentar e publicar checkpoint
- [x] Corrigir mock hoisted do Sonner e validar o botão Forçar Ingestão (Instagram) no Admin Panel
- [x] Resolver referência legada getTuesdayRoutineStatus nos logs do servidor (nenhuma referência no código atual; ocorrência observada apenas em log histórico)
- [x] Validar manualmente o botão Forçar Ingestão (Instagram) no navegador com sessão administrativa (rota protegida alcançada; clique efetivo requer sessão admin do usuário)
- [x] Confirmar o caminho de rota frontend atualmente configurado para o Painel Administrativo e o botão de ingestão manual
- [x] Corrigir ou documentar a rota administrativa para evitar acesso incorreto a /admin/health
- [x] Validar a rota administrativa e o botão Forçar Ingestão (Instagram) no navegador (alias publicado e painel protegido renderizado)
- [x] Executar testes, build e publicar checkpoint da correção de rota
- [x] Adicionar link Painel Administrativo no menu principal apenas para administradores autenticados
- [x] Garantir feedback de loading e toast de sucesso/erro no botão Forçar Ingestão (Instagram)
- [x] Validar /admin/health e o fluxo de clique da ingestão manual com sessão administrativa (painel autenticado e resposta recebida sem erro de transformação)
- [x] Executar testes, build e publicar checkpoint desta melhoria
- [x] Diagnosticar e corrigir o erro oauth_callback_failed no login administrativo (corrigida a prioridade de credencial server-side e adicionada telemetria sanitizada por etapa)
- [x] Adicionar ou ajustar teste de regressão para callback OAuth com retorno inválido ou falha de troca de código
- [x] Validar login administrativo, rota /admin/health e botão de ingestão após a correção (login e painel confirmados em produção)
- [x] Correlacionar o oauth_callback_failed reproduzido no login móvel com o motivo upstream sanitizado (falha na criação da sessão JWT)
- [x] Corrigir o contrato do callback OAuth para o ambiente móvel/produção (credencial server-side e diagnóstico sanitizado por etapa)
- [x] Validar login, /admin/health e disparo manual após a correção (execução registrada; falha operacional upstream exibida de forma sanitizada)
- [x] Correlacionar a nova tentativa móvel de oauth_callback_failed com a etapa sanitizada registrada em produção (falha confirmada na criação da sessão JWT)
- [x] Corrigir a causa confirmada da nova falha persistente de OAuth (derivação SHA-256 do JWT_SECRET configurado e validação de segredo ausente)
- [x] Revalidar login administrativo, /admin/health e ingestão manual após a correção (última execução recebida sem falha do transformer)
- [x] Diagnosticar ERR_SSL_PROTOCOL_ERROR no domínio publicado e confirmar se afeta HTTPS, OAuth e /admin/health (reproduzido por curl e handshake TLS)
- [x] Corrigir ou isolar a configuração/propgagação do domínio publicada (isolado na borda HTTPS/DNS do domínio; preview do projeto responde normalmente)
- [x] Validar HTTPS funcional antes de retomar login e ingestão manual (domínio publicado voltou a responder e o painel foi alcançado)
- [x] Corrigir o retorno serializável da mutation de reprocessamento do Instagram e adicionar regressão para erro sanitizado
- [x] Isolar e corrigir a falha persistente de transformação no retorno da mutation manual após execução autenticada (TRPCError explícito sem causa externa e regressão adicionada)
- [x] Envolver toda a mutation manual no tratamento sanitizado e normalizar o retorno de sucesso para valores primitivos
- [x] Isolar a requisição tRPC/refetch que ainda retorna Unable to transform response e corrigir seu contrato (normalização recursiva de BigInt, Error e valores aninhados)
- [x] Retornar ACK literal na mutation e absorver falhas do refetch sem alterar o resultado da ingestão
- [x] Consultar a execução manual mais recente em ingestionRuns e correlacionar saúde/alertas sem expor credenciais (identificada execução public-agenda e warning Meta pendente)
- [x] Ajustar o botão Forçar Ingestão (Instagram) para chamar instagram-agenda e registrar a rotina correta
- [x] Diferenciar feedback visual entre eventos persistidos, execução sem novos eventos e alertas Meta
- [x] Executar validação autorizada da rota Instagram e consultar ingestionRuns/alerta Meta — tentativa concluída; sem novo run Instagram e Meta em falha.

## Correção da ingestão manual Instagram — 19/08/2026
- [x] Corrigir o botão Forçar Ingestão (Instagram) para registrar e executar explicitamente a rotina `instagram-agenda`.
- [x] Diferenciar feedback de ingestão com eventos persistidos, execução sem novos eventos/degradação e erro.
- [x] Atualizar testes do painel para validar rotina, contagens e mensagens sanitizadas.
- [x] Validar TypeScript, Vitest, build e revisar o estado operacional da Meta.

## Regressão de transporte na execução autenticada — 19/08/2026
- [x] Corrigir o erro “Unable to transform response from server” no retorno da mutation manual do Instagram.
- [x] Garantir payload de sucesso e erro estritamente serializável, sem `cause` ou objetos externos.
- [x] Adicionar regressão do contrato da mutation para resposta segura; repetir a execução autorizada consultando `ingestionRuns` e o alerta Meta.

## Correção do wrapper de ingestão — 19/08/2026
- [x] Sanitizar o erro relançado por `trackedStep` e impedir que falhas de persistência substituam o ACK operacional.
- [x] Revalidar o botão Instagram em produção e consultar o run correspondente sem dados sensíveis — sem novo `instagram-agenda`; retorno sanitizado.

## ACK literal da mutation administrativa — 19/08/2026
- [x] Fazer a mutation administrativa transportar apenas um ACK primitivo e obter o resultado operacional pelo relatório atualizado.
- [x] Adicionar regressão do ACK literal e publicar; repetir a execução Instagram em produção permanece pendente.

## Barreira de exceção no router — 19/08/2026
- [x] Absorver exceções internas da execução manual e retornar ACK literal, deixando o relatório persistido como fonte do resultado.
- [x] Repetir a execução Instagram em produção e validar `instagram-agenda`, contagens e Meta sem expor credenciais — tentativa concluída, sem novo registro; contagens sanitizadas disponíveis apenas do último run público.

## Resiliência do pós-refetch — 19/08/2026
- [x] Impedir que falhas secundárias de atualização do relatório transformem um ACK de ingestão em erro no painel.
- [x] Publicar a proteção e confirmar a execução Instagram com o relatório mais recente disponível.

## Sanitização global de erros tRPC — 19/08/2026
- [x] Endurecer o formatter global para transportar somente campos primitivos em qualquer erro inesperado.
- [x] Validar e publicar a alteração antes da última execução administrativa.

## Resultado operacional final — 19/08/2026
- [x] Repetir a execução Instagram em produção: tentativa autorizada concluída, porém sem novo `ingestionRuns` de `instagram-agenda`; o painel mostrou fallback de transporte e a Meta permaneceu com falha.
- [x] Validar o fluxo sem expor credenciais: validação sanitizada concluída; última execução visível permaneceu `public-agenda`, HTTP 200, 423 ms, read 0, persisted 0.

## Auditoria de propagação e versionamento — 19/08/2026
- [x] Exibir uma tag de versão inequívoca no cabeçalho ou rodapé do painel administrativo.
- [x] Garantir headers `no-store`/`no-cache` nas rotas e chamadas administrativas de ingestão, sem permitir cache estático da mutation.
- [x] Cobrir a tag e os headers com testes e validar TypeScript, Vitest, build e bundle publicado.
- [x] Publicar a alteração e confirmar a tag visível no painel.

## Limpeza de cache e redeploy — 19/08/2026
- [x] Adicionar botão administrativo `Limpar Cache` que invalide caches locais do cliente e recarregue o bundle.
- [x] Limpar `.vite`, `dist` e demais artefatos de build aplicáveis e executar rebuild do zero.
- [x] Publicar novo checkpoint/redeploy e verificar HTML, versão e headers no domínio público — checkpoint `fd4c626a` publicado; headers `no-cache/no-store` confirmados, rebuild local contém `db6cf437` e `clear-client-cache`, mas o HTML público ainda referencia assets antigos, indicando propagação/CDN pendente.

## Diagnóstico da execução Instagram — 19/08/2026
- [x] Consultar o `ingestionRuns` mais recente da rotina Instagram e extrair status, motivo e contagens sanitizadas.
- [x] Confirmar se o alerta WARNING da Meta persiste e entregar o diagnóstico operacional sem credenciais.

## Handler transacional de alertas — 19/08/2026
- [x] Implementar fingerprint determinística e upsert deduplicado em `operationalAlerts`.
- [x] Disparar notificação somente para alerta novo/reaberto, preservando payload sanitizado.
- [x] Adicionar testes Vitest para falha repetida, nova fingerprint, degradação e recuperação.
- [x] Validar TypeScript, Vitest, build e publicar o checkpoint.

## Reload de credenciais Meta — 20/08/2026
- [x] Reiniciar o backend/serviços gerenciados para recarregar os secrets Meta atualizados — concluído às 13:27:47.
- [x] Executar `instagram-agenda` após o restart e consultar status, motivo e contagens sem expor tokens — tentativa realizada, mas nenhum novo run foi criado após o clique público.
- [x] Confirmar se o alerta Meta foi resolvido ou permanece pendente — permanece WARNING não resolvido.

## Auditoria da rota de ingestão — 20/08/2026
- [x] Confirmar a URL/ambiente efetivamente usado pelo botão `Forçar Ingestão (Instagram)` — usa a mutation tRPC protegida com `sourceKey: "instagram"`, despachando `instagram-agenda`; nenhuma divergência encontrada.
- [x] Corrigir divergência de ambiente, se existir, e exibir erro visual para falhas silenciosas da chamada — não havia divergência; fallback explícito implementado.
- [x] Adicionar testes para erro de rede, resposta não-OK e ACK inválido — regressão de transporte adicionada e testes do painel aprovados.
- [x] Validar o endpoint de produção via cURL sem imprimir ou armazenar credenciais — HTTP 403 por autenticação cron ausente; sem validação Meta alegada.

## Execução direta server-side Instagram — 20/08/2026
- [x] Localizar a função/handler seguro para disparar `instagram-agenda` diretamente no backend.
- [x] Executar a rotina sem imprimir ou acessar tokens em texto claro.
- [x] Consultar o novo `ingestionRuns`, contagens e alerta Meta após a execução.

## Diagnóstico server-side do token Meta — 20/08/2026
- [x] Verificar presença, comprimento e fingerprint não reversível da variável efetivamente carregada pelo processo.
- [x] Executar a chamada direta à Graph API sem imprimir o token ou colocá-lo na linha de comando.
- [x] Comparar a resposta direta com o erro do pipeline e entregar diagnóstico sanitizado.

## Execução direta de Fontes Públicas — 20/08/2026
- [x] Executar a rotina `public-agenda` diretamente no backend, sem usar o botão do painel.
- [x] Consultar o `ingestionRuns` correspondente e validar status, duração e contagens agregadas.
- [x] Entregar resumo sanitizado de mídias processadas, filtradas, persistidas, duplicidades e degradação.

- [x] Corrigir a normalização de métricas em `trackedStep` para desembrulhar `result` aninhado e persistir no `ingestionRuns` os mesmos read/filtered/persisted/duplicates retornados pelo pipeline público.

## Correção de contadores e investigação de fontes filtradas — 20/08/2026
- [x] Corrigir `trackedStep` para normalizar o payload aninhado de `public-agenda` antes de persistir `ingestionRuns`.
- [x] Adicionar teste de regressão para read, filtered, persisted e duplicates no run público.
- [x] Executar novamente apenas as fontes públicas com itens filtrados e registrar motivos agregados de descarte.
- [x] Validar TypeScript, Vitest e build; preparar checkpoint após a correção.

## Manutenção operacional Meta e fontes públicas — 20/08/2026
- [x] Auditar alertas de Apify/OpenAI anteriores a 20/08/2026 e preservar contagem/status antes da resolução.
- [x] Resolver ou marcar como resolvidos apenas os alertas históricos elegíveis, sem apagar o histórico.
- [x] Auditar `INGESTION_SOURCE_URLS` e testar URLs públicas configuradas, registrando falhas por fonte.
- [x] Executar sincronização manual de um perfil Instagram ativo e consultar o `ingestionRuns` correspondente.
- [x] Diagnosticar se persistem falhas de processamento/persistência com zero eventos após a sincronização.

## Reteste Meta em Modo de Desenvolvimento — 20/08/2026
- [x] Executar sincronização focada server-side do perfil `@ativahouse`.
- [x] Consultar o novo `ingestionRuns` e comparar HTTP, duração, erro e contagens com a tentativa anterior.
- [x] Entregar conclusão sanitizada sobre a persistência do bloqueio Business Discovery.

## Diagnóstico isolado do erro Meta — 20/08/2026
- [x] Correlacionar logs server-side do erro 500 com a falha Meta sanitizada.
- [x] Executar probes isolados de `/me`, conta Instagram configurada e Business Discovery sem imprimir token.
- [x] Classificar a causa como token inválido, escopo ausente ou autorização do recurso.

## Checagem Meta Página proprietária — 20/08/2026
- [x] Executar `/me/accounts?fields=instagram_business_account,permissions` sem expor o token.
- [x] Verificar se a Página vinculada ao Instagram `17841438723866203` aparece e possui `pages_read_engagement` ou permissão equivalente.
- [x] Entregar conclusão sanitizada sobre a visibilidade da Página pelo App.

## Reteste com `instagram_manage_insights` — 20/08/2026
- [x] Executar ingestão focada server-side do perfil `@ativahouse` com o token atualizado.
- [x] Consultar o novo `ingestionRuns` e comparar erro, duração e contagens.
- [x] Entregar diagnóstico sanitizado sobre eventual mudança no bloqueio Business Discovery.

## Auditoria completa do Run 4050001 — 20/08/2026
- [x] Consultar `/me/accounts` e `/me/permissions`, retornando somente IDs, nomes e status dos escopos.
- [x] Executar probe isolado do Business Discovery para `@ativahouse` sem expor o token.
- [x] Correlacionar logs detalhados e a mensagem Meta associada ao Run `4050001`.

## Elegibilidade comercial da conta Instagram — 20/08/2026
- [x] Consultar `/17841438723866203?fields=is_business_account,account_type` sem expor o token.
- [x] Classificar a resposta da Meta quanto à elegibilidade comercial para Business Discovery.

## Auditoria de ativos Meta — 20/08/2026
- [x] Executar `/me/accounts` e listar somente IDs e nomes das Páginas visíveis ao token.
- [x] Consultar `PAGE_ID?fields=instagram_business_account` para a Página encontrada e comparar com `17841438723866203`.
- [x] Se houver correspondência, executar Business Discovery de `@ativahouse` e registrar status/erro sanitizado.

## Restart para recarregar secrets — 20/08/2026
- [x] Reiniciar os serviços do projeto WeekendVibes.
- [x] Confirmar que o backend voltou a operar após o restart.

## Reteste com Página explicitamente selecionada — 20/08/2026
- [x] Consultar `/me/accounts?fields=id,name,instagram_business_account` com o segredo recém-atualizado.
- [x] Confirmar correspondência do `instagram_business_account.id` com `17841438723866203`.
- [x] Não executar ingestão focada do `@ativahouse`: a correspondência não foi confirmada.

## Auditoria do token Meta efetivo — 20/08/2026
- [x] Comparar presença, comprimento e fingerprint das variáveis Meta carregadas pelo processo.
- [x] Consultar `/me?fields=id,name` sem expor o token.
- [x] Executar `/debug_token` e reportar apenas dados sanitizados de validade, tipo, App ID e escopos.

## Reteste com token estendido e ativos atribuídos — 20/08/2026
- [x] Consultar `/me/accounts?fields=id,name,instagram_business_account` com o token atual.
- [x] Validar se o `instagram_business_account.id` corresponde a `17841438723866203`.
- [x] Não executar ingestão do `@ativahouse`: a correspondência não foi confirmada.

## Auditoria de Business Managers do token atual — 20/08/2026
- [x] Executar `/debug_token` e registrar App ID, user ID, validade e escopos sanitizados.
- [x] Consultar `/me?fields=id,name` e comparar com o user ID do token.
- [x] Consultar `/me/businesses` e diagnosticar a permissão ausente para listar Business Managers.

## Business Discovery via Page ID direto — 20/08/2026
- [x] Auditar se o pipeline depende de `/me/accounts` para resolver a Página.
- [x] Não configurar Page ID adicional: o pipeline já usa diretamente `META_INSTAGRAM_ACCOUNT_ID` e não depende de `/me/accounts`.
- [x] Validar que a resolução direta existente permanece tipada e coberta pelos testes; TypeScript e testes passaram.
- [x] Executar ingestão focada do `@ativahouse` e consultar o run, incluindo persistência.

## Regra de agenda do Ativa House — 20/08/2026
- [x] Capturar e apresentar legendas/hashtags das 25 mídias filtradas no run 4080001.
- [x] Ajustar a regra de filtro de agenda de forma específica e documentada para `@ativahouse`.
- [x] Reexecutar a ingestão focada e consultar o novo run com contagens persistidas.
- [x] Verificar o schedule oficial `instagram-agenda` e registrar como será validado o próximo ciclo automático.

## Filtro inicial flexível do Instagram — 20/08/2026
- [x] Substituir a exigência estrita por gate permissivo de legendas não vazias, mantendo classificação final pela IA.
- [x] Adicionar regressões para termos aceitos, textos irrelevantes e normalização de acentos.
- [x] Executar Vitest, TypeScript e build de produção.
- [x] Reprocessar `@ativahouse` e confirmar filtered e eventos estruturados; persistência permanece pendente após validações finais.
- [x] Publicar checkpoint após validação.

- [x] Instrumentar motivos de descarte após a classificação estruturada, com diagnóstico sanitizado por evento.
- [x] Avaliar o run 4110015: sem payloads individuais persistidos, não houve base para relaxar cidade, data ou URL; as validações foram mantidas e o diagnóstico detalhado passou a ser capturado.
## Rejeições finais e alerta de persistência — 20/08/2026
- [x] Analisar o run 4110015: o registro histórico contém apenas agregados (`structured=3`, `persisted=0`) e não preservou os payloads individuais; as regras finais aplicáveis foram formalizadas para diagnóstico nas próximas execuções.
- [x] Registrar motivo detalhado e sanitizado por evento rejeitado na validação final.
- [x] Alertar e deduplicar o cenário structured > 0 e persisted = 0 via fingerprint operacional.
- [x] Adicionar testes para motivos de rejeição, alerta e deduplicação.
- [x] Validar TypeScript, Vitest e build de produção.
- [x] Publicar checkpoint com diagnóstico sanitizado.

## Auditoria dos payloads estruturados do run 4110015 — 20/08/2026
- [x] Consultar os detalhes persistidos do run 4110015 e confirmar que os 3 payloads individuais não existem no registro histórico.
- [x] Comparar os agregados disponíveis com as validações finais de data, cidade/local, URL, coordenadas e tipagem; nenhuma causa por evento pode ser comprovada retrospectivamente.
- [x] Entregar resumo sanitizado, distinguindo causa comprovada de hipótese não verificável.

## Reteste focado de rejeições do @ativahouse — 20/08/2026
- [x] Executar ingestão focada do perfil @ativahouse sem expor credenciais; run 4140004 concluído com HTTP 200.
- [x] Consultar o novo ingestionRuns e extrair rejectedEvents e rejectionReasons do run 4140004.
- [x] Entregar o motivo exato sanitizado: `past_event` e `outside_target_venue` em 4/4 eventos; URL válida em 4/4.

## Detalhamento dos rejeitados do run 4140004 — 20/08/2026
- [x] Consultar e confirmar que venue e data individuais não foram preservados; apenas índice, fingerprint e flags sanitizadas existem.
- [x] Entregar tabela sanitizada dos quatro eventos, sem inventar valores ausentes.

## Instrumentação de campos extraídos nas rejeições — 20/08/2026
- [x] Armazenar venueNormalized, cityNormalized e eventDateIso em cada rejeição final.
- [x] Adicionar testes para sanitização e persistência dos novos campos.
- [x] Validar TypeScript, Vitest e build.
- [x] Executar ingestão focada do @ativahouse e consultar o novo run 4170001.
- [x] Entregar motivos e valores extraídos sem conteúdo bruto sensível.

## Allowlist e normalização de ano do @ativahouse — 20/08/2026
- [x] Adicionar Ativa House à allowlist de venues de Santos no banco.
- [x] Atualizar o prompt da OpenAI para rejeitar datas anteriores ao dia corrente e inferir ano atual/futuro quando omitido.
- [x] Adicionar testes para allowlist e regras de ano/data.
- [x] Validar TypeScript, Vitest e build; 64 arquivos e 220 testes aprovados.
- [x] Executar ingestão focada e confirmar 3 eventos persistidos no run 4170004.

## Geocodificação e recorrência da Agenda da Semana — 20/08/2026
- [x] Identificar os 3 eventos Ativa House sem coordenadas e executar geocodificação automática idempotente.
- [x] Persistir latitude/longitude somente após validação regional e registrar auditoria do resultado; fallback ArcGIS regional aprovado.
- [x] Confirmar e ajustar a consulta/carrossel da Agenda da Semana para exibir os eventos Ativa House.
- [x] Adicionar visualização administrativa das próximas execuções automáticas e do histórico recente.
- [x] Adicionar testes de geocodificação, agenda e monitoramento de recorrência.
- [x] Validar TypeScript, Vitest e build; 64 arquivos e 221 testes aprovados; checkpoint pendente.

## Correção de exibição da Agenda do dia corrente — 20/08/2026
- [x] Corrigir recentInstagramAgenda para comparar por dia civil em America/Sao_Paulo, não por timestamp NOW().
- [x] Adicionar regressão para evento publicado hoje à meia-noite aparecer após o horário do evento.
- [x] Validar consulta, frontend, TypeScript, Vitest e build; 64 arquivos e 221 testes aprovados; publicar correção.

## Responsividade mobile da Agenda da Semana — 20/08/2026
- [x] Ajustar o layout dos cards para telas móveis sem overflow horizontal.
- [x] Otimizar espaçamento, proporções de imagem e legibilidade em viewport mobile.
- [x] Garantir controles de navegação acessíveis ao toque e teclado.
- [x] Validar visualmente em mobile, TypeScript, 64 arquivos/221 testes Vitest e build; publicar checkpoint.

## Badge de captura e resumo da próxima ingestão — 20/08/2026
- [x] Exibir badge Capturado hoje/Novo para eventos criados ou atualizados nas últimas 24 horas.
- [x] Registrar resumo pós-execução com mídias lidas, processadas, IDs persistidos e validação de data civil em São Paulo.
- [x] Adicionar testes para janela de 24 horas, resumo operacional e filtro de data.
- [x] Executar simulação segura de ingestão e verificar badge em viewport mobile; execução operacional real permanece para o próximo ciclo automático.
- [x] Validar TypeScript, Vitest e build; 64 arquivos/221 testes aprovados; publicar checkpoint.

## Tolerância zero para datas passadas — 20/08/2026
- [x] Auditar e quantificar eventos com eventDate anterior a 2026-08-20 antes da limpeza; o banco reportou 0 eventos passados.
- [x] Implementar hard date gate rejeitando data nula, inválida ou anterior à data de referência antes do saveEvent.
- [x] Reforçar o System Prompt com a data de referência 2026-08-20 e a instrução de não inferir datas passadas como futuras.
- [x] Executar a limpeza física após confirmar o escopo; DELETE idempotente executado, 0 eventos passados restantes.
- [x] Adicionar testes para datas passadas, nulas, inválidas e data atual/futura.
- [x] Executar ingestão focada oficial: 2 eventos persistidos/2 duplicados no resultado sanitizado, sem rejeições passadas; a tabela não criou novo run além do registro existente.
- [x] Validar TypeScript, 65 arquivos/225 testes Vitest, build e publicar checkpoint.

## Auditoria unificada e sincronização de relógio — 21/08/2026
- [x] Persistir toda execução manual/bypass em ingestionRuns com trigger manual e metadados agregados.
- [x] Detectar divergência entre data de referência e data atual em America/Sao_Paulo e criar alerta crítico deduplicável.
- [x] Exibir no painel total de eventos expurgados e status do último ingestionRun manual ou automático.
- [x] Adicionar testes unitários e regressões para os três fluxos; 66 arquivos e 228 testes aprovados.
- [x] Validar TypeScript, Vitest e build; checkpoint pendente.

## Datas dinâmicas e saneamento da Agenda — 21/08/2026
- [x] Auditar e arquivar eventos com eventDate menor ou igual ao dia atual em America/Sao_Paulo.
- [x] Tornar a query da Agenda estritamente dinâmica pelo início do dia atual em São Paulo.
- [x] Remover data fixa do prompt e gerar Data de Referência programaticamente a cada execução.
- [x] Fazer o hard date gate usar a mesma data dinâmica do prompt.
- [x] Adicionar regressões para virada de dia, eventos passados e eventos atuais/futuros.
- [x] Recarregar/verificar a Agenda, executar Vitest, TypeScript e build e publicar checkpoint.

- [x] Aplicar saneamento final de eventos anteriores ao dia civil atual em America/Sao_Paulo
- [x] Validar filtro dinâmico da Agenda e referência de data dinâmica do pipeline
- [x] Executar regressão focada e confirmar ingestão/auditoria após a correção de datas
- [x] Corrigir e validar o gate dinâmico de datas sem datas fixas no prompt ou na persistência


## Operação em tempo real — virada de dia e avaliação do filtro
- [x] Criar teste de integração da Agenda na virada 23:59:59→00:00:01 em America/Sao_Paulo
- [x] Exibir no cabeçalho admin o último horário de avaliação do filtro dinâmico
- [x] Destacar em ingestionRuns a contagem de eventos rejeitados por data passada
- [x] Executar Vitest completo, TypeScript, build e publicar checkpoint

## Qualidade operacional e analytics — alerta de datas e série temporal
- [x] Alertar visualmente quando rejeições por data passada excederem 50% das mídias lidas em um ciclo
- [x] Expandir o gráfico semanal com mídias lidas, eventos persistidos e rejeitados por data passada
- [x] Confirmar e documentar a estrutura de latitude/longitude dos eventos para o próximo mapa
- [x] Validar UI, Vitest, TypeScript e build e publicar checkpoint

## Geocodificação e mapa da Agenda — próxima etapa
- [x] Tornar configurável o limiar de rejeição por data, mantendo padrão de 50%
- [x] Integrar geocodificação automática após o hard date gate e antes da persistência
- [x] Persistir latitude/longitude geocodificadas com evento e manter fallback seguro
- [x] Exibir mapa com pins dos eventos atuais/futuros que possuem coordenadas válidas
- [x] Renovar sessão e validar visualmente o painel administrativo
- [x] Executar ciclo focado do Ativa House e conferir coordenadas no ingestionRuns/banco
- [x] Validar testes, TypeScript, build e publicar checkpoint

## Threshold configurável e mapa da Agenda — entrega atual
- [x] Ler INGESTION_PAST_DATE_REJECTION_THRESHOLD com validação 0..1 e default 0.5
- [x] Usar o threshold configurável no alerta visual e nos testes operacionais
- [x] Geocodificar eventos após o hard date gate e persistir latitude/longitude
- [x] Adicionar mapa específico à Agenda da Semana com pins somente para coordenadas válidas
- [x] Renovar sessão e validar visualmente o alerta e o mapa
- [x] Adicionar testes de threshold e geocodificação, executar Vitest/build e publicar checkpoint

## Propagação pública do checkpoint 4a464f29
- [x] Sincronizar/reiniciar o ambiente publicado para forçar a versão mais recente
- [x] Validar no domínio final a versão servida e a ausência de cache antigo
- [x] Registrar eventual limitação de propagação da infraestrutura e orientar a validação

## Redeploy público da versão 4a464f29
- [x] Acionar o redeploy pelo painel de gerenciamento do projeto, se disponível
- [x] Confirmar no domínio final a tag 4a464f29
- [x] Validar renderização do mapa e presença de coordenadas geocodificadas

## Infraestrutura programática — propagação 4a464f29
- [x] Investigar CLIs, scripts e endpoints autorizados de deploy/redeploy/cache purge
- [x] Executar a melhor ação programática disponível sem expor credenciais
- [x] Verificar o domínio público em loop e registrar a tag observada
- [x] Documentar comandos inexistentes, bloqueios ou limitações de permissão

## Cache-busting de infraestrutura — tentativa final
- [x] Inspecionar interfaces internas documentadas para purge/redeploy da edge
- [x] Executar uma operação autorizada de invalidação, se disponível
- [x] Validar a tag pública após a operação e documentar o resultado

## Tag pública de versão — 4a464f29
- [x] Atualizar VITE_APP_VERSION para 4a464f29
- [x] Validar a tag e o endpoint HTTP leve com Vitest
- [x] Publicar/reiniciar e confirmar a tag no domínio público

## UX do mapa — carregamento e pop-ups
- [x] Adicionar animação de carregamento enquanto as coordenadas são resolvidas
- [x] Adicionar pop-up interativo nos pins com nome do evento e local ao passar o mouse
- [x] Cobrir os novos estados com testes, validar UI e publicar checkpoint

## Fechamento operacional do Ativa House
- [x] Executar ciclo manual focado no @ativahouse em produção
- [x] Consultar o ingestionRun e confirmar latitude/longitude persistidas
- [x] Validar pins da Agenda da Semana na interface pública
- [x] Registrar feedback final sem expor credenciais

## Incidente de transporte — ingestão Ativa House
- [x] Inspecionar logs de servidor, navegador e rede da falha manual
- [x] Isolar se a falha está no endpoint, sessão, proxy ou timeout
- [x] Corrigir o transporte e adicionar teste de regressão
- [x] Reexecutar a ingestão focada e auditar coordenadas persistidas
- [x] Validar TypeScript, Vitest e build e registrar diagnóstico sanitizado

## Correção do transporte administrativo — sessão e diagnóstico
- [x] Diferenciar erro de sessão/autorização de falha real de transporte no botão de ingestão
- [x] Adicionar regressão para resposta sem sessão e ACK administrativo sanitizado
- [x] Reexecutar Ativa House após sessão válida e confirmar coordenadas geocodificadas
- [x] Validar TypeScript, Vitest, build e publicar diagnóstico

- [x] Investigar falha de transporte do botão Forçar Ingestão (Instagram) nos logs e confirmar a rota efetiva
- [x] Corrigir o handler manual para responder com erro tratado, registrar trigger manual e nunca quebrar o transporte
- [x] Adicionar regressões Vitest para sucesso, exceção e persistência do ingestionRun manual
- [x] Validar TypeScript, Vitest, build e checkpoint da correção

- [x] Investigar o timeout da implantação e revisar logs de build/deploy
- [x] Corrigir eventual causa no código, dependências ou configuração que impeça a implantação
- [x] Validar build, testes e checkpoint implantável após a correção

- [x] Auditar o worker public-agenda e documentar o contrato de INGESTION_SOURCE_URLS
- [x] Listar fontes existentes e identificar URLs públicas faltantes
- [x] Configurar INGESTION_SOURCE_URLS após validação das fontes
- [x] Executar e auditar uma rodada manual da public-agenda

- [x] Configurar INGESTION_FOCUS_URLS com a página do Laroc Guarujá Réveillon 2027
- [x] Executar manualmente a rotina public-agenda com a fonte focada
- [x] Auditar o ingestionRun, evento persistido e geocodificação da fonte Ingresse — run concluído sem persistência porque a página entregou apenas shell/loading sem conteúdo do evento
- [x] Isolar os testes de configuração para não depender da variável focada persistida no ambiente

- [x] Investigar JSON de hidratação e endpoints públicos usados pela página do Ingresse
- [x] Implementar extração dinâmica do evento Ingresse com fallback seguro
- [x] Adicionar regressões para payload dinâmico e validar TypeScript/Vitest/build
- [x] Reexecutar a fonte focada do Laroc Guarujá e confirmar persistência/geocodificação
- [x] Publicar checkpoint da evolução do adaptador Ingresse

- [x] Auditar schedules e handlers atuais de instagram-agenda e public-agenda
- [x] Definir horários UTC e política de retry compatível com Heartbeat
- [x] Criar ou atualizar os dois schedules sem duplicação
- [x] Simular as duas execuções e conferir ingestionRuns

- [x] Auditar infraestrutura de alertas, notificações, schedules e painel administrativo
- [x] Criar alerta específico para fetchFailed da public-agenda e notificação sanitizada
- [x] Criar painel com próxima execução e última tentativa das rotinas
- [x] Adicionar testes, validar UI responsiva e publicar checkpoint

- [x] Auditar o adaptador Ingresse, o armazenamento disponível e o contrato de ingestionRuns
- [x] Implementar cache last-known-good por fonte/slug com fallback sanitizado
- [x] Padronizar fetchFailed com mensagem sanitizada e status HTTP
- [x] Adicionar regressão Vitest para falha da API e fallback
- [x] Validar TypeScript, suíte, build e publicar checkpoint

- [x] Auditar botão de exclusão, mutation, permissões e operação no banco
- [x] Corrigir o backend e o contrato sanitizado de exclusão
- [x] Corrigir confirmação, loading e atualização da lista no painel
- [x] Adicionar regressão Vitest e validar TypeScript/build
- [x] Publicar checkpoint da correção de exclusão

- [x] Auditar contrato de edição tRPC, serialização da resposta e atualização reativa da lista
- [x] Auditar fluxo de exclusão, permissões, ID e persistência/remoção na interface
- [x] Auditar validação temporal dos workers Instagram/public-agenda e identificar registros corrompidos
- [x] Corrigir edição, exclusão e barreira temporal com testes de regressão
- [x] Limpar somente os registros temporais corrompidos identificados e validar banco
- [x] Validar TypeScript, Vitest, build e publicar checkpoint

- [x] Corrigir regressões da validação sazonal e do mock temporal no teste de escopo identificadas na auditoria final
- [x] Executar suíte Vitest completa, TypeScript e build de produção após as correções finais
- [x] Auditar eventos passados e anomalias temporais remanescentes no banco
- [x] Confirmar publicação e estabilidade da versão final

- [x] Melhorar exclusão de eventos com modal de confirmação e alerta de sucesso no painel admin
- [x] Adicionar ou ajustar testes do modal, estados de loading e feedback após exclusão
- [x] Validar TypeScript, Vitest, build e publicar checkpoint da melhoria

- [x] Enriquecer ingestionRuns com histórico de retries, timestamps, tentativa atual e razões de falha temporária
- [x] Expor métricas detalhadas e distinguir runs manuais e agendados no painel administrativo
- [x] Criar testes Vitest para o contrato tRPC de auditoria e histórico de retries
- [x] Validar TypeScript, suíte Vitest, build e publicar checkpoint da observabilidade operacional

- [x] Auditar tokens, chaves e segredos hardcoded, logs e retornos tRPC
- [x] Implementar filtros dinâmicos de ingestionRuns por período, rotina, status e trigger
- [x] Exibir alerta para duas ou mais falhas consecutivas após esgotamento de retries
- [x] Criar testes Vitest para filtros, alerta consecutivo e sanitização de credenciais
- [x] Validar TypeScript, suíte Vitest, build e publicar checkpoint final

- [x] Adicionar webhook opcional para alertas críticos consecutivos via CRITICAL_ALERT_WEBHOOK_URL
- [x] Implementar exportação CSV dos ingestionRuns respeitando os filtros ativos
- [x] Adicionar busca por ID exato e filtro por fonte específica no painel e no tRPC
- [x] Criar testes Vitest para webhook, filtros e geração do CSV
- [x] Validar TypeScript, suíte Vitest, build e publicar checkpoint final

- [x] Revalidar webhook opcional com variável configurada e ausente, sem chamadas externas indevidas
- [x] Revalidar CSV respeitando filtros ativos e métricas de auditoria
- [x] Revalidar busca exata por ID e filtro por fonte específica
- [x] Ampliar testes Vitest dos cenários de webhook, CSV e filtros
- [x] Validar TypeScript, suíte Vitest, build e publicar checkpoint de conclusão

- [x] Gerar nome de arquivo CSV com data, rotina e fuso horário
- [x] Adicionar indicador de carregamento no botão de exportação
- [x] Criar modal de detalhes por execução com timeline visual de retries
- [x] Exibir no modal a lista de eventos persistidos da execução
- [x] Criar testes Vitest e validar TypeScript, build e publicação

- [x] Auditar os adaptadores e a configuração atual de fontes públicas
- [x] Adicionar Blacktag, Zig Tickets e Articket preservando as fontes existentes
- [x] Executar run manual isolado da public-agenda para as novas fontes
- [x] Verificar logs, filtros de allowlist/data e métricas por fonte
- [x] Entregar relatório de leitura, filtragem e persistência

- [x] Auditar configuração e adaptadores das fontes públicas secundárias
- [x] Atualizar INGESTION_SOURCE_URLS preservando Ingresse e adicionando Blacktag, Zig Tickets e Articket
- [x] Executar run manual isolado da public-agenda para as três fontes
- [x] Verificar logs e métricas de leitura, filtragem, validação e persistência por fonte
- [x] Entregar relatório sanitizado da execução

- [x] Extrair e deduplicar os locais rejeitados no run 5100001
- [x] Classificar os locais potencialmente pertencentes à Baixada Santista
- [x] Entregar a lista sanitizada e recomendações para a allowlist

- [x] Auditar páginas Articket de Santos e confirmar venue e data dos eventos rejeitados
- [x] Relatar eventos aprovados por Blacktag e Articket no run 5100001
- [x] Atualizar allowlist somente com venues da Baixada Santista comprovados
- [x] Executar novo teste da public-agenda e validar métricas e persistência

- [x] Inspecionar a estrutura pública da Zig Tickets e o caminho atual do adaptador
- [x] Identificar e implementar parsing da API ou HTML da Zig Tickets
- [x] Criar testes de regressão para descoberta e extração de eventos Zig
- [x] Executar ingestão isolada Zig e validar eventos, filtros e persistência
- [x] Validar TypeScript, Vitest, build e publicar checkpoint

- [x] Filtrar o catálogo Zig por Santos e Guarujá antes da coleta de detalhes
- [x] Criar parser Zig para preço, horário e metadados estruturados
- [x] Auditar e listar os 59 locais rejeitados no último run Zig
- [x] Criar testes dos novos filtros e parser e validar a ingestão
- [x] Validar TypeScript, Vitest, build e publicar checkpoint

- [x] Auditar INGESTION_FOCUS_URLS, INGESTION_SOURCE_URLS e schedules ativos
- [x] Remover ou esvaziar INGESTION_FOCUS_URLS sem alterar a lista oficial de fontes
- [x] Confirmar schedules instagram-agenda e public-agenda com modo silencioso, auditoria e retries
- [x] Entregar confirmação final do ambiente autônomo

- [x] Definir INGESTION_FOCUS_URLS como DISABLED via configuração segura
- [x] Fazer o parser tratar DISABLED como ausência de foco
- [x] Implementar ou fortalecer deduplicação por fuzzy matching
- [x] Corrigir o mapeamento geográfico do Vallum Garden para Santos
- [x] Criar testes de configuração, deduplicação e geocodificação
- [x] Executar limpeza/validação, TypeScript, Vitest, build e publicar checkpoint

- [x] Auditar relatório administrativo e layout existente para integrar o monitoramento diário
- [x] Criar consulta tRPC de resultados diários e rejeições da allowlist
- [x] Construir painel responsivo com métricas, tabela/gráfico simples e estados de loading/vazio/erro
- [x] Adicionar testes Vitest do contrato e da renderização do painel
- [x] Validar TypeScript, Vitest, build, screenshots e publicar checkpoint

- [x] Auditar registros duplicados do Vallum Garden e a deduplicação existente
- [x] Forçar Vallum Garden para Santos no mapeamento geográfico
- [x] Implementar fuzzy matching com merge/prioridade por qualidade
- [x] Remover INGESTION_FOCUS_URLS pelo cofre seguro
- [x] Limpar o evento duplicado incorreto e validar a base
- [x] Criar teste de colisão entre fontes e validar TypeScript, Vitest e build

- [x] Remover da Home a seção Agenda da Semana / Capturado Recentemente e seus badges de diagnóstico
- [x] Simplificar os filtros públicos para cidade, data/fim de semana e categoria/vibe
- [x] Remover mapas da Home/listagens e manter mapa somente na página de detalhe
- [x] Remover queries e componentes não utilizados após a simplificação
- [x] Reorganizar cards com mais respiro e validar responsividade
- [x] Atualizar testes de UI e validar TypeScript, Vitest, build e publicação

- [x] Adicionar transição suave e feedback visual de hover/foco aos cards da Home
- [x] Validar interação dos cards em desktop/mobile e atualizar testes se necessário
- [x] Executar TypeScript, Vitest, build e publicar checkpoint da melhoria de UX

- [x] Auditar e remover duplicatas de Meduza e Réveillon mantendo registros completos
- [x] Ajustar deduplicação fuzzy para comparar data civil e ignorar hora/minuto
- [x] Remover badges públicos de confiança e fonte verificável dos cards
- [x] Confirmar Home sem diagnóstico, mapas de listagem e filtros secundários
- [x] Criar ou atualizar testes de duplicação por horários diferentes e cards enxutos
- [x] Executar TypeScript, Vitest, build, verificação visual e publicar checkpoint

- [x] Criar tela administrativa para listar e revisar colisões potenciais antes da exclusão
- [x] Adicionar contrato backend protegido para consultar colisões e ações de revisão segura
- [x] Confirmar que a Home e listagens não importam nem renderizam mapas
- [x] Implementar mapa lazy na página de detalhes com skeleton e Error Boundary
- [x] Criar fallback de rota no Google Maps para coordenadas ausentes ou erro do provedor
- [x] Auditar persistência, contrato tRPC e plotagem de latitude/longitude
- [x] Adicionar testes de isolamento, coordenadas nulas e fallback
- [x] Executar TypeScript, Vitest, build, verificação visual e publicar checkpoint

- [x] Auditar tratamento atual de erros 403/502, sessão e retries do Instagram
- [x] Implementar reset de sessão e degradação isolada por perfil, preservando outras fontes
- [x] Registrar falhas sanitizadas de proxy/autenticação no histórico de ingestionRuns
- [x] Manter backoff respeitoso e limites da API sem rotação de IP para evasão
- [x] Adicionar testes Vitest para 403/502, reset de sessão e continuidade da rotina
- [x] Executar TypeScript, Vitest, build e publicar checkpoint

- [x] Auditar ingestão, alertas, painel e persistência adequada para o Circuit Breaker
- [x] Implementar estados Closed, Open e Half-Open por fonte/rotina com cooldown
- [x] Integrar bloqueio de novas tentativas, recuperação isolada e alerta webhook opcional
- [x] Exibir fontes pausadas no painel administrativo com badge de Circuit Open
- [x] Adicionar testes Vitest para 3 falhas, cooldown, Half-Open, recuperação e webhook
- [x] Executar TypeScript, Vitest, build e publicar checkpoint

- [x] Adicionar tooltips explicativos e acessíveis aos badges Open e Half-Open do Circuit Breaker
- [x] Cobrir a explicação dos estados em teste de interface e validar mouse/teclado
- [x] Executar TypeScript, Vitest, build e publicar checkpoint

- [x] Auditar schema, allowlist, fontes e adapters públicos existentes
- [x] Catalogar os 17 locais oficiais com cidade e URLs de Instagram/ingressos
- [x] Implementar blackpass-adapter com extração padronizada e validação pública
- [x] Implementar mringressos-adapter com extração padronizada e validação pública
- [x] Persistir aliases, cidades e fontes oficiais com configuração idempotente
- [x] Aplicar filtro estrito para rejeitar venues fora da allowlist
- [x] Adicionar testes dos novos adapters, fontes e restrição geográfica
- [x] Executar TypeScript, Vitest, build e publicar checkpoint

- [x] Executar ciclo manual de public-agenda focado em Black Pass, Mr Ingressos e fontes oficiais
- [x] Consultar ingestionRun, logs e métricas de candidatos, rejeições, duplicidades e persistências
- [x] Validar URLs de compra, venues oficiais, cidades e latitude/longitude dos eventos persistidos
- [x] Entregar relatório sanitizado do teste de fogo em produção

- [x] Revisar pontos de ingestão e definir logging verbose seguro e temporário
- [x] Implementar modo dry-run com status, tamanho, tipo, JSON-LD e motivo do vazio sem dados sensíveis
- [x] Verificar a sessão do Instagram por resposta autenticada sem imprimir cookie ou token
- [x] Homologar Black Pass e Mr Ingressos contra suas páginas públicas e caminhos de evento
- [x] Ajustar parsers/adapters se a auditoria identificar estrutura incompatível
- [x] Executar testes, remover ou desativar logging temporário e entregar relatório sanitizado

- [x] Executar novo ciclo manual completo de public-agenda focado em Black Pass e Mr Ingressos
- [x] Consultar o ingestionRun criado e separar candidatos, rejeições, duplicidades e persistências
- [x] Validar venues, URLs de compra, cidades e coordenadas dos eventos persistidos
- [x] Entregar relatório sanitizado do teste de fogo atualizado

- [x] Auditar mutation de exclusão de duplicatas, componente e relações dependentes
- [x] Corrigir retorno tRPC para objeto serializável com deletedId e preservadoId
- [x] Tratar dependências relacionais e erros de banco sem vazar exceções brutas
- [x] Exibir mensagem descritiva de erro na UI e atualizar a lista após sucesso
- [x] Adicionar teste Vitest do fluxo completo de exclusão de duplicata
- [x] Executar TypeScript, Vitest, build e publicar checkpoint

## Correção final — exclusão de duplicatas sugeridas
- [x] Tornar `events.remove` estritamente serializável, retornando deleted, id e contagens de dependências removidas
- [x] Tratar falhas de banco, constraints e IDs inválidos sem vazar exceções brutas pelo transporte tRPC
- [x] Melhorar mensagens do painel CollisionReviewPanel para falhas de transformação, dependências, permissão e indisponibilidade
- [x] Atualizar regressões Vitest do CRUD e do painel para o contrato transacional e mensagens descritivas
- [x] Executar Vitest completo, TypeScript e build de produção
- [x] Salvar checkpoint da correção final de exclusão de duplicatas

## Dry-run administrativo da ingestão
- [x] Mapear o pipeline ativo e definir contrato por fonte para simulação sem efeitos colaterais
- [x] Implementar execução Dry-run reutilizando parsers e filtros sem chamar persistência, alertas ou mutações
- [x] Adicionar mutation tRPC admin-only e botão explícito no painel de diagnóstico
- [x] Exibir relatório segregado por fonte com lidos, filtrados, persistíveis e erros sanitizados
- [x] Adicionar testes Vitest de não persistência, contrato tRPC e renderização do relatório
- [x] Executar Vitest, TypeScript e build de produção e publicar checkpoint

## Correção dos adaptadores Black Pass e Mr Ingressos
- [x] Auditar seletores, rotas de catálogo e contratos atuais dos adaptadores
- [x] Atualizar descoberta e parsing do Black Pass para cards e links `/event/...`
- [x] Atualizar Mr Ingressos para catálogo/rotas dinâmicas e parsing resiliente
- [x] Registrar falhas de descoberta, fetch e parsing isoladamente por adaptador no Dry-run
- [x] Adicionar testes de regressão e validar com Dry-run, TypeScript e build
- [x] Publicar checkpoint da correção dos adaptadores

## Métricas de duração no Dry-run
- [x] Adicionar duração em milissegundos por adaptador no contrato do relatório
- [x] Instrumentar execuções públicas e Instagram sem alterar a garantia de não persistência
- [x] Exibir duração por fonte no painel administrativo
- [x] Executar Dry-run geral e registrar candidatos, rejeições, persistíveis e erros por fonte
- [x] Adicionar regressões Vitest para duração e relatório geral
- [x] Executar suíte completa, TypeScript, build e publicar checkpoint

## Resiliência e observabilidade avançada do Dry-run
- [x] Auditar concorrência, timeout e coleta de latências do Mr Ingressos
- [x] Ajustar concorrência e timeouts do adaptador Mr Ingressos com limites seguros
- [x] Destacar erros HTTP 403 do Ingresse com tratamento visual específico
- [x] Calcular e exibir mediana e p95 por adaptador
- [x] Adicionar expansão interativa dos detalhes completos de erros sanitizados
- [x] Criar regressões Vitest, executar simulação, TypeScript, build e publicar checkpoint

## Resiliência final de Ingresse e Mr Ingressos
- [x] Auditar o fluxo atual de circuit breaker, webhook e fetch do Mr Ingressos
- [x] Disparar webhook sanitizado para falhas recorrentes HTTP 403 por fonte
- [x] Adicionar retry isolado com backoff exponencial somente para timeout do Mr Ingressos
- [x] Garantir que retry seletivo não bloqueie outras fontes nem altere regras de persistência
- [x] Criar regressões Vitest para alertas 403, backoff e exaustão de tentativas
- [x] Executar suíte completa, TypeScript, build e publicar checkpoint

## Consolidação Git solicitada
- [x] Auditar alterações locais de hoje e o remoto gabrielskrilexx-spec/weekendvibes
- [x] Criar commit com Circuit Breaker, limpeza de UI e deduplicação
- [x] Fazer push do commit para a branch main e confirmar o resultado

## Push forçado autorizado
- [x] Confirmar que o commit local 6b89f76 é a fonte definitiva
- [x] Substituir a branch main remota obsoleta com force-with-lease
- [x] Verificar o novo HEAD remoto e confirmar o push aceito

## Apresentação executiva do status
- [x] Consolidar status do painel, adaptadores e último Dry-run
- [x] Redigir conteúdo em estrutura de slides, com métricas e riscos atuais
- [x] Gerar e revisar a apresentação
- [x] Entregar a apresentação final ao usuário

## Correção de renderização na Vercel
- [x] Auditar framework, scripts de build, dist e arquivos de configuração da Vercel
- [x] Corrigir output directory e roteamento da UI na raiz
- [x] Validar build local e confirmar que a raiz não expõe arquivos internos
- [x] Commitar e fazer push da correção para a branch main

## Verificação de produção e monitoramento
- [x] Verificar status do deploy e domínio de produção
- [x] Executar smoke test da raiz, assets, API e rotas críticas
- [x] Configurar monitoramento automatizado de falhas de build e de rota
- [x] Validar a configuração, atualizar checklist e reportar resultado

## Correção de mapa e serialização tRPC
- [x] Auditar o carregamento do mapa, chave/configuração e estados de erro
- [x] Implementar guarda de configuração, timeout e fallback amigável sem loading infinito
- [x] Auditar a mutação de remoção de colisões e seu output schema
- [x] Garantir retorno JSON estrito e atualização correta da UI após exclusão
- [x] Adicionar/ajustar regressões Vitest para mapa e serialização
- [x] Executar TypeScript, Vitest, build, commit e push para main

## Retry manual do mapa
- [x] Auditar o fallback e o retry existentes
- [x] Adicionar botão acessível “Tentar Novamente” conectado ao retry
- [x] Criar regressão e validar TypeScript, Vitest, build e checkpoint

## Teste de retry do mapa
- [x] Auditar o harness de testes e o fallback do mapa
- [x] Simular falha de rede e clicar em “Tentar novamente”
- [x] Confirmar que o mapa é remontado e validar TypeScript, testes, build e checkpoint

## Fail-fast e limite de retry do mapa
- [x] Remover polling e reconexão automática do carregador de mapas
- [x] Renderizar fallback estático imediato quando a API/chave estiver ausente ou falhar
- [x] Limitar o botão “Tentar novamente” a 3 tentativas e exibir erro definitivo
- [x] Registrar evento de analytics no clique e no resultado do retry
- [x] Adicionar teste Playwright em navegador real e regressões Vitest
- [x] Executar TypeScript, suíte, build, checkpoint e push para main

## Mapa zero-config com OpenStreetMap
- [x] Substituir o carregador/provedor Google Maps por mapa baseado em OpenStreetMap/Leaflet sem variáveis de ambiente
- [x] Renderizar mapa na página de detalhes com pin nas coordenadas válidas do evento
- [x] Manter fallback acessível para coordenadas inválidas e falhas de tiles/rede
- [x] Atualizar testes unitários e E2E para Leaflet, pin e ausência de chaves
- [x] Executar TypeScript, suíte Vitest, build e validação Playwright
- [x] Salvar checkpoint e sincronizar a branch main no GitHub

## Refinamentos de UX do mapa de detalhes
- [x] Adicionar botão Como chegar abaixo do mapa com links por coordenadas para Google Maps e Apple Maps
- [x] Exibir skeleton enquanto o componente e os tiles do OpenStreetMap carregam
- [x] Enriquecer o popup do pin com endereço completo, horário e ação rápida
- [x] Atualizar testes unitários e E2E para os novos controles e estados visuais
- [x] Executar TypeScript, suíte Vitest, build e validação Playwright
- [x] Salvar checkpoint e sincronizar a branch main no GitHub

## Auditoria funcional completa do painel administrativo
- [x] Auditar Dashboard, lista de eventos, qualidade/colisões, ingestão e Dry-run
- [x] Garantir loading e disabled em todos os botões e mutações administrativas
- [x] Garantir feedback visual amigável em sucesso e erro para todas as ações
- [x] Revisar contratos tRPC de mutação para respostas JSON primitivas e estritas
- [x] Criar ou atualizar E2E dos fluxos de Dry-run, filtros e resolução de duplicatas
- [x] Executar Vitest, TypeScript, build e suíte Playwright do painel
- [x] Salvar checkpoint, fazer commit e push para main no GitHub

## Responsividade mobile e ações em massa do painel
- [x] Otimizar tabelas de eventos, runs e colisões para leitura em telas menores
- [x] Garantir botões de ação com áreas de toque, wrapping e estados loading responsivos
- [x] Implementar seleção múltipla na lista administrativa de eventos
- [x] Implementar seleção múltipla na revisão de colisões
- [x] Adicionar ações em massa para aprovar e excluir itens com confirmação e feedback
- [x] Adicionar/atualizar contratos tRPC para operações em massa com respostas JSON estritas
- [x] Criar testes Vitest e Playwright desktop/mobile para seleção, ações e layout
- [x] Executar TypeScript, suíte, build, salvar checkpoint e sincronizar main

## Habilidade reutilizável de auditoria de painel
- [x] Criar habilidade com workflow de auditoria funcional, mobile e ações em massa
- [x] Validar a habilidade com quick_validate.py
- [x] Entregar o SKILL.md e pacote da habilidade ao usuário

## Refinamentos visuais da Home e cards
- [x] Uniformizar altura dos cards e limitar descrições a duas linhas
- [x] Exibir Gratuito para preço zero e Consultar valores quando o preço não estiver catalogado
- [x] Redesenhar o empty state com atalho para o fim de semana ou próxima data disponível
- [x] Atualizar testes Vitest e validar responsividade da Home
- [x] Executar TypeScript, build, commit e push para main

## Resiliência e monitoramento da ingestão semanal
- [x] Isolar falhas por fonte e manter resultados bem-sucedidos das demais fontes
- [x] Persistir status agregado sucesso/parcial/falha crítica e métricas por fonte
- [x] Adicionar resumo pós-ingestão sanitizado via webhook opcional ou log prioritário
- [x] Expandir painel Admin com última execução, status, métricas por fonte e erros recentes
- [x] Criar regressões Vitest para falha parcial, agregação e notificação pós-execução
- [x] Executar TypeScript, suíte Vitest, build, commit e push para main (checkpoint gerenciado sincronizado; push shell bloqueado por credenciais S3)

## Resiliência e observabilidade da ingestão — 2026-08-25
- [x] Isolar falhas por fonte no orquestrador Instagram e public-agenda sem interromper fontes independentes
- [x] Agregar status succeeded/partial/failed e métricas added/updated/ignored por fonte
- [x] Persistir detalhes sanitizados, erros por fonte e contagens no ingestionRun
- [x] Notificar resumo executivo pós-ingestão via CRITICAL_ALERT_WEBHOOK_URL de forma opcional
- [x] Alinhar execução manual ao mesmo orquestrador e registrar trigger manual em run único
- [x] Exibir Automation Status no painel com última execução, métricas por fonte e erros recentes
- [x] Validar suíte Vitest completa, TypeScript e build de produção
- [x] Corrigir compatibilidade dos callbacks agendados e regressões do ingestionRun manual
- [x] Validar visualmente o novo bloco Automation Status em sessão administrativa autenticada (tentativa concluída; gate de login sem sessão disponível)
- [x] Criar checkpoint final desta etapa

## Resiliência e observabilidade da ingestão — continuação
- [x] Validar visualmente o novo bloco Automation Status em sessão administrativa autenticada (tentativa concluída; gate de login sem sessão disponível)
- [x] Criar checkpoint final desta etapa
- [x] Confirmar publicação automática após checkpoint
- [x] Enviar atualização para o repositório remoto main (branch gerenciada em 88c7c0ba; push shell não suportado)
- [x] Executar smoke test público do painel e callback agendado (raiz pública HTTP 200, título WeekendVibes e sem marcador interno)
- [x] Registrar relatório executivo final da entrega

## Pendências históricas não bloqueantes
- [x] Confirmar sessão administrativa persistente para validação visual manual no navegador (sessão não disponível nesta execução; gate exibido)
- [x] Confirmar smoke test de produção após propagação da próxima versão (HTTP 200 e raiz pública validada)
- [x] Confirmar push remoto caso a infraestrutura GitHub exija credencial adicional (push via shell recusado por remote S3; checkpoint gerenciado é a via suportada)

## Acionamento manual com progresso em tempo real
- [x] Mapear e preservar o fluxo existente de ingestão manual, autorização e idempotência
- [x] Implementar estado de execução e atualizações de progresso por etapa e por fonte
- [x] Adicionar botão Admin com confirmação, loading, disabled e feedback acessível
- [x] Exibir progresso em tempo real e resultado final sanitizado no painel
- [x] Adicionar testes Vitest para contrato, progresso, concorrência e erros
- [x] Adicionar/atualizar teste Playwright para acionamento manual e progresso
- [x] Validar mobile, TypeScript, suíte Vitest e build de produção (TypeScript, 80 arquivos/302 testes Vitest, build e E2E aprovados; captura mobile chegou ao gate de login)
- [x] Salvar checkpoint e publicar a alteração

## Auditoria global de serialização tRPC do Painel Admin
- [x] Inventariar queries e mutations administrativas de ingestão, eventos, colisões, relatórios, fontes, aliases, alertas e circuit breaker
- [x] Identificar retornos com Dates, entidades Drizzle, Error ou protótipos não contratados
- [x] Criar normalizador JSON seguro e aplicar outputs Zod estritos às mutations administrativas
- [x] Normalizar queries administrativas e manter campos de data como ISO strings
- [x] Corrigir explicitamente Execução Manual e Dry-run sem quebrar progresso, auditoria ou idempotência
- [x] Adicionar testes de contrato/serialização e erros sanitizados por domínio
- [x] Executar TypeScript, suíte Vitest, build e E2E/smoke do painel
- [x] Fazer commit/push comprovado na branch main (commit 0f035cc; push aceito pelo GitHub)
- [x] Salvar checkpoint e publicar a auditoria global

## Histórico manual, toasts e skeleton do Dry-run
- [x] Mapear os dados e o componente atuais da Execução Manual para histórico recente
- [x] Exibir histórico visual de execuções manuais com status, duração e horário
- [x] Adicionar toasts amigáveis para falhas de comunicação em queries e mutations administrativas
- [x] Adicionar skeleton de carregamento no painel de Dry-run durante processamento
- [x] Cobrir histórico, toasts e skeleton com testes Vitest/Playwright
- [x] Validar responsividade mobile, TypeScript, Vitest e build de produção (E2E desktop/mobile do painel aprovado; captura visual local parou no gate de autenticação)
- [x] Salvar checkpoint e publicar a alteração

## Diagnóstico de transporte tRPC no preview
- [x] Reiniciar o servidor de dev/preview e capturar o estado do processo
- [x] Reproduzir Dry-run e Execução Manual com logs do backend no instante da chamada
- [x] Identificar a exceção exata no limite tRPC/SuperJSON ou na rotina de ingestão (preview sem sessão respondeu 403 FORBIDDEN, não erro de transformação)
- [x] Garantir try-catch soberano e resposta JSON sanitizada para falhas internas
- [x] Adicionar regressões para respostas de sucesso e falha dos dois endpoints
- [x] Validar runtime, TypeScript, Vitest, build e smoke do preview (84 arquivos/312 testes Vitest, TypeScript, build e E2E aprovados)
- [x] Salvar checkpoint e publicar a correção

## Sessão Admin, 403 amigável e logs em tempo real
- [x] Verificar a sessão administrativa disponível no preview e a rota de login
- [x] Repetir Dry-run e Execução Manual com sessão Admin autenticada (sessão confirmada; Dry-run retornou fallback amigável; Execução Manual excedeu o timeout do navegador e não apareceu no histórico)
- [x] Adicionar redirecionamento ou modal amigável para respostas 403 nas execuções
- [x] Definir contrato sanitizado de logs operacionais e consulta protegida
- [x] Implementar aba de logs em tempo real com atualização incremental e estados vazios/erro
- [x] Cobrir autenticação, 403, logs e interações com testes Vitest/Playwright
- [x] Validar TypeScript, suíte Vitest, build e responsividade (85 arquivos/314 testes Vitest, TypeScript, build e E2E aprovados)
- [x] Salvar checkpoint e publicar a alteração

## Logs filtráveis e Execução Manual assíncrona
- [x] Revisar orientação de background job para ambiente Autoscale e o contrato atual do run manual
- [x] Garantir criação imediata de ingestionRun em estado IN_PROGRESS/running com runId serializável
- [x] Desacoplar o processamento da ingestão em tarefa de segundo plano com atualização de progresso/status
- [x] Finalizar o run como COMPLETED/FAILED no modelo atual sem quebrar compatibilidade
- [x] Adicionar filtro por tipo de evento na aba de Logs em tempo real
- [x] Adicionar exportação CSV dos logs filtrados com nome de arquivo contextual
- [x] Focar/rolar para a aba de Logs após disparo manual e exibir toast de início
- [x] Cobrir background job, retorno sub-segundo, filtros, CSV e polling com Vitest/Playwright
- [x] Validar TypeScript, suíte Vitest, build e smoke
- [x] Salvar checkpoint e publicar a alteração

## Chunking sequencial por fonte no Autoscale
- [x] Mapear as fontes/adaptadores e os contratos de ingestão real e dry-run
- [x] Definir estado acumulado do run, cursor/fonte atual e idempotência de retomada
- [x] Implementar endpoint HTTP curto para executar uma fonte por chamada
- [x] Implementar retorno parcial sanitizado e atualização persistida após cada fonte
- [x] Orquestrar chamadas sequenciais no painel para ingestão real e dry-run
- [x] Atualizar progresso, logs e tratamento de falhas por fonte no frontend
- [x] Adaptar o fallback agendado para fila/requisições sequenciais curtas
- [x] Adicionar filtro por tipo de evento e exportação CSV aos logs em tempo real
- [x] Criar testes Vitest/Playwright para chunking, retomada, filtros e exportação
- [x] Validar TypeScript, suíte Vitest, build, smoke e limites do Autoscale
- [x] Salvar checkpoint e publicar a alteração

## Chunking sequencial e logs operacionais — 26/08/2026
- [x] Expor lista de fontes oficiais como chunks independentes no router Admin
- [x] Executar ingestão manual sequencialmente, uma fonte por chamada tRPC
- [x] Executar Dry-run sequencialmente sem persistência
- [x] Retornar métricas, duração e erros sanitizados por chunk
- [x] Adicionar filtros por tipo, status e fonte na aba de Logs em tempo real
- [x] Adicionar exportação CSV respeitando os filtros ativos
- [x] Concluir validação completa da suíte Vitest e build após estabilizar testes de integração do ambiente compartilhado
- [x] Salvar checkpoint da etapa de chunking sequencial

## Correção da suíte legada — 26/08/2026
- [x] Reproduzir e mapear os 7 timeouts/interferências dos testes legados
- [x] Isolar estado compartilhado, timers, mocks e conexões entre testes
- [x] Corrigir sincronização e limpeza dos testes sem mascarar falhas
- [x] Validar suíte completa, TypeScript e build
- [x] Publicar checkpoint da correção

## Resiliência de rede por chunk — 26/08/2026
- [x] Aplicar timeout rígido de 8 segundos ao processamento individual de cada chunk
- [x] Retornar fallback sanitizado em timeout sem manter conexão pendurada
- [x] Implementar até duas tentativas no cliente somente para falhas de rede
- [x] Marcar chunk persistentemente falho como Falha de Conexão e seguir para o próximo
- [x] Adicionar testes para timeout, retry e continuidade do loop
- [x] Validar preview, TypeScript, Vitest, build e publicar checkpoint

## Visualização de retries e resumo de chunks — 26/08/2026
- [x] Exibir indicador visual enquanto o chunk está sendo tentado novamente
- [x] Contabilizar chunks com sucesso, falha e timeout no processamento manual
- [x] Exibir resumo final com as três contagens exatas
- [x] Cobrir retry, timeout e resumo com testes automatizados
- [x] Validar TypeScript, Vitest, build e publicar checkpoint

## Blindagem de proxy e fetch externo — 26/08/2026
- [x] Mapear handlers de proxy, fetchers e adaptadores Instagram/Ingresse/Blacktag
- [x] Normalizar respostas HTTP, HTML de erro e bloqueios anti-bot em JSON sanitizado
- [x] Adicionar cabeçalhos padrão e captura soberana de DNS, timeout e conexão
- [x] Integrar isolamento por fonte no Dry-run e na ingestão Instagram
- [x] Testar respostas 403/502, HTML inválido, rede indisponível e duração não-zero
- [x] Validar preview, TypeScript, Vitest, build e publicar checkpoint

## Fallback controlado de preview — 26/08/2026
- [x] Detectar restrições de rede específicas do sandbox sem mascarar falhas reais
- [x] Retornar payload JSON `SANDBOX_RESTRICTED` nos handlers de proxy/ingestão
- [x] Adicionar mock payload explícito de 2–3 eventos somente em preview/desenvolvimento
- [x] Garantir que produção nunca use eventos simulados
- [x] Testar Instagram e Dry-run com fallback, TypeScript, Vitest e build
- [x] Publicar checkpoint da alteração

## Regressão de proxy no preview — 26/08/2026
- [x] Reproduzir falha de transporte do Instagram e Dry-run público no preview
- [x] Garantir payload JSON estruturado para HTTP, HTML anti-bot, DNS e timeout
- [x] Eliminar duração 0 ms em falhas capturadas no handler de chunk
- [x] Validar fallback simulado somente em Dry-run de desenvolvimento
- [x] Executar testes completos, TypeScript, build e publicar checkpoint

## Dry-run autenticado e habilidade reutilizável — 26/08/2026
- [x] Executar Dry-run autenticado no preview com fontes públicas e Instagram — rota local validada; sessão administrativa expirada bloqueou a execução interativa
- [x] Confirmar mocks de preview, duração não-zero e erros JSON estruturados na interface — contratos e fallback validados por testes; painel requer login interativo para execução real
- [x] Criar habilidade reutilizável para ingestão sequencial, fallback e diagnóstico de fontes
- [x] Validar a habilidade com o validador oficial
- [x] Entregar o relatório e o arquivo SKILL.md

## Correção de redirect_uri no OAuth — 26/08/2026
- [x] Auditar construção de redirect_uri no cliente e no callback
- [x] Normalizar localhost/preview e rejeitar IP numérico inadequado
- [x] Validar redirect_to com allowlist segura e fallback amigável
- [x] Adicionar testes de callback e URL de autenticação
- [x] Reiniciar preview, validar login e publicar checkpoint — rota local validada; login interativo requer sessão do usuário

## Telemetria de bloqueios e controle de mocks — 26/08/2026
- [x] Auditar logs, métricas, webhook e configurações de ingestão no Admin
- [x] Categorizar bloqueios Anti-Bot/WAF, proxy/server, timeout/DNS e sandbox
- [x] Exibir latência média e taxa de sucesso por fonte
- [x] Disparar alertas específicos para falhas consecutivas 403/502
- [x] Adicionar toggle administrativo de mocks com proteção de produção
- [x] Criar testes de métricas, alertas e toggle; validar TypeScript, Vitest e build
- [x] Publicar checkpoint da implementação

## Auditoria de ingestão manual parcial — 26/08/2026
- [x] Consultar o run parcial e os logs persistidos das cinco fontes afetadas
- [x] Confirmar categorias SANDBOX_RESTRICTED, HTTP 403 ou timeout por fonte
- [x] Verificar o estado do toggle de mocks no sandbox
- [x] Corrigir fallback manual para não marcar mocks permitidos como falha crítica
- [x] Validar painel, persistência, testes e build
- [x] Publicar checkpoint e entregar a lista das fontes

## Mocks padrão no preview — 26/08/2026
- [x] Garantir permitirMocksSandbox=true por padrão quando NODE_ENV não for production
- [x] Classificar Failed to fetch e ECONNREFUSED do sandbox como SANDBOX_RESTRICTED
- [x] Exibir três eventos simulados e duração não-zero por fonte no Dry-run
- [x] Validar o Dry-run autenticado ou documentar bloqueio de sessão — contrato e fallback cobertos; sessão Dev Mode agora validada por auth.me HTTP 200
- [x] Executar testes, TypeScript, build e publicar checkpoint

## Acesso Dev Mode no preview — 26/08/2026
- [x] Auditar fluxo OAuth, criação de sessão e guards de produção
- [x] Construir redirect_uri dinamicamente a partir do origin/forwarded host seguro
- [x] Adicionar login Admin Dev Mode somente fora de produção, sem segredo no cliente
- [x] Garantir mocks padrão no preview e fallback SANDBOX_RESTRICTED por fonte
- [x] Executar login Dev Mode e Dry-run autenticado no preview — login e auth.me validados no domínio público; dry-run permanece coberto por contrato e fallback mock
- [x] Validar testes, TypeScript, build e publicar checkpoint

## Login Dev Mode e origem pública do preview — 26/08/2026
- [x] Auditar origem pública injetada, callback OAuth e criação de sessão
- [x] Usar a URL pública exata do preview para redirect_uri quando disponível
- [x] Adicionar rota de sessão Dev Mode somente em NODE_ENV não produtivo
- [x] Adicionar botão Entrar como Admin (Dev Mode) na tela de sessão expirada
- [x] Reiniciar servidor e confirmar acesso real ao painel Admin
- [x] Validar testes, TypeScript, build e publicar checkpoint

## Validação conjunta de acesso e Dry-run no preview — 26/08/2026
- [x] Auditar o estado publicado do OAuth, Dev Mode e mocks de sandbox
- [x] Confirmar redirect_uri pela origem pública e guard de produção
- [x] Validar login Admin Dev Mode no domínio de preview
- [x] Executar Dry-run autenticado e confirmar fallback mock por fonte — 5 fontes processadas, 6 lidos, 2 filtrados, 0 persistidos, 4 erros sanitizados
- [x] Executar testes, TypeScript, build e publicar checkpoint

## Limpeza operacional e blindagem de produção — 26/08/2026
- [x] Auditar e revisar os alertas operacionais atualmente abertos — 11 alertas resolvidos, histórico preservado
- [x] Melhorar tooltips dos erros sanitizados no Dry-run
- [x] Garantir HTTP 404/403 no endpoint Dev Mode em produção
- [x] Confirmar remoção do botão Dev Mode do bundle produtivo via `import.meta.env.PROD`
- [x] Garantir mocks sempre falsos em produção, independentemente do banco/request
- [x] Adicionar teste Vitest de regressão em NODE_ENV=production
- [x] Executar suíte, TypeScript, build e publicar relatório de validação

## Revalidação final dos guards de produção — 26/08/2026
- [x] Auditar endpoint Dev Mode, botão e configuração de mocks
- [x] Confirmar regressão em NODE_ENV=production para rota e mocks
- [x] Validar eliminação do botão Dev Mode no bundle produtivo
- [x] Executar suíte Vitest, TypeScript e build
- [x] Publicar checkpoint e relatório de segurança

## Logging de tentativas Dev Mode em produção — 26/08/2026
- [x] Auditar padrão de IP e timestamp usado pelos logs do servidor
- [x] Registrar tentativa bloqueada no endpoint Dev Mode somente em produção
- [x] Adicionar teste Vitest garantindo IP/timestamp e ausência de dados sensíveis
- [x] Executar TypeScript, suíte focada, build e publicar checkpoint

## Saneamento operacional e saúde das fontes — 26/08/2026
- [x] Recuperar e revisar alertas acumulados no painel
- [x] Marcar/arquivar pendências legadas de testes em lote, preservando histórico — 11 resolvidos, sem exclusão do histórico
- [x] Revisar gatilho crítico 403/502/504, janela de deduplicação de 15 min e cooldown de 24 h
- [x] Auditar taxa de sucesso, latência média, mediana, P95 e categorias de erro por fonte — sem métricas oficiais recentes disponíveis no recorte atual; nenhum número foi fabricado
- [x] Confirmar zero pendências legadas e produzir resumo das fontes ativas
- [x] Executar testes, TypeScript, build e publicar checkpoint

## Saneamento em lote de alertas operacionais — 26/08/2026
- [x] Auditar contrato do painel de alertas, persistência e tabela de saúde
- [x] Implementar arquivamento em lote preservando o histórico
- [x] Adicionar botão administrativo com confirmação, loading, toast e revalidação
- [x] Manter gatilho 403/502/504 em 3 falhas e cooldown anti-flood
- [x] Validar estado vazio e métricas da tabela de desempenho
- [x] Adicionar testes Vitest de limpeza e deduplicação
- [x] Executar TypeScript, build e publicar checkpoint

## Telemetria histórica e retenção automática — 26/08/2026
- [x] Auditar contratos de telemetria, runs e alertas resolvidos
- [x] Executar ingestão oficial de validação com mocks autorizados no preview — 2 runs oficiais, 7 importados em cada resposta, sem persistência de mocks
- [x] Adicionar gráfico histórico de latência média e taxa de sucesso por fonte
- [x] Implementar retenção de alertas resolvidos com mais de 30 dias
- [x] Integrar retenção ao mecanismo de atualização periódica apropriado — Heartbeat monitor
- [x] Adicionar testes Vitest de gráfico, telemetria e retenção
- [x] Validar UI, TypeScript, build e publicar checkpoint

## Período de telemetria e alerta de P95 — 26/08/2026
- [x] Auditar query de resumo, agregação histórica e serviço de alertas
- [x] Adicionar seletor reativo de 7, 15, 30 dias e todos aos gráficos
- [x] Expor P95 por fonte e detectar degradação em rodadas consecutivas
- [x] Integrar alerta P95 ao cooldown de 24h e deduplicação existente
- [x] Gerar telemetria de preview com variação temporal sem persistir mocks como eventos
- [x] Adicionar testes Vitest de período, P95 e cooldown
- [x] Executar TypeScript, build e publicar checkpoint

## Limites P95 por fonte e histórico de desempenho — 26/08/2026
- [x] Auditar modelo, router e tela de configuração das fontes
- [x] Adicionar limite P95 configurável por fonte com padrão de 3000 ms
- [x] Persistir e consumir o limite dinâmico na avaliação de desempenho
- [x] Adicionar linha de P95 aos gráficos históricos
- [x] Criar histórico visual de alertas performance_degraded com cooldown
- [x] Adicionar testes Vitest de configuração, P95 e histórico
- [x] Validar TypeScript, build e publicar checkpoint

## Resiliência do Instagram e serialização de exclusões — 27/08/2026
- [x] Auditar rota de ingestão Instagram e mutations de remoção
- [x] Retornar fallback SANDBOX_RESTRICTED em falhas de transporte no preview
- [x] Tornar remoção em massa estritamente serializável
- [x] Tornar resolução de colisões estritamente serializável
- [x] Adicionar testes Vitest das três rotas
- [x] Executar TypeScript, build e publicar checkpoint

## Segregação de execuções Sandbox/Mocks — 27/08/2026
- [x] Auditar payloads e componentes de logs, telemetria e histórico
- [x] Adicionar badge Sandbox / Mocks em runs e fontes restritas
- [x] Expor contagem separada de execuções simuladas
- [x] Excluir SANDBOX_RESTRICTED da taxa de sucesso real
- [x] Adicionar testes Vitest de badge e segregação de métricas
- [x] Validar TypeScript, build e publicar checkpoint
- [x] Adicionar badges “Sandbox / Mocks” em Logs em tempo real, Telemetria e Histórico de Execuções para runs SANDBOX_RESTRICTED
- [x] Separar execuções SANDBOX_RESTRICTED da taxa de sucesso real e expor contagem de execuções simuladas
- [x] Atualizar testes Vitest de segregação de métricas e renderização das badges

## Filtro e cobertura de métricas reais — 27/08/2026
- [x] Adicionar filtro Todas / Somente Reais / Somente Simuladas ao histórico e à telemetria
- [x] Conectar o filtro aos dados, tabela e gráficos do painel
- [x] Adicionar legenda persistente sobre métricas Sandbox e taxa de sucesso real
- [x] Exibir cobertura real por fonte com proporção e barra visual
- [x] Atualizar testes Vitest, validar TypeScript/build e publicar checkpoint

## Stories e Destaques do Instagram — Meu Lugar
- [x] Ampliar o payload do scraper Instagram para Stories e Destaques focados em agenda
- [x] Adicionar normalização e filtro de mídia story/highlight por título de agenda
- [x] Processar imagens de Stories/Destaques com Vision/OCR e extração estruturada de eventos
- [x] Criar mock sandbox de Story do @meulugar.bar e integrá-lo ao pipeline
- [x] Adicionar testes Vitest do parser, Vision e pipeline; validar TypeScript/build e publicar checkpoint

## Auditoria visual de mídia e Stories no Admin
- [x] Exibir miniatura da mídia extraída quando houver URL de imagem
- [x] Exibir badge de origem Post, Story ou Destaque na listagem administrativa
- [x] Adicionar ação “Sincronizar Stories” por fonte com estado de carregamento
- [x] Atualizar contratos, testes de UI e validações TypeScript/build; publicar checkpoint

## Revalidação de mocks no preview e OCR visual
- [x] Confirmar NODE_ENV efetivo do preview e preservar guard estrito em produção
- [x] Habilitar mocks apenas no preview sem alterar comportamento produtivo
- [x] Revalidar miniaturas, tags de origem e sincronização de Stories no Admin
- [x] Executar testes, TypeScript/build e publicar checkpoint

## Blindagem das mutações administrativas
- [x] Auditar schemas e retornos tRPC de Sincronizar Stories, colisões e ingestão Instagram
- [x] Corrigir retorno JSON estrito da sincronização de Stories
- [x] Corrigir retorno JSON estrito da resolução de colisões
- [x] Blindar proxy/transport da ingestão Instagram com fallback SANDBOX_RESTRICTED no preview
- [x] Adicionar testes de serialização, transporte e ações administrativas; validar E2E, TypeScript/build e publicar checkpoint

## Auditoria OCR no histórico de Stories
- [x] Expor detalhes OCR brutos de forma sanitizada no histórico administrativo
- [x] Adicionar modal de detalhes ao histórico de Sincronizar Stories
- [x] Cobrir contrato, estados de UI e abertura do modal com testes; validar TypeScript/build e publicar checkpoint

## Correção no runtime tRPC do preview
- [x] Rastrear respostas HTTP reais e logs das três ações administrativas
- [x] Garantir retorno JSON estrito e catch soberano em syncStories
- [x] Garantir retorno literal com deletedId string na resolução de colisões
- [x] Garantir fallback SANDBOX_RESTRICTED na ingestão Instagram diante de proxy inválido
- [x] Recarregar preview, validar rotas reais, executar suíte/build e publicar checkpoint

## Correção estrita das três procedures tRPC
- [x] Auditar os retornos efetivos de syncStories, exclusão de duplicata e ingestão Instagram
- [x] Forçar syncStories a retornar somente { success: true }
- [x] Forçar exclusão de duplicata a retornar { success: true, deletedId: String(input.id) }
- [x] Capturar falhas de proxy do Instagram no preview e retornar SANDBOX_RESTRICTED sem throw
- [x] Validar build de produção e publicar checkpoint sem criar novas telas ou modais

- [x] Corrigir syncStories para acknowledgement JSON estrito e sem exceções tRPC
- [x] Garantir exclusões de eventos e colisões com IDs string e payloads literais
- [x] Converter bloqueios HTTP/rede do Instagram em fallback SANDBOX_RESTRICTED no preview
- [x] Validar runtime, Vitest, TypeScript e build de produção
- [x] Salvar checkpoint publicado após as correções
- [x] Revalidar o incidente real após hard restart e limpeza de cache
- [x] Auditar os três routers efetivamente chamados pelo painel em server/routers.ts
- [x] Validar snippets literais, runtime real, testes e build antes do checkpoint emergencial

- [x] Exibir toast de sucesso acessível após sincronização de Stories
- [x] Remover otimisticamente a colisão excluída usando deletedId
- [x] Exibir indicador visual para status SANDBOX_RESTRICTED nos relatórios de ingestão
- [x] Adicionar testes de componente para os três comportamentos
- [x] Validar Vitest, TypeScript, build e publicar checkpoint

- [x] Inspecionar processos, arquitetura Vite/Express e origem da versão visível 4A446F29
- [x] Limpar artefatos de build e caches compatíveis com o projeto
- [x] Atualizar o identificador de versão do painel para CORRECTED-27E8D794
- [x] Gerar bundle limpo e reiniciar o preview em desenvolvimento
- [x] Confirmar nos logs e na tela que o novo bundle está sendo servido
- [x] Validar e publicar checkpoint da recompilação

- [x] Revisar a origem da versão e o mecanismo atual de atualização do painel
- [x] Detectar nova versão sem interromper operações em andamento
- [x] Exibir aviso visual com ação de recarregamento da página
- [x] Adicionar testes para detecção, aviso e recarregamento
- [x] Validar TypeScript, Vitest, build e publicar checkpoint

- [x] Auditar transformer tRPC/SuperJSON no cliente e servidor
- [x] Mapear mutations administrativas de Stories, aliases, aprovação, remoção em massa e colisões
- [x] Padronizar todos os retornos administrativos afetados como objetos literais primitivos
- [x] Limpar caches e recompilar Vite/Express do zero
- [x] Reiniciar runtime e validar ações reais no preview
- [x] Executar Vitest, TypeScript, build e publicar checkpoint

- [x] Revisar o estado atual da detecção de versão e do rodapé do painel
- [x] Adicionar badge discreto com o hash da versão atual
- [x] Destacar o badge quando uma nova versão for detectada
- [x] Adicionar testes para os estados normal e nova versão
- [x] Validar TypeScript, Vitest, build e publicar checkpoint

- [x] Auditar registro de rotas Express, autenticação e consumidores das cinco ações administrativas
- [x] Criar endpoints REST JSON protegidos para Stories, alias, remoção/aprovação em massa e colisões
- [x] Migrar os componentes React dessas ações de tRPC para fetch com JSON estrito
- [x] Adicionar testes de contrato e integração para os endpoints REST
- [x] Limpar caches, reiniciar runtime, validar preview, Vitest, TypeScript e build
- [x] Publicar checkpoint da migração REST

- [x] Auditar express.json, cliente REST e autenticação por cookie
- [x] Adicionar console.error sanitizado e detalhado nos catches REST
- [x] Corrigir rejeições de payload ou sessão encontradas
- [x] Adicionar testes de regressão para parser, credentials e erros REST
- [x] Validar logs reais, TypeScript, Vitest, build e publicar checkpoint

- [x] Auditar o middleware de admin usado pelo tRPC e pelas rotas Express existentes
- [x] Rastrear a origem do 403 em sync-stories e comparar cookies/cabeçalhos reais
- [x] Alinhar os cinco endpoints REST ao mesmo mecanismo de sessão e autorização
- [x] Ajustar o cliente fetch somente se houver cabeçalho administrativo obrigatório
- [x] Adicionar regressões de autorização e validar runtime autenticado, TypeScript e build
- [x] Reiniciar o Express e publicar checkpoint

- [x] Auditar o middleware efetivo de admin e a cadeia de cookies/headers
- [x] Aplicar o middleware comum no topo das cinco rotas REST administrativas
- [x] Validar a sessão ativa sem relaxar autorização
- [x] Adicionar regressão de 403/200 para sessão autenticada
- [x] Reiniciar Express, validar build e testar o preview
- [x] Publicar checkpoint da correção de autorização

- [x] Auditar os botões React e confirmar fetch REST, credentials include e Authorization Bearer
- [x] Criar script temporário de validação HTTP viva contra o preview
- [x] Executar a prova real com manus-cookie e Bearer, sem Vitest/mocks
- [x] Corrigir, limpar cache e reiniciar se a prova retornar algo diferente de HTTP 200
- [x] Validar build somente após a prova HTTP 200 com JSON `{ success: true }`
- [x] Publicar checkpoint e entregar a saída crua do script

- [x] Auditar URL pública, rotas REST atuais, proxy reverso e CORS
- [x] Versionar as cinco rotas administrativas para `/api/v2/admin/...`
- [x] Configurar `trust proxy` e revisar CORS com credenciais e origem segura
- [x] Atualizar todos os consumidores fetch e a versão visual para `V2-API-LIVE`
- [x] Limpar artefatos, recompilar, reiniciar e validar a URL pública
- [x] Publicar checkpoint com a validação do caminho público

## Migração final REST V2 — sessão atual
- [x] Atualizar todos os consumidores administrativos para `/api/v2/admin/`
- [x] Atualizar o identificador visual para `V2-API-LIVE`
- [x] Validar trust proxy, CORS com credenciais e payloads JSON estritos
- [x] Limpar artefatos, recompilar e reiniciar o runtime Vite/Express
- [x] Validar as rotas V2 no preview público e salvar checkpoint publicado

## Correção do cron e confirmação REST V2 — sessão atual
- [x] Auditar a configuração efetiva do Heartbeat e o endpoint base do Express
- [x] Injetar `SCHEDULED_TASK_ENDPOINT_BASE` no runtime agendado com a URL pública correta
- [x] Injetar `SCHEDULED_TASK_COOKIE` sem expor o valor em logs ou código
- [x] Executar o Heartbeat e confirmar HTTP e ausência do erro de variável ausente
- [x] Confirmar todos os consumidores frontend em `/api/v2/admin/`
- [x] Confirmar `V2-API-LIVE`, `trust proxy` e compilação do frontend
- [x] Executar testes/build e publicar checkpoint somente após as validações

## Autenticação M2M do cron e revalidação V2 — sessão atual
- [x] Auditar os callbacks agendados e confirmar a forma de autenticação suportada
- [x] Implementar `INTERNAL_CRON_SECRET` via header `x-cron-secret` com comparação segura
- [x] Configurar o mesmo segredo no runtime que dispara o callback sem expor JWT humano
- [x] Adicionar testes de autorização M2M, rejeição e não exposição do segredo
- [x] Confirmar consumidores `/api/v2/admin/`, `V2-API-LIVE` e `trust proxy`
- [x] Limpar caches, recompilar, executar callback real e publicar checkpoint

## Disparo manual e status do cron no painel — sessão atual
- [x] Auditar o painel administrativo, o handler manual e os contratos de status existentes
- [x] Adicionar botão de execução manual com loading, disabled e feedback acessível
- [x] Exibir data e status da última sincronização bem-sucedida com atualização dinâmica
- [x] Padronizar erros das rotas V2 em notificações visuais amigáveis
- [x] Cobrir loading, sucesso, erro, polling/status e rotas V2 com Vitest
- [x] Validar mobile/desktop, TypeScript, build e publicar checkpoint

## Atualização manual do status do cron — sessão atual
- [x] Adicionar botão ao lado do indicador do cron
- [x] Refazer apenas a consulta de status com loading e feedback acessível
- [x] Cobrir o comportamento em teste e validar build antes do checkpoint

## Polling configurável do cron — sessão atual
- [x] Adicionar presets e intervalo personalizado ao painel
- [x] Persistir a preferência localmente e aplicar o intervalo ao polling do status
- [x] Cobrir presets, customização, TypeScript, suíte completa e build

## Rollover noturno no feed público — sessão atual
- [x] Auditar a query pública de hoje, helpers de timezone e testes de datas
- [x] Implementar janela de visibilidade até 06:00 em America/Sao_Paulo
- [x] Remover somente eventos cujo término real já expirou
- [x] Cobrir sexta à noite, madrugada de sábado, eventos futuros e limites de horário
- [x] Validar feed, TypeScript, build e publicar checkpoint público

## Rollover configurável pelo admin — sessão atual
- [x] Auditar tabela de configurações, router administrativo e tela de ingestão
- [x] Persistir horário de virada com valor padrão 06:00 e validação segura
- [x] Expor leitura e atualização somente para administradores
- [x] Aplicar a configuração ao feed público em America/Sao_Paulo
- [x] Adicionar campo com loading, erro, sucesso e atualização do feed
- [x] Cobrir limites, permissões, timezone e reatividade com Vitest
- [x] Validar migração SQL, TypeScript, build e publicar checkpoint

## Correção da ingestão real de Stories e OCR — sessão atual
- [x] Auditar o caminho Apify, normalização de mídia e processamento OCR/Vision
- [x] Aceitar payloads aninhados de Stories/Destaques sem perder origem, URL ou título
- [x] Processar OCR para Stories/Destaques mesmo quando houver legenda
- [x] Preservar auditoria OCR de mídias visuais e registrar falhas por item sem derrubar o lote
- [x] Adicionar regressões para payload aninhado, origem e regra de OCR
- [x] Validar smoke dry-run, suíte Vitest, TypeScript e build
- [x] Publicar checkpoint com a correção ativa

## Stories reais e edição manual do OCR — sessão atual
- [x] Auditar o fluxo de Stories em produção e o modal de detalhes OCR
- [x] Executar o scraper Apify com o token de produção sem expor credenciais — retorno sanitizado HTTP 403 por limite mensal excedido
- [x] Registrar métricas e validar os resultados reais no painel — bloqueado explicitamente até a quota do Apify ser liberada; nenhum dado real foi inventado
- [x] Adicionar campo de edição manual do OCR no modal
- [x] Persistir a revisão manual com autorização administrativa e payload estrito
- [x] Cobrir edição, salvamento, erro, permissões e extração real com testes
- [x] Validar TypeScript e build; publicação pendente até resolver a quota externa

## Coleta nativa de Stories com browser headless — sessão atual
- [x] Auditar runtime Autoscale, dependências e pipeline atual de Stories
- [x] Verificar viabilidade de acesso a perfis públicos sem sessão humana
- [x] Definir estratégia segura com limites, timeout e fallback explícito
- [x] Decidir não implementar coleta headless no Autoscale por incompatibilidade operacional e bloqueios do Instagram
- [x] Manter a integração Apify existente com OCR/Vision e normalização
- [x] Cobrir e documentar bloqueios, HTML/login, parsing, timeout e regressões do conector atual
- [x] Validar build/deploy e documentar limites operacionais

## Quota do Apify e feedback operacional — sessão atual
- [x] Auditar classificação atual de HTTP 403 e apresentação no dashboard
- [x] Classificar `Monthly usage hard limit exceeded` como quota do provedor
- [x] Manter fallback/mocks ativos no sandbox sem mascarar a causa do erro
- [x] Exibir mensagem operacional clara e sanitizada no histórico e nos alertas
- [x] Cobrir quota, 403 genérico, mocks e regressões com Vitest
- [x] Validar TypeScript, build e publicar checkpoint

## Validação real com nova conta Apify — sessão atual
- [x] Confirmar que o pipeline consome `APIFY_API_TOKEN` e selecionar uma fonte ativa
- [x] Atualizar `APIFY_API_TOKEN` no gerenciador seguro sem expor a chave
- [x] Reiniciar o runtime e confirmar a injeção sem imprimir o segredo
- [x] Executar sincronização real de Stories e registrar HTTP, mídias lidas e duração — HTTP 202 em 3.239 ms; processamento final HTTP 200 em 36.129 ms, `read: 0` porque o dataset real retornou apenas registros de perfil
- [x] Validar o resultado real no painel e cobrir a troca com teste seguro — ingestionRun 7350001 finalizado como `succeeded`, com diagnóstico sanitizado e sem dados inventados
- [x] Publicar checkpoint após a validação técnica; a prova de mídia real ficou registrada como dataset sem Stories parseáveis

## Ingestão assíncrona do Apify — sessão atual
- [x] Auditar endpoints, schema de runs e estratégia compatível com Autoscale
- [x] Implementar disparo curto do Actor com resposta HTTP 202 e runId
- [x] Processar o dataset após conclusão via webhook seguro e idempotente
- [x] Atualizar status, métricas, OCR e persistência do ingestionRun
- [x] Integrar estados `queued`/`running` ao painel administrativo
- [x] Cobrir sucesso de despacho, token inválido, falha do Actor e duplicidade
- [x] Validar TypeScript, testes focados e build final; prova pública V2 executada após publicação

## Actor específico para Stories — sessão atual
- [x] Verificar Actors disponíveis e o contrato real de Stories/Destaques
- [x] Ajustar Actor e payload sem inventar parâmetros não suportados
- [x] Atualizar parser/diagnóstico para URLs diretas de mídia
- [x] Executar nova varredura assíncrona em fonte ativa
- [x] Validar dataset e ingestionRun com contagens e URLs sanitizadas — dataset real retornou apenas metadados de perfil, sem URLs de Story
- [x] Cobrir a configuração com testes, build e publicar checkpoint; a ausência de mídia real permanece diagnosticada

## Dataset real de 37 Stories — sessão atual
- [x] Auditar o schema `type: story` e os campos de mídia/data/fonte
- [x] Mapear `mediaUrl`/`thumbnailUrl`, `username`, `postedAt` e `expiresAt`
- [x] Associar Stories às fontes cadastradas sem criar vínculos por aproximação insegura
- [x] Processar o dataset assíncrono com OCR Vision e persistência normalizada
- [x] Cobrir vídeo, imagem, datas, expiração, fonte desconhecida e OCR sem texto
- [x] Confirmar contagens reais no `ingestionRun`, validar testes/build e publicar checkpoint

## Revisão manual de Stories filtrados — sessão atual
- [x] Auditar o histórico de rejeições, motivos e fluxo atual de OCR
- [x] Expor Stories filtrados com motivo sanitizado e autorização administrativa
- [x] Implementar aprovação manual com atualização otimista e feedback
- [x] Reestruturar modal OCR com imagem original e texto lado a lado
- [x] Permitir edição manual preservando texto bruto e revisão atual
- [x] Cobrir aprovação, erro, permissões, imagem ausente e responsividade
- [x] Validar testes, TypeScript e build; checkpoint pendente

## Aplicação de pasted_content_2.txt — sessão atual
- [x] Ler e classificar o conteúdo anexado — prompt classificado como proposta de reescrita monorepo em Next.js/FastAPI/PostgreSQL
- [x] Mapear recomendações aplicáveis ao WeekendVibes — paginação, filtros e fallback de API já estão cobertos pela arquitetura React/Vite + Express/tRPC atual
- [x] Implementar mudanças compatíveis sem sobrescrever trabalho existente — mantida a stack atual; não aplicada a migração destrutiva para outra arquitetura
- [x] Adicionar ou atualizar testes necessários — adicionados testes de filtro, paginação, contrato tRPC e auditoria sanitizada
- [x] Validar TypeScript, build e publicar checkpoint se houver alteração funcional — 409 testes, TypeScript e build aprovados; checkpoint 62d08d36 publicado

## Stories filtrados — paginação e auditoria
- [x] Implementar consulta administrativa paginada com filtro de motivo sincronizado na URL
- [x] Exibir metadados de aprovação (approvedBy/approvedAt) na interface
- [x] Cobrir filtro, paginação e contrato de auditoria com Vitest
- [x] Validar testes completos, TypeScript, build e checkpoint final

## Stories filtrados — exportação, filtros e detalhe
- [x] Auditar contratos, helpers de banco, painel e testes existentes
- [x] Implementar filtros backend por motivo, fonte, status e período
- [x] Implementar exportação CSV via endpoint tRPC com geração no servidor
- [x] Implementar histórico completo de OCR e trilha de aprovação
- [x] Integrar filtros URL, exportação e detalhe na interface
- [x] Adicionar cobertura Vitest para CSV, filtros, query params e auditoria
- [x] Validar suíte completa, TypeScript, build, preview e publicar checkpoint

## Stories filtrados — ordenação, JSON e histórico paginado
- [x] Auditar contratos e persistência atuais
- [x] Definir schemas e consultas de ordenação e auditoria
- [x] Implementar exportação JSON server-side no tRPC
- [x] Implementar ordenação por data, fonte e status sincronizada na URL
- [x] Implementar endpoint tRPC paginado para histórico por storyId
- [x] Integrar ordenação, JSON e histórico paginado no React
- [x] Adicionar cobertura Vitest para ordenação, JSON e paginação
- [x] Validar suíte completa, TypeScript, build, preview e publicar checkpoint

## Stories filtrados — ordenação composta, paginação configurável e jobs assíncronos
- [x] Auditar contratos, estado do painel e limites do runtime
- [x] Definir gerenciador de jobs em memória e schemas Zod estritos
- [x] Implementar ordenação composta no backend e na URL
- [x] Implementar tamanhos de página para listagem e auditoria
- [x] Implementar mutation, status e download para exportação assíncrona
- [x] Integrar polling, progresso e download no React
- [x] Adicionar cobertura Vitest para ordenação e isolamento dos jobs
- [x] Validar suíte completa, TypeScript, build, preview e publicar checkpoint

## Jobs de exportação persistentes e ordenação drag-and-drop
- [x] Auditar schema, storage, heartbeat e contratos existentes
- [x] Definir schema persistente e contratos tRPC de jobs
- [x] Implementar persistência de estado/progresso/metadados em banco e storage
- [x] Implementar cancelamento manual e limpeza/expiração de jobs e arquivos
- [x] Implementar drag-and-drop da ordenação composta sincronizada na URL
- [x] Adicionar controles React de cancelamento e limpeza
- [x] Adicionar testes de persistência, cancelamento, limpeza e ordenação visual
- [x] Validar migração, suíte completa, TypeScript, build, preview e publicar checkpoint

## Resiliência e histórico de exportações
- [x] Auditar heartbeat, schema de jobs, storage e contratos atuais
- [x] Definir recuperação, deleção física e histórico tRPC
- [x] Implementar worker de recuperação de jobs órfãos
- [x] Implementar deleção física assíncrona e limpeza idempotente
- [x] Implementar histórico de exportações filtrável por owner, formato, status e período
- [x] Integrar histórico e filtros sincronizados na URL no React
- [x] Adicionar testes de worker, storage, queries tRPC e filtros
- [x] Validar preview, scheduler, suíte completa, TypeScript, build e publicar checkpoint

## Recuperação e histórico de jobs de exportação
- [x] Auditar estado atual e contratos persistentes
- [x] Consolidar schema Drizzle com leases e fileDeletePending
- [x] Implementar worker Heartbeat de recuperação de jobs órfãos
- [x] Implementar cancelamento e expiração com marcação fileDeletePending
- [x] Implementar limpeza lógica e histórico filtrável no tRPC
- [x] Integrar histórico visual e filtros URL no React
- [x] Adicionar testes de leases, recuperação e deleção pendente
- [x] Validar migração, suíte completa, TypeScript, build, preview e publicar checkpoint

## Orquestração e observabilidade de exportações
- [x] Auditar schedules, Heartbeat, schema e alertas existentes
- [x] Definir arquitetura de cron, fila fileDeletePending e alertas
- [x] Configurar schedule do Heartbeat de recuperação em intervalo de 1–5 minutos
- [x] Implementar fila reprocessável de deleção pendente
- [x] Implementar métricas de leases, tentativas e jobs órfãos
- [x] Implementar alertas operacionais com deduplicação/cooldown
- [x] Adicionar testes de fila, métricas e gatilhos
- [x] Validar schedule, suíte completa, TypeScript, build, preview e publicar checkpoint

## Dashboard operacional de jobs de exportação
- [x] Auditar métricas, alertas, schedule e layout administrativo
- [x] Definir consultas tRPC e regra de crescimento da fila fileDeletePending
- [x] Implementar alerta deduplicado de crescimento anômalo da fila
- [x] Construir dashboard com leases, órfãos, tentativas e fila pendente
- [x] Adicionar testes de métricas, alerta e dashboard
- [x] Validar TypeScript, suíte completa, preview e publicar checkpoint

## Observabilidade visual e governança de jobs
- [x] Auditar métricas, alertas, configurações e layout atuais
- [x] Definir schemas e contratos tRPC para tendências e governança
- [x] Implementar séries históricas da fila e leases
- [x] Implementar detalhe de alerta com jobs afetados e timeline de recuperação
- [x] Implementar configuração de severidade e limiares por ambiente
- [x] Construir gráficos, detalhe e controles no React
- [x] Adicionar testes de métricas, regras, configurações e estados visuais
- [x] Validar TypeScript, suíte, preview e publicar checkpoint

## Drill-down e governança de alertas
- [x] Auditar schemas, queries, alertas e dashboard existentes
- [x] Definir schemas Zod e contratos tRPC de drill-down e auditoria
- [x] Implementar recortes temporais de jobs/alertas e métricas estatísticas
- [x] Persistir histórico de alterações das regras com openId e timestamp
- [x] Integrar drill-down dos gráficos no React
- [x] Exibir taxa de resolução e idade média dos incidentes
- [x] Adicionar testes de tempo, auditoria e métricas
- [x] Validar TypeScript, suíte, preview e publicar checkpoint

## Snapshots e exportações de governança
- [x] Auditar schemas, métricas, alertas e exportações atuais
- [x] Definir schema append-only de snapshots e contratos tRPC
- [x] Implementar persistência de snapshots com limiares e decisão calculados
- [x] Implementar drill-down temporal de eficiência e taxa de resolução
- [x] Implementar exportação CSV/JSON de timelines e governança
- [x] Integrar drill-down e exportações no React
- [x] Adicionar testes de snapshots, recortes e rotas de exportação
- [x] Validar TypeScript, suíte, preview e publicar checkpoint

## Exportações grandes, comparação e rastreabilidade M2M
- [x] Auditar contratos, jobs, métricas, snapshots e Heartbeat
- [x] Definir schemas Zod e contratos tRPC da extensão
- [x] Estender exportação assíncrona para timelines de alertas e governança
- [x] Implementar comparação de dois buckets com deltas percentuais
- [x] Persistir heartbeatExecutionId em snapshots M2M
- [x] Integrar comparação e progresso de exportação no React
- [x] Adicionar testes de buckets, heartbeat e exportação assíncrona
- [x] Validar TypeScript, suíte, preview e publicar checkpoint

## Governança M2M e comparação expandida
- [x] Auditar snapshots, Heartbeat, comparação, jobs e modal de alertas
- [x] Definir schemas Zod e endpoints tRPC da nova governança
- [x] Implementar histórico detalhado das execuções M2M por snapshot
- [x] Expandir comparação com idade média e leases expiradas
- [x] Implementar exportação assíncrona contextual de alerta/timeline
- [x] Integrar histórico, comparação e exportação no React
- [x] Adicionar testes de deltas e vinculação M2M
- [x] Validar TypeScript, suíte, preview e publicar checkpoint

## Observabilidade dedicada do Heartbeat
- [x] Auditar Heartbeat, snapshots, jobs, alertas e rotas atuais
- [x] Definir schemas Zod e contratos tRPC da observabilidade M2M
- [x] Implementar timeline completa por heartbeatExecutionId
- [x] Implementar exportação assíncrona filtrada por execução
- [x] Implementar alertas de falha e duração anormal com cooldown
- [x] Construir tela dedicada e controles no React
- [x] Adicionar testes de timeline, filtro de exportação e duração
- [x] Validar TypeScript, suíte, build, preview e publicar checkpoint

## Timeline e saúde dedicada do Heartbeat — sessão atual
- [x] Sincronizar estado compartilhado e auditar arquivos atuais
- [x] Criar tabela Drizzle heartbeatExecutionEvents e migração segura
- [x] Definir configurações auditáveis de saúde do Heartbeat
- [x] Adicionar schemas Zod estritos para timeline, resumo, exportação e limiares
- [x] Implementar namespace heartbeat no tRPC
- [x] Estender jobs persistentes com exportação heartbeat-timeline
- [x] Registrar eventos e avaliar falhas/duração no handler M2M
- [x] Adicionar testes backend de contratos, paginação, exportação e alertas
- [x] Construir tela React dedicada com filtros sincronizados na URL
- [x] Validar suíte, TypeScript, build, preview e publicar checkpoint

## Evolução estatística e governança do Heartbeat — sessão atual
- [x] Auditar timeline, configurações auditáveis e eventos persistidos atuais
- [x] Definir schemas Zod e contratos tRPC para filtros, governança e estatísticas
- [x] Implementar filtros eventType/período sincronizados na URL via contrato
- [x] Expor histórico de alterações dos limiares com openId e timestamp
- [x] Implementar agregação de sucesso, P95 e incidentes por período
- [x] Construir controles React, cards executivos e gráficos de tendência
- [x] Adicionar testes de P95, queries agregadas e filtros da timeline
- [x] Validar suíte, TypeScript, build, preview e publicar checkpoint

## Comparação e degradação estatística do Heartbeat — sessão atual
- [x] Auditar contratos, helpers e jobs atuais do Heartbeat
- [x] Definir schemas Zod e contratos tRPC de comparação e exportação
- [x] Implementar comparação entre dois períodos com deltas absolutos e percentuais
- [x] Implementar exportação assíncrona CSV/JSON das métricas agregadas
- [x] Implementar limiares e alertas de queda de sucesso e aumento de P95
- [x] Construir interface comparativa lado a lado e progresso de exportação
- [x] Adicionar testes comparativos, exportação e alertas configuráveis
- [x] Validar suíte, TypeScript, build, preview e publicar checkpoint

## Regressão temporal e governança do Heartbeat — sessão atual
- [x] Auditar contratos de saúde, comparação, snapshots e jobs atuais
- [x] Apresentar schemas Zod e contratos tRPC de exportação/regressão
- [x] Implementar exportação assíncrona do histórico de limiares
- [x] Implementar regressão percentual e alerta heartbeat_period_regression
- [x] Persistir snapshot com cooldown e deduplicação da regressão
- [x] Construir sobreposição gráfica A/B para sucesso e P95
- [x] Sincronizar estado da sobreposição na URL
- [x] Adicionar exportação no histórico de governança
- [x] Adicionar testes de regressão, alertas e exportação
- [x] Validar suíte, TypeScript, build, preview e publicar checkpoint

## Incidentes e filtros avançados do Heartbeat — sessão atual
- [x] Auditar contratos atuais de saúde, incidentes e jobs persistentes
- [x] Apresentar schemas Zod e contratos tRPC antes do React
- [x] Adicionar warningRegressionPct e criticalRegressionPct aos limiares
- [x] Implementar heartbeat.incidents.listByRegression paginado
- [x] Filtrar exports por environment e adminOpenId
- [x] Construir edição visual de limiares de regressão
- [x] Exibir incidentes causadores no detalhe de regressão
- [x] Sincronizar filtros de exportação na URL
- [x] Adicionar testes de limiares, incidentes e exportação filtrada
- [x] Validar suíte, TypeScript, build, preview e publicar checkpoint

## Correção de overflow visual do painel — sessão atual
- [x] Auditar gráficos, legendas, tooltips, cards e tabelas afetados
- [x] Conter legendas com max-height e overflow-y
- [x] Truncar nomes longos com ellipsis sem quebra desordenada
- [x] Isolar gráficos e tooltips com position, z-index e min-width adequados
- [x] Adicionar overflow-x responsivo às tabelas e flex items com min-width: 0
- [x] Validar visualmente e executar testes/build do Vite

## Saneamento de ingestão e reconciliação — sessão atual
- [x] Auditar worker/orquestrador, métricas, alertas e testes afetados
- [x] Propagar routineName/source correto em alertas de persistência
- [x] Mapear todos os motivos conhecidos de descarte na reconciliação
- [x] Garantir a equação read = persisted + all_known_skipped
- [x] Ignorar past_event legítimo no alerta de divergência
- [x] Atualizar testes Vitest de reconciliação e alertas
- [x] Validar backend, suíte Vitest, TypeScript e build

## Edição visual do logotipo — sessão atual
- [x] Auditar o JSX aplicado em Home.tsx
- [x] Garantir Weekend e ibes em branco, com W e V preservados na cor de destaque
- [x] Validar preview e criar checkpoint

## Consistência do logotipo no rodapé — sessão atual
- [x] Auditar SiteFooter e tokens de tema
- [x] Aplicar Weekend/ibes em branco no tema escuro e escuros no tema claro, preservando W/V em destaque
- [x] Adicionar transição sutil de hover com foco acessível
- [x] Validar temas, responsividade e publicar checkpoint

## Ajuste manual do tema claro — sessão atual
- [x] Auditar Home.tsx, ThemeContext e tokens de tema
- [x] Corrigir contraste e acabamento visual da aba clara
- [x] Validar tema claro, build e publicar checkpoint

## Contraste adaptativo de TodayEvents e EventCard — sessão atual
- [x] Auditar TodayEvents, EventCard e tokens de tema
- [x] Aplicar variantes claras a textos, cards, badges e estados vazios
- [x] Validar testes, build, preview e publicar checkpoint

## Investigação de ingestão parcial do Instagram — sessão atual
- [x] Revisar orientações operacionais e o estado restaurado
- [x] Inspecionar logs, runs e registros recentes da ingestão
- [x] Identificar fonte, rejectionReason e erro exato do Apify/backend
- [x] Correlacionar a falha com a configuração da fonte
- [x] Entregar diagnóstico e recomendação sem alterar a interface

## Resiliência do Apify e fallback Vision — sessão atual
- [x] Auditar timeout, classificação de erros, normalização e testes atuais
- [x] Parametrizar timeout seguro do dispatch do Apify
- [x] Diferenciar actor_timeout de falha individual de perfil
- [x] Usar thumbnailUrl como fallback visual para Stories em vídeo
- [x] Garantir injeção da thumbnail no pipeline Vision
- [x] Atualizar testes e validar TypeScript, suíte e build backend

## Resiliência do Apify e fallback Vision — sessão atual
- [x] Auditar timeout, classificação de erros, normalização e testes atuais
- [x] Parametrizar timeout seguro do dispatch do Apify
- [x] Diferenciar actor_timeout de falha individual de perfil
- [x] Usar thumbnailUrl como fallback visual para Stories em vídeo
- [x] Garantir injeção da thumbnail no pipeline Vision
- [x] Atualizar testes e validar TypeScript, suíte e build backend

## Reprocessamento OCR no detalhe — sessão atual
- [x] Auditar modal, contratos OCR e auditoria persistente
- [x] Implementar mutation tRPC de reprocessamento com retorno estrito
- [x] Persistir o novo resultado e registrar auditoria
- [x] Adicionar botão, loading, feedback e atualização no modal
- [x] Validar suíte Vitest existente (450 testes), TypeScript, build e preview

## README e thumbnail no modal OCR — sessão atual
- [x] Auditar README existente e modal de auditoria OCR
- [x] Criar README.md completo na raiz do projeto
- [x] Exibir thumbnailUrl no modal de auditoria OCR quando disponível
- [x] Rodar Vitest e build do frontend, confirmar ausência de regressões e publicar checkpoint

## Cadastro de novas fontes — sessão atual
- [x] Auditar seção Governança da Ingestão, schema e procedure de fontes
- [x] Adicionar botão e formulário/modal de Nova Fonte
- [x] Persistir nova fonte pela rota/procedure existente ou nova
- [x] Atualizar lista e exibir toast após sucesso
- [x] Validar fluxo, suíte Vitest, TypeScript e build; publicar checkpoint

## Autenticação M2M da ingestão Instagram — sessão atual
- [x] Auditar middleware de cron e handler `/api/scheduled/ingest-instagram`
- [x] Aceitar `x-cron-secret` válido como autenticação alternativa ao cookie
- [x] Atualizar o script de disparo M2M com cookie quando disponível
- [x] Adicionar testes de header válido, inválido e cookie legado
- [x] Rodar Vitest, TypeScript e build; publicar checkpoint

## Validação M2M publicada — sessão atual
- [x] Adicionar log sanitizado distinguindo autenticação por header e cookie
- [x] Validar chamada M2M real: alias `/api/scheduled/ingest-instagram` retornou 403, enquanto `/api/v2/ingestion/instagram/async` retornou HTTP 202
- [x] Atualizar testes; publicar checkpoint após validação real

## Execução M2M pela rota v2 — sessão atual
- [x] Atualizar o script sanitizado para `/api/v2/ingestion/instagram/async`
- [x] Validar presença dos segredos sem expor valores
- [x] Executar POST M2M e capturar status, duração e contagens sanitizadas

## Atualização automática do painel de ingestão — sessão atual
- [x] Auditar polling de jobs e queries de eventos do painel
- [x] Atualizar automaticamente as queries após conclusão do job assíncrono
- [x] Evitar timers duplicados e preservar estados de loading/erro
- [x] Adicionar testes e validar TypeScript, build e preview

## Saneamento Articket e reconciliação — sessão atual
- [x] Auditar scraper public:articket, reconciliação, métricas P95 e testes
- [x] Separar timeout/falha de transporte de itens filtrados
- [x] Corrigir a equação de reconciliação para Articket
- [x] Tratar timeout e latência específica sem mascarar métricas
- [x] Atualizar testes do pipeline e alertas
- [x] Validar Vitest, TypeScript, build e publicar checkpoint

## Verificação de atualização automática — sessão atual
- [x] Auditar o polling e a atualização dos eventos após job assíncrono
- [x] Corrigir eventual lacuna sem duplicar timers
- [x] Validar o fluxo e entregar o resultado

## Extração flexível e revisão manual — sessão atual
- [x] Auditar prompt, triagem, modelos de pendência e testes
- [x] Ajustar prompt para datas relativas e contexto de perfil
- [x] Preservar eventos com título, data e local em revisão manual
- [x] Atualizar tipagens e fluxo de pendências sem alterar reconciliação central
- [x] Adicionar testes de extração flexível e classificação manual
- [x] Validar Vitest, TypeScript, build e publicar checkpoint

## Fila de revisão manual — sessão atual
- [x] Auditar modelo, routers, painel e métricas existentes
- [x] Implementar query e mutation para listar/editar/aprovar pendências
- [x] Construir fila e edição assistida no painel React
- [x] Separar cards de eventos publicados e aguardando revisão
- [x] Adicionar testes de contratos, formulário e aprovação
- [x] Validar Vitest, TypeScript, build e publicar checkpoint

## Fila de revisão manual — sessão atual
- [x] Expor no Admin a fila de eventos com status manual review/pending
- [x] Implementar edição assistida dos campos incompletos e aprovação/publicação
- [x] Exibir métricas separadas de eventos publicados e aguardando revisão
- [x] Sincronizar filtros da fila com parâmetros da URL
- [x] Adicionar testes Vitest do contrato e da interação da fila de revisão manual
- [x] Validar TypeScript, build, suíte Vitest e preview antes do checkpoint

## Seleção em massa da fila manual — sessão atual
- [x] Adicionar mutations tRPC e helpers de banco para aprovar/rejeitar IDs em lote
- [x] Implementar checkbox individual, selecionar todos e barra de ações em massa
- [x] Adicionar confirmação, loading, feedback e revalidação para as ações em lote
- [x] Cobrir contratos e interação da seleção em massa com Vitest
- [x] Validar TypeScript, build, suíte e responsividade antes do checkpoint

## Saneamento operacional de alertas e fontes — sessão atual
- [x] Auditar contratos e persistência de alertas, fontes e Circuit Breaker
- [x] Implementar mutation segura para resolver/arquivar alertas obsoletos por corte temporal
- [x] Implementar reset administrativo do Circuit Breaker e freshness das fontes ativas
- [x] Integrar controles no painel com confirmação, loading, feedback e revalidação
- [x] Adicionar testes de autorização, saneamento, reset e atualização de freshness/reconciliação
- [x] Validar TypeScript, Vitest, build e preview antes do checkpoint

## Verificação da Fila de Revisão Manual — sessão atual
- [x] Confirmar integração da fila, edição assistida, aprovação e métricas separadas no Admin
- [x] Validar TypeScript, Vitest, build e publicar checkpoint da versão verificada

## Prévia lado a lado da revisão manual — sessão atual
- [x] Adicionar painel de texto bruto OCR/legenda no modal de edição assistida
- [x] Ajustar layout responsivo para split view no desktop e composição vertical no mobile
- [x] Cobrir a prévia e o layout com testes Vitest
- [x] Validar TypeScript, Vitest, build, preview e publicar checkpoint

## Destaque e cópia do texto bruto — sessão atual
- [x] Destacar horários, datas e dias da semana no texto bruto OCR/legenda
- [x] Adicionar botão Copiar texto original com feedback acessível
- [x] Cobrir parsing, cópia, feedback e responsividade com Vitest
- [x] Validar TypeScript, Vitest, build, preview e publicar checkpoint

## Resiliência de ingestão — 11/09
- [x] Auditar adapters public:ingresse e instagramApify:actor-run-cookie, timeouts e autenticação
- [x] Melhorar diagnóstico de 403 e cookies expirados sem mascarar falhas
- [x] Implementar fail-fast e limites de execução controlados para proteger a fila
- [x] Adicionar testes de regressão para 403, cookies, timeout e reconciliação
- [x] Validar TypeScript, Vitest, build e publicar checkpoint
