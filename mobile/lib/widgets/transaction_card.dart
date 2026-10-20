import 'package:flutter/material.dart';
import '../models/receipt.dart';
import 'status_badge.dart';

/// Displays a transaction receipt summary card.
/// Used on the result screen and history screen.
class TransactionCard extends StatelessWidget {
  final Receipt receipt;
  final bool showBlockchain;

  const TransactionCard({
    super.key,
    required this.receipt,
    this.showBlockchain = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                const Icon(Icons.receipt_long, color: Color(0xFF1A56DB), size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    receipt.txRef,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ),
                StatusBadge(status: receipt.status),
              ],
            ),
            const Divider(height: 20),

            // Amount — most prominent field
            Center(
              child: Column(
                children: [
                  Text(
                    'UGX ${_formatAmount(receipt.amount)}',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A56DB),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    receipt.txType.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF718096),
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 20),

            // Details
            _DetailRow('Date', _formatDate(receipt.txTimestamp)),
            _DetailRow('Receipt ID', receipt.receiptId, mono: true, truncate: true),
            _DetailRow('Sequence', '#${receipt.sequenceNo}'),

            if (showBlockchain && receipt.isAnchored) ...[
              const Divider(height: 20),
              const Row(
                children: [
                  Icon(Icons.link, size: 14, color: Color(0xFF057A55)),
                  SizedBox(width: 6),
                  Text('On Blockchain', style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF057A55),
                  )),
                ],
              ),
              const SizedBox(height: 8),
              if (receipt.blockNumber != null)
                _DetailRow('Block', receipt.blockNumber.toString()),
              if (receipt.txHash != null)
                _DetailRow('Tx Hash', receipt.txHash!, mono: true, truncate: true),
            ],
          ],
        ),
      ),
    );
  }

  String _formatAmount(String amount) {
    try {
      final n = double.parse(amount);
      final parts = n.toStringAsFixed(0).split('');
      final result = StringBuffer();
      for (int i = 0; i < parts.length; i++) {
        if (i > 0 && (parts.length - i) % 3 == 0) result.write(',');
        result.write(parts[i]);
      }
      return result.toString();
    } catch (_) {
      return amount;
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}  ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) {
      return iso;
    }
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool mono;
  final bool truncate;

  const _DetailRow(this.label, this.value, {this.mono = false, this.truncate = false});

  @override
  Widget build(BuildContext context) {
    final display = truncate && value.length > 20
        ? '${value.substring(0, 8)}...${value.substring(value.length - 6)}'
        : value;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(label, style: const TextStyle(color: Color(0xFF718096), fontSize: 13)),
          ),
          Expanded(
            child: Text(
              display,
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
