import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/verification_provider.dart';
import 'screens/home_screen.dart';
import 'screens/history_screen.dart';
import 'screens/settings_screen.dart';

void main() {
  runApp(const SaccoVerifyApp());
}

class SaccoVerifyApp extends StatelessWidget {
  const SaccoVerifyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => VerificationProvider(),
      child: MaterialApp(
        title: 'SACCO Verify',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF1A56DB),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
        ),
        home: const MainShell(),
      ),
    );
  }
}

/// Bottom-navigation shell wrapping the three main sections.
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _screens = [
    HomeScreen(),
    HistoryScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.verified_user_outlined),
            selectedIcon: Icon(Icons.verified_user),
            label: 'Verify',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history),
            label: 'History',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
