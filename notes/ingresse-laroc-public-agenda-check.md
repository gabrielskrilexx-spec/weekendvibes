# Verificação da fonte Ingresse — Laroc Réveillon 2027

Data da verificação: 2026-08-21.

URL: https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/

O fetch do worker retornou HTTP 200, mas o HTML público entregou apenas o shell da aplicação e links de navegação/login/cadastro. A execução encontrou três páginas: a URL focada e `/login/` e `/register/`, porém nenhuma continha texto reconhecível de `Laroc Club Guarujá`; por isso `matchedSources = 0`, `persisted = 0` e o run terminou como `succeeded` operacionalmente, sem persistência.

A verificação no navegador mostrou o mesmo comportamento: a página permaneceu em `LOADING / Please wait`, com botão de login e sem título, data ou local do evento visíveis no conteúdo extraído. O worker atual faz fetch de HTML estático e não executa a hidratação JavaScript do Ingresse.

Conclusão: a URL é válida e acessível, mas não é uma fonte HTML estática suficiente para o adaptador atual. Não há evidência sanitizada de título/data extraídos nem evento persistido; não se deve inferir esses campos apenas pelo slug da URL.
