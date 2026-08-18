# Alertas automáticos de freshness e reconciliação

## Objetivo

O monitor `monitor-heartbeat` agora avalia automaticamente a saúde temporal das fontes habilitadas e registra alertas operacionais quando uma fonte entra em estado `critical`. Os alertas são persistidos na tabela `operationalAlerts`, aparecem no painel administrativo existente e não incluem tokens, payloads brutos ou identificadores pessoais.

## Freshness crítico

Uma fonte somente gera alerta quando o estado calculado é `critical`. Estados `healthy` e `delayed` não geram alerta. O alerta recebe severidade `CRITICAL`, tipo `freshness_critical` e SLA operacional de 60 minutos. A mensagem inclui apenas a chave/nome sanitizado da fonte, a idade aproximada da última sincronização e a frequência esperada.

A avaliação ocorre durante cada execução autenticada do monitor-heartbeat. O fingerprint existente de alertas é usado para evitar duplicação do mesmo incidente em execuções consecutivas.

## Divergências de reconciliação

Ao finalizar uma ingestão que contém o bloco `reconciliation`, o sistema avalia seus códigos de inconsistência. Uma reconciliação consistente sem issues não gera alerta. Divergências de qualidade ou limites de coordenadas recebem `WARNING` com SLA de 240 minutos. Inconsistências estruturais — como `persisted_exceeds_read`, `duplicates_exceeds_persisted` ou eventos persistidos em execução degradada — recebem `CRITICAL` com SLA de 60 minutos.

O alerta registra a fonte/rotina, o `runId` sanitizado e contagens agregadas de `read`, `persisted`, `duplicates`, `missingCoordinates` e `outOfBoundsCoordinates`. Não são persistidos conteúdo de postagens, tokens ou dados de usuários.

## Operação e testes

Os avaliadores são funções puras em `server/operational-alert-rules.ts`, com cobertura para estados não críticos, freshness crítico, divergências de aviso e divergências críticas. O monitor-heartbeat inclui no snapshot o total de fontes avaliadas e alertas disparados na rodada. A deduplicação continua sob responsabilidade do helper de alertas existente.

Recomenda-se revisar semanalmente alertas críticos não resolvidos e ajustar as frequências das fontes somente quando a periodicidade real de ingestão tiver sido confirmada.
