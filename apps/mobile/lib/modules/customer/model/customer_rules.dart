import '../../../core/result.dart';
import '../../../core/value_objects/bounded_text.dart';
import '../../../core/value_objects/cpf.dart';
import '../../../core/value_objects/phone.dart';
import '../../../core/value_objects/state_code.dart';
import '../../../core/value_objects/zip_code.dart';
import '../errors/customer_errors.dart';
import 'customer_entity.dart';

// Limites copiados de `CUSTOMER_ADDRESS_LIMITS`
// (`modules/customers/src/customer/model/customer-address.vo.ts`), aplicados
// ao texto aparado.

typedef TextLength = ({int min, int max});

const customerStreetLength = (min: 2, max: 120);
const customerNumberLength = (min: 1, max: 10);

/// O complemento é opcional: vazio vira `null`, sem mínimo.
const customerComplementLength = (min: 1, max: 80);
const customerNeighborhoodLength = (min: 2, max: 60);
const customerCityLength = (min: 2, max: 60);

/// Os nove textos do formulário de dados de entrega, como foram digitados.
final class CustomerFields {
  const CustomerFields({
    this.cpf = '',
    this.phone = '',
    this.zipCode = '',
    this.street = '',
    this.number = '',
    this.complement = '',
    this.neighborhood = '',
    this.city = '',
    this.state = '',
  });

  final String cpf;
  final String phone;
  final String zipCode;
  final String street;
  final String number;
  final String complement;
  final String neighborhood;
  final String city;
  final String state;

  String valueOf(CustomerField field) => switch (field) {
    CustomerField.cpf => cpf,
    CustomerField.phone => phone,
    CustomerField.zipCode => zipCode,
    CustomerField.street => street,
    CustomerField.number => number,
    CustomerField.complement => complement,
    CustomerField.neighborhood => neighborhood,
    CustomerField.city => city,
    CustomerField.state => state,
  };

  /// Cópia com [field] trocado por [value].
  CustomerFields withValue(CustomerField field, String value) => CustomerFields(
    cpf: field == CustomerField.cpf ? value : cpf,
    phone: field == CustomerField.phone ? value : phone,
    zipCode: field == CustomerField.zipCode ? value : zipCode,
    street: field == CustomerField.street ? value : street,
    number: field == CustomerField.number ? value : number,
    complement: field == CustomerField.complement ? value : complement,
    neighborhood: field == CustomerField.neighborhood ? value : neighborhood,
    city: field == CustomerField.city ? value : city,
    state: field == CustomerField.state ? value : state,
  );

  @override
  bool operator ==(Object other) =>
      other is CustomerFields &&
      CustomerField.values.every(
        (field) => other.valueOf(field) == valueOf(field),
      );

  @override
  int get hashCode => Object.hashAll(CustomerField.values.map(valueOf));

  @override
  String toString() => 'CustomerFields(${CustomerField.values.map(valueOf)})';
}

/// Dados prontos para `PUT /me/customer`: [cpf], [phone] e [zipCode] só com
/// dígitos, [state] em maiúsculas, textos aparados e [complement] `null`
/// quando vazio. [location] é obrigatório no construtor para nenhum caminho
/// esquecer o ponto: é o do cadastro carregado, ou `null` sem cadastro.
final class CustomerDraft {
  const CustomerDraft({
    required this.cpf,
    required this.phone,
    required this.zipCode,
    required this.street,
    required this.number,
    required this.complement,
    required this.neighborhood,
    required this.city,
    required this.state,
    required this.location,
  });

  final String cpf;
  final String phone;
  final String zipCode;
  final String street;
  final String number;
  final String? complement;
  final String neighborhood;
  final String city;
  final String state;
  final CustomerLocation? location;

  /// Roda os value objects em todos os campos de [fields]. Válidos, devolve
  /// [ValidCustomerDraft] com o rascunho normalizado e [location] repassado
  /// sem mudança; senão, [InvalidCustomerDraft] com uma mensagem por campo
  /// inválido.
  static CustomerDraftValidation validate(
    CustomerFields fields, {
    required CustomerLocation? location,
  }) {
    final errors = <CustomerField, String>{};

    String? check<T>(
      CustomerField field,
      Result<T> result,
      String Function(T value) read,
    ) {
      switch (result) {
        case Ok(:final value):
          return read(value);
        case Failure(:final failure):
          errors[field] = failure.message;
          return null;
      }
    }

    String? text(CustomerField field, TextLength length) => check(
      field,
      BoundedText.create(
        fields.valueOf(field),
        min: length.min,
        max: length.max,
      ),
      (text) => text.value,
    );

    final cpf = check(
      CustomerField.cpf,
      Cpf.create(fields.cpf),
      (cpf) => cpf.value,
    );
    final phone = check(
      CustomerField.phone,
      Phone.create(fields.phone),
      (phone) => phone.value,
    );
    final zipCode = check(
      CustomerField.zipCode,
      ZipCode.create(fields.zipCode),
      (zipCode) => zipCode.value,
    );
    final street = text(CustomerField.street, customerStreetLength);
    final number = text(CustomerField.number, customerNumberLength);
    final complement = fields.complement.trim().isEmpty
        ? null
        : text(CustomerField.complement, customerComplementLength);
    final neighborhood = text(
      CustomerField.neighborhood,
      customerNeighborhoodLength,
    );
    final city = text(CustomerField.city, customerCityLength);
    final state = check(
      CustomerField.state,
      StateCode.create(fields.state),
      (state) => state.value,
    );

    if (errors.isNotEmpty) {
      return InvalidCustomerDraft(Map.unmodifiable(errors));
    }

    return ValidCustomerDraft(
      CustomerDraft(
        cpf: cpf!,
        phone: phone!,
        zipCode: zipCode!,
        street: street!,
        number: number!,
        complement: complement,
        neighborhood: neighborhood!,
        city: city!,
        state: state!,
        location: location,
      ),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is CustomerDraft &&
      other.cpf == cpf &&
      other.phone == phone &&
      other.zipCode == zipCode &&
      other.street == street &&
      other.number == number &&
      other.complement == complement &&
      other.neighborhood == neighborhood &&
      other.city == city &&
      other.state == state &&
      other.location == location;

  @override
  int get hashCode => Object.hash(
    cpf,
    phone,
    zipCode,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    location,
  );

  @override
  String toString() =>
      'CustomerDraft($cpf, $phone, $zipCode, $street, $number, $complement, '
      '$neighborhood, $city, $state, $location)';
}

/// Resultado de [CustomerDraft.validate]: o rascunho ou os erros por campo.
sealed class CustomerDraftValidation {
  const CustomerDraftValidation();
}

final class ValidCustomerDraft extends CustomerDraftValidation {
  const ValidCustomerDraft(this.draft);

  final CustomerDraft draft;
}

final class InvalidCustomerDraft extends CustomerDraftValidation {
  const InvalidCustomerDraft(this.errors);

  /// Mensagem do value object de cada campo inválido.
  final Map<CustomerField, String> errors;
}
