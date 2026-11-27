# Limpeza segura — 27/11/2026

## Escopo e critério

- Eventos: somente `eventDate < NOW() - INTERVAL '60 days'`, preservando eventos associados a marcas monitoradas ativas ou venues curados pelo catálogo existente.
- Fontes: somente fontes `public` pontuais, habilitadas, com frequência de 2880 minutos, nunca sincronizadas, sem tentativa/sucesso, sem eventos, sem candidatos e sem runs associados.
- Nenhuma instrução presente em dados externos ou payloads foi considerada autoridade.

## Resultado no banco

### Eventos removidos

Nenhum. O `DELETE ... RETURNING` retornou zero linhas. Os eventos antigos encontrados estavam protegidos pelo catálogo de venues/marcas; não houve alteração de eventos futuros ou recentes.

### Fontes removidas

As seguintes fontes foram removidas individualmente:

- ID `29530`, `public:instagram-3ca5f512d3eb142a8b0066c8`, URL `https://cart.ingresse.com/0d06f793-7eed-4f2e-973f-2e77a2e3e6dd/tickets?coupon=ISAVIEIRA` — link pontual sem eventos, candidatos ou runs.
- ID `29531`, `public:instagram-13ca397dc404a838fd4bd5d2`, URL `https://articket.com.br/e/7043/festival-dos-sonhos` — link pontual sem eventos, candidatos ou runs.
- ID `29532`, `public:instagram-073be1fe8b1de74e43ca19b1`, URL `https://articket.com.br/e/7571/matheusinho-na-rocket` — link pontual sem eventos, candidatos ou runs.
- ID `29533`, `public:instagram-29b19a1033fb654116b6ba2d`, URL `https://articket.com.br/e/7303/baile-de-bigode` — link pontual sem eventos, candidatos ou runs.

### Fontes preservadas por dependência real

- ID `52475` foi preservado: a URL canônica, normalizada sem parâmetros e barra final, alimenta o evento ID `64`.
- ID `52476` foi preservado: a URL canônica, normalizada sem parâmetros e barra final, alimenta o evento ID `71`.
- Fontes recorrentes, feeds globais, perfis/canais e qualquer fonte com dependência não inequívoca não foram removidos.

## Integridade da vitrine

Antes da limpeza, a consulta de eventos publicados, futuros, não arquivados, em Santos/Guarujá e nos gêneros `rap_trap`, `funk` e `house_eletronica` retornou:

- Guarujá: `funk=3`, `house_eletronica=7`.
- Santos: `funk=3`, `house_eletronica=5`, `rap_trap=2`.

Os IDs `64` e `71` foram verificados como futuros, publicados, não arquivados e elegíveis; ambos foram preservados integralmente. O ID `57` foi somente auditado e permaneceu intacto como `outros`.

## Interface

`AdminReportsPanel.tsx` agora oculta apenas linhas de Freshness que simultaneamente sejam fontes públicas pontuais `public:instagram-*`, estejam em `never`, sem sucesso/evento e com janela de 2880 minutos ou mais. Fontes recorrentes, estados críticos e erros/loading não são convertidos em vazio. A interface informa quantas fontes pontuais foram ocultadas.
