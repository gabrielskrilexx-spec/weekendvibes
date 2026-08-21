# Validação pública do redeploy — 2026-08-21

URL consultada: https://weekendvib-jscaalye.manus.space/admin/health?cache=18480006

Resultado observado: o domínio final continua exibindo `Versão do painel: db6cf437`, apesar do checkpoint local/publicado de redeploy ser `18480006` baseado no estado `4a464f29`. A página pública também não permite validar os novos elementos do mapa a partir dessa versão antiga. A evidência indica que a propagação na edge/CDN não ocorreu.

A validação local do checkpoint `18480006` apresentou a seção “Mapa da Semana” e o estado sem pins quando não há coordenadas válidas; portanto o componente está presente no bundle local, mas ainda não está confirmado no domínio final.
