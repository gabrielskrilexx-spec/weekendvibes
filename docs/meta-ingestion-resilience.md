# Resiliência da ingestão oficial da Meta

A ingestão oficial continua usando exclusivamente a Graph API da Meta e não cria eventos quando o upstream está indisponível. Falhas identificadas por HTTP 401, 403, 408, 429, 500, 502, 503 ou 504 são tratadas como degradação controlada no callback agendado: o sistema persiste um alerta operacional, registra o status redigido e responde HTTP 200 com `degraded: true`, `error: "upstream_unavailable"`, o status upstream e `imported: 0`. Isso evita que um erro transitório de fornecedor provoque retries ou marque o callback como falha de transporte.

Falhas internas sem status HTTP conhecido continuam respondendo HTTP 500, com `error: "internal_error"`, alerta operacional e logs redigidos. Chamadas sem identidade cron continuam respondendo HTTP 403. Nenhum token, cookie, corpo do upstream ou stack trace é retornado ao cliente.

A política foi coberta por testes para degradação Meta HTTP 503, preservação de HTTP 500 em erro interno, autenticação cron e execução normal. A validação local passou com TypeScript, build, `git diff --check` e 152 testes Vitest.
