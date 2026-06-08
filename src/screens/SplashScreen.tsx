import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withRepeat, withDelay,
  cancelAnimation, interpolate,
} from 'react-native-reanimated';
import { initDatabase } from '../services/DatabaseService';

const { height } = Dimensions.get('window');

export default function SplashScreen({ navigation }: any) {
  const contentOpacity = useSharedValue(0);
  const logoScale      = useSharedValue(0.3);
  const glowAnim       = useSharedValue(0);   // interpolated → 0.3–1.0 opacity
  const titleY         = useSharedValue(40);
  const titleOpacity   = useSharedValue(0);
  const dot1           = useSharedValue(0);
  const dot2           = useSharedValue(0);
  const dot3           = useSharedValue(0);

  useEffect(() => {
    // Content fade-in
    contentOpacity.value = withTiming(1, { duration: 800 });

    // Logo spring entrance
    logoScale.value = withSpring(1, { damping: 10, stiffness: 80 });

    // Title slide up after 400 ms
    titleY.value      = withDelay(400, withTiming(0,  { duration: 600 }));
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));

    // Glow pulse loop (opacity interpolated 0.3 ↔ 1.0)
    glowAnim.value = withRepeat(
      withSequence(withTiming(1, { duration: 1500 }), withTiming(0, { duration: 1500 })),
      -1, false
    );

    // Staggered dot pulses starting at 600 / 800 / 1000 ms
    dot1.value = withDelay(600,  withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), -1, false));
    dot2.value = withDelay(800,  withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), -1, false));
    dot3.value = withDelay(1000, withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), -1, false));

    const init = async () => {
      await initDatabase();
      await new Promise(r => setTimeout(r, 2800));
      navigation.replace('Login');
    };
    init();

    return () => {
      cancelAnimation(contentOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(glowAnim);
      cancelAnimation(titleY);
      cancelAnimation(titleOpacity);
      cancelAnimation(dot1);
      cancelAnimation(dot2);
      cancelAnimation(dot3);
    };
  }, []);

  const contentStyle   = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const logoStyle      = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const glowStyle      = useAnimatedStyle(() => ({ opacity: interpolate(glowAnim.value, [0, 1], [0.3, 1]) }));
  const titleStyle     = useAnimatedStyle(() => ({ transform: [{ translateY: titleY.value }], opacity: titleOpacity.value }));

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value, transform: [{ scale: interpolate(dot1.value, [0, 1], [0.8, 1.2]) }] }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value, transform: [{ scale: interpolate(dot2.value, [0, 1], [0.8, 1.2]) }] }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value, transform: [{ scale: interpolate(dot3.value, [0, 1], [0.8, 1.2]) }] }));

  return (
    <View style={styles.container}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      <View style={styles.gridContainer}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.gridLine, { top: (height / 8) * i }]} />
        ))}
      </View>

      <Animated.View style={[styles.content, contentStyle]}>
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Animated.View style={[styles.logoGlow, glowStyle]} />
          <View style={styles.logoRing}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>🔐</Text>
            </View>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[styles.titleBlock, titleStyle]}>
          <Text style={styles.title}>DATALAKE</Text>
          <Text style={styles.titleVersion}>3.0</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>SECURE OFFLINE AUTHENTICATION</Text>
        </Animated.View>

        {/* Loading dots */}
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>

        <Text style={styles.loadingText}>Initializing secure environment...</Text>
      </Animated.View>

      <View style={styles.bottomBadge}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>HACKATHON 7.0  ·  POWERED BY AI</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#020817', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orb1         : { position: 'absolute', top: -100, left: -100, width: 350, height: 350, borderRadius: 175, backgroundColor: '#1e40af', opacity: 0.15 },
  orb2         : { position: 'absolute', bottom: -80, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: '#6d28d9', opacity: 0.12 },
  orb3         : { position: 'absolute', top: '40%', left: '60%', width: 180, height: 180, borderRadius: 90, backgroundColor: '#0891b2', opacity: 0.08 },
  gridContainer: { position: 'absolute', width: '100%', height: '100%' },
  gridLine     : { position: 'absolute', width: '100%', height: 1, backgroundColor: '#ffffff', opacity: 0.02 },
  content      : { alignItems: 'center', zIndex: 10 },
  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 40, position: 'relative' },
  logoGlow     : { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#3b82f6' },
  logoRing     : { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.05)' },
  logoInner    : { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  logoIcon     : { fontSize: 40 },
  titleBlock   : { alignItems: 'center' },
  title        : { fontSize: 42, fontWeight: '900', color: '#f8fafc', letterSpacing: 12, textAlign: 'center' },
  titleVersion : { fontSize: 42, fontWeight: '900', color: '#3b82f6', letterSpacing: 12, textAlign: 'center', marginTop: -8 },
  divider      : { width: 60, height: 2, backgroundColor: '#3b82f6', alignSelf: 'center', marginVertical: 16, borderRadius: 1 },
  subtitle     : { fontSize: 11, color: '#64748b', letterSpacing: 4, textAlign: 'center' },
  dotsContainer: { flexDirection: 'row', gap: 8, marginTop: 48 },
  dot          : { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  loadingText  : { color: '#334155', fontSize: 12, marginTop: 16, letterSpacing: 1 },
  bottomBadge  : { position: 'absolute', bottom: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeDot     : { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  badgeText    : { color: '#1e293b', fontSize: 10, letterSpacing: 2, fontWeight: '600' },
});
