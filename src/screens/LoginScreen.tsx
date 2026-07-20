import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Animated, Vibration, Keyboard, StatusBar,
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Button from '../components/Button';

const ADMIN_PIN = '1234';
const PIN_LENGTH = 4;
const TOP_INSET = StatusBar.currentHeight || 44;

export default function LoginScreen({ navigation }: any) {
  const [pin, setPin]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const [focused, setFocused] = useState(false);
  const shakeAnim             = useRef(new Animated.Value(0)).current;
  const inputRef              = useRef<TextInput>(null);

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handleChangePin = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
    setError(false);
    setPin(digits);
  };

  const handleSignIn = () => {
    if (pin.length !== PIN_LENGTH || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setTimeout(() => {
      if (pin === ADMIN_PIN) {
        navigation.replace('Home');
      } else {
        shake();
        setError(true);
        setPin('');
        setLoading(false);
      }
    }, 500);
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
        <Text style={styles.subheading}>Sign in to continue</Text>

        <TouchableOpacity
          style={styles.pinTouchArea}
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
              const isActive = focused && i === pin.length;
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
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={handleChangePin}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={PIN_LENGTH}
          autoFocus
          secureTextEntry
          cursorColor="#2563EB"
        />

        {error ? <Text style={styles.errorText}>Incorrect PIN — try again</Text> : null}

        <Button
          label="Sign In"
          onPress={handleSignIn}
          disabled={pin.length !== PIN_LENGTH}
          loading={loading}
          style={styles.signInBtn}
        />
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
    paddingTop: 64 + TOP_INSET,
    paddingBottom: 64,
    paddingHorizontal: SPACING.screen,
  },

  logoSection: {
    alignItems: 'center',
    marginTop: 24,
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoEmoji: {
    fontSize: 44,
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
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
    marginBottom: 40,
  },

  pinTouchArea: {
    width: '100%',
    alignItems: 'center',
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
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: TRACKING.label,
    marginTop: 16,
  },

  signInBtn: {
    marginTop: 32,
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
