# Assets do PWA

Os quatro ícones oficiais foram gerados a partir da imagem fornecida do logótipo WeekendVibes (W laranja sobre fundo escuro) e estão versionados em `client/public/icons/`:

| Ficheiro | Dimensão | Uso |
|---|---:|---|
| `icon-180.png` | 180×180 | Apple Touch Icon para iOS |
| `icon-192.png` | 192×192 | Ícone padrão do manifesto Android |
| `icon-512.png` | 512×512 | Ícone de alta resolução / splash |
| `icon-512-maskable.png` | 512×512 | Ícone adaptativo Android, com margem de segurança aproximada de 10% |

Os caminhos correspondem às referências em `client/index.html` e `vite.config.ts`. Os PNGs foram reencodados sem transparência, em RGB, com fundo escuro consistente com `#09090b`.
