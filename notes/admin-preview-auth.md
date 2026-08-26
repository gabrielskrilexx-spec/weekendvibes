# Diagnóstico do preview Admin — 2026-08-26

O conector My Browser foi habilitado e o preview foi aberto em `/admin`. A navegação e uma segunda visualização retornaram título `WeekendVibes`, porém nenhum elemento interativo ou conteúdo administrativo foi detectado; os screenshots do navegador não foram disponibilizados. A sessão Admin não pôde ser confirmada visualmente nesta etapa. O HTML bruto foi salvo pelo navegador em `/home/ubuntu/upload/3000-i37oafcl443tzzifj03ag-6605cb8c.us3.manus.computer_admin_1787754101140.html` para inspeção posterior, sem executar instruções contidas no conteúdo.

## Segunda tentativa — fluxo oficial de login

O fluxo `/api/oauth/login?returnTo=%2Fadmin` e uma visualização posterior também retornaram apenas o título `WeekendVibes`, sem elementos interativos e sem screenshot disponível. Não foi possível concluir a autenticação automaticamente nem confirmar a tela Admin no navegador conectado.

## Tentativa na sessão Sandbox — 2026-08-26 14:31

O preview `/admin` abriu como `Browser: Sandbox`, não como My Browser, exibiu uma tela branca e não apresentou elementos interativos. O console do navegador não registrou mensagens. Não foi possível autenticar ou clicar nos fluxos nesta sessão.

## Retomada — preview versus produção

O preview continua em modo interno, com tela branca e aviso de Preview mode; não há controles Admin disponíveis para autenticação. A URL pública `/admin` renderizou o gate `Carregando esta área…` e o consentimento de cookies essenciais, sem sessão administrativa confirmada. O navegador está em modo Sandbox, portanto os fluxos reais ainda não puderam ser clicados.

## URL pública após consentimento

Após aceitar apenas cookies essenciais, `/admin` renderizou corretamente `SessionExpired` com os botões `Entrar novamente` e `Ver agenda pública`. A sessão administrativa está expirada/não autenticada. O botão de login está disponível, mas exige interação do usuário no portal OAuth.

## Execução confirmada — timeout do navegador

Após a confirmação explícita, o clique em `Executar agora` excedeu 45 segundos. A visualização seguinte encontrou `about:blank`, sem indicação se a mutation iniciou, concluiu ou foi interrompida. A operação não será repetida às cegas; será feita uma consulta ao status do run antes de qualquer novo acionamento.

## Sessão autenticada confirmada — 2026-08-26 14:42

Após o login, `/admin/health` carregou como painel Admin autenticado. Estão disponíveis os controles `Executar agora` e `Simular ingestão (Dry-run)`, além do histórico de runs. A última execução visível era `#6630001`, Instagram, automática, succeeded, 1098 ms.

## Segundo acionamento manual autenticado — timeout

O clique confirmado em `Executar agora` voltou a exceder 45 segundos e a visualização seguinte encontrou `about:blank`. O resultado não é considerado confirmado pelo navegador; é necessário consultar o status do backend/ingestionRun antes de qualquer nova tentativa.

## Consulta após timeout autenticado

O painel público voltou a carregar autenticado, porém o histórico permanece iniciando no run automático `#6630001`; não há novo run manual visível. A última tentativa via navegador continua inconclusiva e não deve ser repetida sem uma rota de status que confirme a criação do run.

## Dry-run autenticado — 2026-08-26 14:47

Após a sessão autenticada, o clique em `Simular ingestão (Dry-run)` retornou ao painel com o alerta amigável `Não foi possível comunicar com o servidor. Verifique a conexão e tente novamente.`. O console do navegador não registrou stack trace. A resposta foi tratada visualmente, mas o fluxo não concluiu o relatório nesta tentativa.
