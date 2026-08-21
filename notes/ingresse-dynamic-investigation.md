# Investigação dinâmica do Ingresse

A página `https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/` não expôs `__NEXT_DATA__` nem `script[type="application/ld+json"]` no DOM observado. O frontend carregou chunks Next.js, incluindo `app/[slug]/page-81b6566b02a249ad.js`, além de `embedstore.ingresse.com/ingresse-widget.js`, `gateway.ingresse.com/assets/js/purchase_sdk.js` e scripts da Queue-it.

As entradas de performance não mostraram uma API de evento legível; a página permaneceu em loading e os recursos visíveis foram principalmente chunks, fila e SDKs. O adaptador não deve inferir título/data/local pelo slug. Próximo passo seguro: baixar/analisar o chunk da página e os chunks relacionados para localizar strings de endpoint, ou usar uma rota pública documentada/observável sem enviar credenciais e sem acionar checkout.
