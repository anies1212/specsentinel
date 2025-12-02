import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/login_page.dart';

void main() {
  testWidgets('exports spec for LoginPage', (tester) async {
    const screen = 'LoginPage';
    const outputDir = 'build/specsentinel';

    await tester.pumpWidget(const MaterialApp(home: LoginPage()));

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
