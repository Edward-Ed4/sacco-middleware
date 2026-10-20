import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import '../models/receipt.dart';

/// Pure-Dart Merkle proof verifier.
///
/// The app verifies the proof locally against the root read directly from
/// the blockchain RPC node, so neither the SACCO nor the verification API
/// can make a tampered transaction appear valid.
class MerkleVerifier {
  /// Verify that [leafHex] is included in the Merkle tree
  /// whose root is [rootHex], using the provided [proof].
  ///
  /// Returns true if the proof is valid.
  static bool verify({
    required String leafHex,
    required List<MerkleProofStep> proof,
    required String rootHex,
  }) {
    try {
      Uint8List current = _hexToBytes(leafHex);

      for (final step in proof) {
        final sibling = _hexToBytes(step.sibling);
        if (step.position == 'left') {
          current = _hashPair(sibling, current);
        } else {
          current = _hashPair(current, sibling);
        }
      }

      return _bytesToHex(current) == rootHex.toLowerCase();
    } catch (_) {
      return false;
    }
  }

  /// SHA-256(left || right)
  static Uint8List _hashPair(Uint8List left, Uint8List right) {
    final combined = Uint8List(left.length + right.length);
    combined.setRange(0, left.length, left);
    combined.setRange(left.length, combined.length, right);
    final digest = sha256.convert(combined);
    return Uint8List.fromList(digest.bytes);
  }

  static Uint8List _hexToBytes(String hex) {
    final clean = hex.startsWith('0x') ? hex.substring(2) : hex;
    final result = Uint8List(clean.length ~/ 2);
    for (var i = 0; i < result.length; i++) {
      result[i] = int.parse(clean.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return result;
  }

  static String _bytesToHex(Uint8List bytes) {
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
}
