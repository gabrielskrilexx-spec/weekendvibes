
## 2026-08-27 — validação do middleware REST

Após centralizar a autorização em `admin-rest.ts`, executar o botão real **Forçar Ingestão (Instagram)** no painel autenticado criou o run `#7170008`, exibido como `status succeeded`, `HTTP 200`, `Mídias lidas 4`, `Processadas 4`, `Persistidas 0`. Os logs do painel exibiram início e término do run com `Sandbox / Mocks`. Não houve resposta 403 nem erro `[REST Error]` visível no fluxo.
