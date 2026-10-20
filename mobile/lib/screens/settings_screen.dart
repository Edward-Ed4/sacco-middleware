import 'package:flutter/material.dart';
import '../utils/storage_service.dart';

/// Settings screen — allows the member to configure the gateway URL
/// for their specific SACCO deployment. Defaults to localhost for dev.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey    = GlobalKey<FormState>();
  final _urlCtrl    = TextEditingController();
  bool  _saving     = false;
  bool  _saved      = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final url = await StorageService.loadGatewayUrl();
    setState(() => _urlCtrl.text = url);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _saved = false; });

    await StorageService.saveGatewayUrl(_urlCtrl.text.trim());

    setState(() { _saving = false; _saved = true; });
    await Future.delayed(const Duration(seconds: 2));
    setState(() => _saved = false);
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A56DB),
        foregroundColor: Colors.white,
        title: const Text('Settings'),
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Gateway Configuration',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enter the URL of the SACCO middleware API gateway. Ask your SACCO IT officer for this address.',
                  style: TextStyle(color: Color(0xFF718096), fontSize: 13),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _urlCtrl,
                  keyboardType: TextInputType.url,
                  decoration: InputDecoration(
                    labelText: 'Gateway URL',
                    hintText: 'http://192.168.1.10:3000',
                    prefixIcon: const Icon(Icons.link),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'URL is required';
                    final uri = Uri.tryParse(v.trim());
                    if (uri == null || !uri.hasScheme) return 'Enter a valid URL (http:// or https://)';
                    return null;
                  },
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1A56DB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _saving
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(_saved ? '✓ Saved' : 'Save Settings',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
