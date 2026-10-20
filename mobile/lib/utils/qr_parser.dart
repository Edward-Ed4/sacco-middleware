import 'dart:convert';

/// Parses a SACCO receipt QR payload.
/// The payload is a base64url-encoded JSON string signed with Ed25519.
class QrParser {
  /// Decode and extract fields from a scanned QR string.
  /// Returns a map of fields, or throws [QrParseException] if invalid.
  static Map<String, dynamic> parse(String raw) {
    // Try base64url JSON first (standard receipt format)
    try {
      final normalized = base64Url.normalize(raw);
      final decoded    = utf8.decode(base64Url.decode(normalized));
      final json       = jsonDecode(decoded) as Map<String, dynamic>;
      if (json.containsKey('receiptId')) return json;
    } catch (_) {}

    // Try plain JSON
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      if (json.containsKey('receiptId')) return json;
    } catch (_) {}

    // Try bare UUID (just the receiptId)
    final uuidRegex = RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      caseSensitive: false,
    );
    if (uuidRegex.hasMatch(raw.trim())) {
      return {'receiptId': raw.trim()};
    }

    throw QrParseException('Unrecognised QR format. Please scan a valid SACCO receipt QR code.');
  }

  /// Extract the receiptId from a parsed QR payload map.
  static String extractReceiptId(Map<String, dynamic> payload) {
    final id = payload['receiptId'] as String?;
    if (id == null || id.isEmpty) {
      throw QrParseException('QR code does not contain a valid receipt ID.');
    }
    return id;
  }

  /// Check whether a QR payload carries an Ed25519 signature field.
  static bool isSigned(Map<String, dynamic> payload) {
    final sig = payload['sig'] as String?;
    return sig != null && sig.isNotEmpty && sig != 'UNSIGNED_DEV';
  }
}

class QrParseException implements Exception {
  final String message;
  const QrParseException(this.message);
  @override
  String toString() => message;
}
