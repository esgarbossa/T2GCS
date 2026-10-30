# T2GCS — Backend de tarefas

API REST pequena para apresentar um deploy real: Node.js 24, SQLite em arquivo, respostas JSON, validacao, logs de requisicoes, encerramento controlado, Docker e CI no GitHub Actions. Usa apenas recursos do Node, sem pacotes externos.

## Rodar localmente

Instale Node.js 24 e execute na pasta do projeto:

```sh
npm start
```

Abra http://localhost:3000/health. Para desenvolvimento: `npm run dev`. Testes: `npm test`.

As variaveis opcionais sao `PORT` (3000) e `DATABASE_PATH` (`./data/tasks.db`). Para carregar um arquivo de configuracao local, copie `.env.example` para `.env` e execute `node --env-file=.env src/server.js`.

## Rotas

| Metodo | Rota | Comportamento |
|---|---|---|
| GET | / | Identificacao e lista de rotas |
| GET | /health | Verifica aplicacao e acesso ao banco |
| GET | /tasks | Lista tarefas; aceita ?completed=true ou false |
| GET | /tasks/:id | Busca uma tarefa |
| POST | /tasks | Cria com {"title":"Apresentar trabalho"} |
| PATCH | /tasks/:id | Atualiza title e/ou completed |
| DELETE | /tasks/:id | Exclui; responde 204 |

POST e PATCH exigem `Content-Type: application/json`. Titulo obrigatorio com ate 120 caracteres; corpo limitado a 16 KB. Erros retornam `error` e `requestId`. Cada requisicao gera um log JSON com status e duracao.

## Demonstracao no terminal

No Windows use `curl.exe` no lugar de `curl` se estiver no PowerShell. No Postman, configure os mesmos metodos, URLs e corpos JSON.

```sh
curl http://localhost:3000/health
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Explicar o deploy"}'
curl http://localhost:3000/tasks
# Substitua ID pelo id retornado no cadastro:
curl -X PATCH http://localhost:3000/tasks/ID -H "Content-Type: application/json" -d '{"completed":true}'
curl http://localhost:3000/tasks?completed=true
curl -X DELETE http://localhost:3000/tasks/ID
```

## Deploy com Docker

```sh
docker compose up --build -d
docker compose logs -f
```

A API fica em http://localhost:3000. O volume `tasks-data` guarda o SQLite entre recriacoes do container. `docker compose down` encerra o servico; adicionar `-v` tambem apaga o banco.

## Deploy no Render

1. Envie este codigo ao repositorio GitHub.
2. No Render, escolha **New > Web Service** e conecte o repositorio.
3. Selecione runtime **Docker**, usando o Dockerfile da raiz.
4. Configure **Health Check Path** como `/health`. A aplicacao le a variavel `PORT` fornecida pela plataforma.
5. Para preservar os dados entre deploys, use uma instancia com disco persistente montado em `/app/data`. Sem disco persistente, o SQLite pode ser perdido em reinicios ou novos deploys.
6. Inicie o deploy e abra `https://SEU-SERVICO.onrender.com/health`. Repita a demonstracao trocando a URL local pela URL publicada.

Consulte os recursos e precos atuais antes de contratar uma instancia ou disco. Nenhuma conta ou recurso de hospedagem e criado automaticamente por este projeto.

Documentacao: https://render.com/docs/web-services e https://render.com/docs/health-checks.

## Roteiro para explicar no trabalho

1. **Codigo:** o cliente envia HTTP; a API valida e grava tarefas no SQLite com consultas parametrizadas.
2. **Qualidade:** `npm test` verifica CRUD, entradas invalidas e persistencia apos reinicio. O GitHub Actions executa testes e build da imagem em pushes e pull requests.
3. **Empacotamento:** o Dockerfile define o ambiente e executa a aplicacao com usuario sem privilegios.
4. **Deploy:** a hospedagem cria o container, define a porta e verifica `/health` antes de encaminhar acessos.
5. **Demonstracao:** cadastre uma tarefa, liste, conclua e consulte os logs. Reinicie o servico com armazenamento persistente e mostre que os dados continuam salvos.

Escopo didatico: sem login, todas as pessoas com acesso podem alterar tarefas. Use dados ficticios. SQLite atende uma instancia com disco local; multiplas replicas exigiriam outra estrategia de banco. A listagem nao tem paginacao, mantendo o exemplo pequeno.

Referencia SQLite do Node: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html.
