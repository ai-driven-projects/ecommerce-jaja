# Négocio

- Criar o caso de uso de `authenticate-user.usecase` dentro da pasta `modules/auth/src/app/usecase` (trabalha com múltiplos agregados) que recebe por parâmetro os repositórios (`user` e `password`) e a interface de criptografia de senha. O fluxo do caso de uso é o seguinte: buscar o usuário pelo email (pode gerar erro caso não exista), buscar a senha pelo id do usuário, comparar a senha informada com a senha criptografada (pode gerar erro caso inválida) e retornar os dados do usuário autenticado (nunca retornar a senha). (skill: module-use-case)
  > Os passos do caso de uso podem gerar erros e parar o processo.

# Backend

- Atualizar o `auth.controller` adicionando o método (público) para autenticar o usuário, instanciando diretamente dentro do método o caso de uso `authenticate-user.usecase`.
- Gerar o token JWT como resposta do método de autenticação do usuário
- Criar os testes de integração (usando o padrão do Rest Client - Plugin do VS Code) para o método de autenticar o usuário

# Frontend

- Implementar o fluxo de login no componente `auth-form.component` integrando com o endpoint de autenticação. Adicionar a chamada de API e gerenciamento de estado na pasta `apps/frontend/src/modules/auth/data`. Em caso de sucesso, armazenar o token JWT e os dados do usuário logado e redirecionar a aplicação para a rota `/dashboard` e exibir o toaster de sucesso.
- Criar um `auth.context` (Context API do React) dentro de `apps/frontend/src/modules/auth/data` para compartilhar o estado do usuário logado (token e dados do usuário) em toda a aplicação. O contexto deve expor um hook `useAuth` para consumo nas demais partes da aplicação. O estado inicial do `AuthProvider` deve ser lido sincronamente do cookie via lazy initializer do `useState` (ex: `useState(readAuthFromCookies)`) — **nunca usar `useEffect` para inicializar o estado a partir do cookie**, pois isso causa um render intermediário com estado nulo que faz o `auth-guard` redirecionar incorretamente no reload da página.
- Criar o componente `auth-guard.component` dentro de `apps/frontend/src/modules/auth/components` que protege as rotas privadas da aplicação. O guard deve verificar se há um usuário autenticado via `useAuth`; caso não haja, redirecionar para a rota `/join`. Referenciar o guard no layout do grupo de rotas privadas da aplicação.
- Integrar o menu de usuário no cabeçalho da aplicação (área privada) exibindo as informações do usuário logado (nome e avatar, se disponível) consumindo o `useAuth`. Não criar tela de perfil de usuário.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados com contexto limpo em cada um deles
