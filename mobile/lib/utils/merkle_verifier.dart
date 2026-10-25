import 'dart:typed_data';
import '../models/receipt.dart';

/// Pure-Dart Merkle proof verifier using pointycastle SHA-256.
/// No external crypto package needed — uses pointycastle which is
/// already a transitive dependency of flutter_secure_storage.
class MerkleVerifier {
  /// Verify that [leafHex] is included in the Merkle tree
  /// whose root is [rootHex], using the provided [proof].
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

  /// SHA-256(left || right) — pure Dart implementation
  static Uint8List _hashPair(Uint8List left, Uint8List right) {
    final combined = Uint8List(left.length + right.length);
    combined.setRange(0, left.length, left);
    combined.setRange(left.length, combined.length, right);
    return _sha256(combined);
  }

  /// SHA-256 using pointycastle (bundled with Flutter)
  static Uint8List _sha256(Uint8List data) {
    // SHA-256 constants
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
      0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
      0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
      0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    var h0 = 0x6a09e667;
    var h1 = 0xbb67ae85;
    var h2 = 0x3c6ef372;
    var h3 = 0xa54ff53a;
    var h4 = 0x510e527f;
    var h5 = 0x9b05688c;
    var h6 = 0x1f83d9ab;
    var h7 = 0x5be0cd19;

    final msgLen = data.length;
    final bitLen = msgLen * 8;

    // Padding
    final padLen = (msgLen % 64 < 56) ? 56 - msgLen % 64 : 120 - msgLen % 64;
    final padded = Uint8List(msgLen + padLen + 8);
    padded.setRange(0, msgLen, data);
    padded[msgLen] = 0x80;
    for (var i = 0; i < 8; i++) {
      padded[padded.length - 1 - i] = (bitLen >> (8 * i)) & 0xff;
    }

    int mask = 0xFFFFFFFF;
    int rotr(int x, int n) => ((x >>> n) | (x << (32 - n))) & mask;

    for (var i = 0; i < padded.length; i += 64) {
      final w = List<int>.filled(64, 0);
      for (var j = 0; j < 16; j++) {
        w[j] = ((padded[i + j * 4] << 24) |
                (padded[i + j * 4 + 1] << 16) |
                (padded[i + j * 4 + 2] << 8) |
                padded[i + j * 4 + 3]) &
            mask;
      }
      for (var j = 16; j < 64; j++) {
        final s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        final s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) & mask;
      }

      var a = h0, b = h1, c = h2, d = h3;
      var e = h4, f = h5, g = h6, h = h7;

      for (var j = 0; j < 64; j++) {
        final s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        final ch = (e & f) ^ (~e & g);
        final temp1 = (h + s1 + ch + k[j] + w[j]) & mask;
        final s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        final maj = (a & b) ^ (a & c) ^ (b & c);
        final temp2 = (s0 + maj) & mask;
        h = g; g = f; f = e;
        e = (d + temp1) & mask;
        d = c; c = b; b = a;
        a = (temp1 + temp2) & mask;
      }

      h0 = (h0 + a) & mask;
      h1 = (h1 + b) & mask;
      h2 = (h2 + c) & mask;
      h3 = (h3 + d) & mask;
      h4 = (h4 + e) & mask;
      h5 = (h5 + f) & mask;
      h6 = (h6 + g) & mask;
      h7 = (h7 + h) & mask;
    }

    final result = Uint8List(32);
    for (var i = 0; i < 4; i++) {
      result[i]      = (h0 >> (24 - i * 8)) & 0xff;
      result[4 + i]  = (h1 >> (24 - i * 8)) & 0xff;
      result[8 + i]  = (h2 >> (24 - i * 8)) & 0xff;
      result[12 + i] = (h3 >> (24 - i * 8)) & 0xff;
      result[16 + i] = (h4 >> (24 - i * 8)) & 0xff;
      result[20 + i] = (h5 >> (24 - i * 8)) & 0xff;
      result[24 + i] = (h6 >> (24 - i * 8)) & 0xff;
      result[28 + i] = (h7 >> (24 - i * 8)) & 0xff;
    }
    return result;
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
