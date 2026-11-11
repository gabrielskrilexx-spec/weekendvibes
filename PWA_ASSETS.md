# Assets pendentes do PWA

A configuração do manifesto já referencia os assets abaixo, mas eles não existiam no repositório no momento da implementação. Para habilitar a instalação com ícones completos em Android e iOS, adicionar arquivos PNG reais da identidade visual do WeekendVibes em `client/public/icons/`:

- `icon-180.png` — 180×180, usado por `apple-touch-icon` no iOS.
- `icon-192.png` — 192×192, ícone padrão do manifesto Android.
- `icon-512.png` — 512×512, ícone de alta resolução do manifesto.
- `icon-512-maskable.png` — 512×512, com área segura para `purpose: maskable`.

Não foram gerados placeholders para evitar publicar uma identidade visual falsa. Até que os arquivos sejam adicionados, o PWA continua funcional, mas os navegadores podem mostrar um ícone genérico durante a instalação.
