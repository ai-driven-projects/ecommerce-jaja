import 'package:flutter/material.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';

/// Envolve [child] no tema da marca, como o app faz, para os widget tests.
Widget themed(Widget child) => MaterialApp(
  theme: AppTheme.light(),
  home: Scaffold(body: child),
);
