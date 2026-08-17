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

## Sincronização entre viewport e agenda

O mapa publica os IDs dos eventos contidos no `LatLngBounds` atual sempre que o Google Maps emite o evento `idle`, após pan, zoom ou ajuste de bounds. A Home mantém esse conjunto separado da consulta principal e renderiza apenas os cards visíveis no viewport; quando os filtros da consulta mudam, o estado visual é resetado até o mapa publicar o novo recorte. O callback usa refs para consumir a lista e o consumidor mais recentes sem recriar o listener a cada renderização.

O InfoWindow é reconstruído de forma reativa quando a localização do usuário ou o meio de transporte muda. A distância é calculada a partir das coordenadas atuais do navegador e o tempo é uma estimativa determinística baseada no modo escolhido; sem permissão de localização, o popup mantém o conteúdo do evento e o link de rota, mas não apresenta uma estimativa fictícia. A mesma regra é aplicada aos eventos agrupados no cluster.

## Directions API e rota em tempo real

Quando o usuário seleciona uma região e autoriza a localização, o mapa cria um `DirectionsService` no callback `onMapReady` e solicita a rota somente para o cluster selecionado. A origem é a posição atual do navegador, o destino é o primeiro evento do cluster e o modo acompanha a escolha de carro, transporte público, bicicleta ou caminhada. Para carro, a solicitação inclui o horário de partida atual para permitir duração baseada nas condições disponíveis do provedor.

O InfoWindow apresenta um estado de carregamento, seguido de distância, duração retornada pela rota e até cinco instruções resumidas com HTML sanitizado. Se não houver origem, o usuário negar localização, o serviço não estiver disponível ou a API não retornar uma rota válida, o componente preserva a estimativa local e exibe um aviso genérico, sem expor status, URL ou mensagem interna do fornecedor. O serviço é inicializado pelo proxy oficial já configurado no projeto; não é necessário solicitar uma chave diretamente ao usuário.

## Rotas alternativas e cache curto

O InfoWindow solicita `provideRouteAlternatives` quando há localização atual, destino válido e meio de transporte selecionado. As alternativas são normalizadas para distância, duração e até cinco instruções, e o usuário pode escolher uma delas em um seletor acessível dentro do popup.

As respostas são armazenadas apenas em memória durante a sessão, indexadas por origem e destino arredondados a quatro casas decimais e pelo meio de transporte. O cache expira em 60 segundos e mantém no máximo 30 entradas, removendo a mais antiga quando o limite é atingido. Nenhum token, endereço de usuário ou dado de perfil é persistido. Sem localização, permissão, resposta válida ou serviço disponível, o mapa conserva apenas a estimativa local e o link externo do Google Maps.

## Migração para Routes Library (2026-08-17)

A migração usa a classe `Route` da Routes Library do Maps JavaScript, cujo método `computeRoutes()` substitui o `DirectionsService.route()` legado. O carregamento é feito sob demanda por `google.maps.importLibrary("routes")`, com alternativas habilitadas e máscara de campos limitada a distância, duração, valores localizados e instruções. A aplicação mantém o cache curto e o fallback de distância estimada quando a API não está disponível.

O controle **Minha localização** solicita a posição apenas após interação do usuário. Com uma posição válida, o mapa centraliza no usuário e aplica zoom regional; se a localização já estiver disponível, o controle apenas reposiciona a câmera. Estados de carregamento, permissão negada e indisponibilidade são comunicados sem expor detalhes sensíveis.

Referências oficiais: [migração para Route](https://developers.google.com/maps/documentation/javascript/routes/routes-js-migration), [renderização da Routes Library](https://developers.google.com/maps/documentation/javascript/routes/routes-migrate-rendering) e [seleção de campos da Routes API](https://developers.google.com/maps/documentation/routes/choose_fields).
