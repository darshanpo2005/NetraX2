import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT } from '../theme';

interface BarDatum { x: string; y: number }

interface Props {
  data: BarDatum[];
  barColor?: string;
  maxBarHeight?: number;
}

// Pure-View bar chart — zero external dependencies.
export default function BarChart({ data, barColor = COLORS.primary, maxBarHeight = 120 }: Props) {
  const maxY = Math.max(...data.map(d => d.y), 1);

  return (
    <View style={styles.container}>
      {data.map((item, i) => {
        const barH = Math.max((item.y / maxY) * maxBarHeight, item.y > 0 ? 3 : 0);
        return (
          <View key={i} style={styles.column}>
            <Text style={styles.valueLabel}>{item.y > 0 ? item.y : ' '}</Text>
            <View style={[styles.bar, { height: barH, backgroundColor: barColor }]} />
            <Text style={styles.xLabel}>{item.x}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container  : { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingBottom: 8, paddingTop: 28 },
  column     : { flex: 1, alignItems: 'center', gap: 5 },
  bar        : { width: 24, borderRadius: 4 },
  valueLabel : { fontSize: 10, color: COLORS.primary, fontWeight: FONT_WEIGHT.semibold, height: 14 },
  xLabel     : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 5 },
});
