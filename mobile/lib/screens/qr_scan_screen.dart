import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../providers/verification_provider.dart';
import 'result_screen.dart';

/// QR scan screen — uses the device camera to scan the signed receipt QR code.
/// Decodes the base64url payload, extracts the receiptId, and triggers verification.
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _scanned = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) async {
    if (_scanned) return;

    final barcode = capture.barcodes.firstOrNull;
    if (barcode?.rawValue == null) return;

    setState(() => _scanned = true);
    await _controller.stop();

    final raw = barcode!.rawValue!;
    String? receiptId;

    try {
      // The QR payload is base64url-encoded JSON
      final decoded = utf8.decode(base64Url.decode(base64Url.normalize(raw)));
      final json    = jsonDecode(decoded) as Map<String, dynamic>;
      receiptId     = json['receiptId'] as String?;
    } catch (_) {
      // Maybe the QR contains just the receiptId directly
      if (raw.length == 36 && raw.contains('-')) {
        receiptId = raw;
      }
    }

    if (receiptId == null) {
      _showError('Invalid QR code. Please scan a valid SACCO receipt.');
      setState(() => _scanned = false);
      await _controller.start();
      return;
    }

    if (!mounted) return;

    final provider = context.read<VerificationProvider>();
    await provider.verifyFromQr(receiptId);

    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const ResultScreen()),
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red[700]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan Receipt QR Code'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: _controller.toggleTorch,
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // Scanning overlay
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFF1A56DB), width: 3),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          Positioned(
            bottom: 60,
            left: 0, right: 0,
            child: const Text(
              'Point camera at the QR code on your receipt',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
          ),
          if (_scanned)
            Container(
              color: Colors.black54,
              child: const Center(
                child: CircularProgressIndicator(color: Color(0xFF1A56DB)),
              ),
            ),
        ],
      ),
    );
  }
}
