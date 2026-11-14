import 'package:flutter/material.dart';
import 'home_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with TickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  late AnimationController _fadeController;
  late Animation<double> _fadeAnim;

  static const _pages = [
    _OnboardPage(
      gradient: [Color(0xFF00D4AA), Color(0xFF007AFF)],
      icon: Icons.receipt_long_rounded,
      badge1: _Badge('Scan QR', Icons.qr_code_scanner),
      badge2: _Badge('Instant', Icons.flash_on),
      title: 'Verify your receipt,\nin seconds.',
      subtitle:
          'Scan the QR code on your SACCO receipt and instantly confirm it is genuine and recorded on the blockchain.',
    ),
    _OnboardPage(
      gradient: [Color(0xFF7B61FF), Color(0xFF00D4AA)],
      icon: Icons.link_rounded,
      badge1: _Badge('Blockchain', Icons.lock_outlined),
      badge2: _Badge('Immutable', Icons.verified_outlined),
      title: 'Anchored on\nthe blockchain.',
      subtitle:
          'Every transaction is cryptographically committed to a Hyperledger Besu network run by independent institutions.',
    ),
    _OnboardPage(
      gradient: [Color(0xFFFF6B35), Color(0xFFFFD700)],
      icon: Icons.sms_rounded,
      badge1: _Badge('SMS Code', Icons.phone_android),
      badge2: _Badge('Any Phone', Icons.signal_cellular_alt),
      title: 'Works on any\nphone, anywhere.',
      subtitle:
          'No smartphone? No problem. Enter the 6-character SMS code sent to your phone to verify your transaction.',
    ),
    _OnboardPage(
      gradient: [Color(0xFF00D4AA), Color(0xFF0070F3)],
      icon: Icons.shield_rounded,
      badge1: _Badge('Tamper Proof', Icons.security),
      badge2: _Badge('Real-time', Icons.notifications_active),
      title: 'Protect your\nsavings.',
      subtitle:
          'If anyone modifies or deletes your transaction, the system detects it and alerts SACCO officials immediately.',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeController, curve: Curves.easeIn);
    _fadeController.forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    } else {
      _goToApp();
    }
  }

  void _goToApp() {
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => const HomeScreen(),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
        transitionDuration: const Duration(milliseconds: 500),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FF),
      body: Stack(
        children: [
          // ── Page content ─────────────────────────────────────
          PageView.builder(
            controller: _pageController,
            onPageChanged: (i) {
              setState(() => _currentPage = i);
              _fadeController.reset();
              _fadeController.forward();
            },
            itemCount: _pages.length,
            itemBuilder: (_, i) => _PageContent(page: _pages[i], fadeAnim: _fadeAnim),
          ),

          // ── Bottom sheet ──────────────────────────────────────
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(28, 0, 28, 44),
              decoration: const BoxDecoration(
                color: Colors.transparent,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Page dots
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (i) {
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: _currentPage == i ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _currentPage == i
                              ? const Color(0xFF00D4AA)
                              : const Color(0xFF00D4AA).withAlpha(80),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 28),

                  // Main button
                  GestureDetector(
                    onTap: _nextPage,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: double.infinity,
                      height: 58,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF00D4AA), Color(0xFF00B894)],
                        ),
                        borderRadius: BorderRadius.circular(32),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF00D4AA).withAlpha(100),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          _currentPage == _pages.length - 1
                              ? 'Get Started'
                              : 'Continue',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            letterSpacing: .3,
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Skip
                  if (_currentPage < _pages.length - 1) ...[
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: _goToApp,
                      child: const Text(
                        'Skip',
                        style: TextStyle(
                          color: Color(0xFF8A94A6),
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Single page ──────────────────────────────────────────────────────────────
class _PageContent extends StatelessWidget {
  final _OnboardPage page;
  final Animation<double> fadeAnim;

  const _PageContent({required this.page, required this.fadeAnim});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Column(
      children: [
        // ── Illustration area ───────────────────────────────────
        SizedBox(
          height: size.height * 0.52,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Glowing background circle
              Positioned(
                top: 40,
                child: Container(
                  width: size.width * 0.75,
                  height: size.width * 0.75,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        page.gradient[0].withAlpha(60),
                        page.gradient[1].withAlpha(20),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),

              // Concentric circles
              Positioned(
                top: 60,
                child: _ConcentricCircles(color: page.gradient[0]),
              ),

              // Main card with icon
              FadeTransition(
                opacity: fadeAnim,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, .08),
                    end: Offset.zero,
                  ).animate(CurvedAnimation(parent: fadeAnim, curve: Curves.easeOut)),
                  child: Container(
                    width: size.width * 0.52,
                    height: size.width * 0.52,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          page.gradient[0].withAlpha(230),
                          page.gradient[1].withAlpha(200),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: [
                        BoxShadow(
                          color: page.gradient[0].withAlpha(100),
                          blurRadius: 40,
                          offset: const Offset(0, 16),
                        ),
                      ],
                    ),
                    child: Icon(
                      page.icon,
                      size: size.width * 0.22,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),

              // Badge 1 (left)
              Positioned(
                left: 20,
                top: size.height * 0.18,
                child: FadeTransition(
                  opacity: fadeAnim,
                  child: _BadgeWidget(badge: page.badge1, gradient: page.gradient),
                ),
              ),

              // Badge 2 (right)
              Positioned(
                right: 20,
                top: size.height * 0.26,
                child: FadeTransition(
                  opacity: fadeAnim,
                  child: _BadgeWidget(badge: page.badge2, gradient: page.gradient),
                ),
              ),
            ],
          ),
        ),

        // ── Text area ───────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: FadeTransition(
            opacity: fadeAnim,
            child: Column(
              children: [
                Text(
                  page.title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0A1628),
                    height: 1.2,
                    letterSpacing: -.3,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  page.subtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF5A6476),
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ConcentricCircles extends StatelessWidget {
  final Color color;
  const _ConcentricCircles({required this.color});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return SizedBox(
      width: size.width * 0.85,
      height: size.width * 0.85,
      child: Stack(
        alignment: Alignment.center,
        children: [
          for (final d in [0.85, 0.65, 0.45])
            Container(
              width: size.width * d,
              height: size.width * d,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: color.withAlpha(25),
                  width: 1,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _BadgeWidget extends StatelessWidget {
  final _Badge badge;
  final List<Color> gradient;
  const _BadgeWidget({required this.badge, required this.gradient});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: gradient[0].withAlpha(60),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(badge.icon, size: 16, color: gradient[0]),
          const SizedBox(width: 6),
          Text(
            badge.label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF0A1628),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Data classes ─────────────────────────────────────────────────────────────
class _OnboardPage {
  final List<Color> gradient;
  final IconData icon;
  final _Badge badge1;
  final _Badge badge2;
  final String title;
  final String subtitle;

  const _OnboardPage({
    required this.gradient,
    required this.icon,
    required this.badge1,
    required this.badge2,
    required this.title,
    required this.subtitle,
  });
}

class _Badge {
  final String label;
  final IconData icon;
  const _Badge(this.label, this.icon);
}
