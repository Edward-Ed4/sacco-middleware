import 'package:flutter/material.dart';
import 'qr_scan_screen.dart';
import 'sms_verify_screen.dart';

/// Home screen — entry point for the SACCO member verification app.
/// Presents two verification channels: QR scan (smartphone) and SMS code (feature phone users).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A56DB),
        foregroundColor: Colors.white,
        title: const Text(
          'SACCO Receipt Verifier',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              const Icon(Icons.verified_user,
                  size: 72, color: Color(0xFF1A56DB)),
              const SizedBox(height: 16),
              const Text(
                'Verify Your Transaction',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A202C)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Confirm your SACCO receipt is genuine and recorded on the blockchain.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF718096)),
              ),
              const SizedBox(height: 48),
              _ChannelCard(
                icon: Icons.qr_code_scanner,
                title: 'Scan QR Code',
                subtitle:
                    'For smartphone users\nScan the QR code on your receipt',
                color: const Color(0xFF1A56DB),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const QrScanScreen()),
                ),
              ),
              const SizedBox(height: 16),
              _ChannelCard(
                icon: Icons.sms,
                title: 'Enter SMS Code',
                subtitle:
                    'For basic phone users\nEnter the 6-character code from your SMS',
                color: const Color(0xFF057A55),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SmsVerifyScreen()),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Powered by Hyperledger Besu QBFT Blockchain',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Color(0xFF718096)),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChannelCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ChannelCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style: const TextStyle(
                            color: Color(0xFF718096), fontSize: 13)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey[400]),
            ],
          ),
        ),
      ),
    );
  }
}
