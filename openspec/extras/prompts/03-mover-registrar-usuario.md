O caso de uso `modules/auth/src/user/use-case/create-user.use-case.ts` deve ser movido para pasta `modules/auth/src/app/use-case` visto que esse caso de usa dois agregados `user` e `password`.

> Esse é um padrão do projeto, casos de uso que trabalham com multiplas entidades são organizados na pasta `app` dentro do raiz do módulo.
