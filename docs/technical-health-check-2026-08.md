# Auditoria técnica e health check — WeekendVibes

**Data:** 18 de agosto de 2026  
**Escopo:** frontend, integração Google Maps, ingestão, rotas tRPC, segurança operacional, acessibilidade, testes e build.

## Resumo executivo

A auditoria encontrou dois defeitos concretos no ciclo de vida e na interação do mapa. O índice usado para localizar markers armazenava IDs de eventos, enquanto as rotinas de seleção e atualização procuravam IDs de clusters; como consequência, a seleção de uma região poderia não reabrir ou atualizar o InfoWindow correto. O loader singleton também mantinha polling e timeout ativos após a resolução ou rejeição da carga, criando timers transitórios desnecessários.

Ambos os problemas foram corrigidos e receberam cobertura unitária de regressão. A revisão também confirmou que o projeto já possui boundary global, fallback específico do mapa, estados de carregamento, reconexão offline, CORS estrito, cabeçalhos de segurança, redação de erros, schemas Zod nas entradas administrativas e ausência de segredos sensíveis no bundle client-side.

## Achados e correções

| Pilar | Achado | Ação | Status |
|---|---|---|---|
| Google Maps / interação | `clusterMarkersRef` era indexado por `event.id`, mas consultado por `cluster.id` | O índice passou a armazenar o primeiro marker por ID de cluster através de `indexFirstClusterMarker` | Corrigido |
| Google Maps / ciclo de vida | O polling iniciado no `script.onload` e o timeout de 15 segundos não eram cancelados em todos os caminhos de término | O loader agora mantém referências aos timers e os limpa na rotina comum de finalização | Corrigido |
| Tratamento de erros | Falhas de inicialização do mapa, offline e retry já possuíam fallback visual e alternativa “Ver em Lista” | Fluxo revisado; não foi necessária nova alteração | Validado |
| Tipagem | A auditoria não encontrou `any` em código de produção do client/server que exigisse correção; casts locais do evento de mapa são delimitados por interfaces mínimas | Mantida a tipagem atual e adicionada função genérica testável para o índice de markers | Validado |
| Segurança | Segredos de Meta, banco, JWT, Discord e OpenAI não aparecem em `client/src`, `client/index.html` ou `client/public` | Nenhum segredo exposto foi encontrado | Validado |
| Payloads | Entradas administrativas e CRUD de eventos passam por schemas Zod com limites, enums e coerções controladas | Nenhum endpoint sem validação relevante foi identificado na revisão | Validado |

## Controles verificados

O `ErrorBoundary` global impede telas brancas causadas por exceções de renderização. As chamadas tRPC consumidas pela interface possuem estados de carregamento e erro, e o mapa dispõe de skeleton, fallback, aviso offline, reconexão automática com backoff e acesso imediato à lista.

No mapa, listeners de conectividade, observador de viewport, timers de retry e aviso de reconexão são desmontados. O mapa regional remove markers e limpa o clusterer quando filtros mudam ou o componente é desmontado. A correção desta auditoria completa a limpeza do loader singleton, que também passou a cancelar seu polling e timeout internos.

Os controles de segurança verificados incluem CORS por allowlist, rate limiting por instância, CSP, HSTS em produção HTTPS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy` e redação de erros operacionais.

A interface mantém touch targets de pelo menos 44 pixels nos controles críticos do mapa, InfoWindows e filtros. Os estados remotos utilizam skeletons e as imagens têm carregamento lazy, `srcset`/`sizes` e `decoding="async"` quando apropriado.

## Melhorias arquiteturais recomendadas

A proteção de rate limiting em memória deve continuar sendo tratada como uma camada local, não como substituta de WAF ou limitação distribuída no edge em ambiente de múltiplas instâncias. Recomenda-se também centralizar contratos externos em schemas versionados e adicionar testes de contrato para respostas da Meta, Routes API e relay do Maps.

Para evolução do frontend, recomenda-se separar o controlador de ciclo de vida do Google Maps em um hook ou serviço dedicado, com uma máquina de estados explícita (`idle`, `loading`, `ready`, `offline`, `error`, `retrying`). Isso reduziria a complexidade do componente visual sem alterar o comportamento já validado.

Para observabilidade, recomenda-se acompanhar contadores de retry, duração de reconexão, uso do fallback “Ver em Lista” e falhas de geolocalização no painel administrativo, sempre sem registrar tokens, cookies ou IPs não anonimizados.

## Validação

| Verificação | Resultado |
|---|---:|
| TypeScript (`pnpm check`) | Aprovado |
| Vitest | 55 arquivos, 165 testes aprovados |
| Playwright E2E headless | 7 testes aprovados |
| Build de produção | Aprovado |
| `git diff --check` | Aprovado |
| Teste de regressão do índice de markers por cluster | Aprovado |

## Conclusão

O health check não identificou exposição de credenciais, falhas críticas de payload ou regressões de acessibilidade nos caminhos auditados. Os dois defeitos concretos encontrados foram corrigidos, documentados e cobertos por testes. A plataforma está pronta para o próximo checkpoint, permanecendo recomendável executar monitoramento contínuo das métricas de retry e fallback em produção.
