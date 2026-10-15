import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../ui/shared/theme/app_theme.dart';
import 'router/app_router.dart';

class JajaApp extends StatefulWidget {
  const JajaApp({super.key});

  @override
  State<JajaApp> createState() => _JajaAppState();
}

class _JajaAppState extends State<JajaApp> {
  // No estado, para um rebuild do app não recriar as pilhas das abas.
  late final GoRouter _router = buildAppRouter();

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Tema único e claro: sem `darkTheme`, o modo escuro do aparelho não muda
    // o visual.
    return MaterialApp.router(
      routerConfig: _router,
      title: 'Jajá',
      theme: AppTheme.light(),
      themeMode: ThemeMode.light,
      debugShowCheckedModeBanner: false,
    );
  }
}
