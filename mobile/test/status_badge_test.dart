import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sacco_verify/widgets/status_badge.dart';

void main() {
  testWidgets('normalizes known statuses and exposes a useful semantic label',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: StatusBadge(status: ' pending ')),
      ),
    );

    expect(find.text('PENDING'), findsOneWidget);
    expect(
      tester.getSemantics(find.byType(StatusBadge)),
      matchesSemantics(label: 'Status: PENDING'),
    );
  });

  testWidgets('shows unknown for an empty status', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: StatusBadge(status: '  ')),
      ),
    );

    expect(find.text('UNKNOWN'), findsOneWidget);
  });
}
