## Cover
WeekendVibes
Status operacional do painel administrativo e da esteira de ingestão
25 de agosto de 2026 · Baixada Santista

## Slide 1
Panorama executivo
- O painel administrativo concentra monitoramento, auditoria, Dry-run, revisão de colisões e controles de ingestão.
- A vitrine pública permanece enxuta; metadados operacionais ficam restritos à administração.
- A versão mais recente está sincronizada no GitHub na branch `main` pelo commit `42397e1`.
- O último Dry-run confirmou persistência zero e revelou um bloqueio pontual no Ingresse.

## Slide 2
O painel já cobre o ciclo operacional
- Dry-run interativo com relatório segregado por fonte, loading, duração, mediana, p95 e erros expansíveis.
- Auditoria de ingestionRuns com métricas de leitura, filtragem, persistência, retries e trigger.
- Revisão manual de colisões com exclusão transacional, confirmação e mensagens tRPC sanitizadas.
- Circuit Breaker com estados Closed, Half-Open e Open, tooltips e alertas opcionais via webhook.

## Slide 3
A arquitetura de fontes está diversificada
- Instagram: leitura oficial de perfis, classificação de eventos e degradação controlada para falhas de transporte.
- Black Pass: catálogo JSON público e rotas `/event/{id}`.
- Mr Ingressos: listagem `/eventos`, rotas `/comprar/{id}/{slug}`, concorrência limitada e retry seletivo de timeout.
- Ingresse, Articket, Blacktag e Zig Tickets: adaptadores públicos com parsing estruturado, allowlist e validação temporal.

## Slide 4
O Dry-run preserva segurança operacional
- Executa coleta, parsing, allowlist, data, deduplicação e geocodificação sem chamar `saveEvent`.
- Não grava eventos, cache, alertas, circuit breaker ou `ingestionRuns`.
- Exibe o que seria persistido, mas mantém a persistência real em zero.
- Erros são sanitizados e isolados por fonte para evitar o falso sucesso de um HTTP 200 genérico.

## Slide 5
Último Dry-run: volume e resultado
- 308 candidatos lidos; 259 filtrados; 6 elegíveis para persistência; 0 duplicidades.
- 1 erro sanitizado; duração total de 48,6 s.
- Instagram: 200 lidos, 165 filtrados, 1 elegível, 33,4 s.
- Articket: 62 lidos, 54 filtrados, 0 elegíveis, 95,0 s; Blacktag: 20/20/0, 31,9 s.

## Slide 6
Último Dry-run: fontes críticas
- Black Pass: 4 lidos, 3 filtrados, 1 elegível, sem erro, 12,7 s.
- Mr Ingressos: 16 lidos, 15 filtrados, 0 elegíveis, sem erro, 34,1 s; 11 fora da allowlist e 4 inválidos.
- Ingresse: 6 lidos, 2 filtrados, 4 elegíveis, 14,4 s; a home respondeu HTTP 403.
- Diagnóstico: os eventos acessíveis do Ingresse foram processados, mas a origem bloqueada deve ser acompanhada pelo alerta recorrente.

## Slide 7
Prioridades imediatas
- Investigar a recorrência do HTTP 403 do Ingresse e acompanhar o alerta externo por fonte.
- Medir a taxa de sucesso do retry do Mr Ingressos e ajustar o timeout somente com evidência operacional.
- Acompanhar mediana e p95 no painel para identificar regressões de latência.
- Usar o Dry-run antes de alterações de allowlist ou novas fontes para validar impacto sem risco de poluir o banco.

## Slide 8
Conclusão
Operação preparada para diagnóstico seguro e evolução contínua
Dry-run, auditoria e resiliência agora trabalham no mesmo fluxo
