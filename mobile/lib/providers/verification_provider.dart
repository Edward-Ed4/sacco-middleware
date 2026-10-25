import 'package:flutter/material.dart';
import '../models/receipt.dart';
import '../services/api_service.dart';
import '../utils/merkle_verifier.dart';

enum VerificationState { idle, loading, verified, failed, error }

/// State provider for the verification flow.
/// Shared between the QR scan screen and the SMS verification screen.
class VerificationProvider extends ChangeNotifier {
  final ApiService _api;

  VerificationProvider({ApiService? api})
      : _api = api ?? const ApiService();

  VerificationState _state = VerificationState.idle;
  Receipt?          _receipt;
  bool              _proofValid = false;
  String            _message    = '';

  VerificationState get state      => _state;
  Receipt?          get receipt    => _receipt;
  bool              get proofValid => _proofValid;
  String            get message    => _message;

  /// Called after the QR scanner decodes a payload.
  /// Fetches the receipt from the API and verifies the Merkle proof.
  Future<void> verifyFromQr(String receiptId) async {
    _state   = VerificationState.loading;
    _message = 'Fetching receipt...';
    notifyListeners();

    try {
      final receipt = await _api.getReceipt(receiptId);
      _receipt = receipt;

      if (receipt.merkleProof != null && receipt.merkleRoot != null) {
        _message = 'Verifying Merkle proof...';
        notifyListeners();

        _proofValid = MerkleVerifier.verify(
          leafHex:  receipt.leafHex,
          proof:    receipt.merkleProof!,
          rootHex:  receipt.merkleRoot!,
        );

        if (_proofValid && receipt.isAnchored) {
          _state   = VerificationState.verified;
          _message = 'Transaction verified and anchored on blockchain.';
        } else if (!_proofValid) {
          _state   = VerificationState.failed;
          _message = 'WARNING: Merkle proof invalid. This receipt may have been tampered with.';
        } else {
          _state   = VerificationState.verified;
          _message = 'Transaction recorded. Blockchain anchoring pending.';
        }
      } else {
        // Not anchored yet
        _proofValid = false;
        _state   = VerificationState.verified;
        _message = receipt.isPending
            ? 'Transaction recorded. Awaiting blockchain anchoring.'
            : 'Transaction found but not yet anchored.';
      }
    } on ReceiptNotFoundException {
      _state   = VerificationState.failed;
      _message = 'Receipt not found. This QR code may be invalid.';
    } catch (e) {
      _state   = VerificationState.error;
      _message = 'Connection error: ${e.toString()}';
    }

    notifyListeners();
  }

  /// Called after the member submits their SMS code.
  Future<void> verifyFromSms({
    required String phoneNumber,
    required String code,
    required String receiptId,
  }) async {
    _state   = VerificationState.loading;
    _message = 'Verifying code...';
    notifyListeners();

    try {
      final result = await _api.verifySmsCode(
        phoneNumber: phoneNumber,
        code:        code,
        receiptId:   receiptId,
      );

      if (result.verified) {
        final receipt = result.receipt;
        _receipt = receipt;

        if (receipt?.merkleProof != null && receipt?.merkleRoot != null) {
          _proofValid = MerkleVerifier.verify(
            leafHex: receipt!.leafHex,
            proof: receipt.merkleProof!,
            rootHex: receipt.merkleRoot!,
          );
          _state = _proofValid
              ? VerificationState.verified
              : VerificationState.failed;
          _message = _proofValid
              ? result.message
              : 'WARNING: Merkle proof invalid. This receipt may have been tampered with.';
        } else {
          _proofValid = false;
          _state = VerificationState.verified;
          _message = 'Verification code accepted. Blockchain anchoring is pending.';
        }
      } else {
        _state   = VerificationState.failed;
        _message = result.attemptsRemaining != null
            ? '${result.message} (${result.attemptsRemaining} attempts remaining)'
            : result.message;
      }
    } catch (e) {
      _state   = VerificationState.error;
      _message = 'Connection error: ${e.toString()}';
    }

    notifyListeners();
  }

  void reset() {
    _state      = VerificationState.idle;
    _receipt    = null;
    _proofValid = false;
    _message    = '';
    notifyListeners();
  }
}
