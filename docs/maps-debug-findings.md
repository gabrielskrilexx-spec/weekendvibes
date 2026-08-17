# Diagnóstico do mapa preto — 2026-08-17

O relay `/api/maps/javascript` passou a responder HTTP 200 com `application/javascript` quando recebe os headers reais do proxy (`Host` do preview e `X-Forwarded-Proto: https`). O teste local sem esses headers retorna 502 porque gera origem HTTP local, comportamento esperado para a validação de origem.

A causa raiz confirmada no loader foi a ausência do parâmetro `callback=__weekendVibesMapsReady` no `script.src`, embora o callback fosse registrado no objeto `window` e suportado pelo relay. O loader podia expirar e marcar `loadError` mesmo com o bootstrap do Maps retornando 200. A correção incluiu o callback explicitamente e manteve singleton, lazy loading, polling de fallback e validação de `google.maps.Map`.

Também foi removido o `loading=async` que o relay acrescentava unilateralmente ao upstream, evitando uma combinação assíncrona não solicitada pelo frontend. A credencial server-side foi alinhada com a credencial Forge válida já injetada no projeto.

Validação automatizada: `pnpm check`, `pnpm test --run` com 51 arquivos e 138 testes aprovados, `pnpm build` aprovado e `git diff --check` sem problemas. A captura gerenciada de preview ainda mostra o fallback antigo; a sessão de navegador isolada informa que o preview não pode ser compartilhado diretamente. Portanto, o endpoint e o bundle foram validados, mas a confirmação visual final no navegador público deve ser feita após o checkpoint/publicação e recarga sem cache.
