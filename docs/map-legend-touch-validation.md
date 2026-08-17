# Validação da legenda e interação touch

A legenda foi adicionada logo abaixo do mapa, com quatro itens: Santos em laranja, Guarujá em fúcsia, Número para indicar agrupamentos e Aproximado em amarelo para coordenadas não exatas. Em telas pequenas, os itens usam duas colunas e exibem a orientação de tocar uma vez para o resumo persistente e novamente para abrir detalhes. Em telas maiores, a legenda ocupa quatro colunas e apresenta descrições complementares.

A interação touch do marcador foi modelada de forma idempotente: o primeiro toque em um cluster diferente abre o tooltip resumido e mantém o estado; o segundo toque no mesmo cluster abre o InfoWindow detalhado. A interação desktop por mouseover, foco e clique foi preservada.

A validação visual desktop e mobile confirmou contraste, legibilidade e encaixe dos controles de deslocamento. TypeScript, build, `git diff --check` e 51 arquivos com 142 testes Vitest passaram.
