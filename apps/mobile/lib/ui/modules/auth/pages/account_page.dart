import 'package:flutter/material.dart';

import '../../../shared/widgets/placeholder_body.dart';

/// Página provisória da aba Conta.
class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(child: PlaceholderBody(title: 'Conta')),
    );
  }
}
