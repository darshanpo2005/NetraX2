import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Vibration,
} from 'react-native';

const { width } = Dimensions.get('window');
const ADMIN_PIN = '1234';
const KEY_SIZE  = Math.floor((width * 0.78 - 32) / 3);

export default function LoginScreen({ navigation }: any) {
  const [pin, setPin]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const shakeAnim             = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = (val: string) => {
    if (pin.length >= 4 || loading) return;
    setError(false);
    const newPin = pin + val;
    setPin(newPin);
    if (newPin.length === 4) {
      setLoading(true);
      setTimeout(() => {
        if (newPin === ADMIN_PIN) {
          navigation.replace('Home');
        } else {
          shake();
          setError(true);
          setPin('');
          setLoading(false);
        }
      }, 600);
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin(p => p.slice(0, -1));
    setError(false);
  };

  const keys = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['','0','⌫'],
  ];

  return (
    <View style={styles.container}>
      {/* Decorative orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Logo section */}
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🛡️</Text>
        </View>
        <Text style={styles.appName}>NetraX</Text>
        <Text style={styles.appTagline}>SECURE OFFLINE AUTHENTICATION</Text>
        <View style={styles.divider} />
        <Text style={styles.loginTitle}>Admin Access</Text>
        <Text style={styles.loginSub}>Enter your 4-digit PIN to continue</Text>
      </View>

      {/* PIN boxes */}
      <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[
            styles.pinBox,
            i < pin.length && styles.pinBoxFilled,
            error          && styles.pinBoxError,
          ]}>
            <View style={[
              styles.pinDot,
              i < pin.length && (error ? styles.pinDotError : styles.pinDotFilled),
            ]} />
          </View>
        ))}
      </Animated.View>

      {error && <Text style={styles.errorText}>Incorrect PIN — try again</Text>}

      {/* Keypad */}
      <View style={styles.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key, ki) => (
              key === '' ? (
                <View key={ki} style={styles.keyEmpty} />
              ) : (
                <TouchableOpacity
                  key={ki}
                  onPress={() => key === '⌫' ? handleDelete() : handlePress(key)}
                  activeOpacity={0.65}
                  disabled={loading}
                >
                  <View style={[styles.key, key === '⌫' && styles.keyDelete]}>
                    <Text style={key === '⌫' ? styles.keyDeleteText : styles.keyText}>{key}</Text>
                  </View>
                </TouchableOpacity>
              )
            ))}
          </View>
        ))}
      </View>

      {/* Security badge */}
      <View style={styles.securityBadge}>
        <View style={styles.securityDot} />
        <Text style={styles.securityText}>256-BIT ENCRYPTED  ·  OFFLINE MODE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container     : { flex: 1, backgroundColor: '#0B1437', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 56 },
  orb1          : { position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: '#1e40af', opacity: 0.15 },
  orb2          : { position: 'absolute', bottom: -60, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: '#4c1d95', opacity: 0.12 },

  logoSection   : { alignItems: 'center', gap: 8 },
  logoCircle    : { width: 84, height: 84, borderRadius: 28, backgroundColor: '#1e40af', borderWidth: 2, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  logoEmoji     : { fontSize: 40 },
  appName       : { fontSize: 36, fontWeight: '900', color: '#f8fafc', letterSpacing: 4 },
  appTagline    : { fontSize: 10, color: '#4f6ef7', letterSpacing: 3, fontWeight: '700' },
  divider       : { width: 40, height: 2, backgroundColor: 'rgba(99,102,241,0.5)', borderRadius: 1, marginVertical: 8 },
  loginTitle    : { fontSize: 22, fontWeight: '800', color: '#e2e8f0' },
  loginSub      : { fontSize: 13, color: '#475569', letterSpacing: 0.3 },

  pinRow        : { flexDirection: 'row', gap: 16 },
  pinBox        : {
    width: 64, height: 72, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  pinBoxFilled  : { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(99,102,241,0.7)' },
  pinBoxError   : { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.6)'  },
  pinDot        : { width: 14, height: 14, borderRadius: 7, backgroundColor: 'transparent' },
  pinDotFilled  : { backgroundColor: '#818cf8' },
  pinDotError   : { backgroundColor: '#f87171' },
  errorText     : { color: '#f87171', fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginTop: -8 },

  keypad        : { width: width * 0.78, gap: 12 },
  keyRow        : { flexDirection: 'row', justifyContent: 'space-between' },
  key           : { width: KEY_SIZE, height: KEY_SIZE, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  keyDelete     : { backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.06)' },
  keyEmpty      : { width: KEY_SIZE, height: KEY_SIZE },
  keyText       : { fontSize: 28, fontWeight: '500', color: '#f1f5f9' },
  keyDeleteText : { fontSize: 24, color: '#64748b' },

  securityBadge : { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(15,23,42,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  securityDot   : { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22d3ee' },
  securityText  : { color: '#334155', fontSize: 10, letterSpacing: 2, fontWeight: '600' },
});
