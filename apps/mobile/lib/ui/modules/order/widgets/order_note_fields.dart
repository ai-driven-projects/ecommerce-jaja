import 'package:flutter/material.dart';

import '../../../../modules/order/model/order_rules.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../view_models/order_texts.dart';

/// Dados só deste pedido, abaixo do endereço: "Quem recebe" e "Instruções
/// para o entregador", limitados como na API e sem validação local (quem
/// decide é o servidor). Não são salvos no cadastro de cliente.
class OrderNoteFields extends StatelessWidget {
  const OrderNoteFields({
    super.key,
    required this.recipientController,
    required this.instructionsController,
    required this.onRecipientChanged,
    required this.onInstructionsChanged,
  });

  static const String recipientLabel = 'Quem recebe';
  static const String instructionsLabel = OrderTexts.courierInstructions;
  static const String instructionsHint =
      'Ex.: deixar na recepção do andar, falar com a Ana';

  final TextEditingController recipientController;
  final TextEditingController instructionsController;
  final ValueChanged<String> onRecipientChanged;
  final ValueChanged<String> onInstructionsChanged;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: context.tokens.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.only(top: AppSpacing.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            AppTextField(
              label: recipientLabel,
              controller: recipientController,
              onChanged: onRecipientChanged,
              maxLength: orderRecipientNameMaxLength,
              textInputAction: TextInputAction.next,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
            ),
            const SizedBox(height: AppSpacing.s12),
            AppTextField(
              label: instructionsLabel,
              hintText: instructionsHint,
              controller: instructionsController,
              onChanged: onInstructionsChanged,
              maxLength: orderDeliveryInstructionsMaxLength,
              textInputAction: TextInputAction.done,
              textCapitalization: TextCapitalization.sentences,
            ),
          ],
        ),
      ),
    );
  }
}
