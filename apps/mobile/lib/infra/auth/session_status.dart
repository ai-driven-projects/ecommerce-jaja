/// Estado técnico da sessão, lido pela guarda de rotas e pelo interceptor.
enum SessionStatus {
  /// Abertura do app, antes de `SessionRepository.restore` decidir.
  unknown,
  authenticated,
  anonymous,
}
