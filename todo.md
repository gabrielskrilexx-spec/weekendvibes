
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
