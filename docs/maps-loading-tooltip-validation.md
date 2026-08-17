# Validação de carregamento e tooltips do mapa

A implementação adiciona ao `MapView` um overlay de skeleton com `role=status`, `aria-live`, `aria-label` contextual, animação `animate-pulse`, contraste tropical em tons de laranja/fúcsia e mensagem distinta para lazy loading e inicialização efetiva. O contêiner usa `aria-busy` enquanto o mapa está sendo inicializado e mantém o fallback de erro sem expor detalhes internos.

Os marcadores regionais agora exibem tooltip interativo no mouseover e no foco, com cidade, quantidade de rolês, até três estabelecimentos, indicação de itens adicionais, sinalização de endereço aproximado e orientação para clique. O clique continua abrindo o InfoWindow completo com eventos, rotas e estimativas.

A suíte passou com 51 arquivos e 140 testes, TypeScript, build e `git diff --check`. As capturas desktop e mobile confirmaram que a composição visual, o contêiner do mapa e os controles regionais permanecem responsivos. A captura gerenciada ainda pode exibir o fallback publicado anterior até a criação do novo checkpoint; a lógica nova foi validada por build/testes e será publicada no checkpoint desta tarefa.
