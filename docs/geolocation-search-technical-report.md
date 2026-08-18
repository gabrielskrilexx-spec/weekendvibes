# Relatório técnico — precisão geográfica e busca por localidade

## Geocodificação e normalização

O pipeline passa o texto de endereço por `normalizeLocationText`, removendo hashtags, URLs, emojis e chamadas para ação antes da consulta. A busca regional acrescenta cidade, estado e país e valida o resultado contra os limites da Baixada Santista. A extração de bairro usa um dicionário controlado para Santos e Guarujá, incluindo Gonzaga, Boqueirão, Pompéia, José Menino, Centro, Enseada, Pitangueiras, Astúrias, Tombo e Pernambuco.

Quando não há coordenada exata, `getRegionalFallback` usa o centro da cidade ou do bairro conhecido e aplica um deslocamento determinístico pequeno por evento. Isso evita sobreposição total de pins e impede posições fora da região. O registro permanece marcado como aproximado.

## Persistência e auditoria

A tabela `events` mantém `latitude`, `longitude`, `neighborhood`, `formattedAddress` e `locationPrecision`. Os jobs de geocodificação preservam hash normalizado, tentativas, provider, confiança e erro; `geocodingAuditLogs` registra endereço bruto, endereço normalizado, status e diagnóstico curto para casos inválidos, rejeitados, fallback ou sucesso.

## Busca e mapa

A busca pública cobre título, estabelecimento, endereço bruto, bairro e endereço formatado. Foi adicionado filtro dedicado de bairro na API e na Home, mantendo atualização instantânea da consulta que alimenta a lista e os pins. Ao filtrar uma cidade, o mapa enquadra suavemente os limites de Santos ou Guarujá; com ambas selecionadas, retorna ao bounding box regional.

## Validação

TypeScript, build de produção, `git diff --check` e 151 testes Vitest foram aprovados. A cobertura inclui normalização, extração de bairros, fallback regional, contrato de listagem com bairro e regressões do mapa.
