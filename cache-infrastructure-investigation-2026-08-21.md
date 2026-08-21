# Investigação de cache-busting de infraestrutura — 2026-08-21

Foram inspecionados `manus-config --help`, `manus-tools --help`, os wrappers disponíveis e o arquivo de metadados do projeto. O ambiente expõe ferramentas de configuração, schedules, logs, uploads e renderização, mas não expõe CLI ou endpoint documentado para purge de CDN, edge invalidation ou redeploy independente do checkpoint.

Não foram encontrados os executáveis `manus-deploy`, `manus-cache`, `manus-publish` ou `manus-webdev-publish`. Também não foi acessado nem impresso qualquer valor de arquivo de ambiente. A ação segura disponível continua sendo criar checkpoint/restart, já executada anteriormente; a edge pública segue retornando a versão antiga.
