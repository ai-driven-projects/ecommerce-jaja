import 'package:flutter/material.dart';

void main() {
  runApp(const JajaApp());
}

class JajaApp extends StatelessWidget {
  const JajaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(title: 'Jajá', home: SizedBox.shrink());
  }
}
