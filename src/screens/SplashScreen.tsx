import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { initDatabase } from '../services/DatabaseService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING } from '../theme';

export default function SplashScreen({ navigation }: any) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const dot1      = useRef(new Animated.Value(0)).current;
  const dot2      = useRef(new Animated.Value(0)).current;
  const dot3      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
    }, 400);

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

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
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={[styles.logoGlow, { opacity: glowOpacity }]} />
          <View style={styles.logoRing}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>🛡️</Text>
            </View>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}>
          <Text style={styles.title}>NETRAX</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content      : { alignItems: 'center' },
  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 40, position: 'relative' },
  logoGlow     : { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: COLORS.primaryGlow },
  logoRing     : { width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: COLORS.primaryBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  logoInner    : { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  logoIcon     : { fontSize: 40 },
  title        : { fontSize: FONT_SIZE.xxxl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, letterSpacing: 8, textAlign: 'center' },
  divider      : { width: 60, height: 2, backgroundColor: COLORS.primary, alignSelf: 'center', marginVertical: 16, borderRadius: 1 },
  subtitle     : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, letterSpacing: 4, textAlign: 'center' },
  dotsContainer: { flexDirection: 'row', gap: 8, marginTop: 48 },
  dot          : { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  loadingText  : { color: COLORS.textTertiary, fontSize: FONT_SIZE.xs, marginTop: 16, letterSpacing: TRACKING.label },
});
