import 'package:flutter/material.dart';

import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';

/// Nome e e-mail da conta da sessão, só para leitura, com o aviso de que são
/// da conta de acesso (`/me/customer` não os muda), como o "Minha conta" do
/// web.
class AccountDataCard extends StatelessWidget {
  const AccountDataCard({super.key, required this.name, required this.email});

  static const String nameLabel = 'Nome';
  static const String emailLabel = 'E-mail';
  static const String accountNote = 'Nome e email são da sua conta de acesso.';

  final String name;
  final String email;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _ReadonlyField(label: nameLabel, value: name),
        const SizedBox(height: AppSpacing.s12),
        _ReadonlyField(label: emailLabel, value: email),
        const SizedBox(height: AppSpacing.s8),
        Text(
          accountNote,
          style: textTheme.bodySmall!.copyWith(color: tokens.mutedInk),
        ),
      ],
    );
  }
}

/// Rótulo e valor no lugar do campo, sobre o fundo `surface`.
class _ReadonlyField extends StatelessWidget {
  const _ReadonlyField({required this.label, required this.value});

  final String label;
  final String value;

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
        DecoratedBox(
          decoration: BoxDecoration(
            color: tokens.surface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.s14,
              vertical: AppSpacing.s12,
            ),
            child: Text(
              value,
              style: textTheme.bodyMedium!.copyWith(color: tokens.inkSoft),
            ),
          ),
        ),
      ],
    );
  }
}
