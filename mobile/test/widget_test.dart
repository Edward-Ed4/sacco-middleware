import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sacco_verify/main.dart';

void main() {
  testWidgets('App launches and shows home screen', (WidgetTester tester) async {
    await tester.pumpWidget(const SaccoVerifyApp());
    expect(find.text('SACCO Receipt Verifier'), findsOneWidget);
  });
}
