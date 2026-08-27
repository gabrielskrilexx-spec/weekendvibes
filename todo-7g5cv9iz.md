# Project TODO

- [x] Adicionar indicador visual `Sandbox / Mocks` quando fonte ou execução tiver status `SANDBOX_RESTRICTED` na aba Logs em tempo real.
- [x] Adicionar indicador visual `Sandbox / Mocks` quando fonte ou execução tiver status `SANDBOX_RESTRICTED` na aba Telemetria.
- [x] Adicionar indicador visual `Sandbox / Mocks` quando fonte ou execução tiver status `SANDBOX_RESTRICTED` na aba Histórico de Execuções.
- [x] Excluir execuções `SANDBOX_RESTRICTED` do cálculo de Taxa de Sucesso real.
- [x] Exibir métrica/coluna separada para Execuções Simuladas (Sandbox) nos gráficos e na tabela de telemetria.
- [x] Adicionar testes Vitest cobrindo a segregação entre métricas reais e execuções sandbox.
- [x] Executar a suíte Vitest completa e confirmar resultado.
- [x] Executar o build de produção e confirmar resultado.
- [x] Salvar checkpoint publicado com as alterações validadas.
- [x] Adicionar campo explícito `sandboxRestricted` aos logs administrativos para suportar a Badge sem inferência de mensagem.
- [x] Cobrir a Badge de sandbox nas três superfícies administrativas e a segregação da taxa real com testes de regressão.
- [x] Adicionar uma série visual separada de `Execuções Simuladas (Sandbox)` no gráfico de telemetria.
- [x] Adicionar teste de regressão para a Badge `Sandbox / Mocks` na tabela de Histórico de Execuções.
- [x] Isolar a notificação externa no teste de arquivamento agendado para a suíte completa ser determinística.
