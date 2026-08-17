# Diagnóstico do mapa preto — 2026-08-17

O relay `/api/maps/javascript` passou a responder HTTP 200 com `application/javascript` quando recebe os headers reais do proxy (`Host` do preview e `X-Forwarded-Proto: https`). O teste local sem esses headers retorna 502 porque gera origem HTTP local, comportamento esperado para a validação de origem.

A causa raiz confirmada no loader foi a ausência do parâmetro `callback=__weekendVibesMapsReady` no `script.src`, embora o callback fosse registrado no objeto `window` e suportado pelo relay. O loader podia expirar e marcar `loadError` mesmo com o bootstrap do Maps retornando 200. A correção incluiu o callback explicitamente e manteve singleton, lazy loading, polling de fallback e validação de `google.maps.Map`.

Também foi removido o `loading=async` que o relay acrescentava unilateralmente ao upstream, evitando uma combinação assíncrona não solicitada pelo frontend. A credencial server-side foi alinhada com a credencial Forge válida já injetada no projeto.

Validação automatizada: `pnpm check`, `pnpm test --run` com 51 arquivos e 138 testes aprovados, `pnpm build` aprovado e `git diff --check` sem problemas. A captura gerenciada de preview ainda mostra o fallback antigo; a sessão de navegador isolada informa que o preview não pode ser compartilhado diretamente. Portanto, o endpoint e o bundle foram validados, mas a confirmação visual final no navegador público deve ser feita após o checkpoint/publicação e recarga sem cache.

## Diagnóstico final — 17/08/2026

O fallback passou a registrar o erro técnico específico `Google Maps relay HTTP 502`: no preview, o browser chegava ao Express por `127.0.0.1` e a origem interna era enviada ao Forge, em vez do domínio público autorizado. A correção prioriza `x-forwarded-host` e, quando a camada local não o fornece, utiliza o domínio público do projeto para a origem autorizada. O relay passou a responder HTTP 200 com `application/javascript` e `Cross-Origin-Resource-Policy: cross-origin`.

O loader também foi tornado resiliente ao preview com `fetch` same-origin e execução do código recebido por Blob, mantendo callback, singleton, timeout e logs redigidos. O host que o Google Maps muta foi separado dos overlays React; isso eliminou o erro `Failed to execute 'removeChild' on 'Node'` ao desmontar o skeleton.

A captura visual final mostrou os tiles cartográficos da Baixada Santista, controles do Maps, legenda e eventos regionais. Permanecem apenas avisos não bloqueantes do Google sobre carregamento clássico e `DirectionsService` legado; eles não acionam o fallback.
