import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/verification_provider.dart';
import '../models/receipt.dart';
import 'home_screen.dart';

/// Result screen — shows the verification outcome after QR scan or SMS code entry.
/// VALID: green with full transaction details.
/// FAILED / tampered: red warning.
/// PENDING: yellow — recorded but not yet anchored.
class ResultScreen extends StatelessWidget {
  const ResultScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<VerificationProvider>();
    final state    = provider.state;
    final receipt  = provider.receipt;
    final message  = provider.message;

    final isVerified = state == VerificationState.verified && provider.proofValid;
    final isPending  = state == VerificationState.verified && !provider.proofValid;
    final isFailed   = state == VerificationState.failed || state == VerificationState.error;

    final Color primaryColor = isVerified
        ? const Color(0xFF057A55)
        : isPending
            ? const Color(0xFFFF8800)
            : const Color(0xFFE02424);

    final IconData statusIcon = isVerified
        ? Icons.verified
        : isPending
            ? Icons.hourglass_top
            : Icons.warning_amber;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A56DB),
        foregroundColor: Colors.white,
        title: const Text('Verification Result'),
        automaticallyImplyLeading: false,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(vertical: 24),
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: primaryColor.withOpacity(0.3)),
                ),
                child: Column(
                  children: [
                    Icon(statusIcon, size: 64, color: primaryColor),
                    const SizedBox(height: 12),
                    Text(
                      isVerified ? 'TRANSACTION VERIFIED' : isPending ? 'PENDING ANCHORING' : 'VERIFICATION FAILED',
                      style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        message,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: primaryColor.withOpacity(0.8)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Transaction details (only when receipt is available)
              if (receipt != null) ...[
                const Text(
                  'Transaction Details',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                _DetailCard(receipt: receipt),
                const SizedBox(height: 16),

                // Blockchain info
                if (receipt.isAnchored) ...[
                  const Text(
                    'Blockchain Record',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _BlockchainCard(receipt: receipt),
                ],
              ],

              const SizedBox(height: 32),
              // Verify another
              ElevatedButton(
                onPressed: () {
                  provider.reset();
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const HomeScreen()),
                    (_) => false,
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A56DB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Verify Another Receipt', style: TextStyle(fontSize: 16)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  final Receipt receipt;
  const _DetailCard({required this.receipt});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _Row('Receipt ID',   receipt.receiptId, mono: true),
            _Row('Transaction',  receipt.txRef),
            _Row('Type',         receipt.txType.toUpperCase()),
            _Row('Amount',       'UGX ${_fmt(receipt.amount)}'),
            _Row('Date/Time',    receipt.txTimestamp),
            _Row('Sequence',     '#${receipt.sequenceNo}'),
            _Row('Status',       receipt.status),
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
    } catch (_) {
      return amount;
    }
  }
}

class _BlockchainCard extends StatelessWidget {
  final Receipt receipt;
  const _BlockchainCard({required this.receipt});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      color: const Color(0xFFF0FDF4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            if (receipt.blockNumber != null)
              _Row('Block Number', receipt.blockNumber.toString()),
            if (receipt.txHash != null)
              _Row('Tx Hash', receipt.txHash!, mono: true),
            if (receipt.merkleRoot != null)
              _Row('Merkle Root', receipt.merkleRoot!, mono: true),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final bool mono;
  const _Row(this.label, this.value, {this.mono = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: const TextStyle(color: Color(0xFF718096), fontSize: 13)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                fontFamily: mono ? 'monospace' : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
