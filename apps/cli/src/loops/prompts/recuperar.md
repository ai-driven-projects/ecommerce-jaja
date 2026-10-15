Passo **RECUPERAR UMA FALHA** do loop `{{LOOP}}`: etapa {{NUMERO}} de {{TOTAL}}, change `{{NOME}}`.

Esta sessão começa com **contexto limpo**. O passo **{{PASSO}}** falhou, e o loop
só segue para o próximo passo se você deixar o resultado dele pronto. Quem confere
é o script, com esta checagem:

> {{SUCESSO}}

## O erro

```
{{ERRO}}
```

## Relatório da falha

{{RELATORIO}}

## Estado do repositório (escopo e change)

```
{{STATUS}}
```

```
{{DIFF}}
```

## Recuperações anteriores deste passo

{{ANTERIORES}}

## O que fazer

1. Descubra a **causa** do erro: leia os arquivos, os logs citados no relatório e
   a change (`proposal.md`, `design.md`, specs, `tasks.md`).
2. Corrija com a menor mudança que deixa a checagem acima verdadeira, sem sair do
   escopo da change. Pode completar tarefas, ajustar artefatos OpenSpec, corrigir
   código e testes, arquivar a change, o que a checagem pedir.
3. **Nunca** "resolva" desligando verificações: nada de pular ou apagar testes,
   `skip`/`only`, comentários que silenciam o analisador ou o lint, regras
   desligadas. O script recusa essas correções.
4. Não repita o que uma recuperação anterior já tentou sem sucesso.
5. Se a solução depende de uma pessoa (credencial, permissão, acesso, decisão de
   produto, algo fora do escopo do loop), não contorne: responda
   `needsHuman: true` e diga em `whatToDo`, numa ou duas frases, o que a
   pessoa precisa fazer.

Responda com:
- `resolved`: se você acredita que a checagem agora passa;
- `cause`: a causa do erro, em uma ou duas frases;
- `whatItDid`: o que você mudou (arquivos e o porquê), em poucas linhas;
- `needsHuman`: verdadeiro só se uma pessoa precisa agir;
- `whatToDo`: a ação da pessoa (vazio quando `needsHuman` é falso).
