# WeekendVibes

O WeekendVibes é uma plataforma de eventos musicais para a Baixada Santista, com foco em Santos e Guarujá. A aplicação oferece um feed público mobile-first, filtros por data, cidade, categoria e gênero, páginas de detalhe e um painel administrativo para ingestão, revisão OCR, qualidade de dados e observabilidade operacional.

## Stack

- React 19 + Vite no frontend.
- Node.js + Express no servidor.
- tRPC para contratos tipados entre cliente e servidor.
- Drizzle ORM com PostgreSQL/Neon.
- Vitest para testes automatizados.
- Apify para coleta de conteúdo público do Instagram.
- OpenAI Vision para OCR de artes de posts, Stories e Destaques.

## PWA unificada Web/Mobile

O WeekendVibes opera como uma aplicação web responsiva e PWA unificada, compartilhada entre navegadores e instalações móveis feitas a partir do mesmo site. Toda mudança visual, de rota ou de regra de negócio publicada na branch `main` deve preservar a compatibilidade responsiva e funcionar também no aplicativo móvel instalado como PWA. O Service Worker é atualizado automaticamente após cada publicação; quando uma nova versão assume o controle, a página recarrega uma única vez para carregar os arquivos atuais. APIs (`/api/*`) e navegações HTML são sempre `NetworkOnly`; apenas imagens públicas de venues usam cache em runtime.

## Pré-requisitos

Instale Node.js 20 ou superior, pnpm e acesso a um banco PostgreSQL/Neon compatível com Drizzle. Para executar a ingestão real do Instagram, configure também um token válido do Apify e os segredos de sessão previstos pelo ambiente. Em preview, os mocks de sandbox podem ser usados quando habilitados pela configuração do projeto.

## Configuração local

1. Instale as dependências:

```bash
pnpm install
```

2. Configure as variáveis de ambiente no gerenciador de segredos do projeto. Não versione arquivos `.env` com credenciais. Os principais valores usados pelo servidor incluem `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAILS` (lista separada por vírgulas), `APIFY_API_TOKEN`, `APIFY_INSTAGRAM_SESSION_COOKIE`, `OPENAI_API_KEY`, `INTERNAL_CRON_SECRET` e os valores de storage/OAuth fornecidos pelo ambiente Manus. Para Web Push, configure um par VAPID correspondente: `VITE_VAPID_PUBLIC_KEY` (pública, disponível durante o build do frontend), `VAPID_PRIVATE_KEY` (somente servidor) e `VAPID_SUBJECT` (por exemplo, `mailto:admin@weekendvibes.com`). Nunca use a chave privada em `VITE_*`, no navegador ou no Git. O opt-in permanece oculto enquanto a chave pública estiver ausente; o envio administrativo exige as três variáveis. O painel administrativo autoriza somente usuários com `role=admin` ou e-mail presente em `ADMIN_EMAILS`.

3. Gere migrações Drizzle quando o schema for alterado e aplique-as conforme o fluxo do projeto. Não execute comandos destrutivos contra o banco de produção sem revisão.

## Web Push

Com permissão explícita do visitante, o frontend registra a subscription no Service Worker e usa `POST /api/push/subscriptions` para salvá-la; a desativação usa `DELETE /api/push/subscriptions`. Ambos aceitam somente endpoints HTTPS dos serviços de push dos navegadores, não devolvem chaves/endpoints e têm rate limit. O envio é manual e autenticado como administrador: `POST /api/v2/admin/push/send` recebe JSON `{ "title": "Novos eventos", "body": "Confira a agenda", "url": "/agenda", "tag": "weekendvibes-events" }`. O `url` precisa ser relativo à origem; falhas 404/410 removem a subscription expirada. A rota responde apenas contagens de enviadas, expiradas e falhas, sem registrar chaves ou endpoints.

## Executar localmente

O comando de desenvolvimento inicia o Express e o bridge do Vite na mesma porta:

```bash
pnpm dev
```

Acesse `http://localhost:3000`. O frontend é servido pelo Vite durante o desenvolvimento e o backend Express expõe o tRPC sob `/api/trpc` e os handlers agendados sob as rotas internas correspondentes.

Para gerar o bundle de produção:

```bash
pnpm build
```

Para iniciar o bundle gerado, use o comando definido no `package.json` do ambiente:

```bash
pnpm start
```

## Pipeline de ingestão do Instagram

A rotina de ingestão coleta conteúdo público das fontes configuradas usando o conector Apify. O payload pode solicitar Posts, Stories e Destaques; cada item é normalizado por username, origem de mídia, URL e timestamps. Itens visuais sem legenda suficiente são encaminhados ao OCR Vision. Para vídeos, `thumbnailUrl` pode ser usada como entrada visual quando não há texto extraível diretamente.

Após a normalização, o pipeline aplica filtros geográficos e de negócio, valida o evento estruturado, resolve coordenadas, deduplica por identidade de fonte/data/título e persiste eventos elegíveis. Também registra relatórios por fonte, descartes conhecidos, falhas de transporte e trilhas de auditoria OCR.

### Cron/Heartbeat local

A execução automática não depende de timers em memória. O Heartbeat chama o endpoint M2M configurado no projeto em intervalos definidos pelo schedule, autenticando com o segredo interno esperado pelo servidor. Em desenvolvimento, a execução pode ser simulada com mocks de sandbox para evitar dependência de rede externa. Em produção, os mocks permanecem bloqueados e o endpoint exige autenticação M2M válida.

O fluxo operacional recomendado é:

```text
Heartbeat/Cron → endpoint M2M → coleta Apify → normalização/OCR → reconciliação → persistência → alertas e snapshots
```

Timeouts globais do Actor devem ser distinguidos de falhas individuais de perfil. Quando o Actor não responde, o run deve ser reportado como timeout do coletor, sem atribuir a falha a uma conta específica.

## Testes

Execute a suíte completa:

```bash
pnpm test -- --run
```

Para executar testes específicos:

```bash
pnpm vitest run server/instagram-pipeline.test.ts
pnpm vitest run client/src/components/AdminRoutinePanel.test.tsx
```

Para validar apenas o TypeScript:

```bash
pnpm exec tsc --noEmit
```

A validação de entrega deve incluir Vitest, TypeScript e `pnpm build`. Testes que usam mocks devem complementar, e não substituir, a validação dos contratos e dos handlers reais.

## Estrutura principal

```text
client/src/                 Frontend React e componentes visuais
client/src/pages/           Páginas públicas e administrativas
client/src/components/      Componentes reutilizáveis e painéis
server/                     Routers tRPC, ingestão, OCR e serviços
server/_core/               Infraestrutura Express, autenticação e Heartbeat
drizzle/schema.ts           Schema Drizzle
storage/                    Helpers de storage
shared/                     Tipos e constantes compartilhadas
```

## Segurança e operação

Use o gerenciador de segredos do ambiente para credenciais. Nunca registre tokens, cookies ou payloads sensíveis nos logs. Procedimentos administrativos devem usar autenticação de administrador e retornar contratos JSON/tRPC estritos. Antes de publicar, execute a suíte completa, valide o build e revise os logs operacionais recentes.
