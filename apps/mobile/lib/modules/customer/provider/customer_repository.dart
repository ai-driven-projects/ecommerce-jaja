import '../../../core/result.dart';
import '../model/customer_entity.dart';
import '../model/customer_rules.dart';

/// Cadastro de cliente do usuário da sessão. Nada é guardado entre chamadas:
/// cada abertura da tela busca de novo.
abstract interface class CustomerRepository {
  /// Cadastro atual; `Ok(null)` quando o usuário ainda não tem cadastro.
  Future<Result<Customer?>> fetchMine();

  /// Cria ou altera o cadastro com [draft] e devolve o cadastro gravado. As
  /// recusas do backend voltam como falha HTTP, com os códigos.
  Future<Result<Customer>> saveMine(CustomerDraft draft);
}
