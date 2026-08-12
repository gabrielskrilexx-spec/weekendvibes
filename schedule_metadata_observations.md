Fonte consultada: `manus-config schedule status --limit 1000 --offset 0` em 2026-08-12.

Schedule ativo: WeekendVibe — ingestão Instagram
Task UID observado: cNUuCN6HUNZPyksSNfCrME
Cron: 0 0 10 * * 2
Timezone: America/Sao_Paulo
Run mode: full_auto
Status: active
Enabled: true
Última execução observada: 2026-08-12T15:04:27.093Z
Callback publicado: ingestão pública e ingestão Instagram, ambos protegidos por autenticação cron.

Nota: o painel consulta o serviço Heartbeat via `listHeartbeatJobs`; a seleção deve usar o nome exato do schedule, sem regex ou task UID hardcoded. Se o metadata opcional de timezone/runMode não vier na resposta do SDK, o painel deve mostrar ausência de metadata em vez de inventar valores.
