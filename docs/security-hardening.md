# Relatório executivo de hardening e privacidade

**Projeto:** WeekendVibes  
**Escopo:** APIs Express/tRPC, autenticação OAuth, callbacks agendados, proxy de storage, frontend React/Vite, cookies, analytics e logs.  
**Referências:** [OWASP API Security Top 10](https://owasp.org/API-Security/), [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/), [ANPD — guia de segurança da informação](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guias-e-orientacoes/guia-orientativo-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf).

## Sumário executivo

A plataforma recebeu uma camada de hardening centrada em redução de superfície, respostas genéricas, validação de entrada e minimização de dados no navegador e nos logs. O código não retorna mais stack traces, URLs internas, mensagens brutas de banco ou detalhes de fornecedores nas rotas agendadas, OAuth, storage e transcrição.

A implementação cobre controles aplicáveis no código. Proteções contra DDoS distribuído, terminação TLS, WAF, rotação de segredos, retenção de logs e configuração de domínio continuam sendo responsabilidades da camada de hospedagem e devem ser mantidas no ambiente de produção.

## Vulnerabilidades e medidas mitigadoras

| Área | Risco identificado | Mitigação aplicada | Status |
|---|---|---|---|
| Rate limiting | Abuso de APIs públicas, brute-force e scraping | Limiter por IP para `/api/trpc`, `/api/oauth` e `/manus-storage`, com `429`, `Retry-After` e headers de cota | Mitigado no processo |
| CORS | Origem arbitrária ou wildcard com credenciais | Lista estrita com origens locais e `CORS_ALLOWED_ORIGINS`; preflight não autorizado retorna `403` | Mitigado |
| Inputs | Filtros e campos com limites frouxos | Schemas tRPC com trim, limites, enums, slug, URLs HTTPS, IDs positivos, valores máximos e coordenadas | Mitigado nos contratos revisados |
| Erros | Stack traces e mensagens de infraestrutura expostas | Respostas `internal_error`, `oauth_callback_failed`, `storage_backend_error` e códigos operacionais estáveis | Mitigado |
| Logs | Mensagens com possível token, URL ou exceção | `redactError` registra apenas classe limitada e código estável; callbacks registram integração, não payload sensível | Mitigado nos pontos auditados |
| Browser headers | Clickjacking, MIME sniffing, referrer leakage e permissões excessivas | CSP, HSTS condicional, `nosniff`, `DENY`, Referrer Policy, Permissions Policy e isolamento cross-origin | Mitigado |
| Sessão | Dados de perfil persistidos no navegador | Removida a gravação de `manus-runtime-user-info` no `localStorage`; sessão segue em cookie/fluxo oficial | Mitigado |
| Analytics | Rastreamento antes de consentimento | Script removido do HTML; carregamento somente após aceite explícito | Mitigado |
| Error Boundary | Stack trace no frontend | Tela genérica, acessível e sem detalhes técnicos | Mitigado |

## Security headers

Em produção, o servidor retorna:

| Header | Política |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`, scripts limitados, `frame-ancestors 'none'`, `object-src 'none'`, conexões apenas para origens necessárias |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`, somente em produção quando a requisição está sob HTTPS |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Geolocalização somente para a própria origem; câmera e microfone desativados |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

Em desenvolvimento, a CSP opera como `Content-Security-Policy-Report-Only` para não impedir o fluxo do Vite. O HSTS não é enviado em HTTP local.

## Cookies e consentimento

O cookie de sessão existente permanece `HttpOnly`. Em HTTPS ele usa `Secure` e `SameSite=None`, necessário ao fluxo de preview/embed da plataforma; em HTTP local usa `Secure=false` e `SameSite=Lax`. O estado de consentimento armazena somente uma preferência (`accepted` ou `rejected`) e não contém identidade, token ou dados de evento.

O banner governa analytics não essencial. Cookies e armazenamento de terceiros associados a mapas devem continuar sendo avaliados conforme a configuração do provedor e a política de privacidade publicada. A validação jurídica da base legal, aviso de privacidade, canal de atendimento e prazos de retenção deve ser feita pelo controlador com apoio jurídico especializado em LGPD.

## Testes e evidências

A suíte determinística inclui testes para limiter, `429`, `Retry-After`, CORS permitido e negado, headers, redaction, cookies, storage keys, Error Boundary/consentimento e callbacks agendados sem stack trace. Na última execução validada antes do teste do novo componente: **46 arquivos e 121 testes aprovados**, além de TypeScript e build de produção aprovados. Deve-se repetir a suíte completa após a inclusão do teste `CookieConsent.test.tsx` antes do checkpoint.

## Limitações residuais e ações recomendadas

O rate limiter atual é em memória e por instância. Em Autoscale, ele não substitui um limitador distribuído no edge; recomenda-se configurar WAF/CDN com limites por IP, rota e reputação. Também se recomenda configurar `CORS_ALLOWED_ORIGINS` com os domínios oficiais de produção e preview necessários, sem incluir `*`.

Antes de uma revisão formal de conformidade, publicar aviso de privacidade e política de cookies, definir retenção e descarte de logs, anonimizar IPs no provedor de observabilidade e registrar procedimento para incidentes. O próximo checkpoint deve ser criado somente após `pnpm check`, `pnpm test --run`, `pnpm build` e `git diff --check` passarem juntos.
