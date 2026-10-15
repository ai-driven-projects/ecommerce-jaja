/// Códigos das falhas de acesso, com o texto mostrado no formulário. Textos
/// com "e-mail" e ponto final, como os demais do app (o web diz "Email ou
/// senha inválidos").
enum AuthErrorCode {
  invalidCredentials('E-mail ou senha inválidos.'),
  emailAlreadyExists('Este e-mail já está cadastrado.'),
  signInFailed('Não foi possível entrar. Tente novamente.'),
  signUpFailed('Não foi possível criar a conta. Tente novamente.');

  const AuthErrorCode(this.message);

  final String message;
}
