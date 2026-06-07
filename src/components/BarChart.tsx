import React from 'react';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';

interface BarDatum { x: string; y: number }

interface Props {
  data: BarDatum[];
  width: number;
  height?: number;
  barColor?: string;
}

// Lightweight SVG bar chart — no external chart library required.
export default function BarChart({ data, width, height = 200, barColor = '#3b82f6' }: Props) {
  const PAD = { top: 20, bottom: 34, left: 30, right: 10 };
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const maxY   = Math.max(...data.map(d => d.y), 1);
  const slot   = innerW / (data.length || 1);
  const barW   = slot * 0.55;

  // 3 y-axis gridlines: 0, 50%, 100%
  const gridFracs = [0, 0.5, 1];

  return (
    <Svg width={width} height={height}>
      {gridFracs.map(frac => {
        const yVal = Math.round(maxY * frac);
        const yPos = PAD.top + innerH * (1 - frac);
        return (
          <React.Fragment key={frac}>
            <Line
              x1={PAD.left} y1={yPos}
              x2={width - PAD.right} y2={yPos}
              stroke="#1e293b"
              strokeWidth={1}
              strokeDasharray={frac > 0 ? '4 4' : undefined}
            />
            <SvgText
              x={PAD.left - 4} y={yPos + 4}
              textAnchor="end" fill="#475569" fontSize={9}
            >{yVal}</SvgText>
          </React.Fragment>
        );
      })}

      {data.map((d, i) => {
        const barH = Math.max(d.y / maxY * innerH, d.y > 0 ? 2 : 0);
        const x    = PAD.left + i * slot + (slot - barW) / 2;
        const y    = PAD.top + innerH - barH;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={barW} height={barH} fill={barColor} rx={3} />
            {/* value label above bar */}
            {d.y > 0 && (
              <SvgText
                x={x + barW / 2} y={y - 4}
                textAnchor="middle" fill="#93c5fd" fontSize={10}
              >{d.y}</SvgText>
            )}
            {/* x-axis label */}
            <SvgText
              x={x + barW / 2} y={height - 6}
              textAnchor="middle" fill="#64748b" fontSize={11}
            >{d.x}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
