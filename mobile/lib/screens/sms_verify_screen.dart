import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/verification_provider.dart';
import 'result_screen.dart';

/// SMS verification screen — for feature phone users who received a
/// 6-character Crockford Base32 code via SMS.
class SmsVerifyScreen extends StatefulWidget {
  const SmsVerifyScreen({super.key});

  @override
  State<SmsVerifyScreen> createState() => _SmsVerifyScreenState();
}

class _SmsVerifyScreenState extends State<SmsVerifyScreen> {
  final _formKey       = GlobalKey<FormState>();
  final _phoneCtrl     = TextEditingController();
  final _codeCtrl      = TextEditingController();
  final _receiptIdCtrl = TextEditingController();

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _codeCtrl.dispose();
    _receiptIdCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final provider = context.read<VerificationProvider>();
    await provider.verifyFromSms(
      phoneNumber: _phoneCtrl.text.trim(),
      code:        _codeCtrl.text.trim().toUpperCase(),
      receiptId:   _receiptIdCtrl.text.trim(),
    );

    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ResultScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<VerificationProvider>();
    final isLoading = provider.state == VerificationState.loading;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A56DB),
        foregroundColor: Colors.white,
        title: const Text('Enter SMS Code'),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                const Icon(Icons.sms, size: 56, color: Color(0xFF057A55)),
                const SizedBox(height: 12),
                const Text(
                  'Enter the 6-character code\nfrom your receipt SMS',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, color: Color(0xFF1A202C)),
                ),
                const SizedBox(height: 32),

                // Phone number
                TextFormField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: _inputDecoration(
                    label: 'Phone Number',
                    hint: '+256700000000',
                    icon: Icons.phone,
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Phone number required';
                    if (!v.trim().startsWith('+')) return 'Include country code e.g. +256';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Receipt ID
                TextFormField(
                  controller: _receiptIdCtrl,
                  decoration: _inputDecoration(
                    label: 'Receipt ID',
                    hint: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                    icon: Icons.receipt,
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Receipt ID required';
                    if (v.trim().length != 36) return 'Invalid receipt ID format';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // 6-character code
                TextFormField(
                  controller: _codeCtrl,
                  textCapitalization: TextCapitalization.characters,
                  maxLength: 6,
                  decoration: _inputDecoration(
                    label: 'Verification Code',
                    hint: 'R26NGV',
                    icon: Icons.lock,
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Code required';
                    if (v.trim().length != 6) return 'Code must be exactly 6 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Submit button
                ElevatedButton(
                  onPressed: isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF057A55),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: isLoading
                      ? const SizedBox(
                          height: 20, width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Verify Transaction', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String label,
    required String hint,
    required IconData icon,
  }) {
    return InputDecoration(
      labelText: label,
      hintText:  hint,
      prefixIcon: Icon(icon, color: const Color(0xFF718096)),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      filled: true,
      fillColor: Colors.white,
    );
  }
}
