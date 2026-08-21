# Verificação programática de propagação — 2026-08-21

O script `scripts/check-public-version.sh` consultou o domínio público com cache-busting em três tentativas, com intervalo de 10 segundos. Resultado sanitizado:

- attempt=1 version=tag-not-found
- attempt=2 version=tag-not-found
- attempt=3 version=tag-not-found

A expressão de extração não encontrou a tag esperada no HTML retornado pelo endpoint. Não houve exposição de cookies, tokens ou conteúdo sensível. Os utilitários disponíveis incluem `manus-config`, `manus-webdev-logs` e ferramentas de ingestão, mas não existe `manus-deploy`, `manus-cache`, `manus-publish` ou `manus-webdev-publish` no ambiente.
