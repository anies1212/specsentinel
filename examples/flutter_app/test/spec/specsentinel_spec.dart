import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/login_page.dart';

Widget _buildScreen(String screen) {
  switch (screen) {
    case 'LoginPage':
      return const MaterialApp(home: LoginPage());
    default:
      throw UnsupportedError('Unknown screen: $screen');
  }
}

void main() {
  testWidgets('exports spec for requested screen', (tester) async {
    const screen = String.fromEnvironment('SPEC_SCREEN', defaultValue: 'LoginPage');
    const outputDir = String.fromEnvironment('SPEC_OUTPUT_DIR', defaultValue: 'build/specsentinel');

    await tester.pumpWidget(_buildScreen(screen));

    final textWidgets = tester.widgetList<Text>(find.byType(Text));
    final paddingWidgets = tester.widgetList<Padding>(find.byType(Padding));
    final gapWidgets = tester.widgetList<SizedBox>(find.byType(SizedBox));

    final spec = {
      'screenName': screen,
      'texts': textWidgets
          .map((t) => {
                'text': t.data,
                'fontSize': t.style?.fontSize,
              })
          .toList(),
      'paddings': paddingWidgets
          .map((p) => {
                'left': p.padding.left,
                'top': p.padding.top,
                'right': p.padding.right,
                'bottom': p.padding.bottom,
              })
          .toList(),
      'gaps': gapWidgets
          .map((g) => {
                'height': g.height,
                'width': g.width,
              })
          .toList(),
    };

    final outDir = Directory(outputDir);
    if (!outDir.existsSync()) {
      outDir.createSync(recursive: true);
    }
    final file = File('${outDir.path}/$screen.json');
    file.writeAsStringSync(const JsonEncoder.withIndent('  ').convert(spec));
  });
}
