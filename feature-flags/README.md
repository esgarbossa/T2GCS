# Feature Flags na prática — Java e Spring Boot

Exemplo para o trabalho: liberar **recomendações de tarefas** de forma gradual e desligá-las sem recompilar, reiniciar ou fazer novo deploy. O código de ambos os comportamentos já está no mesmo artefato; a flag decide qual é retornado.

## Executar no Windows

Requer **JDK 21 ou superior** (validado localmente com JDK 26). Na pasta `feature-flags`:

```powershell
.\mvnw.cmd verify
java -jar target/feature-flags-1.0.0.jar
```

No Linux/macOS: `sh mvnw verify` e o mesmo comando `java -jar`. O Maven Wrapper baixa o Maven na primeira execução. Ajuste `JAVA_HOME` se o sistema apontar para outro Java. Abra http://localhost:8080/api/experience?userId=ana e http://localhost:8080/actuator/health.

Alternativa com Docker, também a partir desta pasta:

```sh
docker compose up --build
```

O diretório `config/` é montado no container em modo somente leitura. Você edita o arquivo no computador e a aplicação lê a alteração no próximo pedido. Não é preciso reconstruir a imagem. A configuração fica fora do JAR; execute os comandos na pasta `feature-flags`, ou defina `FLAGS_FILE` com seu caminho. `PORT` altera a porta padrão 8080.

## Demonstração manual (3 minutos)

Mantenha a aplicação aberta. Em outro terminal ou editor, altere **`config/flags.properties`**, salve e consulte novamente a URL:

```properties
recommendations.enabled=false
recommendations.percentage=0
```

1. **Desligada:** a resposta tem `experience=TRADICIONAL`, `active=false` e lista de recomendações vazia.
2. **10%:** altere para `enabled=true` e `percentage=10`. Consulte usuários diferentes, como `ana`, `bruno`, `carla` ou `user-1`. A inclusão depende do campo `bucket`: valores de 0 a 9 entram.
3. **50%:** mantenha `enabled=true` e altere para `percentage=50`. Buckets de 0 a 49 entram, incluindo todos os usuários da etapa anterior.
4. **100%:** altere para `percentage=100`. Todos recebem `COM_RECOMENDACOES` e três recomendações.
5. **Desligamento:** altere somente `enabled=false`, mantendo `percentage=100`. Todos voltam à experiência tradicional no próximo pedido.

Compare **`instanceId` e `startedAt`** antes e depois: permanecem iguais, evidenciando que a mudança ocorreu no mesmo processo. Não encerre o Java entre as etapas. O navegador deve atualizar a URL; a resposta usa `Cache-Control: no-store`.

## Demonstração automática

Com a aplicação já rodando e usando o arquivo de configuração padrão, abra outro PowerShell nesta pasta:

```powershell
.\demo.ps1
```

O script percorre as cinco etapas para 100 usuários, imprime a quantidade incluída, confere a preservação da coorte e verifica que a instância não mudou. O arquivo original é restaurado ao final. Percentuais intermediários são aproximados em uma amostra finita, não quotas exatas.

## Organização

| Arquivo | Responsabilidade |
|---|---|
| `FlagService.java` | Ler e validar configuração; decidir inclusão com hash estável |
| `DemoController.java` | Resposta tradicional ou com recomendações; identidade da instância |
| `config/flags.properties` | Interruptor e percentual externos ao artefato |
| `FlagServiceTest.java` | Cinco testes de recarga, extremos, gradualidade, falhas e resposta |
| `demo.ps1` | Demonstração por HTTP sem reiniciar a aplicação |
| `RELATORIO.md` | Texto e metodologia para o artigo |

Rotas de leitura: `GET /api/experience?userId=ana`, `GET /api/flags`, `GET /actuator/health`. `userId` é obrigatório, não vazio e limitado a 100 caracteres. Não há endpoint público que altere a configuração; as alterações são feitas no arquivo pelo operador.

## Limites

A demonstração Java precisa executar localmente ou em hospedagem Java/Docker. GitHub Pages só serve a página estática em `docs/`, sem executar este serviço. O workflow **Feature Flags Java** compila, testa e constrói a imagem, mas não hospeda a API.

Este exemplo didático lê um arquivo pequeno a cada avaliação. Arquivo ausente, incompleto ou inválido desliga a funcionalidade (`CONFIG_UNAVAILABLE`). Ao salvar, pode haver uma leitura durante a escrita; essa janela também retorna a experiência tradicional. Em produção, use atualização atômica ou serviço de flags, controle de acesso, auditoria e coordenação entre réplicas. O identificador é informado pelo cliente para facilitar a demonstração; em produção deve vir da identidade autenticada. A flag não substitui autorização.
