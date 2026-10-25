import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';
import '../widgets/status_badge.dart';
import 'result_screen.dart';
import 'package:provider/provider.dart';
import '../providers/verification_provider.dart';

/// History screen — shows previously verified receipts cached locally
/// in secure storage. Members can re-verify any past receipt.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final _storage = const FlutterSecureStorage();
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final raw = await _storage.read(key: 'receipt_history');
      if (raw != null) {
        final list = jsonDecode(raw) as List<dynamic>;
        setState(() {
          _history = list.cast<Map<String, dynamic>>().reversed.toList();
        });
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  Future<void> _clearHistory() async {
    await _storage.delete(key: 'receipt_history');
    setState(() => _history = []);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A56DB),
        foregroundColor: Colors.white,
        title: const Text('Verification History'),
        actions: [
          if (_history.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Clear history',
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('Clear History'),
                    content: const Text('Remove all saved receipts from this device?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                      TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('Clear', style: TextStyle(color: Colors.red))),
                    ],
                  ),
                );
                if (confirm == true) _clearHistory();
              },
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _history.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.history, size: 64, color: Color(0xFFCBD5E0)),
                      SizedBox(height: 12),
                      Text('No verification history yet',
                          style: TextStyle(color: Color(0xFF718096), fontSize: 16)),
                      SizedBox(height: 8),
                      Text('Verified receipts will appear here',
                          style: TextStyle(color: Color(0xFFA0AEC0), fontSize: 13)),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _history.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final item = _history[i];
                    return Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: ListTile(
                        leading: const Icon(Icons.receipt_long, color: Color(0xFF1A56DB)),
                        title: Text(
                          item['txRef'] ?? 'Unknown',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          'UGX ${item['amount'] ?? '—'} • ${item['txType'] ?? '—'}',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: StatusBadge(status: item['status'] ?? 'PENDING'),
                        onTap: () async {
                          final provider = context.read<VerificationProvider>();
                          await provider.verifyFromQr(item['receiptId']);
                          if (!context.mounted) return;
                          Navigator.push(context,
                              MaterialPageRoute(builder: (_) => const ResultScreen()));
                        },
                      ),
                    );
                  },
                ),
    );
  }
}
