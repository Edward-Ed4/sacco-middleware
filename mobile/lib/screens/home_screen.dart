import 'package:flutter/material.dart';
import 'qr_scan_screen.dart';
import 'sms_verify_screen.dart';
import 'history_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF00D4AA), Color(0xFF007AFF)],
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'SACCO Verify',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          letterSpacing: .5,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.push(context,
                            MaterialPageRoute(builder: (_) => const SettingsScreen())),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(50),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.settings_outlined,
                              color: Colors.white, size: 20),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Verify Your Transaction',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Confirm your SACCO receipt is genuine\nand recorded on the blockchain.',
                    style: TextStyle(
                      color: Colors.white.withAlpha(200),
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),

            // ── Channels ────────────────────────────────────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    const SizedBox(height: 8),
                    const Text(
                      'Choose verification method',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF8A94A6),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 20),

                    // QR Card
                    _ChannelCard(
                      gradient: const [Color(0xFF00D4AA), Color(0xFF007AFF)],
                      icon: Icons.qr_code_scanner_rounded,
                      title: 'Scan QR Code',
                      subtitle: 'For smartphone users\nScan the QR code on your receipt',
                      tag: 'Recommended',
                      onTap: () => Navigator.push(context,
                          MaterialPageRoute(builder: (_) => const QrScanScreen())),
                    ),
                    const SizedBox(height: 14),

                    // SMS Card
                    _ChannelCard(
                      gradient: const [Color(0xFF7B61FF), Color(0xFF00D4AA)],
                      icon: Icons.sms_rounded,
                      title: 'Enter SMS Code',
                      subtitle: 'For basic phone users\nEnter the 6-character code from SMS',
                      tag: 'All phones',
                      onTap: () => Navigator.push(context,
                          MaterialPageRoute(builder: (_) => const SmsVerifyScreen())),
                    ),
                    const SizedBox(height: 14),

                    // History Card
                    _ChannelCard(
                      gradient: const [Color(0xFF0070F3), Color(0xFF7B61FF)],
                      icon: Icons.history_rounded,
                      title: 'Verification History',
                      subtitle: 'View previously verified receipts\nstored on this device',
                      tag: 'Local cache',
                      onTap: () => Navigator.push(context,
                          MaterialPageRoute(builder: (_) => const HistoryScreen())),
                    ),

                    const Spacer(),

                    // Footer
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00D4AA).withAlpha(20),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF00D4AA).withAlpha(50),
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.shield_rounded,
                              size: 14, color: Color(0xFF00D4AA)),
                          SizedBox(width: 6),
                          Text(
                            'Secured by Hyperledger Besu QBFT Blockchain',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF00D4AA),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChannelCard extends StatelessWidget {
  final List<Color> gradient;
  final IconData icon;
  final String title;
  final String subtitle;
  final String tag;
  final VoidCallback onTap;

  const _ChannelCard({
    required this.gradient,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.tag,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: gradient[0].withAlpha(30),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            // Icon circle
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: gradient),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: Colors.white, size: 26),
            ),
            const SizedBox(width: 14),

            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0A1628),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: gradient[0].withAlpha(30),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          tag,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: gradient[0],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF8A94A6),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),

            // Arrow
            Icon(Icons.arrow_forward_ios_rounded,
                size: 14, color: gradient[0]),
          ],
        ),
      ),
    );
  }
}
