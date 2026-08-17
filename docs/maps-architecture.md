# Arquitetura de mapas do WeekendVibes

## Escopo regional

O mapa público é limitado operacionalmente à Baixada Santista, com foco em Santos e Guarujá. Os limites padrão são definidos em `client/src/lib/eventClusters.ts` e aplicados como `restriction` no Google Maps. O mapa inicia centralizado na região e não exibe POIs nativos ou transporte público para reduzir ruído visual.

## Carregamento e performance

`MapView` mantém uma única promessa de carregamento do script do Google Maps (`mapScriptPromise`). Todas as instâncias compartilham essa promessa, evitando chamadas concorrentes e os avisos de carregamento múltiplo observados anteriormente. O componente usa `IntersectionObserver` com margem de pré-carregamento de 300 px; a instância do mapa só é criada quando o contêiner se aproxima do viewport. A falha do script deixa o contêiner intacto e não expõe detalhes do fornecedor ao usuário.

O mapa regional calcula clusters de forma determinística no cliente a partir dos eventos filtrados. A reconstrução dos marcadores depende apenas da lista de clusters; alterações de transporte ou localização atualizam os InfoWindows e os cards de rota por refs, sem desmontar os marcadores. Isso evita o efeito de piscar quando filtros de data, gênero ou local são alterados.

## Clustering e InfoWindows

Eventos próximos na mesma cidade são agrupados em um marcador circular com contagem. Santos e Guarujá permanecem em grupos distintos. Ao selecionar um marcador, o InfoWindow apresenta imagem de capa quando disponível, título, local, distância estimada, duração, link para detalhes e ação de rota. Conteúdo textual e slugs são escapados antes de entrar no HTML do InfoWindow.

## Geolocalização e rotas

A ação “Usar minha localização” solicita a posição pelo navegador apenas após interação do usuário. A posição é mantida em memória durante a sessão do componente e usada para estimar distância e tempo conforme o meio escolhido: carro, transporte público, bicicleta ou caminhada. A rota abre o Google Maps em nova aba com `noopener noreferrer`.

## Geocoding e precisão

O worker de geocoding tenta obter coordenadas pelo Nominatim. Quando consegue, grava latitude, longitude e `locationPrecision = exact`. Depois do limite de tentativas, grava o centro da cidade correspondente, registra o job como `regional-fallback` com confiança baixa e define `locationPrecision = approximate`. O frontend exibe “Endereço aproximado” no cluster, na lista regional e no InfoWindow. Eventos ainda sem coordenadas durante a janela de retry também recebem fallback visual, sem forjar um endereço exato.

## Limitações residuais

A estimativa de tempo é uma aproximação geométrica local, não uma previsão de trânsito em tempo real. A precisão final depende do provedor de geocoding e da qualidade do endereço extraído. O uso do Google Maps continua condicionado à disponibilidade da chave/proxy e aos limites da conta configurada.
