# Reconciliação operacional da ingestão

## Schedule oficial

O schedule configurado **WeekendVibe — ingestão Instagram** foi colocado em pausa para eliminar a execução diária redundante. A rotina oficial permanece o Heartbeat semanal de quarta-feira às 10:00 em `America/Sao_Paulo` (13:00 UTC). A verificação posterior mostrou o schedule redundante com status `pause`; nenhum novo schedule foi criado.

## Reconciliação determinística

Os handlers rastreados de Instagram e fontes públicas agora normalizam o resultado para `read`, `filtered` e `persisted`, mantendo também duplicidades, coordenadas ausentes, coordenadas fora dos limites da Baixada Santista, retries, fallback para lista e `degraded`. A reconciliação não registra conteúdo de posts, tokens, cookies ou identificadores pessoais.

As invariantes verificadas são: `filtered <= read`, `persisted <= read`, `duplicates <= persisted`, e contagens de problemas geográficos não superiores ao lote persistido. Execuções inconsistentes ou com qualidade geográfica abaixo do esperado geram alerta operacional sanitizado.

## Painel administrativo

O relatório restrito agora exibe o **Resumo operacional semanal**, baseado nas execuções dos últimos sete dias: retries, uso do fallback “Ver em Lista”, duplicidades, coordenadas inválidas, execuções degradadas e reconciliações inconsistentes. O resumo é agregado no backend e atualizado junto do relatório existente.

## Validação

Foram aprovados TypeScript, 178 testes Vitest, build de produção e `git diff --check`. A execução E2E deve ser validada antes do checkpoint final; nenhum dado de produção foi inserido ou alterado pela reconciliação durante os testes.
