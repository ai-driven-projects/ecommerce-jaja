import 'dart:async';
import 'dart:collection';

import 'package:mobile/core/result.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/customer/model/customer_rules.dart';
import 'package:mobile/modules/customer/provider/customer_repository.dart';

import 'customer_fixtures.dart';

/// [CustomerRepository] em memória para os testes de caso de uso, ViewModel,
/// página e rota, sem rede.
///
/// Cada `fetchMine` consome a próxima resposta de [enqueueFetch] ou
/// [holdFetch]; com a fila vazia, devolve `Ok(mine)`. Cada `saveMine` consome
/// a próxima de [enqueueSave] ou [holdSave]; com a fila vazia, grava o
/// rascunho em [mine] (com o id atual, ou [newCustomerId] sem cadastro) e o
/// devolve. [fetchCalls] conta as buscas; [saveCalls] guarda cada rascunho
/// recebido, na ordem.
class FakeCustomerRepository implements CustomerRepository {
  FakeCustomerRepository({this.mine});

  /// Cadastro "no servidor"; `null` sem cadastro.
  Customer? mine;

  int fetchCalls = 0;
  final List<CustomerDraft> saveCalls = [];

  final Queue<Future<Result<Customer?>>> _fetchResponses = Queue();
  final Queue<Future<Result<Customer>>> _saveResponses = Queue();

  void enqueueFetch(Result<Customer?> result) {
    _fetchResponses.add(Future.value(result));
  }

  void enqueueSave(Result<Customer> result) {
    _saveResponses.add(Future.value(result));
  }

  /// Segura o próximo `fetchMine` até o teste completar o [Completer], para
  /// observar o skeleton.
  Completer<Result<Customer?>> holdFetch() {
    final completer = Completer<Result<Customer?>>();
    _fetchResponses.add(completer.future);
    return completer;
  }

  /// Segura o próximo `saveMine` até o teste completar o [Completer], para
  /// observar o "Salvando…".
  Completer<Result<Customer>> holdSave() {
    final completer = Completer<Result<Customer>>();
    _saveResponses.add(completer.future);
    return completer;
  }

  @override
  Future<Result<Customer?>> fetchMine() {
    fetchCalls++;
    if (_fetchResponses.isEmpty) return Future.value(Ok(mine));
    return _fetchResponses.removeFirst();
  }

  @override
  Future<Result<Customer>> saveMine(CustomerDraft draft) {
    saveCalls.add(draft);
    if (_saveResponses.isNotEmpty) return _saveResponses.removeFirst();

    final saved = customerFromDraft(draft, id: mine?.id ?? newCustomerId);
    mine = saved;
    return Future.value(Ok(saved));
  }
}
