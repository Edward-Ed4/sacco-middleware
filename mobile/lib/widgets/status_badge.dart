import 'package:flutter/material.dart';

/// Reusable status badge widget used across the app.
class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final config = _configs[status.toUpperCase()] ?? _configs['DEFAULT']!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: config.bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: config.text,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  static const _configs = {
    'ANCHORED':   _BadgeConfig(bg: Color(0xFFDEF7EC), text: Color(0xFF057A55)),
    'VALID':      _BadgeConfig(bg: Color(0xFFDEF7EC), text: Color(0xFF057A55)),
    'PENDING':    _BadgeConfig(bg: Color(0xFFFEF3C7), text: Color(0xFF92400E)),
    'MODIFIED':   _BadgeConfig(bg: Color(0xFFFDE8E8), text: Color(0xFFE02424)),
    'DELETED':    _BadgeConfig(bg: Color(0xFFFDE8E8), text: Color(0xFFE02424)),
    'UNANCHORED': _BadgeConfig(bg: Color(0xFFFEECDC), text: Color(0xFFFF8800)),
    'DEFAULT':    _BadgeConfig(bg: Color(0xFFF3F4F6), text: Color(0xFF374151)),
  };
}

class _BadgeConfig {
  final Color bg;
  final Color text;
  const _BadgeConfig({required this.bg, required this.text});
}
