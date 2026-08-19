# Relatório operacional — 19/08/2026

Consulta realizada diretamente em `ingestionRuns`, selecionando apenas campos operacionais.

A consulta por `routine`/`sourceKey` relacionados a Instagram retornou como linha mais recente: id `3510001`, rotina `instagram-agenda`, source `instagram`, status `failed`, `importedCount` 0, `failedCount` 1, `duration_ms` 1405, `httpStatus` 500, counts `{read:0, filtered:0, persisted:0, approved:0, structured:0}`, início `2026-08-19 13:09:50`, término `2026-08-19 13:09:51`. As duas linhas anteriores também estavam falhas, sem duração/status HTTP registrados.

Observação: essa linha não coincide temporalmente com o clique manual mais recente observado no painel; é necessário consultar todas as rotinas recentes e os alertas para localizar o registro correspondente ao disparo manual.

Nenhum segredo, token ou campo `details` foi selecionado.

## Execuções após o clique manual

A janela de 16:50–17:54 retornou oito registros, todos `routine=public-agenda`, `sourceKey=public`, `status=succeeded`, `httpStatus=200`, `failedCount=0`, `importedCount=0`, com `counts` zerados. O mais recente é id `3780007`, iniciado e finalizado em `2026-08-19 17:53:42`, com `duration_ms=206`.

Não apareceu uma nova linha `routine=instagram-agenda` nessa janela. A linha Instagram mais recente continua sendo id `3510001`, às `2026-08-19 13:09:50`, com `status=failed`, `httpStatus=500`, `duration_ms=1405` e contagens zeradas.

O agrupamento de alertas mostra um alerta Meta `WARNING` ainda não resolvido (`isResolved=0`), além de warnings de OCR e pipeline. Portanto, não é correto afirmar que a integração Meta está saudável ou que o alerta de erro desapareceu; o problema de transformação do painel desapareceu, mas a saúde upstream permanece em warning.
