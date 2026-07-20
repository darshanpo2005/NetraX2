import React, { useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Animated, Vibration, StatusBar, ActivityIndicator,
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';

const ADMIN_PIN = '1234';
const PIN_LENGTH = 4;
const TOP_INSET = StatusBar.currentHeight || 44;

const KEYPAD_ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['',  '0', 'del'],
];

export default function LoginScreen({ navigation }: any) {
  const [pin, setPin]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const shakeAnim              = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const attemptLogin = (candidate: string) => {
    setLoading(true);
    setTimeout(() => {
      if (candidate === ADMIN_PIN) {
        navigation.replace('MainTabs');
      } else {
        shake();
        setError(true);
        setPin('');
        setLoading(false);
      }
    }, 500);
  };

  const handleDigitPress = (digit: string) => {
    if (loading || pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setError(false);
    setPin(next);
    if (next.length === PIN_LENGTH) attemptLogin(next);
  };

  const handleBackspace = () => {
    if (loading || pin.length === 0) return;
    setError(false);
    setPin(p => p.slice(0, -1));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080C14" />

      <View style={styles.logoSection}>
        <View style={styles.logoGlow} />
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🛡️</Text>
        </View>
        <Text style={styles.appName}>NetraX</Text>
        <Text style={styles.appTagline}>SECURE OFFLINE AUTHENTICATION</Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.heading}>Welcome Back</Text>
        <Text style={styles.subheading}>Enter your PIN to continue</Text>

        <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const isActive = i === pin.length && pin.length < PIN_LENGTH;
            return (
              <View
                key={i}
                style={[
                  styles.pinBox,
                  i < pin.length && styles.pinBoxFilled,
                  isActive && styles.pinBoxActive,
                  error && styles.pinBoxError,
                ]}
              >
                {i < pin.length ? (
                  <View style={[styles.pinDot, error && styles.pinDotError]} />
                ) : null}
              </View>
            );
          })}
        </Animated.View>

        {error ? (
          <Text style={styles.errorText}>Incorrect PIN — try again</Text>
        ) : loading ? (
          <ActivityIndicator color={COLORS.primary} style={styles.loadingIndicator} />
        ) : null}

        <View style={[styles.keypad, loading && styles.keypadDisabled]}>
          {KEYPAD_ROWS.map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((key, ci) => {
                if (key === '') {
                  return <View key={ci} style={styles.keypadBtn} />;
                }
                if (key === 'del') {
                  return (
                    <Pressable
                      key={ci}
                      onPress={handleBackspace}
                      disabled={loading}
                      style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnActive]}
                    >
                      <Text style={styles.keypadText}>⌫</Text>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    key={ci}
                    onPress={() => handleDigitPress(key)}
                    disabled={loading}
                    style={({ pressed }) => [styles.keypadBtn, pressed && styles.keypadBtnActive]}
                  >
                    <Text style={styles.keypadText}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.securityBadge}>
        <View style={styles.securityDot} />
        <Text style={styles.securityText}>256-BIT ENCRYPTED · OFFLINE MODE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48 + TOP_INSET,
    paddingBottom: 32,
    paddingHorizontal: SPACING.screen,
  },

  logoSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  logoGlow: {
    position: 'absolute',
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primaryGlow,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  appTagline: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
    letterSpacing: TRACKING.caps,
    marginTop: 6,
  },

  formSection: {
    width: '100%',
    alignItems: 'center',
  },
  heading: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  subheading: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.light,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 28,
  },

  pinRow: {
    flexDirection: 'row',
    gap: 16,
  },
  pinBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.buttonSm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFilled: {
    backgroundColor: COLORS.primaryGlow,
    borderColor: COLORS.primaryBorder,
  },
  pinBoxActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37,99,235,0.1)',
  },
  pinBoxError: {
    backgroundColor: COLORS.errorGlow,
    borderColor: COLORS.errorBorder,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  pinDotError: {
    backgroundColor: COLORS.error,
  },

  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: TRACKING.label,
    marginTop: 16,
  },
  loadingIndicator: {
    marginTop: 16,
  },

  keypad: {
    width: '100%',
    gap: 18,
    marginTop: 28,
  },
  keypadDisabled: {
    opacity: 0.5,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0F1923',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadBtnActive: {
    backgroundColor: '#1E3A5F',
  },
  keypadText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
  },

  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  securityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  securityText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs - 1,
    letterSpacing: TRACKING.caps,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
