import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'providers/verification_provider.dart';
import 'screens/onboarding_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
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
            seedColor: const Color(0xFF00D4AA),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
          fontFamily: 'Segoe UI',
          scaffoldBackgroundColor: const Color(0xFFF0F4FF),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF00D4AA),
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: true,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00D4AA),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(32),
              ),
              minimumSize: const Size(double.infinity, 56),
            ),
          ),
        ),
        home: const OnboardingScreen(),
      ),
    );
  }
}
