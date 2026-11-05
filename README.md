# Feature Flags na prática

**Trabalho de Gerência de Configuração de Software — T2GCS**

Implementação em **Java e Spring Boot** para demonstrar a liberação gradual de uma funcionalidade e seu desligamento **sem reiniciar a aplicação ou fazer novo deploy**. Uma flag em arquivo externo controla quais usuários recebem recomendações de tarefas.

[![Feature Flags Java](https://github.com/esgarbossa/T2GCS/actions/workflows/feature-flags.yml/badge.svg)](https://github.com/esgarbossa/T2GCS/actions/workflows/feature-flags.yml)

[Guia completo](feature-flags/README.md) · [Relatório para o artigo](feature-flags/RELATORIO.md) · [Código da decisão](feature-flags/src/main/java/br/edu/t2gcs/FlagService.java) · [Testes](feature-flags/src/test/java/br/edu/t2gcs/FlagServiceTest.java)

## Executar

Requisito: JDK 21 ou superior. Os comandos abaixo partem da raiz deste repositório.

**Windows / PowerShell:**

```powershell
cd feature-flags
.\mvnw.cmd verify
java -jar target/feature-flags-1.0.0.jar
```

**Linux / macOS:**

```sh
cd feature-flags
sh mvnw verify
java -jar target/feature-flags-1.0.0.jar
```

O Maven Wrapper baixa o Maven quando necessário. Com o serviço iniciado, abra:

- [Experiência do usuário ana](http://localhost:8080/api/experience?userId=ana)
- [Configuração atual](http://localhost:8080/api/flags)
- [Saúde da aplicação](http://localhost:8080/actuator/health)

Para executar com Docker, use `docker compose up --build` dentro de `feature-flags/`. O arquivo de configuração é montado fora da imagem.

## O que demonstrar

Mantenha o serviço aberto. Edite e salve [`feature-flags/config/flags.properties`](feature-flags/config/flags.properties), atualizando a consulta após cada alteração:

| Etapa | `recommendations.enabled` | `recommendations.percentage` | Comportamento |
|---|---|---|---|
| Desligada | `false` | `0` | Experiência tradicional |
| Liberação inicial | `true` | `10` | Uma parte dos usuários recebe recomendações |
| Ampliação | `true` | `50` | O grupo cresce, preservando os usuários anteriores |
| Liberação total | `true` | `100` | Todos recebem recomendações |
| Desligamento geral | `false` | `100` | Todos voltam à experiência tradicional |

A configuração é relida em cada avaliação. Um hash estável do identificador do usuário determina seu grupo, com valor de 0 a 99. A funcionalidade é ativada quando a flag está ligada e esse valor é menor que o percentual.

Compare `instanceId` e `startedAt` nas respostas: permanecem iguais durante as alterações. Os percentuais intermediários representam uma distribuição aproximada, não uma quota exata em amostras pequenas.

**Demonstração automática:** com o serviço rodando, abra outro PowerShell em `feature-flags/` e execute `./demo.ps1`. O script percorre as cinco etapas para 100 usuários e restaura o arquivo original ao final.

## Evidências da implementação

Os cinco testes Java passaram na validação local. A demonstração HTTP obteve os resultados abaixo, mantendo a mesma instância:

| Configuração | Usuários com recomendações |
|---|---|
| Desligada | 0 de 100 |
| 10% | 13 de 100 |
| 50% | 45 de 100 |
| 100% | 100 de 100 |
| Desligada novamente | 0 de 100 |

O [relatório](feature-flags/RELATORIO.md) registra o ambiente, a metodologia, os resultados e as limitações. O workflow [Feature Flags Java](https://github.com/esgarbossa/T2GCS/actions/workflows/feature-flags.yml) executa os testes e a construção da imagem Docker. Ele não hospeda a API.

## Estrutura do repositório

```text
T2GCS/
├── feature-flags/         # Implementação principal em Java / Spring Boot
│   ├── config/           # Flag externa, alterável durante a execução
│   ├── src/main/         # Serviço de avaliação e endpoints HTTP
│   ├── src/test/         # Testes automatizados
│   ├── demo.ps1          # Demonstração com 100 usuários
│   ├── README.md         # Guia de execução e apresentação
│   └── RELATORIO.md      # Texto para o artigo
├── examples/node-api/    # Exemplo anterior: API Node.js com SQLite
├── docs/                 # Exemplo anterior: página estática de tarefas
└── .github/workflows/    # Testes e publicação do GitHub Pages
```

Os exemplos anteriores têm instruções próprias: [API Node.js](examples/node-api/README.md) e [página de tarefas / GitHub Pages](docs/README.md). São independentes do experimento de flags. O GitHub Pages não executa o serviço Java.

## Limites do experimento

A solução usa um arquivo local e uma única instância. Configuração inválida ou indisponível desliga a funcionalidade. Em produção seriam necessários controle de acesso, auditoria e distribuição consistente da configuração entre instâncias. O identificador de usuário é informado livremente para facilitar a demonstração; uma aplicação real deve usar a identidade autenticada. Desligar uma flag não desfaz efeitos já executados.
