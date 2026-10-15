import 'package:flutter/material.dart';

import 'ui/shared/theme/app_theme.dart';

void main() {
  runApp(const JajaApp());
}

class JajaApp extends StatelessWidget {
  const JajaApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Tema único e claro: sem `darkTheme`, o modo escuro do aparelho não muda
    // o visual.
    return MaterialApp(
      title: 'Jajá',
      theme: AppTheme.light(),
      themeMode: ThemeMode.light,
      home: const Scaffold(),
    );
  }
}
