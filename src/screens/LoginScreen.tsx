import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Alert, Dimensions, Vibration
} from 'react-native';

const { width } = Dimensions.get('window');
const ADMIN_PIN = '1234';

export default function LoginScreen({ navigation }: any) {
  const [pin, setPin]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);
  const shakeAnim             = useRef(new Animated.Value(0)).current;
  const fadeAnim              = useRef(new Animated.Value(1)).current;

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
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
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoSmall}>
          <Text style={styles.logoIcon}>🔐</Text>
        </View>
        <Text style={styles.title}>Admin Access</Text>
        <Text style={styles.subtitle}>Enter your secure PIN to continue</Text>
      </View>

      {/* PIN Dots */}
      <Animated.View style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[
            styles.pinDot,
            i < pin.length && styles.pinDotFilled,
            error && styles.pinDotError,
          ]}>
            {i < pin.length && <View style={[styles.pinDotInner, error && styles.pinDotInnerError]} />}
          </View>
        ))}
      </Animated.View>

      {error && (
        <Text style={styles.errorText}>Incorrect PIN. Try again.</Text>
      )}

      {/* Keypad */}
      <View style={styles.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key, ki) => (
              <TouchableOpacity
                key={ki}
                style={[styles.key, key === '' && styles.keyEmpty]}
                onPress={() => key === '⌫' ? handleDelete() : key !== '' ? handlePress(key) : null}
                activeOpacity={0.7}
                disabled={key === '' || loading}
              >
                {key === '⌫' ? (
                  <Text style={styles.keyDelete}>⌫</Text>
                ) : key !== '' ? (
                  <Text style={styles.keyText}>{key}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {/* Hint */}
      <View style={styles.hintContainer}>
        <View style={styles.hintDot} />
        <Text style={styles.hint}>Demo PIN: 1234</Text>
      </View>

      {/* Security badge */}
      <View style={styles.securityBadge}>
        <Text style={styles.securityText}>🔒  256-BIT ENCRYPTED  ·  OFFLINE MODE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container      : { flex: 1, backgroundColor: '#020817', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60 },
  orb1           : { position: 'absolute', top: -60, left: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: '#1e40af', opacity: 0.12 },
  orb2           : { position: 'absolute', bottom: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#6d28d9', opacity: 0.1 },
  header         : { alignItems: 'center', gap: 12 },
  logoSmall      : { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.3)', alignItems: 'center', justifyContent: 'center' },
  logoIcon       : { fontSize: 30 },
  title          : { fontSize: 28, fontWeight: '800', color: '#f8fafc', letterSpacing: 1 },
  subtitle       : { fontSize: 13, color: '#475569', letterSpacing: 0.5 },
  pinRow         : { flexDirection: 'row', gap: 20, marginVertical: 8 },
  pinDot         : { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  pinDotFilled   : { borderColor: '#3b82f6' },
  pinDotError    : { borderColor: '#ef4444' },
  pinDotInner    : { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  pinDotInnerError: { backgroundColor: '#ef4444' },
  errorText      : { color: '#ef4444', fontSize: 13, letterSpacing: 0.5, marginTop: 4 },
  keypad         : { width: width * 0.72, gap: 12 },
  keyRow         : { flexDirection: 'row', justifyContent: 'space-between' },
  key            : { width: (width * 0.72 - 32) / 3, height: (width * 0.72 - 32) / 3, borderRadius: 20, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  keyEmpty       : { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText        : { fontSize: 26, fontWeight: '600', color: '#f1f5f9' },
  keyDelete      : { fontSize: 22, color: '#94a3b8' },
  hintContainer  : { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintDot        : { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' },
  hint           : { color: '#334155', fontSize: 12, letterSpacing: 0.5 },
  securityBadge  : { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: '#1e293b' },
  securityText   : { color: '#334155', fontSize: 10, letterSpacing: 2, fontWeight: '600' },
});
