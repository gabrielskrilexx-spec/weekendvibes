# Evolução do painel operacional administrativo

## Escopo

O painel administrativo agora apresenta quatro dimensões operacionais: atualidade dos dados (freshness), alertas acionáveis, linha do tempo correlacionada e reconciliação por fonte.

## Freshness

Cada fonte recebe um estado calculado a partir de `lastSuccessAt` e da frequência configurada. O estado é `healthy` quando a idade está dentro de 125% da janela esperada, `delayed` até 250%, `critical` acima disso e `never` quando não há sincronização bem-sucedida registrada. O feed geral usa uma janela diária. A interface mostra o estado, o último sucesso em formato relativo e a janela esperada.

## Alertas acionáveis

Alertas são apresentados com severidade `INFO`, `WARNING` ou `CRITICAL`, SLA em minutos, integração, tipo, estado de resolução e `runId` sanitizado. Mensagens não exibem tokens, payloads externos, conteúdo de posts ou credenciais. A severidade é persistida com fingerprint para preservar deduplicação.

## Linha do tempo

A timeline combina início do Heartbeat, conclusão da ingestão, retries derivados das métricas persistidas e alertas relacionados. Cada item contém um identificador sanitizado, timestamp, tipo, status, fonte e correlação por `runId`. A interface limita a exibição aos 12 itens mais recentes e o backend mantém até 80 eventos.

## Reconciliação por fonte

A tabela agrega os últimos sete dias por `sourceKey`, exibindo `read`, `filtered`, `persisted`, `duplicates`, coordenadas ausentes e coordenadas fora da região. Os valores derivam exclusivamente de `ingestionRuns` e não de dados simulados.

## Operação e validação

O relatório atualiza a cada 30 segundos e mantém estados vazios acessíveis. Recomenda-se investigar fontes em estado `critical`, priorizar alertas `CRITICAL` dentro do SLA e comparar duplicidades com a chave única antes de reprocessar uma fonte.
