import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/receipt.dart';

/// API service — communicates with the SACCO middleware API gateway
/// and SMS verification service.
class ApiService {
  final String gatewayBaseUrl;
  final String smsBaseUrl;

  const ApiService({
    this.gatewayBaseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000',
    ),
    this.smsBaseUrl = const String.fromEnvironment(
      'SMS_BASE_URL',
      defaultValue: 'http://localhost:3002',
    ),
  });

  /// Fetch receipt details and Merkle proof from the gateway.
  /// Used by the Flutter app after scanning a QR code.
  Future<Receipt> getReceipt(String receiptId) async {
    final uri = Uri.parse('$gatewayBaseUrl/v1/verify/$receiptId');
    final response = await http.get(uri).timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return Receipt.fromJson(json);
    } else if (response.statusCode == 404) {
      throw ReceiptNotFoundException('Receipt $receiptId not found');
    } else {
      throw ApiException('Server error: ${response.statusCode}');
    }
  }

  /// Verify a Merkle proof against a root (server-side check).
  /// The app also does this locally for full trustlessness.
  Future<bool> verifyProof({
    required String leafHex,
    required List<Map<String, dynamic>> proof,
    required String rootHex,
  }) async {
    final uri      = Uri.parse('$gatewayBaseUrl/v1/verify/proof');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'leafHex': leafHex, 'proof': proof, 'rootHex': rootHex}),
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return json['valid'] as bool;
    }
    return false;
  }

  /// Submit an SMS verification code.
  Future<SmsVerifyResult> verifySmsCode({
    required String phoneNumber,
    required String code,
    required String receiptId,
  }) async {
    final uri      = Uri.parse('$smsBaseUrl/sms/verify');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneNumber': phoneNumber,
        'code':        code,
        'receiptId':   receiptId,
      }),
    ).timeout(const Duration(seconds: 10));

    final json = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200) {
      return SmsVerifyResult(
        verified: true,
        message:  json['message'] as String? ?? 'Transaction verified.',
        receipt:  Receipt.fromJson(json),
      );
    } else {
      return SmsVerifyResult(
        verified: false,
        message:  json['error'] as String? ?? 'Verification failed.',
        attemptsRemaining: json['attemptsRemaining'] as int?,
      );
    }
  }

  /// Check gateway health.
  Future<bool> isHealthy() async {
    try {
      final response = await http
          .get(Uri.parse('$gatewayBaseUrl/health'))
          .timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

class ReceiptNotFoundException implements Exception {
  final String message;
  const ReceiptNotFoundException(this.message);
  @override
  String toString() => message;
}

class ApiException implements Exception {
  final String message;
  const ApiException(this.message);
  @override
  String toString() => message;
}

class SmsVerifyResult {
  final bool verified;
  final String message;
  final Receipt? receipt;
  final int? attemptsRemaining;

  const SmsVerifyResult({
    required this.verified,
    required this.message,
    this.receipt,
    this.attemptsRemaining,
  });
}
