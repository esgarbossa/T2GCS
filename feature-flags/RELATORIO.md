# Implementação prática de Feature Flags com Java e Spring Boot

## Objetivo

Este experimento demonstra a ativação gradual de uma funcionalidade e seu desligamento sem novo deploy. Foi implementado um serviço Java com Spring Boot que retorna uma experiência tradicional ou uma experiência com recomendações de tarefas, conforme uma flag configurada externamente. Os dois comportamentos fazem parte do mesmo artefato executável; o operador altera apenas a configuração durante a execução.

## Fundamentação

Feature flags separam a disponibilização do código da liberação de seu comportamento aos usuários. Uma condição consultada durante a execução determina se a funcionalidade será utilizada. Isso permite manter uma implementação publicada e controlar sua exposição. A técnica exige testes para os estados da flag e gestão de seu ciclo de vida para evitar condicionais permanentes e complexidade acumulada (HODGSON, 2017).

Na liberação gradual, é desejável que um usuário permaneça no mesmo grupo entre requisições. A documentação do Unleash denomina essa propriedade *stickiness* e descreve o uso de hash determinístico para manter a atribuição estável. Aumentar o percentual pode, assim, preservar os usuários já incluídos (UNLEASH, 2026). O presente experimento implementa esse princípio diretamente em Java; não utiliza o servidor ou SDK do Unleash.

## Implementação

O módulo `feature-flags` utiliza Spring Boot 4.1.1, Maven e código compilado para Java 21. A configuração está em `config/flags.properties`, fora do JAR:

```properties
recommendations.enabled=true
recommendations.percentage=10
```

A classe `FlagService` lê esse arquivo a cada avaliação. Isso é relevante porque apenas colocar uma propriedade em `application.properties` e injetá-la com `@Value` não implementaria, por si só, a recarga demonstrada. Neste projeto, `@Value` fornece somente o caminho do arquivo; a leitura das flags ocorre explicitamente durante as consultas.

O campo `enabled` funciona como interruptor geral. Quando é falso, a funcionalidade fica desativada independentemente do percentual. Quando é verdadeiro, a inclusão depende de um grupo numérico, denominado `bucket`, entre 0 e 99. O cálculo usa SHA-256 sobre o nome da funcionalidade concatenado ao identificador do usuário, interpreta os primeiros quatro bytes como inteiro sem sinal e aplica módulo 100.

Um usuário recebe recomendações quando `bucket < percentage`. Portanto, 0% não inclui ninguém, 10% inclui buckets de 0 a 9, 50% inclui de 0 a 49 e 100% inclui todos. Como a entrada do hash não muda, a decisão é estável para o mesmo identificador e configuração. O grupo incluído em 10% é subconjunto do grupo incluído em 50%. Essa porcentagem representa uma distribuição aproximada de usuários, não uma quantidade exata de requisições ou pessoas em toda amostra.

A classe `DemoController` expõe `GET /api/experience?userId=ana`. A resposta contém o usuário, a decisão da flag, seu motivo e a experiência correspondente. No modo tradicional, a lista de recomendações fica vazia. No modo habilitado, são retornadas três sugestões fixas. O exemplo altera efetivamente o conteúdo da resposta; não se limita a mostrar o estado de um interruptor.

Também são retornados `instanceId` e `startedAt`, gerados na criação do controlador. Sua permanência ao longo das mudanças serve como evidência de que a aplicação não foi reiniciada durante o experimento. `GET /api/flags` permite observar a configuração atual e `/actuator/health` informa a saúde do serviço.

Não há rota HTTP de administração. O operador altera o arquivo local. Na opção Docker Compose, o diretório de configuração é montado externamente, de modo que o operador pode salvar uma alteração sem reconstruir a imagem.

## Procedimento experimental e resultados

A validação foi realizada em 5 de novembro de 2026, no Windows, usando JDK 26.0.1 e compilação com alvo Java 21. O comando Maven `verify` concluiu com sucesso os cinco testes automatizados. Foram verificados: recarga e desligamento no mesmo objeto; limites de 0% e 100%; estabilidade e crescimento da coorte; comportamento diante de configuração inválida ou ausente; e mudança da resposta mantendo a identidade da instância.

