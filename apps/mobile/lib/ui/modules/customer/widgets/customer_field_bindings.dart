import 'package:flutter/widgets.dart';

import '../../../../modules/customer/errors/customer_errors.dart';

/// Ligação dos campos do formulário com a página: o controller de cada
/// campo, o erro a mostrar e o aviso de mudança. Compartilhada por
/// `PersonalDataFields` e `AddressFields`.
class CustomerFieldBindings {
  const CustomerFieldBindings({
    required this.controllerOf,
    required this.errorOf,
    required this.onChanged,
    this.enabled = true,
  });

  final TextEditingController Function(CustomerField field) controllerOf;
  final String? Function(CustomerField field) errorOf;
  final void Function(CustomerField field, String value) onChanged;

  /// Falso durante o envio, como o web.
  final bool enabled;
}
