/// Receipt model — represents a decoded QR payload or API response
class Receipt {
  final String receiptId;
  final String tenantId;
  final String txRef;
  final String txType;
  final String amount;
  final String acctPseudo;
  final String txTimestamp;
  final int sequenceNo;
  final String leafHex;
  final String status;
  final List<MerkleProofStep>? merkleProof;
  final String? merkleRoot;
  final int? blockNumber;
  final String? txHash;

  const Receipt({
    required this.receiptId,
    required this.tenantId,
    required this.txRef,
    required this.txType,
    required this.amount,
    required this.acctPseudo,
    required this.txTimestamp,
    required this.sequenceNo,
    required this.leafHex,
    required this.status,
    this.merkleProof,
    this.merkleRoot,
    this.blockNumber,
    this.txHash,
  });

  bool get isAnchored => status == 'ANCHORED';
  bool get isPending  => status == 'PENDING';

  factory Receipt.fromJson(Map<String, dynamic> json) {
    return Receipt(
      receiptId:   json['receiptId']   as String,
      tenantId:    json['tenantId']    as String,
      txRef:       json['txRef']       as String,
      txType:      json['txType']      as String,
      amount:      json['amount'].toString(),
      acctPseudo:  json['acctPseudo']  as String,
      txTimestamp: json['txTimestamp'] as String,
      sequenceNo:  json['sequenceNo']  is int
          ? json['sequenceNo'] as int
          : int.parse(json['sequenceNo'].toString()),
      leafHex:     json['leafHex']     as String,
      status:      json['status']      as String,
      merkleProof: (json['merkleProof'] as List<dynamic>?)
          ?.map((e) => MerkleProofStep.fromJson(e as Map<String, dynamic>))
          .toList(),
      merkleRoot:  json['merkleRoot']  as String?,
      blockNumber: json['blockNumber'] as int?,
      txHash:      json['txHash']      as String?,
    );
  }
}

class MerkleProofStep {
  final String sibling;
  final String position; // 'left' or 'right'

  const MerkleProofStep({required this.sibling, required this.position});

  factory MerkleProofStep.fromJson(Map<String, dynamic> json) {
    return MerkleProofStep(
      sibling:  json['sibling']  as String,
      position: json['position'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'sibling': sibling, 'position': position};
}
