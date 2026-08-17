# Nota técnica — hashtags regionais e Instagram Stories

Data da revisão: 17 de agosto de 2026.

A documentação oficial da Meta confirma que Business Discovery permite consultar dados básicos e mídia publicada de outras contas profissionais usando a API do Instagram com Facebook Login, por meio do host `graph.facebook.com`. A mídia publicada é acessível via expansão do campo `business_discovery.username(...){media}`; o endpoint não documenta uma borda para Stories de terceiros.

A documentação também distingue Standard Access de Advanced Access. Para atender contas profissionais que o aplicativo não possui ou gerencia, Advanced Access, revisão do aplicativo e verificação empresarial podem ser necessários. O acesso deve seguir as permissões oficiais e não pode ser substituído por login automatizado, scraping de sessão, Playwright ou Instaloader.

Decisão de implementação: ampliar o filtro textual para aceitar `#Guarujá` ou `#Santos` como marcadores regionais adicionais, mantendo obrigatórios `Agenda da semana` e `#Sexta-Feira` ou `#Sábado`. A validação estruturada continuará exigindo cidade, endereço, gênero permitido e venue/alias ativo antes do upsert.

Sobre Stories: não será implementado um coletor que tente acessar Stories de perfis de terceiros por métodos não documentados. O pipeline deverá tratar Stories como fonte não disponível no conector Meta atual e retornar zero itens de forma observável, sem falhar a execução e sem fabricar eventos. A normalização poderá aceitar mídias marcadas como `story` se uma integração oficial futura as disponibilizar, preservando origem e deduplicação.

Referências:

1. Meta, Business Discovery: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery
2. Meta, Instagram Platform Overview: https://developers.facebook.com/documentation/instagram-platform/overview
3. Meta, IG User Business Discovery: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
