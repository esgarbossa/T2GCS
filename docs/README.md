# Página de tarefas — exemplo estático

Página independente em HTML, CSS e JavaScript. Permite adicionar, concluir, filtrar e excluir tarefas, usando `localStorage`. Cada navegador tem sua própria lista; limpar os dados do site apaga as tarefas.

Este é um exemplo anterior de publicação estática. O trabalho principal de **Feature Flags em Java** está em [`../feature-flags/`](../feature-flags/README.md), e não é executado por esta página.

## Publicar no GitHub Pages

1. No repositório, abra **Settings > Pages**.
2. Em **Build and deployment > Source**, selecione **GitHub Actions**.
3. Abra **Actions > Publicar GitHub Pages > Run workflow**, selecione `main` e confirme.
4. Aguarde a execução terminar e acesse a URL informada no ambiente `github-pages`.

Novas alterações nesta pasta serão publicadas após o push para `main`. O workflow publica somente `docs/`. A URL esperada é https://esgarbossa.github.io/T2GCS/; a disponibilidade depende de o Pages estar habilitado no repositório e do plano da conta.

## Apresentar

Abra a página, cadastre uma tarefa, marque como concluída, alterne os filtros e recarregue para mostrar a persistência local. Esta demonstração não usa a API Node.js nem a API Java.