Em seguida, o JAR foi iniciado uma única vez e o script `demo.ps1` realizou 500 consultas HTTP: 100 identificadores (`user-1` a `user-100`) em cada uma das cinco etapas. Somente o arquivo de flags foi alterado entre as etapas.

| Etapa | enabled | percentage | Usuários com a funcionalidade |
|---|---|---|---|
| Estado inicial desligado | false | 100 | 0 de 100 |
| Liberação inicial | true | 10 | 13 de 100 |
| Ampliação | true | 50 | 45 de 100 |
| Liberação total | true | 100 | 100 de 100 |
| Desligamento geral | false | 100 | 0 de 100 |

O `instanceId` observado foi `d17249bf-171e-4fde-bcef-4c7b167b98c0` em todas as etapas. O script também verificou que todos os usuários incluídos na etapa de 10% continuaram incluídos na etapa de 50%. A checagem de saúde retornou `UP`, e uma consulta com identificador vazio foi rejeitada com HTTP 400.

Os valores 13 e 45 são resultados reais dessa amostra determinística. A diferença em relação a 10 e 50 é compatível com uma distribuição por hash sobre uma população finita, sem garantia de quota exata. Não foram medidos latência, capacidade, impacto em usuários reais ou significância estatística de resultados de negócio.

O Dockerfile e o workflow GitHub Actions foram preparados para compilar, testar e construir uma imagem. A execução local da imagem Docker não foi validada, pois o serviço Docker não estava iniciado. Os resultados HTTP apresentados foram obtidos executando diretamente o JAR, não o container. O workflow realiza integração contínua; não publica nem hospeda automaticamente esta API.

## Discussão e limitações

O experimento demonstra que a flag pode mudar o comportamento no próximo pedido sem trocar o artefato ou reiniciar o processo. Seu desligamento oferece um mecanismo de contenção para a funcionalidade protegida. Entretanto, desligar a flag não reverte gravações já realizadas, mudanças de esquema ou efeitos externos anteriores; não equivale a um rollback completo da aplicação.

O arquivo é lido a cada avaliação, uma escolha simples e observável para fins didáticos. Isso adiciona acesso ao sistema de arquivos e não representa uma solução otimizada para alta carga. Configuração ausente, incompleta, ilegível ou fora dos valores permitidos resulta em `CONFIG_UNAVAILABLE`, desativando a funcionalidade e preservando o comportamento tradicional. Durante uma gravação não atômica pode haver uma leitura intermediária; nesse caso, aplica-se o mesmo comportamento de desativação.

Em produção seriam necessários atualização atômica ou serviço centralizado de flags, controle de acesso, auditoria, observabilidade e tratamento consistente de múltiplas instâncias. O identificador de usuário, informado livremente na demonstração, deveria ser obtido da identidade autenticada para impedir que o cliente escolha seu grupo. Uma feature flag não deve substituir mecanismos de autorização. Após a liberação definitiva, deve-se avaliar a remoção da flag e do caminho antigo para reduzir a manutenção.

A página estática existente no GitHub Pages é independente desse experimento. O Pages não executa o Java nem altera o arquivo de configuração do serviço. A demonstração das flags exige executar o JAR ou hospedar o container em uma plataforma compatível.

## Conclusão

O serviço implementado cumpriu o objetivo de demonstrar liberação gradual e desligamento sem novo deploy. A configuração externa, a leitura em tempo de execução e a atribuição determinística permitiram alterar a exposição da funcionalidade mantendo a mesma instância. Os testes e as consultas HTTP forneceram evidências do comportamento nos estados desligado, parcial e integral, dentro dos limites de um experimento local e de uma única instância.

## Referências

HODGSON, Pete. *Feature Toggles (aka Feature Flags)*. 9 out. 2017. Disponível em: https://martinfowler.com/articles/feature-toggles.html. Acesso em: 5 nov. 2026.

UNLEASH. *Stickiness*. Disponível em: https://docs.getunleash.io/concepts/stickiness. Acesso em: 5 nov. 2026.

SPRING. *Spring Boot — System Requirements*. Disponível em: https://docs.spring.io/spring-boot/system-requirements.html. Acesso em: 5 nov. 2026.
