import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../theme';

interface Props {
  children: React.ReactNode;
  accentColor?: string;
  style?: ViewStyle | ViewStyle[];
  noPadding?: boolean;
}

// Standard surface card: 16px radius, hairline border, optional left accent bar.
export default function Card({ children, accentColor, style, noPadding }: Props) {
  return (
    <View style={[styles.card, noPadding && styles.noPadding, style]}>
      {accentColor ? <View style={[styles.accent, { backgroundColor: accentColor }]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.inner,
    overflow: 'hidden',
  },
  noPadding: {
    padding: 0,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
});
