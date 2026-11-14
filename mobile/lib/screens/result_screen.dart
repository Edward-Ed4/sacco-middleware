import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/verification_provider.dart';
import '../models/receipt.dart';
import 'home_screen.dart';

class ResultScreen extends StatefulWidget {
  const ResultScreen({super.key});

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnim;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _scaleAnim = CurvedAnimation(parent: _controller, curve: Curves.elasticOut);
    _fadeAnim  = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider  = context.watch<VerificationProvider>();
    final state     = provider.state;
    final receipt   = provider.receipt;
    final message   = provider.message;

    final isVerified = state == VerificationState.verified && provider.proofValid;
    final isPending  = state == VerificationState.verified && !provider.proofValid;
    final isFailed   = state == VerificationState.failed || state == VerificationState.error;

    final config = _StatusConfig.from(isVerified, isPending, isFailed);

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: config.gradient),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      provider.reset();
                      Navigator.pushAndRemoveUntil(
                        context,
                        MaterialPageRoute(builder: (_) => const HomeScreen()),
                        (_) => false,
                      );
                    },
                    child: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Verification Result',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),

            // ── Content ─────────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    const SizedBox(height: 8),

                    // Status icon
                    ScaleTransition(
                      scale: _scaleAnim,
                      child: Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: config.gradient),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: config.gradient[0].withAlpha(80),
                              blurRadius: 30,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Icon(config.icon, color: Colors.white, size: 42),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Status label
                    FadeTransition(
                      opacity: _fadeAnim,
                      child: Column(
                        children: [
                          Text(
                            config.label,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: config.gradient[0],
                              letterSpacing: .5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: Text(
                              message,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF5A6476),
                                height: 1.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Transaction details
                    if (receipt != null) ...[
                      _SectionCard(
                        title: 'Transaction Details',
                        icon: Icons.receipt_long_rounded,
                        iconColor: config.gradient[0],
                        children: [
                          _DetailRow('Receipt ID', receipt.receiptId, mono: true, copy: true),
                          _DetailRow('Transaction', receipt.txRef),
                          _DetailRow('Type', receipt.txType.toUpperCase()),
                          _DetailRow('Amount', 'UGX ${_fmt(receipt.amount)}',
                              valueColor: const Color(0xFF007AFF)),
                          _DetailRow('Date', _fmtDate(receipt.txTimestamp)),
                          _DetailRow('Sequence', '#${receipt.sequenceNo}'),
                          _DetailRow('Status', receipt.status,
                              valueColor: receipt.isAnchored
                                  ? const Color(0xFF00D4AA)
                                  : const Color(0xFFD29922)),
                        ],
                      ),
                      const SizedBox(height: 14),

                      if (receipt.isAnchored)
                        _SectionCard(
                          title: 'Blockchain Record',
                          icon: Icons.link_rounded,
                          iconColor: const Color(0xFF00D4AA),
                          headerColor: const Color(0xFF00D4AA),
                          children: [
                            if (receipt.blockNumber != null)
                              _DetailRow('Block', '#${receipt.blockNumber}',
                                  valueColor: const Color(0xFF00D4AA)),
                            if (receipt.txHash != null)
                              _DetailRow('Tx Hash', receipt.txHash!,
                                  mono: true, copy: true),
                            if (receipt.merkleRoot != null)
                              _DetailRow('Merkle Root', receipt.merkleRoot!,
                                  mono: true, copy: true),
                          ],
                        ),
                    ],

                    const SizedBox(height: 24),

                    // CTA button
                    GestureDetector(
                      onTap: () {
                        provider.reset();
                        Navigator.pushAndRemoveUntil(
                          context,
                          MaterialPageRoute(builder: (_) => const HomeScreen()),
                          (_) => false,
                        );
                      },
                      child: Container(
                        width: double.infinity,
                        height: 56,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: config.gradient),
                          borderRadius: BorderRadius.circular(32),
                          boxShadow: [
                            BoxShadow(
                              color: config.gradient[0].withAlpha(80),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Text(
                            'Verify Another Receipt',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
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

  String _fmt(String amount) {
    try {
      final n = double.parse(amount);
      return n.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );
    } catch (_) { return amount; }
  }

  String _fmtDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}  ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) { return iso; }
  }
}

// ── Status config ─────────────────────────────────────────────────────────────
class _StatusConfig {
  final List<Color> gradient;
  final IconData icon;
  final String label;

  const _StatusConfig({required this.gradient, required this.icon, required this.label});

  factory _StatusConfig.from(bool verified, bool pending, bool failed) {
    if (verified) return const _StatusConfig(
      gradient: [Color(0xFF00D4AA), Color(0xFF007AFF)],
      icon: Icons.verified_rounded,
      label: 'TRANSACTION VERIFIED',
    );
    if (pending) return const _StatusConfig(
      gradient: [Color(0xFFD29922), Color(0xFFFF6B35)],
      icon: Icons.hourglass_top_rounded,
      label: 'PENDING ANCHORING',
    );
    return const _StatusConfig(
      gradient: [Color(0xFFf85149), Color(0xFFFF6B35)],
      icon: Icons.warning_amber_rounded,
      label: 'VERIFICATION FAILED',
    );
  }
}

// ── Section card ──────────────────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final Color? headerColor;
  final List<Widget> children;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.iconColor,
    this.headerColor,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: iconColor.withAlpha(20),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: (headerColor ?? iconColor).withAlpha(15),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 16, color: iconColor),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: iconColor,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }
}

// ── Detail row ────────────────────────────────────────────────────────────────
class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool mono;
  final bool copy;
  final Color? valueColor;

  const _DetailRow(this.label, this.value,
      {this.mono = false, this.copy = false, this.valueColor});

  @override
  Widget build(BuildContext context) {
    final display = mono && value.length > 20
        ? '${value.substring(0, 10)}…${value.substring(value.length - 8)}'
        : value;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label,
                style: const TextStyle(
                    color: Color(0xFF8A94A6), fontSize: 12)),
          ),
          Expanded(
            child: GestureDetector(
              onTap: copy ? () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('$label copied'),
                    duration: const Duration(seconds: 1),
                    backgroundColor: const Color(0xFF00D4AA),
                  ),
                );
              } : null,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      display,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        fontFamily: mono ? 'monospace' : null,
                        color: valueColor ?? const Color(0xFF0A1628),
                      ),
                    ),
                  ),
                  if (copy)
                    const Icon(Icons.copy_rounded,
                        size: 12, color: Color(0xFF8A94A6)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
