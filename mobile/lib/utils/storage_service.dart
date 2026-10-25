import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/receipt.dart';

/// Secure local storage service for caching verified receipts.
/// Uses FlutterSecureStorage (AES-256 on Android, Keychain on iOS).
class StorageService {
  static const _storage    = FlutterSecureStorage();
  static const _historyKey = 'receipt_history';
  static const _maxHistory = 50;

  /// Save a verified receipt to local history.
  static Future<void> saveReceipt(Receipt receipt) async {
    final history = await loadHistory();

    // Remove duplicate if exists
    history.removeWhere((r) => r['receiptId'] == receipt.receiptId);

    // Add to front
    history.insert(0, {
      'receiptId':   receipt.receiptId,
      'txRef':       receipt.txRef,
      'txType':      receipt.txType,
      'amount':      receipt.amount,
      'txTimestamp': receipt.txTimestamp,
      'status':      receipt.status,
      'savedAt':     DateTime.now().toIso8601String(),
    });

    // Keep only the last N entries
    if (history.length > _maxHistory) {
      history.removeRange(_maxHistory, history.length);
    }

    await _storage.write(key: _historyKey, value: jsonEncode(history));
  }

  /// Load all saved receipts from local history.
  static Future<List<Map<String, dynamic>>> loadHistory() async {
    try {
      final raw = await _storage.read(key: _historyKey);
      if (raw == null) return [];
      return (jsonDecode(raw) as List<dynamic>).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  /// Clear all saved receipts.
  static Future<void> clearHistory() async {
    await _storage.delete(key: _historyKey);
  }

  /// Save gateway base URL (configurable per SACCO deployment).
  static Future<void> saveGatewayUrl(String url) async {
    await _storage.write(key: 'gateway_url', value: url);
  }

  /// Load gateway base URL, with default fallback.
  static Future<String> loadGatewayUrl() async {
    return await _storage.read(key: 'gateway_url') ??
        const String.fromEnvironment(
          'API_BASE_URL',
          defaultValue: 'http://localhost:3000',
        );
  }
}
