import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/command.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../modules/auth/model/auth_user_entity.dart';
import '../../../../modules/auth/provider/auth_repository.dart';
import '../../../../modules/customer/errors/customer_errors.dart';
import '../../../../modules/customer/model/customer_entity.dart';
import '../../../../modules/customer/model/customer_rules.dart';
import '../../../../modules/customer/provider/customer_repository.dart';
import '../../../../modules/customer/usecase/load_delivery_details_use_case.dart';
import '../../../shared/view_models/block_state.dart';
import '../../auth/view_models/auth_form_messages.dart';
import 'customer_masks.dart';

/// Estado da tela "Dados de entrega": a carga do cadastro ([details]), o
/// formulário ([fields] contra os valores carregados) e a gravação ([save]).
///
/// O ponto do endereço nunca é criado nem mudado aqui: o rascunho sempre leva
/// o ponto como veio da API (o do `GET`, depois o do último `PUT`), ou `null`
/// sem cadastro.
class DeliveryDetailsViewModel extends ChangeNotifier {
  DeliveryDetailsViewModel(this._loadDetails, this._customers, this._auth) {
    load = Command0<void>(_load, onStateChange: notifyListeners);
    save = Command0<Customer>(_save, onStateChange: notifyListeners);
  }

  final LoadDeliveryDetails _loadDetails;
  final CustomerRepository _customers;
  final AuthRepository _auth;

  /// Busca o cadastro e a cidade/UF da loja; é o "Tentar de novo" da tela.
  late final Command0<void> load;

  /// Valida e grava o formulário; inválido devolve a `ValidationFailure` sem
  /// chamar a API.
  late final Command0<Customer> save;

  BlockState<DeliveryDetails> _details = const BlockLoading();
  CustomerFields _initial = const CustomerFields();
  CustomerFields _fields = const CustomerFields();
  CustomerLocation? _loadedLocation;
  CustomerDraftValidation? _validated;
  Map<CustomerField, String> _serverErrors = const {};
  bool _attempted = false;
  int _formRevision = 0;

  BlockState<DeliveryDetails> get details =>
      load.running ? const BlockLoading() : _details;

  /// Conta da sessão, para o nome e o e-mail só de leitura.
  AuthUser? get user => _auth.currentUser;

  /// O cliente já tem cadastro (falso também enquanto carrega ou na falha).
  bool get hasCustomer => switch (details) {
    BlockLoaded(:final value) => value.customer != null,
    BlockLoading() || BlockFailed() => false,
  };

  /// Textos atuais do formulário.
  CustomerFields get fields => _fields;

  /// Há alteração em relação aos valores carregados (ou salvos).
  bool get isDirty => _fields != _initial;

  /// Muda a cada vez que o ViewModel reescreve os campos (carga, descarte,
  /// gravação); a página observa para reescrever os controllers.
  int get formRevision => _formRevision;

  /// Mensagem do último envio que falhou, exceto validação e recusas que
  /// ficaram todas nos campos.
  String? get formError {
    final result = save.result;
    if (result case Failure(
      failure: BackendRejectionFailure(:final codes),
    ) when _allCodesHaveField(codes)) {
      return null;
    }
    return formErrorMessage(result);
  }

  /// Erro do campo: o da recusa do servidor (até o campo mudar) ou, depois da
  /// primeira tentativa de salvar, o do value object.
  String? errorOf(CustomerField field) {
    final serverError = _serverErrors[field];
    if (serverError != null) return serverError;
    if (!_attempted) return null;
    return switch (_validation()) {
      InvalidCustomerDraft(:final errors) => errors[field],
      ValidCustomerDraft() => null,
    };
  }

  void update(CustomerField field, String value) {
    if (_fields.valueOf(field) == value) return;
    _fields = _fields.withValue(field, value);
    _validated = null;
    if (_serverErrors.containsKey(field)) {
      _serverErrors = Map.unmodifiable(Map.of(_serverErrors)..remove(field));
    }
    notifyListeners();
  }

  /// Volta aos valores carregados (ou salvos) e limpa os erros.
  void discard() {
    _resetForm(_initial);
    notifyListeners();
  }

  Future<Result<void>> _load() async {
    final result = await _loadDetails();
    switch (result) {
      case Failure(:final failure):
        _details = BlockFailed(failure);
        return Failure(failure);
      case Ok(value: final details):
        _details = BlockLoaded(details);
        _loadedLocation = details.customer?.address.location;
        _initial = switch (details.customer) {
          final customer? => _fieldsOf(customer),
          null => CustomerFields(
            city: details.defaultPlace?.city ?? '',
            state: details.defaultPlace?.state ?? '',
          ),
        };
        _resetForm(_initial);
        return const Ok(null);
    }
  }

  Future<Result<Customer>> _save() async {
    _attempted = true;
    switch (_validation()) {
      case InvalidCustomerDraft(:final errors):
        return Failure(
          ValidationFailure(
            message: errors.values.first,
            code: GenericFailureCode.unspecified,
          ),
        );
      case ValidCustomerDraft(:final draft):
        final result = await _customers.saveMine(draft);
        switch (result) {
          case Ok(value: final customer):
            _details = BlockLoaded(
              DeliveryDetails(customer: customer, defaultPlace: null),
            );
            _loadedLocation = customer.address.location;
            _initial = _fieldsOf(customer);
            _resetForm(_initial);
          case Failure(failure: BackendRejectionFailure(:final codes)):
            _serverErrors = customerFieldErrorsFromCodes(codes);
          case Failure():
            break;
        }
        return result;
    }
  }

  /// Validação dos campos atuais, refeita só quando eles mudam.
  CustomerDraftValidation _validation() =>
      _validated ??= CustomerDraft.validate(_fields, location: _loadedLocation);

  void _resetForm(CustomerFields fields) {
    _fields = fields;
    _validated = null;
    _serverErrors = const {};
    _attempted = false;
    _formRevision++;
  }

  bool _allCodesHaveField(List<String> codes) {
    if (codes.isEmpty) return false;
    return codes.every(
      (code) =>
          CustomerErrorCode.values.any((value) => value.backendCode == code),
    );
  }

  static CustomerFields _fieldsOf(Customer customer) => CustomerFields(
    cpf: formatCpfInput(customer.cpf),
    phone: formatPhoneInput(customer.phone),
    zipCode: formatZipCodeInput(customer.address.zipCode),
    street: customer.address.street,
    number: customer.address.number,
    complement: customer.address.complement ?? '',
    neighborhood: customer.address.neighborhood,
    city: customer.address.city,
    state: customer.address.state,
  );
}
