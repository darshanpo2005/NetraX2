import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { initDatabase } from '../services/DatabaseService';

const { height } = Dimensions.get('window');

export default function SplashScreen({ navigation }: any) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const dot1      = useRef(new Animated.Value(0)).current;
  const dot2      = useRef(new Animated.Value(0)).current;
  const dot3      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    // Title slide up
    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
    }, 400);

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Loading dots stagger
    const dotAnim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400,         useNativeDriver: true }),
        ])
      ).start();

    setTimeout(() => {
      dotAnim(dot1, 0);
      dotAnim(dot2, 200);
      dotAnim(dot3, 400);
    }, 600);

    const init = async () => {
      await initDatabase();
      await new Promise(r => setTimeout(r, 2800));
      navigation.replace('Login');
    };
    init();
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

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

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={[styles.logoGlow, { opacity: glowOpacity }]} />
          <View style={styles.logoRing}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>🔐</Text>
            </View>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}>
          <Text style={styles.title}>DATALAKE</Text>
          <Text style={styles.titleVersion}>3.0</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>SECURE OFFLINE AUTHENTICATION</Text>
        </Animated.View>

        {/* Loading dots */}
        <View style={styles.dotsContainer}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View key={i} style={[styles.dot, {
              opacity: dot,
              transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
            }]} />
          ))}
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
  logoGlow     : { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#3b82f6', opacity: 0.2 },
  logoRing     : { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.05)' },
  logoInner    : { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  logoIcon     : { fontSize: 40 },
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
