# Auditoria do Google Maps — 18 de agosto de 2026

A versão publicada em `https://weekendvib-jscaalye.manus.space/` renderiza a interface do mapa, mas permanece no estado “Carregando o mapa quando ele entrar na tela…”. A página também expõe os controles de região e transporte, sem mostrar publicamente a causa detalhada do bloqueio.

O endpoint público `/api/maps/javascript` respondeu com JavaScript do Google Maps, portanto o relay server-side está alcançável e não retornou HTTP 502/503. O conteúdo não foi persistido aqui porque é um artefato público extenso e pode conter código de fornecedor; nenhuma chave ou token foi registrado.

O código atual usa a credencial `forgeApiKey` server-side, proveniente de `VITE_FRONTEND_FORGE_API_KEY` ou `BUILT_IN_FORGE_API_KEY`, em vez de expor `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. O relay encaminha a origem `https://weekendvib-jscaalye.manus.space` quando necessário e valida o callback. A falha “This page can't load Google Maps correctly” permanece compatível com bloqueio externo de chave/projeto: billing, APIs habilitadas ou restrição de HTTP referrer. Essas propriedades não são verificáveis pelo código do WeekendVibes sem acesso ao Google Cloud Console.

A próxima validação deve observar o console do navegador durante o bootstrap para diferenciar `RefererNotAllowedMapError`, `ApiNotActivatedMapError`, `InvalidKeyMapError` ou `BillingNotEnabledMapError`, sem imprimir qualquer valor de credencial.

## Segunda verificação pública

Em uma nova abertura da produção, o mapa exibiu tiles, controles de zoom, atribuição “Map data ©2026 Google”, link de termos e marcador/cluster regional; portanto, o relay e a inicialização funcionaram nessa tentativa. O console público consultado após essa abertura não apresentou mensagens de erro. Isso indica que a falha pode ser intermitente, específica de chave/origem, quota/billing ou de uma tentativa anterior; não há evidência suficiente para alterar a chave no código.

A aplicação publicada não expõe `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; a credencial passa pelo relay server-side. O domínio de produção observado foi `weekendvib-jscaalye.manus.space`. Preview domains do Manus podem variar e precisam ser cadastrados separadamente no Google Cloud apenas se forem usados para validação.
