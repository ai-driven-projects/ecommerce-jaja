import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show TextInputFormatter;

import '../theme/app_typography.dart';
import '../theme/brand_tokens.dart';

/// Campo de texto de `input.tsx` com o rótulo acima (como o checkout do web)
/// e a mensagem de erro abaixo. Borda, foco, erro, raio e altura vêm do
/// `inputDecorationTheme`.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.onChanged,
    this.hintText,
    this.errorText,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.maxLength,
    this.enabled = true,
    this.autofillHints,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
  });

  final String label;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final String? hintText;

  /// Mensagem abaixo do campo; deixa a borda em perigo.
  final String? errorText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final int? maxLength;
  final bool enabled;
  final Iterable<String>? autofillHints;

  /// Máscaras e filtros aplicados a cada digitação, antes do [maxLength].
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: textTheme.fieldLabel.copyWith(color: tokens.inkSoft),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          onChanged: onChanged,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          obscureText: obscureText,
          maxLength: maxLength,
          enabled: enabled,
          autofillHints: autofillHints,
          inputFormatters: inputFormatters,
          textCapitalization: textCapitalization,
          style: textTheme.bodyMedium!.copyWith(color: tokens.ink),
          cursorColor: tokens.brand,
          decoration: InputDecoration(hintText: hintText, errorText: errorText),
        ),
      ],
    );
  }
}
